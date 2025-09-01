import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"

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
const CF_DEBUG = process.env.CF_DEBUG === '1'

async function callCloudflareAPI(endpoint: string, method: string = 'GET', body?: any, apiToken?: string, accept?: string) {
	const token = apiToken || CLOUDFLARE_API_TOKEN
	if (!token) {
		throw new Error('CLOUDFLARE_API_TOKEN not configured')
	}

	const url = `https://api.cloudflare.com/client/v4${endpoint}`

	// Build headers dynamically so we can omit Content-Type when sending FormData
	const headers: Record<string, string> = {
		'Authorization': `Bearer ${token}`,
	}

	let requestBody: any = undefined

	// If we're uploading a Worker script, use multipart/form-data as required by Cloudflare
	const isWorkerScriptUpload = method.toUpperCase() === 'PUT' && /\/workers\/scripts\//.test(endpoint) && body && typeof body === 'object' && 'script' in body
	if (isWorkerScriptUpload) {
		// Build metadata with main_module and bindings, converting vars -> plain_text bindings
		const providedBindings: any[] = Array.isArray((body as any).bindings) ? (body as any).bindings : []
		const varsObj: Record<string, any> = (body as any).vars || {}
		const varBindings = Object.entries(varsObj).map(([name, value]) => ({
			type: 'plain_text',
			name,
			text: typeof value === 'string' ? value : JSON.stringify(value)
		}))
		// Deduplicate bindings by name, letting vars override any provided binding of the same name
		const bindingMap: Record<string, any> = {}
		for (const b of providedBindings) {
			if (b && typeof b.name === 'string') bindingMap[b.name] = b
		}
		for (const vb of varBindings) {
			bindingMap[vb.name] = vb
		}
		const mergedBindings = Object.values(bindingMap)

		const metadata: Record<string, any> = {
			main_module: 'worker.js',
			compatibility_date: '2024-12-01',
			bindings: mergedBindings,
		}

		const form = new FormData()
		form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json')
		// Use module-friendly content type
		form.append('worker.js', new Blob([(body as any).script as string], { type: 'application/javascript+module' }), 'worker.js')
		requestBody = form

		// Accept JSON response
		headers['Accept'] = 'application/json'
	} else {
		// Default JSON request/response
		headers['Content-Type'] = 'application/json'
		headers['Accept'] = accept || 'application/json'
		requestBody = body ? JSON.stringify(body) : undefined
	}

	const response = await fetch(url, {
		method,
		headers,
		body: requestBody,
	})

	const contentType = response.headers.get('content-type') || ''
	if (CF_DEBUG) logger.debug('[CF API]', method, endpoint, 'status=', response.status, 'content-type=', contentType)

	if (contentType.includes('application/json')) {
		const jsonText = await response.text()
		if (CF_DEBUG) logger.debug('[CF API][json][raw]', jsonText.slice(0, 600))
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
			logger.error('[CF API][json][parse-error]', (e as Error)?.message)
			throw new Error(`Failed to parse JSON from Cloudflare: ${jsonText.slice(0, 200)}`)
		}
	}

	// Handle worker content-only responses
	if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
		const scriptText = await response.text()
		return { script: scriptText }
	}

	if (contentType.includes('multipart/')) {
		const boundaryMatch = contentType.match(/boundary=([^;]+)/i)
		const raw = await response.text()
		if (CF_DEBUG) logger.debug('[CF API][multipart][raw-head]', raw.slice(0, 600))
		if (boundaryMatch) {
			const boundary = `--${boundaryMatch[1]}`
			if (CF_DEBUG) logger.debug('[CF API][multipart] boundary=', boundaryMatch[1])
			const parts = raw.split(boundary)
			if (CF_DEBUG) logger.debug('[CF API][multipart] parts=', parts.length)
			let metadataJson: any | null = null
			let scriptContent: string | null = null
			for (const part of parts) {
				const headerSplitIdx = part.indexOf('\r\n\r\n') !== -1 ? part.indexOf('\r\n\r\n') : part.indexOf('\n\n')
				const headers = headerSplitIdx !== -1 ? part.slice(0, headerSplitIdx) : ''
				const body = headerSplitIdx !== -1 ? part.slice(headerSplitIdx + (part.indexOf('\r\n\r\n') !== -1 ? 4 : 2)) : part
				const headerPreview = headers.replace(/\r?\n/g, ' ').trim().slice(0, 200)
				const headersLower = headerPreview.toLowerCase()
				if (headerPreview) {
					if (CF_DEBUG) logger.debug('[CF API][multipart][part-head]', headerPreview)
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
						if (CF_DEBUG) logger.debug('[CF API][multipart][json-head]', metaJson.slice(0, 600))
						try {
							metadataJson = JSON.parse(metaJson)
						} catch (e) {
							if (CF_DEBUG) logger.warn('[CF API][multipart] failed to parse JSON part:', (e as Error)?.message)
						}
					}
				} else if (isWorkerJs) {
					// Trim trailing boundary markers and whitespace
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
			if (CF_DEBUG) logger.warn('[CF API][multipart] metadata/manifest JSON part not found. Parts count=', parts.length)
		}
		throw new Error('Unexpected multipart response format from Cloudflare Workers API')
	}

	const text = await response.text()
	if (CF_DEBUG) logger.debug('[CF API][fallback][raw-head]', text.slice(0, 600))
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

export async function POST(request: NextRequest) {
	try {
		const apiTokenFromHeader = request.headers.get('X-CF-API-Token') || undefined
		const tokenToUse = apiTokenFromHeader || CLOUDFLARE_API_TOKEN
		if (!tokenToUse) {
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

		// Step 0: Check if domain already exists to avoid duplicate work
		let existingDomains: string[] = []
		try {
			const customUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL
			if (customUrl) {
				const res = await fetch(`${customUrl}/domains`, { headers: { 'Accept': 'application/json' } })
				if (res.ok) {
					const payload = await res.json()
					if (Array.isArray(payload)) {
						existingDomains = payload
							.map((d: any) => typeof d === 'string' ? d : d?.domain)
							.filter((d: any) => typeof d === 'string' && d.trim())
							.map((d: string) => d.trim())
					} else if (payload && Array.isArray((payload as any)['hydra:member'])) {
						existingDomains = (payload as any)['hydra:member']
							.map((d: any) => typeof d === 'string' ? d : d?.domain)
							.filter((d: any) => typeof d === 'string' && d.trim())
							.map((d: string) => d.trim())
					}
				}
			}
		} catch (e) {
			if (CF_DEBUG) logger.warn('[AddDomain] failed to query custom worker domains:', (e as Error)?.message)
		}

		// Fallback to account workers.dev subdomain-based URL
		if (existingDomains.length === 0) {
			try {
				// Fetch the workers.dev subdomain for this account
				const subdomainResp = await callCloudflareAPI(`/accounts/${accountId}/workers/subdomain`, 'GET', undefined, tokenToUse, 'application/json')
				const workerSubdomain = (subdomainResp && typeof subdomainResp === 'object' && 'subdomain' in subdomainResp)
					? (subdomainResp as any).subdomain
					: (typeof subdomainResp === 'string' ? subdomainResp : '')
				if (workerSubdomain) {
					const workerUrl = `https://${scriptName}.${workerSubdomain}.workers.dev`
					const res = await fetch(`${workerUrl}/domains`, { headers: { 'Accept': 'application/json' } })
					if (res.ok) {
						const payload = await res.json()
						if (Array.isArray(payload)) {
							existingDomains = payload
								.map((d: any) => typeof d === 'string' ? d : d?.domain)
								.filter((d: any) => typeof d === 'string' && d.trim())
								.map((d: string) => d.trim())
						} else if (payload && Array.isArray((payload as any)['hydra:member'])) {
							existingDomains = (payload as any)['hydra:member']
								.map((d: any) => typeof d === 'string' ? d : d?.domain)
								.filter((d: any) => typeof d === 'string' && d.trim())
								.map((d: string) => d.trim())
						}
					}
				}
			} catch (e) {
				if (CF_DEBUG) logger.warn('[AddDomain] failed to query default worker domains:', (e as Error)?.message)
			}
		}

		// Next: try reading bindings directly to discover MAIL_DOMAIN
		if (existingDomains.length === 0) {
			try {
				const bindings = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}/bindings`, 'GET', undefined, tokenToUse, 'application/json')
				if (Array.isArray(bindings)) {
					const mailDomainBinding = bindings.find((b: any) => b?.name === 'MAIL_DOMAIN' && (b?.type === 'plain_text' || b?.type === 'secret_text'))
					if (mailDomainBinding && typeof mailDomainBinding.text === 'string') {
						existingDomains = mailDomainBinding.text.split(',').map((d: string) => d.trim()).filter(Boolean)
					}
				}
			} catch (e) {
				if (CF_DEBUG) logger.warn('[AddDomain] could not fetch bindings for existing domains:', (e as Error)?.message)
			}
		}

		// Last resort: try metadata (may not include secrets)
		if (existingDomains.length === 0) {
			try {
				const workerMeta = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'GET', undefined, tokenToUse, 'application/json')
				const currentVars = (workerMeta as any)?.vars || {}
				const mailDomain = currentVars.MAIL_DOMAIN || ''
				existingDomains = mailDomain.split(',').filter((d: string) => d.trim()).map((d: string) => d.trim())
			} catch (e) {
				if (CF_DEBUG) logger.warn('[AddDomain] could not fetch worker metadata for existing domains:', (e as Error)?.message)
			}
		}

		if (existingDomains.includes(domain)) {
			if (CF_DEBUG) logger.debug('[AddDomain] domain already present; continuing to ensure routing')
		} 

		// Step 1: Get zone for the domain
		if (CF_DEBUG) logger.debug('[AddDomain] domain=', domain, 'accountId=', accountId, 'scriptName=', scriptName)
		if (CF_DEBUG) logger.debug('[AddDomain] looking up zone')
		const zones = await callCloudflareAPI(`/zones?name=${domain}`, 'GET', undefined, tokenToUse)
		if (CF_DEBUG) logger.debug('[AddDomain] zones length=', zones?.length)
		if (zones.length === 0) {
			if (CF_DEBUG) logger.warn(`[AddDomain] Zone not found for domain: ${domain}; continuing without routing setup`)
		} else {
			const zone = zones[0]
			if (CF_DEBUG) logger.debug('[AddDomain] zoneId=', zone.id)

			// Step 2: Enable email routing for the zone (best-effort)
			try {
				if (CF_DEBUG) logger.debug('[AddDomain] enabling email routing')
				await callCloudflareAPI(`/zones/${zone.id}/email/routing/enable`, 'POST', undefined, tokenToUse)
			} catch (e) {
				if (CF_DEBUG) logger.warn(`[AddDomain] email routing enable failed (non-blocking):`, (e as Error)?.message)
			}

			// Step 3: Ensure catch-all rule with catch_all endpoint
			if (CF_DEBUG) logger.debug('[AddDomain] ensuring catch-all rule targeting worker=', scriptName)
			try {
				const currentCatch = await callCloudflareAPI(`/zones/${zone.id}/email/routing/rules/catch_all`, 'GET', undefined, tokenToUse)
				const referencesWorker = (rule: any) => Array.isArray(rule?.actions) && rule.actions.some((a: any) => {
					if (a?.type !== 'worker') return false
					const v = a?.value
					if (typeof v === 'string') return v === scriptName
					if (Array.isArray(v)) return v.includes(scriptName)
					return false
				})
				const alreadyOk = referencesWorker(currentCatch) && currentCatch?.enabled === true
				if (!alreadyOk) {
					await callCloudflareAPI(`/zones/${zone.id}/email/routing/rules/catch_all`, 'PUT', {
						actions: [{ type: 'worker', value: [scriptName] }],
						enabled: true
					}, tokenToUse)
				}
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				if (CF_DEBUG) logger.warn('[AddDomain] catch-all rule ensure failed (non-blocking):', msg)
			}
		}

		// Step 4: Update MAIL_DOMAIN via secrets API (no script re-upload)
		const updatedDomains = existingDomains.includes(domain) ? existingDomains : [...existingDomains, domain]
		const newMailDomain = updatedDomains.join(',')
		if (CF_DEBUG) logger.debug('[AddDomain] updating MAIL_DOMAIN secret ->', newMailDomain)
		try {
			await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}/secrets`, 'PUT', {
				name: 'MAIL_DOMAIN',
				text: newMailDomain,
				type: 'secret_text'
			}, tokenToUse)
		} catch (e: any) {
			const message = e instanceof Error ? e.message : String(e)
			if (message.includes('Binding name') || message.includes('10053')) {
				if (CF_DEBUG) logger.warn('[AddDomain] Secret update indicates binding exists as VAR; falling back to worker re-upload with updated vars')
				// Fallback: fetch current script and bindings, then reupload with updated vars
				let script: string | undefined
				try {
					const details = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'GET', undefined, tokenToUse, 'application/javascript')
					script = (details as any)?.script as string
				} catch (e2) {
					if (CF_DEBUG) logger.warn('[AddDomain] primary script fetch failed, trying multipart:', (e2 as Error)?.message)
					const details = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'GET', undefined, tokenToUse, 'application/json')
					script = (details as any)?.script as string
				}
				if (!script || typeof script !== 'string') {
					throw new Error('Could not fetch worker script for re-upload fallback')
				}
				const bindings = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}/bindings`, 'GET', undefined, tokenToUse)
				await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'PUT', {
					script,
					bindings,
					vars: { MAIL_DOMAIN: newMailDomain }
				}, tokenToUse, 'application/json')
			} else {
				throw e
			}
		}

		if (CF_DEBUG) logger.debug(`[AddDomain] added domain ${domain} to worker ${scriptName}`)
		return NextResponse.json({ success: true, domain, domains: updatedDomains })

	} catch (error) {
		logger.error('Add domain error:', error)
		return NextResponse.json(
			{ error: `Failed to add domain: ${error instanceof Error ? error.message : 'Unknown error'}` },
			{ status: 500 }
		)
	}
} 