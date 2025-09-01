import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { logger } from "@/lib/logger"

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
const CF_DEBUG = (() => {
	const raw = process.env.CF_DEBUG ?? (process.env as any).cf_debug
	return typeof raw === 'string' && ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
})()

interface SetupInitialRequest {
	accountId: string
	scriptName: string
	domains: string[]
	jwtToken?: string
	// Either provide databaseId directly, or a d1Name to ensure/create
	databaseId?: string
	d1Name?: string
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
		// Deduplicate by name, letting vars override provided bindings (align with add-domain)
		const bindingMap: Record<string, any> = {}
		for (const b of providedBindings) {
			if (b && typeof b.name === 'string') bindingMap[b.name] = b
		}
		for (const vb of varBindings) {
			bindingMap[vb.name] = vb
		}
		const mergedBindings = Object.values(bindingMap)

		const metadata = {
			main_module: 'worker.js',
			compatibility_date: '2024-12-01',
			bindings: mergedBindings,
		}
		const form = new FormData()
		form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json')
		// Use module-friendly content type (align with add-domain)
		form.append('worker.js', new Blob([String(body.script)], { type: 'application/javascript+module' }), 'worker.js')
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
		const body: SetupInitialRequest = await request.json()
		const { accountId, scriptName, domains, jwtToken, databaseId: databaseIdRaw, d1Name: d1NameRaw } = body

		if (!accountId || !scriptName || !Array.isArray(domains) || domains.length === 0) {
			return NextResponse.json({ error: 'Missing required fields: accountId, scriptName, domains' }, { status: 400 })
		}

		// Ensure we have a D1 databaseId, creating or reusing by name if necessary
		let effectiveDatabaseId = databaseIdRaw && String(databaseIdRaw).trim() ? String(databaseIdRaw).trim() : ''
		let effectiveD1Name = d1NameRaw && String(d1NameRaw).trim() ? String(d1NameRaw).trim() : 'temp_mail_db'

		if (!effectiveDatabaseId) {
			if (CF_DEBUG) logger.debug('[SetupInitial] Ensuring D1 database for name=', effectiveD1Name)
			// 1) Try to find existing by name
			try {
				const databases = await cf<any[]>(`/accounts/${accountId}/d1/databases`, 'GET', undefined, apiTokenFromHeader)
				if (Array.isArray(databases)) {
					const found = databases.find((db: any) => (db?.name || '').toLowerCase() === effectiveD1Name.toLowerCase())
					if (found) {
						effectiveDatabaseId = String(found.uuid || found.id || found.database_id || '')
						if (CF_DEBUG) logger.debug('[SetupInitial] Reusing existing D1:', { name: effectiveD1Name, id: effectiveDatabaseId })
					}
				}
			} catch (e) {
				if (CF_DEBUG) logger.warn('[SetupInitial] list D1 databases failed (non-fatal):', (e as Error)?.message)
			}

			// 2) Create if still missing
			if (!effectiveDatabaseId) {
				let created: any | null = null
				try {
					created = await cf(`/accounts/${accountId}/d1/database`, 'POST', { name: effectiveD1Name }, apiTokenFromHeader)
				} catch (e1) {
					if (CF_DEBUG) logger.warn('[SetupInitial] primary D1 create endpoint failed, trying fallback:', (e1 as Error)?.message)
					created = await cf(`/accounts/${accountId}/d1/databases`, 'POST', { name: effectiveD1Name }, apiTokenFromHeader)
				}
				effectiveDatabaseId = String((created as any)?.uuid || (created as any)?.id || (created as any)?.database_id || '')
				if (!effectiveDatabaseId) {
					throw new Error('Failed to create D1 database')
				}
				if (CF_DEBUG) logger.debug('[SetupInitial] Created D1:', { name: effectiveD1Name, id: effectiveDatabaseId })
			}
		}

		// Deploy Worker
		if (CF_DEBUG) logger.debug('Deploying Worker script...')
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
				{ type: 'd1_database', name: 'TEMP_MAIL_DB', database_id: effectiveDatabaseId },
			],
			vars: { MAIL_DOMAIN: mailDomain, JWT_TOKEN: finalJwtToken }
		}, apiTokenFromHeader)

		if (CF_DEBUG) logger.debug(`[SetupInitial] Deployed Worker script: ${scriptName}`)

		// Enable email routing and ensure catch-all per domain (align with add-domain flow)
		for (const domain of domains) {
			try {
				const zones = await cf<Array<{ id: string; name: string }>>(`/zones?name=${encodeURIComponent(domain)}`, 'GET', undefined, apiTokenFromHeader)
				if (!Array.isArray(zones) || zones.length === 0) {
					if (CF_DEBUG) logger.warn('[SetupInitial] Zone not found for', domain)
					continue
				}
				const zoneId = zones[0].id
				try {
					await cf(`/zones/${zoneId}/email/routing/enable`, 'POST', undefined, apiTokenFromHeader)
				} catch (e) {
					if (CF_DEBUG) logger.debug('[SetupInitial] Email routing enable skipped:', (e as Error).message)
				}
				try {
					// Ensure catch-all using dedicated endpoint
					const currentCatch = await cf<any>(`/zones/${zoneId}/email/routing/rules/catch_all`, 'GET', undefined, apiTokenFromHeader)
					const referencesWorker = (rule: any) => Array.isArray(rule?.actions) && rule.actions.some((a: any) => {
						if (a?.type !== 'worker') return false
						const v = a?.value
						if (typeof v === 'string') return v === scriptName
						if (Array.isArray(v)) return v.includes(scriptName)
						return false
					})
					const alreadyOk = referencesWorker(currentCatch) && currentCatch?.enabled === true
					if (!alreadyOk) {
						await cf(`/zones/${zoneId}/email/routing/rules/catch_all`, 'PUT', {
							actions: [{ type: 'worker', value: [scriptName] }],
							enabled: true
						}, apiTokenFromHeader)
					}
				} catch (e) {
					if (CF_DEBUG) logger.debug('[SetupInitial] Catch-all rule ensure skipped:', (e as Error).message)
				}
			} catch (e) {
				if (CF_DEBUG) logger.warn('[SetupInitial] Routing setup failed for', domain, (e as Error).message)
			}
		}

		// Discover the correct workers.dev subdomain for accurate workerUrl
		let workerUrl = `https://${scriptName}.workers.dev`
		try {
			const subdomainResp = await cf<any>(`/accounts/${accountId}/workers/subdomain`, 'GET', undefined, apiTokenFromHeader)
			const subdomain = (subdomainResp && typeof subdomainResp === 'object' && 'subdomain' in subdomainResp)
				? (subdomainResp as any).subdomain
				: (typeof subdomainResp === 'string' ? subdomainResp : '')
			if (typeof subdomain === 'string' && subdomain.trim()) {
				workerUrl = `https://${scriptName}.${subdomain}.workers.dev`
			}
		} catch (e) {
			if (CF_DEBUG) logger.warn('[SetupInitial] subdomain discovery failed; using default workerUrl:', (e as Error)?.message)
		}

		return NextResponse.json({
			success: true,
			workerUrl,
			scriptName,
			d1: { name: effectiveD1Name, databaseId: effectiveDatabaseId },
			domains
		})
	} catch (error) {
		return NextResponse.json({ error: (error as Error).message }, { status: 500 })
	}
} 