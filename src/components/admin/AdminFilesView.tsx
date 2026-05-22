"use client";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import Image from "next/image";
import AlertDialog from "../ui/AlertDialog";
import { useAdminFiles, filenameParts } from "./useAdminFiles";

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

const CloseIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MAX_TAG_ROWS = 3;

function isVideoMime(mime?: string | null) {
  return /^video\//i.test(mime || '');
}

function TagsDisplay({
  tags,
  editing,
  onRemove,
}: {
  tags: string[];
  editing: boolean;
  onRemove: (tag: string) => Promise<void>;
}) {
  const tagRefs = useRef<(HTMLElement | null)[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const mobileRef = useRef<HTMLButtonElement | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const els = tagRefs.current.filter((el): el is HTMLElement => el != null).slice(0, tags.length);
    if (els.length === 0) { setHiddenCount(0); return; }
    const rowTops = [...new Set(els.map(el => Math.round(el.offsetTop)))].sort((a, b) => a - b);
    if (rowTops.length <= MAX_TAG_ROWS) { setHiddenCount(0); return; }
    const cutoff = rowTops[MAX_TAG_ROWS];
    setHiddenCount(els.filter(el => Math.round(el.offsetTop) >= cutoff).length);
  }, [tags, editing]);

  const visibleCount = tags.length - hiddenCount;

  function openPopover(el: HTMLElement | null) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPopoverPos({ top: rect.top, left: rect.left });
    setPopoverOpen(true);
  }

  function schedClose() {
    closeTimer.current = setTimeout(() => setPopoverOpen(false), 150);
  }

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  useEffect(() => {
    if (!popoverOpen) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (pillRef.current?.contains(target) || mobileRef.current?.contains(target)) return;
      setPopoverOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [popoverOpen]);

  const popover = popoverOpen && popoverPos ? createPortal(
    <div
      style={{ position: 'fixed', top: popoverPos.top - 8, left: popoverPos.left, transform: 'translateY(-100%)', zIndex: 9999 }}
      className="bg-gray-900/95 rounded-lg p-2 shadow-xl max-w-55"
      onMouseEnter={cancelClose}
      onMouseLeave={schedClose}
    >
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => editing ? (
          <button
            key={tag}
            type="button"
            onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await onRemove(tag); }}
            className="inline-flex items-center gap-0.5 text-xs text-white bg-white/20 px-1.5 py-0.5 rounded-full hover:bg-white/30"
          >
            {tag}<CloseIcon size={11} aria-hidden="true" />
          </button>
        ) : (
          <span key={tag} className="text-xs text-white bg-white/20 px-1.5 py-0.5 rounded-full">{tag}</span>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* Desktop: wrapping flex up to MAX_TAG_ROWS rows, then +N pill */}
      <div className="hidden md:flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
        {tags.map((tag, i) => editing ? (
          <button
            key={tag}
            ref={(el) => { tagRefs.current[i] = el; }}
            type="button"
            style={{ display: i >= visibleCount ? 'none' : undefined }}
            onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await onRemove(tag); }}
            className="inline-flex items-center gap-0.5 text-xs text-white bg-black/60 px-1.5 py-0.5 rounded-full hover:bg-white/10"
          >
            {tag}<CloseIcon size={11} aria-hidden="true" />
          </button>
        ) : (
          <span
            key={tag}
            ref={(el) => { tagRefs.current[i] = el; }}
            style={{ display: i >= visibleCount ? 'none' : undefined }}
            className="text-xs text-white bg-black/60 px-1.5 py-0.5 rounded-full"
          >
            {tag}
          </span>
        ))}
        {hiddenCount > 0 && (
          <button
            ref={pillRef}
            type="button"
            className="text-xs text-white bg-white/30 px-1.5 py-0.5 rounded-full hover:bg-white/50"
            onMouseEnter={() => openPopover(pillRef.current)}
            onMouseLeave={schedClose}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPopover(pillRef.current); }}
          >
            +{hiddenCount}
          </button>
        )}
      </div>
      {/* Mobile: tag count button opens popover on click */}
      {tags.length > 0 && (
        <div className="md:hidden" onClick={(e) => e.stopPropagation()}>
          <button
            ref={mobileRef}
            type="button"
            className="inline-flex items-center gap-1 text-xs text-white bg-black/60 px-2 py-0.5 rounded-full"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (popoverOpen) setPopoverOpen(false); else openPopover(mobileRef.current); }}
          >
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            {tags.length}
          </button>
        </div>
      )}
      {popover}
    </>
  );
}

