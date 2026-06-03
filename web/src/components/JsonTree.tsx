import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface JsonTreeProps {
  data: any;
  path?: string;
  onSelectPath?: (path: string) => void;
  isRoot?: boolean;
}

export function JsonTree({ data, path = '', onSelectPath, isRoot = true }: JsonTreeProps) {
  const [expanded, setExpanded] = useState<boolean>(isRoot);

  if (data === null || data === undefined) {
    return <span className="text-slate-500 font-mono text-xs cursor-pointer hover:bg-slate-800 rounded px-1" onClick={() => onSelectPath?.(path)}>null</span>;
  }

  if (typeof data !== 'object') {
    let color = 'text-green-400';
    if (typeof data === 'number') color = 'text-blue-400';
    if (typeof data === 'boolean') color = 'text-orange-400';
    return (
      <span className={`font-mono text-xs cursor-pointer hover:bg-slate-800 rounded px-1 ${color}`} onClick={() => onSelectPath?.(path)}>
        {JSON.stringify(data)}
      </span>
    );
  }

  const isArray = Array.isArray(data);
  const keys = Object.keys(data);
  
  if (keys.length === 0) {
    return <span className="text-slate-500 font-mono text-xs cursor-pointer hover:bg-slate-800 rounded px-1" onClick={() => onSelectPath?.(path)}>{isArray ? '[]' : '{}'}</span>;
  }

  return (
    <div className="font-mono text-[11px] ml-4 relative">
      <div 
        className="flex items-center gap-1 -ml-4 cursor-pointer hover:bg-slate-800/50 py-0.5 rounded px-1 text-slate-300 w-fit"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={14} className="opacity-50" /> : <ChevronRight size={14} className="opacity-50" />}
        <span className="font-semibold text-slate-400 hover:text-indigo-400 transition-colors" onClick={(e) => { e.stopPropagation(); onSelectPath?.(path); }}>
          {path ? (path.split('.').pop() || '') : (isArray ? 'Array' : 'Object')} {isArray ? `[${keys.length}]` : `{${keys.length}}`}
        </span>
      </div>
      
      {expanded && (
        <div className="border-l border-slate-700/50 ml-1.5 pl-3 py-1 space-y-1">
          {keys.map((key) => {
            // Note: to match backend exactly, array index access in paths shouldn't use brackets 
            // but just dot notation since the backend uses simple string split '.'
            // Wait, standard Overseerr style reverse dot path means `items.0.title` usually.
            // Oh, the backend says: `path.split('.').reduce((acc, key) => acc?.[key], obj)`
            // So if `author.name`, it's split. If array, `items.0.title` works perfectly via split.
            const currentPath = path ? `${path}.${key}` : key;
            return (
              <div key={key} className="flex items-start">
                {!isArray && <span className="text-purple-400 mr-2 shrink-0 cursor-pointer hover:bg-slate-800 rounded px-1" onClick={() => onSelectPath?.(currentPath)}>{key}:</span>}
                {isArray && <span className="text-slate-500 mr-2 shrink-0 cursor-pointer hover:bg-slate-800 rounded px-1" onClick={() => onSelectPath?.(currentPath)}>{key}:</span>}
                <div className="flex-1 min-w-0">
                  <JsonTree data={data[key as keyof typeof data]} path={currentPath} onSelectPath={onSelectPath} isRoot={false} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
