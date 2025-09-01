"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardBody } from "@heroui/card"
import { Spinner } from "@heroui/spinner"
import { Avatar } from "@heroui/avatar"
import { getMessages } from "@/lib/api"
import type { Message } from "@/types"
import { useAuth } from "@/contexts/auth-context"
import { useSmartMailChecker } from "@/hooks/use-smart-mail-checker"
import { useHeroUIToast } from "@/hooks/use-heroui-toast"
import { useMailStatus } from "@/contexts/mail-status-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatDistanceToNow } from "date-fns"
import { enUS, zhCN } from "date-fns/locale" // Import both locales
import { Mail } from "lucide-react"
import { logger } from "@/lib/logger"

interface MessageListProps {
  onSelectMessage: (message: Message) => void
  currentLocale: string // Add currentLocale prop
  refreshKey?: number // 用于触发手动刷新
}

export default function MessageList({ onSelectMessage, currentLocale, refreshKey }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { token, currentAccount } = useAuth() // Get currentAccount to refresh on account switch
  const { toast } = useHeroUIToast()
  const { isEnabled } = useMailStatus()
  const isMobile = useIsMobile()

  // 处理新消息通知
  const handleNewMessage = useCallback((message: Message) => {
    toast({
      title: currentLocale === "en" ? "New Email Received" : "收到新邮件",
      description: `${currentLocale === "en" ? "From" : "来自"}: ${message.from.address}`,
      color: "success",
      variant: "flat",
      icon: <Mail size={16} />,
    })
  }, [currentLocale, toast])

  // 处理消息列表更新
  const handleMessagesUpdate = useCallback((newMessages: Message[]) => {
    setMessages(newMessages)
    setError(null)
    if (loading) {
      setLoading(false)
    }
  }, [loading])

  // 手动刷新邮件
  const manualRefresh = useCallback(async () => {
    if (!token || !currentAccount) return

    try {
      setLoading(true)
      const providerId = currentAccount.providerId || "duckmail"
      const { messages: fetchedMessages } = await getMessages(token, 1, providerId)
      setMessages(fetchedMessages || [])
      setError(null)
    } catch (err) {
      logger.error("Failed to refresh messages:", err)
      setError(currentLocale === "en" ? "Failed to refresh emails. Please try again." : "刷新邮件失败，请稍后再试")
    } finally {
      setLoading(false)
    }
  }, [token, currentAccount, currentLocale])

  // 使用智能邮件检查器：
  // - Mercure SSE 总是尝试连接（不受 isEnabled 控制）
  // - 轮询策略只在 Mercure 失败时启用，受 isEnabled 控制
  const smartChecker = useSmartMailChecker({
    onNewMessage: handleNewMessage,
    onMessagesUpdate: handleMessagesUpdate,
    enabled: isEnabled, // 只控制备用轮询策略
  })

  // 调试信息
  useEffect(() => {
    if (smartChecker.isUsingMercure) {
      logger.debug("🚀 [MessageList] Using Mercure SSE for real-time updates")
    } else if (smartChecker.isUsingPolling) {
      logger.debug("🔄 [MessageList] Using polling as fallback")
    }
  }, [smartChecker.isUsingMercure, smartChecker.isUsingPolling])

  // 初始加载 - 当账户或token变化时重新加载
  useEffect(() => {
    const fetchInitialMessages = async () => {
      if (!token || !currentAccount) {
        logger.debug("📥 [MessageList] No token or account, clearing messages")
        setMessages([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        logger.debug(`📥 [MessageList] Loading initial messages for account: ${currentAccount.address}`)
        const providerId = currentAccount.providerId || "duckmail"
        const { messages: fetchedMessages } = await getMessages(token, 1, providerId)
        setMessages(fetchedMessages || [])
        setError(null)
        logger.debug(`📥 [MessageList] Loaded ${fetchedMessages?.length || 0} initial messages`)
      } catch (err) {
        logger.error("Failed to fetch messages:", err)
        setError(currentLocale === "en" ? "Failed to fetch emails. Please try again." : "获取邮件失败，请稍后再试")
        setMessages([])
      } finally {
        setLoading(false)
      }
    }

    fetchInitialMessages()
  }, [token, currentAccount?.id, currentLocale]) // 使用 currentAccount.id 而不是整个对象

  // 监听手动刷新
  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      manualRefresh()
    }
  }, [refreshKey, manualRefresh])

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {currentLocale === "en" ? "Inbox" : "收件箱"}
          </h2>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Spinner size="lg" color="primary" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              {currentLocale === "en" ? "Loading emails..." : "正在加载邮件..."}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {currentLocale === "en" ? "Inbox" : "收件箱"}
          </h2>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-red-500 font-medium">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {currentLocale === "en" ? "Inbox" : "收件箱"}
          </h2>
        </div>
        <div className="flex flex-col justify-center items-center h-64 text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {currentLocale === "en" ? "Inbox is empty" : "收件箱为空"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md">
            {currentLocale === "en"
              ? "You haven't received any emails yet. When you do, they'll show up here as beautiful cards."
              : "您还没有收到任何邮件。当您收到邮件时，它们将以精美的卡片形式显示在这里。"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-full w-full overflow-y-auto ${isMobile ? 'p-2' : 'p-4'}`}>
      <div className={`${isMobile ? 'mb-4' : 'mb-6'} w-full`}>
        <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-800 dark:text-gray-100`}>
          {currentLocale === "en" ? "Inbox" : "收件箱"}
        </h2>
        {/* 状态指示器 */}
        <div className={`flex items-center gap-2 text-xs text-gray-500 ${isMobile ? 'mt-1' : 'mt-2'} ${isMobile ? 'flex-wrap' : ''}`}>
          <div className={`w-2 h-2 rounded-full ${
            smartChecker.isUsingMercure ? 'bg-green-500 animate-pulse' :
            smartChecker.isUsingPolling ? 'bg-yellow-500' :
            smartChecker.mercureAttempted ? 'bg-red-500' : 'bg-gray-400'
          }`} />
          <span className={isMobile ? 'text-xs' : ''}>
            {smartChecker.isUsingMercure ? (isMobile ? '🚀 实时连接' : '🚀 实时连接 (Mercure SSE)') :
             smartChecker.isUsingPolling ? (isMobile ? '🔄 轮询模式' : '🔄 轮询模式 (30秒间隔)') :
             smartChecker.mercureAttempted ?
               (isEnabled ? (isMobile ? '❌ 实时失败，轮询可用' : '❌ 实时失败，轮询可用') : (isMobile ? '❌ 实时失败，轮询已禁用' : '❌ 实时失败，轮询已禁用')) :
               '⏳ 连接中...'}
          </span>
          <span className="text-xs text-gray-400 ml-2">
            邮件数: {messages.length}
          </span>
          {smartChecker.mercureAttempted && !smartChecker.isUsingMercure && !isEnabled && (
            <span className="text-xs text-red-500 ml-2">
              (备用策略已禁用)
            </span>
          )}
        </div>
      </div>
      <div className={`${isMobile ? 'space-y-2' : 'space-y-4'} w-full`}>
        {messages.map((message) => (
          <Card
            key={message.id}
            isPressable
            onPress={() => onSelectMessage(message)}
            className={`w-full transition-all duration-300 cursor-pointer ${
              !message.seen
                ? "border-l-4 border-l-primary-500 border-t border-r border-b border-primary-200 dark:border-primary-800 bg-gradient-to-r from-primary-50/80 to-primary-50/40 dark:from-primary-900/30 dark:to-primary-900/10 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg hover:scale-[1.01]"
            }`}
          >
            <CardBody className={`${isMobile ? 'p-3' : 'p-5'} w-full`}>
              <div className={`flex items-start ${isMobile ? 'space-x-3' : 'space-x-4'} w-full`}>
                {/* 头像 */}
                <div className="relative">
                  <Avatar
                    name={message.from.name
                      ? message.from.name.charAt(0).toUpperCase()
                      : message.from.address.charAt(0).toUpperCase()}
                    className={`flex-shrink-0 font-semibold ${
                      !message.seen
                        ? "bg-primary-500 text-white shadow-lg"
                        : "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                    }`}
                    size={isMobile ? "md" : "lg"}
                  />
                  {/* 未读标识 */}
                  {!message.seen && (
                    <div className={`absolute -top-1 -right-1 ${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} bg-primary-500 border-2 border-white dark:border-gray-800 rounded-full`}></div>
                  )}
                </div>

                {/* 邮件内容 */}
                <div className="flex-1 min-w-0">
                  <div className={`flex items-start justify-between ${isMobile ? 'mb-1' : 'mb-2'}`}>
                    <div className="flex-1 min-w-0">
                      <h3 className={`${isMobile ? 'text-sm' : 'text-base'} truncate ${
                        !message.seen
                          ? "font-bold text-gray-900 dark:text-white"
                          : "font-semibold text-gray-700 dark:text-gray-300"
                      }`}>
                        {message.from.name || message.from.address}
                      </h3>
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} truncate ${isMobile ? 'mt-0.5' : 'mt-1'} ${
                        !message.seen
                          ? "font-semibold text-gray-800 dark:text-gray-200"
                          : "font-medium text-gray-600 dark:text-gray-400"
                      }`}>
                        {message.subject}
                      </p>
                    </div>
                    <div className={`flex flex-col items-end ${isMobile ? 'ml-2' : 'ml-3'}`}>
                      <span className={`${isMobile ? 'text-xs' : 'text-xs'} flex-shrink-0 ${
                        !message.seen
                          ? "text-primary-600 dark:text-primary-400 font-medium"
                          : "text-gray-500 dark:text-gray-400"
                      }`}>
                        {formatDistanceToNow(new Date(message.createdAt), {
                          addSuffix: true,
                          locale: currentLocale === "en" ? enUS : zhCN,
                        })}
                      </span>
                      {!message.seen && (
                        <div className={`${isMobile ? 'mt-0.5 px-1.5 py-0.5' : 'mt-1 px-2 py-0.5'} bg-primary-500 text-white text-xs rounded-full font-medium`}>
                          {currentLocale === "en" ? "New" : "新"}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} leading-relaxed line-clamp-2 ${
                    !message.seen
                      ? "text-gray-700 dark:text-gray-300"
                      : "text-gray-500 dark:text-gray-400"
                  }`}>
                    {message.intro}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}