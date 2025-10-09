/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
'use client';

import { db } from './db.client';

// 定义缓存条目接口
interface CacheEntry {
  key: string;
  value: any;
  expiresAt: number; // 存储为毫秒级时间戳
}

// 内部函数：生成过期时间戳
function getExpiresAt(expireSeconds: number): number {
  return Date.now() + expireSeconds * 1000;
}

/**
 * 统一的客户端缓存模块
 * 优先使用 IndexedDB，在不支持或失败时优雅降级到 localStorage
 */
export const ClientCache = {
  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param expireSeconds 过期时间（秒）
   */
  async set(key: string, value: any, expireSeconds: number): Promise<void> {
    const entry: CacheEntry = {
      key,
      value,
      expiresAt: getExpiresAt(expireSeconds),
    };
    try {
      // 优先使用 IndexedDB
      await db.clientCache.put(entry);
    } catch (e) {
      console.warn('IndexedDB set failed, falling back to localStorage:', e);
      try {
        // 降级到 localStorage
        localStorage.setItem(key, JSON.stringify(entry));
      } catch (lsError) {
        console.error('localStorage set also failed:', lsError);
      }
    }
  },

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 缓存值或 null
   */
  async get(key: string): Promise<any | null> {
    try {
      // 优先从 IndexedDB 获取
      const entry = await db.clientCache.get(key);
      if (entry) {
        if (Date.now() <= entry.expiresAt) {
          return entry.value;
        }
        // 缓存过期，从 IndexedDB 删除
        await db.clientCache.delete(key);
        return null;
      }
    } catch (e) {
      console.warn('IndexedDB get failed, falling back to localStorage:', e);
      // IndexedDB 失败，尝试从 localStorage 获取
      try {
        const localEntryStr = localStorage.getItem(key);
        if (localEntryStr) {
          const localEntry: CacheEntry = JSON.parse(localEntryStr);
          if (Date.now() <= localEntry.expiresAt) {
            return localEntry.value;
          }
          // 缓存过期，从 localStorage 删除
          localStorage.removeItem(key);
        }
      } catch (lsError) {
        console.error('localStorage get also failed:', lsError);
      }
    }
    return null;
  },

  /**
   * 清理指定前缀的过期缓存
   * @param prefix 缓存键前缀
   */
  async clearExpired(prefix: string): Promise<void> {
    const now = Date.now();
    try {
      // 清理 IndexedDB
      const allKeys = await db.clientCache.toCollection().keys();
      const keysToDelete = allKeys.filter((key: any) =>
        typeof key === 'string' && key.startsWith(prefix)
      );

      for (const key of keysToDelete) {
        const entry = await db.clientCache.get(key);
        if (entry && now > entry.expiresAt) {
          await db.clientCache.delete(key);
        }
      }
    } catch (e) {
      console.warn('Failed to clear expired cache from IndexedDB:', e);
    }

    // 清理 localStorage (兜底)
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
      keys.forEach(key => {
        try {
          const entryStr = localStorage.getItem(key);
          if (entryStr) {
            const entry: CacheEntry = JSON.parse(entryStr);
            if (now > entry.expiresAt) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          // 清理损坏的缓存数据
          localStorage.removeItem(key);
        }
      });
    } catch (lsError) {
      console.error('Failed to clear expired cache from localStorage:', lsError);
    }
  },
};
