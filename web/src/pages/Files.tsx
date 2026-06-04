import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { 
  Folder, File as FileIcon, FileText, Image as ImageIcon, 
  Download, ArrowLeft, Archive, Code, Search, Database, Box, Play
} from 'lucide-react';
import { Dialog } from '@headlessui/react';

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

// Use basic format bytes
function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function getIconForType(type: string, isDir: boolean) {
  if (isDir) return <Folder fill="currentColor" className="text-yellow-500/80" />;
  const ty = type.toLowerCase();
  
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ty)) return <ImageIcon className="text-indigo-400" />;
  if (['pdf'].includes(ty)) return <FileText className="text-red-400" />;
  if (['txt', 'md', 'csv', 'json', 'yml', 'yaml', 'xml', 'log'].includes(ty)) return <FileText className="text-slate-400" />;
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ty)) return <Archive className="text-yellow-600" />;
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h'].includes(ty)) return <Code className="text-blue-400" />;
  if (['sql', 'db', 'sqlite'].includes(ty)) return <Database className="text-emerald-400" />;
  if (['mp3', 'wav', 'ogg'].includes(ty)) return <Play className="text-purple-400" />;
  if (['mp4', 'mkv', 'avi', 'mov'].includes(ty)) return <Box className="text-purple-500" />;
  
  return <FileIcon className="text-slate-500" />;
}

