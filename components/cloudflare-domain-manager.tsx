"use client"

import { useState, useEffect } from "react"
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal"
import { Button } from "@heroui/button"
import { Input } from "@heroui/input"
import { Select, SelectItem } from "@heroui/select"
import { Card, CardBody, CardHeader } from "@heroui/card"
import { Badge } from "@/components/ui/badge"
import { Alert } from "@/components/ui/alert"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell
} from "@/components/ui/table"
import { 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Plus, 
  Trash2, 
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  MoreHorizontal,
  Wrench
} from "lucide-react"
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown"
import { useHeroUIToast } from "@/hooks/use-heroui-toast"
import { useApiProvider } from "@/contexts/api-provider-context"

interface CloudflareAccount {
  id: string
  name: string
  type: string
  zones: {
    id: string
    name: string
    status: string
    plan: string
  }[]
}

interface DomainStatus {
  domain: string
  zoneId?: string
  zoneFound: boolean
  emailRoutingEnabled: boolean | null
  catchAllRuleExists: boolean | null
  status: 'ok' | 'warning' | 'error'
  error?: string
}

interface WorkerStatus {
  scriptName: string
  workerUrl: string
  isHealthy: boolean
  mailDomain: string
  domains: string[]
}

interface DomainManagerProps {
  isOpen: boolean
  onClose: () => void
  currentLocale: string
}

