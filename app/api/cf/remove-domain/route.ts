import { NextRequest, NextResponse } from "next/server"

interface CloudflareApiError {
	code?: number
	message: string
}

interface CloudflareApiResponse<T = unknown> {
	success: boolean
	errors: CloudflareApiError[]
	result: T
}

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN

async function callCloudflareAPI(endpoint: string, method: string = 'GET', body?: any) {
	if (!CLOUDFLARE_API_TOKEN) {
		throw new Error('CLOUDFLARE_API_TOKEN not configured')
	}

	const url = `https://api.cloudflare.com/client/v4${endpoint}`
	const response = await fetch(url, {
		method,
		headers: {
			'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
			'Content-Type': 'application/json',
			'Accept': 'application/json, multipart/form-data',
		},
		body: body ? JSON.stringify(body) : undefined,
	})

	const contentType = response.headers.get('content-type') || ''
	console.log('[CF API]', method, endpoint, 'status=', response.status, 'content-type=', contentType)

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

	if (contentType.includes('multipart/')) {
		const boundaryMatch = contentType.match(/boundary=([^;]+)/i)
		const raw = await response.text()
		console.log('[CF API][multipart][raw-head]', raw.slice(0, 600))
		if (boundaryMatch) {
			const boundary = `--${boundaryMatch[1]}`
			console.log('[CF API][multipart] boundary=', boundaryMatch[1])
			const parts = raw.split(boundary)
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
				const isJsonLikely = headersLower.includes('name="metadata"') || headersLower.includes('name=metadata') || headersLower.includes('content-type: application/json') || headersLower.includes('name="manifest"') || headersLower.includes('filename="metadata"')
				const isWorkerJs = headersLower.includes('name="worker.js"') || headersLower.includes('filename="worker.js"') || headersLower.includes('content-type: application/javascript')
				if (isJsonLikely) {
					const jsonStart = body.indexOf('{')
					const jsonEnd = body.lastIndexOf('}')
					if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
						const metaJson = body.slice(jsonStart, jsonEnd + 1)
						console.log('[CF API][multipart][metadata-json-head]', metaJson.slice(0, 600))
						try {
							metadataJson = JSON.parse(metaJson)
						} catch {}
					}
				} else if (isWorkerJs) {
					// Trim trailing CRLF that may precede the next boundary
					scriptContent = body.replace(/\r?\n--$/, '')
				}
			}
			if (metadataJson || scriptContent) {
				return { ...(metadataJson || {}), ...(scriptContent ? { script: scriptContent } : {}) }
			}
			console.warn('[CF API][multipart] metadata part not found. Parts count=', parts.length)
		}
		throw new Error('Unexpected multipart response format from Cloudflare Workers API')
	}

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

