import type { Account, Domain, Message, MessageDetail } from "@/types"

const API_BASE_URL = "/api/mail"

// 获取默认API提供商配置（用于向后兼容）
function getDefaultProviderConfig() {
  return {
    id: "cloudflare",
    name: "Cloudflare",
    baseUrl: "https://duckmail-cloudflare-provider.lungw96.workers.dev",
    mercureUrl: "",
  }
}

// 创建带有提供商信息的请求头
function createHeaders(additionalHeaders: HeadersInit = {}, providerId?: string): HeadersInit {
  // 如果指定了providerId，使用指定的提供商，否则使用默认提供商
  const provider = providerId ? getProviderConfig(providerId) : getDefaultProviderConfig()
  const headers: Record<string, string> = {
    ...additionalHeaders as Record<string, string>,
  }

  if (provider) {
    headers["X-API-Provider-Base-URL"] = provider.baseUrl
  }

  return headers
}

// 从邮箱地址推断提供商ID
function inferProviderFromEmail(email: string): string {
  if (typeof window === "undefined") return "duckmail"

  try {
    const domain = email.split("@")[1]
    if (!domain) return "duckmail"

    // 首先检查已知的域名模式
    const knownDomainPatterns: Record<string, string> =   {
      // Mail.tm 的常见域名
      "1secmail.com": "mailtm"
    }

    // 检查是否是已知域名
    if (knownDomainPatterns[domain]) {
      console.log(`📍 [API] Domain ${domain} mapped to provider: ${knownDomainPatterns[domain]}`)
      return knownDomainPatterns[domain]
    }

    // 获取所有域名信息（从localStorage缓存中获取，避免API调用）
    const cachedDomains = localStorage.getItem("cached-domains")
    if (cachedDomains) {
      const domains = JSON.parse(cachedDomains)
      const matchedDomain = domains.find((d: any) => d.domain === domain)
      if (matchedDomain && matchedDomain.providerId) {
        console.log(`📍 [API] Domain ${domain} found in cache, provider: ${matchedDomain.providerId}`)
        return matchedDomain.providerId
      }
    }

    // 如果没有找到匹配的域名，返回默认提供商
    console.log(`⚠️ [API] Domain ${domain} not found, using default provider: duckmail`)
    return "duckmail"
  } catch (error) {
    console.error("Error inferring provider from email:", error)
    return "duckmail"
  }
}

// 根据providerId获取提供商配置
function getProviderConfig(providerId: string) {
  if (typeof window === "undefined") return null

  try {
    // 预设提供商
    const presetProviders = [
      {
        id: "duckmail",
        name: "DuckMail",
        baseUrl: "https://api.duckmail.sbs",
        mercureUrl: "https://mercure.duckmail.sbs/.well-known/mercure",
      },
      {
        id: "mailtm",
        name: "Mail.tm",
        baseUrl: "https://api.mail.tm",
        mercureUrl: "https://mercure.mail.tm/.well-known/mercure",
      },
      {
        id: "cloudflare",
        name: "Cloudflare",
        baseUrl: "https://duckmail-cloudflare-provider.lungw96.workers.dev",
        mercureUrl: "",
      },
    ]

    // 查找预设提供商
    let provider = presetProviders.find(p => p.id === providerId)

    // 如果没找到，查找自定义提供商
    if (!provider) {
      const customProviders = localStorage.getItem("custom-api-providers")
      if (customProviders) {
        const parsed = JSON.parse(customProviders)
        provider = parsed.find((p: any) => p.id === providerId)
      }
    }

    return provider || presetProviders[0] // 默认返回第一个预设提供商
  } catch (error) {
    console.error("Error getting provider config:", error)
    return {
      id: "duckmail",
      name: "DuckMail",
      baseUrl: "https://api.duckmail.sbs",
      mercureUrl: "https://mercure.duckmail.sbs/.well-known/mercure",
    }
  }
}

// 根据API文档改进错误处理
function getErrorMessage(status: number, errorData: any): string {
  switch (status) {
    case 400:
      return "请求参数错误或缺失必要信息"
    case 401:
      return "认证失败，请检查登录状态"
    case 404:
      return "请求的资源不存在"
    case 405:
      return "请求方法不被允许"
    case 418:
      return "服务器暂时不可用"
    case 422:
      // 处理具体的422错误信息
      if (errorData?.violations && Array.isArray(errorData.violations)) {
        const violation = errorData.violations[0]
        if (violation?.propertyPath === "address" && violation?.message?.includes("already used")) {
          return "该邮箱地址已被使用，请尝试其他用户名"
        }
        return violation?.message || "请求数据格式错误"
      }

      // 处理不同API提供商的错误消息格式
      const errorMessage = errorData?.detail || errorData?.message || ""

      // 统一处理邮箱已存在的错误
      if (errorMessage.includes("Email address already exists") ||
          errorMessage.includes("already used") ||
          errorMessage.includes("already exists")) {
        return "该邮箱地址已被使用，请尝试其他用户名"
      }

      return errorMessage || "请求数据格式错误，请检查用户名长度或域名格式"
    case 429:
      return "请求过于频繁，请稍后再试"
    default:
      return errorData?.message || errorData?.details || errorData?.error || `请求失败 (${status})`
  }
}

