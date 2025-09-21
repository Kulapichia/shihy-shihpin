import React, { useState, useEffect } from 'react';
import { Grid } from 'react-window';
import { SearchResult } from '@/lib/types';
import VideoCard, { VideoCardHandle } from '@/components/VideoCard';
import DoubanCardSkeleton from './DoubanCardSkeleton';

// cellProps 的类型定义（用户自定义属性）
interface SearchCellProps {
  columnCount: number;
  results: SearchResult[];
  aggregatedResults: [string, SearchResult[]][];
  hasNextPage: boolean;
  columnWidth: number;
  viewMode: 'agg' | 'all';
  searchQuery: string;
  computeGroupStats: (group: SearchResult[]) => {
    douban_id?: number;
    episodes?: number;
    source_names: string[];
  };
  getGroupRef: (key: string) => React.RefObject<VideoCardHandle>;
}

// Item 组件完整的 Props 类型定义（包含库注入的属性）
interface SearchItemProps extends SearchCellProps {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
}

// 单个网格项的渲染组件
const Item = ({
  columnIndex,
  rowIndex,
  style,
  columnCount,
  results,
  aggregatedResults,
  hasNextPage,
  viewMode,
  searchQuery,
  computeGroupStats,
  getGroupRef,
}: SearchItemProps) => {
  const index = rowIndex * columnCount + columnIndex;


  // 为每个卡片增加一些内边距，避免它们紧贴在一起
  const adjustedStyle = { ...style, padding: '0 8px' };

  // 聚合视图
  if (viewMode === 'agg') {
    if (index >= aggregatedResults.length) {
      // 如果还在加载中（流式搜索），显示骨架屏
      return hasNextPage ? (
        <div style={adjustedStyle}>
          <DoubanCardSkeleton />
        </div>
      ) : null;
    }

    const [mapKey, group] = aggregatedResults[index];
    const title = group[0]?.title || '';
    const poster = group[0]?.poster || '';
    const year = group[0]?.year || 'unknown';
    const { episodes, source_names, douban_id } = computeGroupStats(group);
    const type = episodes === 1 ? 'movie' : 'tv';

    return (
      <div style={adjustedStyle}>
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
    if (index >= results.length) {
      return hasNextPage ? (
        <div style={adjustedStyle}>
          <DoubanCardSkeleton />
        </div>
      ) : null;
    }

    const item = results[index];
    return (
      <div style={adjustedStyle}>
        <VideoCard
          id={item.id}
          title={item.title}
          poster={item.poster}
          episodes={item.episodes.length}
          source={item.source}
          source_name={item.source_name}
          douban_id={item.douban_id}
          query={searchQuery.trim() !== item.title ? searchQuery.trim() : ''}
          year={item.year}
          from='search'
          type={item.episodes.length > 1 ? 'tv' : 'movie'}
        />
      </div>
    );
  }
};

// VirtualSearchGrid 组件的 Props 定义
interface VirtualSearchGridProps {
  results: SearchResult[];
  aggregatedResults: [string, SearchResult[]][];
  hasNextPage: boolean;
  columnCount: number;
  columnWidth: number;
  containerWidth: number;
  viewMode: 'agg' | 'all';
  searchQuery: string;
  computeGroupStats: (group: SearchResult[]) => {
    douban_id?: number;
    episodes?: number;
    source_names: string[];
  };
  getGroupRef: (key: string) => React.RefObject<VideoCardHandle>;
}

const VirtualSearchGrid = ({
  results,
  aggregatedResults,
  hasNextPage,
  columnCount,
  columnWidth,
  containerWidth,
  viewMode,
  searchQuery,
  computeGroupStats,
  getGroupRef,
}: VirtualSearchGridProps) => {
  const dataSource = viewMode === 'agg' ? aggregatedResults : results;
  // 如果还在加载中（例如流式搜索未完成），则多渲染一行骨架屏作为占位
  const itemCount = hasNextPage ? dataSource.length + columnCount : dataSource.length;
  const rowCount = Math.ceil(itemCount / columnCount);
  const headerHeight = 320; // 估算的搜索页顶部选择器等的高度

  const [gridHeight, setGridHeight] = useState(0);

  useEffect(() => {
    const calculateHeight = () => {
      // 确保计算的高度不会是负数
      setGridHeight(Math.max(0, window.innerHeight - headerHeight));
    };

    calculateHeight(); // 初始计算

    window.addEventListener('resize', calculateHeight);
    return () => {
      window.removeEventListener('resize', calculateHeight);
    };
  }, [headerHeight]);

  if (gridHeight <= 0) {
    return null; // 在计算出有效高度前，不渲染网格，防止闪烁或错误
  }
  
  // 搜索页加载所有数据后进行虚拟滚动，不需要无限加载器
  return (
    <Grid
      className="hide-scrollbar"
      columnCount={columnCount}
      columnWidth={columnWidth}
      rowCount={rowCount}
      rowHeight={columnWidth * 1.5 + 100}
      style={{ height: gridHeight, width: containerWidth }}
      cellProps={{
        columnCount, results, aggregatedResults, hasNextPage, columnWidth, viewMode, searchQuery, computeGroupStats, getGroupRef
      } as any}
      cellComponent={Item}
    />
  );
};

export default VirtualSearchGrid;
