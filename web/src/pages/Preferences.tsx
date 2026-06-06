import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

export default function Preferences() {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState('dark');
  const [columns, setColumns] = useState(12);
  const [githubRepo, setGithubRepo] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [githubPath, setGithubPath] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [pushOnArchive, setPushOnArchive] = useState(false);
  const [syncScratchpad, setSyncScratchpad] = useState(false);
  
  const [showSaveMessage, setShowSaveMessage] = useState(false);

  const { data: prefsData, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.get('/api/preferences')
  });

  useEffect(() => {
    if (prefsData) {
      if (prefsData.theme) setTheme(prefsData.theme);
      if (prefsData.dashboard_columns) setColumns(prefsData.dashboard_columns);
      if (prefsData.github_repo) setGithubRepo(prefsData.github_repo);
      if (prefsData.github_branch) setGithubBranch(prefsData.github_branch);
      if (prefsData.github_notes_path) setGithubPath(prefsData.github_notes_path);
      if (prefsData.github_token) setGithubToken(prefsData.github_token);
      if (prefsData.github_push_on_archive) setPushOnArchive(true);
      if (prefsData.github_sync_scratchpad) setSyncScratchpad(true);
    }
  }, [prefsData]);

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
          dashboard_columns: columns,
          github_repo: githubRepo,
          github_branch: githubBranch,
          github_notes_path: githubPath,
          github_token: githubToken,
          github_push_on_archive: pushOnArchive,
          github_sync_scratchpad: syncScratchpad
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

            {/* GitHub Offsite Backup */}
            <div>
               <h3 className="text-lg font-medium text-slate-100 mb-2">GitHub Offsite Backup</h3>
               <p className="text-sm text-slate-400 mb-6 max-w-2xl">
                   Automatically push your notes and scratchpads to a private GitHub repository for secure, version-controlled offsite backup and static site generation.
               </p>

               <div className="space-y-5 max-w-xl">
                   <div>
                       <label className="block text-sm font-medium text-slate-300 mb-1">GitHub Personal Access Token</label>
                       <input 
                          type="password"
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                       />
                       <p className="text-xs text-slate-500 mt-1.5">Needs `contents:write` scope for the target repository. Token is stored securely.</p>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                       <div>
                           <label className="block text-sm font-medium text-slate-300 mb-1">Repository <span className="text-slate-500">(owner/repo)</span></label>
                           <input 
                              type="text"
                              value={githubRepo}
                              onChange={(e) => setGithubRepo(e.target.value)}
                              placeholder="username/my-notes"
                              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                           />
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-slate-300 mb-1">Branch</label>
                           <input 
                              type="text"
                              value={githubBranch}
                              onChange={(e) => setGithubBranch(e.target.value)}
                              placeholder="main"
                              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                           />
                       </div>
                   </div>

                   <div>
                       <label className="block text-sm font-medium text-slate-300 mb-1">Path Prefix</label>
                       <input 
                          type="text"
                          value={githubPath}
                          onChange={(e) => setGithubPath(e.target.value)}
                          placeholder="src/content/notes/"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm font-mono"
                       />
                       <p className="text-xs text-slate-500 mt-1.5">Optional directory prefix for notes. Leave blank for root.</p>
                   </div>

                   <div className="bg-slate-900/50 rounded-lg p-4 space-y-4 border border-slate-800">
                       <label className="flex items-start gap-3 cursor-pointer">
                           <input 
                              type="checkbox"
                              checked={pushOnArchive}
                              onChange={(e) => setPushOnArchive(e.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                           />
                           <div>
                               <span className="block text-sm font-medium text-slate-200">Auto-push on archive</span>
                               <span className="block text-xs text-slate-400 mt-0.5">Push a new Markdown file to GitHub every time you archive the scratchpad.</span>
                           </div>
                       </label>

                       <label className="flex items-start gap-3 cursor-pointer">
                           <input 
                              type="checkbox"
                              checked={syncScratchpad}
                              onChange={(e) => setSyncScratchpad(e.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                           />
                           <div>
                               <span className="block text-sm font-medium text-slate-200">Sync scratchpad on autosave</span>
                               <span className="block text-xs text-slate-400 mt-0.5">Continuously sync your active scratchpad to 'scratchpad.md' in the repository.</span>
                           </div>
                       </label>
                   </div>
               </div>
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
