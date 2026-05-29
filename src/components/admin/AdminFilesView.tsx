"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import AlertDialog from "../ui/AlertDialog";
import { useAdminFiles, filenameParts } from "./useAdminFiles";
import type { TagDbRecord } from "./useAdminFiles";

// ── Icon components ────────────────────────────────────────────────────────────

const SaveIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 21v-8H7v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RenameIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3 21v-3.75L14.81 5.44a2 2 0 0 1 2.83 0l1.92 1.92a2 2 0 0 1 0 2.83L7.75 21H3z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FolderIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const ImageFileIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const VideoFileIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="1" y="5" width="15" height="14" rx="2" />
    <polygon points="23 7 16 12 23 17 23 7" />
  </svg>
);

const DocumentIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

function FileTypeIcon({ mime, size = 15 }: { mime?: string | null; size?: number }) {
  if (mime?.startsWith("image/")) return <ImageFileIcon size={size} />;
  if (mime?.startsWith("video/")) return <VideoFileIcon size={size} />;
  return <DocumentIcon size={size} />;
}

function isVideoMime(mime?: string | null) {
  return /^video\//i.test(mime || "");
}

// ── Main component ─────────────────────────────────────────────────────────────

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
  const [manageFolders, setManageFolders] = useState(false);
  const [manageTags, setManageTags] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [folderDesc, setFolderDesc] = useState("");
  const [folderDescDirty, setFolderDescDirty] = useState(false);
  const [folderDescSaving, setFolderDescSaving] = useState(false);
  const [folderDescSaved, setFolderDescSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    assets, folders, tags, loading, selected,
    activeTag, folderActiveTags, folderThumbnails,
    folder, selectedIds, selectedCount,
    toggleSelect, selectAll, clearSelection, clearFolderFilter, clearTagFilter,
    load, bulkDelete, handleFolderClick, handleTagClick,
    createFolder, createTag, saveRename, saveAssetOrder, dialogProps,
  } = useAdminFiles({ initialFolder, initialFolders, onMove, onDelete, onRefreshFolders, refreshKey });

  const activeFolder = (folders as any[]).find((f) => f.slug === folder);

  useEffect(() => {
    setFolderDesc((folders as any[]).find((f) => f.slug === folder)?.description || "");
    setFolderDescDirty(false);
    setFolderDescSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, folders]);

  async function saveFolderDescription() {
    if (!activeFolder) return;
    setFolderDescSaving(true);
    await fetch(`/api/folders/${activeFolder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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
    e.dataTransfer.setData("reorder", assetId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleReorderDragOver(e: React.DragEvent, targetId: string) {
    if (!dragItemId || dragItemId === targetId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== targetId) setDragOverId(targetId);
  }

  async function handleReorderDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("reorder");
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
  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

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
          const assetEl = document.querySelector(`[data-asset-id="${editingId}"]`);
          if (assetEl && node && !assetEl.contains(node)) {
            setEditingId(null);
            setEditingName("");
          }
        } catch {}
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [manageFolders, manageTags, editingId]);

  const [openImage, setOpenImage] = useState<any | null>(null);
  const close = useCallback(() => setOpenImage(null), []);
  const handleOverlayClick = useCallback(() => close(), [close]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Active-first sort only in folder view; top-level stays alphabetical
  const sortedTags = [...tags].sort((a, b) => {
    if (folder) {
      const aActive = folderActiveTags.includes(a.slug);
      const bActive = folderActiveTags.includes(b.slug);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
    }
    return a.name.localeCompare(b.name);
  });

  const visibleFolders: any[] = activeTag
    ? (folders as any[]).filter((f) => Array.isArray(f.tags) && f.tags.includes(activeTag))
    : (folders as any[]);

  return (
    <div>
      <AlertDialog {...dialogProps} />
      <div className="flex items-center gap-2 w-full">
        <div className="flex flex-col gap-3 w-full">

          {/* Folders navigation */}
          <div ref={folderSectionRef} style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", paddingBottom: "1rem" }}>
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-between w-full">
                <div className="text-lg font-medium pb-4">Folders</div>
                <div className="flex items-center gap-2">
                  {showCreateFolder ? (
                    <div className="flex items-center gap-2">
                      <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New folder" className="px-2 py-1 border rounded text-sm" />
                      <button onClick={async () => { const name = newFolderName.trim(); if (!name) return; const ok = await createFolder(name); if (ok) { setNewFolderName(""); setShowCreateFolder(false); } }} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                      <button onClick={() => { setShowCreateFolder(false); setNewFolderName(""); }} className="px-2 py-1 rounded text-sm admin-btn">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setShowCreateFolder(true)} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                      <button onClick={() => setManageFolders((m) => !m)} className={`px-2 py-1 rounded text-sm ${manageFolders ? "admin-btn" : "btn-negative"}`}>{manageFolders ? "Done" : "Delete"}</button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearFolderFilter(); }} className={`px-3 py-1 rounded-full text-sm ${folder === null ? "btn-selected" : "admin-btn"}`}>All</button>
                {(folders as any[]).map((f: any) => (
                  <div key={f.id} className="inline-flex items-center">
                    <button
                      onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await handleFolderClick(f, manageFolders); }}
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${manageFolders ? "btn-negative" : folder === f.slug ? "btn-selected" : "admin-btn"}`}
                    >
                      <span>{f.name}</span>
                      {manageFolders && <CloseIcon size={15} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tags section */}
          <div ref={tagSectionRef} style={{ backgroundColor: "var(--color-bg-secondary)", width: "100vw", marginLeft: "calc(50% - 50vw)", padding: "1rem 0" }}>
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-between mb-1 w-full">
                <div className="text-lg font-medium pb-4">{folder ? "Folder Tags" : "Tags"}</div>
                <div className="flex items-center gap-2">
                  {!folder && activeTag && (
                    <button onClick={() => clearTagFilter()} className="px-2 py-1 rounded text-sm admin-btn">Clear filter</button>
                  )}
                  {showCreateTag ? (
                    <div className="flex items-center gap-2">
                      <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name" className="px-2 py-1 border rounded text-sm" />
                      <button onClick={async () => { await createTag(newTagName); setNewTagName(""); setShowCreateTag(false); }} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                      <button onClick={() => { setShowCreateTag(false); setNewTagName(""); }} className="px-2 py-1 rounded text-sm admin-btn">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setShowCreateTag(true)} className="px-2 py-1 rounded text-sm btn-positive">Create</button>
                      <button onClick={() => setManageTags((m) => !m)} className={`px-2 py-1 rounded text-sm ${manageTags ? "admin-btn" : "btn-negative"}`}>{manageTags ? "Done" : "Delete"}</button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {sortedTags.map((t) => {
                  const isActive = folder ? folderActiveTags.includes(t.slug) : activeTag === t.slug;
                  return (
                    <button
                      key={t.id}
                      onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await handleTagClick(t.slug, manageTags); }}
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${manageTags ? "btn-negative" : isActive ? "btn-selected" : "admin-btn"}`}
                      title={t.description ?? undefined}
                    >
                      <span>{t.name}</span>
                      {manageTags && <CloseIcon size={15} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", padding: "1rem 0" }}>
          <div className="max-w-7xl mx-auto px-4 pt-6">
            <div className="text-sm text-gray-700">Loading...</div>
          </div>
        </div>
      ) : (
        <>
          {/* Folder description editor */}
          {folder && activeFolder && (
            <div style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", padding: "0.75rem 0" }}>
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-start gap-2">
                  <textarea
                    rows={2}
                    placeholder={`Description for "${activeFolder.name}"…`}
                    value={folderDesc}
                    onChange={(e) => { setFolderDesc(e.target.value); setFolderDescDirty(true); setFolderDescSaved(false); }}
                    className="flex-1 px-2 py-1.5 rounded border text-sm resize-none"
                    style={{ backgroundColor: "var(--color-editor-bg)", borderColor: "var(--color-border)", color: "inherit" }}
                  />
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={saveFolderDescription}
                      disabled={!folderDescDirty || folderDescSaving}
                      className={`px-3 py-1.5 rounded text-sm ${folderDescDirty && !folderDescSaving ? "btn-positive" : "bg-gray-500 cursor-not-allowed text-white"}`}
                    >
                      {folderDescSaving ? "Saving…" : "Save"}
                    </button>
                    {folderDescSaved && <span className="text-xs text-green-600 text-center">Saved</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action bar */}
          <div style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", padding: "1rem 0" }}>
            <div className="max-w-7xl mx-auto px-4 mb-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button onClick={selectAll} className="px-2 py-1 text-sm rounded btn-positive">Select all</button>
                  <button onClick={clearSelection} className="px-2 py-1 text-sm rounded admin-btn">Clear selection</button>
                </div>
                <div className="ml-auto">
                  <button onClick={bulkDelete} disabled={!selectedCount} className={`px-2 py-1 text-sm rounded ${selectedCount ? "btn-negative" : "bg-gray-500 cursor-not-allowed text-white"}`}>Delete selected</button>
                </div>
              </div>
              <div className="mt-2">
                {selectedCount ? (
                  <div className="text-sm text-gray-700">Selected {selectedCount} — click a folder to move them.</div>
                ) : (
                  <div className="text-sm text-gray-700">&nbsp;</div>
                )}
              </div>
            </div>
          </div>

          {/* Main grid */}
          <div style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", padding: "1rem 0" }}>
            <div className="max-w-7xl mx-auto px-4">
              <div className="grid grid-cols-3 gap-4">

                {/* Unassigned assets — top level, no tag filter */}
                {!folder && !activeTag && assets.map((a: any) => (
                  <AssetCard
                    key={a.id}
                    a={a}
                    selected={!!selected[a.id]}
                    editingId={editingId}
                    editingName={editingName}
                    editInputRef={editInputRef}
                    dragItemId={dragItemId}
                    dragOverId={dragOverId}
                    inFolder={false}
                    onToggleSelect={() => toggleSelect(a.id)}
                    onEditStart={() => { setEditingName(filenameParts(a).base); setEditingId(a.id); }}
                    onEditSave={async () => { const ok = await saveRename(a.id, editingName); if (ok) { setEditingId(null); setEditingName(""); } }}
                    onEditCancel={() => { setEditingId(null); setEditingName(""); }}
                    onEditChange={(v) => setEditingName(v)}
                    onView={() => setOpenImage(a)}
                    onDragStart={(e) => { const dragging = selectedIds.length ? selectedIds : [a.id]; e.dataTransfer.setData("application/json", JSON.stringify({ assetIds: dragging })); }}
                  />
                ))}

                {/* Folder cards — top level */}
                {!folder && visibleFolders.map((f: any) => (
                  <FolderCard
                    key={f.id}
                    f={f}
                    thumbnailUrl={folderThumbnails[f.slug] ?? null}
                    isManage={manageFolders}
                    tags={tags}
                    onClick={async () => { await handleFolderClick(f, manageFolders); }}
                    onRenameComplete={load}
                  />
                ))}

                {/* Assets inside a folder */}
                {folder && assets.map((a: any) => (
                  <AssetCard
                    key={a.id}
                    a={a}
                    selected={!!selected[a.id]}
                    editingId={editingId}
                    editingName={editingName}
                    editInputRef={editInputRef}
                    dragItemId={dragItemId}
                    dragOverId={dragOverId}
                    inFolder={true}
                    onToggleSelect={() => toggleSelect(a.id)}
                    onEditStart={() => { setEditingName(filenameParts(a).base); setEditingId(a.id); }}
                    onEditSave={async () => { const ok = await saveRename(a.id, editingName); if (ok) { setEditingId(null); setEditingName(""); } }}
                    onEditCancel={() => { setEditingId(null); setEditingName(""); }}
                    onEditChange={(v) => setEditingName(v)}
                    onView={() => setOpenImage(a)}
                    onDragStart={(e) => handleReorderDragStart(e, a.id)}
                    onDragOver={(e) => handleReorderDragOver(e, a.id)}
                    onDragLeave={() => { if (dragOverId === a.id) setDragOverId(null); }}
                    onDrop={(e) => handleReorderDrop(e, a.id)}
                    onDragEnd={handleReorderDragEnd}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Lightbox */}
      {openImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleOverlayClick} role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" />
          <button onClick={close} aria-label="Close" className="absolute right-4 top-4 z-30 bg-white/90 rounded-full w-10 h-10 flex items-center justify-center text-gray-700 shadow">
            <CloseIcon size={18} />
          </button>
          <div className="relative max-w-[calc(100vw-48px)] max-h-[calc(100vh-48px)] p-4 z-20" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", maxWidth: "100%", maxHeight: "100%" }}>
              {isVideoMime(openImage.mime) ? (
                <video src={openImage.publicUrl} controls playsInline style={{ width: "auto", maxWidth: "100%", height: "auto", maxHeight: "calc(100vh - 80px)", display: "block" }} />
              ) : (
                <img src={openImage.publicUrl} alt={openImage.alt || ""} style={{ width: "auto", maxWidth: "100%", height: "auto", maxHeight: "calc(100vh - 80px)", objectFit: "contain", display: "block" }} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Folder card ────────────────────────────────────────────────────────────────

function FolderCard({
  f, thumbnailUrl, isManage, tags, onClick, onRenameComplete,
}: {
  f: any;
  thumbnailUrl: string | null;
  isManage: boolean;
  tags: TagDbRecord[];
  onClick: () => void;
  onRenameComplete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const folderTagSlugs: string[] = Array.isArray(f.tags) ? f.tags : [];
  const folderTagNames = folderTagSlugs.map((slug) => {
    const found = tags.find((t) => t.slug === slug);
    return found ? found.name : slug;
  });

  async function saveRename() {
    const name = editName.trim();
    if (!name || name === f.name) { setEditing(false); return; }
    setSaving(true);
    await fetch(`/api/folders/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    setEditing(false);
    onRenameComplete?.();
  }

  return (
    <div
      data-folder-id={f.id}
      className={`group rounded-xl overflow-hidden bg-gray-800 border border-gray-700 isolate cursor-pointer ${isManage ? "ring-2 ring-red-500" : ""}`}
      onClick={() => { if (!editing) onClick(); }}
    >
      <div style={{ position: "relative", width: "100%", paddingTop: "56.25%" }}>
        {/* Thumbnail */}
        {thumbnailUrl ? (
          <Image src={thumbnailUrl} alt={f.name} fill style={{ objectFit: "cover" }} sizes="(max-width: 768px) 100vw, 33vw" />
        ) : (
          <div className="absolute inset-0 bg-gray-700" />
        )}

        {/* Top gradient — visible by default, hides on hover for clearer UI */}
        <div
          className="absolute inset-0 pointer-events-none opacity-100 group-hover:opacity-0 transition-opacity duration-150"
          style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 50%)" }}
        />

        {/* Delete mode overlay */}
        {isManage && (
          <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center pointer-events-none">
            <CloseIcon size={24} />
          </div>
        )}

        {/* Content overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-3 text-white">
          {/* Top row: folder icon + name + rename */}
          <div className="flex items-start gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 mt-0.5 text-white/80">
              <FolderIcon size={16} />
            </div>
            <div className="text-sm font-medium min-w-0 flex-1">
              {editing ? (
                <input
                  ref={inputRef}
                  className="w-full px-1 py-0.5 border border-white/40 rounded text-sm text-white bg-transparent placeholder-white/50"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename();
                    if (e.key === "Escape") setEditing(false);
                  }}
                />
              ) : (
                <span className="truncate block">{f.name}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                title={editing ? "Save" : "Rename"}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (editing) { await saveRename(); }
                  else { setEditName(f.name); setEditing(true); }
                }}
                className="px-2 py-1 text-white rounded hover:bg-white/10"
              >
                {editing ? <SaveIcon size={18} /> : <RenameIcon size={18} />}
              </button>
              {editing && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(false); }}
                  className="px-2 py-1 text-white rounded hover:bg-white/10"
                  title="Cancel"
                >
                  <CloseIcon size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Bottom: tag pills */}
          {folderTagNames.length > 0 && (
            <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
              {folderTagNames.map((name, i) => (
                <span key={folderTagSlugs[i]} className="text-xs px-1.5 py-0.5 rounded-full bg-black text-white">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Asset card ─────────────────────────────────────────────────────────────────

function AssetCard({
  a, selected, editingId, editingName, editInputRef, dragItemId, dragOverId, inFolder,
  onToggleSelect, onEditStart, onEditSave, onEditCancel, onEditChange, onView,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: {
  a: any;
  selected: boolean;
  editingId: string | null;
  editingName: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  dragItemId: string | null;
  dragOverId: string | null;
  inFolder: boolean;
  onToggleSelect: () => void;
  onEditStart: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditChange: (v: string) => void;
  onView: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const isEditing = editingId === a.id;

  return (
    <div
      data-asset-id={a.id}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group rounded-xl overflow-hidden bg-gray-800 border border-gray-700 isolate transition-opacity ${dragItemId === a.id ? "opacity-40" : ""}`}
    >
      <div style={{ position: "relative", width: "100%", paddingTop: "56.25%" }} className="bg-gray-800">
        {/* Thumbnail media */}
        {a.publicUrl && /^image\/(jpeg|jpg|png|gif|webp|avif|svg\+xml)$/i.test(a.mime || "") ? (
          <Image src={a.publicUrl} alt={a.alt || ""} fill style={{ objectFit: "cover" }} sizes="(max-width: 768px) 100vw, 33vw" />
        ) : a.publicUrl && isVideoMime(a.mime) ? (
          <video src={a.publicUrl} className="absolute inset-0 w-full h-full object-cover" preload="metadata" muted playsInline />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
            <DocumentIcon size={36} />
            <span className="mt-1 text-xs uppercase tracking-wide">{(a.mime || "").split("/")[1] || filenameParts(a).ext.replace(".", "")}</span>
          </div>
        )}

        {/* Top gradient — visible by default, hides on hover for clearer UI */}
        <div
          className="absolute inset-0 pointer-events-none opacity-100 group-hover:opacity-0 transition-opacity duration-150"
          style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 50%)" }}
        />

        {/* Selection overlay */}
        <div className={`absolute inset-0 pointer-events-none ${selected ? "thumbnail-selected" : ""}`} />

        {/* Controls */}
        <div
          className="absolute inset-0 flex flex-col justify-between p-3 text-white"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(); }}
        >
          {/* Top row */}
          <div className="flex items-start gap-2">
            {/* Drag handle (folder view only) */}
            {inFolder && (
              <div
                className="shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-70 mt-0.5 touch-none text-white/80"
                title="Drag to reorder"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="8" cy="5" r="2"/><circle cx="16" cy="5" r="2"/>
                  <circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/>
                  <circle cx="8" cy="19" r="2"/><circle cx="16" cy="19" r="2"/>
                </svg>
              </div>
            )}
            {/* File type icon */}
            <div className="shrink-0 mt-0.5 text-white/80" onClick={(e) => e.stopPropagation()}>
              <FileTypeIcon mime={a.mime} size={15} />
            </div>
            {/* Name */}
            <div className="text-sm font-medium min-w-0 flex-1">
              {isEditing ? (
                <input
                  ref={editInputRef}
                  className="w-full px-1 py-0.5 border rounded text-sm text-white bg-transparent placeholder-gray-400"
                  value={editingName}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onEditChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onEditSave();
                    if (e.key === "Escape") onEditCancel();
                  }}
                />
              ) : (
                <span className="truncate block">{filenameParts(a).base || a.filename || a.storageKey}</span>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                title={isEditing ? "Save" : "Rename"}
                onClick={async (e) => { e.preventDefault(); e.stopPropagation(); if (isEditing) { onEditSave(); } else { onEditStart(); } }}
                className="px-2 py-1 text-white rounded hover:bg-white/10"
              >
                {isEditing ? <SaveIcon size={18} /> : <RenameIcon size={18} />}
              </button>
              {isEditing && (
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditCancel(); }} className="px-2 py-1 text-white rounded hover:bg-white/10" title="Cancel">
                  <CloseIcon size={15} />
                </button>
              )}
              <button
                aria-label={a.filename || "Open"}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView(); }}
                className="px-2 py-1 text-white text-sm underline rounded hover:bg-white/10"
              >
                View
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
