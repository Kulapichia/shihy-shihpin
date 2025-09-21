import React from 'react';
import { Grid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { DoubanItem } from '@/lib/types';
import VideoCard from './VideoCard';
import DoubanCardSkeleton from './DoubanCardSkeleton';

// Item 组件
const Item = ({
  columnCount,
  items,
  hasNextPage,
  type,
  primarySelection,
  columnWidth,
  columnIndex,
  rowIndex,
  style,
}: {
  columnCount: number;
  items: DoubanItem[];
  hasNextPage: boolean;
  type: string;
  primarySelection: string;
  columnWidth: number;
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
}) => {
  const index = rowIndex * columnCount + columnIndex;

  // 为每个卡片增加一些内边距，避免它们紧贴在一起
  const adjustedStyle = { ...style, padding: '0 8px' };

  if (index >= items.length) {
    return hasNextPage ? (
      <div style={adjustedStyle}>
        <DoubanCardSkeleton />
      </div>
    ) : null;
  }

  const item = items[index];
  return (
    <div style={adjustedStyle}>
      <VideoCard
        from='douban'
        title={item.title}
        poster={item.poster}
        douban_id={Number(item.id)}
        rate={item.rate}
        year={item.year}
        type={type === 'movie' ? 'movie' : ''}
        isBangumi={type === 'anime' && primarySelection === '每日放送'}
      />
    </div>
  );
};

// Props 接口定义
interface VirtualDoubanGridProps {
  items: DoubanItem[];
  hasNextPage: boolean;
  loadNextPage: () => void;
  columnCount: number;
  columnWidth: number;
  containerWidth: number;
  type: string;
  primarySelection: string;
}

const VirtualDoubanGrid = ({
  items,
  hasNextPage,
  loadNextPage,
  columnCount,
  columnWidth,
  containerWidth,
  type,
  primarySelection,
}: VirtualDoubanGridProps) => {
  const itemCount = hasNextPage ? items.length + columnCount : items.length;
  const rowCount = Math.ceil(itemCount / columnCount);
  const headerHeight = 220;

  return (
    <InfiniteLoader
      isItemLoaded={(index) => index < items.length}
      itemCount={itemCount}
      loadMoreItems={loadNextPage}
    >
      {({ onItemsRendered, ref }) => (
        <Grid
          className="hide-scrollbar"
          columnCount={columnCount}
          columnWidth={columnWidth}
          height={window.innerHeight - headerHeight}
          rowCount={rowCount}
          rowHeight={columnWidth * 1.5 + 100}
          width={containerWidth}
          cellProps={{ columnCount, items, hasNextPage, columnWidth, type, primarySelection }}
          onCellsRendered={(visibleCells, allCells) => {
            onItemsRendered({
              overscanStartIndex: allCells.rowStartIndex * columnCount,
              overscanStopIndex: allCells.rowStopIndex * columnCount,
              visibleStartIndex: visibleCells.rowStartIndex * columnCount,
              visibleStopIndex: visibleCells.rowStopIndex * columnCount,
            });
          }}
          ref={ref}
          cellComponent={Item}
        />
      )}
    </InfiniteLoader>
  );
};

export default VirtualDoubanGrid;
