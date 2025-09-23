/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
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
  // 搜索结果数据
  allResults: SearchResult[];
  filteredResults: SearchResult[];
  aggregatedResults: [string, SearchResult[]][];
  filteredAggResults: [string, SearchResult[]][];
  
  // 视图模式
  viewMode: 'agg' | 'all';
  
  // 搜索相关
  searchQuery: string;
  isLoading: boolean;
  
  // VideoCard相关props
  groupRefs: React.MutableRefObject<Map<string, React.RefObject<any>>>;
  groupStatsRef: React.MutableRefObject<Map<string, any>>;
  getGroupRef: (key: string) => React.RefObject<any>;
  computeGroupStats: (group: SearchResult[]) => any;
}

// 通过 cellProps 传递的自定义属性
interface SearchCellProps {
  columnCount: number;
  displayData: any[];
  displayItemCount: number;
  viewMode: 'agg' | 'all';
  searchQuery: string;
  groupStatsRef: React.MutableRefObject<Map<string, any>>;
  getGroupRef: (key: string) => React.RefObject<VideoCardHandle>;
  computeGroupStats: (group: SearchResult[]) => {
    douban_id?: number;
    episodes?: number;
    source_names: string[];
  };
}

// 渐进式加载配置
const INITIAL_BATCH_SIZE = 12;
const LOAD_MORE_BATCH_SIZE = 8;
const LOAD_MORE_THRESHOLD = 5; // 距离底部还有5行时开始加载

