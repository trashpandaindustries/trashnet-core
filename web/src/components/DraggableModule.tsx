import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripHorizontal } from 'lucide-react';

export function DraggableModule({ 
  id, 
  x, 
  y, 
  width, 
  height, 
  children,
  onDelete
}: { 
  id: string, 
  x: number, 
  y: number, 
  width: number, 
  height: number,
  children: React.ReactNode,
  onDelete?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
  });

  const style: React.CSSProperties = {
    gridColumnStart: x + 1,
    gridColumnEnd: `span ${width}`,
    gridRowStart: y + 1,
    gridRowEnd: `span ${height}`,
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
        <div {...listeners} {...attributes} className="flex-1 h-full flex items-center cursor-grab active:cursor-grabbing">
          <GripHorizontal size={14} className="text-slate-600" />
        </div>
        {onDelete && (
           <button onClick={onDelete} className="text-slate-600 hover:text-rose-500 text-xs ml-2">
              Remove
           </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col">
          {children}
      </div>
    </div>
  );
}
