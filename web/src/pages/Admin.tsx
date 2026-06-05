import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ShieldAlert, Users as UsersIcon, Plus, UserX, UserCheck, KeySquare, CheckCircle2, Edit3, Settings, ScrollText } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import AdminSettings from '../components/AdminSettings';
import AdminLogs from '../components/AdminLogs';

export default function Admin() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'logs'>('users');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('user');

  const editUserMutation = useMutation({
    mutationFn: async () => {
      return api.put(`/api/users/${editingUser.id}`, { 
          username: editUsername, 
          email: editEmail,
          role: editRole,
          is_active: editingUser.is_active // keep existing
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsEditOpen(false);
      setEditingUser(null);
    }
  });

  const openEdit = (user: any) => {
      setEditingUser(user);
      setEditUsername(user.username);
      setEditEmail(user.email || '');
      setEditRole(user.role);
      setIsEditOpen(true);
  };

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      return api.get('/api/users');
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      return api.post('/api/users', { username: newUsername, password: newPassword, email: newEmail });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewEmail('');
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (user: any) => {
      return api.put(`/api/users/${user.id}`, { ...user, is_active: !user.is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/api/users/${resetUserId}/reset-password`, { password: resetPassword });
    },
    onSuccess: () => {
      setIsResetOpen(false);
      setResetPassword('');
      setResetUserId('');
    }
  });

  if (isLoading) return <div className="p-8 text-slate-500 animate-pulse">Loading users...</div>;
  if (error) return (
      <div className="p-8 flex flex-col gap-4 text-red-400">
          <ShieldAlert size={48} className="text-red-500/50" />
          <p>You do not have administrative privileges, or an error occurred.</p>
      </div>
  );

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <ShieldAlert size={24} className="text-indigo-400" />
            Platform Admin
          </h1>
          <p className="text-slate-500 mt-1">Manage platform accounts, settings, and access</p>
        </div>
        {activeTab === 'users' && (
            <button 
               onClick={() => setIsCreateOpen(true)}
               className="flex items-center gap-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-medium transition-colors"
            >
               <Plus size={16} /> New User
            </button>
        )}
      </div>

      <div className="flex gap-6 border-b border-slate-800 mb-6 shrink-0">
         <button onClick={() => setActiveTab('users')} className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'users' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'}`}>
             <UsersIcon size={16}/> Users
         </button>
         <button onClick={() => setActiveTab('settings')} className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'settings' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'}`}>
             <Settings size={16}/> Settings
         </button>
         <button onClick={() => setActiveTab('logs')} className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'logs' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'}`}>
             <ScrollText size={16}/> File Audit Logs
         </button>
      </div>

      {activeTab === 'settings' && <AdminSettings />}
      {activeTab === 'logs' && <AdminLogs />}

      {activeTab === 'users' && (
      <div className="flex-1 overflow-auto bg-[#0f111a] border border-slate-800 rounded-xl">
         <div className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>
            <div className="grid grid-cols-12 gap-4 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10">
               <div className="col-span-3">User</div>
               <div className="col-span-3">Email</div>
               <div className="col-span-2">Role</div>
               <div className="col-span-2">Status</div>
               <div className="col-span-2 text-right">Actions</div>
            </div>
            
            <div className="divide-y divide-slate-800/60">
              {users?.map((user: any) => (
                  <div key={user.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-800/30 transition-colors">
                     <div className="col-span-3 font-medium text-slate-200">
                        {user.username}
                        <div className="text-[10px] text-slate-500 font-mono mt-1">{user.id.split('-')[0]}...</div>
                     </div>
                     <div className="col-span-3 text-sm text-slate-400">
                        {user.email || <span className="italic opacity-50">No email</span>}
                     </div>
                     <div className="col-span-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            user.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                            {user.role}
                        </span>
                     </div>
                     <div className="col-span-2 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs text-slate-400">
                            {user.is_active ? 'Active' : 'Disabled'}
                        </span>
                     </div>
                     <div className="col-span-2 flex items-center justify-end gap-2">
                        <button 
                           onClick={() => openEdit(user)}
                           className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors"
                           title="Edit User"
                        >
                           <Edit3 size={16} />
                        </button>
                        <button 
                           onClick={() => {
                               setResetUserId(user.id);
                               setIsResetOpen(true);
                           }}
                           className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                           title="Reset Password"
                        >
                           <KeySquare size={16} />
                        </button>
                        <button 
                           onClick={() => toggleActiveMutation.mutate(user)}
                           disabled={user.role === 'admin'} // basic safety check for self-disable
                           className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                           title={user.is_active ? "Deactivate" : "Activate"}
                        >
                           {user.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                     </div>
                  </div>
              ))}
            </div>
         </div>
      </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-sm bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700 p-6">
            <Dialog.Title className="text-lg font-medium text-slate-100 mb-6 flex items-center gap-2">
              <UsersIcon size={20} className="text-indigo-400" /> Create User
            </Dialog.Title>
            
            <div className="space-y-4">
               <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Username</label>
                  <input 
                     type="text" 
                     value={newUsername}
                     onChange={e => setNewUsername(e.target.value)}
                     className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" 
                  />
               </div>
               <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Email (Optional)</label>
                  <input 
                     type="email" 
                     value={newEmail}
                     onChange={e => setNewEmail(e.target.value)}
                     className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" 
                  />
               </div>
               <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Password</label>
                  <input 
                     type="password" 
                     value={newPassword}
                     onChange={e => setNewPassword(e.target.value)}
                     className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" 
                  />
               </div>
               <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
                  User will automatically be seeded with a scratchpad and default Kanban columns.
               </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
               <button onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                 Cancel
               </button>
               <button 
                 onClick={() => createUserMutation.mutate()}
                 disabled={!newUsername || !newPassword || createUserMutation.isPending}
                 className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-medium transition-colors"
               >
                 {createUserMutation.isPending ? 'Creating...' : 'Create User'}
               </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetOpen} onClose={() => setIsResetOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-sm bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700 p-6">
            <Dialog.Title className="text-lg font-medium text-slate-100 mb-6 flex items-center gap-2">
              <KeySquare size={20} className="text-amber-400" /> Reset Password
            </Dialog.Title>
            
            <div className="space-y-4">
               <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">New Password</label>
                  <input 
                     type="password" 
                     value={resetPassword}
                     onChange={e => setResetPassword(e.target.value)}
                     className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500" 
                  />
               </div>
               <div className="text-[10px] text-amber-500/80 pt-2 border-t border-slate-800">
                  This will immediately sign out the user from all active sessions.
               </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
               {resetPasswordMutation.isSuccess ? (
                   <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12}/> Reset Complete</span>
               ) : <span></span>}
               <div className="flex gap-3">
                   <button onClick={() => setIsResetOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                     Cancel
                   </button>
                   <button 
                     onClick={() => resetPasswordMutation.mutate()}
                     disabled={!resetPassword || resetPasswordMutation.isPending}
                     className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded font-medium transition-colors"
                   >
                     {resetPasswordMutation.isPending ? 'Resetting...' : 'Force Reset'}
                   </button>
               </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onClose={() => setIsEditOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-sm bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700 p-6">
            <Dialog.Title className="text-lg font-medium text-slate-100 mb-6 flex items-center gap-2">
              <Edit3 size={20} className="text-indigo-400" /> Edit User
            </Dialog.Title>
            
            <div className="space-y-4">
               <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Username</label>
                  <input 
                     type="text" 
                     value={editUsername}
                     onChange={e => setEditUsername(e.target.value)}
                     className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" 
                  />
               </div>
               <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Email</label>
                  <input 
                     type="email" 
                     value={editEmail}
                     onChange={e => setEditEmail(e.target.value)}
                     className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" 
                  />
               </div>
               <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Role</label>
                  <select 
                     value={editRole}
                     onChange={e => setEditRole(e.target.value)}
                     className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" 
                  >
                     <option value="user">User</option>
                     <option value="admin">Admin</option>
                  </select>
               </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
               <button onClick={() => setIsEditOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                 Cancel
               </button>
               <button 
                 onClick={() => editUserMutation.mutate()}
                 disabled={!editUsername || editUserMutation.isPending}
                 className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-medium transition-colors"
               >
                 {editUserMutation.isPending ? 'Saving...' : 'Save Changes'}
               </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
