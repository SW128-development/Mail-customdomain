import { NextRequest, NextResponse } from "next/server"

interface RemoveDomainRequest {
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

    const body: RemoveDomainRequest = await request.json()
    const { domain, accountId, scriptName } = body

    if (!domain || !accountId || !scriptName) {
      return NextResponse.json(
        { error: 'Missing required fields: domain, accountId, scriptName' },
        { status: 400 }
      )
    }

    // Step 1: Get zone for the domain
    console.log(`Removing domain: ${domain}`)
    const zones = await callCloudflareAPI(`/zones?name=${domain}`)
    if (zones.length === 0) {
      return NextResponse.json(
        { error: `Zone not found for domain: ${domain}` },
        { status: 404 }
      )
    }

    const zone = zones[0]

    // Step 2: Remove catch-all email routing rules for this worker
    try {
      const routingRules = await callCloudflareAPI(`/zones/${zone.id}/email/routing/rules`)
      
      for (const rule of routingRules) {
        // Check if rule is a catch-all rule pointing to our worker
        const hasCatchAllMatcher = rule.matchers.some((matcher: any) => matcher.type === 'all')
        const hasWorkerAction = rule.actions.some((action: any) => 
          action.type === 'worker' && action.value === scriptName
        )
        
        if (hasCatchAllMatcher && hasWorkerAction) {
          await callCloudflareAPI(`/zones/${zone.id}/email/routing/rules/${rule.id}`, 'DELETE')
          console.log(`Removed email routing rule for ${domain}`)
        }
      }
    } catch (error) {
      console.warn(`Failed to remove email routing rules for ${domain}:`, error)
    }

    // Step 3: Get current worker script to update MAIL_DOMAIN
    const workerScript = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`)
    
    // Get current environment variables
    const currentVars = workerScript.vars || {}
    const currentMailDomain = currentVars.MAIL_DOMAIN || ''
    const currentDomains = currentMailDomain.split(',').filter((d: string) => d.trim()).map((d: string) => d.trim())
    
    // Remove domain if present
    const updatedDomains = currentDomains.filter((d: string) => d !== domain)
    
    if (updatedDomains.length !== currentDomains.length) {
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

      console.log(`Removed domain ${domain} from worker ${scriptName}`)
      
      return NextResponse.json({
        success: true,
        domain,
        domains: updatedDomains
      })
    } else {
      return NextResponse.json({
        success: true,
        domain,
        domains: currentDomains,
        message: 'Domain was not in list'
      })
    }

  } catch (error) {
    console.error('Remove domain error:', error)
    return NextResponse.json(
      { error: `Failed to remove domain: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 