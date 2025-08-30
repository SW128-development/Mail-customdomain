"use client"

import { useState, useEffect } from "react"
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal"
import { Button } from "@heroui/button"
import { Input } from "@heroui/input"
import { Select, SelectItem } from "@heroui/select"
import { Card, CardBody, CardHeader } from "@heroui/card"
import { Progress } from "@heroui/react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react"
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

interface SetupWizardProps {
  isOpen: boolean
  onClose: () => void
  currentLocale: string
}

interface SetupResult {
  workerUrl: string
  scriptName: string
  d1: {
    name: string
    databaseId: string
  }
  domains: string[]
  jwtToken: string
}

enum SetupStep {
  CONNECT = 'connect',
  SELECT_ACCOUNT = 'select_account',
  DATABASE = 'database',
  WORKER = 'worker',
  EMAIL_ROUTING = 'email_routing',
  VERIFICATION = 'verification',
  COMPLETE = 'complete'
}

export function CloudflareSetupWizard({ isOpen, onClose, currentLocale }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>(SetupStep.CONNECT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<CloudflareAccount[]>([])
  
  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [scriptName, setScriptName] = useState('duckmail-worker')
  const [d1Name, setD1Name] = useState('temp_mail_db')
  const [jwtToken, setJwtToken] = useState('')
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null)

  const { toast } = useHeroUIToast()
  const { addCustomProvider } = useApiProvider()
  const isZh = currentLocale !== "en"

  const stepTitles = {
    [SetupStep.CONNECT]: isZh ? '连接 Cloudflare' : 'Connect Cloudflare',
    [SetupStep.SELECT_ACCOUNT]: isZh ? '选择账户和域名' : 'Select Account & Domains',
    [SetupStep.DATABASE]: isZh ? '数据库配置' : 'Database Setup',
    [SetupStep.WORKER]: isZh ? 'Worker 部署' : 'Worker Deployment',
    [SetupStep.EMAIL_ROUTING]: isZh ? '邮件路由' : 'Email Routing',
    [SetupStep.VERIFICATION]: isZh ? '验证' : 'Verification',
    [SetupStep.COMPLETE]: isZh ? '完成' : 'Complete'
  }

  const stepOrder = [
    SetupStep.CONNECT,
    SetupStep.SELECT_ACCOUNT,
    SetupStep.DATABASE,
    SetupStep.WORKER,
    SetupStep.EMAIL_ROUTING,
    SetupStep.VERIFICATION,
    SetupStep.COMPLETE
  ]

  const currentStepIndex = stepOrder.indexOf(currentStep)
  const progressPercentage = ((currentStepIndex + 1) / stepOrder.length) * 100

  // Load accounts on mount
  useEffect(() => {
    if (isOpen && currentStep === SetupStep.CONNECT) {
      runPreflight()
    }
  }, [isOpen, currentStep])

  const runPreflight = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/cf/preflight')
      const data = await res.json()
      if (data.success && data.isApiTokenConfigured) {
        await loadAccounts()
      } else {
        // stay on connect step and prompt user
        setCurrentStep(SetupStep.CONNECT)
      }
    } catch (e) {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }

  const connectWithToken = async (token: string) => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/cf/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      const data = await res.json()
      if (!data.success) throw new Error('Failed to save token')
      await loadAccounts()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connect failed')
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/cf/accounts')
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load accounts')
      }
      
      setAccounts(data.accounts)
      if (data.accounts.length > 0) {
        setCurrentStep(SetupStep.SELECT_ACCOUNT)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async () => {
    if (!selectedAccountId || selectedZones.length === 0) {
      setError(isZh ? '请选择账户和至少一个域名' : 'Please select an account and at least one domain')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setCurrentStep(SetupStep.DATABASE)
      
      const response = await fetch('/api/cf/setup-initial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          scriptName,
          domains: selectedZones,
          d1Name,
          jwtToken: jwtToken || undefined
        })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Setup failed')
      }
      
      setSetupResult(result)
      
      // Progress through steps
      setCurrentStep(SetupStep.WORKER)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setCurrentStep(SetupStep.EMAIL_ROUTING)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setCurrentStep(SetupStep.VERIFICATION)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setCurrentStep(SetupStep.COMPLETE)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAddProvider = () => {
    if (!setupResult) return
    
    const providerId = `cloudflare-${Date.now()}`
    addCustomProvider({
      id: providerId,
      name: `Cloudflare (${setupResult.scriptName})`,
      baseUrl: setupResult.workerUrl,
      mercureUrl: "",
      isCustom: true
    })
    
    toast({
      title: isZh ? "提供商已添加" : "Provider Added",
      description: isZh ? "Cloudflare Worker 已成功添加为提供商" : "Cloudflare Worker successfully added as provider",
      color: "success",
      variant: "flat",
    })
    
    onClose()
  }

  const resetWizard = () => {
    setCurrentStep(SetupStep.CONNECT)
    setError(null)
    setSetupResult(null)
    setSelectedAccountId('')
    setSelectedZones([])
    setScriptName('duckmail-worker')
    setD1Name('temp_mail_db')
    setJwtToken('')
  }

  const handleClose = () => {
    resetWizard()
    onClose()
  }

  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId)
  const availableZones = selectedAccount?.zones || []

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      size="2xl"
      scrollBehavior="inside"
      isDismissable={!loading}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-2">
          <div className="flex items-center justify-between w-full">
            <span>{stepTitles[currentStep]}</span>
            <Badge variant="outline">
              {currentStepIndex + 1} / {stepOrder.length}
            </Badge>
          </div>
          <Progress 
            value={progressPercentage} 
            className="w-full"
            color="primary"
            size="sm"
          />
        </ModalHeader>

        <ModalBody>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </Alert>
          )}

          {/* Step 1: Connect Cloudflare */}
          {currentStep === SetupStep.CONNECT && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">
                    {isZh ? 'Cloudflare 配置' : 'Cloudflare Configuration'}
                  </h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      {isZh ? '配置说明' : 'Configuration Instructions'}
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
                      <li>
                        {isZh 
                          ? '确保已在环境变量中设置 CLOUDFLARE_API_TOKEN'
                          : 'Ensure CLOUDFLARE_API_TOKEN is set in environment variables'
                        }
                      </li>
                      <li>
                        {isZh 
                          ? 'API Token 需要以下权限：Zone:Read, Zone:Edit, Workers:Edit, D1:Edit'
                          : 'API Token needs: Zone:Read, Zone:Edit, Workers:Edit, D1:Edit permissions'
                        }
                      </li>
                      <li>
                        <a 
                          href="https://dash.cloudflare.com/profile/api-tokens" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          {isZh ? '创建 API Token' : 'Create API Token'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                    </ol>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {isZh 
                        ? '正在验证 Cloudflare API 访问权限并加载您的账户信息...'
                        : 'Validating Cloudflare API access and loading your account information...'
                      }
                    </p>
                    <Button
                      color="primary"
                      variant="flat"
                      onPress={() => {
                        // allow manual retry
                        runPreflight()
                      }}
                      isLoading={loading}
                    >
                      {isZh ? '重新尝试' : 'Retry'}
                    </Button>
                  </div>
                  {loading && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">
                        {isZh ? '正在连接...' : 'Connecting...'}
                      </span>
                    </div>
                  )}
                  {error && error.includes('not configured') && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <div className="space-y-2">
                        <p className="font-medium">
                          {isZh ? 'API Token 未配置' : 'API Token Not Configured'}
                        </p>
                        <p className="text-sm">
                          {isZh 
                            ? '请在服务器环境变量中设置 CLOUDFLARE_API_TOKEN'
                            : 'Please set CLOUDFLARE_API_TOKEN in server environment variables'
                          }
                        </p>
                      </div>
                    </Alert>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {/* Step 2: Select Account & Zones */}
          {currentStep === SetupStep.SELECT_ACCOUNT && (
            <div className="space-y-4">
              <div>
                <Select
                  label={isZh ? "选择 Cloudflare 账户" : "Select Cloudflare Account"}
                  placeholder={isZh ? "选择一个账户" : "Choose an account"}
                  selectedKeys={selectedAccountId ? [selectedAccountId] : []}
                  onSelectionChange={(keys) => {
                    const accountId = Array.from(keys)[0] as string
                    setSelectedAccountId(accountId)
                    setSelectedZones([])
                  }}
                >
                  {accounts.map((account) => (
                    <SelectItem key={account.id} textValue={account.name}>
                      <div className="flex flex-col">
                        <span className="font-medium">{account.name}</span>
                        <span className="text-sm text-gray-500">{account.type}</span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {selectedAccount && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {isZh ? "选择域名 (Zones)" : "Select Domains (Zones)"}
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {availableZones.map((zone) => (
                      <Card 
                        key={zone.id} 
                        className={`cursor-pointer border ${
                          selectedZones.includes(zone.name) 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        isPressable
                        onPress={() => {
                          setSelectedZones(prev => 
                            prev.includes(zone.name)
                              ? prev.filter(z => z !== zone.name)
                              : [...prev, zone.name]
                          )
                        }}
                      >
                        <CardBody className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{zone.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant={zone.status === 'active' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {zone.status}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {zone.plan}
                                </Badge>
                              </div>
                            </div>
                            {selectedZones.includes(zone.name) && (
                              <CheckCircle className="h-5 w-5 text-blue-500" />
                            )}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Database Configuration */}
          {currentStep === SetupStep.DATABASE && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">
                    {isZh ? 'D1 数据库配置' : 'D1 Database Configuration'}
                  </h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <Input
                    label={isZh ? "数据库名称" : "Database Name"}
                    value={d1Name}
                    onValueChange={setD1Name}
                    placeholder="temp_mail_db"
                  />
                  <p className="text-sm text-gray-600">
                    {isZh 
                      ? '如果数据库已存在，将会重用现有数据库。'
                      : 'If the database already exists, it will be reused.'
                    }
                  </p>
                  {loading && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">
                        {isZh ? '正在创建/验证数据库...' : 'Creating/verifying database...'}
                      </span>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {/* Step 4: Worker Deployment */}
          {currentStep === SetupStep.WORKER && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">
                    {isZh ? 'Worker 部署' : 'Worker Deployment'}
                  </h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <Input
                    label={isZh ? "Worker 脚本名称" : "Worker Script Name"}
                    value={scriptName}
                    onValueChange={setScriptName}
                    placeholder="duckmail-worker"
                  />
                  <Input
                    label={isZh ? "JWT 密钥 (可选)" : "JWT Token (Optional)"}
                    value={jwtToken}
                    onValueChange={setJwtToken}
                    placeholder={isZh ? "留空将自动生成" : "Leave empty to auto-generate"}
                    type="password"
                  />
                  {loading && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">
                        {isZh ? '正在部署 Worker...' : 'Deploying Worker...'}
                      </span>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {/* Step 5: Email Routing */}
          {currentStep === SetupStep.EMAIL_ROUTING && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">
                    {isZh ? '邮件路由配置' : 'Email Routing Setup'}
                  </h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <p className="text-sm text-gray-600">
                    {isZh 
                      ? '正在为选定的域名启用邮件路由并创建转发规则...'
                      : 'Enabling email routing and creating forwarding rules for selected domains...'
                    }
                  </p>
                  {selectedZones.map((zone) => (
                    <div key={zone} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{zone}</span>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">
                        {isZh ? '正在配置邮件路由...' : 'Configuring email routing...'}
                      </span>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {/* Step 6: Verification */}
          {currentStep === SetupStep.VERIFICATION && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">
                    {isZh ? '验证配置' : 'Verifying Configuration'}
                  </h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <p className="text-sm text-gray-600">
                    {isZh 
                      ? '正在验证 Worker 部署和邮件路由配置...'
                      : 'Verifying Worker deployment and email routing configuration...'
                    }
                  </p>
                  {loading && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">
                        {isZh ? '正在验证...' : 'Verifying...'}
                      </span>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {/* Step 7: Complete */}
          {currentStep === SetupStep.COMPLETE && setupResult && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <span>
                  {isZh ? '设置成功完成！' : 'Setup completed successfully!'}
                </span>
              </Alert>
              
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">
                    {isZh ? '部署详情' : 'Deployment Details'}
                  </h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Worker URL:</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {setupResult.workerUrl}
                      </code>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={() => window.open(setupResult.workerUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">
                      {isZh ? '配置的域名:' : 'Configured Domains:'}
                    </label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {setupResult.domains.map((domain) => (
                        <Badge key={domain} variant="outline">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">
                      {isZh ? '数据库 ID:' : 'Database ID:'}
                    </label>
                    <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded block mt-1">
                      {setupResult.d1.databaseId}
                    </code>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <div className="flex justify-between w-full">
            <Button 
              variant="ghost" 
              onPress={handleClose}
              isDisabled={loading}
            >
              {currentStep === SetupStep.COMPLETE ? (isZh ? '关闭' : 'Close') : (isZh ? '取消' : 'Cancel')}
            </Button>
            
            <div className="flex gap-2">
              {currentStep === SetupStep.CONNECT && (
                <Button
                  color="primary"
                  onPress={() => {
                    const token = prompt(isZh ? '请输入您的 Cloudflare API Token:' : 'Please enter your Cloudflare API Token:');
                    if (token) {
                      connectWithToken(token);
                    }
                  }}
                  isLoading={loading}
                >
                  {isZh ? '连接 Cloudflare' : 'Connect Cloudflare'}
                </Button>
              )}
              
              {currentStep === SetupStep.SELECT_ACCOUNT && (
                <Button
                  color="primary"
                  onPress={handleSetup}
                  isLoading={loading}
                  isDisabled={!selectedAccountId || selectedZones.length === 0}
                >
                  {isZh ? '开始部署' : 'Start Deployment'}
                </Button>
              )}
              
              {currentStep === SetupStep.COMPLETE && (
                <Button
                  color="primary"
                  onPress={handleAddProvider}
                >
                  {isZh ? '添加为提供商' : 'Add as Provider'}
                </Button>
              )}
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
} 