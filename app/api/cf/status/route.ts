import { NextRequest, NextResponse } from "next/server"

interface CloudflareApiResponse {
  success: boolean
  errors: any[]
  result: any
}

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN

async function callCloudflareAPI(endpoint: string, method: string = 'GET', body?: any, apiToken?: string, accept?: string) {
  const token = apiToken || CLOUDFLARE_API_TOKEN
  
  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN not configured')
  }

  const url = `https://api.cloudflare.com/client/v4${endpoint}`
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  headers['Accept'] = accept || 'application/json'
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const contentType = response.headers.get('content-type') || ''
  console.log('[CF API]', method, endpoint, 'status=', response.status, 'content-type=', contentType)

  // JSON branch: log and parse from raw text for transparency
  if (contentType.includes('application/json')) {
    const jsonText = await response.text()
    console.log('[CF API][json][raw]', jsonText.slice(0, 600))
    try {
      const data = JSON.parse(jsonText)
      if (typeof (data as any).success === 'boolean' && 'result' in (data as any)) {
        const envelope = data as CloudflareApiResponse
        if (!envelope.success) {
          throw new Error(`Cloudflare API error: ${envelope.errors.map(e => e.message).join(', ')}`)
        }
        return envelope.result
      }
      return data
    } catch (e) {
      console.error('[CF API][json][parse-error]', (e as Error)?.message)
      throw new Error(`Failed to parse JSON from Cloudflare: ${jsonText.slice(0, 200)}`)
    }
  }

  // If the response is plain JavaScript, return it as a script payload
  if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
    const scriptText = await response.text()
    return { script: scriptText }
  }

  // Multipart branch: extract metadata/manifest JSON part
  if (contentType.includes('multipart/')) {
    const boundaryMatch = contentType.match(/boundary=([^;]+)/i)
    const raw = await response.text()
    console.log('[CF API][multipart][raw-head]', raw.slice(0, 600))
    if (boundaryMatch) {
      const boundary = `--${boundaryMatch[1]}`
      console.log('[CF API][multipart] boundary=', boundaryMatch[1])
      const parts = raw.split(boundary)
      console.log('[CF API][multipart] parts=', parts.length)
      let metadataJson: any | null = null
      let scriptContent: string | null = null
      for (const part of parts) {
        const headerSplitIdx = part.indexOf('\r\n\r\n') !== -1 ? part.indexOf('\r\n\r\n') : part.indexOf('\n\n')
        const headers = headerSplitIdx !== -1 ? part.slice(0, headerSplitIdx) : ''
        const body = headerSplitIdx !== -1 ? part.slice(headerSplitIdx + (part.indexOf('\r\n\r\n') !== -1 ? 4 : 2)) : part
        const headerPreview = headers.replace(/\r?\n/g, ' ').trim().slice(0, 200)
        const headersLower = headerPreview.toLowerCase()
        if (headerPreview) {
          console.log('[CF API][multipart][part-head]', headerPreview)
        }
        const isJsonLikely = headersLower.includes('name="metadata"')
          || headersLower.includes('name=metadata')
          || headersLower.includes('name="manifest"')
          || headersLower.includes('filename="metadata"')
          || headersLower.includes('filename="manifest')
          || headersLower.includes('content-type: application/json')
        const isWorkerJs = headersLower.includes('name="worker.js"')
          || headersLower.includes('filename="worker.js"')
          || headersLower.includes('content-type: application/javascript')
        if (isJsonLikely) {
          const jsonStart = body.indexOf('{')
          const jsonEnd = body.lastIndexOf('}')
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const metaJson = body.slice(jsonStart, jsonEnd + 1)
            console.log('[CF API][multipart][json-head]', metaJson.slice(0, 600))
            try {
              metadataJson = JSON.parse(metaJson)
            } catch (e) {
              console.warn('[CF API][multipart] failed to parse JSON part:', (e as Error)?.message)
            }
          }
        }
        if (isWorkerJs) {
          const trimmed = body.replace(/\r?\n--$/, '').replace(/\r?\n$/, '')
          scriptContent = trimmed
        }
      }
      if (metadataJson || scriptContent) {
        return {
          ...(metadataJson || {}),
          ...(scriptContent ? { script: scriptContent } : {}),
        }
      }
      console.warn('[CF API][multipart] metadata/manifest JSON part not found. Parts count=', parts.length)
    }
    throw new Error('Unexpected multipart response format from Cloudflare Workers API')
  }

  // Fallback: try to read text and parse error details
  const text = await response.text()
  console.log('[CF API][fallback][raw-head]', text.slice(0, 600))
  try {
    const maybeJson = JSON.parse(text)
    if (typeof (maybeJson as any).success === 'boolean' && 'result' in (maybeJson as any)) {
      const envelope = maybeJson as CloudflareApiResponse
      if (!envelope.success) {
        throw new Error(`Cloudflare API error: ${envelope.errors.map(e => e.message).join(', ')}`)
      }
      return envelope.result
    }
    return maybeJson
  } catch {
    throw new Error(`Unexpected Cloudflare API response (${contentType || 'unknown'}): ${text.slice(0, 120)}`)
  }
}

