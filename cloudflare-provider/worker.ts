import type { EmailMessage } from '@cloudflare/workers-types';
import { initDatabase, getOrCreateMailboxId, getMailboxIdByAddress } from './database.js';
import { createJwt, verifyJwt, base64UrlDecode } from './authentication.js';
import { parseEmailBody } from './emailParser.js';

interface Env {
  TEMP_MAIL_DB: D1Database;
  MAIL_DOMAIN: string;
  JWT_TOKEN: string;
  JWT_SECRET?: string;
  RESEND_API_KEY?: string;
}

// Bearer token verification function
async function verifyBearerToken(authHeader: string | null, secret: string): Promise<any> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signature = base64UrlDecode(parts[2]);
    const data = encoder.encode(parts[0] + '.' + parts[1]);
    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    
    if (!valid) return false;
    
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    if (payload.exp <= Math.floor(Date.now() / 1000)) return false;
    
    return payload;
  } catch (_) {
    return false;
  }
}

// Add local SHA-256 hashing helper (hex encoded)
async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(text || ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

// Extract Subject from raw email headers (fallback)
function extractSubject(raw: string): string {
  if (!raw) return '';
  const idx = raw.indexOf('\r\n\r\n');
  const idx2 = idx === -1 ? raw.indexOf('\n\n') : idx;
  const sep = idx !== -1 ? idx : (idx2 !== -1 ? idx2 : -1);
  const headerBlock = sep === -1 ? raw : raw.slice(0, sep);
  const lines = headerBlock.split(/\r?\n/);
  let lastKey = '';
  const headers: Record<string, string> = {};
  for (const line of lines) {
    if (/^\s/.test(line) && lastKey) {
      headers[lastKey] += ' ' + line.trim();
      continue;
    }
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) {
      lastKey = m[1].toLowerCase();
      headers[lastKey] = m[2];
    }
  }
  return headers['subject'] || '';
}

