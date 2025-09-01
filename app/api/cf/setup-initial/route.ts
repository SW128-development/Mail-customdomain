import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"

interface CloudflareApiError {
	code?: number
	message: string
	[key: string]: unknown
}

interface CloudflareEnvelope<T> {
	success: boolean
	errors: CloudflareApiError[]
	result: T
}

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const DEFAULT_JWT_TOKEN = process.env.CLOUDFLARE_JWT_TOKEN || process.env.JWT_TOKEN

interface SetupInitialRequest {
	accountId: string
	scriptName: string
	databaseId: string
	domains: string[]
	jwtToken?: string
}

async function cf<T = unknown>(endpoint: string, method: string, body?: any, apiToken?: string): Promise<T> {
	const token = apiToken || CLOUDFLARE_API_TOKEN
	if (!token) throw new Error('CLOUDFLARE_API_TOKEN not configured')

	const url = `https://api.cloudflare.com/client/v4${endpoint}`

	// Build dynamic headers and body to support both JSON and multipart
	let headers: Record<string, string> = { Authorization: `Bearer ${token}` }
	let requestBody: any = undefined

	const isWorkerUpload = method.toUpperCase() === 'PUT' && /\/workers\/scripts\//.test(endpoint) && body && typeof body === 'object' && 'script' in body
	if (isWorkerUpload) {
		const providedBindings: any[] = Array.isArray(body.bindings) ? body.bindings : []
		const varsObj: Record<string, unknown> = body.vars || {}
		const varBindings = Object.entries(varsObj).map(([name, value]) => ({
			type: 'plain_text',
			name,
			text: typeof value === 'string' ? value : JSON.stringify(value)
		}))
		const metadata = {
			main_module: 'worker.js',
			compatibility_date: '2024-12-01',
			bindings: [...providedBindings, ...varBindings],
		}
		const form = new FormData()
		form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json')
		form.append('worker.js', new Blob([String(body.script)], { type: 'text/javascript' }), 'worker.js')
		headers['Accept'] = 'application/json'
		requestBody = form
	} else {
		headers['Content-Type'] = 'application/json'
		headers['Accept'] = 'application/json'
		requestBody = body ? JSON.stringify(body) : undefined
	}

	const res = await fetch(url, { method, headers, body: requestBody })
	const json = (await res.json()) as CloudflareEnvelope<T>
	if (!json.success) {
		throw new Error(`Cloudflare API error: ${json.errors?.map(e => e.message).join(', ') || 'Unknown'}`)
	}
	return json.result
}

export async function POST(request: NextRequest) {
	try {
		const apiTokenFromHeader = request.headers.get('X-CF-API-Token') || undefined
		const { accountId, scriptName, databaseId, domains, jwtToken }: SetupInitialRequest = await request.json()

		if (!accountId || !scriptName || !databaseId || !Array.isArray(domains) || domains.length === 0) {
			return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
		}

		// Deploy Worker
		console.log('Deploying Worker script...')
		const finalJwtToken = DEFAULT_JWT_TOKEN || jwtToken || randomBytes(32).toString('base64url')
		const mailDomain = domains.join(',')

		await cf(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'PUT', {
			script: `export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/domains') {
      const domains = (env.MAIL_DOMAIN || '').split(',').map(d => d.trim()).filter(Boolean)
      return new Response(JSON.stringify(domains.map(d => ({ domain: d, isActive: true, isPrivate: false }))), { headers: { 'content-type': 'application/json' } })
    }
    return new Response('ok')
  },
  async email(message, env, ctx) {
    // placeholder email handler
  }
}`,
			bindings: [
				{ type: 'd1_database', name: 'TEMP_MAIL_DB', database_id: databaseId },
			],
			vars: { MAIL_DOMAIN: mailDomain, JWT_TOKEN: finalJwtToken }
		}, apiTokenFromHeader)

		console.log(`Deployed Worker script: ${scriptName}`)

		// Enable email routing and create catch-all per domain
		for (const domain of domains) {
			try {
				const zones = await cf<Array<{ id: string; name: string }>>(`/zones?name=${encodeURIComponent(domain)}`, 'GET', undefined, apiTokenFromHeader)
				if (!Array.isArray(zones) || zones.length === 0) {
					console.warn('Zone not found for', domain)
					continue
				}
				const zoneId = zones[0].id
				try {
					await cf(`/zones/${zoneId}/email/routing/enable`, 'POST', undefined, apiTokenFromHeader)
				} catch (e) {
					console.log('Email routing enable skipped:', (e as Error).message)
				}
				try {
					await cf(`/zones/${zoneId}/email/routing/rules`, 'POST', {
						matchers: [{ type: 'all' }],
						actions: [{ type: 'worker', value: scriptName }]
					}, apiTokenFromHeader)
				} catch (e) {
					console.log('Catch-all rule creation skipped:', (e as Error).message)
				}
			} catch (e) {
				console.warn('Routing setup failed for', domain, (e as Error).message)
			}
		}

		const workerUrl = `https://${scriptName}.workers.dev`
		return NextResponse.json({ success: true, workerUrl, scriptName })
	} catch (error) {
		return NextResponse.json({ error: (error as Error).message }, { status: 500 })
	}
} 