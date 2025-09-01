// Cloudflare Worker Auto-initialization
// This module checks for existing Cloudflare configuration and automatically
// adds it as a provider if not already present

import { logger } from "@/lib/logger"

export async function initializeCloudflareProvider() {
  if (typeof window === 'undefined') return
  
  const CF_DEBUG = (typeof process !== 'undefined' && (process as any).env?.CF_DEBUG === '1')

  try {
    // Check if we should auto-initialize
    const autoInit = localStorage.getItem('cloudflare-auto-init-done')
    if (autoInit === 'true') {
      if (CF_DEBUG) logger.debug('[Cloudflare] Auto-init already completed')
      return
    }
    
    // Check for existing configuration via the detect API
    const response = await fetch('/api/cf/detect-existing')
    const data = await response.json()
    
    if (!data.success || !data.workerInfo) {
      if (CF_DEBUG) logger.debug('[Cloudflare] No existing configuration found')
      return
    }
    
    const { workerInfo } = data
    const overrideUrl = (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL) || undefined
    const workerUrl = overrideUrl || workerInfo.workerUrl
    
    // Check if this worker is already added as a provider
    const customProviders = JSON.parse(localStorage.getItem('custom-api-providers') || '[]')
    const existingProvider = customProviders.find((p: any) => 
      p.baseUrl === workerUrl || 
      p.name?.includes(workerInfo.scriptName)
    )
    
    if (existingProvider) {
      if (CF_DEBUG) logger.debug('[Cloudflare] Provider already exists:', existingProvider.name)
      localStorage.setItem('cloudflare-auto-init-done', 'true')
      return
    }
    
    // Add as a new custom provider
    const newProvider = {
      id: `cloudflare-auto-${Date.now()}`,
      name: `Cloudflare (${workerInfo.scriptName})`,
      baseUrl: workerUrl,
      mercureUrl: '',
      isCustom: true
    }
    
    const updatedProviders = [...customProviders, newProvider]
    localStorage.setItem('custom-api-providers', JSON.stringify(updatedProviders))
    localStorage.setItem('cloudflare-auto-init-done', 'true')
    if (CF_DEBUG) logger.debug('[Cloudflare] Added provider automatically:', newProvider.name)
  } catch (error) {
    // Silent failure is fine; this is best-effort helper
    if (CF_DEBUG) logger.warn('[Cloudflare] Auto-init error:', (error as Error)?.message)
  }
}

// Reset auto-init (useful for debugging)
export function resetCloudflareAutoInit() {
  localStorage.removeItem('cloudflare-auto-init-done')
  console.log('[Cloudflare] Auto-init reset - will run on next page load')
} 