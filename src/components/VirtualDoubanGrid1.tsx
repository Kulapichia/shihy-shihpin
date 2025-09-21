import React from 'react';
import { Grid, type CellComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { DoubanItem } from '@/lib/types';
import VideoCard from './VideoCard';
import DoubanCardSkeleton from './DoubanCardSkeleton';

// cellProps 的类型定义（用户自定义属性）- 此部分保持不变
interface CellProps {
  columnCount: number;
  items: DoubanItem[];
  hasNextPage: boolean;
  type: string;
  primarySelection: string;
  columnWidth: number;
}

// 使用 react-window 官方导出的类型
type ItemProps = CellComponentProps<CellProps>;

// Item 组件
const Item = ({
  columnIndex,
  rowIndex,
  style,
  data, // 所有自定义 props 现在都在 data 对象里
  ariaAttributes, // react-window v2.1.0 新增，用于 ARIA
}: ItemProps) => {
  // 从 data 对象中解构出我们需要的属性
  const { columnCount, items, hasNextPage, type, primarySelection } = data;
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
    // 应用 ariaAttributes 到根元素
    <div style={adjustedStyle} {...ariaAttributes}>
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
        // 为 Grid 提供泛型，并移除 as any
        <Grid<CellProps>
          className="hide-scrollbar"
          columnCount={columnCount}
          columnWidth={columnWidth}
          rowCount={rowCount}
          rowHeight={columnWidth * 1.5 + 100}
          style={{ height: window.innerHeight - headerHeight, width: containerWidth }}
          // 直接传递对象，无需类型断言
          cellProps={{ columnCount, items, hasNextPage, columnWidth, type, primarySelection }}
          onCellsRendered={(visibleInfo, allInfo) => { // 保持 v2.1.0 的回调签名
            onItemsRendered({
              overscanStartIndex: allInfo.rowStartIndex * columnCount,
              overscanStopIndex: allInfo.rowStopIndex * columnCount,
              visibleStartIndex: visibleInfo.rowStartIndex * columnCount,
              visibleStopIndex: visibleInfo.rowStopIndex * columnCount,
            });
          }}
          gridRef={ref} // v2 的 ref 属性
          cellComponent={Item}
        />
      )}
    </InfiniteLoader>
  );
};

export default VirtualDoubanGrid;
