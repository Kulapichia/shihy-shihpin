/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
// 修正 1：从 'react-window' 导入 Grid 和官方的 CellComponentProps 类型
import { type CellComponentProps } from 'react-window';
import { SearchResult } from '@/lib/types';
import VideoCard, { VideoCardHandle } from '@/components/VideoCard';
import { useResponsiveGrid } from '@/hooks/useResponsiveGrid';
import DoubanCardSkeleton from '@/components/DoubanCardSkeleton'; // 引入骨架屏组件

// 使用 dynamic import 解决 SSR 问题，并提供加载状态
const Grid = dynamic(
  () => import('react-window').then((mod) => ({ default: mod.Grid })),
  {
    ssr: false,
    loading: () => (
      <div className='animate-pulse h-96 bg-gray-200 dark:bg-gray-800 rounded-lg' />
    ),
  }
);

// VirtualSearchGrid 组件的 Props 定义
interface VirtualSearchGridProps {
  results: SearchResult[];
  aggregatedResults: [string, SearchResult[]][];
  hasNextPage: boolean; // 关键 prop：用于判断数据流是否仍在进行
  viewMode: 'agg' | 'all';
  searchQuery: string;
  isLoading: boolean; // 用于显示初始加载状态
  computeGroupStats: (group: SearchResult[]) => {
    douban_id?: number;
    episodes?: number;
    source_names: string[];
  };
  getGroupRef: (key: string) => React.RefObject<VideoCardHandle>;
}

// 通过 cellProps 传递的自定义属性
interface SearchCellProps {
  columnCount: number;
  displayData: any[];
  displayItemCount: number;
  hasNextPage: boolean;
  viewMode: 'agg' | 'all';
  searchQuery: string;
  computeGroupStats: (group: SearchResult[]) => {
    douban_id?: number;
    episodes?: number;
    source_names: string[];
  };
  getGroupRef: (key: string) => React.RefObject<VideoCardHandle>;
}

// 渐进式加载配置
const INITIAL_BATCH_SIZE = 20;
const LOAD_MORE_BATCH_SIZE = 10;
const LOAD_MORE_THRESHOLD = 5; // 距离底部还有5行时开始加载

// 使用官方的 CellComponentProps<SearchCellProps>
const CellComponent = ({
  columnIndex,
  rowIndex,
  style,
  ariaAttributes,
  // 自定义 props
  columnCount,
  displayData,
  displayItemCount,
  hasNextPage,
  viewMode,
  searchQuery,
  computeGroupStats,
  getGroupRef,
}: CellComponentProps<SearchCellProps>) => {
  const index = rowIndex * columnCount + columnIndex;

  // 为每个卡片增加一些内边距
  const adjustedStyle = { ...style, padding: '8px' };

  // 增强 1：吸收并优化骨架屏占位逻辑
  // 判断当前索引是否为骨架屏占位
  if (index >= displayItemCount) {
    // 只有在数据流还在进行时 (hasNextPage) 才显示骨架屏
    return hasNextPage ? (
      <div style={adjustedStyle} {...ariaAttributes}>
        <DoubanCardSkeleton />
      </div>
    ) : null;
  }

  const item = displayData[index];
  if (!item) return null; // 安全检查

  // 聚合视图
  if (viewMode === 'agg') {
    const [mapKey, group] = item as [string, SearchResult[]];
    const title = group[0]?.title || '';
    const poster = group[0]?.poster || '';
    const year = group[0]?.year || 'unknown';
    const { episodes, source_names, douban_id } = computeGroupStats(group);
    const type = episodes === 1 ? 'movie' : 'tv';

    return (
      <div style={adjustedStyle} {...ariaAttributes}>
        <VideoCard
          ref={getGroupRef(mapKey)}
          from='search'
          isAggregate={true}
          title={title}
          poster={poster}
          year={year}
          episodes={episodes}
          source_names={source_names}
          douban_id={douban_id}
          query={searchQuery.trim() !== title ? searchQuery.trim() : ''}
          type={type}
        />
      </div>
    );
  }
  // 全部视图
  else {
    const searchItem = item as SearchResult;
    return (
      <div style={adjustedStyle} {...ariaAttributes}>
        <VideoCard
          id={searchItem.id}
          title={searchItem.title}
          poster={searchItem.poster}
          episodes={searchItem.episodes.length}
          source={searchItem.source}
          source_name={searchItem.source_name}
          douban_id={searchItem.douban_id}
          query={
            searchQuery.trim() !== searchItem.title ? searchQuery.trim() : ''
          }
          year={searchItem.year}
          from='search'
          type={searchItem.episodes.length > 1 ? 'tv' : 'movie'}
        />
      </div>
    );
  }
};

