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

async function checkWorkerHealth(workerUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${workerUrl}/domains`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })
    return response.ok
  } catch (error) {
    console.error('Worker health check failed:', error)
    return false
  }
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

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const scriptName = searchParams.get('scriptName')

    if (!accountId || !scriptName) {
      return NextResponse.json(
        { error: 'Missing required query parameters: accountId, scriptName' },
        { status: 400 }
      )
    }

    // Get worker details
    console.log(`Checking status for worker: ${scriptName}`)
    const workerScript = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'GET', undefined, apiToken)
    
    const workerVars = workerScript.vars || {}
    const mailDomain = workerVars.MAIL_DOMAIN || ''
    const domains = mailDomain.split(',').filter((d: string) => d.trim()).map((d: string) => d.trim())
    
    // Check D1 bindings
    const d1Bindings = workerScript.bindings?.filter((binding: any) => binding.type === 'd1_database') || []
    const tempMailDbBinding = d1Bindings.find((binding: any) => binding.name === 'TEMP_MAIL_DB')
    
    // Worker URL
    const workerUrl = `https://${scriptName}.${accountId.substring(0, 8)}.workers.dev`
    
    // Check worker health
    const isWorkerHealthy = await checkWorkerHealth(workerUrl)
    
    // Check domain routing status
    const domainStatuses = []
    
    for (const domain of domains) {
      try {
        const zones = await callCloudflareAPI(`/zones?name=${domain}`, 'GET', undefined, apiToken)
        if (zones.length === 0) {
          domainStatuses.push({
            domain,
            zoneFound: false,
            emailRoutingEnabled: false,
            catchAllRuleExists: false,
            status: 'error'
          })
          continue
        }
        
        const zone = zones[0]
        
        // Check email routing status
        let emailRoutingEnabled = false
        try {
          const emailRouting = await callCloudflareAPI(`/zones/${zone.id}/email/routing`, 'GET', undefined, apiToken)
          emailRoutingEnabled = emailRouting.enabled
        } catch (e) {
          console.warn(`Could not check email routing status for ${domain}`)
        }
        
        // Check catch-all rules
        let catchAllRuleExists = false
        try {
          const routingRules = await callCloudflareAPI(`/zones/${zone.id}/email/routing/rules`, 'GET', undefined, apiToken)
          catchAllRuleExists = routingRules.some((rule: any) => {
            const hasCatchAllMatcher = rule.matchers.some((matcher: any) => matcher.type === 'all')
            const hasWorkerAction = rule.actions.some((action: any) => 
              action.type === 'worker' && action.value === scriptName
            )
            return hasCatchAllMatcher && hasWorkerAction
          })
        } catch (e) {
          console.warn(`Could not check routing rules for ${domain}`)
        }
        
        domainStatuses.push({
          domain,
          zoneId: zone.id,
          zoneFound: true,
          emailRoutingEnabled,
          catchAllRuleExists,
          status: emailRoutingEnabled && catchAllRuleExists ? 'ok' : 'warning'
        })
        
      } catch (error) {
        console.error(`Error checking status for domain ${domain}:`, error)
        domainStatuses.push({
          domain,
          zoneFound: false,
          emailRoutingEnabled: false,
          catchAllRuleExists: false,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      worker: {
        scriptName,
        workerUrl,
        isHealthy: isWorkerHealthy,
        mailDomain,
        domains
      },
      d1: {
        hasTempMailDbBinding: !!tempMailDbBinding,
        databaseId: tempMailDbBinding?.database_id || null
      },
      domains: domainStatuses,
      overall: {
        healthy: isWorkerHealthy && !!tempMailDbBinding && domainStatuses.every(d => d.status === 'ok')
      }
    })

  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error)
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

    console.error('Status check error:', error)
    return NextResponse.json(
      { error: `Failed to check status: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 