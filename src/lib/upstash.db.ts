/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { Redis } from '@upstash/redis';

import { AdminConfig, PendingUser, RegistrationStats } from './admin.types';
import { Favorite, IStorage, PlayRecord, SkipConfig } from './types';

// 搜索历史最大条数
const SEARCH_HISTORY_LIMIT = 20;

// 数据类型转换辅助函数
function ensureString(value: any): string {
  return String(value);
}

function ensureStringArray(value: any[]): string[] {
  return value.map((item) => String(item));
}

// 添加Upstash Redis操作重试包装器
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      const isLastAttempt = i === maxRetries - 1;
      const isConnectionError =
        err.message?.includes('Connection') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ENOTFOUND') ||
        err.code === 'ECONNRESET' ||
        err.code === 'EPIPE' ||
        err.name === 'UpstashError';

      if (isConnectionError && !isLastAttempt) {
        console.log(
          `Upstash Redis operation failed, retrying... (${i + 1}/${maxRetries})`
        );
        console.error('Error:', err.message);

        // 等待一段时间后重试
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }

      throw err;
    }
  }

  throw new Error('Max retries exceeded');
}

export class UpstashRedisStorage implements IStorage {
  private client: Redis;

  constructor() {
    this.client = getUpstashRedisClient();
  }

  // ---------- 播放记录 ----------
  private prKey(user: string, key: string) {
    return `u:${user}:pr:${key}`; // u:username:pr:source+id
  }

  async getPlayRecord(
    userName: string,
    key: string
  ): Promise<PlayRecord | null> {
    const val = await withRetry(() =>
      this.client.get(this.prKey(userName, key))
    );
    if (!val) return null;
    try {
      // Upstash可能返回对象或字符串，统一处理
      return (
        typeof val === 'string' ? JSON.parse(val) : val
      ) as PlayRecord;
    } catch (e) {
      console.error(`[DB] Failed to parse PlayRecord for key ${key}:`, e);
      return null;
    }
  }

  async setPlayRecord(
    userName: string,
    key: string,
    record: PlayRecord
  ): Promise<void> {
    await withRetry(() => this.client.set(this.prKey(userName, key), record));
  }

  async getAllPlayRecords(
    userName: string
  ): Promise<Record<string, PlayRecord>> {
    const pattern = `u:${userName}:pr:*`;
    const result: Record<string, PlayRecord> = {};
    let cursor: string = '0'; // <--- FIX: Changed to string '0'

    do {
      const [nextCursor, keys] = await withRetry(() => this.client.scan(cursor, { match: pattern, count: 100 }));
      cursor = nextCursor; // <--- FIX: Now correctly assigns string to string
      
      for (const fullKey of keys) {
        const value = await withRetry(() => this.client.get(fullKey));
        if (value) {
          try {
            // 截取 source+id 部分
            const keyPart = ensureString(
              fullKey.replace(`u:${userName}:pr:`, '')
            );
            result[keyPart] = (
              typeof value === 'string' ? JSON.parse(value) : value
            ) as PlayRecord;
          } catch (e) {
            console.error(`[DB] Failed to parse PlayRecord for key ${fullKey}:`, e);
          }
        }
      }
    } while (cursor !== '0'); // <--- FIX: Changed to string '0'

    return result;
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    await withRetry(() => this.client.del(this.prKey(userName, key)));
  }

