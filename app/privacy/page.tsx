"use client"

import { useState, useEffect } from "react"
import { Card, CardBody, CardHeader } from "@heroui/card"
import { Button } from "@heroui/button"
import { ArrowLeft, Shield, Languages } from "lucide-react"
import { useRouter } from "next/navigation"

export default function PrivacyPage() {
  const router = useRouter()
  const [currentLocale, setCurrentLocale] = useState("zh")

  useEffect(() => {
    const savedLocale = localStorage.getItem("duckmail-locale") || "zh"
    setCurrentLocale(savedLocale)
  }, [])

  const content = {
    zh: {
      title: "隐私政策",
      subtitle: "DuckMail 隐私政策",
      description: "本文档解释了 duckmail.sbs 网站上个人信息的收集、使用和披露政策。本隐私政策涉及本网站可能收集的个人身份信息（以下简称数据）。",
      sections: [
        {
          title: "数据收集",
          content: "与许多网站一样，网站编辑器可能会自动接收服务器日志文件中包含的一般信息，例如您的 IP 地址和 cookie 信息。有关如何在本网站上投放广告的信息（如果确实是网站编辑器投放广告的政策）如下所述。"
        },
        {
          title: "数据使用",
          content: "数据可用于自定义和改善您在本网站上的用户体验。将努力防止您的数据提供给第三方，除非：(i) 本隐私政策中另有规定；(ii) 获得您的同意，例如当您选择选择加入或选择退出数据共享时；(iii) 我们网站上提供的服务需要与第三方交互，或由第三方提供，例如应用程序服务提供商；(iv) 根据法律行动或执法；(v) 发现您对本网站的使用违反了网站编辑器的政策、服务条款或其他使用准则，或者网站编辑器认为有必要保护网站编辑器的合法权利和/或财产；或 (vi) 本网站被第三方购买，在这种情况下，该第三方将能够以本政策规定的相同方式使用数据。"
        },
        {
          title: "Cookies",
          content: "与许多网站一样，本网站设置和使用 cookies 来增强您的用户体验——例如，记住您的个人设置。广告可能会在本网站上显示，如果是这样，可能会在您的计算机上设置和访问 cookies；此类 cookies 受提供广告的各方的隐私政策约束。但是，提供广告的各方无法访问本网站的 cookies。这些各方通常使用非个人身份识别或匿名代码来获取有关您访问本网站的信息。"
        },
        {
          title: "临时邮件的安全性",
          content: "信息会在传统电子邮件中保存多年。这可能会遭到黑客攻击或由于服务失败而丢失。通过使用普通电子邮件，无论您的信息是否重要，您的个人信息都会遭到黑客攻击、盗窃和滥用。使用临时邮件可以完全防止个人信息丢失。您的详细信息：有关您的个人和用户的信息，IP 地址，电子邮件地址，完全保密。DuckMail 服务不会存储您的 IP 地址。这意味着您将受到保护，防止所有可能危及您的信息并损害您的隐私的未经授权的行为。"
        },
        {
          title: "数据删除",
          content: "暂时存储在我们服务中的所有电子邮件和数据将永久删除。您可以随时使用主页上的相应按钮删除删除您的临时电子邮件地址。您的隐私是我们的首要任务。您无需担心自己的数据。我们将提供全面的保护。对您的数据的访问将仅提供给您个人，并且仅在临时电子邮件地址的有效期内。"
        },
        {
          title: "用户关怀",
          content: "我们关心我们所有的用户。本网站的管理可以对本隐私政策进行更改。"
        }
      ]
    },
    en: {
      title: "Privacy Policy",
      subtitle: "DuckMail Privacy Policy",
      description: "This document explains policies for the collection, use, and disclosure of personal information on duckmail.sbs. This privacy policy deals with personally-identifiable information (referred to as data below) that may be collected by this site.",
      sections: [
        {
          title: "COLLECTION OF DATA",
          content: "As on many websites, the site editor may automatically receive general information that is contained in server log files, such as your IP address, and cookie information. Information about how advertising may be served on this site (if it is indeed the site editor's policy to display advertising) is set forth below."
        },
        {
          title: "USE OF DATA",
          content: "Data may be used to customize and improve your user experience on this site. Efforts will be made to prevent your data from being made available to third parties unless (i) provided for otherwise in this Privacy Policy; (ii) your consent is obtained, such as when you choose to opt-in or opt-out for the sharing of data; (iii) a service provided on our site requires interaction with a third party, or is provided by a third party, such as an application service provider; (iv) pursuant to legal action or law enforcement; (v) it is found that your use of this site violates the site editor's policy, terms of service, or other usage guidelines, or if it is deemed reasonably necessary by the site editor to protect the site editor's legal rights and/or property; (vi) this site is purchased by a third party, in which case that third party will be able to use the data in the same manner as set forth in this policy."
        },
        {
          title: "COOKIES",
          content: "Like many websites, this website sets and uses cookies to enhance your user experience — to remember your personal settings, for instance. Advertisements may display on this website and, if so, may set and access cookies on your computer; such cookies are subject to the privacy policy of the parties providing the advertisement. However, the parties providing the advertising do not have access to this site's cookies. These parties usually use non-personally-identifiable or anonymous codes to obtain information about your visits to this site."
        },
        {
          title: "TEMPORARY EMAIL SECURITY",
          content: "Information is stored in traditional email for years. This can be hacked or lost due to service failure. By using regular email, regardless of whether your information is important, your personal information is hacked, stolen and abused. Using temporary email can completely prevent personal information loss. Your details: information about your personal and user, IP address, email address, completely confidential. DuckMail service does not store your IP address. This means you will be protected against all unauthorized actions that could compromise your information and harm your privacy."
        },
        {
          title: "DATA DELETION",
          content: "All emails and data temporarily stored in our service will be permanently deleted. You can delete your temporary email address at any time using the corresponding Delete button on the homepage. Your privacy is our top priority. You don't need to worry about your data. We will provide comprehensive protection. Access to your data will only be provided to you personally, and only during the validity period of the temporary email address."
        },
        {
          title: "USER CARE",
          content: "We care about all our users. The management of this website can make changes to this privacy policy."
        }
      ]
    }
  }

  const currentContent = content[currentLocale as keyof typeof content]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
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

        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                <Shield className="w-6 h-6 text-primary-600 dark:text-primary-400" />
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
          
          <CardBody className="space-y-6">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {currentContent.description}
            </p>

            {currentContent.sections.map((section, index) => (
              <div key={index} className="border-l-4 border-primary-500 pl-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {section.title}
                </h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {section.content}
                </p>
              </div>
            ))}

            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                © 2024 DuckMail. {currentLocale === "en" ? "All rights reserved." : "保留所有权利。"}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