// Can it be previewed?
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
  };

  const handleUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath('/' + parts.join('/'));
  };

  const handleDownload = (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handlePreview = (file: any) => {
    if (file.isDir) {
        handleNavigate(file.name);
    } else if (canPreview(file.type)) {
        const filePath = currentPath.endsWith('/') ? `${currentPath}${file.name}` : `${currentPath}/${file.name}`;
        setPreviewFile({ name: file.name, path: filePath, type: file.type });
    } else {
        // Can't preview, just prompt to download arguably or do nothing but usually it's download
    }
  };

  const getPreviewUrl = (filePath: string) => {
      return `/api/files/download?preview=true&path=${encodeURIComponent(filePath)}`;
  };
  
  // Custom fetch wrapper to pass auth header to image/iframe sources since they don't send Authorization header
  // Wait, standard `src` on <img> and <iframe> in React won't send the Authorization Bearer token!
  // Workaround: We can fetch it as blob and createObjectURL!
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const openPreview = (file: any) => {
      const filePath = currentPath.endsWith('/') ? `${currentPath}${file.name}` : `${currentPath}/${file.name}`;
      setPreviewFile({ name: file.name, path: filePath, type: file.type.toLowerCase() });
      setPreviewLoading(true);
      
      fetch(`/api/files/download?preview=true&path=${encodeURIComponent(filePath)}`, {
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
  };
  
  const closePreview = () => {
      setPreviewFile(null);
      if (blobUrl) {
          window.URL.revokeObjectURL(blobUrl);
          setBlobUrl(null);
      }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 shrink-0 gap-4">
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

      <div className="bg-[#0f111a] border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full flex-1">
        
        {/* Navigation Breadcrumbs */}
        <div className="bg-slate-800/40 p-4 border-b border-slate-800 flex items-center gap-4 shrink-0">
           <button 
             onClick={handleUp} 
             disabled={currentPath === '/'}
             className="text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors p-1 rounded hover:bg-slate-700"
           >
             <ArrowLeft size={18} />
           </button>
           
           <div className="flex flex-wrap items-center gap-1 font-mono text-sm text-slate-300">
             <span className="text-slate-500 mr-2">ROOT</span>
             {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
               <div key={i} className="flex items-center gap-1">
                 <span className="text-slate-600">/</span>
                 <span 
                   className="hover:text-indigo-400 cursor-pointer transition-colors px-1 rounded hover:bg-indigo-500/10"
                   onClick={() => {
                     const path = '/' + arr.slice(0, i + 1).join('/');
                     setCurrentPath(path);
                   }}
                 >
                   {part}
                 </span>
               </div>
             ))}
             {currentPath === '/' && <span className="text-slate-600">/</span>}
           </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-auto p-2 md:p-4">
           {isLoading && (
              <div className="flex items-center justify-center h-48 space-x-2 text-slate-400">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                <span className="text-sm font-medium">Loading directory...</span>
              </div>
           )}
           
           {error && !isLoading && (
              <div className="p-4 bg-red-500/10 text-red-400 rounded-lg text-sm flex flex-col gap-2 border border-red-500/20 max-w-lg mx-auto mt-8">
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
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-800/80 pb-3">
                     <div className="col-span-1 border-r border-slate-700/50"></div>
                     <div className="col-span-5 md:col-span-6">Name</div>
                     <div className="col-span-3 md:col-span-2 text-right">Size</div>
                     <div className="col-span-3 text-right">Modified</div>
                  </div>
                  
                  <div className="space-y-1 relative group w-full">
                    {filteredFiles.map((file: any) => (
                        <div 
                           key={file.name} 
                           onClick={() => {
                               if (file.isDir) {
                                   handleNavigate(file.name);
                               } else if (canPreview(file.type)) {
                                   openPreview(file);
                               }
                           }}
                           className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-900/40 hover:bg-slate-800/60 rounded-lg items-center transition-colors cursor-pointer border border-transparent hover:border-slate-700/50"
                        >
                           <div className="col-span-1 flex items-center justify-center w-8">
                             {getIconForType(file.type, file.isDir)}
                           </div>
                           <div className="col-span-5 md:col-span-6 flex items-center gap-3">
                             <span className="font-medium text-slate-200 truncate">{file.name}</span>
                             {!file.isDir && canPreview(file.type) && (
                                 <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-medium border border-slate-700/50 hidden md:inline-block">PREVIEW</span>
                             )}
                           </div>
                           <div className="col-span-3 md:col-span-2 text-right text-sm text-slate-400 font-mono">
                             {!file.isDir ? formatBytes(file.size) : '--'}
                           </div>
                           <div className="col-span-2 text-right text-sm text-slate-400 hidden md:block">
                             {relativeTime(new Date(file.lastModified))}
                           </div>
                           
                           {/* Actions */}
                           <div className="col-span-3 mx-1 md:col-span-1 flex justify-end gap-2 isolate col-start-10 md:col-start-12 group">
                             {!file.isDir && (
                               <button 
                                 onClick={(e) => handleDownload(file.name, e)}
                                 className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors"
                                 title="Download file"
                               >
                                 <Download size={16} />
                               </button>
                             )}
                           </div>
                        </div>
                    ))}
                  </div>
               </div>
           )}
        </div>
      </div>

      {/* Preview Dialog */}
      {previewFile && (
        <div className="relative z-50">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={closePreview} />
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="mx-auto w-full max-w-4xl max-h-[90vh] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col pointer-events-auto">
              <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-950 shrink-0">
                 <h2 className="font-medium text-slate-200 truncate pr-4 flex items-center gap-3">
                   <FileText size={18} className="text-slate-500" />
                   {previewFile?.name}
                 </h2>
                 
                 <div className="flex items-center gap-3">
                   <button
                      onClick={(e) => {
                          if (previewFile) handleDownload(previewFile.name, e);
                      }}
                      className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors font-medium border border-slate-700"
                   >
                      <Download size={14} /> Download
                   </button>
                   <button onClick={closePreview} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                   </button>
                 </div>
              </div>
              
              <div className="flex-1 overflow-auto bg-[#0a0a0a] relative p-4 flex items-center justify-center min-h-[300px]">
                 {previewLoading && (
                     <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur z-10 gap-3 text-slate-400">
                       <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                       Loading preview...
                     </div>
                 )}
                 
                 {blobUrl && previewFile && (
                     ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(previewFile.type) ? (
                         <img src={blobUrl} alt={previewFile.name} className="max-w-full max-h-full object-contain" />
                     ) : ['pdf'].includes(previewFile.type) ? (
                         <iframe src={blobUrl} className="w-full h-full min-h-[600px] border-0 rounded bg-white" title={previewFile.name} />
                     ) : (
                         <iframe src={blobUrl} className="w-full h-full min-h-[500px] border-0 rounded bg-slate-900" title={previewFile.name} />
                     )
                 )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