async function checkWorkerHealth(workerUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${workerUrl}/domains`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })
    console.log('[Worker][health]', workerUrl, 'status=', response.status)
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

    // Determine worker URL - prefer custom domain from env, then account-based subdomain
    const customWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL
    let workerUrl: string
    
    if (customWorkerUrl && customWorkerUrl.includes(scriptName)) {
      workerUrl = customWorkerUrl
      console.log('[Status] Using custom worker URL from env:', workerUrl)
    } else {
      // Discover the account workers.dev subdomain
      try {
        const subdomainResp = await callCloudflareAPI(`/accounts/${accountId}/workers/subdomain`, 'GET', undefined, apiToken, 'application/json')
        const workerSubdomain = (subdomainResp && typeof subdomainResp === 'object' && 'subdomain' in subdomainResp)
          ? (subdomainResp as any).subdomain
          : (typeof subdomainResp === 'string' ? subdomainResp : '')
        if (workerSubdomain) {
          workerUrl = `https://${scriptName}.${workerSubdomain}.workers.dev`
        } else {
          workerUrl = `https://${scriptName}.${accountId.substring(0, 8)}.workers.dev`
        }
      } catch (e) {
        console.warn('[Status] subdomain discovery failed:', (e as Error)?.message)
        workerUrl = `https://${scriptName}.${accountId.substring(0, 8)}.workers.dev`
      }
      console.log('[Status] Using account-based worker URL:', workerUrl)
    }

    // Check worker health
    const isWorkerHealthy = await checkWorkerHealth(workerUrl)

    // Prefer domains from the worker itself
    let domains: string[] = []
    let mailDomain = ''
    try {
      const domResp = await fetch(`${workerUrl}/domains`, { headers: { 'Accept': 'application/json' } })
      if (domResp.ok) {
        const payload = await domResp.json()
        if (Array.isArray(payload)) {
          domains = payload.map((d: any) => typeof d === 'string' ? d : d?.domain).filter((d: any) => typeof d === 'string' && d.trim()).map((d: string) => d.trim())
        } else if (payload && Array.isArray((payload as any)['hydra:member'])) {
          domains = (payload as any)['hydra:member']
            .map((d: any) => typeof d === 'string' ? d : d?.domain)
            .filter((d: any) => typeof d === 'string' && d.trim())
            .map((d: string) => d.trim())
        }
        mailDomain = domains.join(',')
        console.log('[Worker]/domains ->', domains)
      } else {
        console.warn('[Worker]/domains non-200 status=', domResp.status)
      }
    } catch (err) {
      console.warn('[Worker]/domains fetch failed:', err)
    }

    // Try to fetch worker metadata for bindings/vars; do not fail status if it errors
    let workerScript: any = null
    try {
      console.log(`Checking status for worker: ${scriptName}`)
      // If we already have domains from the worker, skip metadata fetch to avoid multipart parsing instability
      if (domains.length === 0) {
        // Prefer JavaScript content to avoid multipart instability, fall back to JSON/multipart parsing
        const jsFirst = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'GET', undefined, apiToken, 'application/javascript')
        if (jsFirst && typeof jsFirst === 'object' && 'script' in jsFirst) {
          workerScript = jsFirst
        } else {
          workerScript = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'GET', undefined, apiToken, 'application/json')
        }
      }
    } catch (e) {
      console.warn('[Status] worker metadata fetch failed; continuing with partial data:', (e as Error)?.message)
    }

    // Bindings-based domain discovery
    if (domains.length === 0) {
      try {
        const bindings = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}/bindings`, 'GET', undefined, apiToken, 'application/json')
        if (Array.isArray(bindings)) {
          const mailDomainBinding = bindings.find((b: any) => b?.name === 'MAIL_DOMAIN' && (b?.type === 'plain_text' || b?.type === 'secret_text'))
          if (mailDomainBinding && typeof mailDomainBinding.text === 'string') {
            mailDomain = mailDomainBinding.text
            domains = mailDomain.split(',').map((d: string) => d.trim()).filter(Boolean)
          }
        }
      } catch (e) {
        console.warn('[Status] bindings fetch failed; continuing:', (e as Error)?.message)
      }
    }

    // Derive domains from env if worker did not return them
    if (domains.length === 0) {
      const workerVars = (workerScript as any)?.vars || {}
      mailDomain = workerVars.MAIL_DOMAIN || ''
      domains = mailDomain.split(',').filter((d: string) => d.trim()).map((d: string) => d.trim())
    }

    // Check D1 bindings if metadata is available
    const d1Bindings = (workerScript as any)?.bindings?.filter((binding: any) => binding.type === 'd1_database') || []
    const tempMailDbBinding = d1Bindings.find((binding: any) => binding.name === 'TEMP_MAIL_DB')

    // Check domain routing status
    const domainStatuses = []
    
    for (const domain of domains) {
      try {
        console.log('[Domain][check] searching zone for', domain)
        const zones = await callCloudflareAPI(`/zones?name=${domain}`, 'GET', undefined, apiToken)
        console.log('[Domain][check] zones found=', zones?.length)
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
        console.log('[Domain][check] zoneId=', zone.id)
        
        // Check email routing status (treat permission issues as unknown)
        let emailRoutingEnabled: boolean | null = null
        try {
          const emailRouting = await callCloudflareAPI(`/zones/${zone.id}/email/routing`, 'GET', undefined, apiToken)
          emailRoutingEnabled = !!emailRouting.enabled
          console.log('[Domain][check] emailRoutingEnabled=', emailRoutingEnabled)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.warn(`[Domain][check] email routing status unknown (permission or error):`, msg)
          emailRoutingEnabled = null
        }

        // Check catch-all rules
        let catchAllRuleExists: boolean | null = null
        try {
          const routingRules = await callCloudflareAPI(`/zones/${zone.id}/email/routing/rules`, 'GET', undefined, apiToken)
          catchAllRuleExists = routingRules.some((rule: any) => {
            const hasCatchAllMatcher = rule.matchers?.some((matcher: any) => matcher.type === 'all')
            const hasWorkerAction = rule.actions?.some((action: any) => {
              if (action.type !== 'worker') return false
              const v = action.value
              if (typeof v === 'string') return v === scriptName
              if (Array.isArray(v)) return v.includes(scriptName)
              return false
            })
            return hasCatchAllMatcher && hasWorkerAction
          })
          console.log('[Domain][check] catchAllRuleExists=', catchAllRuleExists)
        } catch (e) {
          console.warn(`[Domain][check] catch-all rules unknown (permission or error):`, (e as Error)?.message)
          catchAllRuleExists = null
        }
        
        const statusValue: 'ok' | 'warning' = catchAllRuleExists === true
          ? 'ok'
          : 'warning'

        domainStatuses.push({
          domain,
          zoneId: zone.id,
          zoneFound: true,
          emailRoutingEnabled,
          catchAllRuleExists,
          status: statusValue
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