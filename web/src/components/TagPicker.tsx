import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag as TagIcon, X, Check, PlusCircle } from 'lucide-react';
import { api } from '../lib/api';

export interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagPickerProps {
  itemId: string;
  appliedTags: Tag[];
  onAddTag: (tagId: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
}

export function TagPicker({ itemId, appliedTags, onAddTag, onRemoveTag }: TagPickerProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: tagsData = [] } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      return (await api.get('/api/tags')) as unknown as Tag[];
    }
  });

  const createTag = useMutation({
    mutationFn: async (name: string) => {
      return api.post('/api/tags', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setNewTagName('');
    }
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="flex items-center gap-1.5 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-md transition-colors"
      >
        <TagIcon size={14} /> Tags
      </button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-md shadow-2xl z-50 p-3 flex flex-col cursor-default" onClick={e => e.stopPropagation()}>
          <div className="text-[10px] text-slate-500 mb-2 font-bold tracking-wider uppercase">Applied Tags</div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {appliedTags?.map(t => (
              <span key={t.id} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm border border-slate-700/50" style={{ backgroundColor: `${t.color}15`, color: t.color }}>
                {t.name} 
                <X size={10} className="cursor-pointer hover:opacity-50" onClick={() => onRemoveTag(t.id)} />
              </span>
            ))}
            {(!appliedTags || appliedTags.length === 0) && <span className="text-[10px] text-slate-600 italic">No tags applied</span>}
          </div>
          
          <div className="text-[10px] text-slate-500 mb-2 font-bold tracking-wider uppercase">Available Tags</div>
          <div className="max-h-32 overflow-y-auto mb-3 space-y-0.5 bg-slate-950/30 rounded border border-slate-800/50 p-1">
            {tagsData?.length === 0 && <div className="text-[10px] text-slate-600 italic p-1">No tags exist yet</div>}
            {tagsData?.map(t => {
              const hasTag = appliedTags?.find(nt => nt.id === t.id);
              return (
                <button 
                  key={t.id} 
                  onClick={() => !hasTag && onAddTag(t.id)}
                  disabled={!!hasTag}
                  className={`w-full text-left text-[11px] p-1.5 rounded flex items-center justify-between transition-colors ${hasTag ? 'opacity-50 cursor-default' : 'hover:bg-slate-800 cursor-pointer'}`}
                >
                  <span className="font-medium" style={{ color: t.color }}>{t.name}</span>
                  {hasTag && <Check size={12} className="text-emerald-500" />}
                </button>
              );
            })}
          </div>
          
          <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
            <input 
              type="text" 
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              placeholder="Create new tag..."
              className="flex-1 bg-slate-950/50 border border-slate-700 rounded text-xs px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-200 placeholder:text-slate-600"
              onKeyDown={e => {
                if (e.key === 'Enter' && newTagName.trim()) {
                  e.preventDefault();
                  createTag.mutate(newTagName.trim());
                }
              }}
            />
            <button 
              onClick={() => newTagName.trim() && createTag.mutate(newTagName.trim())} 
              disabled={!newTagName.trim() || createTag.isPending}
              className="text-slate-400 hover:text-indigo-400 disabled:opacity-50 disabled:hover:text-slate-400 transition-colors p-1"
            >
              <PlusCircle size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
