import { useLayoutEffect, useState, useCallback } from 'react';

interface GridDimensions {
  columnCount: number;
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
}

export const useResponsiveGrid = (
  containerRef?: React.RefObject<HTMLElement>
): GridDimensions => {
  const [dimensions, setDimensions] = useState<GridDimensions>({
    columnCount: 3,
    itemWidth: 150,
    itemHeight: 280,
    containerWidth: 0, // 初始宽度设为0，强制等待有效宽度
  });

  const calculateDimensions = useCallback((width?: number) => {
    let containerWidth: number;
    
    if (width !== undefined && width > 0) {
      // ResizeObserver提供的有效宽度
      containerWidth = width;
    } else if (containerRef?.current?.offsetWidth) {
      // 容器已渲染，使用实际宽度
      containerWidth = containerRef.current.offsetWidth;
    } else {
      // 容器未就绪，返回，等待下一次计算
      return;
    }

    let columnCount: number;
    
    // 响应式列数计算
    if (containerWidth >= 1536) columnCount = 8;      // 2xl
    else if (containerWidth >= 1280) columnCount = 7;  // xl  
    else if (containerWidth >= 1024) columnCount = 6;  // lg
    else if (containerWidth >= 768) columnCount = 5;   // md
    else if (containerWidth >= 640) columnCount = 4;   // sm
    else if (containerWidth >= 375) columnCount = 3;   // mobile-L
    else columnCount = 2;                             // mobile-S

    // 计算项目尺寸
    const gap = containerWidth >= 768 ? 32 : 16; // 大屏使用32px间距，小屏16px
    const totalGapWidth = gap * (columnCount - 1);
    const itemWidth = Math.floor((containerWidth - totalGapWidth) / columnCount);
    
    // 根据海报比例计算高度 (2:3) + 标题和来源信息高度
    const posterHeight = Math.floor(itemWidth * 1.5);
    const textHeight = 60; // 标题 + 来源信息
    const itemHeight = posterHeight + textHeight;

    setDimensions({
      columnCount,
      itemWidth,
      itemHeight,
      containerWidth,
    });
  }, [containerRef]);

  useLayoutEffect(() => {
    const element = containerRef?.current;
    if (!element) {
      return;
    }
    
    // 初始计算
    calculateDimensions(element.offsetWidth);

    // 使用ResizeObserver监听尺寸变化
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          calculateDimensions(width);
        }
      }
    });

    resizeObserver.observe(element);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, calculateDimensions]);

  return dimensions;
};

export default useResponsiveGrid;
