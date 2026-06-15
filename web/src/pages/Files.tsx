import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { 
  Folder, FolderOpen, Download, Search, FileText
} from 'lucide-react';
import { getFileIcon } from '../lib/fileIcons';

function relativeTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function canPreview(type: string) {
  const ty = type.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'pdf', 'txt', 'md', 'json', 'csv'].includes(ty);
}

export default function Files() {
  const [currentPath, setCurrentPath] = useState('/');
  const [search, setSearch] = useState('');
  const [previewFile, setPreviewFile] = useState<{name: string, path: string, type: string} | null>(null);
  
  const { data: fetchResult, isLoading, error } = useQuery({
    queryKey: ['files', currentPath],
    queryFn: async () => {
      const res = await api.get(`/api/files?path=${encodeURIComponent(currentPath)}`);
      return res;
    }
  });

  const files = fetchResult?.files || [];
  
  const filteredFiles = useMemo(() => {
    if (!search) return files;
    return files.filter((f: any) => f.name.toLowerCase().includes(search.toLowerCase()));
  }, [files, search]);

  const handleNavigate = (dirName: string) => {
    setCurrentPath(prev => prev.endsWith('/') ? `${prev}${dirName}` : `${prev}/${dirName}`);
    setPreviewFile(null);
  };

  const handleDownload = (fileName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const filePath = currentPath.endsWith('/') ? `${currentPath}${fileName}` : `${currentPath}/${fileName}`;
    fetch(`/api/files/download?path=${encodeURIComponent(filePath)}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(res => {
        if (!res.ok) throw new Error("Download failed");
        return res.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    })
    .catch(err => {
        console.error(err);
        alert('Failed to download file');
    });
  };

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  useEffect(() => {
     if (previewFile) {
        setPreviewLoading(true);
        fetch(`/api/files/download?preview=true&path=${encodeURIComponent(previewFile.path)}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(res => res.blob())
        .then(blob => {
            setBlobUrl(window.URL.createObjectURL(blob));
        })
        .finally(() => {
            setPreviewLoading(false);
        });
     } else {
         if (blobUrl) {
             window.URL.revokeObjectURL(blobUrl);
             setBlobUrl(null);
         }
     }
  }, [previewFile]);

  // Directory Meta Calculation
  const dirStats = useMemo(() => {
     let fileCount = 0;
     let dirCount = 0;
     let totalSize = 0;
     let lastMod = 0;
     let hasReadme = false;
     let readmeFile = null;

     for (const f of files) {
         if (f.isDir) {
            dirCount++;
         } else {
            fileCount++;
            totalSize += f.size;
         }
         const time = new Date(f.lastModified).getTime();
         if (time > lastMod) lastMod = time;
         
         const lname = f.name.toLowerCase();
         if (!f.isDir && (lname === 'readme.md' || lname === 'index.html')) {
             hasReadme = true;
             readmeFile = f;
         }
     }
     
     return {
         fileCount, dirCount, totalSize, lastMod: lastMod > 0 ? new Date(lastMod) : null, readmeFile
     };
  }, [files]);

  return (
    <div className="w-full flex flex-col h-full pl-6 pr-6 pt-6 pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 shrink-0 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Storage Browser
          </h1>
          <p className="text-slate-500 mt-1">Read-only access to mounted volumes</p>
        </div>
        
        <div className="relative">
           <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
           <input 
             type="text"
             placeholder="Filter files..."
             className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 w-full md:w-64"
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden gap-6 pb-6">
        
        {/* Left Pane: File List */}
        <div className="flex-1 lg:max-w-[500px] xl:max-w-[650px] 2xl:max-w-[800px] bg-[#0f111a] border border-slate-800 rounded-xl overflow-hidden flex flex-col min-w-0">
            {/* Breadcrumbs */}
            <div className="bg-slate-800/40 p-4 border-b border-slate-800 flex items-center gap-2 shrink-0 overflow-x-auto whitespace-nowrap">
              <button
                onClick={() => { setCurrentPath('/'); setPreviewFile(null); }}
                className={`font-mono text-sm hover:text-indigo-400 transition-colors ${currentPath === '/' ? 'text-indigo-400 font-medium' : 'text-slate-400'}`}
              >
                ROOT
              </button>
              
              {currentPath.split('/').filter(Boolean).map((part, i, arr) => {
                const path = '/' + arr.slice(0, i + 1).join('/');
                const isLast = i === arr.length - 1;
                return (
                  <React.Fragment key={i}>
                    <span className="text-slate-600">/</span>
                    <button
                      title={part}
                      className={`font-mono text-sm hover:text-indigo-400 transition-colors truncate max-w-[120px] md:max-w-[200px] ${isLast ? 'text-indigo-400 font-medium' : 'text-slate-400 hidden sm:inline-block'}`}
                      onClick={() => { setCurrentPath(path); setPreviewFile(null); }}
                      disabled={isLast}
                    >
                      {part}
                    </button>
                    {!isLast && <span className="text-slate-400 sm:hidden">...</span>}
                  </React.Fragment>
                );
              })}
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-2 md:p-4">
               {isLoading && (
                  <div className="flex items-center justify-center h-48 space-x-2 text-slate-400">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                    <span className="text-sm font-medium">Loading directory...</span>
                  </div>
               )}
               
               {error && !isLoading && (
                  <div className="p-4 bg-rose-500/10 text-rose-400 rounded-lg text-sm flex flex-col gap-2 border border-rose-500/20 max-w-lg mx-auto mt-8">
                     <div className="font-semibold">Failed to load directory</div>
                     <div className="font-mono text-xs opacity-80">{String(error)}</div>
                  </div>
               )}

               {!isLoading && !error && filteredFiles.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-4 mt-8">
                     <Folder size={48} className="opacity-20" />
                     <div>Empty directory</div>
                  </div>
               )}

               {!isLoading && !error && filteredFiles.length > 0 && (
                   <div className="w-full text-left border-separate" style={{ borderSpacing: '0 4px' }}>
                      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-800/80 pb-3">
                         <div className="col-span-1 border-r border-slate-700/50"></div>
                         <div className="col-span-5 md:col-span-6">Name</div>
                         <div className="col-span-3 md:col-span-2 text-right">Size</div>
                         <div className="col-span-3 text-right">Modified</div>
                      </div>
                      
                      <div className="space-y-1 relative group w-full">
                        {filteredFiles.map((file: any) => {
                            const IconComponent = file.isDir ? Folder : getFileIcon(file.name);
                            const active = previewFile?.name === file.name;
                            return (
                                <div 
                                    key={file.name} 
                                    onClick={() => {
                                        if (file.isDir) {
                                            handleNavigate(file.name);
                                        } else {
                                            const filePath = currentPath.endsWith('/') ? `${currentPath}${file.name}` : `${currentPath}/${file.name}`;
                                            setPreviewFile({ name: file.name, path: filePath, type: file.type });
                                        }
                                    }}
                                    className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-lg items-center transition-colors cursor-pointer border border-transparent 
                                                ${active ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700/50'}`}
                                >
                                    <div className="col-span-1 flex items-center justify-center w-6">
                                        <IconComponent size={18} className="text-slate-500" />
                                    </div>
                                    <div className="col-span-5 md:col-span-6 flex items-center gap-2">
                                        <span className="font-medium text-slate-200 truncate pr-2">{file.name}</span>
                                        {!file.isDir && (
                                            <span className="text-[10px] bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded font-mono hidden md:inline-block border border-slate-700/50">
                                                .{file.type || 'bin'}
                                            </span>
                                        )}
                                        {!file.isDir && canPreview(file.type) && (
                                            <span className="text-[9px] text-slate-500 font-medium tracking-wide hidden lg:inline-block">PREVIEW</span>
                                        )}
                                    </div>
                                    <div className="col-span-3 md:col-span-2 text-right text-sm text-slate-400 font-mono">
                                        {!file.isDir ? formatBytes(file.size) : '--'}
                                    </div>
                                    <div className="col-span-2 text-right text-sm text-slate-400 hidden md:block">
                                        {relativeTime(new Date(file.lastModified))}
                                    </div>
                                    
                                    <div className="col-span-3 mx-1 md:col-span-1 flex justify-end gap-2 isolate col-start-10 md:col-start-12 group">
                                        {!file.isDir && (
                                        <button 
                                            onClick={(e) => handleDownload(file.name, e)}
                                            className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
                                            title="Download file"
                                        >
                                            <Download size={16} />
                                        </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                      </div>
                   </div>
               )}
            </div>
        </div>

        {/* Right Pane: Preview / Meta Data */}
        <div className="hidden lg:flex flex-1 min-w-0 bg-[#0f111a] border border-slate-800 rounded-xl flex-col overflow-hidden">
            {previewFile ? (
               <>
                 <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
                     <h2 className="font-medium text-slate-200 truncate pr-4 flex items-center gap-3">
                       <FileText size={18} className="text-slate-500" />
                       {previewFile.name}
                     </h2>
                     <div className="flex items-center gap-2">
                       <button
                          onClick={() => handleDownload(previewFile.name)}
                          className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors font-medium border border-slate-700"
                       >
                          <Download size={14} /> Download
                       </button>
                       <button onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors">
                         <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                       </button>
                     </div>
                 </div>
                 <div className="flex-1 overflow-auto bg-[#0a0a0a] relative p-4 flex items-center justify-center">
                     {previewLoading && (
                         <div className="absolute inset-0 flex items-center justify-center text-slate-400 z-10 gap-3">
                           <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                         </div>
                     )}
                     {blobUrl && canPreview(previewFile.type) ? (
                         ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(previewFile.type) ? (
                             <img src={blobUrl} alt={previewFile.name} className="max-w-full max-h-full object-contain" />
                         ) : ['pdf'].includes(previewFile.type) ? (
                             <iframe src={blobUrl} className="w-full h-full border-0 bg-white" title={previewFile.name} />
                         ) : (
                             <iframe src={blobUrl} className="w-full h-full border-0 bg-transparent text-slate-300 font-mono text-sm" title={previewFile.name} />
                         )
                     ) : (
                         <div className="text-slate-500 flex flex-col items-center gap-3">
                           <FileText size={48} className="opacity-20" />
                           <p className="text-sm">No preview available for this file type.</p>
                         </div>
                     )}
                 </div>
               </>
            ) : (
               <div className="flex-1 p-6 flex flex-col">
                  <div className="flex items-center gap-3 text-indigo-400 mb-6">
                      <FolderOpen size={32} />
                      <h2 className="text-xl font-bold truncate">
                          {currentPath === '/' ? 'ROOT' : currentPath.split('/').pop()}
                      </h2>
                  </div>
                  
                  <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-5 flex flex-col gap-4 text-sm mb-6">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                          <span className="text-slate-500 font-medium">Full Path</span>
                          <span className="font-mono text-slate-300 truncate max-w-[200px]" title={currentPath}>{currentPath}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                          <span className="text-slate-500 font-medium">Files</span>
                          <span className="text-slate-200">{dirStats.fileCount}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                          <span className="text-slate-500 font-medium">Subdirectories</span>
                          <span className="text-slate-200">{dirStats.dirCount}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                          <span className="text-slate-500 font-medium">Total Size</span>
                          <span className="text-slate-200 font-mono">{formatBytes(dirStats.totalSize)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Last Modified</span>
                          <span className="text-slate-200 text-xs">
                              {dirStats.lastMod ? dirStats.lastMod.toLocaleString() : '--'}
                          </span>
                      </div>
                  </div>

                  {dirStats.readmeFile && (
                      <button
                        onClick={() => {
                           const file = dirStats.readmeFile;
                           const filePath = currentPath.endsWith('/') ? `${currentPath}${file.name}` : `${currentPath}/${file.name}`;
                           setPreviewFile({ name: file.name, path: filePath, type: file.type });
                        }}
                        className="w-full py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-medium rounded-lg transition-colors border border-indigo-500/20 flex items-center justify-center gap-2"
                      >
                         <FileText size={16} /> Open {dirStats.readmeFile.name}
                      </button>
                  )}
               </div>
            )}
        </div>
      </div>
    </div>
  );
}
