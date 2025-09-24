/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SearchResult } from '@/lib/types';
import VideoCard, { VideoCardHandle } from '@/components/VideoCard';
import DoubanCardSkeleton from './DoubanCardSkeleton';
import { useResponsiveGrid } from '@/hooks/useResponsiveGrid';

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

interface VirtualSearchGridProps {
  results: SearchResult[];
  aggregatedResults: [string, SearchResult[]][];
  hasNextPage: boolean;
  viewMode: 'agg' | 'all';
  searchQuery: string;
  isLoading: boolean;
  computeGroupStats: (group: SearchResult[]) => {
    douban_id?: number;
    episodes?: number;
    source_names: string[];
  };
  getGroupRef: (key: string) => React.RefObject<VideoCardHandle>;
}

const INITIAL_BATCH_SIZE = 20;
const LOAD_MORE_BATCH_SIZE = 10;
const LOAD_MORE_THRESHOLD = 5;

const VirtualSearchGrid = ({
  results,
  aggregatedResults,
  hasNextPage,
  viewMode,
  searchQuery,
  isLoading,
  computeGroupStats,
  getGroupRef,
}: VirtualSearchGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { columnCount, itemWidth, itemHeight, containerWidth } =
    useResponsiveGrid(containerRef);

  const [gridHeight, setGridHeight] = useState(0);
  useEffect(() => {
    const calculateHeight = () => {
      const headerHeight = 280;
      setGridHeight(Math.max(0, window.innerHeight - headerHeight));
    };
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  const [visibleItemCount, setVisibleItemCount] = useState(INITIAL_BATCH_SIZE);
  const [isVirtualLoadingMore, setIsVirtualLoadingMore] = useState(false);

  const dataSource = viewMode === 'agg' ? aggregatedResults : results;
  const totalItemCount = dataSource.length;

  const displayItemCount = Math.min(visibleItemCount, totalItemCount);
  const displayData = dataSource.slice(0, displayItemCount);

  const hasMoreVirtualItems = displayItemCount < totalItemCount;

  useEffect(() => {
    setVisibleItemCount(INITIAL_BATCH_SIZE);
  }, [viewMode, results, aggregatedResults]);

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

  const itemCountWithPlaceholders = hasNextPage
    ? displayItemCount + columnCount
    : displayItemCount;
  const rowCount = Math.ceil(itemCountWithPlaceholders / columnCount);

  const CellComponent = useCallback(({ 
    columnIndex, 
    rowIndex, 
    style, 
    displayData: cellDisplayData,
    columnCount: cellColumnCount,
    displayItemCount: cellDisplayItemCount,
    hasNextPage: cellHasNextPage,
    viewMode: cellViewMode,
    searchQuery: cellSearchQuery,
    computeGroupStats: cellComputeGroupStats,
    getGroupRef: cellGetGroupRef 
  }: any) => {
    const index = rowIndex * cellColumnCount + columnIndex;
    const adjustedStyle = { ...style, padding: '8px' };

    if (index >= cellDisplayItemCount) {
      return cellHasNextPage ? (
        <div style={adjustedStyle}>
          <DoubanCardSkeleton />
        </div>
      ) : null;
    }

    const item = cellDisplayData[index];
    if (!item) return null;

    if (cellViewMode === 'agg') {
      const [mapKey, group] = item as [string, SearchResult[]];
      const title = group[0]?.title || '';
      const poster = group[0]?.poster || '';
      const year = group[0]?.year || 'unknown';
      const { episodes, source_names, douban_id } =
        cellComputeGroupStats(group);
      const type = episodes === 1 ? 'movie' : 'tv';

      return (
        <div style={adjustedStyle}>
          <VideoCard
            ref={cellGetGroupRef(mapKey)}
            from='search'
            isAggregate={true}
            title={title}
            poster={poster}
            year={year}
            episodes={episodes}
            source_names={source_names}
            douban_id={douban_id}
            query={
              cellSearchQuery.trim() !== title ? cellSearchQuery.trim() : ''
            }
            type={type}
          />
        </div>
      );
    } else {
      const searchItem = item as SearchResult;
      return (
        <div style={adjustedStyle}>
          <VideoCard
            id={searchItem.id}
            title={searchItem.title}
            poster={searchItem.poster}
            episodes={searchItem.episodes.length}
            source={searchItem.source}
            source_name={searchItem.source_name}
            douban_id={searchItem.douban_id}
            query={
              cellSearchQuery.trim() !== searchItem.title
                ? cellSearchQuery.trim()
                : ''
            }
            year={searchItem.year}
            from='search'
            type={searchItem.episodes.length > 1 ? 'tv' : 'movie'}
          />
        </div>
      );
    }
  }, []);

  if (gridHeight <= 0 || containerWidth <= 100) {
    return (
      <div className='flex justify-center items-center h-96'>
        {isLoading ? (
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
        ) : (
          <span className='text-sm text-gray-500'>正在初始化布局...</span>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className='w-full'>
      {totalItemCount === 0 && !isLoading ? (
        <div className='text-center text-gray-500 py-8'>未找到相关结果</div>
      ) : (
        <Grid
          key={`search-grid-${containerWidth}-${columnCount}-${viewMode}`}
          className='hide-scrollbar'
          columnCount={columnCount}
          columnWidth={itemWidth + 16}
          rowCount={rowCount}
          rowHeight={itemHeight + 16}
          overscanCount={2}
          cellComponent={CellComponent}
          cellProps={{
            displayData,
            columnCount,
            displayItemCount,
            hasNextPage,
            viewMode,
            searchQuery,
            computeGroupStats,
            getGroupRef,
          }}
          style={{
            width: containerWidth, // 修正：移到 style 内
            height: gridHeight,
          }}
          onCellsRendered={(
            visibleCells,
            allCells
          ) => {
            if (
              visibleCells.rowStopIndex >=
              Math.ceil(displayItemCount / columnCount) - LOAD_MORE_THRESHOLD
            ) {
              if (hasMoreVirtualItems) {
                loadMoreVirtualItems();
              }
            }
          }}
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
