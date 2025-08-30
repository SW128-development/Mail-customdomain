"use client"

import { useState, useEffect } from "react"
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal"
import { Button } from "@heroui/button"
import { Card, CardBody, CardHeader } from "@heroui/card"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, Loader2, Plus } from "lucide-react"
import { useHeroUIToast } from "@/hooks/use-heroui-toast"
import { useApiProvider } from "@/contexts/api-provider-context"

interface AutoDetectProps {
  isOpen: boolean
  onClose: () => void
  currentLocale: string
}

interface ExistingWorkerInfo {
  workerUrl: string
  scriptName: string
  databaseId: string
  domains: string[]
  jwtTokenConfigured: boolean
  apiTokenConfigured: boolean
}

export function CloudflareAutoDetect({ isOpen, onClose, currentLocale }: AutoDetectProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workerInfo, setWorkerInfo] = useState<ExistingWorkerInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const overrideUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL
  
  const { toast } = useHeroUIToast()
  const { addCustomProvider } = useApiProvider()
  const isZh = currentLocale !== "en"

  useEffect(() => {
    if (isOpen) {
      checkExistingSetup()
    }
  }, [isOpen])

  const checkExistingSetup = async () => {
    try {
      setChecking(true)
      setError(null)
      
      // Check for existing setup via API
      const response = await fetch('/api/cf/detect-existing')
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to detect existing setup')
      }
      
      if (data.workerInfo) {
        const info = { ...data.workerInfo }
        if (overrideUrl) {
          info.workerUrl = overrideUrl
        }
        setWorkerInfo(info)
      } else {
        setError(isZh 
          ? '未检测到现有的 Cloudflare Worker 配置' 
          : 'No existing Cloudflare Worker configuration detected'
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed')
    } finally {
      setChecking(false)
    }
  }

  const handleAddAsProvider = async () => {
    if (!workerInfo) return
    
    try {
      setLoading(true)
      
      const providerId = `cloudflare-existing-${Date.now()}`
      addCustomProvider({
        id: providerId,
        name: `Cloudflare (${workerInfo.scriptName || 'Existing Worker'})`,
        baseUrl: workerInfo.workerUrl,
        mercureUrl: "",
        isCustom: true
      })
      
      toast({
        title: isZh ? "提供商已添加" : "Provider Added",
        description: isZh 
          ? `已成功添加 Cloudflare Worker，包含域名: ${workerInfo.domains.join(', ')}`
          : `Successfully added Cloudflare Worker with domains: ${workerInfo.domains.join(', ')}`,
        color: "success",
        variant: "flat",
      })
      
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add provider')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="lg"
      isDismissable={!loading}
    >
      <ModalContent>
        <ModalHeader>
          {isZh ? '检测现有 Cloudflare Worker' : 'Detect Existing Cloudflare Worker'}
        </ModalHeader>

        <ModalBody>
          {checking && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-gray-600">
                {isZh ? '正在检测现有配置...' : 'Detecting existing configuration...'}
              </p>
            </div>
          )}

          {error && !checking && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </Alert>
          )}

          {workerInfo && !checking && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">
                    {isZh ? '检测到现有配置' : 'Existing Configuration Detected'}
                  </h3>
                </CardHeader>
                <CardBody className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {isZh ? 'Worker URL:' : 'Worker URL:'}
                    </span>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {workerInfo.workerUrl}
                    </code>
                  </div>
                  
                  {workerInfo.scriptName && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {isZh ? 'Worker 名称:' : 'Worker Name:'}
                      </span>
                      <span className="text-sm font-medium">{workerInfo.scriptName}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {isZh ? '配置状态:' : 'Configuration Status:'}
                    </span>
                    <div className="flex gap-2">
                      {workerInfo.apiTokenConfigured && (
                        <Badge variant="outline">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          API Token
                        </Badge>
                      )}
                      {workerInfo.jwtTokenConfigured && (
                        <Badge variant="outline">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          JWT Token
                        </Badge>
                      )}
                      {workerInfo.databaseId && (
                        <Badge variant="outline">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          D1 Database
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-600 block mb-2">
                      {isZh ? '配置的域名:' : 'Configured Domains:'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {workerInfo.domains.map((domain) => (
                        <Badge key={domain} variant="outline">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <div>
                  <p className="font-medium">
                    {isZh ? '准备添加提供商' : 'Ready to Add Provider'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {isZh 
                      ? '点击下方按钮将此 Worker 添加为邮件提供商'
                      : 'Click the button below to add this Worker as a mail provider'
                    }
                  </p>
                </div>
              </Alert>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {isZh ? '取消' : 'Cancel'}
          </Button>
          {workerInfo && (
            <Button 
              color="primary" 
              onPress={handleAddAsProvider}
              isLoading={loading}
              startContent={!loading && <Plus className="h-4 w-4" />}
            >
              {isZh ? '添加为提供商' : 'Add as Provider'}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
} 