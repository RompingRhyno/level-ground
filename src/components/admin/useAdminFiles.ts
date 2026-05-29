import { useEffect, useState } from "react";
import { useConfirm, ConfirmDialogProps } from "./useConfirm";

export type TagDbRecord = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
};

export function filenameParts(a: any): { base: string; ext: string } {
  const raw = a.filename || a.storageKey || '';
  const idx = raw.lastIndexOf('.');
  if (idx === -1) return { base: raw, ext: '' };
  return { base: raw.slice(0, idx), ext: raw.slice(idx) };
}

const SELECTED_KEY = 'level-ground.admin.selected.v1';

export interface UseAdminFilesOptions {
  initialFolder?: string | null;
  initialFolders?: any[];
  onMove?: (ids: string[], folder: string) => Promise<void>;
  onDelete?: (ids: string[]) => Promise<void>;
  onRefreshFolders?: () => Promise<void>;
  refreshKey?: number;
}

export interface UseAdminFilesReturn {
  assets: any[];
  folders: any[];
  tags: TagDbRecord[];
  loading: boolean;
  selected: Record<string, boolean>;
  /** Single active tag slug used as top-level folder filter (null = no filter). */
  activeTag: string | null;
  /** Tag slugs currently assigned to the open folder. */
  folderActiveTags: string[];
  currentFolderId: number | null;
  /** First image URL per folder slug, for thumbnail display at top level. */
  folderThumbnails: Record<string, string>;
  folder: string | null;
  selectedIds: string[];
  selectedCount: number;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  clearFolderFilter: () => void;
  clearTagFilter: () => void;
  load: () => Promise<void>;
  bulkDelete: () => Promise<void>;
  handleFolderClick: (f: any, isManageFolders: boolean) => Promise<void>;
  /** isDeleteMode=true â†’ delete tag from DB; false â†’ toggle (folder membership or top-level filter). */
  handleTagClick: (t: string, isDeleteMode: boolean) => Promise<void>;
  createFolder: (name: string) => Promise<boolean>;
  createTag: (name: string, description?: string) => Promise<void>;
  saveRename: (id: string, name: string) => Promise<boolean>;
  reorderAssetsLocally: (orderedIds: string[]) => void;
  saveAssetOrder: (orderedIds: string[]) => Promise<void>;
  dialogProps: ConfirmDialogProps;
}

