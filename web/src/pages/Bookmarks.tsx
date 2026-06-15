import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, LayoutGrid, Plus, Search, Tag as TagIcon, Trash2, ExternalLink, RefreshCw, Pin, PinOff } from 'lucide-react';
import { api } from '../lib/api';

export default function Bookmarks() {
  const queryClient = useQueryClient();
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ['bookmarks', { q: searchQuery, tag: selectedTag }],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (searchQuery) p.set('q', searchQuery);
      if (selectedTag) p.set('tag', selectedTag);
      return api.get(`/api/bookmarks?${p.toString()}`);
    },
    refetchInterval: (query) => {
      // Poll every 3 seconds if any bookmark is pending
      const hasPending = query.state?.data?.some((b: any) => b.scrape_status === 'pending');
      return hasPending ? 3000 : false;
    }
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get('/api/tags')
  });

  const addBookmark = useMutation({
    mutationFn: (url: string) => {
      return api.post('/api/bookmarks', { url, show_on_dashboard: false });
    },
    onSuccess: () => {
      setUrlInput('');
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    }
  });

  const deleteBookmark = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/bookmarks/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, show }: { id: string, show: boolean }) => {
      await api.put(`/api/bookmarks/${id}`, { show_on_dashboard: show });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_modules'] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    let finalUrl = urlInput.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
    }
    addBookmark.mutate(finalUrl);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold flex items-center gap-3">
          <Bookmark size={24} className="text-indigo-400" />
          Bookmarks
        </h1>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <form onSubmit={handleSubmit} className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="https://example.com/article"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button 
            type="submit" 
            disabled={addBookmark.isPending || !urlInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {addBookmark.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
            Add URL
          </button>
        </form>

        <div className="flex gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search links..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 w-full md:w-48 transition-colors"
            />
          </div>
          <select 
            value={selectedTag || ''} 
            onChange={e => setSelectedTag(e.target.value || null)}
            className="bg-slate-800 border border-slate-700 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
          >
            <option value="">All Tags</option>
            {tags.map((t: any) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <RefreshCw size={24} className="text-indigo-400 animate-spin" />
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center text-slate-500 py-12 flex flex-col items-center gap-4">
            <Bookmark size={48} className="opacity-20" />
            <p>No bookmarks found. Add your first link above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {bookmarks.map((b: any) => (
              <BookmarkCard 
                key={b.id} 
                bookmark={b} 
                onDelete={(id) => deleteBookmark.mutate(id)}
                onTogglePin={(id, show) => togglePin.mutate({ id, show })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { TagPicker } from '../components/TagPicker';

function BookmarkCard({ bookmark, onDelete, onTogglePin }: { bookmark: any, onDelete: (id:string)=>void, onTogglePin: (id:string, show:boolean)=>void }) {
  const queryClient = useQueryClient();
  const isPending = bookmark.scrape_status === 'pending';
  const isFailed = bookmark.scrape_status === 'failed';

  const addTag = useMutation({
    mutationFn: async (tagId: string) => api.post(`/api/bookmarks/${bookmark.id}/tags/${tagId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
  });

  const removeTag = useMutation({
    mutationFn: async (tagId: string) => api.delete(`/api/bookmarks/${bookmark.id}/tags/${tagId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
  });

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl hover:border-slate-600 transition-colors group flex flex-col h-64">
      {/* Fallback image or scraped image */}
      <div className="h-28 bg-slate-900 border-b border-slate-700/80 relative overflow-hidden rounded-t-xl flex-shrink-0">
         {bookmark.og_image_url ? (
           <img src={bookmark.og_image_url} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
         ) : (
           <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
             {isPending ? (
               <RefreshCw size={24} className="text-slate-500 animate-spin" />
             ) : (
               <Bookmark size={24} className="text-slate-600" />
             )}
           </div>
         )}
         
         <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                onClick={() => onTogglePin(bookmark.id, !bookmark.show_on_dashboard)}
                className={`p-1.5 rounded-md ${bookmark.show_on_dashboard ? 'bg-indigo-500 text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-indigo-500 hover:text-white'} transition-colors backdrop-blur`}
                title={bookmark.show_on_dashboard ? "Unpin from dashboard" : "Pin to dashboard"}
            >
                {bookmark.show_on_dashboard ? <Pin size={14} /> : <Pin size={14} />}
            </button>
            <button 
                onClick={() => onDelete(bookmark.id)}
                className="p-1.5 rounded-md bg-slate-800/80 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors backdrop-blur"
                title="Delete bookmark"
            >
                <Trash2 size={14} />
            </button>
         </div>
      </div>

      <div className="p-4 flex flex-col flex-1 min-h-0">
        <div className="flex items-start gap-3 mb-2">
          {bookmark.favicon_url ? (
            <img src={bookmark.favicon_url} alt="" className="w-5 h-5 rounded-sm shrink-0 mt-0.5" />
          ) : (
            <div className="w-5 h-5 rounded-sm bg-slate-700 shrink-0 flex items-center justify-center mt-0.5">
               <ExternalLink size={10} className="text-slate-400" />
            </div>
          )}
          <a 
            href={bookmark.url} 
            target="_blank" 
            rel="noreferrer" 
            className="font-medium text-slate-200 hover:text-indigo-400 transition-colors line-clamp-2 leading-snug flex-1"
          >
            {bookmark.title || bookmark.url}
          </a>
        </div>
        
        {isPending ? (
          <p className="text-xs text-indigo-400 mb-2 flex items-center gap-1.5"><RefreshCw size={12} className="animate-spin" /> Fetching metadata...</p>
        ) : isFailed ? (
          <p className="text-xs text-rose-400/80 mb-2">Failed to fetch metadata</p>
        ) : (
          <p className="text-sm text-slate-400 line-clamp-2 mb-3 min-h-0 flex-1 leading-snug">
            {bookmark.description}
          </p>
        )}

        <div className="mt-auto pt-3 border-t border-slate-700/50 flex items-center justify-between">
           <a href={bookmark.url} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-slate-400 truncate max-w-[150px]">
             {new URL(bookmark.url).hostname}
           </a>
           <div className="flex items-center gap-1">
             {bookmark.tags && bookmark.tags.map((t: any) => (
                <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded-sm border border-slate-700/50" style={{ backgroundColor: `${t.color}15`, color: t.color }}>
                  {t.name}
                </span>
             ))}
             <TagPicker 
                itemId={bookmark.id}
                appliedTags={bookmark.tags || []}
                onAddTag={async (id) => { await addTag.mutateAsync(id); }}
                onRemoveTag={async (id) => { await removeTag.mutateAsync(id); }}
             />
           </div>
        </div>
      </div>
    </div>
  );
}
