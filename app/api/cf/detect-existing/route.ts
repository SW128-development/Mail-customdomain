import { NextRequest, NextResponse } from "next/server"

// Check environment variables for existing configuration
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CLOUDFLARE_JWT_TOKEN = process.env.CLOUDFLARE_JWT_TOKEN || process.env.JWT_TOKEN
const CLOUDFLARE_WORKER_NAME = process.env.CLOUDFLARE_DEFAULT_WORKER_NAME || 'duckmail-cloudflare-provider'
const CLOUDFLARE_D1_NAME = process.env.CLOUDFLARE_DEFAULT_D1_NAME || 'temp_mail_db'
const CLOUDFLARE_D1_ID = process.env.CLOUDFLARE_D1_ID || '70bece35-d5bf-487b-9730-c7546f0266c3'
const MAIL_DOMAIN = process.env.MAIL_DOMAIN || '10xco.de'

export async function GET(request: NextRequest) {
  try {
    // Check if we have the minimum required configuration
    const hasJwtToken = CLOUDFLARE_JWT_TOKEN && CLOUDFLARE_JWT_TOKEN !== 'your_jwt_token_here'
    const hasApiToken = CLOUDFLARE_API_TOKEN && CLOUDFLARE_API_TOKEN !== 'your_cloudflare_api_token_here'
    
    if (!hasJwtToken) {
      return NextResponse.json({
        success: false,
        error: 'No existing Cloudflare Worker configuration found in environment variables'
      })
    }

    // Parse domains from MAIL_DOMAIN
    const domains = MAIL_DOMAIN.split(',').filter(d => d.trim()).map(d => d.trim())
    
    // Construct worker URL based on the worker name
    // This is a best guess - the actual URL might be different
    const workerUrl = `https://${CLOUDFLARE_WORKER_NAME}.workers.dev`
    
    // If we have the API token, we could potentially query Cloudflare API for more details
    // But for now, we'll just return what we can determine from env vars
    
    const workerInfo = {
      workerUrl,
      scriptName: CLOUDFLARE_WORKER_NAME,
      databaseId: CLOUDFLARE_D1_ID,
      databaseName: CLOUDFLARE_D1_NAME,
      domains,
      jwtTokenConfigured: hasJwtToken,
      apiTokenConfigured: hasApiToken,
      mailDomain: MAIL_DOMAIN
    }

    // Test if the worker is accessible
    try {
      const testResponse = await fetch(`${workerUrl}/domains`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      
      if (testResponse.ok) {
        const data = await testResponse.json()
        // Update domains from actual worker response if available
        if (Array.isArray(data)) {
          workerInfo.domains = data.map((d: any) => d.domain || d).filter(Boolean)
        }
      }
    } catch (error) {
      console.log('Could not reach worker at', workerUrl, '- it might use a different URL')
      // Try with account-specific subdomain if we can extract account ID
      // This is just a fallback attempt
    }

    return NextResponse.json({
      success: true,
      workerInfo
    })

  } catch (error) {
    console.error('Error detecting existing setup:', error)
    return NextResponse.json(
      { 
        success: false,
        error: `Failed to detect existing setup: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    )
  }
} 