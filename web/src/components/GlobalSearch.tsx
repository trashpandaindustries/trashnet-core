import { useState, useEffect, useRef } from 'react';
import { Search, FileText, Bookmark, Kanban, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useNavigate } from 'react-router';

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(!isOpen);
        if (!isOpen) {
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const { data: resultsData, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query.trim()) return null;
      const res = await api.get(`/api/search?q=${encodeURIComponent(query)}`);
      return res;
    },
    enabled: isOpen && query.trim().length > 0,
  });

  const flattenResults = () => {
    if (!resultsData) return [];
    return [
      ...(resultsData.notes || []).map((n: any) => ({ ...n, _category: 'notes', _icon: FileText, _path: '/notes' })),
      ...(resultsData.bookmarks || []).map((b: any) => ({ ...b, _category: 'bookmarks', _icon: Bookmark, _path: '/bookmarks' })),
      ...(resultsData.kanban || []).map((k: any) => ({ ...k, _category: 'kanban', _icon: Kanban, _path: '/kanban' }))
    ];
  };

  const allItems = flattenResults();

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, resultsData]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (allItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % allItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + allItems.length) % allItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = allItems[selectedIndex];
        if (selected) {
          navigate(selected._path);
          setIsOpen(false);
        }
      }
    }
  };

  const renderGroup = (title: string, items: any[], icon: any, path: string) => {
    if (!items || items.length === 0) return null;
    const Icon = icon;
    return (
      <div className="mb-2">
        <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase bg-slate-800/30">
          <Icon size={12} />
          {title}
        </div>
        <div className="flex flex-col">
          {items.map((r: any) => {
            const index = allItems.findIndex(i => i.id === r.id && i._category === r._category);
            const isSelected = index === selectedIndex;
            return (
              <button 
                key={r.id} 
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${isSelected ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : 'hover:bg-slate-800/50 border-l-2 border-transparent'}`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  navigate(path);
                  setIsOpen(false);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm truncate ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                    {r.title || r.url || 'Untitled'}
                  </div>
                  {(r.description || r.content || r.url) && (
                    <div className="text-xs text-slate-500 truncate mt-0.5 max-w-full">
                       {r._category === 'bookmarks' && r.url ? r.url : (r.description || r.content || '').substring(0, 100)}
                    </div>
                  )}
                </div>
                {isSelected && <ChevronRight size={14} className="text-indigo-400 shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative z-50">
      {!isOpen ? (
        <button 
          onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:border-slate-700 transition-all w-64 shadow-sm"
        >
          <Search size={14} className="text-slate-400" />
          <span className="text-xs font-medium">Search...</span>
          <div className="ml-auto flex gap-1 font-sans">
            <kbd className="px-1.5 py-0.5 rounded border border-slate-700 text-[10px] text-slate-400 bg-slate-800 flex items-center shadow-sm">⌘K</kbd>
          </div>
        </button>
      ) : (
        <div className="absolute top-0 right-0 md:left-0 md:right-auto w-screen max-w-md -ml-32 md:ml-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
          <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm z-10 shrink-0">
            <Search size={16} className="text-indigo-400 mr-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent text-sm text-slate-200 focus:outline-none py-1 placeholder:text-slate-600"
              placeholder="Search everything... (e.g., tag:urgent foo)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 ml-2" onClick={() => setIsOpen(false)}>
              <kbd className="px-1.5 py-0.5 rounded border border-slate-700 text-[9px] font-medium bg-slate-800/80">ESC</kbd>
            </button>
          </div>
          
          {query.trim().length > 0 && (
            <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-700 pb-2">
              {isLoading ? (
                <div className="px-4 py-8 text-center flex flex-col items-center gap-3">
                    <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                    <span className="text-xs text-slate-500 font-medium">Searching across all apps...</span>
                </div>
              ) : allItems.length > 0 ? (
                <div className="flex flex-col py-2">
                  {renderGroup('Notes', resultsData?.notes, FileText, '/notes')}
                  {renderGroup('Bookmarks', resultsData?.bookmarks, Bookmark, '/bookmarks')}
                  {renderGroup('Kanban', resultsData?.kanban, Kanban, '/kanban')}
                </div>
              ) : (
                <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
                   <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mb-3 text-slate-600">
                       <Search size={20} />
                   </div>
                   <p className="text-sm font-medium text-slate-300">No results found</p>
                   <p className="text-xs text-slate-500 mt-1">Try a different term or tag</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