  // ---------- 收藏 ----------
  private favKey(user: string, key: string) {
    return `u:${user}:fav:${key}`;
  }

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const val = await withRetry(() =>
      this.client.get(this.favKey(userName, key))
    );
    if (!val) return null;
    try {
      return (typeof val === 'string' ? JSON.parse(val) : val) as Favorite;
    } catch (e) {
      console.error(`[DB] Failed to parse Favorite for key ${key}:`, e);
      return null;
    }
  }

  async setFavorite(
    userName: string,
    key: string,
    favorite: Favorite
  ): Promise<void> {
    await withRetry(() =>
      this.client.set(this.favKey(userName, key), favorite)
    );
  }

  async getAllFavorites(userName: string): Promise<Record<string, Favorite>> {
    const pattern = `u:${userName}:fav:*`;
    const result: Record<string, Favorite> = {};
    let cursor: string = '0'; // <--- FIX: Changed to string '0'

    do {
      const [nextCursor, keys] = await withRetry(() => this.client.scan(cursor, { match: pattern, count: 100 }));
      cursor = nextCursor; // <--- FIX: Now correctly assigns string to string

      for (const fullKey of keys) {
        const value = await withRetry(() => this.client.get(fullKey));
        if (value) {
          try {
            const keyPart = ensureString(
              fullKey.replace(`u:${userName}:fav:`, '')
            );
            result[keyPart] = (
              typeof value === 'string' ? JSON.parse(value) : value
            ) as Favorite;
          } catch (e) {
            console.error(`[DB] Failed to parse Favorite for key ${fullKey}:`, e);
          }
        }
      }
    } while (cursor !== '0'); // <--- FIX: Changed to string '0'

    return result;
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    await withRetry(() => this.client.del(this.favKey(userName, key)));
  }

  // ---------- 用户注册 / 登录 ----------
  private userPwdKey(user: string) {
    return `u:${user}:pwd`;
  }

  async registerUser(userName: string, password: string): Promise<void> {
    // 简单存储明文密码，生产环境应加密
    await withRetry(() => this.client.set(this.userPwdKey(userName), password));
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const stored = await withRetry(() =>
      this.client.get(this.userPwdKey(userName))
    );
    if (stored === null) return false;
    // 确保比较时都是字符串类型
    return ensureString(stored) === password;
  }

  // 检查用户是否存在
  async checkUserExist(userName: string): Promise<boolean> {
    // 使用 EXISTS 判断 key 是否存在
    const exists = await withRetry(() =>
      this.client.exists(this.userPwdKey(userName))
    );
    return exists === 1;
  }

  // 修改用户密码
  async changePassword(userName: string, newPassword: string): Promise<void> {
    // 简单存储明文密码，生产环境应加密
    await withRetry(() =>
      this.client.set(this.userPwdKey(userName), newPassword)
    );
  }

  // 删除用户及其所有数据
  async deleteUser(userName: string): Promise<void> {
    const keysToDelete: string[] = [];
    // 删除用户密码
    keysToDelete.push(this.userPwdKey(userName));
    // 删除搜索历史
    keysToDelete.push(this.shKey(userName));

    const patterns = [`u:${userName}:pr:*`, `u:${userName}:fav:*`, `u:${userName}:skip:*`];
    for (const pattern of patterns) {
      let cursor: string = '0'; // <--- FIX: Changed to string '0'
      do {
        const [nextCursor, keys] = await withRetry(() => this.client.scan(cursor, { match: pattern, count: 100 }));
        cursor = nextCursor; // <--- FIX: Now correctly assigns string to string
        keysToDelete.push(...keys);
      } while (cursor !== '0'); // <--- FIX: Changed to string '0'
    }

    if (keysToDelete.length > 0) {
      await withRetry(() => this.client.del(...keysToDelete));
    }
  }

  // ---------- 搜索历史 ----------
  private shKey(user: string) {
    return `u:${user}:sh`; // u:username:sh
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    const result = await withRetry(() =>
      this.client.lrange(this.shKey(userName), 0, -1)
    );
    // 确保返回的都是字符串类型
    return ensureStringArray(result as any[]);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    const key = this.shKey(userName);
    // 先去重
    await withRetry(() => this.client.lrem(key, 0, ensureString(keyword)));
    // 插入到最前
    await withRetry(() => this.client.lpush(key, ensureString(keyword)));
    // 限制最大长度
    await withRetry(() => this.client.ltrim(key, 0, SEARCH_HISTORY_LIMIT - 1));
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    const key = this.shKey(userName);
    if (keyword) {
      await withRetry(() => this.client.lrem(key, 0, ensureString(keyword)));
    } else {
      await withRetry(() => this.client.del(key));
    }
  }

  // ---------- 获取全部用户 ----------
  async getAllUsers(): Promise<string[]> {
    const users: string[] = [];
    let cursor: string = '0'; // <--- FIX: Changed to string '0'
    do {
      const [nextCursor, keys] = await withRetry(() => this.client.scan(cursor, { match: 'u:*:pwd', count: 100 }));
      cursor = nextCursor; // <--- FIX: Now correctly assigns string to string
      const matchedUsers = keys
        .map((k) => {
          const match = k.match(/^u:(.+?):pwd$/);
          return match ? ensureString(match[1]) : undefined;
        })
        .filter((u): u is string => typeof u === 'string');
      users.push(...matchedUsers);
    } while (cursor !== '0'); // <--- FIX: Changed to string '0'
    return users;
  }

  // ---------- 管理员配置 ----------
  private adminConfigKey() {
    return 'admin:config';
  }

  async getAdminConfig(): Promise<AdminConfig | null> {
    const val = await withRetry(() => this.client.get(this.adminConfigKey()));
    if (!val) return null;
    try {
      return (typeof val === 'string' ? JSON.parse(val) : val) as AdminConfig;
    } catch (e) {
      console.error(`[DB] Failed to parse AdminConfig:`, e);
      return null;
    }
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    await withRetry(() => this.client.set(this.adminConfigKey(), config));
  }

  // ---------- 跳过片头片尾配置 ----------
  private skipConfigKey(user: string, source: string, id: string) {
    return `u:${user}:skip:${source}+${id}`;
  }

  async getSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<SkipConfig | null> {
    const val = await withRetry(() =>
      this.client.get(this.skipConfigKey(userName, source, id))
    );
    if (!val) return null;
    try {
      return (typeof val === 'string' ? JSON.parse(val) : val) as SkipConfig;
    } catch (e) {
      console.error(
        `[DB] Failed to parse SkipConfig for key ${source}+${id}:`,
        e
      );
      return null;
    }
  }

  async setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: SkipConfig
  ): Promise<void> {
    await withRetry(() =>
      this.client.set(this.skipConfigKey(userName, source, id), config)
    );
  }

  async deleteSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    await withRetry(() =>
      this.client.del(this.skipConfigKey(userName, source, id))
    );
  }

  async getAllSkipConfigs(
    userName: string
  ): Promise<{ [key: string]: SkipConfig }> {
    const pattern = `u:${userName}:skip:*`;
    const configs: { [key: string]: SkipConfig } = {};
    let cursor: string = '0'; // <--- FIX: Changed to string '0'
    
    do {
      const [nextCursor, keys] = await withRetry(() => this.client.scan(cursor, { match: pattern, count: 100 }));
      cursor = nextCursor; // <--- FIX: Now correctly assigns string to string

      // 批量获取所有配置
      if (keys.length > 0) {
        const values = await withRetry(() => this.client.mget(...keys));
        keys.forEach((key, index) => {
          const value = values[index];
          if (value) {
            try {
              // 从key中提取source+id
              const match = key.match(/^u:.+?:skip:(.+)$/);
              if (match) {
                const sourceAndId = match[1];
                configs[sourceAndId] = (
                  typeof value === 'string' ? JSON.parse(value) : value
                ) as SkipConfig;
              }
            } catch (e) {
              console.error(`[DB] Failed to parse SkipConfig for key ${key}:`, e);
            }
          }
        });
      }
    } while (cursor !== '0'); // <--- FIX: Changed to string '0'

    return configs;
  }

  // 清空所有数据
  async clearAllData(): Promise<void> {
    try {
      // 获取所有用户
      const allUsers = await this.getAllUsers();

      // 删除所有用户及其数据
      for (const username of allUsers) {
        await this.deleteUser(username);
      }

      // 删除管理员配置
      await withRetry(() => this.client.del(this.adminConfigKey()));

      // 删除待审核用户
      await withRetry(() => this.client.del(this.pendingUsersKey()));

      console.log('所有数据已清空');
    } catch (error) {
      console.error('清空数据失败:', error);
      throw new Error('清空数据失败');
    }
  }

  // ---------- 通用缓存方法 ----------
  private cacheKey(key: string) {
    return `cache:${key}`;
  }

  async getCache(key: string): Promise<any | null> {
    try {
      const val = await withRetry(() => this.client.get(this.cacheKey(key)));
      if (!val) return null;
      
      // 智能处理返回值：Upstash 可能返回字符串或已解析的对象
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch (parseError) {
          console.warn(`JSON解析失败，返回原字符串 (key: ${key}):`, parseError);
          return val; // 解析失败返回原字符串
        }
      } else {
        // Upstash 可能直接返回解析后的对象
        return val;
      }
    } catch (error) {
      console.error(`Upstash getCache error (key: ${key}):`, error);
      return null;
    }
  }

  async setCache(key: string, data: any, expireSeconds?: number): Promise<void> {
    const cacheKey = this.cacheKey(key);
    const value = JSON.stringify(data);
    
    if (expireSeconds) {
      await withRetry(() => this.client.setex(cacheKey, expireSeconds, value));
    } else {
      await withRetry(() => this.client.set(cacheKey, value));
    }
  }

  async deleteCache(key: string): Promise<void> {
    await withRetry(() => this.client.del(this.cacheKey(key)));
  }

  async clearExpiredCache(prefix?: string): Promise<void> {
    // Upstash的TTL机制会自动清理过期数据，这里主要用于手动清理
    // 可以根据需要实现特定前缀的缓存清理
    const pattern = prefix ? `cache:${prefix}*` : 'cache:*';
    const keysToDelete: string[] = [];
    let cursor: string = '0'; // <--- FIX: Changed to string '0'
    do {
      const [nextCursor, keys] = await withRetry(() => this.client.scan(cursor, { match: pattern, count: 100 }));
      cursor = nextCursor; // <--- FIX: Now correctly assigns string to string
      keysToDelete.push(...keys);
    } while (cursor !== '0'); // <--- FIX: Changed to string '0'

    if (keysToDelete.length > 0) {
      await withRetry(() => this.client.del(...keysToDelete));
      console.log(`Cleared ${keysToDelete.length} cache entries with pattern: ${pattern}`);
    }
  }

  // ---------- 注册相关方法 ----------
  private pendingUsersKey() {
    return 'admin:pending_users';
  }

  private registrationStatsKey() {
    return 'admin:registration_stats';
  }

  async createPendingUser(username: string, password: string): Promise<void> {
    const pendingUser: PendingUser = {
      username,
      password: password, // 存储明文密码，与主系统保持一致
      registeredAt: Date.now(),
    };

    await withRetry(() =>
      this.client.hset(this.pendingUsersKey(), {
        [username]: JSON.stringify(pendingUser),
      })
    );
  }

  async getPendingUsers(): Promise<PendingUser[]> {
    const result = await withRetry(() =>
      this.client.hgetall(this.pendingUsersKey())
    );

    if (!result) return [];

    const pendingUsers: PendingUser[] = [];
    const usernames = Object.keys(result);

    for (const username of usernames) {
      const userData = result[username];
      if (userData) {
        try {
          const userDataString = ensureString(userData);
          // 检查 userData 是否为有效的 JSON 字符串
          if (userDataString && userDataString !== '[object Object]') {
            const parsed = JSON.parse(userDataString) as PendingUser;
            // 验证解析后的数据结构是否完整
            if (
              parsed &&
              parsed.username &&
              typeof parsed.registeredAt === 'number'
            ) {
              pendingUsers.push(parsed);
            } else {
              console.warn('待审核用户数据结构不完整:', parsed);
              // 清理损坏的数据
              this.client
                .hdel(this.pendingUsersKey(), username)
                .catch((err) => console.error('清理损坏数据失败:', err));
            }
          } else {
            console.warn('待审核用户数据格式无效:', userData);
            // 清理无效数据
            this.client
              .hdel(this.pendingUsersKey(), username)
              .catch((err) => console.error('清理无效数据失败:', err));
          }
        } catch (error) {
          console.error(
            '解析待审核用户数据失败:',
            error,
            'raw data:',
            userData
          );
          // 清理解析失败的损坏数据
          this.client
            .hdel(this.pendingUsersKey(), username)
            .catch((err) => console.error('清理解析失败的数据失败:', err));
        }
      }
    }

    return pendingUsers;
  }

  async approvePendingUser(username: string): Promise<void> {
    // 获取待审核用户数据
    const pendingUserData = await withRetry(() =>
      this.client.hget(this.pendingUsersKey(), username)
    );

    if (!pendingUserData) {
      throw new Error(`Pending user ${username} not found`);
    }

    let pendingUser: PendingUser;
    try {
      const raw = ensureString(pendingUserData);
      pendingUser = (typeof raw === 'string' ? JSON.parse(raw) : raw) as PendingUser;
    } catch (e) {
      console.error(`[DB] Failed to parse PendingUser for ${username}:`, e);
      // 如果解析失败，直接拒绝并删除该损坏的待审核记录
      await this.rejectPendingUser(username);
      throw new Error(`待审核用户 ${username} 的数据已损坏`);
    }

    // 创建正式用户（使用明文密码）
    await this.registerUser(username, pendingUser.password);

    // 删除待审核用户记录
    await withRetry(() => this.client.hdel(this.pendingUsersKey(), username));
  }

  async rejectPendingUser(username: string): Promise<void> {
    await withRetry(() => this.client.hdel(this.pendingUsersKey(), username));
  }

  async getRegistrationStats(): Promise<RegistrationStats> {
    const totalUsers = (await this.getAllUsers()).length;
    const pendingUsers = (await this.getPendingUsers()).length;

    // 简单实现：今日注册数为0（可以后续扩展）
    const todayRegistrations = 0;

    // 从配置中获取最大用户数
    const adminConfig = await this.getAdminConfig();
    const maxUsers = adminConfig?.SiteConfig?.MaxUsers;

    return {
      totalUsers,
      pendingUsers,
      todayRegistrations,
      maxUsers,
    };
  }
}

// 单例 Upstash Redis 客户端
function getUpstashRedisClient(): Redis {
  const globalKey = Symbol.for('__MOONTV_UPSTASH_REDIS_CLIENT__');
  let client: Redis | undefined = (global as any)[globalKey];

  if (!client) {
    const upstashUrl = process.env.UPSTASH_URL;
    const upstashToken = process.env.UPSTASH_TOKEN;

    if (!upstashUrl || !upstashToken) {
      throw new Error(
        'UPSTASH_URL and UPSTASH_TOKEN env variables must be set'
      );
    }

    // 创建 Upstash Redis 客户端
    client = new Redis({
      url: upstashUrl,
      token: upstashToken,
      // 可选配置
      retry: {
        retries: 3,
        backoff: (retryCount: number) =>
          Math.min(1000 * Math.pow(2, retryCount), 30000),
      },
    });

    console.log('Upstash Redis client created successfully');

    (global as any)[globalKey] = client;
  }

  return client;
}
