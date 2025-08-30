import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from 'node:crypto'

interface SetupInitialRequest {
  accountId: string
  scriptName?: string
  domains: string[]
  d1Name?: string
  jwtToken?: string
}

interface CloudflareApiError {
  code?: number
  message: string
  [key: string]: unknown
}

interface CloudflareApiResponse<T> {
  success: boolean
  errors: CloudflareApiError[]
  result: T
}

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const DEFAULT_JWT_TOKEN = process.env.CLOUDFLARE_JWT_TOKEN || process.env.JWT_TOKEN // Support reading from env
const WORKER_SCRIPT_CONTENT = `
import { Router } from 'itty-router'

const router = Router()

// D1 Database initialization
async function initDatabase(db) {
  await db.exec(\`
    CREATE TABLE IF NOT EXISTS mailboxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mailbox_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      subject TEXT,
      content TEXT,
      html_content TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mailbox_id) REFERENCES mailboxes (id)
    );
  \`)
}

// Get or create mailbox
async function getOrCreateMailboxId(db, address) {
  const result = await db.prepare('SELECT id FROM mailboxes WHERE address = ?').bind(address).first()
  if (result) return result.id
  
  const insertResult = await db.prepare('INSERT INTO mailboxes (address) VALUES (?)').bind(address).run()
  return insertResult.meta.last_row_id
}

// API Routes
router.get('/domains', () => {
  const domains = (env.MAIL_DOMAIN || '').split(',').filter(d => d.trim())
  return Response.json(domains.map(domain => ({
    domain: domain.trim(),
    isActive: true,
    isPrivate: false
  })))
})

router.post('/accounts', async (request) => {
  const { address, password } = await request.json()
  const [localPart, domain] = address.split('@')
  
  if (!domain || !env.MAIL_DOMAIN.includes(domain)) {
    return Response.json({ error: 'Domain not supported' }, { status: 400 })
  }
  
  await initDatabase(env.TEMP_MAIL_DB)
  const mailboxId = await getOrCreateMailboxId(env.TEMP_MAIL_DB, address)
  
  return Response.json({
    id: mailboxId,
    address,
    createdAt: new Date().toISOString()
  })
})

router.get('/accounts/:id/messages', async (request) => {
  const { id } = request.params
  await initDatabase(env.TEMP_MAIL_DB)
  
  const messages = await env.TEMP_MAIL_DB.prepare(
    'SELECT * FROM messages WHERE mailbox_id = ? ORDER BY received_at DESC LIMIT 50'
  ).bind(id).all()
  
  return Response.json(messages.results.map(msg => ({
    id: msg.id,
    from: { address: msg.sender },
    subject: msg.subject,
    intro: msg.content?.substring(0, 100) + '...',
    text: msg.content,
    html: msg.html_content,
    date: msg.received_at
  })))
})

router.post('/token', async (request) => {
  const { address, password } = await request.json()
  const jwt = require('jsonwebtoken')
  
  const payload = { address, exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) }
  const token = jwt.sign(payload, env.JWT_TOKEN || 'default-secret')
  
  return Response.json({ token })
})

// Email handler
async function email(message, env, ctx) {
  await initDatabase(env.TEMP_MAIL_DB)
  
  try {
    const toAddress = message.to.toLowerCase()
    const mailboxId = await getOrCreateMailboxId(env.TEMP_MAIL_DB, toAddress)
    
    const rawEmail = await new Response(message.raw).text()
    const subject = message.headers.get('subject') || '(No Subject)'
    
    await env.TEMP_MAIL_DB.prepare(
      'INSERT INTO messages (mailbox_id, sender, subject, content, received_at) VALUES (?, ?, ?, ?, datetime("now"))'
    ).bind(mailboxId, message.from, subject, rawEmail).run()
    
  } catch (error) {
    console.error('Email processing error:', error)
  }
}

export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx).catch(err =>
      Response.json({ error: err.message }, { status: 500 })
    )
  },
  email
}
`

async function callCloudflareAPI<T = unknown>(
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
  apiToken?: string,
  retries: number = 3
): Promise<T> {
  const token = apiToken || CLOUDFLARE_API_TOKEN

  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN not configured')
  }

  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      })

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      const data: CloudflareApiResponse<T> = await response.json()

      if (!data.success) {
        throw new Error(`Cloudflare API error: ${data.errors.map((e) => e.message).join(', ')}`)
      }

      return data.result as T
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      if (attempt === retries - 1) throw lastError
    }
  }
  
  throw lastError || new Error('API call failed')
}

