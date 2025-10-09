/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';

import { getConfig } from '@/lib/config';

import { GlobalErrorIndicator } from '../components/GlobalErrorIndicator';
import { SiteProvider } from '../components/SiteProvider';
import { ThemeProvider } from '../components/ThemeProvider';
import { VirtualScrollProvider } from '../components/VirtualScrollProvider';

const inter = Inter({ subsets: ['latin'] });
export const dynamic = 'force-dynamic';

// 动态生成 metadata，支持配置更新后的标题变化
export async function generateMetadata(): Promise<Metadata> {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  let siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'MoonTV';

  if (storageType !== 'localstorage') {
    try {
      const config = await getConfig();
      siteName = config.SiteConfig.SiteName;
    } catch (error) {
      console.error("Failed to load remote config for metadata, using default site name:", error);
      // 如果获取配置失败，使用环境变量中的默认值
    }
  }

  return {
    title: siteName,
    description: '影视聚合',
    manifest: '/manifest.json',
    icons: {
      apple: '/icons/icon-192x192.png',
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: siteName,
    },
  };
}

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  // --- Start: Default values from environment variables ---
  let siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'MoonTV';
  let announcement =
    process.env.ANNOUNCEMENT ||
    '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。';
  let doubanProxyType =
    process.env.NEXT_PUBLIC_DOUBAN_PROXY_TYPE || 'cmliussss-cdn-tencent';
  let doubanProxy = process.env.NEXT_PUBLIC_DOUBAN_PROXY || '';
  let doubanImageProxyType =
    process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE || 'cmliussss-cdn-tencent';
  let doubanImageProxy = process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY || '';
  let disableYellowFilter =
    process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === 'true';
  let fluidSearch = process.env.NEXT_PUBLIC_FLUID_SEARCH !== 'false';
  let showContentFilter = false;
  let customCategories: { name: string; type: 'movie' | 'tv'; query: string; }[] = [];
  let enableVirtualScroll = true;
  let netdiskSearch = false;
  let homeCustomize: any = {};

  if (storageType !== 'localstorage') {
    try {
      const config = await getConfig();
      const siteConfig = config.SiteConfig || {};

      siteName = siteConfig.SiteName || siteName;
      announcement = siteConfig.Announcement || announcement;
      doubanProxyType = siteConfig.DoubanProxyType || doubanProxyType;
      doubanProxy = siteConfig.DoubanProxy || doubanProxy;
      doubanImageProxyType = siteConfig.DoubanImageProxyType || doubanImageProxyType;
      doubanImageProxy = siteConfig.DoubanImageProxy || doubanImageProxy;
      disableYellowFilter = siteConfig.DisableYellowFilter ?? disableYellowFilter;
      showContentFilter = siteConfig.ShowContentFilter !== false;
      fluidSearch = siteConfig.FluidSearch ?? fluidSearch;
      enableVirtualScroll = siteConfig.EnableVirtualScroll ?? enableVirtualScroll;
      netdiskSearch = siteConfig.NetdiskSearch ?? netdiskSearch;
      homeCustomize = config.HomeCustomize || homeCustomize;
      
      if (config.CustomCategories) {
        customCategories = config.CustomCategories
          .filter((category: any) => !category.disabled && category.name && category.query)
          .map((category: any) => ({
            name: category.name,
            type: category.type,
            query: category.query,
          }));
      }
    } catch (error) {
      console.error("Failed to load remote config, using default values:", error);
      // 如果获取配置失败，将使用环境变量或代码中的默认值，确保网站能启动
    }
  }

  // 将运行时配置注入到全局 window 对象，供客户端在运行时读取
  const runtimeConfig = {
    STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
    DOUBAN_PROXY_TYPE: doubanProxyType,
    DOUBAN_PROXY: doubanProxy,
    DOUBAN_IMAGE_PROXY_TYPE: doubanImageProxyType,
    DOUBAN_IMAGE_PROXY: doubanImageProxy,
    DISABLE_YELLOW_FILTER: disableYellowFilter,
    SHOW_CONTENT_FILTER: showContentFilter,
    CUSTOM_CATEGORIES: customCategories,
    FLUID_SEARCH: fluidSearch,
    ENABLE_VIRTUAL_SCROLL: enableVirtualScroll,
    NETDISK_SEARCH: netdiskSearch,
    HOME_CUSTOMIZE: homeCustomize,
  };

  return (
    <html lang='zh-CN' suppressHydrationWarning>
      <head>
        <meta
          name='viewport'
          content='width=device-width, initial-scale=1.0, viewport-fit=cover'
        />
        <link rel='apple-touch-icon' href='/icons/icon-192x192.png' />
        {/* 将配置序列化后直接写入脚本，浏览器端可通过 window.RUNTIME_CONFIG 获取 */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.RUNTIME_CONFIG = ${JSON.stringify(runtimeConfig)};`,
          }}
        />
      </head>
      <body
        className={`${inter.className} min-h-screen bg-white text-gray-900 dark:bg-black dark:text-gray-200`}
      >
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <SiteProvider siteName={siteName} announcement={announcement}>
            <VirtualScrollProvider initialValue={enableVirtualScroll}>
              {children}
            </VirtualScrollProvider>
            <GlobalErrorIndicator />
          </SiteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
