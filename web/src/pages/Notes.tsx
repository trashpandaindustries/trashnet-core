import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Archive, Edit3, Tag as TagIcon, X, Check, Search, PlusCircle, Kanban } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  updated_at: string;
  tags?: Tag[];
}

export default function Notes() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [autosaveStatus, setAutosaveStatus] = useState<string>('Saved');
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Tag management state
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const { data: scratchpad } = useQuery<Note>({
    queryKey: ['scratchpad'],
    queryFn: async () => {
      const res = await api.get('/api/notes/scratchpad');
      return res as unknown as Note;
    }
  });

  const { data: tagsData } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      return (await api.get('/api/tags')) as unknown as Tag[];
    }
  });

  useEffect(() => {
    if (activeNote) {
      setContent(activeNote.content || '');
    } else if (scratchpad) {
      setContent(scratchpad.content || '');
    }
  }, [scratchpad, activeNote]);

  const autosaveTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const updateScratchpad = useMutation({
    mutationFn: async (newContent: string) => {
      if (activeNote) {
        return api.put(`/api/notes/${activeNote.id}`, { content: newContent });
      } else {
        return api.put('/api/notes/scratchpad', { content: newContent });
      }
    },
    onSuccess: () => {
      setAutosaveStatus('Saved');
      queryClient.invalidateQueries({ queryKey: [activeNote ? 'notes' : 'scratchpad'] });
    },
    onError: () => setAutosaveStatus('Error saving')
  });

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setAutosaveStatus('Saving...');
    
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(() => {
      updateScratchpad.mutate(e.target.value);
    }, 500);
  };

  const archiveNote = useMutation({
    mutationFn: async () => {
      return api.post('/api/notes/scratchpad/archive');
    },
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['scratchpad'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setActiveNote(null);
    }
  });

  const convertToKanban = useMutation({
    mutationFn: async () => {
       const noteId = activeNote?.id;
       if (!noteId) return;
       return api.post(`/api/notes/${noteId}/convert-to-kanban`);
    },
    onSuccess: () => {
       // Ideally we'd show a success toast or direct to kanban board
       alert('Added to Kanban!');
    }
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setActiveNote(null);
    }
  });

  // Tag mutations
  const createTag = useMutation({
    mutationFn: async (name: string) => {
      return api.post('/api/tags', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setNewTagName('');
    }
  });

  const addTagToNote = useMutation({
    mutationFn: async ({ noteId, tagId }: { noteId: string, tagId: string }) => {
      return api.post(`/api/notes/${noteId}/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      // Re-fetch active note if needed, though simpler just to rely on the activeNote list refresh
    }
  });

  const removeTagFromNote = useMutation({
    mutationFn: async ({ noteId, tagId }: { noteId: string, tagId: string }) => {
      return api.delete(`/api/notes/${noteId}/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    }
  });

  const { data: archivedNotes } = useQuery<Note[]>({
    queryKey: ['notes'],
    queryFn: async () => {
      return (await api.get('/api/notes')) as unknown as Note[];
    }
  });

  const filteredNotes = archivedNotes?.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content?.toLowerCase().includes(searchQuery.toLowerCase())) || [];

  return (
    <div className="flex h-full -m-6 gap-0">
      <div className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800">
          <button 
            onClick={() => setActiveNote(null)}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md font-bold tracking-tight text-sm transition-colors ${!activeNote ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            <Edit3 size={16} /> Scratchpad
          </button>
        </div>
        
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
            <input 
              type="text" 
              placeholder="Search notes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md py-2 text-sm pl-9 pr-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredNotes.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-600">No archived notes</div>
          ) : (
            filteredNotes.map(n => (
              <button 
                key={n.id}
                onClick={() => setActiveNote(n)}
                className={`w-full text-left p-3 rounded-md transition-colors ${activeNote?.id === n.id ? 'bg-slate-800 border-l-2 border-emerald-500' : 'hover:bg-slate-800/60'}`}
              >
                <div className="font-semibold text-slate-200 text-sm truncate">{n.title}</div>
                <div className="text-xs text-slate-500 truncate mt-1">{new Date(n.updated_at).toLocaleDateString()}</div>
                {n.tags && n.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {n.tags.map(t => (
                      <span key={t.id} className="text-[9px] px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: `${t.color}20`, color: t.color }}>{t.name}</span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 bg-slate-900/50">
          <div className="flex items-center gap-4">
            <span className="font-bold text-slate-100">
              {activeNote ? activeNote.title : 'Scratchpad'}
            </span>
            <span className="text-xs text-slate-600">{autosaveStatus}</span>
            {activeNote && (
               <div className="relative ml-4">
                 <button 
                   onClick={() => setShowTagMenu(!showTagMenu)}
                   className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-md transition-colors"
                 >
                   <TagIcon size={14} /> Tags
                 </button>
                 {showTagMenu && (
                   <div className="absolute top-10 left-0 w-64 bg-slate-900 border border-slate-700 rounded-md shadow-2xl z-50 p-3">
                     <div className="text-xs text-slate-500 mb-2 font-semibold">NOTE TAGS</div>
                     <div className="flex flex-wrap gap-1 mb-4">
                       {activeNote.tags?.map(t => (
                         <span key={t.id} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: `${t.color}20`, color: t.color }}>
                           {t.name} 
                           <X size={10} className="cursor-pointer hover:opacity-50" onClick={() => removeTagFromNote.mutate({ noteId: activeNote.id, tagId: t.id })}/>
                         </span>
                       ))}
                       {(!activeNote.tags || activeNote.tags.length === 0) && <span className="text-xs text-slate-600">No tags</span>}
                     </div>
                     <div className="text-xs text-slate-500 mb-2 font-semibold">AVAILABLE TAGS</div>
                     <div className="max-h-32 overflow-y-auto mb-2 space-y-1">
                        {tagsData?.map(t => {
                          const hasTag = activeNote.tags?.find(nt => nt.id === t.id);
                          return (
                            <button 
                              key={t.id} 
                              onClick={() => !hasTag && addTagToNote.mutate({ noteId: activeNote.id, tagId: t.id })}
                              className="w-full text-left text-xs p-1.5 hover:bg-slate-800 rounded flex items-center justify-between text-slate-300"
                            >
                              <span style={{ color: t.color }}>{t.name}</span>
                              {hasTag && <Check size={12} className="text-emerald-500" />}
                            </button>
                          );
                        })}
                     </div>
                     <div className="flex items-center gap-2 border-t border-slate-800 pt-2 mt-2">
                       <input 
                         type="text" 
                         value={newTagName}
                         onChange={e => setNewTagName(e.target.value)}
                         placeholder="New tag..."
                         className="flex-1 bg-slate-950 border border-slate-800 rounded text-xs px-2 py-1 focus:outline-none focus:border-emerald-500"
                         onKeyDown={e => {
                           if(e.key === 'Enter' && newTagName) {
                              createTag.mutate(newTagName);
                           }
                         }}
                       />
                       <button onClick={() => newTagName && createTag.mutate(newTagName)} className="text-slate-500 hover:text-emerald-500">
                         <PlusCircle size={14} />
                       </button>
                     </div>
                   </div>
                 )}
               </div>
            )}
          </div>
          <div className="flex items-center gap-3">
             {!activeNote ? (
               <button 
                 onClick={() => archiveNote.mutate()}
                 disabled={archiveNote.isPending || !content.trim()}
                 className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
               >
                 <Archive size={14} /> Archive
               </button>
             ) : (
               <>
                 <button 
                     onClick={() => convertToKanban.mutate()}
                     disabled={convertToKanban.isPending}
                     className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                 >
                     <Kanban size={14} /> Send to Kanban
                 </button>
                 <button 
                   onClick={() => {
                     if(confirm('Delete this note?')) deleteNote.mutate(activeNote.id);
                   }}
                   disabled={deleteNote.isPending}
                   className="flex items-center gap-2 text-xs bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white px-3 py-1.5 rounded-md transition-colors"
                 >
                   <X size={14} /> Delete
                 </button>
               </>
             )}
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="w-1/2 min-w-0 flex flex-col border-r border-slate-800">
            <textarea
              className="flex-1 w-full p-6 bg-transparent text-slate-300 resize-none focus:outline-none font-mono text-sm leading-relaxed"
              placeholder="Start writing..."
              value={content}
              onBlur={() => {
                if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
                updateScratchpad.mutate(content);
              }}
              onChange={handleContentChange}
            />
          </div>
          <div className="w-1/2 min-w-0 overflow-y-auto p-8 bg-slate-950/50">
            <div className="prose prose-invert prose-emerald max-w-none">
              <Markdown remarkPlugins={[remarkGfm]}>
                {content || '*Preview will appear here...*'}
              </Markdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
