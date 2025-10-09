/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: 获取缓存
export async function GET(req: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(req);
    if (!authInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    }

    const data = await db.getCache(key);

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('获取缓存失败:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

// POST: 设置缓存
export async function POST(req: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(req);
    if (!authInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { key, data, expireSeconds } = await req.json();

    if (!key || data === undefined) {
      return NextResponse.json({ error: 'Missing key or data' }, { status: 400 });
    }

    await db.setCache(key, data, expireSeconds);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('设置缓存失败:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: 删除缓存或清理过期缓存
export async function DELETE(req: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(req);
    if (!authInfo) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    const prefix = searchParams.get('prefix');

    if (key) {
      await db.deleteCache(key);
      return NextResponse.json({ success: true, message: `Cache with key "${key}" deleted.` });
    }

    if (prefix) {
      await db.clearExpiredCache(prefix);
      return NextResponse.json({ success: true, message: `Expired cache with prefix "${prefix}" cleared.` });
    }

    // 如果没有key或prefix，则清理所有过期缓存
    await db.clearExpiredCache();
    return NextResponse.json({ success: true, message: 'All expired cache cleared.' });

  } catch (error: any) {
    console.error('删除缓存失败:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
