import { useEffect, useState } from "react";
import { useConfirm, ConfirmDialogProps } from "./useConfirm";

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
  tags: string[];
  loading: boolean;
  selected: Record<string, boolean>;
  activeTags: string[];
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
  handleTagClick: (t: string, isManageTags: boolean) => Promise<void>;
  createFolder: (name: string) => Promise<boolean>;
  createTag: (name: string) => Promise<void>;
  saveRename: (id: string, name: string) => Promise<boolean>;
  removeTagFromAsset: (assetId: string, tag: string) => Promise<void>;
  computeMissingForTag: (tag: string) => number;
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
  const [assetsBackup, setAssetsBackup] = useState<any[] | null>(null);
  const [folders, setFolders] = useState<any[]>(initialFolders || []);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [folder, setFolder] = useState<string | null>(initialFolder ?? null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  const getSelectedIds = () => Object.keys(selected).filter((k) => selected[k]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') sessionStorage.setItem(SELECTED_KEY, JSON.stringify(selected));
    } catch (e) {
      // ignore
    }
  }, [selected]);

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

  async function load() {
    setLoading(true);
    try {
      const q = folder ? `?folder=${encodeURIComponent(folder)}` : '';
      const res = await fetch(`/api/assets${q}`);
      const data = await res.json().catch(() => []);
      setAssets(data || []);
      setAssetsBackup(data || []);
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
    setActiveTags([]);
    setAssets(assetsBackup || []);
  }

  function clearTagFilter() {
    setActiveTags([]);
    setAssets(assetsBackup || []);
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
        if (go) { setFolder(f.slug); setActiveTags([]); await load(); }
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
  }

  async function applyTagToSelected(tag: string) {
    const ids = getSelectedIds();
    if (!ids.length) { await confirm('No files selected'); return; }
    if (!(await confirm(
      `Add tag '${tag}' to ${ids.length} selected file(s)?`,
      "Click 'Clear selection' before selecting a tag if you meant to filter by this tag instead",
      'primary'
    ))) return;
    try {
      await Promise.all(ids.map((id) => {
        const asset = assets.find((x) => x.id === id) || (assetsBackup || []).find((x) => x.id === id);
        const current = Array.isArray(asset?.tags) ? asset.tags : [];
        const updated = Array.from(new Set([...current, tag]));
        return fetch(`/api/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: updated }) });
      }));
      await load();
    } catch (err) {
      console.error('applyTag error', err);
      await confirm('Failed to apply tag');
    }
  }

  async function removeTagGlobally(tag: string) {
    if (!(await confirm(`Remove tag '${tag}' from all assets?`, undefined, 'danger', 'Delete'))) return;
    try {
      const res = await fetch('/api/assets');
      const all = await res.json().catch(() => []);
      const targets = (all || []).filter((a: any) => Array.isArray(a.tags) && a.tags.includes(tag));
      await Promise.all(targets.map((a: any) => {
        const updated = (a.tags || []).filter((t: string) => t !== tag);
        return fetch(`/api/assets/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: updated }) });
      }));
      await load();
    } catch (err) {
      console.error('removeTagGlobally', err);
      await confirm('Failed to remove tag');
    }
  }

  async function handleTagClick(t: string, isManageTags: boolean) {
    if (isManageTags) { await removeTagGlobally(t); return; }
    if (getSelectedIds().length) { await applyTagToSelected(t); return; }
    setActiveTags((prev) => {
      const exists = prev.includes(t);
      const next = exists ? prev.filter((x) => x !== t) : [...prev, t];
      if (!next.length) {
        setAssets(assetsBackup || []);
      } else {
        setAssets((assetsBackup || []).filter((a: any) => Array.isArray(a.tags) && next.every((nt: string) => a.tags.includes(nt))));
      }
      return next;
    });
  }

  async function removeTagFromAsset(assetId: string, tag: string) {
    if (!(await confirm(`Remove tag '${tag}' from this file?`, undefined, 'danger', 'Delete'))) return;
    try {
      const asset = assets.find((x) => x.id === assetId) || (assetsBackup || []).find((x) => x.id === assetId);
      if (!asset) return;
      const updated = (asset.tags || []).filter((t: string) => t !== tag);
      const res = await fetch(`/api/assets/${assetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: updated }) });
      if (!res.ok) throw new Error('Failed');
      await load();
    } catch (err) {
      console.error('removeTagFromAsset', err);
      await confirm('Failed to remove tag');
    }
  }

  async function createTag(name: string) {
    const tag = (name || '').trim();
    if (!tag) return;
    const ids = getSelectedIds();
    if (ids.length) await applyTagToSelected(tag);
    else setTags((t) => Array.from(new Set([...t, tag])));
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
    activeTags,
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
    removeTagFromAsset,
    computeMissingForTag,
    reorderAssetsLocally,
    saveAssetOrder,
    dialogProps,
  };
}
