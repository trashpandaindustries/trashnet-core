import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

export default function Preferences() {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState('dark');
  const [columns, setColumns] = useState(12);
  const [showSaveMessage, setShowSaveMessage] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: async () => {
      const res = await api.get('/api/preferences');
      if (res) {
          if (res.theme) setTheme(res.theme);
          if (res.dashboard_columns) setColumns(res.dashboard_columns);
      }
      return res;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (prefs: any) => {
      return api.put('/api/preferences', { preferences: prefs });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 3000);
    }
  });

  const handleSave = () => {
      saveMutation.mutate({
          theme,
          dashboard_columns: columns
      });
  };

  if (isLoading) return <div className="p-8 text-slate-500 animate-pulse">Loading preferences...</div>;

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Settings size={24} className="text-indigo-400" />
            Preferences
          </h1>
          <p className="text-slate-500 mt-1">Manage your dashboard settings</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="bg-[#0f111a] border border-slate-800 rounded-xl p-6 md:p-8 space-y-8">
            
            {/* Theme setting */}
            <div>
               <h3 className="text-sm font-medium text-slate-200 mb-3">Interface Theme</h3>
               <div className="flex gap-4">
                  <button 
                     onClick={() => setTheme('dark')}
                     className={`flex items-center justify-center px-4 py-3 border rounded font-medium text-sm transition-colors ${
                         theme === 'dark' 
                         ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' 
                         : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                     }`}
                  >
                     Dark Theme
                  </button>
                  <button 
                     onClick={() => setTheme('light')}
                     className={`flex items-center justify-center px-4 py-3 border rounded font-medium text-sm transition-colors ${
                         theme === 'light' 
                         ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' 
                         : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                     }`}
                  >
                     Light Theme
                  </button>
               </div>
               <p className="text-xs text-slate-500 mt-2">Light mode support is experimental in this release.</p>
            </div>

            <hr className="border-slate-800" />

            {/* Dashboard Columns setting */}
            <div>
               <h3 className="text-sm font-medium text-slate-200 mb-3">Dashboard Grid Columns</h3>
               <div className="flex gap-4 items-center">
                  <input 
                     type="number"
                     min="4"
                     max="24"
                     value={columns}
                     onChange={(e) => setColumns(parseInt(e.target.value) || 12)}
                     className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 w-24 font-mono"
                  />
                  <span className="text-sm text-slate-400">columns</span>
               </div>
               <p className="text-xs text-slate-500 mt-2">Adjust the resolution of the dashboard grid. Default is 12.</p>
            </div>

            <hr className="border-slate-800" />

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4">
                <button 
                   onClick={handleSave}
                   disabled={saveMutation.isPending}
                   className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded font-medium transition-colors"
                >
                   {saveMutation.isPending ? 'Saving...' : (
                      <>
                        <Save size={18} /> Save Preferences
                      </>
                   )}
                </button>
                
                {showSaveMessage && (
                   <span className="flex items-center gap-2 text-emerald-400 text-sm font-medium animate-in fade-in slide-in-from-left-2">
                      <CheckCircle2 size={16} /> Saved options
                   </span>
                )}
            </div>

        </div>
      </div>
    </div>
  );
}
