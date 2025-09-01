"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { fetchEventSource } from "@microsoft/fetch-event-source"
import { useAuth } from "@/contexts/auth-context"
import type { Message } from "@/types"
import { logger } from "@/lib/logger"

interface UseMercureSSEOptions {
  onNewMessage?: (message: Message) => void
  onMessageUpdate?: (messageId: string, updates: Partial<Message>) => void
  onAccountUpdate?: (accountData: any) => void
  enabled?: boolean
}

export function useMercureSSE({
  onNewMessage,
  onMessageUpdate,
  onAccountUpdate,
  enabled = true,
}: UseMercureSSEOptions = {}) {
  const { currentAccount, token } = useAuth()
  const abortControllerRef = useRef<AbortController | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const [isConnected, setIsConnected] = useState(false)
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(async () => {
    if (!enabled || !currentAccount || !token) {
      logger.debug("🔌 [Mercure] Cannot connect - missing requirements")
      return
    }

    // 获取当前账户的提供商配置
    const providerId = currentAccount.providerId || "duckmail"

    // 直接获取提供商配置，避免依赖外部函数
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
        mercureUrl: "", // No SSE for Cloudflare provider
      },
    ]

    const provider = presetProviders.find(p => p.id === providerId)
    if (!provider) {
      logger.error("❌ [Mercure] Cannot find provider configuration for:", providerId)
      return
    }

    // If provider does not support Mercure/SSE, skip quietly (fallback to polling)
    if (!provider.mercureUrl) {
      logger.debug("ℹ️ [Mercure] Provider", providerId, "has no mercureUrl. Skipping SSE and relying on polling.")
      setIsConnected(false)
      return
    }

    // 断开现有连接
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    try {
      // 构建 Mercure URL - 使用当前账户的提供商配置
      const mercureUrl = new URL(provider.mercureUrl)
      mercureUrl.searchParams.append("topic", `/accounts/${currentAccount.id}`)

      logger.debug("🔌 [Mercure] Connecting to:", mercureUrl.toString())

      // 创建新的 AbortController
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      await fetchEventSource(mercureUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: abortController.signal,

        onopen: async (response) => {
          if (response.ok) {
            logger.debug("✅ [Mercure] Connected successfully")
            setIsConnected(true)
            reconnectAttempts.current = 0
          } else {
            logger.error("❌ [Mercure] Connection failed:", response.status, response.statusText)
            setIsConnected(false)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
        },

        onmessage: (event) => {
          try {
            const data = JSON.parse(event.data)
            logger.debug("📨 [Mercure] Received:", data)

            // 处理不同类型的事件
            if (data["@type"] === "Account") {
              logger.debug("📧 [Mercure] Account updated - new message received!")
              onAccountUpdate?.(data)
            } else if (data["@type"] === "Message") {
              logger.debug("📧 [Mercure] New message received directly!")
              // 直接收到新消息，触发新消息回调
              onNewMessage?.(data)
              // 同时触发账户更新以刷新消息列表
              onAccountUpdate?.({ used: Date.now() }) // 模拟账户更新
            } else {
              logger.debug("🔍 [Mercure] Received other event type:", data["@type"])
              // 对于未知类型，也尝试触发更新
              onAccountUpdate?.({ used: Date.now() })
            }
          } catch (error) {
            logger.error("❌ [Mercure] Error parsing message:", error)
            logger.debug("Raw event data:", event.data)
          }
        },

        onerror: (error) => {
          logger.error("❌ [Mercure] Connection error:", error)
          setIsConnected(false)

          // 检查是否是CORS错误
          if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            logger.error("❌ [Mercure] CORS error detected - check server configuration")
            if (provider) {
              logger.error(`❌ [Mercure] Make sure ${new URL(provider.mercureUrl).hostname} allows cross-origin requests from your domain`)
            }
          }

          // 自动重连逻辑 - 更保守的重连策略
          if (reconnectAttempts.current < 2) { // 只重试2次
            const delay = Math.min(5000 * Math.pow(2, reconnectAttempts.current), 30000) // 5秒起步，最多30秒
            logger.debug(`🔄 [Mercure] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`)

            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++
              connect()
            }, delay)
          } else {
            logger.error("❌ [Mercure] Max reconnection attempts reached, falling back to polling")
            setIsConnected(false) // 确保状态正确
          }
        },

        onclose: () => {
          logger.debug("🔌 [Mercure] Connection closed")
          setIsConnected(false)
        }
      })

    } catch (error) {
      logger.error("❌ [Mercure] Failed to create connection:", error)
    }
  }, [enabled, currentAccount, token, onNewMessage, onMessageUpdate, onAccountUpdate])

  const disconnect = useCallback(() => {
    logger.debug("🔌 [Mercure] Disconnecting...")

    // 清理所有超时
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    setIsConnected(false)
    reconnectAttempts.current = 0
  }, [])

  // 连接管理 - 添加防抖避免频繁重连
  useEffect(() => {
    // 清除之前的连接超时
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
    }

    if (enabled && currentAccount && token) {
      // 延迟连接，避免频繁重连
      connectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 100) // 100ms 防抖
    } else {
      disconnect()
    }

    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
        connectTimeoutRef.current = null
      }
      // 只在组件卸载时断开连接，不在依赖项变化时断开
    }
  }, [enabled, currentAccount?.id, currentAccount?.providerId, token]) // 只监听关键值的变化，不包含函数

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  return {
    connect,
    disconnect,
    isConnected,
  }
}
