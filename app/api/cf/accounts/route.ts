import { NextRequest, NextResponse } from "next/server"

interface CloudflareApiResponse {
  success: boolean
  errors: any[]
  result: any
}

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN

async function callCloudflareAPI(endpoint: string, method: string = 'GET', body?: any, apiToken?: string) {
  const token = apiToken || CLOUDFLARE_API_TOKEN
  
  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN not configured')
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data: CloudflareApiResponse = await response.json()
  
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors.map(e => e.message).join(', ')}`)
  }
  
  return data.result
}

export async function GET(request: NextRequest) {
  try {
    // token priority: header -> cookie -> env
    const apiTokenFromHeader = request.headers.get('X-CF-API-Token')
    const apiTokenFromCookie = request.cookies.get('cf_api_token')?.value
    const apiToken = apiTokenFromHeader || apiTokenFromCookie || CLOUDFLARE_API_TOKEN
    
    if (!apiToken) {
      return NextResponse.json({
        success: false,
        code: 'CONFIG_REQUIRED',
        missing: ['apiToken'],
        message: 'Cloudflare API token not configured'
      })
    }

    // Get user accounts
    const accounts = await callCloudflareAPI('/accounts', 'GET', undefined, apiToken)
    
    // Get zones for each account
    const accountsWithZones = await Promise.all(
      accounts.map(async (account: any) => {
        try {
          const zones = await callCloudflareAPI(`/zones?account.id=${account.id}`, 'GET', undefined, apiToken)
          return {
            id: account.id,
            name: account.name,
            type: account.type,
            zones: zones.map((zone: any) => ({
              id: zone.id,
              name: zone.name,
              status: zone.status,
              plan: zone.plan?.name || 'Unknown'
            }))
          }
        } catch (error) {
          console.warn(`Failed to get zones for account ${account.id}:`, error)
          return {
            id: account.id,
            name: account.name,
            type: account.type,
            zones: []
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      accounts: accountsWithZones
    })

  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error)
    // Gracefully map common CF errors to configuration issues
    if (message.includes('CLOUDFLARE_API_TOKEN not configured') ||
        message.toLowerCase().includes('unauthorized') ||
        message.toLowerCase().includes('invalid request headers') ||
        message.toLowerCase().includes('invalid') && message.toLowerCase().includes('token')) {
      return NextResponse.json({
        success: false,
        code: 'CONFIG_INVALID',
        message: 'Cloudflare API token is missing or invalid. Please connect your token.'
      })
    }

    console.error('Accounts fetch error:', error)
    return NextResponse.json(
      { error: `Failed to fetch accounts: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 