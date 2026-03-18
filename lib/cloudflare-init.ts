// Cloudflare Worker Auto-initialization
// Caches detected config for faster UI loading but does NOT silently add providers.
// The user must explicitly add providers via the Auto-Detect or Domain Manager UI.

import { logger } from "@/lib/logger"

const CACHE_KEY = 'cloudflare-detected-config'

export interface DetectedCloudflareConfig {
  workerUrl: string
  scriptName: string
  databaseId: string
  domains: string[]
  jwtTokenConfigured: boolean
  apiTokenConfigured: boolean
  detectedAt: number
}

export async function initializeCloudflareProvider() {
  if (typeof window === 'undefined') return

  const CF_DEBUG = (typeof process !== 'undefined' && (process as any).env?.CF_DEBUG === '1')

  try {
    const response = await fetch('/api/cf/detect-existing')
    const data = await response.json()

    if (!data.success || !data.workerInfo) {
      if (CF_DEBUG) logger.debug('[Cloudflare] No existing configuration found')
      localStorage.removeItem(CACHE_KEY)
      return
    }

    const config: DetectedCloudflareConfig = {
      ...data.workerInfo,
      detectedAt: Date.now()
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(config))
    if (CF_DEBUG) logger.debug('[Cloudflare] Cached detected config:', config.workerUrl || config.scriptName)
  } catch (error) {
    if (CF_DEBUG) logger.warn('[Cloudflare] Auto-detect error:', (error as Error)?.message)
  }
}

export function getCachedCloudflareConfig(): DetectedCloudflareConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function resetCloudflareAutoInit() {
  localStorage.removeItem(CACHE_KEY)
  console.log('[Cloudflare] Detected config cache cleared')
}
