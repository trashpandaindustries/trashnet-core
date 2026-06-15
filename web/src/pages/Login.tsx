import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/auth/login', { username, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-950 text-slate-400 font-mono relative overflow-hidden">
      {/* Grid Background Decoration */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          <span className="text-slate-100 font-bold tracking-tighter text-lg">trashnet_<span className="text-emerald-500">core</span></span>
          <span className="text-xs border border-slate-700 px-2 py-0.5 rounded text-slate-500 hidden sm:inline-block">v0.1.0-alpha.1</span>
        </div>
        <div className="flex gap-6 text-[10px] uppercase tracking-widest">
          <div className="flex flex-col items-end">
            <span className="text-slate-600 hidden sm:inline">System Status</span>
            <span className="text-emerald-500">001_SKELETON_ACTIVE</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Login Area */}
        <main className="flex-1 relative flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"></div>
          
          {/* Login Card */}
          <div className="w-full max-w-[400px] bg-slate-900 border border-slate-800 shadow-2xl z-20 overflow-hidden">
            <div className="h-1 bg-emerald-500 w-full shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
            
            <div className="p-8">
              <div className="mb-8 space-y-2">
                <h2 className="text-slate-100 text-xl font-bold tracking-tight">System Authentication</h2>
                <p className="text-xs text-slate-500 uppercase tracking-widest">Accessing local.trashnet.home</p>
              </div>

              <form className="space-y-6" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Operator ID</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 p-3 text-slate-200 focus:border-emerald-500 outline-none transition-colors text-sm font-mono" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Access Code</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 p-3 text-slate-200 focus:border-emerald-500 outline-none transition-colors text-sm font-mono" 
                  />
                </div>

                {error && (
                  <div className="text-emerald-500 text-xs font-bold tracking-widest uppercase border border-emerald-900 bg-emerald-950/30 p-3">
                    [ERR] {error}
                  </div>
                )}

                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-3 uppercase text-xs tracking-[0.2em] transition-all">
                  Initialize Session
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-800/50 flex justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-600 uppercase">Database</span>
                  <span className="text-[10px] text-emerald-500">PG_CONNECTED</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[9px] text-slate-600 uppercase">API Layer</span>
                  <span className="text-[10px] text-slate-400">EXPRESS_READY</span>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Flourishes */}
          <div className="absolute top-10 right-10 text-[10px] text-slate-800 font-mono text-right pointer-events-none hidden lg:block">
            DB_POOL_INIT: 0.04ms<br/>
            JWT_SECRET: LOADED<br/>
            RLS_POLICIES: ACTIVE
          </div>
          <div className="absolute bottom-10 left-10 text-[10px] text-slate-800 font-mono pointer-events-none hidden lg:block">
            [WARN] CADDY_STUB: NO_UPSTREAM_AUTHELIA<br/>
            [INFO] DOCKER_CONTAINER_ID: 7f83a21bc902
          </div>
        </main>
      </div>

      {/* Bottom Console Bar */}
      <footer className="h-10 bg-slate-950 border-t border-slate-900 flex items-center justify-between px-6 text-[10px] text-slate-600 z-10 shrink-0">
        <div className="flex gap-4">
          <span className="hidden sm:inline">PHASE_01: STACK_SKELETON</span>
          <span className="text-slate-800 hidden sm:inline">|</span>
          <span>MIGRATION_001: COMPLETED</span>
        </div>
        <div className="flex gap-4">
          <span className="hidden sm:inline">Node.js v20</span>
          <span>PostgreSQL 16</span>
        </div>
      </footer>
    </div>
  );
}
