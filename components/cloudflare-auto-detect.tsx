"use client"

import { useState, useEffect } from "react"
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal"
import { Button } from "@heroui/button"
import { Input } from "@heroui/input"
import { Card, CardBody, CardHeader } from "@heroui/card"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, Loader2, Plus, Settings } from "lucide-react"
import { useHeroUIToast } from "@/hooks/use-heroui-toast"
import { useApiProvider } from "@/contexts/api-provider-context"

interface AutoDetectProps {
  isOpen: boolean
  onClose: () => void
  currentLocale: string
  onOpenDomainManager?: () => void
}

interface ExistingWorkerInfo {
  workerUrl: string
  scriptName: string
  databaseId: string
  domains: string[]
  jwtTokenConfigured: boolean
  apiTokenConfigured: boolean
}

export function CloudflareAutoDetect({ isOpen, onClose, currentLocale, onOpenDomainManager }: AutoDetectProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workerInfo, setWorkerInfo] = useState<ExistingWorkerInfo | null>(null)
  const [checking, setChecking] = useState(false)

  const [editWorkerUrl, setEditWorkerUrl] = useState('')
  const [editScriptName, setEditScriptName] = useState('')

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

      const response = await fetch('/api/cf/detect-existing')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to detect existing setup')
      }

      if (data.workerInfo) {
        const info = { ...data.workerInfo }
        setWorkerInfo(info)
        setEditWorkerUrl(info.workerUrl || '')
        setEditScriptName(info.scriptName || '')
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
    if (!editWorkerUrl) {
      setError(isZh ? 'Worker URL 不能为空' : 'Worker URL is required')
      return
    }

    try {
      setLoading(true)

      const providerId = `cloudflare-existing-${Date.now()}`
      const providerName = editScriptName || 'Cloudflare Worker'
      addCustomProvider({
        id: providerId,
        name: `Cloudflare (${providerName})`,
        baseUrl: editWorkerUrl,
        mercureUrl: "",
        isCustom: true
      })

      toast({
        title: isZh ? "提供商已添加" : "Provider Added",
        description: isZh
          ? `已成功添加 Cloudflare Worker: ${editWorkerUrl}`
          : `Successfully added Cloudflare Worker: ${editWorkerUrl}`,
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

  const handleManageDomains = () => {
    onClose()
    onOpenDomainManager?.()
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
                <CardBody className="space-y-4">
                  <Input
                    label="Worker URL"
                    value={editWorkerUrl}
                    onValueChange={setEditWorkerUrl}
                    placeholder="https://my-worker.username.workers.dev"
                    description={isZh
                      ? '可以修改为其他 Worker 地址'
                      : 'You can change this to a different Worker URL'
                    }
                  />

                  <Input
                    label={isZh ? "Worker 脚本名称" : "Worker Script Name"}
                    value={editScriptName}
                    onValueChange={setEditScriptName}
                    placeholder="duckmail-cloudflare-provider"
                    description={isZh
                      ? '用于域名管理时识别 Worker'
                      : 'Used to identify the Worker for domain management'
                    }
                  />

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {isZh ? '配置状态:' : 'Configuration Status:'}
                    </span>
                    <div className="flex gap-2 flex-wrap">
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

                  {workerInfo.domains.length > 0 && (
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
                  )}
                </CardBody>
              </Card>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {isZh ? '取消' : 'Cancel'}
          </Button>
          <div className="flex gap-2">
            {workerInfo && onOpenDomainManager && workerInfo.apiTokenConfigured && (
              <Button
                variant="flat"
                onPress={handleManageDomains}
                startContent={<Settings className="h-4 w-4" />}
              >
                {isZh ? '管理域名' : 'Manage Domains'}
              </Button>
            )}
            {(workerInfo || editWorkerUrl) && (
              <Button
                color="primary"
                onPress={handleAddAsProvider}
                isLoading={loading}
                isDisabled={!editWorkerUrl}
                startContent={!loading && <Plus className="h-4 w-4" />}
              >
                {isZh ? '添加为提供商' : 'Add as Provider'}
              </Button>
            )}
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
