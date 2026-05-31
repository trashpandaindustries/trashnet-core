import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import Sidebar from './Sidebar';
import { api } from '../lib/api';

export default function ProtectedRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      try {
        await api.get('/api/auth/me');
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-emerald-500 font-mono text-sm tracking-widest uppercase">
        Initializing Session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-400 font-mono relative overflow-hidden">
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/80 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          <span className="text-slate-100 font-bold tracking-tighter text-lg">trashnet_<span className="text-emerald-500">core</span></span>
          <span className="text-xs border border-slate-700 px-2 py-0.5 rounded text-slate-500">v0.1.0-alpha.1</span>
        </div>
        <div className="flex gap-6 text-[10px] uppercase tracking-widest">
           <div className="flex flex-col items-end">
            <span className="text-slate-600">Operator</span>
            <span className="text-emerald-500">ADMIN</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden z-10">
        <Sidebar />
        <main className="flex-1 overflow-y-auto outline-none p-6 relative">
          <Outlet />
        </main>
      </div>

      {/* Bottom Console Bar */}
      <footer className="h-10 border-t border-slate-900 bg-slate-950 flex items-center justify-between px-6 text-[10px] text-slate-600 shrink-0 z-10">
        <div className="flex gap-4">
          <span>SYSTEM_ONLINE</span>
          <span className="text-slate-800">|</span>
          <span>SECURE_CONNECTION</span>
        </div>
      </footer>
    </div>
  );
}
