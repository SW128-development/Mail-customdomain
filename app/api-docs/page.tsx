"use client"

import { useState, useEffect } from "react"
import { Card, CardBody, CardHeader } from "@heroui/card"
import { Button } from "@heroui/button"
import { Chip } from "@heroui/chip"

import { ArrowLeft, Code, ExternalLink, Globe, Shield, Zap, Users, Languages } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ApiDocsPage() {
  const router = useRouter()
  const [currentLocale, setCurrentLocale] = useState("zh")

  useEffect(() => {
    const savedLocale = localStorage.getItem("duckmail-locale") || "zh"
    setCurrentLocale(savedLocale)
  }, [])

  const content = {
    zh: {
      title: "临时邮件 API",
      subtitle: "用于创建临时邮箱账户的 API",
      welcome: "欢迎使用 DuckMail API 文档。",
      apiDescription: "此 API 允许您自动化各种需要邮箱确认的网站注册流程，用于测试目的。",
      usage: "严格禁止将我们的 API 用于非法活动。",
      restrictions: [
        "禁止销售专门使用我们 API 的程序和/或从中获利（例如，创建竞争性临时邮件客户端并收取使用费是不被允许的）。",
        "不允许创建明确利用我们 API 的镜像代理服务（例如，在另一个域名下创建代理服务然后返回 API 结果）。",
        "如果您正在开发使用我们 API 的包装器和/或应用程序，您需要明确提及您正在使用 DuckMail，并包含我们主站的链接，这将受到赞赏并使我们的服务更受欢迎。"
      ],
      accessTitle: "API 访问",
      accessDescription: "完全免费且无限制地提供。",
      quotaLimit: "一般配额限制为每个 IP 地址每秒 8 次查询 (QPS)。",
      noApiKey: "请记住，使用我们的服务不需要 API 密钥。",
      howItWorksTitle: "工作原理",
      howItWorksSteps: [
        "获取我们的域名。",
        "使用我们的域名创建新账户。",
        "仅在您已获得许可的网站上注册。",
        "网站向您指定的地址发送邮件消息。",
        "消息到达我们的 SMTP 服务器，经过处理并添加到数据库。",
        "您向 API 发出请求以获取消息列表。",
        "就是这样。"
      ],
      generalInfoTitle: "一般信息",
      generalInfoDescription: "DuckMail API 规范文档使用 OpenAPI Specification v3 编写。",
      baseUrl: "基础 URL：",
      errorHandlingTitle: "错误处理",
      successfulTitle: "成功",
      successfulDescription: "通常，当响应代码为 200、201 或 204 时，请求是成功的（您也可以检查代码是否在 200 到 204 之间）",
      unsuccessfulTitle: "失败",
      unsuccessfulDescription: "通常，当请求出现错误时，代码在 400 到 430 之间。",
      authenticationTitle: "身份验证",
      authenticationDescription: "要发出任何请求（除了账户创建和 /domains 请求），您需要使用 Bearer token 对请求进行身份验证。",
      authenticationSteps: [
        "您需要向 /token 路径发出 POST 请求。",
        "使用此 token 作为 \"Authorization\":\"Bearer TOKEN\" 在每个请求中！",
        "记住：您应该首先创建账户，然后获取 token！"
      ],
      contributionsTitle: "贡献",
      contributionsDescription: "我们欢迎任何合法的集成来使用我们的服务，请告知我们以添加到列表中。"
    },
    en: {
      title: "Temp Mail API",
      subtitle: "API for creating temporary email accounts",
      welcome: "Welcome to the DuckMail API documentation.",
      apiDescription: "This API allows you to automate the registration process at the various sites which do require email confirmation for testing purposes.",
      usage: "Usage of our API for illegal activity is strictly prohibited.",
      restrictions: [
        "It is forbidden to sell programs and/or earn from it that exclusively uses our API (for example, creating a competing temp mail client and charging for it's usage is not allowed).",
        "Creating a mirror proxy service that explicitly utilizes our API is not allowed (for example, creating a proxy service under another domain name and then returning the results of the API).",
        "If you are developing an wrapper and/or application that utilizes our API, you are required to explicitly mention that you are using DuckMail by including a link to our main site as this would appreacited and make our service more popular."
      ],
      accessTitle: "Access to the API",
      accessDescription: "Available completely free of charge and without restriction.",
      quotaLimit: "The general quota limit is 8 queries per second (QPS) per IP address.",
      noApiKey: "Keep in mind that no API keys are required to use our service.",
      howItWorksTitle: "How it works",
      howItWorksSteps: [
        "Fetch our domain names.",
        "Create a new account by using our domain names.",
        "Sign up only on sites that you have acquired permission to.",
        "The site sends an email message to the address you specify.",
        "A message comes to our SMTP server, processed and added to the database.",
        "You make a request to the API to fetch the message list.",
        "That's it."
      ],
      generalInfoTitle: "General information",
      generalInfoDescription: "The DuckMail API specification documentation is written using the OpenAPI Specification v3.",
      baseUrl: "Base url:",
      errorHandlingTitle: "Error handling",
      successfulTitle: "Successful",
      successfulDescription: "Generally, the request is successful when the response code is 200, 201 or 204 (You could also check if the code is between 200 and 204)",
      unsuccessfulTitle: "Unsuccessful",
      unsuccessfulDescription: "Usually, when the request has an error the code is between 400 and 430.",
      authenticationTitle: "Authentication",
      authenticationDescription: "To make any request (Except for account creation and /domains requests) you need to authenticate the request with a bearer token.",
      authenticationSteps: [
        "You need to make a POST request to the /token path.",
        "Use this token as \"Authorization\":\"Bearer TOKEN\" in every request!",
        "Remember: You should first create the account and then get the token!"
      ],
      contributionsTitle: "Contributions",
      contributionsDescription: "We would appreciate any legal integrations to make usage of our service, please let us know to be added to the list."
    }
  }

  const currentContent = content[currentLocale as keyof typeof content]

  const errorCodes = [
    { 
      code: "400", 
      title: "Bad request", 
      description: currentLocale === "en" 
        ? "Something in your payload is missing! Or, the payload isn't there at all." 
        : "您的负载中缺少某些内容！或者，根本没有负载。" 
    },
    { 
      code: "401", 
      title: "Unauthorized", 
      description: currentLocale === "en" 
        ? "Your token isn't correct (Or the headers hasn't a token at all!). Remember, every request (Except POST /accounts and POST /token) should be authenticated with a Bearer token!" 
        : "您的 token 不正确（或者标头根本没有 token！）。记住，每个请求（除了 POST /accounts 和 POST /token）都应该使用 Bearer token 进行身份验证！" 
    },
    { 
      code: "404", 
      title: "Not found", 
      description: currentLocale === "en" 
        ? "You're trying to access an account that doesn't exist? Or maybe reading a non-existing message? Go check that!" 
        : "您正在尝试访问不存在的账户？或者可能正在读取不存在的消息？去检查一下！" 
    },
    { 
      code: "405", 
      title: "Method not allowed", 
      description: currentLocale === "en" 
        ? "Maybe you're trying to GET a /token or POST a /messages. Check the path you're trying to make a request to and check if the method is the correct one." 
        : "也许您正在尝试 GET /token 或 POST /messages。检查您尝试请求的路径，并检查方法是否正确。" 
    },
    { 
      code: "418", 
      title: "I'm a teapot", 
      description: currentLocale === "en" 
        ? "Who knows? Maybe the server becomes a teapot!" 
        : "谁知道呢？也许服务器变成了茶壶！" 
    },
    { 
      code: "422", 
      title: "Unprocessable entity", 
      description: currentLocale === "en" 
        ? "Some went wrong on your payload. Like, the username of the address while creating the account isn't long enough, or, the account's domain isn't correct. Things like that." 
        : "您的负载出现了问题。比如，创建账户时地址的用户名不够长，或者账户的域名不正确。诸如此类的事情。" 
    },
    { 
      code: "429", 
      title: "Too many requests", 
      description: currentLocale === "en" 
        ? "You exceeded the limit of 8 requests per second! Try delaying the request by one second!" 
        : "您超过了每秒 8 次请求的限制！尝试将请求延迟一秒！" 
    }
  ]



  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 flex justify-between items-center">
          <Button
            variant="light"
            startContent={<ArrowLeft size={16} />}
            onPress={() => router.push("/")}
            className="text-gray-600 dark:text-gray-300"
          >
            {currentLocale === "en" ? "Back" : "返回"}
          </Button>
          
          <Button
            variant="flat"
            startContent={<Languages size={16} />}
            onPress={() => {
              const newLocale = currentLocale === "en" ? "zh" : "en"
              setCurrentLocale(newLocale)
              localStorage.setItem("duckmail-locale", newLocale)
            }}
            className="text-primary-600 dark:text-primary-400"
          >
            {currentLocale === "en" ? "中文" : "English"}
          </Button>
        </div>

        {/* Header */}
        <Card className="shadow-lg mb-8">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                <Code className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {currentContent.title}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {currentContent.subtitle}
                </p>
              </div>
            </div>
          </CardHeader>
          
          <CardBody>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
              {currentContent.welcome}
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {currentContent.apiDescription}
            </p>
            <p className="text-red-600 dark:text-red-400 font-medium mb-4">
              {currentContent.usage}
            </p>
            <ul className="space-y-2">
              {currentContent.restrictions.map((restriction, index) => (
                <li key={index} className="text-gray-700 dark:text-gray-300 text-sm">
                  • {restriction}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {/* Access to API */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Globe className="w-5 h-5 text-green-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {currentContent.accessTitle}
              </h2>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              {currentContent.accessDescription}
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              {currentContent.quotaLimit}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              {currentContent.noApiKey}
            </p>
          </CardBody>
        </Card>

        {/* How it works */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {currentContent.howItWorksTitle}
              </h2>
            </div>
          </CardHeader>
          <CardBody>
            <ol className="space-y-2">
              {currentContent.howItWorksSteps.map((step, index) => (
                <li key={index} className="text-gray-700 dark:text-gray-300">
                  {index + 1}. {step}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        {/* General Information */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentContent.generalInfoTitle}
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {currentContent.generalInfoDescription}
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>{currentContent.baseUrl}</strong> <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">https://api.duckmail.sbs</code>
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Contributions */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentContent.contributionsTitle}
            </h2>
          </CardHeader>
          <CardBody>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Code className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100">
                  {currentLocale === "en" ? "Welcome Contributions!" : "欢迎贡献！"}
                </h3>
              </div>
              <p className="text-blue-800 dark:text-blue-200 mb-4">
                {currentLocale === "en"
                  ? "We welcome developers to create integrations, libraries, and tools for the DuckMail API. If you have developed or are planning to develop:"
                  : "我们欢迎开发者为 DuckMail API 创建集成、库和工具。如果您已经开发或计划开发："}
              </p>
              <ul className="space-y-2 text-blue-800 dark:text-blue-200 mb-4">
                <li>• {currentLocale === "en" ? "Client libraries in various programming languages" : "各种编程语言的客户端库"}</li>
                <li>• {currentLocale === "en" ? "API wrappers and SDKs" : "API 包装器和 SDK"}</li>
                <li>• {currentLocale === "en" ? "Integration tools and plugins" : "集成工具和插件"}</li>
                <li>• {currentLocale === "en" ? "Documentation and tutorials" : "文档和教程"}</li>
              </ul>
              <p className="text-blue-800 dark:text-blue-200 mb-4">
                {currentLocale === "en"
                  ? "Please feel free to contact us or submit a pull request to our GitHub repository. We'd be happy to feature your contributions and help promote useful tools for the community."
                  : "请随时联系我们或向我们的 GitHub 仓库提交拉取请求。我们很乐意展示您的贡献并帮助推广对社区有用的工具。"}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  as="a"
                  href="https://github.com/Syferie/DuckMail"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="solid"
                  color="primary"
                  size="sm"
                  endContent={<ExternalLink size={14} />}
                >
                  {currentLocale === "en" ? "GitHub Repository" : "GitHub 仓库"}
                </Button>
                <Button
                  as="a"
                  href="mailto:syferie@proton.me"
                  variant="bordered"
                  color="primary"
                  size="sm"
                >
                  {currentLocale === "en" ? "Contact Us" : "联系我们"}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* API Documentation */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentLocale === "en" ? "API Documentation" : "API 文档"}
            </h2>
          </CardHeader>
          <CardBody>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>{currentContent.baseUrl}</strong> <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">https://api.duckmail.sbs</code>
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Error Handling */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {currentContent.errorHandlingTitle}
              </h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-green-600 mb-2">
                {currentContent.successfulTitle}
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                {currentContent.successfulDescription}
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-medium text-red-600 mb-2">
                {currentContent.unsuccessfulTitle}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {currentContent.unsuccessfulDescription}
              </p>

              <div className="space-y-3">
                {errorCodes.map((error, index) => (
                  <div key={index} className="border-l-4 border-red-500 pl-4">
                    <div className="flex items-center space-x-2 mb-1">
                      <Chip color="danger" variant="flat" size="sm">
                        {error.code}
                      </Chip>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {error.title}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {error.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Authentication */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {currentContent.authenticationTitle}
              </h2>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {currentContent.authenticationDescription}
            </p>

            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                {currentLocale === "en" ? "How to get it?" : "如何获取？"}
              </h3>
              <ol className="space-y-2 mb-4">
                {currentContent.authenticationSteps.map((step, index) => (
                  <li key={index} className="text-gray-700 dark:text-gray-300">
                    {index + 1}. {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                {currentLocale === "en" ? "POST /token" : "POST /token"}
              </h4>
              <div className="space-y-2">
                <div>
                  <strong className="text-gray-700 dark:text-gray-300">{currentLocale === "en" ? "Body:" : "请求体："}</strong>
                  <pre className="bg-gray-200 dark:bg-gray-700 p-2 rounded mt-1 text-sm">
{`{
  "address": "user@example.com",
  "password": "your_password"
}`}
                  </pre>
                </div>
                <div>
                  <strong className="text-gray-700 dark:text-gray-300">{currentLocale === "en" ? "Response:" : "响应："}</strong>
                  <pre className="bg-gray-200 dark:bg-gray-700 p-2 rounded mt-1 text-sm">
{`{
  "id": "string",
  "token": "string"
}`}
                  </pre>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                <strong>{currentLocale === "en" ? "Usage:" : "使用方法："}</strong>{" "}
                {currentLocale === "en"
                  ? 'Use this token as "Authorization":"Bearer TOKEN" in every request!'
                  : '在每个请求中使用此 token 作为 "Authorization":"Bearer TOKEN"！'}
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Domain Endpoints */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentLocale === "en" ? "Domain" : "域名"}
            </h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-6">
              {/* GET /domains */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Chip color="primary" variant="flat" size="sm">GET</Chip>
                  <code className="text-sm font-mono">/domains</code>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  {currentLocale === "en"
                    ? "You have to use this when creating an account, to retrieve the domain. Returns a list of domains"
                    : "创建账户时必须使用此接口来获取域名。返回域名列表"}
                </p>

                <div className="space-y-3">
                  <div>
                    <strong className="text-gray-700 dark:text-gray-300">{currentLocale === "en" ? "Parameters:" : "参数："}</strong>
                    <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                      <code className="text-sm">page (int): {currentLocale === "en" ? "The collection page number" : "集合页码"}</code>
                    </div>
                  </div>

                  <div>
                    <strong className="text-gray-700 dark:text-gray-300">{currentLocale === "en" ? "Response:" : "响应："}</strong>
                    <pre className="bg-gray-200 dark:bg-gray-700 p-3 rounded mt-1 text-xs overflow-x-auto">
{`{
  "hydra:member": [
    {
      "@id": "string",
      "@type": "string",
      "@context": "string",
      "id": "string",
      "domain": "string",
      "isActive": true,
      "isPrivate": true,
      "createdAt": "2022-04-01T00:00:00.000Z",
      "updatedAt": "2022-04-01T00:00:00.000Z"
    }
  ],
  "hydra:totalItems": 0,
  "hydra:view": {
    "@id": "string",
    "@type": "string",
    "hydra:first": "string",
    "hydra:last": "string",
    "hydra:previous": "string",
    "hydra:next": "string"
  }
}`}
                    </pre>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                    <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                      {currentLocale === "en"
                        ? 'When you create an email, you have to know first which domain to use. You\'ll need to retrieve the domain, and then, do like so: "user@"+domains[0][\'domain\']'
                        : '创建邮箱时，您必须首先知道要使用哪个域名。您需要获取域名，然后这样做："user@"+domains[0][\'domain\']'}
                    </p>
                  </div>
                </div>
              </div>

              {/* GET /domains/{id} */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Chip color="primary" variant="flat" size="sm">GET</Chip>
                  <code className="text-sm font-mono">/domains/{"{id}"}</code>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  {currentLocale === "en"
                    ? "Retrieve a domain by its id (Useful for deleted/private domains)"
                    : "通过 ID 获取域名（对已删除/私有域名有用）"}
                </p>

                <div className="space-y-3">
                  <div>
                    <strong className="text-gray-700 dark:text-gray-300">{currentLocale === "en" ? "Parameters:" : "参数："}</strong>
                    <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                      <code className="text-sm">id (string): {currentLocale === "en" ? "The domain you want to get with id" : "要获取的域名 ID"}</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Account Endpoints */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentLocale === "en" ? "Account" : "账户"}
            </h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-6">
              {/* POST /accounts */}
              <div className="border-l-4 border-green-500 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Chip color="success" variant="flat" size="sm">POST</Chip>
                  <code className="text-sm font-mono">/accounts</code>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  {currentLocale === "en"
                    ? "Creates an Account resource (Registration)"
                    : "创建账户资源（注册）"}
                </p>

                <div className="space-y-3">
                  <div>
                    <strong className="text-gray-700 dark:text-gray-300">{currentLocale === "en" ? "Body:" : "请求体："}</strong>
                    <pre className="bg-gray-200 dark:bg-gray-700 p-3 rounded mt-1 text-sm">
{`{
  "address": "user@example.com",
  "password": "your_password"
}`}
                    </pre>
                  </div>

                  <div>
                    <strong className="text-gray-700 dark:text-gray-300">{currentLocale === "en" ? "Response:" : "响应："}</strong>
                    <pre className="bg-gray-200 dark:bg-gray-700 p-3 rounded mt-1 text-xs overflow-x-auto">
{`{
  "@context": "string",
  "@id": "string",
  "@type": "string",
  "id": "string",
  "address": "user@example.com",
  "quota": 0,
  "used": 0,
  "isDisabled": true,
  "isDeleted": true,
  "createdAt": "2022-04-01T00:00:00.000Z",
  "updatedAt": "2022-04-01T00:00:00.000Z"
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* GET /accounts/{id} */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Chip color="primary" variant="flat" size="sm">GET</Chip>
                  <code className="text-sm font-mono">/accounts/{"{id}"}</code>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  {currentLocale === "en"
                    ? "Get an Account resource by its id (Obviously, the Bearer token needs to be the one of the account you are trying to retrieve)"
                    : "通过 ID 获取账户资源（显然，Bearer token 需要是您尝试获取的账户的令牌）"}
                </p>
              </div>

              {/* GET /me */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Chip color="primary" variant="flat" size="sm">GET</Chip>
                  <code className="text-sm font-mono">/me</code>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  {currentLocale === "en"
                    ? "Returns the Account resource that matches the Bearer token that sent the request."
                    : "返回与发送请求的 Bearer token 匹配的账户资源。"}
                </p>
              </div>

              {/* DELETE /accounts/{id} */}
              <div className="border-l-4 border-red-500 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Chip color="danger" variant="flat" size="sm">DELETE</Chip>
                  <code className="text-sm font-mono">/accounts/{"{id}"}</code>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  {currentLocale === "en"
                    ? "Deletes the Account resource."
                    : "删除账户资源。"}
                </p>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                  <p className="text-red-800 dark:text-red-200 text-sm">
                    <strong>{currentLocale === "en" ? "Be careful!" : "小心！"}</strong>{" "}
                    {currentLocale === "en"
                      ? "We can't restore your account, if you use this method, bye bye dear account :c"
                      : "我们无法恢复您的账户，如果您使用此方法，再见亲爱的账户 :c"}
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Messages Endpoints */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentLocale === "en" ? "Messages" : "消息"}
            </h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-6">
              {/* GET /messages */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Chip color="primary" variant="flat" size="sm">GET</Chip>
                  <code className="text-sm font-mono">/messages</code>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  {currentLocale === "en"
                    ? "Gets all the Message resources of a given page."
                    : "获取给定页面的所有消息资源。"}
                </p>

                <div className="space-y-3">
                  <div>
                    <strong className="text-gray-700 dark:text-gray-300">{currentLocale === "en" ? "Parameters:" : "参数："}</strong>
                    <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                      <code className="text-sm">page (int): {currentLocale === "en" ? "The collection page number" : "集合页码"}</code>
                    </div>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                    <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                      {currentLocale === "en"
                        ? 'There are up to 30 messages per page, to check the total number, retrieve it from "hydra:totalItems"'
                        : '每页最多 30 条消息，要检查总数，请从 "hydra:totalItems" 中获取'}
                    </p>
                  </div>
                </div>
              </div>

              {/* GET /messages/{id} */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Chip color="primary" variant="flat" size="sm">GET</Chip>
                  <code className="text-sm font-mono">/messages/{"{id}"}</code>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  {currentLocale === "en"
                    ? 'Retrieves a Message resource with a specific id (It has way more information than a message retrieved with GET /messages but it hasn\'t the "intro" member)'
                    : '获取具有特定 ID 的消息资源（它比通过 GET /messages 获取的消息具有更多信息，但没有 "intro" 成员）'}
                </p>
              </div>

              {/* PATCH /messages/{id} */}
              <div className="border-l-4 border-orange-500 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Chip color="warning" variant="flat" size="sm">PATCH</Chip>
                  <code className="text-sm font-mono">/messages/{"{id}"}</code>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  {currentLocale === "en"
                    ? "Marks a Message resource as read!"
                    : "将消息资源标记为已读！"}
                </p>

                <div>
                  <strong className="text-gray-700 dark:text-gray-300">{currentLocale === "en" ? "Response:" : "响应："}</strong>
                  <pre className="bg-gray-200 dark:bg-gray-700 p-2 rounded mt-1 text-sm">
{`{
  "seen": true
}`}
                  </pre>
                </div>
              </div>

              {/* DELETE /messages/{id} */}
              <div className="border-l-4 border-red-500 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Chip color="danger" variant="flat" size="sm">DELETE</Chip>
                  <code className="text-sm font-mono">/messages/{"{id}"}</code>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  {currentLocale === "en"
                    ? "Deletes the Message resource."
                    : "删除消息资源。"}
                </p>
              </div>

              {/* GET /sources/{id} */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Chip color="primary" variant="flat" size="sm">GET</Chip>
                  <code className="text-sm font-mono">/sources/{"{id}"}</code>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  {currentLocale === "en"
                    ? "Gets a Message's Source resource (If you don't know what this is, you either don't really want to use it or you should read about email source!)"
                    : "获取消息的源资源（如果您不知道这是什么，您要么真的不想使用它，要么应该阅读有关电子邮件源的信息！）"}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Attachments */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentLocale === "en" ? "Attachments" : "附件"}
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-gray-700 dark:text-gray-300">
              {currentLocale === "en"
                ? "Message's attachments need to be handled in a certain way. When you download them, be sure to download them in the right encoding (For example, a .exe file will need to be downloaded as an array of integers, but a json will need to be downloaded as String! Also, remember: API are friends. contentType member can help you know how to decode the file)"
                : "消息的附件需要以特定方式处理。下载时，请确保使用正确的编码下载（例如，.exe 文件需要作为整数数组下载，但 json 需要作为字符串下载！另外，请记住：API 是朋友。contentType 成员可以帮助您了解如何解码文件）"}
            </p>
          </CardBody>
        </Card>

        {/* Webhooks */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentLocale === "en" ? "Webhooks" : "Webhooks"}
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {currentLocale === "en"
                ? "You might be interested in Webhooks to receive notifications when a new message is received. However, we don't utilize them in this project."
                : "您可能对 Webhooks 感兴趣，以便在收到新消息时接收通知。但是，我们在此项目中不使用它们。"}
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {currentLocale === "en"
                ? "Instead, we're using the Mercure to send SSE events."
                : "相反，我们使用 Mercure 发送 SSE 事件。"}
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">
                {currentLocale === "en" ? "Listen to messages" : "监听消息"}
              </h3>
              <p className="text-blue-800 dark:text-blue-200 mb-3">
                {currentLocale === "en"
                  ? "To listen to messages you'll need a different base url."
                  : "要监听消息，您需要一个不同的基础 URL。"}
              </p>

              <div className="space-y-3">
                <div>
                  <strong className="text-blue-900 dark:text-blue-100">
                    {currentLocale === "en" ? "Base url:" : "基础 URL："}
                  </strong>
                  <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded mt-1">
                    <code className="text-sm text-blue-900 dark:text-blue-100">
                      https://mercure.duckmail.sbs/.well-known/mercure
                    </code>
                  </div>
                </div>

                <div>
                  <strong className="text-blue-900 dark:text-blue-100">
                    {currentLocale === "en" ? "Topic:" : "主题："}
                  </strong>
                  <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded mt-1">
                    <code className="text-sm text-blue-900 dark:text-blue-100">
                      /accounts/{"{id}"}
                    </code>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    <strong>{currentLocale === "en" ? "Remember!" : "记住！"}</strong>{" "}
                    {currentLocale === "en"
                      ? "You must use the `Bearer TOKEN` authorization in the headers!"
                      : "您必须在标头中使用 `Bearer TOKEN` 授权！"}
                  </p>
                </div>

                <div>
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    {currentLocale === "en"
                      ? 'For each listened message, there will be an Account event. That Account is the Account resource that received the message, with updated "used" property.'
                      : '对于每个监听的消息，都会有一个 Account 事件。该 Account 是接收消息的账户资源，具有更新的 "used" 属性。'}
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Questions and suggestions */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentLocale === "en" ? "Questions and suggestions" : "问题和建议"}
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {currentLocale === "en"
                ? "If you have any questions or suggestions, please contact us via email or GitHub."
                : "如果您有任何问题或建议，请通过电子邮件或 GitHub 联系我们。"}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                as="a"
                href="mailto:syferie@proton.me"
                variant="bordered"
                color="primary"
                size="sm"
              >
                syferie@proton.me
              </Button>
              <Button
                as="a"
                href="https://github.com/Syferie/DuckMail"
                target="_blank"
                rel="noopener noreferrer"
                variant="bordered"
                color="primary"
                size="sm"
                endContent={<ExternalLink size={14} />}
              >
                GitHub
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Tech stack */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentLocale === "en" ? "Tech stack" : "技术栈"}
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-gray-700 dark:text-gray-300">
              {currentLocale === "en"
                ? "Our stack includes Next.js, React, TypeScript, HeroUI, Tailwind CSS, Mercure, and is compatible with mail.tm API specification."
                : "我们的技术栈包括 Next.js、React、TypeScript、HeroUI、Tailwind CSS、Mercure，并兼容 mail.tm API 规范。"}
            </p>
          </CardBody>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © 2024 DuckMail. {currentLocale === "en" ? "All rights reserved." : "保留所有权利。"}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {currentLocale === "en"
              ? "API compatible with mail.tm specification"
              : "API 兼容 mail.tm 规范"}
          </p>
        </div>
      </div>
    </div>
  )
}
