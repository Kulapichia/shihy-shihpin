/* eslint-disable @typescript-eslint/no-explicit-any */

import { API_CONFIG, ApiSite, getConfig } from '@/lib/config';
import { getCachedSearchPage, setCachedSearchPage } from '@/lib/search-cache';
import { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';

interface ApiSearchItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}

/**
 * 通用的带缓存搜索函数
 */
async function searchWithCache(
  apiSite: ApiSite,
  query: string,
  page: number,
  url: string,
  timeoutMs = 8000
): Promise<{ results: SearchResult[]; pageCount?: number }> {
  // 先查缓存
  const cached = getCachedSearchPage(apiSite.key, query, page);
  if (cached) {
    if (cached.status === 'ok') {
      return { results: cached.data, pageCount: cached.pageCount };
    } else {
      return { results: [] };
    }
  }

  // 缓存未命中，发起网络请求
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: API_CONFIG.search.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 403) {
        setCachedSearchPage(apiSite.key, query, page, 'forbidden', []);
      }
      return { results: [] };
    }

    const data = await response.json();
    if (
      !data ||
      !data.list ||
      !Array.isArray(data.list) ||
      data.list.length === 0
    ) {
      // 空结果不做负缓存要求，这里不写入缓存
      return { results: [] };
    }

    // 处理结果数据
    const allResults = data.list.map((item: ApiSearchItem) => {
      let episodes: string[] = [];
      let titles: string[] = [];

      // 使用正则表达式从 vod_play_url 提取 m3u8 链接
      if (item.vod_play_url) {
        // 先用 $$$ 分割
        const vod_play_url_array = item.vod_play_url.split('$$$');
        // 分集之间#分割，标题和播放链接 $ 分割
        vod_play_url_array.forEach((url: string) => {
          const matchEpisodes: string[] = [];
          const matchTitles: string[] = [];
          const title_url_array = url.split('#');
          title_url_array.forEach((title_url: string) => {
            const episode_title_url = title_url.split('$');
            if (
              episode_title_url.length === 2 &&
              episode_title_url[1].endsWith('.m3u8')
            ) {
              matchTitles.push(episode_title_url[0]);
              matchEpisodes.push(episode_title_url[1]);
            }
          });
          if (matchEpisodes.length > episodes.length) {
            episodes = matchEpisodes;
            titles = matchTitles;
          }
        });
      }

      return {
        id: item.vod_id.toString(),
        title: item.vod_name.trim().replace(/\s+/g, ' '),
        poster: item.vod_pic,
        episodes,
        episodes_titles: titles,
        source: apiSite.key,
        source_name: apiSite.name,
        class: item.vod_class,
        year: item.vod_year
          ? item.vod_year.match(/\d{4}/)?.[0] || ''
          : 'unknown',
        desc: cleanHtmlTags(item.vod_content || ''),
        type_name: item.type_name,
        douban_id: item.vod_douban_id,
      };
    });

    // 过滤掉集数为 0 的结果
    const results = allResults.filter(
      (result: SearchResult) => result.episodes.length > 0
    );

    const pageCount = page === 1 ? data.pagecount || 1 : undefined;
    // 写入缓存（成功）
    setCachedSearchPage(apiSite.key, query, page, 'ok', results, pageCount);
    return { results, pageCount };
  } catch (error: any) {
    clearTimeout(timeoutId);
    // 识别被 AbortController 中止（超时）
    const aborted =
      error?.name === 'AbortError' ||
      error?.code === 20 ||
      error?.message?.includes('aborted');
    if (aborted) {
      setCachedSearchPage(apiSite.key, query, page, 'timeout', []);
    }
    return { results: [] };
  }
}

// 这个函数现在只负责获取单页数据
export async function searchFromApi(
  apiSite: ApiSite,
  query: string,
  page = 1
): Promise<{ results: SearchResult[]; pageCount?: number }> {
  try {
    const apiBaseUrl = apiSite.api;
    const apiUrl =
      apiBaseUrl +
      API_CONFIG.search.pagePath
        .replace('{query}', encodeURIComponent(query))
        .replace('{page}', page.toString());
    
    return await searchWithCache(
      apiSite,
      query,
      page,
      apiUrl,
      8000
    );
  } catch (error) {
    return { results: [] };
  }
}

// 这是新的 searchFromAll 函数，它包含了多页获取逻辑
export async function* searchFromAll(keyword: string) {
    const config = await getConfig();
    const sites = Object.values(config.SourceConfig).filter(s => !s.disabled);

    const promises = sites.map(async (site) => {
        // Step 1: Fetch the first page to get results and page count
        const firstPageResult = await searchFromApi(site, keyword, 1);
        const allSiteResults = firstPageResult.results;
        
        // 如果第一页有结果，并且返回了总页数，则继续获取后续页面
        if (allSiteResults.length > 0 && firstPageResult.pageCount) {
            const config = await getConfig();
            const MAX_SEARCH_PAGES: number = config.SiteConfig.SearchDownstreamMaxPage;
            const totalPages = firstPageResult.pageCount;
            const pagesToFetch = Math.min(totalPages - 1, MAX_SEARCH_PAGES - 1);

            if (pagesToFetch > 0) {
                const pagePromises = [];
                for (let i = 2; i <= pagesToFetch + 1; i++) {
                    pagePromises.push(searchFromApi(site, keyword, i));
                }
                const subsequentResults = await Promise.all(pagePromises);
                subsequentResults.forEach(pageResult => {
                    allSiteResults.push(...pageResult.results);
                });
            }
        }
        return allSiteResults;
    });

    for (const p of promises) {
        try {
            const results = await p;
            if (results.length > 0) {
                yield results;
            }
        } catch (error) {
            // ignore
        }
    }
}


