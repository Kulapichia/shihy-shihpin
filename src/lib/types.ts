import { AdminConfig, PendingUser, RegistrationStats } from './admin.types';

// 播放记录数据结构
export interface PlayRecord {
  title: string;
  source_name: string;
  cover: string;
  year: string;
  index: number; // 第几集
  total_episodes: number; // 总集数
  original_episodes?: number; // 首次观看时的原始集数
  play_time: number; // 播放进度（秒）
  total_time: number; // 总进度（秒）
  save_time: number; // 记录保存时间（时间戳）
  search_title: string; // 搜索时使用的标题
  remarks?: string; // 备注信息（如"已完结"、"更新至20集"等）
}

// 收藏数据结构
export interface Favorite {
  source_name: string;
  total_episodes: number; // 总集数
  title: string;
  year: string;
  cover: string;
  save_time: number; // 记录保存时间（时间戳）
  search_title: string; // 搜索时使用的标题
  origin?: 'vod' | 'live' | 'shortdrama';
}

// ---- 跳过配置（多片段支持）----

// 单个跳过片段
export interface SkipSegment {
  start: number; // 开始时间（秒）
  end: number; // 结束时间（秒）
  type: 'opening' | 'ending'; // 片头或片尾
  title?: string; // 可选的描述
  autoSkip?: boolean; // 是否自动跳过（默认true）
  autoNextEpisode?: boolean; // 片尾是否自动跳转下一集（默认true，仅对ending类型有效）
  mode?: 'absolute' | 'remaining'; // 时间模式：absolute=绝对时间，remaining=剩余时间
  remainingTime?: number; // 剩余时间（秒），仅在mode=remaining时有效
}

// 剧集跳过配置 (替代旧的 SkipConfig)
export interface EpisodeSkipConfig {
  source: string; // 资源站标识
  id: string; // 剧集ID
  title: string; // 剧集标题
  segments: SkipSegment[]; // 跳过片段列表
  updated_time: number; // 最后更新时间
}

// 存储接口
export interface IStorage {
  // 播放记录相关
  getPlayRecord(userName: string, key: string): Promise<PlayRecord | null>;
  setPlayRecord(
    userName: string,
    key: string,
    record: PlayRecord
  ): Promise<void>;
  getAllPlayRecords(userName: string): Promise<{ [key: string]: PlayRecord }>;
  deletePlayRecord(userName: string, key: string): Promise<void>;

  // 收藏相关
  getFavorite(userName: string, key: string): Promise<Favorite | null>;
  setFavorite(userName: string, key: string, favorite: Favorite): Promise<void>;
  getAllFavorites(userName: string): Promise<{ [key: string]: Favorite }>;
  deleteFavorite(userName: string, key: string): Promise<void>;

  // 用户相关
  registerUser(userName: string, password: string): Promise<void>;
  verifyUser(userName: string, password: string): Promise<boolean>;
  // 检查用户是否存在（无需密码）
  checkUserExist(userName: string): Promise<boolean>;
  // 修改用户密码
  changePassword(userName: string, newPassword: string): Promise<void>;
  // 删除用户（包括密码、搜索历史、播放记录、收藏夹）
  deleteUser(userName: string): Promise<void>;

  // 搜索历史相关
  getSearchHistory(userName: string): Promise<string[]>;
  addSearchHistory(userName: string, keyword: string): Promise<void>;
  deleteSearchHistory(userName: string, keyword?: string): Promise<void>;

  // 用户列表
  getAllUsers(): Promise<string[]>;

  // 管理员配置相关
  getAdminConfig(): Promise<AdminConfig | null>;
  setAdminConfig(config: AdminConfig): Promise<void>;

  // 跳过片头片尾配置相关
  getSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<EpisodeSkipConfig | null>; // 使用新的 EpisodeSkipConfig
  setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: EpisodeSkipConfig // 使用新的 EpisodeSkipConfig
  ): Promise<void>;
  deleteSkipConfig(userName: string, source: string, id: string): Promise<void>;
  getAllSkipConfigs(userName: string): Promise<{ [key: string]: EpisodeSkipConfig }>; // 使用新的 EpisodeSkipConfig

  // 数据清理相关
  clearAllData(): Promise<void>;

  // 通用缓存相关
  getCache(key: string): Promise<any | null>;
  setCache(key: string, data: any, expireSeconds?: number): Promise<void>;
  deleteCache(key: string): Promise<void>;
  clearExpiredCache(prefix?: string): Promise<void>;

  // 注册相关方法
  createPendingUser(username: string, password: string): Promise<void>;
  getPendingUsers(): Promise<PendingUser[]>;
  approvePendingUser(username: string): Promise<void>;
  rejectPendingUser(username: string): Promise<void>;
  getRegistrationStats(): Promise<RegistrationStats>;
  
  // 播放统计相关
  isStatsSupported?(): boolean;
  getUserPlayStat?(userName: string): Promise<any>;
}

// 搜索结果数据结构
export interface SearchResult {
  id: string;
  title: string;
  poster: string;
  episodes: string[];
  episodes_titles: string[];
  source: string;
  source_name: string;
  class?: string;
  year: string;
  desc?: string;
  type_name?: string;
  douban_id?: number;
  isYellow?: boolean;
  remarks?: string; // 备注信息（如"已完结"、"更新至20集"等）
}

// 豆瓣数据结构
export interface DoubanItem {
  id: string;
  title: string;
  poster: string;
  rate: string;
  year: string;
}

export interface DoubanResult {
  code: number;
  message: string;
  list: DoubanItem[];
}

// 跳过片头片尾配置数据结构 (旧的，将被 EpisodeSkipConfig 替代)
export interface SkipConfig {
  enable: boolean; // 是否启用跳过片头片尾
  intro_time: number; // 片头时间（秒）
  outro_time: number; // 片尾时间（秒）
}

// 短剧相关类型定义
export interface ShortDramaItem {
  id: number;
  title: string;
  cover: string;
  category: string;
  description: string;
}

export interface ShortDramaCategory {
  type_id: number;
  type_name: string;
}