// Error response helper
function errorResponse(message: string, status: number = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

// Success response helper
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;
    
    // Initialize database on first request
    await initDatabase(env.TEMP_MAIL_DB);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    
    try {
      // Public endpoints
      if (method === 'GET' && pathname === '/domains') {
        return handleGetDomains(env);
      }
      
      if (method === 'POST' && pathname === '/accounts') {
        return handleCreateAccount(request, env);
      }
      
      if (method === 'POST' && pathname === '/token') {
        return handleCreateToken(request, env);
      }
      
      // Protected endpoints - require Bearer token
      const authHeader = request.headers.get('Authorization');
      const jwtSecret = env.JWT_SECRET || env.JWT_TOKEN;
      const payload = await verifyBearerToken(authHeader, jwtSecret);
      
      if (!payload) {
        return errorResponse('Unauthorized', 401);
      }
      
      if (method === 'GET' && pathname === '/me') {
        return handleGetMe(payload, env);
      }
      
      if (method === 'GET' && pathname === '/messages') {
        return handleGetMessages(url, payload, env);
      }
      
      const messageMatch = pathname.match(/^\/messages\/(.+)$/);
      if (messageMatch) {
        const messageId = messageMatch[1];
        
        if (method === 'GET') {
          return handleGetMessage(messageId, payload, env);
        }
        
        if (method === 'PATCH') {
          return handlePatchMessage(request, messageId, payload, env);
        }
        
        if (method === 'DELETE') {
          return handleDeleteMessage(messageId, payload, env);
        }
      }
      
      return errorResponse('Not Found', 404);
      
    } catch (error) {
      console.error('Error:', error);
      return errorResponse('Internal Server Error', 500);
    }
  },
  
  // Email event handler for Cloudflare Email Routing
  async email(message: EmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    await initDatabase(env.TEMP_MAIL_DB);
    
    try {
      const toAddress = (message as any).to?.toLowerCase?.() || String((message as any).to || '').toLowerCase();
      const mailboxId = await getOrCreateMailboxId(env.TEMP_MAIL_DB, toAddress);
      
      // Parse email content
      const rawObj: any = (message as any).raw;
      const rawEmail = typeof rawObj === 'string' ? rawObj : await new Response(rawObj).text();
      const parsedBody = parseEmailBody(rawEmail);
      const headers: Headers | undefined = (message as any).headers;
      const subjectHeader = headers && typeof headers.get === 'function' ? (headers.get('subject') || '') : '';
      const subject = subjectHeader || extractSubject(rawEmail) || '(No Subject)';
      
      // Insert message into database
      await env.TEMP_MAIL_DB.prepare(
        `INSERT INTO messages (mailbox_id, sender, subject, content, html_content, received_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          mailboxId,
          (message as any).from,
          subject,
          parsedBody.text || '',
          parsedBody.html || null
        )
        .run();
        
    } catch (error) {
      console.error('Email processing error:', error);
    }
  }
};

// API Handlers

async function handleGetDomains(env: Env): Promise<Response> {
  const domains = (env.MAIL_DOMAIN || '').split(/[\s,]+/).filter(d => d);
  
  const hydraMembers = domains.map(domain => ({
    id: domain,
    domain: domain,
    isActive: true,
    isPrivate: false
  }));
  
  return jsonResponse({
    'hydra:member': hydraMembers,
    'hydra:totalItems': hydraMembers.length
  });
}

async function handleCreateAccount(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any;
  const { address, password } = body;
  
  if (!address || !password) {
    return errorResponse('Address and password are required');
  }
  
  // Validate domain
  const [localPart, domain] = address.split('@');
  const allowedDomains = (env.MAIL_DOMAIN || '').split(/[\s,]+/).filter(d => d);
  
  if (!allowedDomains.includes(domain)) {
    return errorResponse('Invalid domain');
  }
  
  // Get or create mailbox
  const mailboxId = await getOrCreateMailboxId(env.TEMP_MAIL_DB, address);
  
  // Store password hash (create or update user auth record)
  const passwordHash = await sha256Hex(password);
  
  // Check if auth record exists
  const existing = await env.TEMP_MAIL_DB.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).bind(address).first();
  
  if (existing) {
    // Update password
    await env.TEMP_MAIL_DB.prepare(
      'UPDATE users SET password_hash = ? WHERE username = ?'
    ).bind(passwordHash, address).run();
  } else {
    // Create new user auth record
    await env.TEMP_MAIL_DB.prepare(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    ).bind(address, passwordHash, 'user').run();
  }
  
  // Return account object
  const now = new Date().toISOString();
  return jsonResponse({
    id: String(mailboxId),
    address: address,
    quota: 0,
    used: 0,
    isDisabled: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  });
}

async function handleCreateToken(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any;
  const { address, password } = body;
  
  if (!address || !password) {
    return errorResponse('Address and password are required');
  }
  
  // Get user auth record
  const user = await env.TEMP_MAIL_DB.prepare(
    'SELECT id, password_hash FROM users WHERE username = ?'
  ).bind(address).first();
  
  if (!user) {
    return errorResponse('Invalid credentials', 401);
  }
  
  // Verify password
  const passwordHash = await sha256Hex(password);
  if (passwordHash !== user.password_hash) {
    return errorResponse('Invalid credentials', 401);
  }
  
  // Get mailbox ID
  const mailboxId = await getMailboxIdByAddress(env.TEMP_MAIL_DB, address);
  if (!mailboxId) {
    return errorResponse('Mailbox not found', 404);
  }
  
  // Create JWT
  const jwtSecret = env.JWT_SECRET || env.JWT_TOKEN;
  const token = await createJwt(jwtSecret, {
    address,
    mailboxId,
    userId: user.id
  });
  
  return jsonResponse({
    token,
    id: String(mailboxId)
  });
}

async function handleGetMe(payload: any, env: Env): Promise<Response> {
  const { address, mailboxId } = payload;
  const now = new Date().toISOString();
  
  return jsonResponse({
    id: String(mailboxId),
    address: address,
    quota: 0,
    used: 0,
    isDisabled: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  });
}

async function handleGetMessages(url: URL, payload: any, env: Env): Promise<Response> {
  const { mailboxId, address } = payload;
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 30;
  const offset = (page - 1) * limit;
  
  // Get total count
  const countResult = await env.TEMP_MAIL_DB.prepare(
    'SELECT COUNT(*) as count FROM messages WHERE mailbox_id = ?'
  ).bind(mailboxId).first();
  
  const totalCount = countResult?.count || 0;
  
  // Get messages
  const messages = await env.TEMP_MAIL_DB.prepare(
    `SELECT id, sender, subject, content, html_content, received_at, is_read 
     FROM messages 
     WHERE mailbox_id = ? 
     ORDER BY received_at DESC 
     LIMIT ? OFFSET ?`
  ).bind(mailboxId, limit, offset).all();
  
  const hydraMembers = (messages.results || []).map(msg => {
    // Extract intro from content
    const textContent = String((msg as any).content || (msg as any).html_content || '');
    const intro = textContent.substring(0, 120);
    
    return {
      id: String((msg as any).id),
      from: {
        name: '',
        address: (msg as any).sender
      },
      to: [{
        name: '',
        address: address
      }],
      subject: (msg as any).subject,
      intro: intro,
      seen: (msg as any).is_read === 1,
      hasAttachments: false,
      size: textContent.length,
      downloadUrl: null,
      createdAt: (msg as any).received_at
    };
  });
  
  return jsonResponse({
    'hydra:member': hydraMembers,
    'hydra:totalItems': totalCount
  });
}

async function handleGetMessage(messageId: string, payload: any, env: Env): Promise<Response> {
  const { mailboxId, address } = payload;
  
  const message = await env.TEMP_MAIL_DB.prepare(
    `SELECT id, sender, subject, content, html_content, received_at, is_read 
     FROM messages 
     WHERE id = ? AND mailbox_id = ?`
  ).bind(messageId, mailboxId).first();
  
  if (!message) {
    return errorResponse('Message not found', 404);
  }
  
  // Return MessageDetail format
  return jsonResponse({
    id: String((message as any).id),
    from: {
      name: '',
      address: (message as any).sender
    },
    to: [{
      name: '',
      address: address
    }],
    subject: (message as any).subject,
    text: (message as any).content ? [(message as any).content] : [],
    html: (message as any).html_content ? [(message as any).html_content] : [],
    cc: [],
    bcc: [],
    createdAt: (message as any).received_at
  });
}

async function handlePatchMessage(request: Request, messageId: string, payload: any, env: Env): Promise<Response> {
  const { mailboxId } = payload;
  const body = await request.json() as any;
  
  if ('seen' in body) {
    await env.TEMP_MAIL_DB.prepare(
      'UPDATE messages SET is_read = ? WHERE id = ? AND mailbox_id = ?'
    ).bind(body.seen ? 1 : 0, messageId, mailboxId).run();
    
    return jsonResponse({ seen: body.seen });
  }
  
  return errorResponse('Invalid update');
}

async function handleDeleteMessage(messageId: string, payload: any, env: Env): Promise<Response> {
  const { mailboxId } = payload;
  
  await env.TEMP_MAIL_DB.prepare(
    'DELETE FROM messages WHERE id = ? AND mailbox_id = ?'
  ).bind(messageId, mailboxId).run();
  
  return new Response(null, { 
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
} 