// 检查是否应该重试的错误
function shouldRetry(status: number): boolean {
  // 不应该重试的状态码
  const noRetryStatuses = [400, 401, 403, 404, 405, 422, 429]
  return !noRetryStatuses.includes(status)
}

// 重试函数，改进错误处理
async function retryFetch(fn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> {
  try {
    const response = await fn()
    return response
  } catch (error: any) {
    // 如果错误包含状态码信息，检查是否应该重试
    if (error.message && typeof error.message === 'string') {
      // 从错误消息中提取状态码
      const statusMatch = error.message.match(/HTTP (\d+)/)
      if (statusMatch) {
        const status = parseInt(statusMatch[1])
        if (!shouldRetry(status)) {
          console.log(`Status ${status} should not be retried, throwing error immediately`)
          throw error
        }
      }
    }

    // 对于其他错误，如果还有重试次数，则重试
    if (retries > 0) {
      console.log(`Retrying... ${retries} attempts left`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return retryFetch(fn, retries - 1, delay * 2)
    }
    throw error
  }
}

// 获取单个提供商的域名
export async function fetchDomainsFromProvider(providerId: string): Promise<Domain[]> {
  try {
    const response = await retryFetch(async () => {
      const res = await fetch(`${API_BASE_URL}?endpoint=/domains`, {
        headers: createHeaders({
          "Cache-Control": "no-cache",
        }, providerId),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      return res
    })

    const data = await response.json()

    if (data && data["hydra:member"] && Array.isArray(data["hydra:member"])) {
      // 为每个域名添加提供商信息
      return data["hydra:member"].map((domain: Domain) => ({
        ...domain,
        providerId, // 添加提供商ID
      }))
    } else {
      console.error("Invalid domains data format:", data)
      return []
    }
  } catch (error) {
    console.error(`Error fetching domains from provider ${providerId}:`, error)
    return [] // 返回空数组而不是抛出错误，这样其他提供商仍然可以工作
  }
}

// 获取所有启用提供商的域名
export async function fetchAllDomains(): Promise<Domain[]> {
  if (typeof window === "undefined") return []

  try {
    // 获取启用的提供商列表
    const disabledProviders = JSON.parse(localStorage.getItem("disabled-api-providers") || "[]")
    const presetProviders = [
      { id: "duckmail", name: "DuckMail" },
      { id: "mailtm", name: "Mail.tm" },
      { id: "cloudflare", name: "Cloudflare" },
    ]
    const customProviders = JSON.parse(localStorage.getItem("custom-api-providers") || "[]")

    const allProviders = [...presetProviders, ...customProviders]
    const enabledProviders = allProviders.filter(p => !disabledProviders.includes(p.id))

    // 并行获取所有启用提供商的域名
    const domainPromises = enabledProviders.map(provider =>
      fetchDomainsFromProvider(provider.id)
    )

    const domainResults = await Promise.all(domainPromises)

    // 合并所有域名，并添加提供商名称信息
    const allDomains: Domain[] = []
    domainResults.forEach((domains, index) => {
      const provider = enabledProviders[index]
      domains.forEach(domain => {
        allDomains.push({
          ...domain,
          providerId: provider.id,
          providerName: provider.name, // 添加提供商名称用于显示
        })
      })
    })

    return allDomains
  } catch (error) {
    console.error("Error fetching domains from all providers:", error)
    throw error
  }
}

// 保持向后兼容的函数
export async function fetchDomains(): Promise<Domain[]> {
  return fetchAllDomains()
}

export async function createAccount(address: string, password: string, providerId?: string): Promise<Account> {
  // 如果没有指定providerId，尝试从邮箱地址推断
  if (!providerId) {
    providerId = inferProviderFromEmail(address)
  }

  console.log(`🔧 [API] Creating account ${address} with provider: ${providerId}`)

  try {
    const res = await fetch(`${API_BASE_URL}?endpoint=/accounts`, {
      method: "POST",
      headers: createHeaders({
        "Content-Type": "application/json",
      }, providerId),
      body: JSON.stringify({ address, password }),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      const errorMessage = getErrorMessage(res.status, error)

      // 对于422和429错误，直接抛出，不重试
      if (res.status === 422 || res.status === 429) {
        throw new Error(errorMessage)
      }

      // 对于其他错误，可以考虑重试
      throw new Error(`HTTP ${res.status}: ${errorMessage}`)
    }

    return res.json()
  } catch (error: any) {
    // 如果是422或429错误，直接抛出
    if (error.message && (
      error.message.includes("该邮箱地址已被使用") ||
      error.message.includes("请求过于频繁") ||
      error.message.includes("Email address already exists") ||
      error.message.includes("rate limit") ||
      error.message.includes("422") ||
      error.message.includes("429")
    )) {
      throw error
    }

    // 对于其他错误，使用重试逻辑
    const response = await retryFetch(async () => {
      const res = await fetch(`${API_BASE_URL}?endpoint=/accounts`, {
        method: "POST",
        headers: createHeaders({
          "Content-Type": "application/json",
        }, providerId),
        body: JSON.stringify({ address, password }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(`HTTP ${res.status}: ${getErrorMessage(res.status, error)}`)
      }

      return res
    }, 2, 2000) // 减少重试次数和增加延迟

    return response.json()
  }
}

export async function getToken(address: string, password: string, providerId?: string): Promise<{ token: string; id: string }> {
  // 如果没有指定providerId，尝试从邮箱地址推断
  if (!providerId) {
    providerId = inferProviderFromEmail(address)
  }

  const response = await retryFetch(async () => {
    const res = await fetch(`${API_BASE_URL}?endpoint=/token`, {
      method: "POST",
      headers: createHeaders({
        "Content-Type": "application/json",
      }, providerId),
      body: JSON.stringify({ address, password }),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(getErrorMessage(res.status, error))
    }

    return res
  })

  return response.json()
}

export async function getAccount(token: string, providerId?: string): Promise<Account> {
  const response = await retryFetch(async () => {
    const res = await fetch(`${API_BASE_URL}?endpoint=/me`, {
      headers: createHeaders({
        Authorization: `Bearer ${token}`,
      }, providerId),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(getErrorMessage(res.status, error))
    }

    return res
  })

  return response.json()
}

export async function getMessages(token: string, page = 1, providerId?: string): Promise<{ messages: Message[]; total: number; hasMore: boolean }> {
  const timestamp = new Date().toISOString()
  console.log(`📡 [API] getMessages called at ${timestamp} - page: ${page}`)

  const response = await retryFetch(async () => {
    const res = await fetch(`${API_BASE_URL}?endpoint=/messages&page=${page}`, {
      headers: createHeaders({
        Authorization: `Bearer ${token}`,
      }, providerId),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      console.log(`❌ [API] getMessages failed - Status: ${res.status}`)
      throw new Error(getErrorMessage(res.status, error))
    }

    console.log(`✅ [API] getMessages success - Status: ${res.status}`)
    return res
  })

  const data = await response.json()
  const messages = data["hydra:member"] || []
  const total = data["hydra:totalItems"] || 0

  // 根据API文档，每页最多30条消息
  const hasMore = messages.length === 30 && (page * 30) < total

  console.log(`📊 [API] getMessages result - Messages: ${messages.length}, Total: ${total}, HasMore: ${hasMore}`)

  return {
    messages,
    total,
    hasMore,
  }
}

export async function getMessage(token: string, id: string, providerId?: string): Promise<MessageDetail> {
  const response = await retryFetch(async () => {
    const res = await fetch(`${API_BASE_URL}?endpoint=/messages/${id}`, {
      headers: createHeaders({
        Authorization: `Bearer ${token}`,
      }, providerId),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(getErrorMessage(res.status, error))
    }

    return res
  })

  return response.json()
}

export async function markMessageAsRead(token: string, id: string, providerId?: string): Promise<{ seen: boolean }> {
  const response = await retryFetch(async () => {
    const res = await fetch(`${API_BASE_URL}?endpoint=/messages/${id}`, {
      method: "PATCH",
      headers: createHeaders({
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/merge-patch+json",
      }, providerId),
      body: JSON.stringify({ seen: true }), // 需要发送请求体来标记为已读
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(getErrorMessage(res.status, error))
    }

    // API文档显示成功时返回 {"seen": true}
    if (res.headers.get("content-type")?.includes("application/json")) {
      return res.json()
    }
    // 如果状态码是200，假设操作成功
    return { seen: true }
  })

  return response
}

export async function deleteMessage(token: string, id: string, providerId?: string): Promise<void> {
  await retryFetch(async () => {
    const res = await fetch(`${API_BASE_URL}?endpoint=/messages/${id}`, {
      method: "DELETE",
      headers: createHeaders({
        Authorization: `Bearer ${token}`,
      }, providerId),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(getErrorMessage(res.status, error))
    }

    return res
  })
}

export async function deleteAccount(token: string, id: string, providerId?: string): Promise<void> {
  await retryFetch(async () => {
    const res = await fetch(`${API_BASE_URL}?endpoint=/accounts/${id}`, {
      method: "DELETE",
      headers: createHeaders({
        Authorization: `Bearer ${token}`,
      }, providerId),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(getErrorMessage(res.status, error))
    }

    return res
  })
}
