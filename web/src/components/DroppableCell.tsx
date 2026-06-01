import React from 'react';
import { useDroppable } from '@dnd-kit/core';

export function DroppableCell({ x, y }: { x: number, y: number }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${x}-${y}`,
    data: { x, y }
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] transition-colors rounded-xl border border-transparent ${isOver ? 'bg-emerald-500/10 border-emerald-500/50' : ''}`}
      style={{
        gridColumnStart: x + 1,
        gridRowStart: y + 1,
      }}
    />
  );
}
