/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

// Logo 缓存管理
const logoCache = new Map<string, { data: ArrayBuffer; contentType: string; timestamp: number; etag?: string }>();
const LOGO_CACHE_TTL = 86400000; // 24小时
const MAX_CACHE_SIZE = 500;

// 连接池管理
import * as https from 'https';
import * as http from 'http';

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 30,
  maxFreeSockets: 10,
  timeout: 20000,
  keepAliveMsecs: 30000,
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 30,
  maxFreeSockets: 10,
  timeout: 20000,
  keepAliveMsecs: 30000,
});


// 清理过期缓存
function cleanupExpiredCache() {
  const now = Date.now();
  
  // 使用 Array.from() 来避免迭代器问题
  const cacheEntries = Array.from(logoCache.entries());
  for (const [key, value] of cacheEntries) {
    if (now - value.timestamp > LOGO_CACHE_TTL) {
      logoCache.delete(key);
    }
  }
  
  // 如果缓存仍然过大，删除最老的条目
  if (logoCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(logoCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toDelete.forEach(([key]) => logoCache.delete(key));
  }
}


export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, User-Agent, Referer, If-None-Match',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  const source = searchParams.get('moontv-source');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
  }

  const config = await getConfig();
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  const ua = liveSource?.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  const decodedUrl = decodeURIComponent(imageUrl);
  const cacheKey = `${source || 'default'}-${decodedUrl}`;
  
  // 检查缓存
  const cached = logoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LOGO_CACHE_TTL) {
    return new Response(cached.data, {
      headers: {
        'Content-Type': cached.contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
        'X-Cache': 'HIT',
        'Content-Length': cached.data.byteLength.toString(),
        ...(cached.etag && { 'ETag': cached.etag })
      },
    });
  }

  try {
    const isHttps = decodedUrl.startsWith('https:');
    const agent = isHttps ? httpsAgent : httpAgent;

    const imageResponse = await fetch(decodedUrl, {
      cache: 'no-cache',
      redirect: 'follow',
      credentials: 'same-origin',
      headers: {
        'User-Agent': ua,
        ...(cached?.etag && { 'If-None-Match': cached.etag })
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Node.js specific option
      agent: typeof window === 'undefined' ? agent : undefined,
    });

    if (imageResponse.status === 304 && cached) {
      cached.timestamp = Date.now(); // 更新时间戳
      logoCache.set(cacheKey, cached);
      return new Response(cached.data, {
        headers: {
          'Content-Type': cached.contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=604800, immutable',
          'X-Cache': '304-HIT',
          'Content-Length': cached.data.byteLength.toString(),
        },
      });
    }

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: imageResponse.statusText },
        { status: imageResponse.status }
      );
    }
    
    const contentType = imageResponse.headers.get('content-type');
    const etag = imageResponse.headers.get('ETag');

    if (!imageResponse.body) {
      return NextResponse.json(
        { error: 'Image response has no body' },
        { status: 500 }
      );
    }
    
    // 读取图片数据并缓存
    const imageData = await imageResponse.arrayBuffer();
    
    // 缓存图片数据
    if (contentType) {
        logoCache.set(cacheKey, {
            data: imageData,
            contentType,
            timestamp: Date.now(),
            etag: etag || undefined
        });
    }

    // 定期清理缓存
    if (logoCache.size > MAX_CACHE_SIZE) {
      cleanupExpiredCache();
    }

    // 创建响应头
    const headers = new Headers();
    if (contentType) {
      headers.set('Content-Type', contentType);
    }
    
    if (etag) {
      headers.set('ETag', etag);
    }

    // 设置缓存头
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable');
    headers.set('X-Cache', 'MISS');
    headers.set('Content-Length', imageData.byteLength.toString());

    // 直接返回图片流
    return new Response(imageData, {
      status: 200,
      headers,
    });
  // 添加 catch 块来闭合 try
  } catch (error) {
    console.error('Failed to proxy logo:', error);
    return NextResponse.json(
      { error: 'Failed to proxy image' },
      { status: 502 } // 502 Bad Gateway 更适合表示代理失败
    );
  }
}
