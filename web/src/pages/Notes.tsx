import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Archive, Edit3, Tag as TagIcon, X, Check, Search, PlusCircle, Kanban, Github, AlertTriangle, FileWarning, TerminalSquare } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import { validateFrontmatter, stripFrontmatter, FrontmatterValidationResult } from '../lib/frontmatter';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  filename?: string;
  updated_at: string;
  tags?: Tag[];
}

export default function Notes() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [filename, setFilename] = useState('');
  const [autosaveStatus, setAutosaveStatus] = useState<string>('Saved');
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Tag management state
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  
  // GitHub Push State
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [ghRepo, setGhRepo] = useState('');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghPath, setGhPath] = useState('');
  const [ghFilename, setGhFilename] = useState('');
  const [ghMessage, setGhMessage] = useState('');
  const [ghCheckResult, setGhCheckResult] = useState<{exists: boolean, filename: string} | null>(null);

  // Frontmatter Validation State
  const [showFmModal, setShowFmModal] = useState(false);
  const [fmResult, setFmResult] = useState<FrontmatterValidationResult | null>(null);

  const { data: prefs } = useQuery<any>({
    queryKey: ['preferences'],
    queryFn: () => api.get('/api/preferences')
  });

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
      setTitle(activeNote.title || '');
      setFilename(activeNote.filename || '');
    } else if (scratchpad) {
      setContent(scratchpad.content || '');
      setTitle(scratchpad.title || 'Scratchpad');
      setFilename(scratchpad.filename || '');
    }
  }, [scratchpad, activeNote]);

  const autosaveTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const updateScratchpad = useMutation({
    mutationFn: async (payload: { content?: string, title?: string, filename?: string }) => {
      if (activeNote) {
        return api.put(`/api/notes/${activeNote.id}`, payload);
      } else {
        return api.put('/api/notes/scratchpad', payload);
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
      updateScratchpad.mutate({ 
        content: e.target.value,
        title,
        filename
      });
    }, 500);
  };

  const handleFieldChange = (field: 'title' | 'filename', val: string) => {
    if (field === 'title') setTitle(val);
    if (field === 'filename') setFilename(val);
    setAutosaveStatus('Saving...');
    
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(() => {
      updateScratchpad.mutate({ 
         content, 
         title: field === 'title' ? val : title, 
         filename: field === 'filename' ? val : filename 
      });
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
      setShowFmModal(false);
    }
  });

  const handleArchiveClick = () => {
    const result = validateFrontmatter(content);
    if (result.hasFrontmatter) {
      setFmResult(result);
      setShowFmModal(true);
    } else {
      archiveNote.mutate();
    }
  };

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

  const checkGithubFile = useMutation({
    mutationFn: async (noteId: string) => {
        return api.post(`/api/notes/${noteId}/github-check`, {
            repo: ghRepo,
            branch: ghBranch,
            path: ghPath,
            filename: ghFilename
        });
    },
    onSuccess: (data: any) => {
        setGhCheckResult(data);
        if (!ghFilename) setGhFilename(data.filename);
    }
  });

  const pushNoteToGithub = useMutation({
    mutationFn: async ({noteId, payload}: {noteId: string, payload: any}) => {
      return api.post(`/api/notes/${noteId}/github-push`, payload);
    },
    onSuccess: () => {
      alert('Pushed to GitHub successfully!');
      setShowGithubModal(false);
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (e: any) => {
      alert(`Push failed: ${e.message}`);
    }
  });

  const openGithubModal = () => {
      if (!activeNote) return;
      setGhRepo(prefs?.github_repo || '');
      setGhBranch(prefs?.github_branch || 'main');
      setGhPath(prefs?.github_notes_path || '');
      setGhFilename(''); // Will be auto-resolved by check or if user types
      setGhMessage(`Update: ${activeNote.title}`);
      setShowGithubModal(true);
      checkGithubFile.mutate(activeNote.id);
  };

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
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex flex-col w-full max-w-xs">
              <input 
                type="text"
                value={title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder={activeNote ? "Title" : "Scratchpad"}
                className="font-bold text-slate-100 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 rounded px-1 -ml-1 h-6 placeholder-slate-600"
              />
              <input 
                type="text"
                value={filename}
                onChange={(e) => handleFieldChange('filename', e.target.value)}
                placeholder="filename.md (optional)"
                className="text-[10px] text-slate-400 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 rounded px-1 -ml-1 h-4 font-mono placeholder-slate-600"
              />
            </div>
            <span className="text-[10px] text-slate-600 shrink-0 bg-slate-800/50 px-2 py-0.5 rounded-full">{autosaveStatus}</span>
            {activeNote && (
               <div className="relative ml-auto">
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
                 onClick={handleArchiveClick}
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
                     onClick={openGithubModal}
                     className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                 >
                     <Github size={14} /> Push to GitHub
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
                updateScratchpad.mutate({ content, title, filename });
              }}
              onChange={handleContentChange}
            />
          </div>
          <div className="w-1/2 min-w-0 overflow-y-auto p-8 bg-slate-950/50">
            {(() => {
              const previewValidation = validateFrontmatter(content);
              const displayContent = stripFrontmatter(content);
              return (
                <>
                  {previewValidation.hasFrontmatter && (
                    <div className="mb-6 p-4 rounded-md bg-slate-900 border border-slate-800 font-mono text-xs shadow-inner">
                      <div className="flex items-center gap-2 mb-3 text-slate-500 font-bold uppercase tracking-wider">
                        <TerminalSquare size={14} />
                        <h4>Frontmatter</h4>
                      </div>
                      <div className="space-y-1">
                        {Object.entries(previewValidation.parsed).map(([k, v]) => (
                           <div key={k} className="flex"><span className="text-emerald-500/80 w-24 shrink-0">{k}:</span> <span className="text-slate-300 break-words">{v as string}</span></div>
                        ))}
                        {Object.keys(previewValidation.parsed).length === 0 && (
                          <div className="text-slate-600 italic">No structured fields parsed</div>
                        )}
                      </div>
                      {!previewValidation.isValid && (
                         <div className="mt-3 pt-3 border-t border-rose-500/20 text-rose-400">
                           <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase font-bold tracking-wider rounded">
                             <AlertTriangle size={12} /> Malformed
                           </div>
                           <ul className="list-disc list-inside space-y-0.5">
                              {previewValidation.errors.map((e, i) => <li key={i}>{e}</li>)}
                           </ul>
                         </div>
                      )}
                    </div>
                  )}
                  <div className="prose prose-invert prose-emerald max-w-none">
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {displayContent || '*Preview will appear here...*'}
                    </Markdown>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Frontmatter Check Modal */}
      <Dialog open={showFmModal} onClose={() => setShowFmModal(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md w-full bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl">
            {fmResult?.isValid ? (
               <>
                  <div className="flex items-center gap-3 mb-4">
                      <Check size={24} className="text-emerald-500" />
                      <Dialog.Title className="text-lg font-semibold text-slate-100">Valid Frontmatter</Dialog.Title>
                  </div>
                  <p className="text-sm text-slate-400 mb-6">Structured metadata was detected and appears valid. Proceed with archiving?</p>
               </>
            ) : (
               <>
                  <div className="flex items-center gap-3 mb-4">
                      <FileWarning size={24} className="text-amber-500" />
                      <Dialog.Title className="text-lg font-semibold text-slate-100">Malformed Frontmatter</Dialog.Title>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">We detected a frontmatter block, but it has structural issues:</p>
                  <div className="bg-slate-950 border border-amber-500/20 rounded p-4 mb-6">
                      <ul className="list-disc list-inside space-y-1 text-xs text-amber-500 font-mono">
                          {fmResult?.errors.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                  </div>
               </>
            )}
            
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowFmModal(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => archiveNote.mutate()}
                disabled={archiveNote.isPending}
                className={`px-4 py-2 text-sm rounded-md font-medium transition-colors text-white disabled:opacity-50 ${fmResult?.isValid ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'}`}
              >
                {archiveNote.isPending ? 'Archiving...' : (fmResult?.isValid ? 'Archive Note' : 'Archive Anyway')}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* GitHub Push Modal */}
      <Dialog open={showGithubModal} onClose={() => setShowGithubModal(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-lg w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <Github size={24} className="text-emerald-500" />
                <Dialog.Title className="text-lg font-semibold text-slate-100">Push to GitHub</Dialog.Title>
            </div>
            
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Repository</label>
                    <input 
                      type="text" 
                      value={ghRepo}
                      onChange={(e) => setGhRepo(e.target.value)}
                      placeholder="owner/repo"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Branch</label>
                    <input 
                      type="text" 
                      value={ghBranch}
                      onChange={(e) => setGhBranch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Path Prefix</label>
                    <input 
                      type="text" 
                      value={ghPath}
                      onChange={(e) => setGhPath(e.target.value)}
                      placeholder="e.g. notes/"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Filename</label>
                    <input 
                      type="text" 
                      value={ghFilename}
                      onChange={(e) => {
                          setGhFilename(e.target.value);
                          setGhCheckResult(null); // Reset check if changed
                      }}
                      onBlur={() => checkGithubFile.mutate(activeNote!.id)}
                      placeholder="auto-generated.md"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Commit Message</label>
                    <input 
                      type="text" 
                      value={ghMessage}
                      onChange={(e) => setGhMessage(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                    />
                </div>

                {checkGithubFile.isPending && (
                   <div className="text-xs text-slate-500 animate-pulse">Checking repository...</div>
                )}
                {ghCheckResult?.exists && !checkGithubFile.isPending && (
                   <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3 flex items-start gap-3">
                       <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                       <div className="text-sm text-amber-200/80">
                           <p className="font-semibold text-amber-500 text-xs uppercase tracking-wider mb-0.5">Warning: File Exists</p>
                           <p className="text-xs">A file named <span className="font-mono bg-amber-500/20 px-1 rounded">{ghCheckResult.filename}</span> already exists at this path on GitHub. Proceeding will overwrite it.</p>
                       </div>
                   </div>
                )}
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setShowGithubModal(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                   if (activeNote) {
                       pushNoteToGithub.mutate({
                           noteId: activeNote.id, 
                           payload: {
                               repo: ghRepo,
                               branch: ghBranch,
                               path: ghPath,
                               filename: ghFilename,
                               message: ghMessage,
                               updateNoteFilename: true
                           }
                       });
                   }
                }}
                disabled={pushNoteToGithub.isPending}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md font-medium transition-colors"
              >
                {pushNoteToGithub.isPending ? 'Pushing...' : 'Commit & Push'}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
