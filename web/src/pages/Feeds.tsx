import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, Trash2, Edit2, Settings2, RefreshCw, Rss, Code2 } from 'lucide-react';

import { JsonTree } from '../components/JsonTree';

export default function Feeds() {
  const queryClient = useQueryClient();
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { data: sources, isLoading } = useQuery({
    queryKey: ['feedSources'],
    queryFn: async () => {
      const res = await api.get('/api/feeds/sources');
      return res;
    }
  });

  const deleteSource = useMutation({
    mutationFn: (id: string) => api.delete(`/api/feeds/sources/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedSources'] })
  });

  const pollSource = useMutation({
    mutationFn: (id: string) => api.post(`/api/feeds/sources/${id}/poll`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedSources'] })
  });
  
  if (selectedSource) {
    return <FeedEditor source={selectedSource} onBack={() => setSelectedSource(null)} />;
  }
  
  if (isAdding) {
    return <FeedEditor source={null} onBack={() => setIsAdding(false)} />;
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-full">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
             <Rss size={24} className="text-indigo-400" />
             Feed Sources
          </h1>
          <p className="text-slate-500 mt-1">Manage external JSON and RSS feeds.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={16} /> Add Source
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex-1">
        {isLoading ? (
           <div className="p-8 text-center text-slate-500 animate-pulse">Loading sources...</div>
        ) : !sources || sources.length === 0 ? (
           <div className="p-16 flex flex-col items-center justify-center text-slate-500">
             <Rss size={48} className="mb-4 text-slate-700" />
             <p>No feed sources configured.</p>
           </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {sources.map((source: any) => (
              <div key={source.id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${source.feed_type === 'rss' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {source.feed_type === 'rss' ? <Rss size={20} /> : <Code2 size={20} />}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-200">{source.name}</h3>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                       <span className="truncate max-w-xs">{source.endpoint_url}</span>
                       <span className="flex items-center gap-1">
                         <div className={`w-2 h-2 rounded-full ${source.failure_count === 0 ? 'bg-emerald-500' : source.failure_count > 3 ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                         {source.failure_count === 0 ? 'Healthy' : `${source.failure_count} Failures`}
                       </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => pollSource.mutate(source.id)}
                    disabled={pollSource.isPending}
                    className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors border border-transparent"
                    title="Poll Now"
                  >
                    <RefreshCw size={16} className={pollSource.isPending ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setSelectedSource(source)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Settings2 size={16} />
                  </button>
                  <button 
                    onClick={() => { if(confirm('Delete source?')) deleteSource.mutate(source.id); }}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedEditor({ source, onBack }: { source: any, onBack: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: source?.name || '',
    endpoint_url: source?.endpoint_url || '',
    feed_type: source?.feed_type || 'json',
    items_path: source?.items_path || '',
    poll_interval_s: source?.poll_interval_s || 300,
    show_on_dashboard: source?.show_on_dashboard || false
  });
  
  const [previewData, setPreviewData] = useState<any>(null);
  const [mappings, setMappings] = useState<{display_field: string, payload_path: string}[]>([]);
  const [isRefetching, setIsRefetching] = useState(false);

  useQuery({
    queryKey: ['feedSourceDetails', source?.id],
    queryFn: async () => {
      if (!source?.id) return null;
      const res = await api.get(`/api/feeds/sources/${source.id}`);
      setMappings(res?.mappings || []);
      return res;
    },
    enabled: !!source?.id
  });

  const saveSource = useMutation({
    mutationFn: async () => {
      const method = source ? 'put' : 'post';
      const url = source ? `/api/feeds/sources/${source.id}` : `/api/feeds/sources`;
      const res = await api[method](url, formData);
      return res;
    },
    onSuccess: async (data) => {
      try {
        if (mappings.length > 0 && data?.id) {
          await api.put(`/api/feeds/sources/${data.id}/mappings`, mappings);
        }
      } catch (e) {
        console.error("Failed to save mappings", e);
      }
      queryClient.invalidateQueries({ queryKey: ['feedSources'] });
      onBack();
    }
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const fetchPreview = async () => {
    setIsRefetching(true);
    try {
      const res = await api.post('/api/feeds/sources/preview', {
        endpoint_url: formData.endpoint_url,
        feed_type: formData.feed_type
      });
      setPreviewData(res);
    } catch(e) {
      alert("Failed to fetch preview");
    } finally {
      setIsRefetching(false);
    }
  };

  const updateMapping = (field: string, path: string) => {
    setMappings(prev => {
      const idx = prev.findIndex(m => m.display_field === field);
      if (idx >= 0) {
        if (!path) return prev.filter((_, i) => i !== idx); // remove
        const next = [...prev];
        next[idx] = { ...next[idx], payload_path: path };
        return next;
      }
      if (!path) return prev;
      return [...prev, { display_field: field, payload_path: path }];
    });
  };

  const handlePathSelect = (path: string) => {
    if (focusedField) {
      updateMapping(focusedField, path);
    }
  };

  const getMapping = (field: string) => mappings.find(m => m.display_field === field)?.payload_path || '';
  
  // Test mapping render locally
  const applyMappingLocal = (payload: any) => {
    // Helper resolver matching backend
    const resolvePath = (obj: any, path: string) => path.split('.').reduce((acc, k) => acc?.[k], obj) ?? null;
    
    // items_path
    let items = payload;
    if (formData.items_path) {
      items = resolvePath(payload, formData.items_path) || [];
    } else {
       items = Array.isArray(payload) ? payload : [payload];
    }
    
    if (!Array.isArray(items) || items.length === 0) return null;
    
    const sample = items[0];
    const result: any = {};
    for (const {display_field, payload_path} of mappings) {
      const val = resolvePath(sample, payload_path);
      if (val !== null && val !== undefined) result[display_field] = String(val);
    }
    return result;
  };

  const sampleMapped = previewData ? applyMappingLocal(previewData) : null;

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/50 text-sm font-medium">← Back</button>
        <h2 className="text-xl font-bold text-slate-100">{source ? 'Edit Source' : 'New Source'}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full min-h-0">
        
        {/* Left Col: Config */}
        <div className="flex flex-col gap-6 overflow-y-auto pr-2 pb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-medium text-slate-200 mb-4">Basic Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Name</label>
                <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="E.g. GitHub Releases" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Endpoint URL</label>
                <input type="url" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-indigo-500" value={formData.endpoint_url} onChange={e => setFormData({...formData, endpoint_url: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Type</label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 appearance-none" value={formData.feed_type} onChange={e => setFormData({...formData, feed_type: e.target.value as any})}>
                    <option value="json">JSON API</option>
                    <option value="rss">RSS / Atom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Poll Interval (s)</label>
                  <input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.poll_interval_s} onChange={e => setFormData({...formData, poll_interval_s: parseInt(e.target.value) || 300})} />
                </div>
              </div>
              {formData.feed_type === 'json' && (
                <div>
                   <label className="block text-xs font-semibold uppercase text-slate-500 mb-1 flex justify-between">
                     Items Array Path
                     <span className="text-[10px] text-slate-600 normal-case font-normal">(Leave blank if root is array)</span>
                   </label>
                   <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-indigo-500" value={formData.items_path} onChange={e => setFormData({...formData, items_path: e.target.value})} placeholder="e.g. data.results" />
                </div>
              )}
              <div className="pt-2">
                <label className="flex items-center gap-3">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-800 bg-slate-950 accent-indigo-500" checked={formData.show_on_dashboard} onChange={e => setFormData({...formData, show_on_dashboard: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-300">Show on Dashboard</span>
                </label>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-800">
               <button 
                  onClick={fetchPreview} 
                  disabled={!formData.endpoint_url || isRefetching}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
               >
                 <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
                 Fetch Sample Data
               </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">Field Mappings</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">Map the incoming payload dot-paths to card display fields. Use the sample tree on the right to find paths.</p>
            
            <div className="space-y-3">
              {['title', 'date', 'url', 'author', 'summary', 'image_url', 'badge', 'badge_color'].map(field => (
                <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-2 group">
                  <div className="w-32 shrink-0">
                    <span className="text-xs font-mono font-medium text-slate-400 capitalize">{field} {field==='title'&&'*'}</span>
                  </div>
                  <input 
                    type="text" 
                    className={`flex-1 bg-slate-950 border border-slate-800 rounded md:rounded-lg px-3 py-1.5 text-slate-200 font-mono text-xs focus:outline-none transition-colors ${focusedField === field ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'focus:border-indigo-500 placeholder-slate-700'}`} 
                    value={getMapping(field)} 
                    onChange={e => updateMapping(field, e.target.value)} 
                    onFocus={() => setFocusedField(field)}
                    onBlur={() => setTimeout(() => setFocusedField(null), 200)}
                    placeholder="e.g. some.dot.path" 
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => saveSource.mutate()}
                disabled={saveSource.isPending || !formData.name || !formData.endpoint_url}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                {saveSource.isPending ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Preview */}
        <div className="bg-[#0f111a] border border-slate-800 rounded-xl overflow-hidden shadow-inner flex flex-col h-[500px] lg:h-full pb-0">
           <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 flex justify-between items-center shrink-0">
             <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Payload Inspector</span>
             {isRefetching && <span className="text-[10px] text-sky-400 font-medium animate-pulse">Loading API data...</span>}
             {!isRefetching && focusedField && <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-medium animate-pulse">Select path for {focusedField}</span>}
           </div>
           <div className="p-4 overflow-auto flex-1 text-xs font-mono relative">
             {previewData ? (
                <div className={`text-slate-300 select-none transition-opacity ${isRefetching ? 'opacity-50' : 'opacity-100'}`}>
                  {/* Provide a random key each fetch to reset tree expansion state naturally */}
                  <JsonTree key={isRefetching ? 'loading' : 'loaded'} data={previewData} onSelectPath={handlePathSelect} />
                </div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4">
                   <Code2 size={48} className="opacity-20" />
                   <p>Fetch sample data to view payload.</p>
                </div>
             )}
           </div>

           {/* Test Card View */}
           {sampleMapped && Object.keys(sampleMapped).length > 0 && (
             <div className="border-t border-slate-800 bg-slate-900/80 p-4 shrink-0">
                <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-3">Test Card Preview</h4>
                <div className="flex flex-col gap-1 text-sm bg-slate-800/80 p-3 rounded-lg border border-slate-700 shadow-sm max-w-sm">
                 {sampleMapped.title && (
                   <div className="font-semibold text-slate-200 leading-snug">
                     {sampleMapped.url ? (
                       <a href={sampleMapped.url} target="_blank" rel="noreferrer" className="hover:text-indigo-400 hover:underline">{sampleMapped.title}</a>
                     ) : sampleMapped.title}
                   </div>
                 )}
                 
                 {(sampleMapped.author || sampleMapped.date || sampleMapped.badge) && (
                   <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-medium mt-1">
                     {sampleMapped.badge && (
                       <span className="px-1.5 py-0.5 rounded uppercase font-bold text-white tracking-wide" style={{ backgroundColor: sampleMapped.badge_color || '#475569' }}>
                         {sampleMapped.badge}
                       </span>
                     )}
                     {sampleMapped.author && <span>{sampleMapped.author}</span>}
                     {sampleMapped.date && <span>{sampleMapped.date}</span>}
                   </div>
                 )}
                 
                 {sampleMapped.summary && (
                   <div className="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                     {sampleMapped.summary}
                   </div>
                 )}
               </div>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