export function CloudflareDomainManager({ isOpen, onClose, currentLocale }: DomainManagerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<CloudflareAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [scriptName, setScriptName] = useState('')
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null)
  const [domainStatuses, setDomainStatuses] = useState<DomainStatus[]>([])
  const [newDomain, setNewDomain] = useState('')

  const { toast } = useHeroUIToast()
  const { addCustomProvider } = useApiProvider()
  const isZh = currentLocale !== "en"

  // Load accounts and auto-config on open
  useEffect(() => {
    if (isOpen) {
      loadAccountsAndAutoConfig()
    }
  }, [isOpen])

  const loadAccountsAndAutoConfig = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Load accounts first
      const accountsResponse = await fetch('/api/cf/accounts')
      const accountsData = await accountsResponse.json()
      
      if (!accountsData.success) {
        throw new Error(accountsData.error || 'Failed to load accounts')
      }
      
      setAccounts(accountsData.accounts)

      // Try to detect existing configuration
      try {
        const detectResponse = await fetch('/api/cf/detect-existing')
        const detectData = await detectResponse.json()
        
        if (detectData.success && detectData.workerInfo) {
          const { workerInfo } = detectData
          console.log('[DomainManager] Auto-loading config:', workerInfo)
          
          // Set script name from detected config
          setScriptName(workerInfo.scriptName || '')
          
          // Try to find matching account by checking if worker exists in any account
          if (accountsData.accounts.length > 0) {
            // For now, use first account - in future we could check all accounts for the worker
            const firstAccount = accountsData.accounts[0]
            setSelectedAccountId(firstAccount.id)
            console.log('[DomainManager] Auto-selected account:', firstAccount.name)
          }
          
          // Auto-load status if we have both account and script name
          if (workerInfo.scriptName && accountsData.accounts.length > 0) {
            setTimeout(() => {
              loadWorkerStatusWithConfig(accountsData.accounts[0].id, workerInfo.scriptName)
            }, 500)
          }
        }
      } catch (detectErr) {
        console.log('[DomainManager] No auto-config available:', detectErr)
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const loadWorkerStatusWithConfig = async (accountId: string, workerName: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/cf/status?accountId=${accountId}&scriptName=${workerName}`)
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load worker status')
      }
      
      setWorkerStatus(data.worker)
      setDomainStatuses(data.domains)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load worker status')
    } finally {
      setLoading(false)
    }
  }

  const loadWorkerStatus = async () => {
    if (!selectedAccountId || !scriptName) return
    return loadWorkerStatusWithConfig(selectedAccountId, scriptName)
  }

  const handleAddDomain = async () => {
    if (!newDomain || !selectedAccountId || !scriptName) return

    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/cf/add-domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: newDomain,
          accountId: selectedAccountId,
          scriptName
        })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to add domain')
      }
      
      toast({
        title: isZh ? "域名已添加" : "Domain Added",
        description: isZh ? `域名 ${newDomain} 已成功添加` : `Domain ${newDomain} added successfully`,
        color: "success",
        variant: "flat",
      })
      
      setNewDomain('')
      loadWorkerStatus() // Refresh status
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add domain')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveDomain = async (domain: string) => {
    if (!selectedAccountId || !scriptName) return

    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/cf/remove-domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain,
          accountId: selectedAccountId,
          scriptName
        })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove domain')
      }
      
      toast({
        title: isZh ? "域名已移除" : "Domain Removed",
        description: isZh ? `域名 ${domain} 已成功移除` : `Domain ${domain} removed successfully`,
        color: "success",
        variant: "flat",
      })
      
      loadWorkerStatus() // Refresh status
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove domain')
    } finally {
      setLoading(false)
    }
  }

  const handleEnsureCatchAll = async (domain: string) => {
    if (!selectedAccountId || !scriptName) return
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/cf/ensure-catchall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, accountId: selectedAccountId, scriptName })
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to ensure catch-all')
      }
      toast({
        title: isZh ? '已修复路由' : 'Routing Fixed',
        description: isZh ? `域名 ${domain} 的邮件路由规则已更新` : `Email routing for ${domain} is ensured`,
        color: 'success',
        variant: 'flat'
      })
      loadWorkerStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ensure catch-all')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAsProvider = () => {
    if (!workerStatus) return
    
    const providerId = `cloudflare-${Date.now()}`
    addCustomProvider({
      id: providerId,
      name: `Cloudflare (${workerStatus.scriptName})`,
      baseUrl: workerStatus.workerUrl,
      mercureUrl: "",
      isCustom: true
    })
    
    toast({
      title: isZh ? "提供商已添加" : "Provider Added",
      description: isZh ? "Worker 已成功添加为提供商" : "Worker successfully added as provider",
      color: "success",
      variant: "flat",
    })
  }

  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId)
  const availableDomains = selectedAccount?.zones.map(zone => zone.name) || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'success'
      case 'warning': return 'warning'
      case 'error': return 'danger'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'error': return <AlertCircle className="h-4 w-4" />
      default: return null
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="lg"
      scrollBehavior="outside"
    >
      <ModalContent>
        <ModalHeader className="py-3">
          <span className="text-base font-semibold">{isZh ? 'Cloudflare 域名管理' : 'Cloudflare Domain Manager'}</span>
        </ModalHeader>

        <ModalBody className="pt-2">
          {error && (
            <Alert variant="destructive" className="mb-3 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </Alert>
          )}

          {/* Worker Selection */}
          <Card className="mb-3">
            <CardHeader className="py-2">
              <h3 className="text-base font-semibold">
                {isZh ? 'Worker 配置' : 'Worker Configuration'}
              </h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  size="sm"
                  label={isZh ? "选择 Cloudflare 账户" : "Select Cloudflare Account"}
                  placeholder={isZh ? "选择一个账户" : "Choose an account"}
                  selectedKeys={selectedAccountId ? [selectedAccountId] : []}
                  onSelectionChange={(keys) => {
                    const accountId = Array.from(keys)[0] as string
                    setSelectedAccountId(accountId)
                    setWorkerStatus(null)
                    setDomainStatuses([])
                  }}
                >
                  {accounts.map((account) => (
                    <SelectItem key={account.id} textValue={account.name}>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{account.name}</span>
                        <span className="text-xs text-gray-500">{account.type}</span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
                
                <Input
                  size="sm"
                  label={isZh ? "Worker 脚本名称" : "Worker Script Name"}
                  value={scriptName}
                  onValueChange={setScriptName}
                  placeholder="duckmail-worker"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  color="primary"
                  onPress={loadWorkerStatus}
                  isLoading={loading}
                  isDisabled={!selectedAccountId || !scriptName}
                  startContent={!loading && <RefreshCw className="h-4 w-4" />}
                >
                  {isZh ? '加载状态' : 'Load Status'}
                </Button>
                
                {workerStatus && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => window.open(workerStatus.workerUrl, '_blank')}
                    startContent={<ExternalLink className="h-4 w-4" />}
                  >
                    {isZh ? '打开 Worker' : 'Open Worker'}
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Worker Status */}
          {workerStatus && (
            <Card className="mb-3">
              <CardHeader className="py-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">
                    {isZh ? 'Worker 状态' : 'Worker Status'}
                  </h3>
                  <Badge 
                    color={workerStatus.isHealthy ? 'success' : 'danger'}
                    variant="outline"
                  >
                    {workerStatus.isHealthy ? (isZh ? '健康' : 'Healthy') : (isZh ? '不健康' : 'Unhealthy')}
                  </Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Worker URL:</label>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded block mt-1">
                      {workerStatus.workerUrl}
                    </code>
                  </div>
                  <div>
                    <label className="text-xs font-medium">
                      {isZh ? '配置的域名:' : 'Configured Domains:'}
                    </label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {workerStatus.domains.map((domain) => (
                        <Badge key={domain} variant="outline" className="text-[11px]">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Domain Management */}
          {workerStatus && (
            <Card>
              <CardHeader className="py-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-sm font-medium">
                    {isZh ? '域名管理' : 'Domain Management'}
                  </h3>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <Select
                      size="sm"
                      label={isZh ? "选择域名" : "Select Domain"}
                      placeholder={isZh ? "选择一个域名" : "Choose a domain"}
                      selectedKeys={newDomain ? [newDomain] : []}
                      onSelectionChange={(keys) => {
                        const domain = Array.from(keys)[0] as string
                        setNewDomain(domain)
                      }}
                      className="min-w-[220px]"
                    >
                      {(availableDomains
                        .filter(domain => !workerStatus?.domains.includes(domain))
                      ).map((domain) => (
                        <SelectItem key={domain} textValue={domain}>
                          <span className="text-sm">{domain}</span>
                        </SelectItem>
                      ))}
                    </Select>
                    <Button 
                      size="sm"
                      color="primary"
                      onPress={handleAddDomain}
                      isLoading={loading}
                      isDisabled={!newDomain}
                      startContent={!loading && <Plus className="h-4 w-4" />}
                    >
                      {isZh ? '添加域名' : 'Add Domain'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                {domainStatuses.length > 0 ? (
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableCell>{isZh ? '域名' : 'Domain'}</TableCell>
                        <TableCell>{isZh ? '状态' : 'Status'}</TableCell>
                        <TableCell>{isZh ? '邮件路由' : 'Email Routing'}</TableCell>
                        <TableCell>{isZh ? '转发规则' : 'Catch-all Rule'}</TableCell>
                        <TableCell>{isZh ? '操作' : 'Actions'}</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {domainStatuses.map((domainStatus) => (
                        <TableRow key={domainStatus.domain}>
                          <TableCell className="font-mono text-xs">
                            {domainStatus.domain}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(domainStatus.status)}
                              <Badge color={getStatusColor(domainStatus.status)}>
                                {domainStatus.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {domainStatus.emailRoutingEnabled === null ? (
                              <Badge color="default" variant="outline">
                                {isZh ? '未知' : 'Unknown'}
                              </Badge>
                            ) : (
                              <Badge 
                                color={domainStatus.emailRoutingEnabled ? 'success' : 'danger'}
                                variant="outline"
                              >
                                {domainStatus.emailRoutingEnabled ? (isZh ? '已启用' : 'Enabled') : (isZh ? '未启用' : 'Disabled')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {domainStatus.catchAllRuleExists === null ? (
                              <Badge color="default" variant="outline">
                                {isZh ? '未知' : 'Unknown'}
                              </Badge>
                            ) : (
                              <Badge 
                                color={domainStatus.catchAllRuleExists ? 'success' : 'danger'}
                                variant="outline"
                              >
                                {domainStatus.catchAllRuleExists ? (isZh ? '存在' : 'Exists') : (isZh ? '缺失' : 'Missing')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button isIconOnly size="sm" variant="light">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu aria-label="Domain actions">
                                <DropdownItem
                                  key="fix-routing"
                                  startContent={<Wrench className="h-4 w-4" />}
                                  onPress={() => handleEnsureCatchAll(domainStatus.domain)}
                                >
                                  {isZh ? '修复路由' : 'Fix Routing'}
                                </DropdownItem>
                                <DropdownItem
                                  key="remove"
                                  className="text-danger"
                                  color="danger"
                                  startContent={<Trash2 className="h-4 w-4" />}
                                  onPress={() => handleRemoveDomain(domainStatus.domain)}
                                >
                                  {isZh ? '删除域名' : 'Remove Domain'}
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    {isZh ? '没有配置的域名' : 'No configured domains'}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </ModalBody>

        <ModalFooter className="py-3">
          <Button size="sm" variant="ghost" onPress={onClose}>
            {isZh ? '关闭' : 'Close'}
          </Button>
          {workerStatus && (
            <Button
              size="sm"
              color="primary"
              onPress={handleAddAsProvider}
            >
              {isZh ? '添加为提供商' : 'Add as Provider'}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
} 