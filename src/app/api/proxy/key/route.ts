/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, User-Agent, Referer',
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

  const config = await getConfig();
  // --- 同时查找直播源和点播源 ---
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  const vodSource = config.SourceConfig?.find((s: any) => s.key === source);

  if (!liveSource && !vodSource) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  try {
    const decodedUrl = decodeURIComponent(url);
    
    const requestHeaders: Record<string, string> = {
      'User-Agent': ua,
      'Accept': 'application/octet-stream, */*',
      'Connection': 'keep-alive',
    };
    
    let timeout = 30000; // 默认30秒超时

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
      const getTimeoutBySourceDomain = (domain: string): number => {
        const knownSlowDomains = ['bvvvvvvv7f.com', 'dytt-music.com', 'high25-playback.com', 'ffzyread2.com'];
        return knownSlowDomains.some(slow => domain.includes(slow)) ? 45000 : 30000;
      };
      timeout = getTimeoutBySourceDomain(domain);
    } catch {
      // URL解析失败时不设置Referer
      console.warn('Failed to parse URL for Referer:', decodedUrl);
    }


    const response = await fetch(decodedUrl, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(timeout),
    });


    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch key' },
        { status: 500 }
      );
    }
    const keyData = await response.arrayBuffer();
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, User-Agent, Referer');
    headers.set('Cache-Control', 'public, max-age=172800, immutable');
    headers.set('Content-Length', keyData.byteLength.toString());

    return new Response(keyData, { headers });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch key' }, { status: 500 });
  }
}
