import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DndContext, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core';
import { DroppableCell } from '../components/DroppableCell';
import { DraggableModule } from '../components/DraggableModule';
import { PlusCircle, Activity, Box, LayoutGrid } from 'lucide-react';

interface ModuleConfig {
  id: string;
  module_type: string;
  ref_id: string | null;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [wsData, setWsData] = useState<{ stats: any, docker: any } | null>(null);
  const [wsStatus, setWsStatus] = useState<string>('Connecting...');
  
  // WS Connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/system/live?token=${token}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => setWsStatus('Connected');
    ws.onclose = (e) => setWsStatus(`Closed: ${e.code} ${e.reason}`);
    ws.onerror = (err) => setWsStatus('WS Error');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'system_update') {
          setWsData({ stats: data.stats, docker: data.docker });
        }
      } catch (err) {
        console.error('WS MSG Parse Error', err);
      }
    };
    
    return () => ws.close();
  }, []);

  const { data: modules = [] } = useQuery<ModuleConfig[]>({
    queryKey: ['dashboard', 'modules'],
    queryFn: () => api.get('/api/dashboard/modules')
  });

  const updateModule = useMutation({
    mutationFn: (args: { id: string, updates: Partial<ModuleConfig> }) => {
      return api.put(`/api/dashboard/modules/${args.id}`, args.updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', 'modules'] })
  });

  const addModule = useMutation({
    mutationFn: (args: Partial<ModuleConfig>) => {
      return api.post('/api/dashboard/modules', args);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', 'modules'] })
  });

  const deleteModule = useMutation({
    mutationFn: (id: string) => {
      return api.delete(`/api/dashboard/modules/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard', 'modules'] })
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
       const cellData = over.data.current as { x: number, y: number };
       const moduleId = active.id as string;
       const mod = modules.find(m => m.id === moduleId);
       if (mod && (mod.pos_x !== cellData.x || mod.pos_y !== cellData.y)) {
           // Optimistic update
           queryClient.setQueryData(['dashboard', 'modules'], (old: ModuleConfig[]) => {
              return old.map(m => m.id === moduleId ? { ...m, pos_x: cellData.x, pos_y: cellData.y } : m);
           });
           updateModule.mutate({ id: moduleId, updates: { pos_x: cellData.x, pos_y: cellData.y } });
       }
    }
  };

  const renderModuleContent = (mod: ModuleConfig) => {
    if (mod.module_type === 'system_stats') {
       if (!wsData?.stats) return <div className="text-slate-500 text-sm animate-pulse">Waiting for telemetry...</div>;
       const memUsedGB = (wsData.stats.memory.used / 1024 / 1024 / 1024).toFixed(1);
       const memTotalGB = (wsData.stats.memory.total / 1024 / 1024 / 1024).toFixed(1);
       const load = wsData.stats.cpuLoad ? wsData.stats.cpuLoad[0].toFixed(2) : '0.00';
       const uptimeDays = Math.floor(wsData.stats.uptime / 86400);
       return (
         <div className="flex flex-col gap-4 h-full text-sm">
           <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
             <Activity size={16} /> SYSTEM STATS
           </div>
           <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-slate-500">CPU Load (1m)</span>
              <span className="text-slate-200 font-mono">{load}</span>
           </div>
           <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-slate-500">Memory Usage</span>
              <span className="text-slate-200 font-mono">{memUsedGB}G / {memTotalGB}G</span>
           </div>
           <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-slate-500">Uptime</span>
              <span className="text-slate-200 font-mono">{uptimeDays}d {Math.floor((wsData.stats.uptime % 86400) / 3600)}h</span>
           </div>
         </div>
       );
    }
    if (mod.module_type === 'docker_services') {
       if (!wsData?.docker) return <div className="text-slate-500 text-sm animate-pulse">Waiting for Docker...</div>;
       return (
         <div className="flex flex-col h-full text-sm">
           <div className="flex items-center gap-2 text-emerald-400 font-bold mb-4 shrink-0">
             <Box size={16} /> DOCKER SERVICES
             <div className="ml-auto flex items-center gap-1.5 text-xs font-normal text-slate-500">
                {wsData.docker.status === 'ok' ? (
                  <><div className="w-2 h-2 rounded-full bg-emerald-500"></div> <span className="hidden sm:inline">Connected</span></>
                ) : wsData.docker.status === 'unconfigured' ? (
                  <><div className="w-2 h-2 rounded-full bg-amber-500"></div> <span className="hidden sm:inline">Unconfigured</span></>
                ) : (
                  <><div className="w-2 h-2 rounded-full bg-rose-500" title={wsData.docker.error || 'Connection error'}></div> <span className="hidden sm:inline" title={wsData.docker.error || 'Connection error'}>Error</span></>
                )}
             </div>
           </div>
           
           {wsData.docker.status === 'unconfigured' ? (
             <div className="text-slate-500 text-xs">Portainer connection is unconfigured.</div>
           ) : wsData.docker.status === 'error' ? (
             <div className="text-rose-500/80 text-xs break-words">{wsData.docker.error || 'Failed to connect to Portainer.'}</div>
           ) : (
             <div className="overflow-y-auto pr-2 space-y-2 flex-1 relative">
               {wsData.docker.services.map((svc: any) => (
                  <div key={svc.id} className="flex justify-between items-center p-3 rounded bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 transition-colors">
                     <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 shrink-0 rounded-full ${svc.state === 'running' ? 'bg-emerald-500' : 'bg-rose-500'}`} title={svc.state}></div>
                           {svc.link ? (
                              <a href={svc.link} target="_blank" rel="noreferrer" className="text-slate-200 text-sm font-medium truncate hover:text-emerald-400 transition-colors">
                                 {svc.name}
                              </a>
                           ) : (
                              <span className="text-slate-200 text-sm font-medium truncate">{svc.name}</span>
                           )}
                        </div>
                        {svc.description && (
                           <div className="text-slate-500 text-xs truncate pl-4">
                              {svc.description}
                           </div>
                        )}
                     </div>
                  </div>
               ))}
               {wsData.docker.services.length === 0 && <div className="text-slate-500 text-xs text-center py-4">No dashboard.show=true containers found.</div>}
             </div>
           )}
         </div>
       );
    }
    return <div className="text-slate-500 text-xs">Unknown Module {mod.module_type}</div>;
  };

  const hasStats = modules.some(m => m.module_type === 'system_stats');
  const hasDocker = modules.some(m => m.module_type === 'docker_services');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-6 shrink-0">
         <h1 className="text-xl font-medium tracking-tight text-slate-100 flex items-center gap-2">
           <LayoutGrid size={20} className="text-emerald-500" />
           Dashboard
         </h1>
         <span className="text-xs text-slate-500">{wsStatus}</span>
         <div className="flex gap-2">
           {!hasStats && (
              <button 
                onClick={() => addModule.mutate({ module_type: 'system_stats', width: 3, height: 2, pos_x: 0, pos_y: 0 })}
                className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors"
              >
                <PlusCircle size={14} /> System Stats
              </button>
           )}
           {!hasDocker && (
              <button 
                onClick={() => addModule.mutate({ module_type: 'docker_services', width: 4, height: 3, pos_x: 3, pos_y: 0 })}
                className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors"
              >
                <PlusCircle size={14} /> Docker Services
              </button>
           )}
         </div>
      </div>

      <div className="flex-1 overflow-auto -mx-4 px-4 pb-4 mt-2">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="relative">
            <div 
              className="grid gap-4"
              style={{ 
                gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                gridAutoRows: 'minmax(120px, auto)',
              }}
            >
               {Array.from({ length: 12 * 8 }).map((_, i) => (
                  <DroppableCell key={`cell-${i}`} x={i % 12} y={Math.floor(i / 12)} />
               ))}

               {modules.map(mod => (
                 <DraggableModule
                   key={mod.id}
                   id={mod.id}
                   x={mod.pos_x}
                   y={mod.pos_y}
                   width={mod.width}
                   height={mod.height}
                   onDelete={() => deleteModule.mutate(mod.id)}
                 >
                   {renderModuleContent(mod)}
                 </DraggableModule>
               ))}
            </div>
          </div>
        </DndContext>
      </div>
    </div>
  );
}