// 使用最新的 react-window v2.1.0+ API
const CellComponent = ({
  columnIndex,
  rowIndex,
  style,
  ariaAttributes,
  ...cellProps
}: {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  ariaAttributes?: { [key: string]: any };
} & SearchCellProps) => {
  const {
    columnCount,
    displayData,
    displayItemCount,
    viewMode,
    searchQuery,
    groupStatsRef,
    getGroupRef,
    computeGroupStats,
  } = cellProps;

  const index = rowIndex * columnCount + columnIndex;

  // 为每个卡片增加一些内边距
  const adjustedStyle = { ...style, padding: '8px' };

  // 判断当前索引是否超出显示范围
  if (index >= displayItemCount) {
    return <div style={adjustedStyle} {...(ariaAttributes || {})} />;
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

    // 如果该聚合第一次出现，写入初始统计
    if (!groupStatsRef.current.has(mapKey)) {
      groupStatsRef.current.set(mapKey, { episodes, source_names, douban_id });
    }

    return (
      <div style={adjustedStyle} {...(ariaAttributes || {})}>
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
      <div style={adjustedStyle} {...(ariaAttributes || {})}>
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
  allResults,
  filteredResults,
  aggregatedResults,
  filteredAggResults,
  viewMode,
  searchQuery,
  isLoading,
  groupRefs,
  groupStatsRef,
  getGroupRef,
  computeGroupStats,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // 亮点功能：使用 useResponsiveGrid 实现完全响应式布局
  const { columnCount, itemWidth, itemHeight, containerWidth } =
    useResponsiveGrid(containerRef);

  // 保留功能：动态计算网格高度
  const gridHeight = Math.min(
    typeof window !== 'undefined' ? window.innerHeight - 200 : 600, // 200px 为顶部UI估算高度
    800
  );

  // 亮点功能：渐进式加载状态
  const [visibleItemCount, setVisibleItemCount] = useState(INITIAL_BATCH_SIZE);
  const [isVirtualLoadingMore, setIsVirtualLoadingMore] = useState(false);

  // 选择当前显示的数据
  const currentData = viewMode === 'agg' ? filteredAggResults : filteredResults;
  const totalItemCount = currentData.length;

  // 实际显示的项目数量（考虑渐进式加载）
  const displayItemCount = Math.min(visibleItemCount, totalItemCount);
  const displayData = currentData.slice(0, displayItemCount);

  // 检查是否还有更多项目可以从已加载的数据中渲染
  const hasMoreVirtualItems = displayItemCount < totalItemCount;

  // 当视图模式或数据源变化时，重置渐进式加载
  useEffect(() => {
    setVisibleItemCount(INITIAL_BATCH_SIZE);
    setIsVirtualLoadingMore(false);
  }, [viewMode, currentData]);

  // 强制重新计算容器尺寸的useEffect
  useEffect(() => {
    const checkContainer = () => {
      const element = containerRef.current;
      const actualWidth = element?.offsetWidth || 0;
      
      console.log('VirtualSearchGrid container debug:', {
        actualWidth,
        containerWidth,
        offsetWidth: element?.offsetWidth,
        clientWidth: element?.clientWidth,
        scrollWidth: element?.scrollWidth,
        element: !!element
      });
    };
    
    checkContainer();
  }, [containerWidth]);

  // 加载更多虚拟项目（从已有的 currentData 中）
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

  // 计算网格行数
  const rowCount = Math.ceil(displayItemCount / columnCount);

  // 单行网格优化：确保单行时布局正确
  const isSingleRow = rowCount === 1;

  // 更新 onCellsRendered 回调函数签名以匹配 v2.1.0+
  const onCellsRendered = useCallback(
    ({
      rowStartIndex,
      rowStopIndex,
      columnStartIndex,
      columnStopIndex,
    }: {
      rowStartIndex: number;
      rowStopIndex: number;
      columnStartIndex: number;
      columnStopIndex: number;
    }) => {
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
      {totalItemCount === 0 ? (
        <div className='flex justify-center items-center h-40'>
          {isLoading ? (
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
          ) : (
            <div className='text-center text-gray-500 py-8 dark:text-gray-400'>
              未找到相关结果
            </div>
          )}
        </div>
      ) : containerWidth <= 100 ? (
        <div className='flex justify-center items-center h-40'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
          <span className='ml-2 text-sm text-gray-500'>
            初始化虚拟滚动... ({Math.round(containerWidth)}px)
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
            viewMode,
            searchQuery,
            groupStatsRef,
            getGroupRef,
            computeGroupStats,
          }}
          columnCount={columnCount}
          columnWidth={itemWidth + 16} // 16px for padding
          rowCount={rowCount}
          rowHeight={itemHeight + 16} // 16px for padding
          defaultHeight={gridHeight}  // 修正：使用 defaultHeight 替代 height
          defaultWidth={containerWidth}  // 修正：使用 defaultWidth 替代 width
          onCellsRendered={onCellsRendered}
          overscanCount={1}
          // 添加 ARIA 支持提升无障碍体验
          role="grid"
          aria-label={`搜索结果列表 "${searchQuery}"，共${displayItemCount}个结果，当前视图：${viewMode === 'agg' ? '聚合视图' : '全部结果'}`}
          aria-rowcount={rowCount}
          aria-colcount={columnCount}
          style={{
            overflowX: 'hidden',
            overflowY: 'auto',
            // 确保不创建新的stacking context，让菜单能正确显示在最顶层
            isolation: 'auto',
            // 单行网格优化：防止高度异常
            ...(isSingleRow && {
              minHeight: itemHeight + 16,
              maxHeight: itemHeight + 32,
            }),
          }}
        />
      )}

      {/* 增强功能：显示渐进式加载的 "加载更多" 提示 */}
      {containerWidth > 100 && isVirtualLoadingMore && (
        <div className='flex justify-center items-center py-4'>
          <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-green-500'></div>
          <span className='ml-2 text-sm text-gray-500 dark:text-gray-400'>
            加载更多...
          </span>
        </div>
      )}

      {/* 增强功能：当所有已加载数据显示完毕且没有新数据流时，显示提示 */}
      {!hasMoreVirtualItems &&
        totalItemCount > INITIAL_BATCH_SIZE &&
        containerWidth > 100 && (
          <div className='text-center py-4 text-sm text-gray-500 dark:text-gray-400'>
            已显示全部 {totalItemCount} 个结果
          </div>
        )}
    </div>
  );
};

export default VirtualSearchGrid;
