import React, { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripHorizontal, Scaling } from 'lucide-react';

export function DraggableModule({ 
  id, 
  x, 
  y, 
  width, 
  height, 
  children,
  onDelete,
  isEditMode,
  onResize
}: { 
  id: string, 
  x: number, 
  y: number, 
  width: number, 
  height: number,
  children: React.ReactNode,
  onDelete?: () => void,
  isEditMode?: boolean,
  onResize?: (w: number, h: number) => void,
  totalColumns?: number
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
    disabled: isEditMode === false,
  });

  const [localWidth, setLocalWidth] = useState(width);
  const [localHeight, setLocalHeight] = useState(height);
  const dragStartRef = useRef<{ x: number, y: number, w: number, h: number, cellW: number, cellH: number } | null>(null);

  useEffect(() => {
    setLocalWidth(width);
    setLocalHeight(height);
  }, [width, height]);

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const gridEl = e.currentTarget.closest('.grid') as HTMLElement;
    const gridW = gridEl ? gridEl.offsetWidth : window.innerWidth;
    const cols = totalColumns || 12;
    const cw = gridW / cols;
    const ch = 136; // 120 + 16 gap
    
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: localWidth,
      h: localHeight,
      cellW: cw,
      cellH: ch
    };

    const handleMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      
      const dw = Math.round(dx / dragStartRef.current.cellW);
      const dh = Math.round(dy / dragStartRef.current.cellH);
      
      const newW = Math.max(1, Math.min(cols, dragStartRef.current.w + dw));
      const newH = Math.max(1, dragStartRef.current.h + dh);
      
      setLocalWidth(newW);
      setLocalHeight(newH);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (dragStartRef.current) {
        setLocalWidth(prevW => {
          setLocalHeight(prevH => {
            if (prevW !== width || prevH !== height) {
              onResize?.(prevW, prevH);
            }
            return prevH;
          });
          return prevW;
        });
      }
      dragStartRef.current = null;
    };
    
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const style: React.CSSProperties = {
    gridColumnStart: x + 1,
    gridColumnEnd: `span ${localWidth}`,
    gridRowStart: y + 1,
    gridRowEnd: `span ${localHeight}`,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex flex-col bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden shadow-sm"
    >
      <div 
        className="h-8 flex items-center justify-between px-3 shrink-0 border-b border-slate-800 bg-slate-900/80 hover:bg-slate-800/80 transition-colors"
      >
        <div {...listeners} {...attributes} className={`flex-1 h-full flex items-center ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}>
          {isEditMode && <GripHorizontal size={14} className="text-slate-600" />}
        </div>
        {(onDelete && isEditMode) && (
           <button onClick={onDelete} className="text-slate-600 hover:text-rose-500 text-xs ml-2">
              Remove
           </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col min-h-0">
          {children}
      </div>
      {isEditMode && (
        <div 
          onPointerDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-nwse-resize text-slate-500 hover:text-emerald-400 bg-slate-900/50 rounded-tl-md transition-colors z-10"
        >
          <Scaling size={12} className="rotate-90" />
        </div>
      )}
    </div>
  );
}