export async function POST(request: NextRequest) {
	try {
		if (!CLOUDFLARE_API_TOKEN) {
			return NextResponse.json({ error: 'Cloudflare API token not configured' }, { status: 500 })
		}

		const { domain, accountId, scriptName }: { domain: string; accountId: string; scriptName: string } = await request.json()
		if (!domain || !accountId || !scriptName) {
			return NextResponse.json({ error: 'Missing required fields: domain, accountId, scriptName' }, { status: 400 })
		}

		// Step 1: Resolve zone (optional best-effort removal of rules)
		let zoneId: string | null = null
		try {
			const zones = await callCloudflareAPI(`/zones?name=${encodeURIComponent(domain)}`, 'GET')
			if (Array.isArray(zones) && zones.length > 0) {
				zoneId = zones[0].id
			}
		} catch {}

		// Step 2: Inspect current bindings and vars
		let currentVars: Record<string, string> = {}
		let bindings: any[] = []
		try {
			// prefer JSON to avoid multipart parsing fragility
			const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
					'Accept': 'application/json'
				}
			})
			const ct = res.headers.get('content-type') || ''
			if (ct.includes('application/json')) {
				const data = await res.json()
				const result = (typeof (data as any).success === 'boolean' && 'result' in (data as any)) ? (data as any).result : data
				currentVars = (result as any)?.vars || {}
			} else {
				const workerScript = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'GET')
				currentVars = (workerScript as any)?.vars || {}
			}
			// Fetch bindings to determine if MAIL_DOMAIN is a plain_text var
			bindings = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}/bindings`, 'GET')
		} catch {}

		// Determine current domains from multiple sources for robustness
		let domainsSource: string = ''
		const bindingMailDomain = (Array.isArray(bindings) ? bindings.find((b: any) => b?.name === 'MAIL_DOMAIN') : undefined)?.text
		if (typeof bindingMailDomain === 'string') {
			domainsSource = bindingMailDomain
		} else if (typeof currentVars.MAIL_DOMAIN === 'string') {
			domainsSource = currentVars.MAIL_DOMAIN
		} else {
			// Try worker /domains endpoint
			try {
				const subdomainInfo = await callCloudflareAPI(`/accounts/${accountId}/workers/subdomain`, 'GET')
				const subdomain = (subdomainInfo && typeof subdomainInfo === 'object' && 'subdomain' in subdomainInfo)
					? (subdomainInfo as any).subdomain
					: ''
				if (subdomain) {
					const workerUrl = `https://${scriptName}.${subdomain}.workers.dev`
					const res = await fetch(`${workerUrl}/domains`, { headers: { 'Accept': 'application/json' } })
					if (res.ok) {
						const payload = await res.json()
						const list = Array.isArray(payload)
							? payload
							: (Array.isArray((payload || {})['hydra:member']) ? (payload as any)['hydra:member'].map((x: any) => x?.domain).filter(Boolean) : [])
						domainsSource = list.join(',')
					}
				}
			} catch {}
		}

		const currentDomains = domainsSource.split(',').map((d: string) => d.trim()).filter(Boolean)
		console.log('[RemoveDomain] current domains=', currentDomains)

		// Remove domain if present and update binding/secret accordingly
		const updatedDomains = currentDomains.filter((d: string) => d !== domain)
		const newMailDomain = updatedDomains.join(',')
		console.log('[RemoveDomain] updating MAIL_DOMAIN ->', newMailDomain)

		const mailDomainBinding = Array.isArray(bindings) ? bindings.find((b: any) => b?.name === 'MAIL_DOMAIN') : undefined
		const isPlainTextVar = mailDomainBinding?.type === 'plain_text'

		if (isPlainTextVar) {
			// Update via worker re-upload, replacing the existing plain_text binding
			const details = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'GET')
			const script = (details as any)?.script as string
			if (!script || typeof script !== 'string') {
				throw new Error('Could not fetch worker script for re-upload fallback')
			}
			const existingBindings = Array.isArray(bindings) ? bindings : []
			const filteredBindings = existingBindings.filter((b: any) => b?.name !== 'MAIL_DOMAIN')
			const updatedMailDomainBinding = { type: 'plain_text', name: 'MAIL_DOMAIN', text: newMailDomain }
			const mergedBindings = [ ...filteredBindings, updatedMailDomainBinding ]
			const metadata = { main_module: 'worker.js', compatibility_date: '2024-12-01', bindings: mergedBindings }
			const form = new FormData()
			form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json')
			form.append('worker.js', new Blob([script], { type: 'application/javascript+module' }), 'worker.js')
			const uploadRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`, {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Accept': 'application/json' },
				body: form
			})
			const uploadJson = await uploadRes.json()
			if (!uploadJson?.success) {
				throw new Error(`Cloudflare API error: ${(uploadJson?.errors || []).map((e: any) => e?.message).join(', ') || 'Upload failed'}`)
			}
		} else {
			// Update as a secret (covers when MAIL_DOMAIN is bound as secret_text or not present yet)
			try {
				await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}/secrets`, 'PUT', {
					name: 'MAIL_DOMAIN',
					text: newMailDomain,
					type: 'secret_text'
				})
			} catch (e: any) {
				const message = e instanceof Error ? e.message : String(e)
				if (message.includes('Binding name') || message.includes('10053')) {
					console.warn('[RemoveDomain] Secret update indicates binding exists as VAR; falling back to worker re-upload with updated vars')
					const details = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'GET')
					const script = (details as any)?.script as string
					if (!script || typeof script !== 'string') {
						throw new Error('Could not fetch worker script for re-upload fallback')
					}
					const existingBindings = await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}/bindings`, 'GET')
					const filteredBindings = (Array.isArray(existingBindings) ? existingBindings : []).filter((b: any) => b?.name !== 'MAIL_DOMAIN')
					const updatedMailDomainBinding = { type: 'plain_text', name: 'MAIL_DOMAIN', text: newMailDomain }
					const mergedBindings = [ ...filteredBindings, updatedMailDomainBinding ]
					const metadata = { main_module: 'worker.js', compatibility_date: '2024-12-01', bindings: mergedBindings }
					const form = new FormData()
					form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json')
					form.append('worker.js', new Blob([script], { type: 'application/javascript+module' }), 'worker.js')
					const uploadRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`, {
						method: 'PUT',
						headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Accept': 'application/json' },
						body: form
					})
					const uploadJson = await uploadRes.json()
					if (!uploadJson?.success) {
						throw new Error(`Cloudflare API error: ${(uploadJson?.errors || []).map((e: any) => e?.message).join(', ') || 'Upload failed'}`)
					}
				} else {
					throw e
				}
			}
		}

		console.log(`[RemoveDomain] removed domain ${domain} from worker ${scriptName}`)
		
		return NextResponse.json({
			success: true,
			domain,
			domains: updatedDomains
		})

	} catch (error) {
		console.error('Remove domain error:', error)
		return NextResponse.json(
			{ error: `Failed to remove domain: ${error instanceof Error ? error.message : 'Unknown error'}` },
			{ status: 500 }
		)
	}
} 