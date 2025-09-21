/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
import { fetch as undiciFetch, RequestInit, Agent } from 'undici';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { moderateContent, decisionThresholds } from '@/lib/yellow';
import { checkImageWithSightengine } from '@/lib/sightengine-client';
import { checkImageWithBaidu } from '@/lib/baidu-client';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  console.log('[WS Search API] Request received:', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    timestamp: new Date().toISOString()
  });

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    console.log('[WS Search API] Authorization failed:', authInfo);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[WS Search API] User authenticated:', authInfo.username);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  console.log('[WS Search API] Query parameter:', query);

  if (!query) {
    console.log('[WS Search API] Empty query, returning error');
    return new Response(JSON.stringify({ error: '搜索关键词不能为空' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const config = await getConfig();
  let apiSites = await getAvailableApiSites(authInfo.username);
  
  console.log('[WS Search API] Original sites loaded:', apiSites.map(site => ({ 
    key: site.key, 
    name: site.name, 
    disabled: site.disabled,
    lastCheck: site.lastCheck ? { status: site.lastCheck.status, latency: site.lastCheck.latency } : null
  })));

  // 过滤掉被管理员手动禁用的源
  apiSites = apiSites.filter(site => !site.disabled);
  console.log('[WS Search API] After filtering disabled sites:', apiSites.length, 'sites remain');
  
  // --- 智能排序逻辑 ---
  // 对视频源进行智能排序，确保优先搜索最健康的源
  apiSites.sort((a, b) => {
    const getPriority = (site: typeof a) => {
      if (!site.lastCheck || site.lastCheck.status === 'untested') {
        return 1; // 未测试的源，优先级中等
      }
      switch (site.lastCheck.status) {
        case 'valid':
          return 0; // 健康的源，优先级最高
        case 'no_results':
          return 1; // 能通但搜不到结果，优先级中等
        case 'invalid':
        case 'timeout':
        case 'unreachable':
          return 2; // 不健康的源，优先级最低
        default:
          return 1; // 其他情况默认为中等
      }
    };
    
    const priorityA = getPriority(a);
    const priorityB = getPriority(b);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB; // 按优先级分组
    }
    
    // 如果优先级相同（都是健康源），则按延迟排序
    if (priorityA === 0) {
      const latencyA = a.lastCheck?.latency ?? Infinity;
      const latencyB = b.lastCheck?.latency ?? Infinity;
      return latencyA - latencyB;
    }
    
    return 0; // 其他同级不改变顺序
  });
  // 共享状态
  let streamClosed = false;

  // 创建可读流
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // 辅助函数：安全地向控制器写入数据
      const safeEnqueue = (data: Uint8Array) => {
        try {
          if (
            streamClosed ||
            (!controller.desiredSize && controller.desiredSize !== 0)
          ) {
            // 流已标记为关闭或控制器已关闭
            return false;
          }
          controller.enqueue(data);
          return true;
        } catch (error) {
          // 控制器已关闭或出现其他错误
          console.warn('Failed to enqueue data:', error);
          streamClosed = true;
          return false;
        }
      };

      console.log('[WS Search API] After intelligent sorting:', apiSites.map((site, index) => ({ 
        index,
        key: site.key, 
        name: site.name,
        priority: !site.lastCheck || site.lastCheck.status === 'untested' ? 'medium' : 
                  site.lastCheck.status === 'valid' ? 'high' : 
                  site.lastCheck.status === 'no_results' ? 'medium' : 'low',
        status: site.lastCheck?.status || 'untested',
        latency: site.lastCheck?.latency || 'N/A'
      })));

      console.log('[WS Search API] Starting stream with sites:', apiSites.map(site => ({ key: site.key, name: site.name, status: site.lastCheck?.status })));

      // 发送开始事件
      const startEvent = `data: ${JSON.stringify({
        type: 'start',
        query,
        totalSources: apiSites.length,
        timestamp: Date.now(),
      })}\n\n`;

      console.log('[WS Search API] Sending start event');
      if (!safeEnqueue(encoder.encode(startEvent))) {
        console.log('[WS Search API] Failed to send start event, connection closed');
        return; // 连接已关闭，提前退出
      }

      // 记录已完成的源数量
      let completedSources = 0;
      const allResults: any[] = [];

      // 为每个源创建搜索 Promise
      const searchPromises = apiSites.map(async (site, index) => {
        console.log(`[WS Search API] Starting search for site ${index + 1}/${apiSites.length}: ${site.name} (${site.key})`);
        try {
          // 添加超时控制
          const searchPromise = Promise.race([
            searchFromApi(site, query),
            new Promise<{ results: any[] }>((_, reject) =>
              setTimeout(() => reject(new Error(`${site.name} timeout after 20s`)), 20000)
            ),
          ]);

          const results = (await searchPromise) as any[];
          // 增加一个判断，如果results不是一个数组，直接跳过处理
          if (!Array.isArray(results)) {
            console.warn(`[WS Search API] Invalid results from ${site.name}: expected array, got`, typeof results);
            completedSources++;
            // 可以在这里发送一个特定错误事件
            if (!streamClosed) {
              const errorEvent = `data: ${JSON.stringify({
                type: 'source_error',
                source: site.key,
                sourceName: site.name,
                error: '返回数据格式不正确',
                timestamp: Date.now(),
              })}\n\n`;
              safeEnqueue(encoder.encode(errorEvent));
            }
            return;
          }
          console.log(`[WS Search API] Raw results from ${site.name}:`, results.length, 'items');

          // International leading advanced search relevance scoring algorithm (consistent with standard API)
          const calculateRelevanceScore = (item: any, searchQuery: string): number => {
            const query = searchQuery.toLowerCase().trim();
            const title = (item.title || '').toLowerCase();
            const typeName = (item.type_name || '').toLowerCase();
            const director = (item.director || '').toLowerCase();
            const actor = (item.actor || '').toLowerCase();
            
            let score = 0;
            const queryLength = query.length;
            const titleLength = title.length;
            
            // Advanced exact matching with weight adjustment
            if (title === query) {
              score += 1000; // Significantly higher for exact match
            }
            // Perfect prefix matching (high priority for user intent)
            else if (title.startsWith(query)) {
              score += 800 * (queryLength / titleLength); // Weight by query coverage
            }
            // Word boundary exact matches (important for multi-word queries)
            else if (new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(title)) {
              score += 600;
            }
            // Substring matching with position weighting
            else if (title.includes(query)) {
              const position = title.indexOf(query);
              const positionWeight = 1 - (position / titleLength); // Earlier position gets higher score
              score += 300 * positionWeight;
            }
            
            // Advanced multi-word query processing
            const queryWords = query.split(/\s+/).filter((word: string) => word.length > 0);
            const titleWords = title.split(/[\s-._]+/).filter((word: string) => word.length > 0);
            
            if (queryWords.length > 1) {
              let wordMatchScore = 0;
              let exactWordMatches = 0;
              let partialWordMatches = 0;
              
              queryWords.forEach(queryWord => {
                let bestWordScore = 0;
                titleWords.forEach((titleWord: string) => {
                  if (titleWord === queryWord) {
                    bestWordScore = Math.max(bestWordScore, 50);
                    exactWordMatches++;
                  } else if (titleWord.includes(queryWord) && queryWord.length >= 2) {
                    const coverage = queryWord.length / titleWord.length;
                    bestWordScore = Math.max(bestWordScore, 25 * coverage);
                    partialWordMatches++;
                  } else if (queryWord.includes(titleWord) && titleWord.length >= 2) {
                    const coverage = titleWord.length / queryWord.length;
                    bestWordScore = Math.max(bestWordScore, 20 * coverage);
                  }
                });
                wordMatchScore += bestWordScore;
              });
              
              // Bonus for matching all query words
              if (exactWordMatches === queryWords.length) {
                wordMatchScore *= 2;
              }
              
              // Bonus for high match ratio
              const matchRatio = (exactWordMatches + partialWordMatches * 0.5) / queryWords.length;
              wordMatchScore *= (0.5 + matchRatio);
              
              score += wordMatchScore;
            }
            
            // Enhanced metadata matching
            let metadataScore = 0;
            if (typeName.includes(query)) {
              metadataScore += 40;
            }
            if (director.includes(query)) {
              metadataScore += 60; // Director matches are quite relevant
            }
            if (actor.includes(query)) {
              metadataScore += 50; // Actor matches are also relevant
            }
            score += metadataScore;
            
            // Content quality and recency weighting
            const currentYear = new Date().getFullYear();
            const itemYear = parseInt(item.year) || 0;
            
            if (itemYear >= currentYear - 1) {
              score += 30; // Very recent content
            } else if (itemYear >= currentYear - 3) {
              score += 20; // Recent content
            } else if (itemYear >= currentYear - 10) {
              score += 10; // Moderately recent
            }
            
            // Penalty adjustments for better relevance
            if (titleLength > queryLength * 4) {
              score *= 0.9; // Slight penalty for very long titles
            }
            
            // Boost for concise, relevant titles
            if (titleLength <= queryLength * 2 && score > 100) {
              score *= 1.1;
            }
            
            // Ensure minimum threshold for very weak matches
            if (score > 0 && score < 50 && !title.includes(query)) {
              score = 0; // Filter out very weak matches
            }
            
            return Math.max(0, Math.round(score));
          };

          // Apply yellow content filter
          let filteredResults = results || [];
          // 在此处添加修正逻辑
          filteredResults.forEach((item: any) => {
            if (item.poster && item.poster.startsWith('http://')) {
              item.poster = item.poster.replace('http://', 'https://');
            }
          });

          const shouldTagInsteadOfFilter =
            config.SiteConfig.DisableYellowFilter;

          // 首先，统一进行关键词内容识别并打上 isYellow 标签
          filteredResults.forEach((result: any) => {
            const typeName = result.type_name || '';
            const title = result.title || '';
            const titleModeration = moderateContent(title);
            const typeModeration = moderateContent(typeName);
            if (
              titleModeration.totalScore >= decisionThresholds.FLAG ||
              typeModeration.totalScore >= decisionThresholds.FLAG
            ) {
              result.isYellow = true;
            }
          });
          
          // 如果关键词过滤器没有被禁用，则执行过滤
          if (!shouldTagInsteadOfFilter) {
              filteredResults = filteredResults.filter((result) => !result.isYellow);
          }

          // 新增：智能 AI 审核 (完全通用化，并增加熔断机制)
          if (config.SiteConfig.IntelligentFilter?.enabled) {
            console.log('[AI Filter DEBUG][WS] IntelligentFilter is ENABLED. Starting moderation process...');
            
            // 真正通用化的审核函数
            const moderateImage = async (imageUrl: string, config: any): Promise<{ decision: 'allow' | 'block' | 'error'; reason: string; score?: number }> => {
              console.log(`[AI Filter DEBUG][WS] ==> moderateImage CALLED for URL: ${imageUrl}`);
              const filterConfig = config.SiteConfig.IntelligentFilter;

              if (!filterConfig || !filterConfig.enabled || !imageUrl) {
                console.log(`[AI Filter DEBUG][WS] SKIPPING: Filter disabled or no image URL.`);
                return { decision: 'allow', reason: 'Filter disabled or no image URL' };
              }

              // 辅助函数：根据路径字符串安全地从对象中获取嵌套值
              const getNestedValue = (obj: any, path: string): number | null => {
                if (!path) return null;
                try {
                  const value = path.split('.').reduce((o, k) => (o || {})[k], obj);
                  const num = parseFloat(value);
                  return isNaN(num) ? null : num;
                } catch { return null; }
              };
            
              const provider: string = filterConfig.provider;
            
              switch (provider) {
                case 'sightengine': {
                  const opts = filterConfig.options.sightengine || {};
                  // 正确调用外部客户端
                  return await checkImageWithSightengine(imageUrl, {
                    apiUrl: opts.apiUrl,
                    apiUser: process.env.SIGHTENGINE_API_USER || opts.apiUser,
                    apiSecret: process.env.SIGHTENGINE_API_SECRET || opts.apiSecret,
                    confidence: filterConfig.confidence,
                    timeoutMs: opts.timeoutMs,
                  });
                }
                case 'baidu': {
                  const opts = filterConfig.options.baidu || {};
                  // 正确调用外部客户端
                  return await checkImageWithBaidu(imageUrl, {
                    apiKey: process.env.BAIDU_API_KEY || opts.apiKey,
                    secretKey: process.env.BAIDU_SECRET_KEY || opts.secretKey,
                    timeoutMs: opts.timeoutMs, // 新增：传递审核超时
                    tokenTimeoutMs: opts.tokenTimeoutMs, // 新增：传递Token超时
                  });
                }
                case 'custom': {
                  // 由于没有 custom-client 附件，保留内联实现是正确的
                  const opts = filterConfig.options.custom || {};
                  const apiKeyValue = process.env.CUSTOM_API_KEY_VALUE || opts.apiKeyValue;
                  if (!opts.apiUrl || !apiKeyValue || !opts.apiKeyHeader || !opts.jsonBodyTemplate || !opts.responseScorePath || apiKeyValue === '(not provided)') {
                    console.warn('[AI Filter] Custom API is not fully configured.');
                    return { decision: 'error', reason: 'Custom API not fully configured' };
                  }
                  let effectiveTimeout = 20000;
                  try {
                    const agent = new Agent({ 
                      connectTimeout: Math.min(effectiveTimeout / 2, 10000),
                      bodyTimeout: effectiveTimeout,
                      headersTimeout: Math.min(effectiveTimeout / 2, 10000)
                    });
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => {
                      console.log(`[Custom API WS] Request timeout after ${effectiveTimeout}ms for: ${imageUrl}`);
                      controller.abort();
                    }, effectiveTimeout);
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    headers[opts.apiKeyHeader] = apiKeyValue;
                    const body = JSON.parse(opts.jsonBodyTemplate.replace('{{URL}}', imageUrl));
                    const response = await undiciFetch(opts.apiUrl, {
                      method: 'POST', headers, body: JSON.stringify(body),
                      signal: controller.signal, dispatcher: agent
                    });
                    clearTimeout(timeoutId);
                    if (!response.ok) {
                      const errorBody = await response.text();
                      return { decision: 'error', reason: `API request for custom failed with status ${response.status}. Body: ${errorBody.substring(0, 200)}` };
                    }
                    const result = await response.json();
                    const score = getNestedValue(result, opts.responseScorePath);
                    if (score === null) return { decision: 'error', reason: `Could not find a valid score at path "${opts.responseScorePath}" for custom.` };
                    if (score >= filterConfig.confidence) return { decision: 'block', reason: `Blocked by custom. Score: ${score} >= Confidence: ${filterConfig.confidence}.`, score };
                    return { decision: 'allow', reason: 'Moderation passed', score };
                  } catch (error) {
                    const isAbortError = error instanceof Error && (
                      error.name === 'AbortError' || 
                      error.name === 'TimeoutError' ||
                      error.message.includes('aborted') ||
                      error.message.includes('timeout')
                    );
                    const reason = isAbortError 
                      ? `Custom API timeout/aborted after 20000ms for ${imageUrl}`
                      : `Exception during API call for custom: ${(error as Error).message}`;
                    console.error(`[Custom API WS] Error details:`, {
                      errorName: error instanceof Error ? error.name : 'Unknown',
                      errorMessage: error instanceof Error ? error.message : 'Unknown error',
                      isAbortError,
                      url: imageUrl
                    });
                    // 超时时返回 allow，其他错误返回 error
                    return { 
                      decision: isAbortError ? 'allow' : 'error', 
                      reason 
                    };
                  }
                }
                default:
                  return { decision: 'allow', reason: 'Unknown provider' };
              }
            }

            // --- 熔断机制的实现 ---
            let failureCount = 0;
            const failureThreshold = 5;
            let isServiceDown = false;

            // 添加批次处理，避免并发过高
            const batchSize = 3;
            const batches = [];
            for (let i = 0; i < filteredResults.length; i += batchSize) {
              batches.push(filteredResults.slice(i, i + batchSize));
            }

            const moderatedResults = [];
            for (const batch of batches) {
              const batchPromises = batch.map(async (item) => {
                if (isServiceDown) {
                  console.log(`[AI Filter DEBUG][WS] Circuit breaker is OPEN. Allowing item to pass directly.`);
                  return item;
                }

                const moderationResult = await moderateImage(item.poster, config);
                
                if (moderationResult.decision === 'error') {
                  failureCount++;
                  console.log(`[AI Filter DEBUG][WS] Moderation failure #${failureCount} recorded.`);
                } else {
                  // 任何一次成功都应重置失败计数，表明服务已恢复
                  failureCount = 0;
                }

                if (failureCount >= failureThreshold) {
                  isServiceDown = true;
                  console.warn(`[AI Filter DEBUG][WS] Circuit breaker OPENED due to ${failureCount} consecutive failures.`);
                }

                // 策略：失败时放行
                return moderationResult.decision !== 'block' ? item : null;
              });
              
              const batchResults = await Promise.all(batchPromises);
              moderatedResults.push(...batchResults);
              
              // 批次间添加延迟
              if (batches.indexOf(batch) < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 250));
              }
            }
            
            filteredResults = moderatedResults.filter((item): item is any => item !== null);
          }
      
          // Apply advanced relevance scoring and intelligent filtering (consistent with standard API)
          const scoredResults = filteredResults
            .map(item => ({
              ...item,
              relevanceScore: calculateRelevanceScore(item, query)
            }))
            .filter(item => {
              // Dynamic threshold based on query characteristics
              const minThreshold = query.length <= 2 ? 100 : 50;
              return item.relevanceScore >= minThreshold;
            })
            .sort((a, b) => {
              // Multi-tier sorting for optimal relevance
              const scoreDiff = b.relevanceScore - a.relevanceScore;
              // If scores are very close (within 10%), consider secondary factors
              if (Math.abs(scoreDiff) <= Math.max(a.relevanceScore, b.relevanceScore) * 0.1) {
                // Prefer exact year matches if query contains year
                const yearMatch = query.match(/\b(19|20)\d{2}\b/);
                if (yearMatch) {
                  const targetYear = yearMatch[0];
                  const aYearMatch = a.year === targetYear;
                  const bYearMatch = b.year === targetYear;
                  if (aYearMatch !== bYearMatch) {
                    return aYearMatch ? -1 : 1;
                  }
                }
                // Then by recency
                const aYear = parseInt(a.year) || 0;
                const bYear = parseInt(b.year) || 0;
                return bYear - aYear;
              }
              return scoreDiff;
            });
          
          filteredResults = scoredResults;

          // 发送该源的搜索结果
          completedSources++;
          console.log(`[WS Search API] Source ${site.name} completed with ${filteredResults.length} results`);
          
          if (!streamClosed) {
            const sourceEvent = `data: ${JSON.stringify({
              type: 'source_result',
              source: site.key,
              sourceName: site.name,
              results: filteredResults,
              timestamp: Date.now(),
            })}\n\n`;
            
            console.log(`[WS Search API] Sending results for source ${site.name}`);
            if (!safeEnqueue(encoder.encode(sourceEvent))) {
              console.log(`[WS Search API] Failed to send results for ${site.name}, connection closed`);
              streamClosed = true;
              return; // 连接已关闭，停止处理
            }
          }

          if (filteredResults.length > 0) {
            allResults.push(...filteredResults);
          }
        } catch (error) {
          console.error(`[WS Search API] Search failed for ${site.name}:`, {
            error: error instanceof Error ? error.message : error,
            siteKey: site.key,
            siteStatus: site.lastCheck?.status || 'unknown',
            index: index + 1,
            totalSites: apiSites.length
          });
          
          // 发送源错误事件
          completedSources++;
          if (!streamClosed) {
            const errorEvent = `data: ${JSON.stringify({
              type: 'source_error',
              source: site.key,
              sourceName: site.name,
              error: error instanceof Error ? error.message : '搜索失败',
              timestamp: Date.now(),
            })}\n\n`;
            console.log(`[WS Search API] Sending error event for ${site.name}`);
            if (!safeEnqueue(encoder.encode(errorEvent))) {
              console.log(`[WS Search API] Failed to send error event for ${site.name}, connection closed`);
              streamClosed = true;
              return; // 连接已关闭，停止处理
            }
          }
        }

        // 检查是否所有源都已完成
        if (completedSources === apiSites.length) {
          if (!streamClosed) {
            // 发送最终完成事件
            const completeEvent = `data: ${JSON.stringify({
              type: 'complete',
              totalResults: allResults.length,
              completedSources,
              timestamp: Date.now(),
            })}\n\n`;
            if (safeEnqueue(encoder.encode(completeEvent))) {
              // 只有在成功发送完成事件后才关闭流
              try {
                controller.close();
              } catch (e) { console.warn('Failed to close controller:', e); }
            }
          }
        }
      });

      // 等待所有搜索完成
      await Promise.allSettled(searchPromises);
    },

    cancel() {
      // 客户端断开连接时，标记流已关闭
      streamClosed = true;
      console.log('Client disconnected, cancelling search stream');
    },
  });

  // 返回流式响应
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
