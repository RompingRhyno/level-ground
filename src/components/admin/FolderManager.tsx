"use client";
import React, { useEffect, useState, useRef } from "react";
import AlertDialog from "../ui/AlertDialog";

const FolderAddIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7a2 2 0 0 1 2-2h3l2 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 14h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DotsVertical = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 6a1.5 1.5 0 1 0 0 0.001M12 12a1.5 1.5 0 1 0 0 0.001M12 18a1.5 1.5 0 1 0 0 0.001" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SaveIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 21v-8H7v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 3v6h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function FolderManager({ onSelect, onDrop, onChange }: { onSelect?: (slug: string | null) => void; onDrop?: (folderSlug: string, assetIds: string[]) => Promise<void>; onChange?: () => void }) {
  const [folders, setFolders] = useState<Array<any>>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const editRef = useRef<HTMLInputElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmDescription, setConfirmDescription] = useState('');
  const [confirmVariant, setConfirmVariant] = useState<'primary' | 'danger'>('danger');
  const [confirmLabel, setConfirmLabel] = useState<string|undefined>(undefined);

  function showConfirm(title: string, description?: string, variant: 'primary' | 'danger' = 'danger', confirmBtnLabel?: string) {
    setConfirmTitle(title);
    setConfirmDescription(description || '');
    setConfirmVariant(variant);
    setConfirmLabel(confirmBtnLabel);
    setConfirmOpen(true);
    return new Promise<boolean>((res) => { confirmResolveRef.current = res; });
  }

  function handleDialogClose(result: boolean) {
    setConfirmOpen(false);
    const r = confirmResolveRef.current;
    confirmResolveRef.current = null;
    if (r) r(result);
  }

  async function load() {
    try {
      const res = await fetch(`/api/folders`);
      if (!res.ok) {
        const txt = await res.text();
        console.error("Failed loading folders", res.status, txt);
        setFolders([]);
        return;
      }
      const data = await res.json().catch((e)=>{
        console.error('Invalid JSON from /api/folders', e);
        return [];
      });
      setFolders(data || []);
    } catch (err) {
      console.error('Error fetching /api/folders', err);
      setFolders([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function createFolder() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/folders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error("create failed");
      setName("");
      await load();
      onChange?.();
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }

  async function remove(id: number) {
    // verify folder is empty before deleting
    const f = folders.find((x) => x.id === id);
    const slug = f?.slug;
    if (!slug) { await showConfirm('Folder slug missing'); return; }
    try {
      const res = await fetch(`/api/assets?folder=${encodeURIComponent(slug)}`);
      if (!res.ok) {
        const txt = await res.text();
        console.error('Failed to check folder contents', txt);
      }
      const data = await res.json().catch(() => []);
      if (Array.isArray(data) && data.length > 0) {
        const go = await showConfirm('Folder not empty', 'Please delete or move files out of the folder before deleting it.', 'primary', 'Go to folder');
        if (go) onSelect?.(slug);
        return;
      }
      if (!(await showConfirm('Delete this folder?', undefined, 'danger', 'Delete'))) return;
      const del = await fetch(`/api/folders/${id}`, { method: 'DELETE' });
      if (!del.ok) throw new Error('delete failed');
      await load();
      onChange?.();
    } catch (err) {
      console.error(err);
      await showConfirm('Failed to delete folder');
    }
  }

  async function rename(id: number) {
    // switch to inline edit
    const f = folders.find((x) => x.id === id);
    if (!f) return;
    setEditingId(id);
    setEditingName(f.name || '');
    setMenuOpen(null);
  }

  // focus helper for inline rename
  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  async function saveRename(id: number) {
    const newName = editingName?.trim();
    if (!newName) return setEditingId(null);
    try {
      const res = await fetch(`/api/folders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) });
      if (!res.ok) throw new Error('rename failed');
      setEditingId(null);
      setEditingName('');
      await load();
      onChange?.();
    } catch (err) {
      console.error(err);
      await showConfirm('Rename failed');
    }
  }

  // drag-and-drop handlers for moving assets into folders
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(e: React.DragEvent, folderSlug: string) {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const { assetIds } = JSON.parse(raw);
      if (!Array.isArray(assetIds) || assetIds.length === 0) return;
      if (onDrop) await onDrop(folderSlug, assetIds);
      await load();
      onChange?.();
    } catch (err) {
      console.error("drop error", err);
    }
  }

  return (
    <div className="p-3 border rounded bg-white">
      <AlertDialog open={confirmOpen} title={confirmTitle} description={confirmDescription} confirmVariant={confirmVariant} confirmLabel={confirmLabel} onConfirm={() => handleDialogClose(true)} onCancel={() => handleDialogClose(false)} />
      <div className="flex items-center">
        <div className="text-lg font-semibold">Folders</div>
        <div className="ml-auto">
          <button title="Create folder" onClick={()=>setShowCreate(s=>!s)} className="p-1 rounded hover:bg-gray-200">
            {showCreate ? <CloseIcon size={20} /> : <FolderAddIcon size={22} />}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="mt-3 flex gap-2">
          <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="New folder" className="flex-1 border rounded px-2 py-1 text-sm" />
          <button onClick={createFolder} disabled={loading} className="px-3 py-1 rounded text-sm btn-positive">Create</button>
        </div>
      )}

      <div className="mt-3">
        <div className="text-sm text-gray-600 mb-2">&nbsp;</div>
        <div className="space-y-2">
          <button onClick={() => onSelect?.(null)} className="text-left w-full text-sm px-2 py-1 rounded hover:bg-gray-50">All files</button>
          {folders.map((f: any) => (
            <div key={f.id} className="relative flex items-center justify-between" onDragOver={handleDragOver} onDrop={(e)=>handleDrop(e, f.slug)}>
              <div className="flex-1">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect?.(f.slug)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect?.(f.slug); }}
                  className="text-left w-full text-sm px-2 py-1 rounded hover:bg-gray-50"
                >
                  {editingId === f.id ? (
                    <div className="flex items-center gap-2">
                      <input ref={editRef} value={editingName} onChange={(e)=>setEditingName(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter') saveRename(f.id); if (e.key==='Escape'){ setEditingId(null); setEditingName(''); } }} className="px-1 py-0.5 border rounded text-sm" />
                      <button onClick={(ev)=>{ ev.preventDefault(); ev.stopPropagation(); saveRename(f.id); }} className="text-gray-600 hover:text-gray-900"><SaveIcon /></button>
                      <button onClick={(ev)=>{ ev.preventDefault(); ev.stopPropagation(); setEditingId(null); setEditingName(''); }} className="text-gray-500 hover:text-gray-700"><CloseIcon /></button>
                    </div>
                  ) : (
                    f.name
                  )}
                </div>
              </div>

              <div className="ml-2">
                <button onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setMenuOpen(menuOpen===f.id ? null : f.id); }} className="p-1 rounded hover:bg-gray-200">
                  <DotsVertical />
                </button>
                {menuOpen===f.id && (
                  <div className="absolute right-0 top-8 bg-white border rounded shadow-md z-40">
                    <button className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => rename(f.id)}>Rename</button>
                    <button className="block w-full text-left px-3 py-2 text-sm btn-negative" onClick={() => remove(f.id)}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
