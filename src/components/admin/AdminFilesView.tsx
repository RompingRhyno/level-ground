"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";

const DotsVertical = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 6a1.5 1.5 0 1 0 0 0.001M12 12a1.5 1.5 0 1 0 0 0.001M12 18a1.5 1.5 0 1 0 0 0.001" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SaveIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 21v-8H7v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RenameIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 21v-3.75L14.81 5.44a2 2 0 0 1 2.83 0l1.92 1.92a2 2 0 0 1 0 2.83L7.75 21H3z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function AdminFilesView({ onMove, onRefreshFolders }: { onMove?: (ids: string[], folder: string) => Promise<void>; onRefreshFolders?: () => Promise<void> }) {
  const [assets, setAssets] = useState<any[]>([]);
  const [assetsBackup, setAssetsBackup] = useState<any[] | null>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [manageFolders, setManageFolders] = useState(false);
  const [manageTags, setManageTags] = useState(false);
  const [menuOpenFolder, setMenuOpenFolder] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const getSelectedIds = () => Object.keys(selected).filter((k) => selected[k]);

  const editInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (editingId && editInputRef.current) editInputRef.current.focus(); }, [editingId]);
  useEffect(() => { if (renamingFolderId && renameInputRef.current) renameInputRef.current.focus(); }, [renamingFolderId]);

  // click outside to cancel folder rename
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!renamingFolderId) return;
      const el = renameInputRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target as Node)) {
        setRenamingFolderId(null);
        setRenamingFolderName('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [renamingFolderId]);

  // click outside to close folder menu
  useEffect(() => {
    if (!menuOpenFolder) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return setMenuOpenFolder(null);
      const insideMenu = (target as Element).closest('[data-folder-menu]');
      const insideButton = (target as Element).closest('[data-folder-button]');
      if (insideMenu) return; // click inside menu
      if (insideButton) return; // click on the button that toggles menu
      setMenuOpenFolder(null);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpenFolder]);

  async function saveFolderRename(id: string) {
    const name = (renamingFolderName || '').trim();
    if (!name) return alert('Name required');
    try {
      const res = await fetch(`/api/folders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error('Rename failed');
      setRenamingFolderId(null);
      setRenamingFolderName('');
      if (onRefreshFolders) await onRefreshFolders();
      await load();
    } catch (err) {
      alert('Rename failed');
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const nxt = { ...s } as Record<string, boolean>;
      nxt[id] = !nxt[id];
      return nxt;
    });
  }

  async function load() {
    setLoading(true);
    try {
      const q = folder ? `?folder=${encodeURIComponent(folder)}` : '';
      const res = await fetch(`/api/assets${q}`);
      const data = await res.json().catch(() => []);
      setAssets(data || []);
      setAssetsBackup(data || []);
      const fRes = await fetch('/api/folders');
      const fData = await fRes.json().catch(() => []);
      setFolders(fData || []);
      const ts = new Set<string>();
      (data || []).forEach((a: any) => (a.tags || []).forEach((t: string) => ts.add(t)));
      setTags(Array.from(ts));
    } catch (err) {
      console.error('load failed', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [folder]);

  const selectedCount = getSelectedIds().length;

  async function bulkDelete() {
    const ids = getSelectedIds();
    if (!ids.length) return alert('No files selected');
    if (!confirm(`Delete ${ids.length} files?`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/assets/${id}`, { method: 'DELETE' })));
    setSelected({});
    await load();
    if (onRefreshFolders) await onRefreshFolders();
  }

  async function bulkMove(targetFolder: string) {
    const ids = getSelectedIds();
    if (!ids.length) return;
    if (onMove) await onMove(ids, targetFolder);
    else await Promise.all(ids.map((id) => fetch(`/api/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: targetFolder }) })));
    setSelected({});
    await load();
    if (onRefreshFolders) await onRefreshFolders();
  }

  async function applyTagToSelected(tag: string) {
    const ids = getSelectedIds();
    if (!ids.length) return alert('No files selected');
    try {
      await Promise.all(ids.map((id)=>{
        const asset = assets.find((x)=>x.id===id) || (assetsBackup || []).find((x)=>x.id===id);
        const current = Array.isArray(asset?.tags) ? asset.tags : [];
        const updated = Array.from(new Set([...current, tag]));
        return fetch(`/api/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ tags: updated }) });
      }));
      setSelected({});
      await load();
    } catch (err) {
      console.error('applyTag error', err);
      alert('Failed to apply tag');
    }
  }

  async function removeTagGlobally(tag: string) {
    if (!confirm(`Remove tag '${tag}' from all assets?`)) return;
    try {
      const res = await fetch(`/api/assets`);
      const all = await res.json().catch(()=>[]);
      const targets = (all || []).filter((a:any)=>Array.isArray(a.tags) && a.tags.includes(tag));
      await Promise.all(targets.map((a:any)=>{
        const updated = (a.tags || []).filter((t:string)=>t!==tag);
        return fetch(`/api/assets/${a.id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ tags: updated }) });
      }));
      await load();
    } catch (err) {
      console.error('removeTagGlobally', err);
      alert('Failed to remove tag');
    }
  }

  async function createTag(name: string) {
    const tag = (name || '').trim();
    if (!tag) return;
    // if there are selected assets, apply tag to them; otherwise just refresh tags after creation (no persistent tag storage)
    const ids = getSelectedIds();
    if (ids.length) await applyTagToSelected(tag);
    else {
      // add locally so UI shows it until reload
      setTags((t)=>Array.from(new Set([...t, tag])));
    }
    setNewTagName('');
    setShowCreateTag(false);
  }

  function filenameParts(a: any) {
    const raw = a.filename || a.storageKey || '';
    const idx = raw.lastIndexOf('.');
    if (idx === -1) return { base: raw, ext: '' };
    return { base: raw.slice(0, idx), ext: raw.slice(idx) };
  }

  async function saveRename(id: string) {
    if (!editingId) return;
    const asset = assets.find((x) => x.id === id);
    if (!asset) return alert('Asset not found');
    const { ext } = filenameParts(asset);
    const newFilename = `${editingName}${ext}`;
    try {
      const res = await fetch(`/api/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: newFilename }) });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.statusText);
      }
      setEditingId(null);
      setEditingName('');
      await load();
    } catch (err: any) {
      console.error('Rename failed', err);
      alert('Rename failed: ' + (err?.message || String(err)));
    }
  }

  const [openImage, setOpenImage] = useState<any | null>(null);

  const close = useCallback(() => setOpenImage(null), []);

  const handleOverlayClick = useCallback(() => {
    close();
  }, [close]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div>
      <div className="mb-3">
        {getSelectedIds().length ? (
          <div className="mb-2 text-sm text-gray-700">Selected {getSelectedIds().length} — click any tag to tag the selection</div>
        ) : null}

        <div className="flex items-center gap-2">
  
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-sm font-semibold mb-1">Folders</div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 flex flex-wrap gap-2">
                  <button onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setFolder(null); setActiveTag(null); setAssets(assetsBackup || []); }} className={`px-2 py-1 rounded text-sm ${folder===null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>All</button>
                  {folders.map((f:any)=> (
                    <div key={f.id} data-folder-button={f.id} className="inline-flex items-center">
                      <button
                        onClick={async (e)=>{
                          e.preventDefault();
                          e.stopPropagation();
                          const ids = getSelectedIds();
                          if (ids.length) {
                            // move selected
                            if (onMove) await onMove(ids, f.slug);
                            else await Promise.all(ids.map((id)=>fetch(`/api/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ folder: f.slug }) })));
                            setSelected({});
                            await load();
                            if (onRefreshFolders) await onRefreshFolders();
                            return;
                          }
                          // toggle folder filter
                          if (folder === f.slug) {
                            setFolder(null);
                            setAssets(assetsBackup || []);
                          } else {
                            setFolder(f.slug);
                            setActiveTag(null);
                          }
                        }}
                        className={`relative inline-flex items-center px-2 py-1 rounded text-sm ${folder===f.slug ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
                      >
                        {renamingFolderId === f.id ? (
                          <input ref={renameInputRef} value={renamingFolderName} onChange={(e)=>setRenamingFolderName(e.target.value)} className="px-2 py-1 text-sm border rounded" />
                        ) : (
                          <span className="pr-2">{f.name}</span>
                        )}

                        {manageFolders && (
                          <span onClick={(ev)=>{ ev.stopPropagation(); ev.preventDefault(); if (renamingFolderId === f.id) { saveFolderRename(f.id); } else { setMenuOpenFolder(menuOpenFolder===f.id ? null : f.id); } }} className="ml-1 text-gray-700">
                            {renamingFolderId === f.id ? <SaveIcon size={16} /> : <DotsVertical />}
                          </span>
                        )}
                      </button>
                      {menuOpenFolder===f.id && !renamingFolderId && (
                        <div data-folder-menu={f.id} className="absolute bg-white border rounded shadow-md z-40">
                          <button className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={async ()=>{ setMenuOpenFolder(null); setRenamingFolderId(f.id); setRenamingFolderName(f.name || ''); }}>Rename</button>
                          <button className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50" onClick={async ()=>{ const res = await fetch(`/api/assets?folder=${encodeURIComponent(f.slug)}`); const data = await res.json().catch(()=>[]); if (Array.isArray(data) && data.length>0) return alert('Folder not empty. Remove files first.'); if (!confirm('Delete this folder?')) return; await fetch(`/api/folders/${f.id}`, { method: 'DELETE' }); setMenuOpenFolder(null); if (onRefreshFolders) await onRefreshFolders(); await load(); }}>Delete</button>
                        </div>
                      )}
                    </div>
                ))}
                </div>

                <div className="flex items-center gap-2">
                  {showCreateFolder ? (
                    <div className="flex items-center gap-2">
                      <input value={newFolderName} onChange={(e)=>setNewFolderName(e.target.value)} placeholder="New folder" className="px-2 py-1 border rounded text-sm" />
                      <button onClick={async ()=>{ const name = newFolderName.trim(); if (!name) return; const res = await fetch('/api/folders', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name }) }); if (!res.ok) return alert('Create failed'); setNewFolderName(''); setShowCreateFolder(false); if (onRefreshFolders) await onRefreshFolders(); await load(); }} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">Create</button>
                      <button onClick={()=>{ setShowCreateFolder(false); setNewFolderName(''); }} className="px-2 py-1 rounded bg-gray-100">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button title="Create folder" onClick={()=>setShowCreateFolder(true)} className="px-2 py-1 rounded bg-gray-100 text-sm">Create folder</button>
                      <button title="Manage folders" onClick={()=>setManageFolders(m=>!m)} className={`px-2 py-1 rounded text-sm ${manageFolders ? 'bg-red-50 text-red-600' : 'bg-gray-100'}`}>{manageFolders ? 'Done' : 'Manage'}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold mb-1">Tags</div>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-2">
                  {tags.map((t)=> (
                    <div key={t} className="inline-flex items-center">
                      <button
                        onClick={async (e)=>{
                          e.preventDefault();
                          e.stopPropagation();
                          if (getSelectedIds().length) {
                            await applyTagToSelected(t);
                            return;
                          }
                          // toggle active tag filter client-side
                          if (activeTag === t) {
                            setActiveTag(null);
                            setAssets(assetsBackup || []);
                          } else {
                            setActiveTag(t);
                            setAssets((assetsBackup || []).filter((a:any)=>Array.isArray(a.tags) && a.tags.includes(t)));
                          }
                        }}
                        className={`relative inline-flex items-center px-2 py-1 rounded text-sm ${activeTag===t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
                      >
                        <span className="pr-2">{t}</span>
                        {manageTags && (
                          <span onClick={(ev)=>{ ev.stopPropagation(); ev.preventDefault(); removeTagGlobally(t); }} className="ml-1 text-red-600 text-sm">✕</span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {activeTag && (
                    <button onClick={()=>{ setActiveTag(null); setAssets(assetsBackup || []); }} className="px-2 py-1 rounded bg-gray-100 text-sm">Clear filters</button>
                  )}

                  {showCreateTag ? (
                    <div className="flex items-center gap-2">
                      <input value={newTagName} onChange={(e)=>setNewTagName(e.target.value)} placeholder="New tag" className="px-2 py-1 border rounded text-sm" />
                      <button onClick={()=>createTag(newTagName)} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">Create</button>
                      <button onClick={()=>{ setShowCreateTag(false); setNewTagName(''); }} className="px-2 py-1 rounded bg-gray-100">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button title="Create tag" onClick={()=>setShowCreateTag(true)} className="px-2 py-1 rounded bg-gray-100 text-sm">Create tag</button>
                      <button title="Manage tags" onClick={()=>setManageTags(m=>!m)} className={`px-2 py-1 rounded text-sm ${manageTags ? 'bg-red-50 text-red-600' : 'bg-gray-100'}`}>{manageTags ? 'Done' : 'Manage'}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? <div>Loading...</div> : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <button onClick={bulkDelete} className={`px-2 py-1 text-sm rounded ${selectedCount ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}>Delete selected</button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {assets.map((a: any) => (
              <div key={a.id} draggable onDragStart={(e)=>{
                  const ids = getSelectedIds();
                  const dragging = ids.length ? ids : [a.id];
                  e.dataTransfer.setData('application/json', JSON.stringify({ assetIds: dragging }));
                }} className="border rounded p-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!selected[a.id]} onChange={()=>toggleSelect(a.id)} />
                    <div className="text-sm font-medium flex items-center gap-2">
                      {editingId === a.id ? (
                        <input
                          ref={editInputRef}
                          className="px-1 py-0.5 border rounded text-sm"
                          value={editingName}
                          onChange={(e)=>setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(a.id);
                            if (e.key === 'Escape') { setEditingId(null); setEditingName(''); }
                          }}
                        />
                      ) : (
                        <span>
                          {filenameParts(a).base || a.filename || a.storageKey}
                        </span>
                      )}
                      {/* rename / save button */}
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          title={editingId === a.id ? 'Save' : 'Rename'}
                          onClick={(e)=>{
                            e.preventDefault();
                            e.stopPropagation();
                            if (editingId === a.id) saveRename(a.id);
                            else {
                              const parts = filenameParts(a);
                              setEditingName(parts.base);
                              setEditingId(a.id);
                            }
                          }}
                          className="text-gray-600 hover:text-gray-900"
                          aria-label={editingId === a.id ? 'Save' : 'Rename'}
                        >
                          {editingId === a.id ? <SaveIcon size={18} /> : <RenameIcon size={18} />}
                        </button>
                        {editingId === a.id && (
                          <button onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setEditingId(null); setEditingName(''); }} className="text-gray-500 hover:text-gray-700" title="Cancel">
                            <CloseIcon />
                          </button>
                        )}
                      </div>
                    </div>
                  </label>
                  <div className="text-xs text-gray-500">{a.mime}</div>
                </div>
                <div className="mt-2">
                  {a.publicUrl ? (
                    <button aria-label={a.filename || 'Open image'} onClick={() => setOpenImage(a)} className="w-full block focus:outline-none">
                      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }} className="overflow-hidden rounded">
                        <Image src={a.publicUrl} alt={a.alt || ''} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 33vw" />
                      </div>
                    </button>
                  ) : (
                    <div className="h-0" style={{ paddingTop: '56.25%' }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {openImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleOverlayClick} role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" />
          <button onClick={close} aria-label="Close" className="absolute right-4 top-4 z-30 bg-white/90 rounded-full w-10 h-10 flex items-center justify-center text-gray-700 shadow">✕</button>
          <div className="relative max-w-[calc(100vw-48px)] max-h-[calc(100vh-48px)] p-4 z-20" onClick={(e)=>e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', maxHeight: '100%' }}>
              <img
                src={openImage.publicUrl}
                alt={openImage.alt || ''}
                style={{ width: 'auto', maxWidth: '100%', height: 'auto', maxHeight: 'calc(100vh - 80px)', objectFit: 'contain', display: 'block' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
