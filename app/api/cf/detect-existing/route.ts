import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"

// Check environment variables for existing configuration — no hardcoded fallbacks
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CLOUDFLARE_JWT_TOKEN = process.env.CLOUDFLARE_JWT_TOKEN || process.env.JWT_TOKEN
const CLOUDFLARE_WORKER_NAME = process.env.CLOUDFLARE_DEFAULT_WORKER_NAME
const CLOUDFLARE_D1_NAME = process.env.CLOUDFLARE_DEFAULT_D1_NAME
const CLOUDFLARE_D1_ID = process.env.CLOUDFLARE_D1_ID
const MAIL_DOMAIN = process.env.MAIL_DOMAIN
const CUSTOM_WORKER_URL = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL

const CF_DEBUG = (() => {
  const raw = process.env.CF_DEBUG ?? (process.env as any).cf_debug
  return typeof raw === 'string' && ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
})()

async function testWorkerUrl(url: string): Promise<{ success: boolean; domains?: string[] }> {
  try {
    if (CF_DEBUG) logger.debug('[DetectExisting] Testing worker URL:', url)
    const testResponse = await fetch(`${url}/domains`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    
    if (testResponse.ok) {
      const data = await testResponse.json()
      if (CF_DEBUG) logger.debug('[DetectExisting] Worker response:', data)
      // Update domains from actual worker response if available
      if (Array.isArray(data)) {
        const domains = data.map((d: any) => d.domain || d).filter(Boolean)
        return { success: true, domains }
      }
      return { success: true }
    }
    return { success: false }
  } catch (error) {
    if (CF_DEBUG) logger.warn('[DetectExisting] Worker test failed for', url, ':', (error as Error)?.message)
    return { success: false }
  }
}

export async function GET(request: NextRequest) {
  try {
    const hasJwtToken = !!(CLOUDFLARE_JWT_TOKEN && CLOUDFLARE_JWT_TOKEN !== 'your_jwt_token_here')
    const hasApiToken = !!(CLOUDFLARE_API_TOKEN && CLOUDFLARE_API_TOKEN !== 'your_cloudflare_api_token_here')
    const hasWorkerUrl = !!CUSTOM_WORKER_URL
    const hasWorkerName = !!CLOUDFLARE_WORKER_NAME

    if (!hasJwtToken && !hasWorkerUrl && !hasApiToken) {
      return NextResponse.json({
        success: false,
        error: 'No Cloudflare configuration found. Set CLOUDFLARE_API_TOKEN, NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL, or CLOUDFLARE_JWT_TOKEN in environment variables.'
      })
    }

    const domains = MAIL_DOMAIN
      ? MAIL_DOMAIN.split(/[\s,]+/).filter(d => d.trim()).map(d => d.trim())
      : []
    
    let workerUrl = ''
    let workingDomains: string[] = domains
    
    // Try custom worker URL first if available
    if (CUSTOM_WORKER_URL) {
      const customTest = await testWorkerUrl(CUSTOM_WORKER_URL)
      if (customTest.success) {
        workerUrl = CUSTOM_WORKER_URL
        if (customTest.domains) {
          workingDomains = customTest.domains
        }
        if (CF_DEBUG) logger.debug('[DetectExisting] Using custom worker URL:', workerUrl)
      }
    }
    
    // Resolve account subdomain from Cloudflare API (only if we have a worker name to look up)
    if (!workerUrl && hasApiToken && hasWorkerName) {
      try {
        // Get accounts to find the right one
        const accountsResponse = await fetch('https://api.cloudflare.com/client/v4/accounts', {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json()
          if (accountsData.success && accountsData.result.length > 0) {
            const accountId = accountsData.result[0].id
            // Resolve the workers.dev subdomain for this account instead of guessing
            const subdomainResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
              headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json',
              },
            })

            if (subdomainResponse.ok) {
              const subdomainData = await subdomainResponse.json()
              const subdomain = subdomainData?.result?.subdomain
              if (typeof subdomain === 'string' && subdomain.trim().length > 0) {
                const resolvedUrl = `https://${CLOUDFLARE_WORKER_NAME}.${subdomain}.workers.dev`
                const accountTest = await testWorkerUrl(resolvedUrl)
                if (accountTest.success) {
                  workerUrl = resolvedUrl
                  if (accountTest.domains) {
                    workingDomains = accountTest.domains
                  }
                  if (CF_DEBUG) logger.debug('[DetectExisting] Using resolved worker URL:', workerUrl)
                }
              }
            }
          }
        }
      } catch (apiError) {
        if (CF_DEBUG) logger.warn('[DetectExisting] API-based detection failed:', apiError)
      }
    }
    
    const workerInfo = {
      workerUrl,
      scriptName: CLOUDFLARE_WORKER_NAME || '',
      databaseId: CLOUDFLARE_D1_ID || '',
      databaseName: CLOUDFLARE_D1_NAME || '',
      domains: workingDomains,
      jwtTokenConfigured: hasJwtToken,
      apiTokenConfigured: hasApiToken,
      mailDomain: workingDomains.join(',')
    }

    return NextResponse.json({
      success: true,
      workerInfo
    })

  } catch (error) {
    logger.error('Error detecting existing setup:', error)
    return NextResponse.json(
      { 
        success: false,
        error: `Failed to detect existing setup: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    )
  }
} 