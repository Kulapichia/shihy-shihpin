/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
// --- 功能增强: 引入 http/https 模块以使用连接池 ---
import * as https from 'https';
import * as http from 'http';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

// --- 功能增强: 引入高性能Node.js连接池 ---
// 为分片请求设置更大的并发数和更长的超时
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 75000, // 保持与您的超时策略一致
  keepAliveMsecs: 30000,
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 75000, // 保持与您的超时策略一致
  keepAliveMsecs: 30000,
});

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, User-Agent, Referer',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const source = searchParams.get('moontv-source');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  // --- 强制校验 moontv-source 参数 ---
  if (!source) {
    return NextResponse.json(
      { error: 'Missing moontv-source parameter' },
      { status: 400 }
    );
  }

  const config = await getConfig();
  // --- 同时查找直播源和点播源，以支持点播视频片段的代理 ---
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  const vodSource = config.SourceConfig?.find((s: any) => s.key === source);

  if (!liveSource && !vodSource) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  // 优先使用直播源的UA，否则使用默认UA
  // --- 功能增强: 实现了您注释中想要的智能UA功能 ---
  const ua = liveSource?.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  // 优化: 智能超时策略
  const getTimeoutBySourceDomain = (domain: string): number => {
    const knownSlowDomains = ['bvvvvvvv7f.com', 'dytt-music.com', 'high25-playback.com', 'ffzyread2.com'];
    // 如果域名包含在慢速列表中，给予更长的超时时间
    return knownSlowDomains.some(slow => domain.includes(slow)) ? 75000 : 60000;
  };

  let response: Response | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const decodedUrl = decodeURIComponent(url);

    // --- 功能增强: 选择合适的agent以启用连接池 ---
    const isHttps = decodedUrl.startsWith('https:');
    const agent = isHttps ? httpsAgent : httpAgent;

    const requestHeaders: Record<string, string> = {
      'User-Agent': ua,
      'Accept': '*/*',
      'Connection': 'keep-alive',
    };

    const range = request.headers.get('range');
    if (range) {
      requestHeaders['Range'] = range;
    }

    let timeout = 60000; // 默认60秒超时

    // --- 智能 Referer 与超时策略 ---

    try {
      const urlObject = new URL(decodedUrl);
      const domain = urlObject.hostname;
      
      // 为不同的视频源设置专门的Referer策略
      if (domain.includes('bvvvvvvv7f.com')) {
        requestHeaders['Referer'] = 'https://www.bvvvvvvv7f.com/';
      } else if (domain.includes('dytt-music.com')) {
        requestHeaders['Referer'] = 'https://www.dytt-music.com/';
      } else if (domain.includes('high25-playback.com')) {
        requestHeaders['Referer'] = 'https://www.high25-playback.com/';
      } else if (domain.includes('ffzyread2.com')) {
        requestHeaders['Referer'] = 'https://www.ffzyread2.com/';
      } else if (domain.includes('wlcdn88.com')) {
        requestHeaders['Referer'] = 'https://www.wlcdn88.com/';
      } else {
        // 通用策略：使用同域根路径
        requestHeaders['Referer'] = urlObject.origin + '/';
      }
      
      timeout = getTimeoutBySourceDomain(domain);
    } catch {
      // URL解析失败时不设置Referer
      console.warn('Failed to parse URL for Referer:', decodedUrl);
    }


    response = await fetch(decodedUrl, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(timeout),
      // --- 功能增强: 应用连接池 ---
      // @ts-ignore - Node.js specific option for connection pooling
      agent: typeof window === 'undefined' ? agent : undefined,
    });



    // 1. 恢复重要的错误检查
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch segment from source' },
        { status: response.status }
      );
    }

    // 2. 先声明 headers 变量
    const headers = new Headers();
    // 3. 安全地复制源站的响应头    
    if (response) {
      ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach(header => {
        // Fix: Add null check within forEach callback
        if (response) {
          const value = response.headers.get(header);
          if (value) {
            headers.set(header, value);
          }
        }
      });
    }
    
    // 4. 设置默认值和CORS头
    if (!headers.has('content-type')) {
      headers.set('Content-Type', 'video/mp2t');
    }
    if (!headers.has('accept-ranges')) {
      headers.set('Accept-Ranges', 'bytes');
    }

    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, User-Agent, Referer');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
    headers.set('Cache-Control', 'public, max-age=86400, immutable'); // 片段内容不变，允许更长缓存

    // 使用流式传输，避免占用内存
    const stream = new ReadableStream({
      async start(controller) {
        if (!response?.body) {
          controller.close();
          return;
        }
        reader = response.body.getReader();

        const cleanup = () => {
          if (reader) {
            try {
              reader.releaseLock();
            } catch (e) {
              // reader a.
            }
            reader = null;
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            controller.enqueue(value);
          }
        } catch (error) {
          controller.error(error);
        } finally {
          cleanup();
          controller.close();
        }
      },
      cancel() {
        if (reader) {
          try {
            reader.cancel();
            reader.releaseLock();
          } catch (e) {
            // ignore
          }
          reader = null;
        }
        if (response?.body) {
          try {
            response.body.cancel();
          } catch (e) {
            // ignore
          }
        }
      },
    });

    return new Response(stream, { status: response.status, headers });
  } catch (error) {
    // 确保在错误情况下也释放资源
    if (reader) {
      try {
        (reader as ReadableStreamDefaultReader<Uint8Array>).releaseLock();
      } catch (e) {
        // 忽略错误
      }
    }

    if (response?.body) {
      try {
        response.body.cancel();
      } catch (e) {
        // 忽略错误
      }
    }

    // --- 功能增强: 更详细的错误日志和状态码 ---
    console.error('代理分片请求失败:', {
        url: searchParams.get('url'),
        error: error instanceof Error ? error.message : String(error),
    });

    let statusCode = 502; // Bad Gateway 作为默认值
    let errorMessage = '代理视频分片失败';
  
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        statusCode = 504; // Gateway Timeout 更精确
        errorMessage = '源服务器请求超时';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        statusCode = 502; // Bad Gateway
        errorMessage = '从源服务器获取视频分片时发生网络错误';
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