export function useAdminFiles({
  initialFolder,
  initialFolders,
  onMove,
  onDelete,
  onRefreshFolders,
  refreshKey,
}: UseAdminFilesOptions): UseAdminFilesReturn {
  const [assets, setAssets] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>(initialFolders || []);
  const [tags, setTags] = useState<TagDbRecord[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [folderActiveTags, setFolderActiveTags] = useState<string[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [folderThumbnails, setFolderThumbnails] = useState<Record<string, string>>({});
  const [folder, setFolder] = useState<string | null>(initialFolder ?? null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  const getSelectedIds = () => Object.keys(selected).filter((k) => selected[k]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') sessionStorage.setItem(SELECTED_KEY, JSON.stringify(selected));
    } catch (e) {}
  }, [selected]);

  async function load() {
    setLoading(true);
    try {
      const [tagsRes, fRes] = await Promise.all([fetch('/api/tags'), fetch('/api/folders')]);
      const tagsData = await tagsRes.json().catch(() => []);
      const fData = await fRes.json().catch(() => []);
      setTags(tagsData || []);
      setFolders(fData || []);

      if (folder) {
        const currentFolderObj = (fData || []).find((f: any) => f.slug === folder);
        setFolderActiveTags(Array.isArray(currentFolderObj?.tags) ? currentFolderObj.tags : []);
        setCurrentFolderId(typeof currentFolderObj?.id === 'number' ? currentFolderObj.id : null);
      } else {
        setFolderActiveTags([]);
        setCurrentFolderId(null);
      }

      // In folder view: load that folder's assets. At top level: load all, keep only unassigned.
      const q = folder ? `?folder=${encodeURIComponent(folder)}` : '';
      const res = await fetch(`/api/assets${q}`);
      const data = await res.json().catch(() => []);
      const assetList = folder ? (data || []) : (data || []).filter((a: any) => !a.folder);
      setAssets(assetList);

      // Compute folder thumbnails from the all-assets result (top-level only)
      // Use the lowest orderIndex image for each folder (preferred), falling back to any image.
      if (!folder) {
        const best: Record<string, { orderIndex: number; publicUrl: string }> = {};
        for (const a of (data || [])) {
          if (!a.folder) continue;
          if (!a.publicUrl) continue;
          if (a.mime && !a.mime.startsWith('image/')) continue;
          const idx = typeof a.orderIndex === 'number' ? a.orderIndex : Number.POSITIVE_INFINITY;
          const existing = best[a.folder];
          if (!existing || idx < existing.orderIndex) {
            best[a.folder] = { orderIndex: idx, publicUrl: a.publicUrl };
          }
        }
        const thumbs: Record<string, string> = {};
        for (const k of Object.keys(best)) thumbs[k] = best[k].publicUrl;
        setFolderThumbnails(thumbs);
      }

      try {
        const raw = typeof window !== 'undefined' ? sessionStorage.getItem(SELECTED_KEY) : null;
        const persisted: Record<string, boolean> = raw ? JSON.parse(raw) : {};
        if (persisted && Object.keys(persisted).length) {
          const ids = new Set(assetList.map((a: any) => a.id));
          const restored: Record<string, boolean> = {};
          Object.keys(persisted).forEach((k) => { if (ids.has(k) && persisted[k]) restored[k] = true; });
          setSelected((s) => ({ ...s, ...restored }));
        }
      } catch (err) {}
    } catch (err) {
      console.error('load failed', err);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [folder, refreshKey]);

  function toggleSelect(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
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

  function clearFolderFilter() {
    setFolder(null);
    setFolderActiveTags([]);
    setCurrentFolderId(null);
    setActiveTag(null);
  }

  function clearTagFilter() {
    setActiveTag(null);
  }

  async function bulkDelete() {
    const ids = getSelectedIds();
    if (!ids.length) { await confirm('No files selected'); return; }
    if (!(await confirm(`Delete ${ids.length} files?`, 'This action cannot be undone. This will permanently delete these files from the servers.', 'danger', 'Delete'))) return;
    if (onDelete) {
      await onDelete(ids);
    } else {
      await Promise.all(ids.map((id) => fetch(`/api/assets/${id}`, { method: 'DELETE' })));
    }
    setSelected({});
    await load();
    if (onRefreshFolders) await onRefreshFolders();
  }

  async function handleFolderClick(f: any, isManageFolders: boolean) {
    if (isManageFolders) {
      const res = await fetch(`/api/assets?folder=${encodeURIComponent(f.slug)}`);
      const data = await res.json().catch(() => []);
      if (Array.isArray(data) && data.length > 0) {
        const go = await confirm('Folder not empty', 'Remove files first', 'primary', 'Go to folder');
        if (go) { setFolder(f.slug); setActiveTag(null); await load(); }
        return;
      }
      if (!(await confirm(`Delete folder '${f.name}'?`, undefined, 'danger', 'Delete'))) return;
      await fetch(`/api/folders/${f.id}`, { method: 'DELETE' });
      if (onRefreshFolders) await onRefreshFolders();
      await load();
      return;
    }
    const ids = getSelectedIds();
    if (ids.length) {
      if (!(await confirm(
        `Move ${ids.length} file(s) to folder '${f.name}'?`,
        "Click 'Clear selection' before clicking a folder if you meant to navigate to this folder instead.",
        'primary'
      ))) return;
      if (onMove) await onMove(ids, f.slug);
      else await fetch('/api/assets/batch-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, folder: f.slug }),
      });
      setSelected({});
      try { if (typeof window !== 'undefined') sessionStorage.removeItem(SELECTED_KEY); } catch (e) {}
      setFolder(f.slug);
      setActiveTag(null);
      await load();
      if (onRefreshFolders) await onRefreshFolders();
      return;
    }
    if (folder === f.slug) {
      setFolder(null);
      setFolderActiveTags([]);
      setCurrentFolderId(null);
    } else {
      setFolder(f.slug);
      setActiveTag(null);
    }
  }

  async function handleTagClick(t: string, isDeleteMode: boolean) {
    if (isDeleteMode) {
      const tagObj = tags.find((tag) => tag.slug === t);
      if (!tagObj) return;
      if (!(await confirm(`Delete tag '${tagObj.name}'?`, 'This will remove it from all folders.', 'danger', 'Delete'))) return;
      try {
        await fetch(`/api/tags?id=${tagObj.id}`, { method: 'DELETE' });
        setFolderActiveTags((prev) => prev.filter((s) => s !== t));
        await load();
      } catch (err) {
        console.error('deleteTag error', err);
        await confirm('Failed to delete tag');
      }
      return;
    }

    if (folder && currentFolderId) {
      // Folder view: toggle membership for the current folder
      const newTags = folderActiveTags.includes(t)
        ? folderActiveTags.filter((s) => s !== t)
        : [...folderActiveTags, t];
      setFolderActiveTags(newTags);
      try {
        await fetch(`/api/folders/${currentFolderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: newTags }),
        });
        const fRes = await fetch('/api/folders');
        const fData = await fRes.json().catch(() => []);
        setFolders(fData || []);
      } catch (err) {
        console.error('toggleFolderTag error', err);
        setFolderActiveTags(folderActiveTags);
      }
      return;
    }

    // Top-level view: single-toggle folder filter
    setActiveTag((prev) => (prev === t ? null : t));
  }

  async function createTag(name: string, description?: string) {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, description: description ?? null }),
      });
      if (!res.ok) { await confirm('Failed to create tag'); return; }
      const newTag = await res.json();
      setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));

      if (folder && currentFolderId && newTag.slug) {
        const newFolderTags = [...folderActiveTags, newTag.slug];
        setFolderActiveTags(newFolderTags);
        await fetch(`/api/folders/${currentFolderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: newFolderTags }),
        });
        const fRes = await fetch('/api/folders');
        const fData = await fRes.json().catch(() => []);
        setFolders(fData || []);
      }
    } catch (err) {
      console.error('createTag error', err);
    }
  }

  async function createFolder(name: string): Promise<boolean> {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) { await confirm('Create failed'); return false; }
    if (onRefreshFolders) await onRefreshFolders();
    await load();
    return true;
  }

  async function saveRename(id: string, name: string): Promise<boolean> {
    const asset = assets.find((x) => x.id === id);
    if (!asset) { await confirm('Asset not found'); return false; }
    const { ext } = filenameParts(asset);
    const newFilename = `${name}${ext}`;
    try {
      const res = await fetch(`/api/assets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: newFilename }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.statusText);
      }
      await load();
      return true;
    } catch (err: any) {
      console.error('Rename failed', err);
      await confirm('Rename failed', err?.message || String(err));
      return false;
    }
  }

  async function saveAssetOrder(orderedIds: string[]) {
    reorderAssetsLocally(orderedIds);
    try {
      await fetch('/api/assets/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
    } catch (err) {
      console.error('saveAssetOrder failed', err);
    }
  }

  function reorderAssetsLocally(orderedIds: string[]) {
    setAssets((prev) => {
      const map = new Map(prev.map((a) => [a.id, a]));
      return orderedIds.map((id) => map.get(id)).filter(Boolean) as any[];
    });
  }

  const selectedIds = getSelectedIds();

  return {
    assets,
    folders,
    tags,
    loading,
    selected,
    activeTag,
    folderActiveTags,
    currentFolderId,
    folderThumbnails,
    folder,
    selectedIds,
    selectedCount: selectedIds.length,
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
    reorderAssetsLocally,
    saveAssetOrder,
    dialogProps,
  };
}