export default function AdminFilesView({
  initialFolder,
  folders: initialFolders,
  onMove,
  onDelete,
  onRefreshFolders,
  refreshKey,
}: {
  initialFolder?: string | null;
  folders?: any[];
  onMove?: (ids: string[], folder: string) => Promise<void>;
  onDelete?: (ids: string[]) => Promise<void>;
  onRefreshFolders?: () => Promise<void>;
  refreshKey?: number;
}) {
  // UI-only state
  const [manageFolders, setManageFolders] = useState(false);
  const [manageTags, setManageTags] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [hoverNewCount, setHoverNewCount] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // DnD reorder state (folder view only)
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Folder description editor state
  const [folderDesc, setFolderDesc] = useState('');
  const [folderDescDirty, setFolderDescDirty] = useState(false);
  const [folderDescSaving, setFolderDescSaving] = useState(false);
  const [folderDescSaved, setFolderDescSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    assets,
    folders,
    tags,
    loading,
    selected,
    activeTags,
    folder,
    selectedIds,
    selectedCount,
    toggleSelect,
    selectAll,
    clearSelection,
    clearFolderFilter,
    clearTagFilter,
    load,
    bulkDelete,
    handleFolderClick,
    handleTagClick,
    createFolder,
    createTag,
    saveRename,
    removeTagFromAsset,
    computeMissingForTag,
    saveAssetOrder,
    dialogProps,
  } = useAdminFiles({ initialFolder, initialFolders, onMove, onDelete, onRefreshFolders, refreshKey });

  const activeFolder = (folders as any[]).find((f) => f.slug === folder);

  useEffect(() => {
    setFolderDesc((folders as any[]).find((f) => f.slug === folder)?.description || '');
    setFolderDescDirty(false);
    setFolderDescSaved(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, folders]);

  async function saveFolderDescription() {
    if (!activeFolder) return;
    setFolderDescSaving(true);
    await fetch(`/api/folders/${activeFolder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: folderDesc }),
    });
    setFolderDescSaving(false);
    setFolderDescDirty(false);
    setFolderDescSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setFolderDescSaved(false), 2500);
    await load();
  }

  function handleReorderDragStart(e: React.DragEvent, assetId: string) {
    setDragItemId(assetId);
    e.dataTransfer.setData('reorder', assetId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleReorderDragOver(e: React.DragEvent, targetId: string) {
    if (!dragItemId || dragItemId === targetId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== targetId) setDragOverId(targetId);
  }

  async function handleReorderDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('reorder');
    setDragItemId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const current = (assets as any[]).map((x) => x.id);
    const sourceIdx = current.indexOf(sourceId);
    if (sourceIdx === -1) return;
    const newOrder = [...current];
    newOrder.splice(sourceIdx, 1);
    const insertAt = newOrder.indexOf(targetId);
    newOrder.splice(insertAt === -1 ? newOrder.length : insertAt, 0, sourceId);
    await saveAssetOrder(newOrder);
  }

  function handleReorderDragEnd() {
    setDragItemId(null);
    setDragOverId(null);
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

  const [openImage, setOpenImage] = useState<any | null>(null);
  const close = useCallback(() => setOpenImage(null), []);
  const handleOverlayClick = useCallback(() => close(), [close]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div>
      <AlertDialog {...dialogProps} />
      <div className="flex items-center gap-2 w-full">
        <div className="flex flex-col gap-3 w-full">
          {/* Folders - inherit page primary (no explicit background) */}
          <div ref={folderSectionRef} style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', paddingBottom: '1rem' }}>
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-between w-full">
                <div className="text-lg font-medium pb-4">Folders</div>
                <div className="flex items-center gap-2">
                  {showCreateFolder ? (
                    <div className="flex items-center gap-2">
                      <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New folder" className="px-2 py-1 border rounded text-sm" />
                      <button onClick={async () => { const name = newFolderName.trim(); if (!name) return; const ok = await createFolder(name); if (ok) { setNewFolderName(''); setShowCreateFolder(false); } }} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                      <button onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }} className="px-2 py-1 rounded text-sm admin-btn">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button title="Create" onClick={() => setShowCreateFolder(true)} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                      <button title="Delete folders" onClick={() => setManageFolders(m => !m)} className={`px-2 py-1 rounded text-sm ${manageFolders ? 'admin-btn' : 'btn-negative'}`}>{manageFolders ? 'Done' : 'Delete'}</button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearFolderFilter(); }} className={`px-3 py-1 rounded-full text-sm ${folder === null ? 'btn-selected' : 'admin-btn'}`}>All</button>
                {folders.map((f: any) => (
                  <div key={f.id} data-folder-button={f.id} className="inline-flex items-center">
                      <button
                      onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await handleFolderClick(f, manageFolders); }}
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${manageFolders ? 'btn-negative' : folder === f.slug ? 'btn-selected' : 'admin-btn'}`}
                    >
                      <span>{f.name}</span>
                      {manageFolders && <CloseIcon size={15} aria-hidden="true" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tags - full-bleed secondary */}
          <div ref={tagSectionRef} style={{ backgroundColor: 'var(--color-bg-secondary)', width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '1rem 0' }}>
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-between mb-1 w-full">
                <div className="text-lg font-medium pb-4">Tags</div>
                <div className="flex items-center gap-2">
                  {activeTags.length > 0 && (
                    <button onClick={() => clearTagFilter()} className="px-2 py-1 rounded text-sm admin-btn">Clear filters</button>
                  )}
                  {showCreateTag ? (
                    <div className="flex items-center gap-2">
                      <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="New tag" className="px-2 py-1 border rounded text-sm" />
                      <button onClick={async () => { await createTag(newTagName); setNewTagName(''); setShowCreateTag(false); }} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                      <button onClick={() => { setShowCreateTag(false); setNewTagName(''); }} className="px-2 py-1 rounded text-sm admin-btn">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button title="Create" onClick={() => setShowCreateTag(true)} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                      <button title="Delete tags" onClick={() => setManageTags(m => !m)} className={`px-2 py-1 rounded text-sm ${manageTags ? 'admin-btn' : 'btn-negative'}`}>{manageTags ? 'Done' : 'Delete'}</button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => {
                  const count = (assets || []).filter((a: any) => Array.isArray(a.tags) && a.tags.includes(t)).length;
                  return (
                    <div key={t} className="inline-flex items-center">
                      <button
                        onMouseEnter={() => {
                          if (manageTags) return;
                          const missing = computeMissingForTag(t);
                          if (missing > 0) setHoverNewCount(count + missing);
                          else setHoverNewCount(null);
                          setHoveredTag(t);
                        }}
                        onMouseLeave={() => { setHoveredTag(null); setHoverNewCount(null); }}
                        onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await handleTagClick(t, manageTags); }}
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${manageTags ? 'btn-negative' : activeTags.includes(t) ? 'btn-selected' : 'admin-btn'}`}
                      >
                        <span>{t}</span>
                        {manageTags ? (
                          <CloseIcon size={15} aria-hidden="true" />
                        ) : (
                          <span className="inline-flex items-center justify-center tag-badge text-xs font-medium px-1 rounded-sm">
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

      {loading ? (
            <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '1rem 0' }}>
              <div className="max-w-7xl mx-auto px-4 pt-6">
                <div className="text-sm text-gray-700">Loading...</div>
              </div>
            </div>
          ) : (
        <>
          {/* Folder description editor — shown when a folder is active */}
          {folder && activeFolder && (
            <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '0.75rem 0' }}>
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-start gap-2">
                  <textarea
                    rows={2}
                    placeholder={`Description for "${activeFolder.name}"…`}
                    value={folderDesc}
                    onChange={(e) => { setFolderDesc(e.target.value); setFolderDescDirty(true); setFolderDescSaved(false); }}
                    className="flex-1 px-2 py-1.5 rounded border text-sm resize-none"
                    style={{ backgroundColor: 'var(--color-editor-bg)', borderColor: 'var(--color-border)', color: 'inherit' }}
                  />
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={saveFolderDescription}
                      disabled={!folderDescDirty || folderDescSaving}
                      className={`px-3 py-1.5 rounded text-sm ${folderDescDirty && !folderDescSaving ? 'btn-positive' : 'bg-gray-500 cursor-not-allowed text-white'}`}
                    >
                      {folderDescSaving ? 'Saving…' : 'Save'}
                    </button>
                    {folderDescSaved && <span className="text-xs text-green-600 text-center">Saved</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Action bar */}
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
                  <div className="text-sm text-gray-700">Selected {selectedCount} - click a tag to add it to selected files, or click a folder to move them.</div>
                ) : (
                  <div className="text-sm text-gray-700">&nbsp;</div>
                )}
              </div>
            </div>
          </div>

          {/* Asset grid */}
          <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '1rem 0' }}>
            <div className="max-w-7xl mx-auto px-4">
              <div className="grid grid-cols-3 gap-4">
                {assets.map((a: any) => (
                  <div
                    key={a.id}
                    data-asset-id={a.id}
                    draggable
                    onDragStart={(e) => {
                      if (folder) {
                        handleReorderDragStart(e, a.id);
                      } else {
                        const dragging = selectedIds.length ? selectedIds : [a.id];
                        e.dataTransfer.setData('application/json', JSON.stringify({ assetIds: dragging }));
                      }
                    }}
                    onDragOver={folder ? (e) => handleReorderDragOver(e, a.id) : undefined}
                    onDragLeave={folder ? () => { if (dragOverId === a.id) setDragOverId(null); } : undefined}
                    onDrop={folder ? (e) => handleReorderDrop(e, a.id) : undefined}
                    onDragEnd={folder ? handleReorderDragEnd : undefined}
                    className={`group rounded-xl overflow-hidden bg-gray-800 isolate transition-opacity ${selected[a.id] ? 'border border-transparent' : 'border border-gray-700'} ${dragItemId === a.id ? 'opacity-40' : ''} ${dragOverId === a.id ? 'ring-2 ring-blue-400' : ''}`}
                  >
                    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }} className="bg-gray-800">
                      {a.publicUrl && /^image\/(jpeg|jpg|png|gif|webp|avif|svg\+xml)$/i.test(a.mime || '') ? (
                        <Image src={a.publicUrl} alt={a.alt || ''} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 33vw" />
                      ) : a.publicUrl && isVideoMime(a.mime) ? (
                        <video
                          src={a.publicUrl}
                          className="absolute inset-0 w-full h-full object-cover"
                          preload="metadata"
                          muted
                          playsInline
                        />
                      ) : a.publicUrl ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span className="mt-1 text-xs uppercase tracking-wide">{(a.mime || '').split('/')[1] || filenameParts(a).ext.replace('.', '')}</span>
                        </div>
                      ) : null}
                      <div
                        className="absolute inset-0 opacity-0 transition-opacity duration-150 pointer-events-none group-hover:opacity-100"
                        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.14) 50%, rgba(0,0,0,0.72) 100%)' }}
                      />
                      <div className={`absolute inset-0 pointer-events-none ${selected[a.id] ? 'thumbnail-selected' : ''}`} />

                      <div className="absolute inset-0 flex flex-col justify-between p-3 text-white" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(a.id); }}>
                        <div className="flex items-start justify-between gap-2">
                          {folder && (
                            <div
                              className="shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-70 mt-0.5 touch-none"
                              title="Drag to reorder"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="5" r="2"/><circle cx="16" cy="5" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="19" r="2"/><circle cx="16" cy="19" r="2"/></svg>
                            </div>
                          )}
                          <div className="text-sm font-medium min-w-0 flex-1">
                            {editingId === a.id ? (
                              <input
                                ref={editInputRef}
                                className="w-full px-1 py-0.5 border rounded text-sm text-white bg-transparent placeholder-gray-400"
                                value={editingName}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveRename(a.id, editingName).then(ok => { if (ok) { setEditingId(null); setEditingName(''); } });
                                  if (e.key === 'Escape') { setEditingId(null); setEditingName(''); }
                                }}
                              />
                            ) : (
                              <span className="truncate block">{filenameParts(a).base || a.filename || a.storageKey}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              title={editingId === a.id ? 'Save' : 'Rename'}
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (editingId === a.id) {
                                  const ok = await saveRename(a.id, editingName);
                                  if (ok) { setEditingId(null); setEditingName(''); }
                                } else {
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
                              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingId(null); setEditingName(''); }} className="px-2 py-1 text-white rounded hover:bg-white/10" title="Cancel">
                                <CloseIcon />
                              </button>
                            )}
                            <button
                              aria-label={a.filename || 'Open image'}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenImage(a); }}
                              className="px-2 py-1 text-white text-sm underline rounded hover:bg-white/10"
                            >
                              View
                            </button>
                          </div>
                        </div>

                        <TagsDisplay
                          tags={a.tags || []}
                          editing={editingId === a.id}
                          onRemove={async (tag) => { await removeTagFromAsset(a.id, tag); }}
                        />
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
          <button onClick={close} aria-label="Close" className="absolute right-4 top-4 z-30 bg-white/90 rounded-full w-10 h-10 flex items-center justify-center text-gray-700 shadow"><CloseIcon aria-hidden="true" /></button>
          <div className="relative max-w-[calc(100vw-48px)] max-h-[calc(100vh-48px)] p-4 z-20" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', maxHeight: '100%' }}>
              {isVideoMime(openImage.mime) ? (
                <video
                  src={openImage.publicUrl}
                  controls
                  playsInline
                  style={{ width: 'auto', maxWidth: '100%', height: 'auto', maxHeight: 'calc(100vh - 80px)', display: 'block' }}
                />
              ) : (
                <img
                  src={openImage.publicUrl}
                  alt={openImage.alt || ''}
                  style={{ width: 'auto', maxWidth: '100%', height: 'auto', maxHeight: 'calc(100vh - 80px)', objectFit: 'contain', display: 'block' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
