import React from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import type { GridCellProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { DoubanItem } from '@/lib/types';
import VideoCard from './VideoCard';
import DoubanCardSkeleton from './DoubanCardSkeleton';

interface ItemData {
  columnCount: number;
  items: DoubanItem[];
  hasNextPage: boolean;
  columnWidth: number;
  type: string;
  primarySelection: string;
}

const Item = ({
  data,
  columnIndex,
  rowIndex,
  style,
}: GridCellProps<ItemData>) => {
  const { columnCount, items, hasNextPage, columnWidth, type, primarySelection } = data;
  const index = rowIndex * columnCount + columnIndex;

  if (index >= items.length) {
    return hasNextPage ? (
      <div style={style}>
        <DoubanCardSkeleton />
      </div>
    ) : null;
  }

  const item = items[index];
  return (
    <div style={style}>
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
  const headerHeight = 220; // 估算的页面顶部选择器和标题的高度

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
          rowHeight={columnWidth * 1.5 + 100} // 卡片宽高比约1.5，加上文字高度
          width={containerWidth}
          itemData={{ columnCount, items, hasNextPage, columnWidth, type, primarySelection }}
          onItemsRendered={({
            visibleRowStartIndex, visibleRowStopIndex, overscanRowStartIndex, overscanRowStopIndex,
          }: any) => {
            onItemsRendered({
              overscanStartIndex: overscanRowStartIndex * columnCount,
              overscanStopIndex: overscanRowStopIndex * columnCount,
              visibleStartIndex: visibleRowStartIndex * columnCount,
              visibleStopIndex: visibleRowStopIndex * columnCount,
            });
          }}
          ref={ref}
        >
          {Item}
        </Grid>
      )}
    </InfiniteLoader>
  );
};

export default VirtualDoubanGrid;


