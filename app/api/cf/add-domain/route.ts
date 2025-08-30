import { NextRequest, NextResponse } from "next/server"

interface AddDomainRequest {
  domain: string
  accountId: string
  scriptName: string
}

interface CloudflareApiResponse {
  success: boolean
  errors: any[]
  result: any
}

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN

async function callCloudflareAPI(endpoint: string, method: string = 'GET', body?: any) {
  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN not configured')
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data: CloudflareApiResponse = await response.json()
  
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors.map(e => e.message).join(', ')}`)
  }
  
  return data.result
}

export async function POST(request: NextRequest) {
  try {
    if (!CLOUDFLARE_API_TOKEN) {
      return NextResponse.json(
        { error: 'Cloudflare API token not configured' },
        { status: 500 }
      )
    }

    const body: AddDomainRequest = await request.json()
    const { domain, accountId, scriptName } = body

    if (!domain || !accountId || !scriptName) {
      return NextResponse.json(
        { error: 'Missing required fields: domain, accountId, scriptName' },
        { status: 400 }
      )
    }

    // Step 1: Get zone for the domain
    console.log(`Adding domain: ${domain}`)
    const zones = await callCloudflareAPI(`/zones?name=${domain}`)
    if (zones.length === 0) {
      return NextResponse.json(
        { error: `Zone not found for domain: ${domain}` },
        { status: 404 }
      )
    }

    const zone = zones[0]

    // Step 2: Enable email routing for the zone
    try {
      await callCloudflareAPI(`/zones/${zone.id}/email/routing/enable`, 'POST')
    } catch (e) {
      console.log(`Email routing might already be enabled for ${domain}`)
    }

    // Step 3: Create catch-all rule
    await callCloudflareAPI(`/zones/${zone.id}/email/routing/rules`, 'POST', {
      matchers: [{ type: 'all' }],
      actions: [{ type: 'worker', value: scriptName }]
    })

    // Step 4: Get current worker script to update MAIL_DOMAIN
    const workerScript = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`)
    
    // Get current environment variables
    const currentVars = workerScript.vars || {}
    const currentMailDomain = currentVars.MAIL_DOMAIN || ''
    const currentDomains = currentMailDomain.split(',').filter((d: string) => d.trim()).map((d: string) => d.trim())
    
    // Add new domain if not already present
    if (!currentDomains.includes(domain)) {
      const updatedDomains = [...currentDomains, domain]
      const newMailDomain = updatedDomains.join(',')
      
      // Update worker environment variables
      await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'PUT', {
        script: workerScript.script,
        bindings: workerScript.bindings,
        vars: {
          ...currentVars,
          MAIL_DOMAIN: newMailDomain
        }
      })

      console.log(`Added domain ${domain} to worker ${scriptName}`)
      
      return NextResponse.json({
        success: true,
        domain,
        domains: updatedDomains
      })
    } else {
      return NextResponse.json({
        success: true,
        domains: currentDomains,
        message: 'Domain already exists'
      })
    }

  } catch (error) {
    console.error('Add domain error:', error)
    return NextResponse.json(
      { error: `Failed to add domain: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 