import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useNavigate } from 'react-router';

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      return api.get(`/api/search?q=${encodeURIComponent(query)}`);
    },
    enabled: isOpen && query.trim().length > 0,
  });

  return (
    <div ref={containerRef} className="relative">
      {!isOpen ? (
        <button 
          onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-500 text-xs hover:border-slate-700 transition-colors w-64"
        >
          <Search size={14} />
          <span>Search...</span>
          <div className="ml-auto flex gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono">⌘</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono">K</kbd>
          </div>
        </button>
      ) : (
        <div className="absolute top-0 left-0 w-96 -ml-32 md:ml-0 md:w-[28rem] bg-slate-900 border border-slate-700 rounded-md shadow-2xl z-50">
          <div className="flex items-center px-4 py-2 border-b border-slate-800">
            <Search size={16} className="text-slate-500 mr-2" />
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent text-sm text-slate-200 focus:outline-none py-1"
              placeholder="Search notes... (e.g., tag:urgent foo)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="text-slate-500 hover:text-slate-300" onClick={() => setIsOpen(false)}>
              <kbd className="px-1.5 py-0.5 rounded flex items-center bg-slate-800 text-[10px] font-mono">ESC</kbd>
            </button>
          </div>
          
          {query.trim().length > 0 && (
            <div className="max-h-96 overflow-y-auto p-2">
              {isLoading ? (
                <div className="p-4 text-xs text-center text-slate-500">Searching...</div>
              ) : results && results.length > 0 ? (
                results.map((r: any) => (
                  <button 
                    key={r.id} 
                    className="w-full text-left p-3 hover:bg-slate-800 rounded flex flex-col gap-1 transition-colors"
                    onClick={() => {
                       if(r.type === 'note') {
                          // we could navigate and open specific note but for simple phase we just go to notes
                          navigate('/notes');
                          setIsOpen(false);
                       }
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-slate-200 text-sm truncate">{r.title}</span>
                      <span className="text-[10px] uppercase font-bold text-emerald-500 px-1.5 py-0.5 bg-emerald-500/10 rounded">{r.type}</span>
                    </div>
                    {/* Basic content snippet could be shown here */}
                  </button>
                ))
              ) : (
                <div className="p-4 text-xs text-center text-slate-500">No results found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