// 匹配 m3u8 链接的正则
const M3U8_PATTERN = /(https?:\/\/[^"'\s]+?\.m3u8)/g;

export async function getDetailFromApi(
  apiSite: ApiSite,
  id: string
): Promise<SearchResult> {
  if (apiSite.detail) {
    return handleSpecialSourceDetail(id, apiSite);
  }

  const detailUrl = `${apiSite.api}${API_CONFIG.detail.path}${id}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(detailUrl, {
    headers: API_CONFIG.detail.headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`详情请求失败: ${response.status}`);
  }

  const data = await response.json();

  if (
    !data ||
    !data.list ||
    !Array.isArray(data.list) ||
    data.list.length === 0
  ) {
    throw new Error('获取到的详情内容无效');
  }

  const videoDetail = data.list[0];
  let episodes: string[] = [];
  let titles: string[] = [];

  // 处理播放源拆分
  if (videoDetail.vod_play_url) {
    // 先用 $$$ 分割
    const vod_play_url_array = videoDetail.vod_play_url.split('$$$');
    // 分集之间#分割，标题和播放链接 $ 分割
    vod_play_url_array.forEach((url: string) => {
      const matchEpisodes: string[] = [];
      const matchTitles: string[] = [];
      const title_url_array = url.split('#');
      title_url_array.forEach((title_url: string) => {
        const episode_title_url = title_url.split('$');
        if (
          episode_title_url.length === 2 &&
          episode_title_url[1].endsWith('.m3u8')
        ) {
          matchTitles.push(episode_title_url[0]);
          matchEpisodes.push(episode_title_url[1]);
        }
      });
      if (matchEpisodes.length > episodes.length) {
        episodes = matchEpisodes;
        titles = matchTitles;
      }
    });
  }

  // 如果播放源为空，则尝试从内容中解析 m3u8
  if (episodes.length === 0 && videoDetail.vod_content) {
    const matches = videoDetail.vod_content.match(M3U8_PATTERN) || [];
    episodes = matches.map((link: string) => link.replace(/^\$/, ''));
  }

  return {
    id: id.toString(),
    title: videoDetail.vod_name,
    poster: videoDetail.vod_pic,
    episodes,
    episodes_titles: titles,
    source: apiSite.key,
    source_name: apiSite.name,
    class: videoDetail.vod_class,
    year: videoDetail.vod_year
      ? videoDetail.vod_year.match(/\d{4}/)?.[0] || ''
      : 'unknown',
    desc: cleanHtmlTags(videoDetail.vod_content),
    type_name: videoDetail.type_name,
    douban_id: videoDetail.vod_douban_id,
  };
}

async function handleSpecialSourceDetail(
  id: string,
  apiSite: ApiSite
): Promise<SearchResult> {
  const detailUrl = `${apiSite.detail}/index.php/vod/detail/id/${id}.html`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(detailUrl, {
    headers: API_CONFIG.detail.headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`详情页请求失败: ${response.status}`);
  }

  const html = await response.text();
  let matches: string[] = [];

  if (apiSite.key === 'ffzy') {
    const ffzyPattern =
      /\$(https?:\/\/[^"'\s]+?\/\d{8}\/\d+_[a-f0-9]+\/index\.m3u8)/g;
    matches = html.match(ffzyPattern) || [];
  }

  if (matches.length === 0) {
    const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
    matches = html.match(generalPattern) || [];
  }

  // 去重并清理链接前缀
  matches = Array.from(new Set(matches)).map((link: string) => {
    link = link.substring(1); // 去掉开头的 $
    const parenIndex = link.indexOf('(');
    return parenIndex > 0 ? link.substring(0, parenIndex) : link;
  });

  // 根据 matches 数量生成剧集标题
  const episodes_titles = Array.from({ length: matches.length }, (_, i) =>
    (i + 1).toString()
  );

  // 提取标题
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const titleText = titleMatch ? titleMatch[1].trim() : '';

  // 提取描述
  const descMatch = html.match(
    /<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/
  );
  const descText = descMatch ? cleanHtmlTags(descMatch[1]) : '';

  // 提取封面
  const coverMatch = html.match(/(https?:\/\/[^"'\s]+?\.jpg)/g);
  const coverUrl = coverMatch ? coverMatch[0].trim() : '';

  // 提取年份
  const yearMatch = html.match(/>(\d{4})</);
  const yearText = yearMatch ? yearMatch[1] : 'unknown';

  return {
    id,
    title: titleText,
    poster: coverUrl,
    episodes: matches,
    episodes_titles,
    source: apiSite.key,
    source_name: apiSite.name,
    class: '',
    year: yearText,
    desc: descText,
    type_name: '',
    douban_id: 0,
  };
}
