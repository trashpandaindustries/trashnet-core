import { NavLink, useNavigate } from 'react-router';
import { Home, FileText, Bookmark, LayoutDashboard, Rss, Folder, LogOut } from 'lucide-react';
import { api } from '../lib/api';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Notes', href: '/notes', icon: FileText },
  { name: 'Bookmarks', href: '/bookmarks', icon: Bookmark },
  { name: 'Kanban', href: '/kanban', icon: LayoutDashboard },
  { name: 'Feeds', href: '/feeds', icon: Rss },
  { name: 'Files', href: '/files', icon: Folder },
];

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch (e) {
      // Ignore
    }
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <aside className="w-64 border-r border-slate-900 bg-slate-950/60 p-6 flex flex-col gap-8 opacity-90 h-full backdrop-blur z-10 shrink-0">
      <div className="space-y-4">
        <div className="text-[10px] text-slate-600 uppercase tracking-[0.2em] font-bold">Navigation</div>
        <nav className="flex flex-col gap-2">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) => 
                `group flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                  isActive 
                    ? 'text-emerald-500 border-l-2 border-emerald-500 bg-slate-900/50' 
                    : 'text-slate-400 border-l-2 border-transparent hover:text-slate-200 hover:bg-slate-900/30'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon 
                    className={`shrink-0 h-4 w-4 ${isActive ? 'text-emerald-500' : 'text-slate-500 group-hover:text-slate-400'}`} 
                    aria-hidden="true" 
                  />
                  {item.name}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="mt-auto border-t border-slate-900 pt-6">
        <button
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:text-emerald-500 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0 transition-colors" />
          Terminate Session
        </button>
      </div>
    </aside>
  );
}
