import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const apiTokenFromHeader = request.headers.get('X-CF-API-Token')
    const apiTokenFromCookie = request.cookies.get('cf_api_token')?.value
    const envToken = process.env.CLOUDFLARE_API_TOKEN
    const jwtToken = process.env.CLOUDFLARE_JWT_TOKEN || process.env.JWT_TOKEN
    const workerUrlEnv = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL

    const isApiTokenConfigured = Boolean(apiTokenFromHeader || apiTokenFromCookie || envToken)
    const isJwtConfigured = Boolean(jwtToken)
    const isWorkerUrlConfigured = Boolean(workerUrlEnv)

    return NextResponse.json({
      success: true,
      isApiTokenConfigured,
      isJwtConfigured,
      isWorkerUrlConfigured,
      missing: [
        !isApiTokenConfigured ? 'apiToken' : null,
        !isJwtConfigured ? 'jwtToken' : null,
        !isWorkerUrlConfigured ? 'workerUrl' : null,
      ].filter(Boolean)
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Preflight failed' }, { status: 500 })
  }
} 