// 主组件
export const VirtualSearchGrid: React.FC<VirtualSearchGridProps> = ({
  results,
  aggregatedResults,
  hasNextPage,
  viewMode,
  searchQuery,
  isLoading,
  computeGroupStats,
  getGroupRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // 亮点功能：使用 useResponsiveGrid 实现完全响应式布局
  const { columnCount, itemWidth, itemHeight, containerWidth } =
    useResponsiveGrid(containerRef);

  // 保留功能：动态计算网格高度
  const gridHeight = Math.min(
    typeof window !== 'undefined' ? window.innerHeight - 280 : 600, // 280px 为顶部UI估算高度
    800
  );

  // 亮点功能：渐进式加载状态
  const [visibleItemCount, setVisibleItemCount] = useState(INITIAL_BATCH_SIZE);
  const [isVirtualLoadingMore, setIsVirtualLoadingMore] = useState(false);

  // 根据视图模式选择数据源
  const dataSource = viewMode === 'agg' ? aggregatedResults : results;
  const totalItemCount = dataSource.length;

  // 实际显示的项目数量（考虑渐进式加载）
  const displayItemCount = Math.min(visibleItemCount, totalItemCount);
  const displayData = dataSource.slice(0, displayItemCount);

  // 检查是否还有更多项目可以从已加载的数据中渲染
  const hasMoreVirtualItems = displayItemCount < totalItemCount;

  // 当视图模式或数据源变化时，重置渐进式加载
  useEffect(() => {
    setVisibleItemCount(INITIAL_BATCH_SIZE);
  }, [viewMode, results, aggregatedResults]);

  // 加载更多虚拟项目（从已有的 dataSource 中）
  const loadMoreVirtualItems = useCallback(() => {
    if (isVirtualLoadingMore || !hasMoreVirtualItems) return;
    setIsVirtualLoadingMore(true);
    setTimeout(() => {
      setVisibleItemCount((prev) =>
        Math.min(prev + LOAD_MORE_BATCH_SIZE, totalItemCount)
      );
      setIsVirtualLoadingMore(false);
    }, 100);
  }, [isVirtualLoadingMore, hasMoreVirtualItems, totalItemCount]);

  // 保留功能：计算总项目数，如果数据仍在流式传输 (hasNextPage)，则增加一行骨架屏占位
  const itemCountWithPlaceholders = hasNextPage
    ? displayItemCount + columnCount
    : displayItemCount;
  const rowCount = Math.ceil(itemCountWithPlaceholders / columnCount);

  // 更新 onCellsRendered 回调函数签名以匹配 v2.1.0+
  const onCellsRendered = useCallback(
    ({ rowStopIndex }: { rowStopIndex: number; }) => {
      // 当滚动到底部附近时，触发渐进式加载
      if (
        rowStopIndex >=
        Math.ceil(displayItemCount / columnCount) - LOAD_MORE_THRESHOLD
      ) {
        if (hasMoreVirtualItems) {
          loadMoreVirtualItems();
        }
      }
    },
    [displayItemCount, columnCount, hasMoreVirtualItems, loadMoreVirtualItems]
  );

  return (
    <div ref={containerRef} className='w-full'>
      {totalItemCount === 0 && !isLoading ? (
        <div className='text-center text-gray-500 py-8 dark:text-gray-400'>未找到相关结果</div>
      ) : containerWidth <= 100 ? (
        <div className='flex justify-center items-center h-40'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
          <span className='ml-2 text-sm text-gray-500'>
            初始化虚拟滑动... ({Math.round(containerWidth)}px)
          </span>
        </div>
      ) : (
        <Grid
          key={`search-grid-${containerWidth}-${columnCount}-${viewMode}`}
          cellComponent={CellComponent}
          cellProps={{
            columnCount,
            displayData,
            displayItemCount,
            hasNextPage,
            viewMode,
            searchQuery,
            computeGroupStats,
            getGroupRef,
          }}
          columnCount={columnCount}
          columnWidth={itemWidth + 16} // 16px for padding
          rowCount={rowCount}
          rowHeight={itemHeight + 16} // 16px for padding
          height={gridHeight}
          width={containerWidth}
          onCellsRendered={onCellsRendered}
          overscanCount={2}
          role='grid'
          aria-label={`搜索结果列表 "${searchQuery}"`}
        />
      )}

      {/* 增强功能：显示渐进式加载的 "加载更多" 提示 */}
      {isVirtualLoadingMore && (
        <div className='flex justify-center items-center py-4'>
          <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-green-500'></div>
          <span className='ml-2 text-sm text-gray-500 dark:text-gray-400'>
            加载更多...
          </span>
        </div>
      )}

      {/* 增强功能：当所有已加载数据显示完毕且没有新数据流时，显示提示 */}
      {!hasMoreVirtualItems &&
        !hasNextPage &&
        totalItemCount > INITIAL_BATCH_SIZE && (
          <div className='text-center py-4 text-sm text-gray-500 dark:text-gray-400'>
            已显示全部 {totalItemCount} 个结果
          </div>
        )}
    </div>
  );
};

export default VirtualSearchGrid;
