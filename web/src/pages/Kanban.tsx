import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { 
  Kanban as KanbanIcon, Plus, MoreVertical, Calendar, 
  Trash2, X, Check, Edit2, Pin, PinOff 
} from 'lucide-react';
import {
  DndContext, DragOverlay, closestCorners,
  KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function SortableItem({ id, item, onDelete, onTogglePin, onEdit }: { id: string, item: any, onDelete: any, onTogglePin: any, onEdit: any }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id, data: { type: 'Item', item } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const priorityColors: Record<string, string> = {
      low: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      high: 'text-rose-400 bg-rose-400/10 border-rose-400/20'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-slate-800 rounded-lg p-3 border border-slate-700/80 shadow-md ${isDragging ? 'ring-2 ring-indigo-500' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex justify-between items-start gap-2 mb-2">
         <h4 className="font-medium text-slate-200 text-sm leading-tight flex-1">{item.title}</h4>
         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
             <button onPointerDown={(e) => { e.stopPropagation(); onTogglePin(item.id, !item.show_on_dashboard); }} className={`p-1 rounded ${item.show_on_dashboard ? 'text-indigo-400 bg-indigo-400/10' : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700'}`}>
                 <Pin size={12} />
             </button>
             <button onPointerDown={(e) => { e.stopPropagation(); onEdit(item); }} className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-slate-700">
                 <Edit2 size={12} />
             </button>
             <button onPointerDown={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700">
                 <Trash2 size={12} />
             </button>
         </div>
      </div>
      
      {item.description && (
          <div className="text-xs text-slate-400 line-clamp-2 mb-3 markdown-body-micro">
              <Markdown remarkPlugins={[remarkGfm]}>{item.description}</Markdown>
          </div>
      )}
      
      <div className="flex flex-wrap items-center gap-2 mt-auto">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityColors[item.priority] || priorityColors.medium}`}>
              {item.priority}
          </span>
          {item.due_date && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-700/50 text-slate-300 flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(item.due_date).toLocaleDateString()}
              </span>
          )}
          {item.tags && item.tags.map((t: any) => (
              <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-300">
                  {t.name}
              </span>
          ))}
      </div>
    </div>
  );
}

function KanbanColumn({ column, items, onTogglePinItem, onDeleteItem, onEditItem }: any) {
  const itemIds = useMemo(() => items.map((i: any) => i.id), [items]);

  const { setNodeRef } = useSortable({
      id: column.id,
      data: { type: 'Column', column }
  });

  return (
    <div 
        className="flex flex-col bg-slate-900/50 rounded-xl border border-slate-800 w-80 shrink-0" 
        ref={setNodeRef}
    >
      <div className="p-4 flex items-center justify-between border-b border-slate-800/80">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            {column.name}
            <span className="bg-slate-800 text-slate-400 text-xs py-0.5 px-2 rounded-full font-medium">{items.length}</span>
        </h3>
      </div>

      <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-3 min-h-[150px]">
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {items.map((item: any) => (
            <SortableItem 
                key={item.id} 
                id={item.id} 
                item={item} 
                onDelete={onDeleteItem}
                onTogglePin={onTogglePinItem}
                onEdit={onEditItem}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function Kanban() {
  const queryClient = useQueryClient();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [newItemColId, setNewItemColId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newColName, setNewColName] = useState('');
  
  const [activeItem, setActiveItem] = useState<any>(null);

  const { data = { columns: [], items: [] }, isLoading } = useQuery({
    queryKey: ['kanbanBoard'],
    queryFn: async () => {
      const res = await api.get('/api/kanban/board');
      return res.json();
    }
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await api.get('/api/tags');
      return res.json();
    }
  });

  const moveItem = useMutation({
      mutationFn: async ({ itemId, status }: { itemId: string, status: string }) => {
          await api.put(`/api/kanban/items/${itemId}`, { status });
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kanbanBoard'] })
  });
  
  const deleteItem = useMutation({
      mutationFn: async (id: string) => await api.delete(`/api/kanban/items/${id}`),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['kanbanBoard'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard_modules'] });
      }
  });

  const togglePin = useMutation({
      mutationFn: async ({ id, show }: { id: string, show: boolean }) => {
          await api.put(`/api/kanban/items/${id}`, { show_on_dashboard: show });
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['kanbanBoard'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard_modules'] });
      }
  });

  // DND Handlers
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (e: any) => {
      if (e.active.data.current?.type === 'Item') {
          setActiveItem(e.active.data.current.item);
      }
  };

  const handleDragEnd = (e: any) => {
      setActiveItem(null);
      const { active, over } = e;
      if (!over) return;

      const activeType = active.data.current?.type;
      const overType = over.data.current?.type;

      if (activeType === 'Item' && overType === 'Column') {
          if (active.data.current.item.status !== over.id) {
              moveItem.mutate({ itemId: active.id, status: String(over.id) });
          }
      }
      
      if (activeType === 'Item' && overType === 'Item') {
          const targetStatus = over.data.current.item.status;
          if (active.data.current.item.status !== targetStatus) {
              moveItem.mutate({ itemId: active.id, status: targetStatus });
          }
      }
  };

    const filteredItems = useMemo(() => {
        const itemsList = data?.items || [];
        if (!selectedTag) return itemsList;
        return itemsList.filter((i: any) => i.tags?.some((t: any) => t.name === selectedTag));
    }, [data?.items, selectedTag]);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
        <div className="p-6 pb-2 shrink-0">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold flex items-center gap-3">
                <KanbanIcon size={24} className="text-indigo-400" />
                Kanban
                </h1>
                
                <div className="flex gap-2">
                    <select 
                        value={selectedTag || ''} 
                        onChange={e => setSelectedTag(e.target.value || null)}
                        className="bg-slate-800 border border-slate-700 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                    >
                        <option value="">All Tags</option>
                        {(Array.isArray(tags) ? tags : []).map((t: any) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
        
        <div className="flex-1 overflow-x-auto p-6 pt-4 h-full relative">
            <div className="flex gap-6 h-full items-start">
                <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    {(data?.columns || []).map((col: any) => (
                        <div key={col.id} className="h-full flex flex-col">
                            <KanbanColumn 
                                column={col} 
                                items={filteredItems.filter((i: any) => i.status === col.id)}
                                onTogglePinItem={(id: string, show: boolean) => togglePin.mutate({ id, show })}
                                onDeleteItem={(id: string) => deleteItem.mutate(id)}
                                onEditItem={(item: any) => setEditingItem(item)}
                            />
                            <button 
                                onClick={() => setNewItemColId(col.id)}
                                className="mt-3 flex justify-center items-center gap-2 py-2 w-full text-sm text-slate-500 font-medium hover:bg-slate-800/50 hover:text-indigo-400 rounded-lg transition-colors border border-transparent hover:border-slate-700/50"
                            >
                                <Plus size={16} /> New Item
                            </button>
                        </div>
                    ))}
                    
                    <DragOverlay>
                        {activeItem ? (
                            <SortableItem 
                                id={activeItem.id} 
                                item={activeItem} 
                                onDelete={()=>{}} 
                                onTogglePin={()=>{}}
                                onEdit={()=>{}}
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
        
        {/* We would render an edit / create modal here */}
        {(newItemColId || editingItem) && (
           <ItemModal 
               status={newItemColId} 
               item={editingItem}
               onClose={() => { setNewItemColId(null); setEditingItem(null); }} 
               columns={data.columns} 
               tags={tags}
           />
        )}
    </div>
  );
}

function ItemModal({ status, item, onClose, columns, tags }: any) {
    const queryClient = useQueryClient();
    const [title, setTitle] = useState(item?.title || '');
    const [desc, setDesc] = useState(item?.description || '');
    const [priority, setPriority] = useState(item?.priority || 'medium');
    const [dueDate, setDueDate] = useState(item?.due_date ? new Date(item.due_date).toISOString().split('T')[0] : '');
    const [currentStatus, setCurrentStatus] = useState(status || item?.status || 'To Do');
    
    const save = useMutation({
        mutationFn: async () => {
            const payload = {
                title, description: desc, priority, 
                due_date: dueDate ? new Date(dueDate).toISOString() : null,
                status: currentStatus
            };
            if (item) {
                await api.put(`/api/kanban/items/${item.id}`, payload);
            } else {
                await api.post(`/api/kanban/items`, payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kanbanBoard'] });
            onClose();
        }
    });
    
    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex flex-col items-center justify-center p-4">
           <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                  <h3 className="font-semibold text-slate-200">{item ? 'Edit Item' : 'New Kanban Item'}</h3>
                  <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={20}/></button>
              </div>
              <div className="p-5 flex flex-col gap-4 overflow-y-auto">
                  
                  <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
                      <input 
                         autoFocus
                         className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 outline-none focus:border-indigo-500" 
                         value={title} onChange={e => setTitle(e.target.value)} 
                         placeholder="What needs to be done?" 
                      />
                  </div>
                  
                  <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Description (Markdown)</label>
                      <textarea 
                         className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 outline-none focus:border-indigo-500 min-h-[100px]" 
                         value={desc} onChange={e => setDesc(e.target.value)} 
                         placeholder="Additional details..." 
                      />
                  </div>
                  
                  <div className="flex gap-4">
                      <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
                          <select 
                             className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                             value={priority} onChange={e => setPriority(e.target.value)}
                          >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                          </select>
                      </div>
                      
                      <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                          <select 
                             className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                             value={currentStatus} onChange={e => setCurrentStatus(e.target.value)}
                          >
                              {columns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                      </div>
                  </div>
                  
                  <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Due Date (Optional)</label>
                      <input 
                         type="date"
                         className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 outline-none focus:border-indigo-500" 
                         value={dueDate} onChange={e => setDueDate(e.target.value)} 
                      />
                  </div>
                  
                  {item && (
                      <div>
                          <label className="block text-xs font-medium text-slate-400 mb-2">Tags</label>
                          <div className="flex flex-wrap gap-1 mb-2">
                             {item.tags?.map((t: any) => (
                               <span key={t.id} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-300">
                                 {t.name}
                                 <X size={10} className="cursor-pointer hover:text-rose-400" onClick={async () => {
                                     await api.delete(`/api/kanban/items/${item.id}/tags/${t.id}`);
                                     queryClient.invalidateQueries({ queryKey: ['kanbanBoard'] });
                                     // Quick local state update would be better but refetch works
                                 }}/>
                               </span>
                             ))}
                             {(!item.tags || item.tags.length === 0) && <span className="text-xs text-slate-600">No tags applied.</span>}
                          </div>
                          <select 
                             className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
                             value=""
                             onChange={async (e) => {
                                 if (e.target.value) {
                                     await api.post(`/api/kanban/items/${item.id}/tags/${e.target.value}`);
                                     queryClient.invalidateQueries({ queryKey: ['kanbanBoard'] });
                                     // Ideally update local state, but closing/reopening or refetching works
                                 }
                             }}
                          >
                             <option value="" disabled>Add a tag...</option>
                             {tags.filter((t: any) => !item.tags?.find((it: any) => it.id === t.id)).map((t: any) => (
                                 <option key={t.id} value={t.id}>{t.name}</option>
                             ))}
                          </select>
                      </div>
                  )}
                  
              </div>
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 shrink-0">
                  <button onClick={onClose} className="px-4 py-2 rounded font-medium text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
                  <button 
                     onClick={() => save.mutate()}
                     disabled={!title || save.isPending} 
                     className="px-4 py-2 rounded font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                      Save Item
                  </button>
              </div>
           </div>
        </div>
    )
}