export async function POST(request: NextRequest) {
  try {
    // Check for API token from header (UI provided) or environment variable
    const apiTokenFromHeader = request.headers.get('X-CF-API-Token')
    const apiToken = apiTokenFromHeader || CLOUDFLARE_API_TOKEN
    
    if (!apiToken) {
      return NextResponse.json(
        { error: 'Cloudflare API token not configured' },
        { status: 500 }
      )
    }

    const body: SetupInitialRequest = await request.json()
    const { accountId, scriptName = 'duckmail-worker', domains, d1Name = 'temp_mail_db', jwtToken } = body

    if (!accountId || !domains || domains.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId, domains' },
        { status: 400 }
      )
    }

    // Step 1: Create or verify D1 database
    console.log('Creating/verifying D1 database...')
    let databaseId: string
    try {
      const databases = await callCloudflareAPI<Array<{ uuid: string; name: string }>>(`/accounts/${accountId}/d1/database`, 'GET', undefined, apiToken)
      const existingDb = databases.find((db) => db.name === d1Name)
      
      if (existingDb) {
        databaseId = existingDb.uuid
        console.log(`Using existing D1 database: ${databaseId}`)
      } else {
        const newDb = await callCloudflareAPI<{ uuid: string }>(`/accounts/${accountId}/d1/database`, 'POST', {
          name: d1Name
        }, apiToken)
        databaseId = newDb.uuid
        console.log(`Created new D1 database: ${databaseId}`)
      }
    } catch (error) {
      console.error('D1 database error:', error)
      return NextResponse.json(
        { error: `Failed to create/verify D1 database: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Step 2: Deploy Worker script
    console.log('Deploying Worker script...')
    // Decide JWT secret: prefer env var; otherwise use provided; otherwise generate a secure secret (do not expose)
    const finalJwtToken = DEFAULT_JWT_TOKEN || jwtToken || randomBytes(32).toString('base64url')
    console.log('Using JWT token:', DEFAULT_JWT_TOKEN ? 'from-env' : (jwtToken ? 'provided' : 'generated'))
    const mailDomain = domains.join(',')
    
    try {
      await callCloudflareAPI(`/accounts/${accountId}/workers/scripts/${scriptName}`, 'PUT', {
        script: WORKER_SCRIPT_CONTENT,
        bindings: [
          {
            type: 'd1_database',
            name: 'TEMP_MAIL_DB',
            database_id: databaseId
          }
        ],
        vars: {
          MAIL_DOMAIN: mailDomain,
          JWT_TOKEN: finalJwtToken
        }
      }, apiToken)
      console.log(`Deployed Worker script: ${scriptName}`)
    } catch (error) {
      console.error('Worker deployment error:', error)
      return NextResponse.json(
        { error: `Failed to deploy Worker: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Step 3: Get zones for domains and enable email routing
    console.log('Setting up email routing...')
    const zoneDomains = []
    
    for (const domain of domains) {
      try {
        // Get zone for domain
        const zones = await callCloudflareAPI<Array<{ id: string; name: string }>>(
          `/zones?name=${encodeURIComponent(domain)}`, 
          'GET',
          undefined,
          apiToken
        )
        if (zones.length === 0) {
          console.warn(`Zone not found for domain: ${domain}`)
          continue
        }
        
        const zone = zones[0]
        zoneDomains.push({ domain, zoneId: zone.id })
        
        // Enable email routing
        try {
          await callCloudflareAPI(`/zones/${zone.id}/email/routing/enable`, 'POST', undefined, apiToken)
        } catch {
          console.log(`Email routing might already be enabled for ${domain}`)
        }
        
        // Create catch-all rule
        await callCloudflareAPI(`/zones/${zone.id}/email/routing/rules`, 'POST', {
          matchers: [{ type: 'all' }],
          actions: [{ type: 'worker', value: scriptName }]
        }, apiToken)
        
        console.log(`Set up email routing for: ${domain}`)
      } catch (error) {
        console.error(`Failed to set up email routing for ${domain}:`, error)
      }
    }

    const workerUrl = `https://${scriptName}.${accountId.substring(0, 8)}.workers.dev`

    return NextResponse.json({
      success: true,
      workerUrl,
      scriptName,
      d1: {
        name: d1Name,
        databaseId
      },
      domains: zoneDomains.map(zd => zd.domain)
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json(
      { error: `Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 