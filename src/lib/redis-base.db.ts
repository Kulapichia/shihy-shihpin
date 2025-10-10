/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { createClient, RedisClientType } from 'redis';

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

// 连接配置接口
export interface RedisConnectionConfig {
  url: string;
  clientName: string; // 用于日志显示，如 "Redis" 或 "Pika"
}

// 添加Redis操作重试包装器
function createRetryWrapper(
  clientName: string,
  getClient: () => RedisClientType
) {
  return async function withRetry<T>(
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
          err.code === 'EPIPE';

        if (isConnectionError && !isLastAttempt) {
          console.log(
            `${clientName} operation failed, retrying... (${
              i + 1
            }/${maxRetries})`
          );
          console.error('Error:', err.message);

          // 等待一段时间后重试
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));

          // 尝试重新连接
          try {
            const client = getClient();
            if (!client.isOpen) {
              await client.connect();
            }
          } catch (reconnectErr) {
            console.error('Failed to reconnect:', reconnectErr);
          }

          continue;
        }

        throw err;
      }
    }

    throw new Error('Max retries exceeded');
  };
}

// 创建客户端的工厂函数
export function createRedisClient(
  config: RedisConnectionConfig,
  globalSymbol: symbol
): RedisClientType {
  let client: RedisClientType | undefined = (global as any)[globalSymbol];

  if (!client) {
    if (!config.url) {
      throw new Error(`${config.clientName}_URL env variable not set`);
    }

    // 创建客户端配置
    const clientConfig: any = {
      url: config.url,
      socket: {
        // 重连策略：指数退避，最大30秒
        reconnectStrategy: (retries: number) => {
          console.log(
            `${config.clientName} reconnection attempt ${retries + 1}`
          );
          if (retries > 10) {
            console.error(
              `${config.clientName} max reconnection attempts exceeded`
            );
            return false; // 停止重连
          }
          return Math.min(1000 * Math.pow(2, retries), 30000); // 指数退避，最大30秒
        },
        connectTimeout: 10000, // 10秒连接超时
        // 设置no delay，减少延迟
        noDelay: true,
      },
      // 添加其他配置
      pingInterval: 30000, // 30秒ping一次，保持连接活跃
    };

    client = createClient(clientConfig);

    // 添加错误事件监听
    client.on('error', (err) => {
      console.error(`${config.clientName} client error:`, err);
    });

    client.on('connect', () => {
      console.log(`${config.clientName} connected`);
    });

    client.on('reconnecting', () => {
      console.log(`${config.clientName} reconnecting...`);
    });

    client.on('ready', () => {
      console.log(`${config.clientName} ready`);
    });

    // 初始连接，带重试机制
    const connectWithRetry = async () => {
      try {
        await client!.connect();
        console.log(`${config.clientName} connected successfully`);
      } catch (err) {
        console.error(`${config.clientName} initial connection failed:`, err);
        console.log('Will retry in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
      }
    };

    connectWithRetry();

    (global as any)[globalSymbol] = client;
  }

  return client;
}

// 抽象基类，包含所有通用的Redis操作逻辑
export abstract class BaseRedisStorage implements IStorage {
  protected client: RedisClientType;
  protected config: RedisConnectionConfig;
  protected withRetry: <T>(
    operation: () => Promise<T>,
    maxRetries?: number
  ) => Promise<T>;

  constructor(config: RedisConnectionConfig, globalSymbol: symbol) {
    this.config = config;
    this.client = createRedisClient(config, globalSymbol);
    this.withRetry = createRetryWrapper(config.clientName, () => this.client);
  }

  // ---------- 播放记录 ----------
  private prKey(user: string, key: string) {
    return `u:${user}:pr:${key}`; // u:username:pr:source+id
  }

  async getPlayRecord(
    userName: string,
    key: string
  ): Promise<PlayRecord | null> {
    const val = await this.withRetry(() =>
      this.client.get(this.prKey(userName, key))
    );
    if (!val) return null;
    try {
      return JSON.parse(val) as PlayRecord;
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
    await this.withRetry(() =>
      this.client.set(this.prKey(userName, key), JSON.stringify(record))
    );
  }

  async getAllPlayRecords(
    userName: string
  ): Promise<Record<string, PlayRecord>> {
    const pattern = `u:${userName}:pr:*`;
    const keys: string[] = [];
    for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }

    if (keys.length === 0) return {};
    const values = await this.withRetry(() => this.client.mGet(keys));
    const result: Record<string, PlayRecord> = {};
    keys.forEach((fullKey: string, idx: number) => {
      const raw = values[idx];
      if (raw) {
        try {
          const rec = JSON.parse(raw) as PlayRecord;
          // 截取 source+id 部分
          const keyPart = ensureString(
            fullKey.replace(`u:${userName}:pr:`, '')
          );
          result[keyPart] = rec;
        } catch (e) {
          console.error(`[DB] Failed to parse PlayRecord for key ${fullKey}:`, e);
        }
      }
    });
    return result;
  }


  async deletePlayRecord(userName: string, key: string): Promise<void> {
    await this.withRetry(() => this.client.del(this.prKey(userName, key)));
  }

  // ---------- 收藏 ----------
  private favKey(user: string, key: string) {
    return `u:${user}:fav:${key}`;
  }

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const val = await this.withRetry(() =>
      this.client.get(this.favKey(userName, key))
    );
    if (!val) return null;
    try {
      return JSON.parse(val) as Favorite;
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
    await this.withRetry(() =>
      this.client.set(this.favKey(userName, key), JSON.stringify(favorite))
    );
  }

  async getAllFavorites(userName: string): Promise<Record<string, Favorite>> {
    const pattern = `u:${userName}:fav:*`;
    const keys: string[] = [];
    for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }
    
    if (keys.length === 0) return {};
    const values = await this.withRetry(() => this.client.mGet(keys));
    const result: Record<string, Favorite> = {};
    keys.forEach((fullKey: string, idx: number) => {
      const raw = values[idx];
      if (raw) {
        try {
          const fav = JSON.parse(raw) as Favorite;
          const keyPart = ensureString(
            fullKey.replace(`u:${userName}:fav:`, '')
          );
          result[keyPart] = fav;
        } catch (e) {
          console.error(`[DB] Failed to parse Favorite for key ${fullKey}:`, e);
        }
      }
    });
    return result;
  }


  async deleteFavorite(userName: string, key: string): Promise<void> {
    await this.withRetry(() => this.client.del(this.favKey(userName, key)));
  }

  // ---------- 用户注册 / 登录 ----------
  private userPwdKey(user: string) {
    return `u:${user}:pwd`;
  }

  async registerUser(userName: string, password: string): Promise<void> {
    // 简单存储明文密码，生产环境应加密
    await this.withRetry(() =>
      this.client.set(this.userPwdKey(userName), password)
    );
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const stored = await this.withRetry(() =>
      this.client.get(this.userPwdKey(userName))
    );
    if (stored === null) return false;
    // 确保比较时都是字符串类型
    return ensureString(stored) === password;
  }

  // 检查用户是否存在
  async checkUserExist(userName: string): Promise<boolean> {
    // 使用 EXISTS 判断 key 是否存在
    const exists = await this.withRetry(() =>
      this.client.exists(this.userPwdKey(userName))
    );
    return exists === 1;
  }

  // 修改用户密码
  async changePassword(userName: string, newPassword: string): Promise<void> {
    // 简单存储明文密码，生产环境应加密
    await this.withRetry(() =>
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
    
    // 删除播放记录
    for await (const key of this.client.scanIterator({ MATCH: `u:${userName}:pr:*`, COUNT: 100 })) {
      keysToDelete.push(key);
    }
    // 删除收藏夹
    for await (const key of this.client.scanIterator({ MATCH: `u:${userName}:fav:*`, COUNT: 100 })) {
      keysToDelete.push(key);
    }
    // 删除跳过片头片尾配置
    for await (const key of this.client.scanIterator({ MATCH: `u:${userName}:skip:*`, COUNT: 100 })) {
      keysToDelete.push(key);
    }
    
    if (keysToDelete.length > 0) {
      await this.withRetry(() => this.client.del(keysToDelete));
    }
  }

  // ---------- 搜索历史 ----------
  private shKey(user: string) {
    return `u:${user}:sh`; // u:username:sh
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    const result = await this.withRetry(() =>
      this.client.lRange(this.shKey(userName), 0, -1)
    );
    // 确保返回的都是字符串类型
    return ensureStringArray(result as any[]);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    const key = this.shKey(userName);
    // 先去重
    await this.withRetry(() => this.client.lRem(key, 0, ensureString(keyword)));
    // 插入到最前
    await this.withRetry(() => this.client.lPush(key, ensureString(keyword)));
    // 限制最大长度
    await this.withRetry(() =>
      this.client.lTrim(key, 0, SEARCH_HISTORY_LIMIT - 1)
    );
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    const key = this.shKey(userName);
    if (keyword) {
      await this.withRetry(() =>
        this.client.lRem(key, 0, ensureString(keyword))
      );
    } else {
      await this.withRetry(() => this.client.del(key));
    }
  }

  // ---------- 获取全部用户 ----------
  async getAllUsers(): Promise<string[]> {
    const users: string[] = [];
    for await (const key of this.client.scanIterator({ MATCH: 'u:*:pwd', COUNT: 100 })) {
      const match = key.match(/^u:(.+?):pwd$/);
      if (match) {
        users.push(ensureString(match[1]));
      }
    }
    return users;
  }

  // ---------- 管理员配置 ----------
  private adminConfigKey() {
    return 'admin:config';
  }

  async getAdminConfig(): Promise<AdminConfig | null> {
    const val = await this.withRetry(() =>
      this.client.get(this.adminConfigKey())
    );
    if (!val) return null;
    try {
      return JSON.parse(val) as AdminConfig;
    } catch (e) {
      console.error(`[DB] Failed to parse AdminConfig:`, e);
      return null;
    }
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    await this.withRetry(() =>
      this.client.set(this.adminConfigKey(), JSON.stringify(config))
    );
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
    const val = await this.withRetry(() =>
      this.client.get(this.skipConfigKey(userName, source, id))
    );
    if (!val) return null;
    try {
      return JSON.parse(val) as SkipConfig;
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
    await this.withRetry(() =>
      this.client.set(
        this.skipConfigKey(userName, source, id),
        JSON.stringify(config)
      )
    );
  }

  async deleteSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    await this.withRetry(() =>
      this.client.del(this.skipConfigKey(userName, source, id))
    );
  }

  async getAllSkipConfigs(
    userName: string
  ): Promise<{ [key: string]: SkipConfig }> {
    const pattern = `u:${userName}:skip:*`;
    const keys: string[] = [];
    for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }

    if (keys.length === 0) {
      return {};
    }

    const configs: { [key: string]: SkipConfig } = {};

    // 批量获取所有配置
    const values = await this.withRetry(() => this.client.mGet(keys));

    keys.forEach((key, index) => {
      const value = values[index];
      if (value) {
        try {
          // 从key中提取source+id
          const match = key.match(/^u:.+?:skip:(.+)$/);
          if (match) {
            const sourceAndId = match[1];
            configs[sourceAndId] = JSON.parse(value as string) as SkipConfig;
          }
        } catch (e) {
          console.error(`[DB] Failed to parse SkipConfig for key ${key}:`, e);
        }
      }
    });

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
      await this.withRetry(() => this.client.del(this.adminConfigKey()));

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
      const val = await this.withRetry(() => this.client.get(this.cacheKey(key)));
      if (!val) return null;

      // 智能处理返回值：兼容不同Redis客户端的行为
      if (typeof val === 'string') {
        // 检查是否是HTML错误页面
        if (val.trim().startsWith('<!DOCTYPE') || val.trim().startsWith('<html')) {
          console.error(`${this.config.clientName} returned HTML instead of JSON. Connection issue detected.`);
          return null;
        }

        try {
          return JSON.parse(val);
        } catch (parseError) {
          console.warn(`${this.config.clientName} JSON解析失败，返回原字符串 (key: ${key}):`, parseError);
          return val; // 解析失败返回原字符串
        }
      } else {
        // 某些Redis客户端可能直接返回解析后的对象
        return val;
      }
    } catch (error: any) {
      console.error(`${this.config.clientName} getCache error (key: ${key}):`, error);
      return null;
    }
  }

  async setCache(key: string, data: any, expireSeconds?: number): Promise<void> {
    try {
      const cacheKey = this.cacheKey(key);
      const value = JSON.stringify(data);

      if (expireSeconds) {
        await this.withRetry(() => this.client.setEx(cacheKey, expireSeconds, value));
      } else {
        await this.withRetry(() => this.client.set(cacheKey, value));
      }
    } catch (error) {
      console.error(`${this.config.clientName} setCache error (key: ${key}):`, error);
      throw error; // 重新抛出错误以便上层处理
    }
  }

  async deleteCache(key: string): Promise<void> {
    await this.withRetry(() => this.client.del(this.cacheKey(key)));
  }

  async clearExpiredCache(prefix?: string): Promise<void> {
    // Redis的TTL机制会自动清理过期数据，这里主要用于手动清理
    // 可以根据需要实现特定前缀的缓存清理
    const pattern = prefix ? `cache:${prefix}*` : 'cache:*';
    const keys: string[] = [];
    for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }

    if (keys.length > 0) {
      await this.withRetry(() => this.client.del(keys));
      console.log(`Cleared ${keys.length} cache entries with pattern: ${pattern}`);
    }
  }

  // ---------- 注册相关方法 ----------
  private pendingUserKey(username: string) {
    return `pending:user:${username}`;
  }

  private registrationStatsKey() {
    return 'registration:stats';
  }

  async createPendingUser(username: string, password: string): Promise<void> {
    const pendingUser: PendingUser = {
      username,
      registeredAt: Date.now(),
      password: password, // 存储明文密码，与主系统保持一致
    };

    await this.withRetry(() =>
      this.client.set(
        this.pendingUserKey(username),
        JSON.stringify(pendingUser)
      )
    );

    // 更新今日注册统计
    const today = new Date().toISOString().split('T')[0];
    const todayKey = `registration:today:${today}`;
    await this.withRetry(() => this.client.incr(todayKey));
    await this.withRetry(() => this.client.expire(todayKey, 24 * 60 * 60)); // 24小时过期
  }

  async getPendingUsers(): Promise<PendingUser[]> {
    const pattern = 'pending:user:*';
    const keys: string[] = [];
    for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }
    
    if (keys.length === 0) return [];

    const values = await this.withRetry(() => this.client.mGet(keys));
    const pendingUsers: PendingUser[] = [];

    values.forEach((raw, index) => {
      if (raw) {
        try {
          // 检查 raw 是否为有效的 JSON 字符串
          if (typeof raw === 'string' && raw !== '[object Object]') {
            const parsed = JSON.parse(raw) as PendingUser;
            // 验证解析后的数据结构是否完整
            if (
              parsed &&
              parsed.username &&
              typeof parsed.registeredAt === 'number'
            ) {
              pendingUsers.push(parsed);
            } else {
              console.warn('待审核用户数据结构不完整:', parsed);
              // 可选：清理损坏的数据
              const keyToClean = keys[index];
              if (keyToClean) {
                this.withRetry(() => this.client.del(keyToClean)).catch((err) =>
                  console.error('清理损坏数据失败:', err)
                );
              }
            }
          } else {
            console.warn('待审核用户数据格式无效:', raw);
            // 清理无效数据
            const keyToClean = keys[index];
            if (keyToClean) {
              this.withRetry(() => this.client.del(keyToClean)).catch((err) =>
                console.error('清理无效数据失败:', err)
              );
            }
          }
        } catch (error) {
          console.error('解析待审核用户数据失败:', error, 'raw data:', raw);
          // 清理解析失败的损坏数据
          const keyToClean = keys[index];
          if (keyToClean) {
            this.withRetry(() => this.client.del(keyToClean)).catch((err) =>
              console.error('清理解析失败的数据失败:', err)
            );
          }
        }
      }
    });

    return pendingUsers.sort((a, b) => a.registeredAt - b.registeredAt);
  }

  async approvePendingUser(username: string): Promise<void> {
    // 获取待审核用户信息
    const pendingData = await this.withRetry(() =>
      this.client.get(this.pendingUserKey(username))
    );

    if (!pendingData) {
      throw new Error('待审核用户不存在');
    }

    let pendingUser: PendingUser;
    try {
      pendingUser = JSON.parse(pendingData);
    } catch (e) {
      console.error(`[DB] Failed to parse PendingUser for ${username}:`, e);
      // 如果解析失败，直接拒绝并删除该损坏的待审核记录
      await this.rejectPendingUser(username);
      throw new Error(`待审核用户 ${username} 的数据已损坏`);
    }

    // 创建正式用户账号（使用明文密码）
    await this.withRetry(() =>
      this.client.set(this.userPwdKey(username), pendingUser.password)
    );

    // 删除待审核记录
    await this.withRetry(() => this.client.del(this.pendingUserKey(username)));

    console.log(`用户 ${username} 注册审核通过`);
  }

  async rejectPendingUser(username: string): Promise<void> {
    const exists = await this.withRetry(() =>
      this.client.exists(this.pendingUserKey(username))
    );

    if (exists === 0) {
      throw new Error('待审核用户不存在');
    }

    await this.withRetry(() => this.client.del(this.pendingUserKey(username)));
    console.log(`用户 ${username} 注册申请已拒绝`);
  }

  async getRegistrationStats(): Promise<RegistrationStats> {
    // 获取总用户数
    const allUsers = await this.getAllUsers();
    const totalUsers = allUsers.length;

    // 获取待审核用户数
    const pendingUsers = await this.getPendingUsers();
    const pendingCount = pendingUsers.length;

    // 获取今日注册数
    const today = new Date().toISOString().split('T')[0];
    const todayKey = `registration:today:${today}`;
    const todayCount = await this.withRetry(() => this.client.get(todayKey));
    const todayRegistrations = todayCount ? parseInt(todayCount) : 0;

    // 从配置中获取最大用户数限制
    const adminConfig = await this.getAdminConfig();
    const maxUsers = adminConfig?.SiteConfig?.MaxUsers;

    return {
      totalUsers,
      maxUsers,
      pendingUsers: pendingCount,
      todayRegistrations,
    };
  }
  
  // ---------- 播放统计 ----------
  isStatsSupported(): boolean {
    return true; // Redis, Upstash, Kvrocks 都支持
  }

  async getUserPlayStat(userName: string): Promise<any> {
    const records = await this.getAllPlayRecords(userName);
    const stats = {
      totalPlays: Object.keys(records).length,
      totalWatchTime: 0,
      lastPlayTime: 0,
      firstWatchDate: 0,
      totalMovies: 0,
    };

    let firstWatch = Infinity;
    const movies = new Set<string>();

    Object.values(records).forEach(record => {
      stats.totalWatchTime += record.play_time;
      if (record.save_time > stats.lastPlayTime) {
        stats.lastPlayTime = record.save_time;
      }
      if (record.save_time < firstWatch) {
        firstWatch = record.save_time;
      }
      movies.add(record.title);
    });

    stats.firstWatchDate = firstWatch === Infinity ? 0 : firstWatch;
    stats.totalMovies = movies.size;
    stats.lastPlayTime *= 1000; // to ms
    stats.firstWatchDate *= 1000; // to ms

    return stats;
  }  
}
