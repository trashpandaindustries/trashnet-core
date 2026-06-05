import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/api/settings')
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string, value: string, description: string }) => {
      let parsedValue: any = value;
      try {
          parsedValue = JSON.parse(value);
      } catch (e) {
          // Fallback to string if not valid JSON
      }
      return api.put(`/api/settings/${key}`, { value: parsedValue, description });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setEditingKey(null);
      setShowSuccess(variables.key);
      setTimeout(() => setShowSuccess(null), 3000);
    }
  });

  if (isLoading) return <div className="p-8 text-slate-500 animate-pulse flex justify-center"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>;

  return (
    <div className="flex-1 overflow-auto bg-[#0f111a] border border-slate-800 rounded-xl">
       <div className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>
          <div className="grid grid-cols-12 gap-4 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10">
             <div className="col-span-3">Setting Key</div>
             <div className="col-span-4">Description</div>
             <div className="col-span-3">Value (JSON)</div>
             <div className="col-span-2 text-right">Actions</div>
          </div>
          
          <div className="divide-y divide-slate-800/60">
            {settings?.map((setting: any) => {
                const isEditing = editingKey === setting.key;
                
                return (
                <div key={setting.key} className="grid grid-cols-12 gap-4 px-6 py-4 items-start hover:bg-slate-800/30 transition-colors">
                   <div className="col-span-3 font-medium text-slate-200 mt-1 font-mono text-sm">
                      {setting.key}
                   </div>
                   <div className="col-span-4">
                      {isEditing ? (
                          <textarea 
                             value={editDescription}
                             onChange={e => setEditDescription(e.target.value)}
                             className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 min-h-[60px]"
                          />
                      ) : (
                          <div className="text-sm text-slate-400 whitespace-pre-wrap">{setting.description || <span className="italic opacity-50">No description</span>}</div>
                      )}
                   </div>
                   <div className="col-span-3">
                      {isEditing ? (
                          <textarea 
                             value={editValue}
                             onChange={e => setEditValue(e.target.value)}
                             className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 min-h-[60px] font-mono"
                          />
                      ) : (
                          <div className="text-sm text-slate-300 font-mono bg-slate-900/50 px-2 py-1 rounded inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                             {typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value)}
                          </div>
                      )}
                   </div>
                   <div className="col-span-2 flex items-start justify-end gap-2 mt-1">
                      {isEditing ? (
                          <>
                              <button 
                                 onClick={() => setEditingKey(null)}
                                 className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                              >
                                 Cancel
                              </button>
                              <button 
                                 onClick={() => saveMutation.mutate({ key: setting.key, value: editValue, description: editDescription })}
                                 disabled={saveMutation.isPending}
                                 className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
                              >
                                 <Save size={14} /> Save
                              </button>
                          </>
                      ) : (
                          <div className="flex items-center gap-3">
                              {showSuccess === setting.key && (
                                  <span className="text-emerald-400 text-xs flex items-center gap-1 animate-in fade-in zoom-in duration-300">
                                      <CheckCircle2 size={14} /> Saved
                                  </span>
                              )}
                              <button 
                                 onClick={() => {
                                     setEditingKey(setting.key);
                                     setEditValue(typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value));
                                     setEditDescription(setting.description || '');
                                 }}
                                 className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs font-medium transition-colors"
                              >
                                 Edit
                              </button>
                          </div>
                      )}
                   </div>
                </div>
            )})}
            {settings?.length === 0 && (
                <div className="px-6 py-8 text-center text-slate-500">
                    No settings found.
                </div>
            )}
          </div>
       </div>
    </div>
  );
}
