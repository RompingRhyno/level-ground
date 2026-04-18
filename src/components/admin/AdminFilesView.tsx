"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import AlertDialog from "../ui/AlertDialog";

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

export default function AdminFilesView({
  initialFolder,
  folders: initialFolders,
  onMove,
  onDelete,
  onRefreshFolders,
}: {
  initialFolder?: string | null;
  folders?: any[];
  onMove?: (ids: string[], folder: string) => Promise<void>;
  onDelete?: (ids: string[]) => Promise<void>;
  onRefreshFolders?: () => Promise<void>;
}) {
  const [assets, setAssets] = useState<any[]>([]);
  const [assetsBackup, setAssetsBackup] = useState<any[] | null>(null);
  const [folders, setFolders] = useState<any[]>(initialFolders || []);
  const [tags, setTags] = useState<string[]>([]);
  const [manageFolders, setManageFolders] = useState(false);
  const [manageTags, setManageTags] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [folder, setFolder] = useState<string | null>(initialFolder ?? null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const SELECTED_KEY = 'level-ground.admin.selected.v1';
  const [loading, setLoading] = useState(false);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [hoverNewCount, setHoverNewCount] = useState<number | null>(null);
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmDescription, setConfirmDescription] = useState('');
  const [confirmVariant, setConfirmVariant] = useState<'primary' | 'danger'>('primary');
  const [confirmLabel, setConfirmLabel] = useState<string|undefined>(undefined);

  function showConfirm(title: string, description?: string, variant: 'primary' | 'danger' = 'primary', confirmBtnLabel?: string) {
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

  const getSelectedIds = () => Object.keys(selected).filter((k) => selected[k]);

  // persist selection whenever it changes
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') sessionStorage.setItem(SELECTED_KEY, JSON.stringify(selected));
    } catch (e) {
      // ignore
    }
  }, [selected]);

  // compute how many of the selected assets are missing a given tag
  function computeMissingForTag(tag: string) {
    const ids = getSelectedIds();
    if (!ids.length) return 0;
    let missing = 0;
    ids.forEach((id) => {
      const asset = (assets || []).find((a) => a.id === id) || (assetsBackup || []).find((a) => a.id === id);
      if (!asset) return;
      const has = Array.isArray(asset.tags) && asset.tags.includes(tag);
      if (!has) missing += 1;
    });
    return missing;
  }

  const editInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (editingId && editInputRef.current) editInputRef.current.focus(); }, [editingId]);

  const folderSectionRef = useRef<HTMLDivElement | null>(null);
  const tagSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const node = e.target as Node | null;
      if (manageFolders && folderSectionRef.current && node && !folderSectionRef.current.contains(node)) {
        setManageFolders(false);
      }
      if (manageTags && tagSectionRef.current && node && !tagSectionRef.current.contains(node)) {
        setManageTags(false);
      }
      if (editingId) {
        try {
          const selector = `[data-asset-id="${editingId}"]`;
          const assetEl = document.querySelector(selector);
          if (assetEl && node && !assetEl.contains(node)) {
            setEditingId(null);
            setEditingName('');
          }
        } catch (err) {
          // ignore query errors
        }
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [manageFolders, manageTags, editingId]);

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
      // restore persisted selection (only keep ids present in the freshly loaded assets)
      try {
        const raw = typeof window !== 'undefined' ? sessionStorage.getItem(SELECTED_KEY) : null;
        const persisted: Record<string, boolean> = raw ? JSON.parse(raw) : {};
        if (persisted && Object.keys(persisted).length) {
          const ids = new Set((data || []).map((a: any) => a.id));
          const restored: Record<string, boolean> = {};
          Object.keys(persisted).forEach((k) => { if (ids.has(k) && persisted[k]) restored[k] = true; });
          setSelected((s) => ({ ...s, ...restored }));
        }
      } catch (err) {
        // ignore sessionStorage errors
      }
      const fRes = await fetch('/api/folders');
      const fData = await fRes.json().catch(() => []);
      setFolders(fData || []);
      // derive tags from all assets (global) so tag list shows every existing tag
      try {
        const allRes = await fetch('/api/assets');
        const allData = await allRes.json().catch(() => []);
        const ts = new Set<string>();
        (allData || []).forEach((a: any) => (a.tags || []).forEach((t: string) => ts.add(t)));
        setTags(Array.from(ts));
      } catch (err) {
        const ts = new Set<string>();
        (data || []).forEach((a: any) => (a.tags || []).forEach((t: string) => ts.add(t)));
        setTags(Array.from(ts));
      }
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
    if (!ids.length) { await showConfirm('No files selected'); return; }
    if (!(await showConfirm(`Delete ${ids.length} files?`, "This action cannot be undone. This will permanently delete these files from the servers.", 'danger', 'Delete'))) return;
    if (onDelete) {
      await onDelete(ids);
    } else {
      await Promise.all(ids.map((id) => fetch(`/api/assets/${id}`, { method: 'DELETE' })));
    }
    setSelected({});
    await load();
    if (onRefreshFolders) await onRefreshFolders();
  }

  function selectAll() {
    const all = (assets || []).reduce((acc: Record<string, boolean>, a: any) => {
      acc[a.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setSelected(all);
    try { if (typeof window !== 'undefined') sessionStorage.setItem(SELECTED_KEY, JSON.stringify(all)); } catch (e) {}
  }

  function clearSelection() {
    setSelected({});
    try { if (typeof window !== 'undefined') sessionStorage.removeItem(SELECTED_KEY); } catch (e) {}
  }

  async function bulkMove(targetFolder: string) {
    const ids = getSelectedIds();
    if (!ids.length) return;
      if (!(await showConfirm(
        `Move ${ids.length} file(s) to folder '${targetFolder}'?`,
        "Click 'Clear selection' before clicking a folder if you meant to navigate to this folder instead.",
        'primary'
      ))) return;
    if (onMove) await onMove(ids, targetFolder);
    else await Promise.all(ids.map((id) => fetch(`/api/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: targetFolder }) })));
    // clear selection for folder move and navigate into destination
    setSelected({});
    try { if (typeof window !== 'undefined') sessionStorage.removeItem(SELECTED_KEY); } catch (e) {}
    setFolder(targetFolder);
    setActiveTags([]);
    await load();
    if (onRefreshFolders) await onRefreshFolders();
  }

  async function applyTagToSelected(tag: string) {
    const ids = getSelectedIds();
    if (!ids.length) { await showConfirm('No files selected'); return; }
      if (!(await showConfirm(
        `Add tag '${tag}' to ${ids.length} selected file(s)?`,
        "Click 'Clear selection' before selecting a tag if you meant to filter by this tag instead",
        'primary'
      ))) return;
    try {
      await Promise.all(ids.map((id)=>{
        const asset = assets.find((x)=>x.id===id) || (assetsBackup || []).find((x)=>x.id===id);
        const current = Array.isArray(asset?.tags) ? asset.tags : [];
        const updated = Array.from(new Set([...current, tag]));
        return fetch(`/api/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ tags: updated }) });
      }));
      // keep selection after tagging so users can continue multi-step actions
      await load();
    } catch (err) {
      console.error('applyTag error', err);
      await showConfirm('Failed to apply tag');
    }
  }

  async function removeTagGlobally(tag: string) {
    if (!(await showConfirm(`Remove tag '${tag}' from all assets?`, undefined, 'danger', 'Delete'))) return;
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
      await showConfirm('Failed to remove tag');
    }
  }

  async function removeTagFromAsset(assetId: string, tag: string) {
    try {
      const asset = assets.find((x) => x.id === assetId) || (assetsBackup || []).find((x) => x.id === assetId);
      if (!asset) return;
      const updated = (asset.tags || []).filter((t: string) => t !== tag);
      const res = await fetch(`/api/assets/${assetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: updated }) });
      if (!res.ok) throw new Error('Failed');
      await load();
    } catch (err) {
      console.error('removeTagFromAsset', err);
      await showConfirm('Failed to remove tag');
    }
  }

  async function createTag(name: string) {
    const tag = (name || '').trim();
    if (!tag) return;
    const ids = getSelectedIds();
    if (ids.length) await applyTagToSelected(tag);
    else {
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
    if (!asset) { await showConfirm('Asset not found'); return; }
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
      await showConfirm('Rename failed', err?.message || String(err));
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
        <AlertDialog open={confirmOpen} title={confirmTitle} description={confirmDescription} confirmVariant={confirmVariant} confirmLabel={confirmLabel} onConfirm={() => handleDialogClose(true)} onCancel={() => handleDialogClose(false)} />
        <div className="flex items-center gap-2 w-full">
          <div className="flex flex-col gap-3 w-full">
            {/* Folders — inherit page primary (no explicit background) */}
            <div ref={folderSectionRef} style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', paddingBottom: '1rem' }}>
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between w-full">
                  <div className="text-lg font-medium pb-4">Folders</div>
                  <div className="flex items-center gap-2">
                    {showCreateFolder ? (
                      <div className="flex items-center gap-2">
                        <input value={newFolderName} onChange={(e)=>setNewFolderName(e.target.value)} placeholder="New folder" className="px-2 py-1 border rounded text-sm" />
                        <button onClick={async ()=>{ const name = newFolderName.trim(); if (!name) return; const res = await fetch('/api/folders', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name }) }); if (!res.ok) { await showConfirm('Create failed'); return; } setNewFolderName(''); setShowCreateFolder(false); if (onRefreshFolders) await onRefreshFolders(); await load(); }} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                        <button onClick={()=>{ setShowCreateFolder(false); setNewFolderName(''); }} className="px-2 py-1 rounded text-sm admin-btn">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <button title="Create" onClick={()=>setShowCreateFolder(true)} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                        <button title="Delete folders" onClick={()=>setManageFolders(m=>!m)} className={`px-2 py-1 rounded text-sm ${manageFolders ? 'admin-btn' : 'btn-negative'}`}>{manageFolders ? 'Done' : 'Delete'}</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setFolder(null); setActiveTags([]); setAssets(assetsBackup || []); }} className={`px-2 py-1 rounded text-sm ${folder===null ? 'btn-selected' : 'admin-btn'}`}>All</button>
                  {folders.map((f:any)=> (
                    <div key={f.id} data-folder-button={f.id} className="inline-flex items-center">
                      <button
                        onClick={async (e)=>{
                          e.preventDefault();
                          e.stopPropagation();
                          if (manageFolders) {
                            const res = await fetch(`/api/assets?folder=${encodeURIComponent(f.slug)}`); const data = await res.json().catch(()=>[]); if (Array.isArray(data) && data.length>0) { const go = await showConfirm('Folder not empty', 'Remove files first', 'primary', 'Go to folder'); if (go) { setFolder(f.slug); setActiveTags([]); await load(); } return; } if (!(await showConfirm(`Delete folder '${f.name}'?`, undefined, 'danger', 'Delete'))) return; await fetch(`/api/folders/${f.id}`, { method: 'DELETE' }); if (onRefreshFolders) await onRefreshFolders(); await load(); return;
                          }
                          const ids = getSelectedIds();
                          if (ids.length) {
                                              if (!(await showConfirm(
                                                `Move ${ids.length} file(s) to folder '${f.name}'?`,
                                                "Click 'Clear selection' before clicking a folder if you meant to navigate to this folder instead.",
                                                'primary'
                                              ))) return;
                                              if (onMove) await onMove(ids, f.slug);
                                              else await Promise.all(ids.map((id)=>fetch(`/api/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ folder: f.slug }) })));
                                              setSelected({});
                                              try { if (typeof window !== 'undefined') sessionStorage.removeItem(SELECTED_KEY); } catch (e) {}
                                              setFolder(f.slug);
                                              setActiveTags([]);
                                              await load();
                                              if (onRefreshFolders) await onRefreshFolders();
                                              return;
                          }
                          if (folder === f.slug) {
                            setFolder(null);
                            setAssets(assetsBackup || []);
                          } else {
                            setFolder(f.slug);
                            setActiveTags([]);
                          }
                        }}
                        className={`inline-flex items-center gap-2 px-2 py-1 rounded text-sm ${manageFolders ? 'btn-negative' : folder===f.slug ? 'btn-selected' : 'admin-btn'}`}
                      >
                        <span>{f.name}</span>
                        {manageFolders && <span className="text-xs opacity-80">✕</span>}
                      </button>
                      
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tags — full-bleed secondary */}
            <div ref={tagSectionRef} style={{ backgroundColor: 'var(--color-bg-secondary)', width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '1rem 0' }}>
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between mb-1 w-full">
                  <div className="text-lg font-medium pb-4">Tags</div>
                  <div className="flex items-center gap-2">
                    {activeTags.length > 0 && (
                      <button onClick={()=>{ setActiveTags([]); setAssets(assetsBackup || []); }} className="px-2 py-1 rounded text-sm admin-btn">Clear filters</button>
                    )}

                    {showCreateTag ? (
                      <div className="flex items-center gap-2">
                        <input value={newTagName} onChange={(e)=>setNewTagName(e.target.value)} placeholder="New tag" className="px-2 py-1 border rounded text-sm" />
                        <button onClick={()=>createTag(newTagName)} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                        <button onClick={()=>{ setShowCreateTag(false); setNewTagName(''); }} className="px-2 py-1 rounded text-sm admin-btn">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <button title="Create" onClick={()=>setShowCreateTag(true)} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                        <button title="Delete tags" onClick={()=>setManageTags(m=>!m)} className={`px-2 py-1 rounded text-sm ${manageTags ? 'admin-btn' : 'btn-negative'}`}>{manageTags ? 'Done' : 'Delete'}</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t)=> {
                    const count = (assets || []).filter((a:any)=>Array.isArray(a.tags) && a.tags.includes(t)).length;
                    return (
                      <div key={t} className="inline-flex items-center">
                        <button
                          onMouseEnter={()=>{
                            if (manageTags) return;
                            const missing = computeMissingForTag(t);
                            if (missing > 0) setHoverNewCount(count + missing);
                            else setHoverNewCount(null);
                            setHoveredTag(t);
                          }}
                          onMouseLeave={()=>{ setHoveredTag(null); setHoverNewCount(null); }}
                          onClick={async (e)=>{
                            e.preventDefault();
                            e.stopPropagation();
                            if (manageTags) { await removeTagGlobally(t); return; }
                            if (getSelectedIds().length) {
                              await applyTagToSelected(t);
                              return;
                            }
                            setActiveTags((prev)=>{
                              const exists = prev.includes(t);
                              const next = exists ? prev.filter(x=>x!==t) : [...prev, t];
                              if (!next.length) {
                                setAssets(assetsBackup || []);
                              } else {
                                setAssets((assetsBackup || []).filter((a:any)=>Array.isArray(a.tags) && next.every((nt:string)=>a.tags.includes(nt))));
                              }
                              return next;
                            });
                          }}
                          className={`inline-flex items-center gap-2 px-2 py-1 rounded text-sm ${manageTags ? 'btn-negative' : activeTags.includes(t) ? 'btn-selected' : 'admin-btn'}`}
                          >
                            <span>{t}</span>
                            {manageTags ? (
                              <span className="text-xs opacity-80">✕</span>
                            ) : (
                              <span className="ml-1 inline-flex items-center justify-center tag-badge text-xs font-medium px-1 py-0.5 rounded-sm">
                                <span style={{ display: 'inline-block', overflow: 'hidden', height: 18 }}>
                                  <div style={{ transform: hoveredTag === t && hoverNewCount != null && hoverNewCount !== count ? 'translateY(0)' : 'translateY(-50%)', transition: 'transform 260ms ease' }}>
                                    <div style={{ height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{hoverNewCount ?? count}</div>
                                    <div style={{ height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</div>
                                  </div>
                                </span>
                              </span>
                            )}
                          </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

      {loading ? <div>Loading...</div> : (
        <>
          {/* Delete selected — inherit page primary (no explicit background) */}
            <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '1rem 0' }}>
            <div className="max-w-7xl mx-auto px-4 mb-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button onClick={selectAll} className="px-2 py-1 text-sm rounded btn-positive">Select all</button>
                  <button onClick={clearSelection} className="px-2 py-1 text-sm rounded admin-btn">Clear selection</button>
                </div>

                <div className="ml-auto">
                  <button onClick={bulkDelete} disabled={!selectedCount} className={`px-2 py-1 text-sm rounded ${selectedCount ? 'btn-negative' : 'bg-gray-500 cursor-not-allowed text-white'}`}>Delete selected</button>
                </div>
              </div>
              <div className="mt-2">
                {selectedCount ? (
                  <div className="text-sm text-gray-700">Selected {selectedCount} — click a tag to add it to selected files, or click a folder to move them.</div>
                ) : (
                  <div className="text-sm text-gray-700">&nbsp;</div>
                )}
              </div>
            </div>
          </div>

          {/* File previews — inherit page primary (no explicit background) */}
          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '1rem 0' }}>
            <div className="max-w-7xl mx-auto px-4">
              <div className="grid grid-cols-3 gap-4">
                {assets.map((a: any) => (
                  <div key={a.id} data-asset-id={a.id} draggable onDragStart={(e)=>{
                    const ids = getSelectedIds();
                    const dragging = ids.length ? ids : [a.id];
                    e.dataTransfer.setData('application/json', JSON.stringify({ assetIds: dragging }));
                  }} className={`group rounded-xl overflow-hidden bg-gray-800 isolate ${selected[a.id] ? 'border border-transparent' : 'border border-gray-700'}`}>
                    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }} className="bg-gray-800">
                      {a.publicUrl && /^image\/(jpeg|jpg|png|gif|webp|avif|svg\+xml)$/i.test(a.mime || '') ? (
                        <Image src={a.publicUrl} alt={a.alt || ''} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 33vw" />
                      ) : a.publicUrl ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span className="mt-1 text-xs uppercase tracking-wide">{(a.mime || '').split('/')[1] || filenameParts(a).ext.replace('.','')}</span>
                        </div>
                      ) : null}
                      <div
                        className="absolute inset-0 opacity-0 transition-opacity duration-150 pointer-events-none group-hover:opacity-100"
                        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.14) 50%, rgba(0,0,0,0.72) 100%)' }}
                      />
                      <div className={`absolute inset-0 pointer-events-none ${selected[a.id] ? 'thumbnail-selected' : ''}`} />

                      {/* UI overlay: click area toggles selection; action buttons stop propagation */}
                      <div className="absolute inset-0 flex flex-col justify-between p-3 text-white" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); toggleSelect(a.id); }}>
                        <div className="flex items-start justify-between">
                          <div className="text-sm font-medium flex items-center gap-2">
                            {editingId === a.id ? (
                              <input
                                ref={editInputRef}
                                className="px-1 py-0.5 border rounded text-sm text-white bg-transparent placeholder-gray-400"
                                value={editingName}
                                onClick={(e)=>e.stopPropagation()}
                                onChange={(e)=>setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveRename(a.id);
                                  if (e.key === 'Escape') { setEditingId(null); setEditingName(''); }
                                }}
                              />
                            ) : (
                              <span className="truncate max-w-48">{filenameParts(a).base || a.filename || a.storageKey}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
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
                              className="px-2 py-1 text-white rounded hover:bg-white/10"
                              aria-label={editingId === a.id ? 'Save' : 'Rename'}
                            >
                              {editingId === a.id ? <SaveIcon size={18} /> : <RenameIcon size={18} />}
                            </button>
                            {editingId === a.id && (
                              <button onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setEditingId(null); setEditingName(''); }} className="px-2 py-1 text-white rounded hover:bg-white/10" title="Cancel">
                                <CloseIcon />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 max-w-[70%] overflow-hidden">
                            {(a.tags || []).map((tag: string) => (
                              editingId === a.id ? (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={async (e)=>{ e.preventDefault(); e.stopPropagation(); if (!(await showConfirm(`Remove tag '${tag}' from this file?`, undefined, 'danger', 'Delete'))) return; await removeTagFromAsset(a.id, tag); }}
                                  className="inline-flex items-center justify-between gap-0 text-sm text-white bg-black/60 px-0.5 py-0.5 rounded truncate hover:bg-white/10"
                                  aria-label={`Remove tag ${tag}`}
                                >
                                  <span className="truncate mr-0.5">{tag}</span>
                                  <span className="text-xs bg-white/10 px-0.5 rounded">✕</span>
                                </button>
                              ) : (
                                <span key={tag} className="inline-flex items-center gap-2 text-sm text-white bg-black/60 px-1 py-0.5 rounded truncate">
                                  <span className="truncate">{tag}</span>
                                </span>
                              )
                            ))}
                          </div>
                          <button aria-label={a.filename || 'Open image'} onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setOpenImage(a); }} className="text-white text-sm underline px-2 py-1 rounded hover:bg-white/10">View</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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