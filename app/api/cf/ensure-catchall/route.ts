import { NextRequest, NextResponse } from "next/server"

interface CloudflareApiEnvelope<T = unknown> {
  success: boolean
  errors: Array<{ code?: number; message: string }>
  result: T
}

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN

async function cf<T = unknown>(endpoint: string, method: string, body?: any, apiToken?: string): Promise<T> {
  const token = apiToken || CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN not configured')

  const url = `https://api.cloudflare.com/client/v4${endpoint}`
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  let requestBody: any = undefined

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    headers['Accept'] = 'application/json'
    requestBody = JSON.stringify(body)
  } else {
    headers['Accept'] = 'application/json'
  }

  const res = await fetch(url, { method, headers, body: requestBody })
  const json = (await res.json()) as CloudflareApiEnvelope<T>
  if (!json.success) {
    throw new Error(`Cloudflare API error: ${json.errors?.map(e => e.message).join(', ') || 'Unknown'}`)
  }
  return json.result
}

export async function POST(request: NextRequest) {
  try {
    const apiTokenFromHeader = request.headers.get('X-CF-API-Token') || undefined
    const { domain, accountId, scriptName }: { domain: string; accountId: string; scriptName: string } = await request.json()

    if (!domain || !accountId || !scriptName) {
      return NextResponse.json({ error: 'Missing required fields: domain, accountId, scriptName' }, { status: 400 })
    }

    // Resolve zone
    const zones = await cf<Array<{ id: string; name: string }>>(`/zones?name=${encodeURIComponent(domain)}`, 'GET', undefined, apiTokenFromHeader)
    if (!Array.isArray(zones) || zones.length === 0) {
      return NextResponse.json({ error: `Zone not found for ${domain}` }, { status: 404 })
    }
    const zoneId = zones[0].id

    // Best-effort enable email routing
    try {
      await cf(`/zones/${zoneId}/email/routing/enable`, 'POST', undefined, apiTokenFromHeader)
    } catch {}

    // Use catch_all endpoints to ensure routing targets the worker
    const current = await cf<any>(`/zones/${zoneId}/email/routing/rules/catch_all`, 'GET', undefined, apiTokenFromHeader)

    const referencesWorker = (rule: any) => Array.isArray(rule?.actions) && rule.actions.some((a: any) => {
      if (a?.type !== 'worker') return false
      const v = a?.value
      if (typeof v === 'string') return v === scriptName
      if (Array.isArray(v)) return v.includes(scriptName)
      return false
    })

    const alreadyOk = referencesWorker(current) && current?.enabled === true
    if (alreadyOk) {
      return NextResponse.json({ success: true, ensured: false, ruleId: current?.id })
    }

    const updated = await cf(`/zones/${zoneId}/email/routing/rules/catch_all`, 'PUT', {
      actions: [{ type: 'worker', value: [scriptName] }],
      enabled: true
    }, apiTokenFromHeader)

    return NextResponse.json({ success: true, ensured: true, ruleId: (updated as any)?.id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
} 