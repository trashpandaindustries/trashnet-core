import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { FileText, Loader2 } from 'lucide-react';

export default function AdminLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: () => api.get('/api/logs/file-access'),
    refetchInterval: 30000 // Poll every 30s
  });

  if (isLoading) return <div className="p-8 text-slate-500 animate-pulse flex justify-center"><Loader2 className="animate-spin text-slate-500" size={32} /></div>;

  return (
    <div className="flex-1 overflow-auto bg-[#0f111a] border border-slate-800 rounded-xl">
       <div className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>
          <div className="grid grid-cols-12 gap-4 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10">
             <div className="col-span-3">User</div>
             <div className="col-span-1">Action</div>
             <div className="col-span-4">Path</div>
             <div className="col-span-2">IP Addr</div>
             <div className="col-span-2 text-right">Time</div>
          </div>
          
          <div className="divide-y divide-slate-800/60">
            {logs?.map((log: any) => (
                <div key={log.id} className="grid grid-cols-12 gap-4 px-6 py-3 items-center hover:bg-slate-800/30 transition-colors text-sm">
                   <div className="col-span-3 font-medium text-slate-300">
                      {log.username || <span className="italic text-slate-500">System / Unknown</span>}
                   </div>
                   <div className="col-span-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.action === 'download' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 
                          log.action === 'preview' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                          'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                          {log.action}
                      </span>
                   </div>
                   <div className="col-span-4 text-slate-400 font-mono text-xs break-all">
                      {log.path}
                   </div>
                   <div className="col-span-2 text-slate-500 font-mono text-xs">
                      {log.ip_address}
                   </div>
                   <div className="col-span-2 text-right text-slate-400 text-xs">
                      {new Date(log.accessed_at).toLocaleString()}
                   </div>
                </div>
            ))}
            {logs?.length === 0 && (
                <div className="px-6 py-8 text-center text-slate-500 flex flex-col items-center gap-2">
                    <FileText size={32} className="text-slate-600 mb-2" />
                    No file audit logs found.
                </div>
            )}
          </div>
       </div>
    </div>
  );
}
