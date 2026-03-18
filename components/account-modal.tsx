"use client"

import { useState } from "react"
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal"
import { Button } from "@heroui/button"
import { Input } from "@heroui/input"

import { useAuth } from "@/contexts/auth-context"
import { DomainSelector } from "@/components/domain-selector"
import { Eye, EyeOff, User, AlertCircle } from "lucide-react"
import { Card, CardBody } from "@heroui/card"

interface AccountModalProps {
  isOpen: boolean
  onClose: () => void
  currentLocale: string
}

export default function AccountModal({ isOpen, onClose, currentLocale }: AccountModalProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [selectedDomain, setSelectedDomain] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [showLoginOption, setShowLoginOption] = useState(false)
  const { register, login } = useAuth()



  const handleSubmit = async () => {
    if (!username || !selectedDomain || !password) {
      setError(currentLocale === "en" ? "Please fill in all required fields" : "请填写所有必填字段")
      return
    }

    setIsLoading(true)
    setError(null)
    setShowLoginOption(false)

    const email = `${username}@${selectedDomain}`

    let providerId: string | undefined
    try {
      const cachedDomains = localStorage.getItem("cached-domains")
      if (cachedDomains) {
        const domains = JSON.parse(cachedDomains)
        const matched = domains.find((d: any) => d.domain === selectedDomain)
        if (matched?.providerId) providerId = matched.providerId
      }
    } catch (_) {}

    try {
      await register(email, password, providerId)
      onClose()
      // 重置表单
      setUsername("")
      setPassword("")
      setError(null)
      setShowLoginOption(false)
    } catch (error: any) {
      console.error("Registration failed:", error)

      // 根据错误类型提供不同的处理
      const errorMessage = error.message || ""

      // 检查是否是邮箱已存在的错误（支持中英文）
      if (errorMessage.includes("该邮箱地址已被使用") ||
          errorMessage.includes("Email address already exists") ||
          errorMessage.includes("already used") ||
          errorMessage.includes("already exists")) {
        // 邮箱已存在，提示用户可以尝试登录
        setError(
          currentLocale === "en"
            ? "This email address is already in use. If this is your account, you can try logging in."
            : "该邮箱地址已被使用。如果这是您的账户，您可以尝试登录。"
        )
        setShowLoginOption(true)
      } else if (errorMessage.includes("请求过于频繁") ||
                 errorMessage.includes("rate limit") ||
                 errorMessage.includes("Too many requests")) {
        // 请求过于频繁
        setError(
          currentLocale === "en"
            ? "Too many requests. Please wait a moment and try again."
            : "请求过于频繁，请稍等片刻后再试。"
        )
        setShowLoginOption(false)
      } else {
        // 其他错误
        setError(errorMessage || (currentLocale === "en" ? "Failed to create account, please try again later" : "创建账户失败，请稍后再试"))
        setShowLoginOption(false)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleTryLogin = async () => {
    if (!username || !selectedDomain || !password) {
      return
    }

    setIsLoading(true)
    setError(null)
    setShowLoginOption(false)

    const email = `${username}@${selectedDomain}`

    try {
      await login(email, password)
      onClose()
      // 重置表单
      setUsername("")
      setPassword("")
      setError(null)
      setShowLoginOption(false)
    } catch (error: any) {
      console.error("Login failed:", error)
      setError(
        currentLocale === "en"
          ? "Login failed. Please check your password or try creating a new account with a different username."
          : "登录失败。请检查您的密码或尝试使用不同的用户名创建新账户。"
      )
      setShowLoginOption(false)
    } finally {
      setIsLoading(false)
    }
  }

  const togglePasswordVisibility = () => setIsPasswordVisible(!isPasswordVisible)

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center" backdrop="blur">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User size={24} className="text-blue-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-center">
            {currentLocale === "en" ? "Create Account" : "创建账户"}
          </h2>
          <p className="text-sm text-gray-500 text-center">
            {currentLocale === "en"
              ? "Here you can create a new account. You need to choose a username and set a password!"
              : "在这里，你可以创建一个新的账户为止，你需要选择一个用户名，然后填写密码！"
            }
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {currentLocale === "en" ? "Email" : "电子邮件"}
              </label>
              <div className="space-y-3">
                <Input
                  label={currentLocale === "en" ? "Username" : "用户名"}
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  isDisabled={isLoading}
                />
                <DomainSelector
                  value={selectedDomain}
                  onSelectionChange={setSelectedDomain}
                  currentLocale={currentLocale}
                  isDisabled={isLoading}
                />
              </div>
              {!username && <p className="text-xs text-red-500 mt-1">{currentLocale === "en" ? "Required" : "必填"}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {currentLocale === "en" ? "Password" : "密码"}
              </label>
              <Input
                type={isPasswordVisible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                isDisabled={isLoading}
                endContent={
                  <button type="button" onClick={togglePasswordVisibility} className="focus:outline-none">
                    {isPasswordVisible ? (
                      <EyeOff size={16} className="text-gray-400" />
                    ) : (
                      <Eye size={16} className="text-gray-400" />
                    )}
                  </button>
                }
              />
            </div>

            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <CardBody className="p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                      {currentLocale === "en" ? "Important Notice" : "重要提醒"}
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300">
                      {currentLocale === "en"
                        ? "duckmail.sbs does not provide password recovery. Please remember your password."
                        : "duckmail.sbs 不提供密码找回功能，请务必记住您设置的密码。"
                      }
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {error && (
              <Card className="border-0 shadow-sm">
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <svg className="w-3 h-3 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                        {currentLocale === "en" ? "Account Creation Failed" : "账户创建失败"}
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-300 leading-relaxed">
                        {error}
                      </p>
                      {showLoginOption && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            onPress={handleTryLogin}
                            isLoading={isLoading}
                            startContent={<User size={14} />}
                            className="font-medium"
                          >
                            {currentLocale === "en" ? "Try Login" : "尝试登录"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="bordered" onPress={onClose} isDisabled={isLoading}>
            {currentLocale === "en" ? "Cancel" : "取消"}
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={isLoading}
            isDisabled={!username || !selectedDomain || !password}
          >
            {currentLocale === "en" ? "Create" : "创建"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
