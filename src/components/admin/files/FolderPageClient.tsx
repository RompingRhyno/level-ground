"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AlertDialog from "@/components/ui/AlertDialog";
import { useConfirm } from "@/components/admin/useConfirm";
import { api, filesApi } from "./api";
import type { AssetData, FolderData, TagData } from "./types";
import AssetTile from "./AssetTile";
import Lightbox from "./Lightbox";
import Menu from "./Menu";
import MoveModal from "./MoveModal";
import UploadModal from "./UploadModal";
import TransitionModal from "./TransitionModal";
import { ToastProvider, useToast } from "./Toast";
import {
  TRANSITION_MAX_MEMBERS,
  TRANSITION_MIN_MEMBERS,
  readTransition,
  transitionsFromRows,
} from "@/lib/transition";

type LightboxPrompt = { kind: "rename" | "alt"; asset: AssetData } | null;

function FolderPageClientInner({
  initialFolder,
  initialAssets,
  initialTags,
  initialFolders,
}: {
  initialFolder: FolderData;
  initialAssets: AssetData[];
  initialTags: TagData[];
  initialFolders: FolderData[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();

  const [folder, setFolder] = useState<FolderData>(initialFolder);
  const [assets, setAssets] = useState<AssetData[]>(initialAssets);
  const [tags, setTags] = useState<TagData[]>(initialTags);
  const [folders, setFolders] = useState<FolderData[]>(initialFolders);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"" | "image" | "video">("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [seedFiles, setSeedFiles] = useState<File[] | undefined>(undefined);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(initialFolder.name);
  const [description, setDescription] = useState(initialFolder.description ?? "");
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [prompt, setPrompt] = useState<LightboxPrompt>(null);
  const [promptValue, setPromptValue] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [transitionModal, setTransitionModal] = useState<
    { mode: "create" } | { mode: "edit"; groupId: string } | null
  >(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    try {
      const [nextAssets, nextFolders] = await Promise.all([
        filesApi.assets({ folder: folder.slug, sort: "order_asc", include: "usage" }),
        filesApi.folderCards(),
      ]);
      setAssets(nextAssets);
      setFolders(nextFolders);
      const current = nextFolders.find((entry) => entry.slug === folder.slug);
      if (current) setFolder(current);
    } catch (err: any) {
      toast({ kind: "error", message: "Could not load folder", detail: err?.message });
    }
  }, [folder.slug, toast]);

  useEffect(() => {
    if (renaming) nameInputRef.current?.focus();
  }, [renaming]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (kind === "image" && !(asset.mime ?? "").startsWith("image/")) return false;
      if (kind === "video" && !(asset.mime ?? "").startsWith("video/")) return false;
      if (!q) return true;
      return (asset.filename ?? "").toLowerCase().includes(q);
    });
  }, [assets, query, kind]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const transitions = useMemo(() => transitionsFromRows(assets), [assets]);
  const groups = useMemo(() => assets.filter((asset) => readTransition(asset.meta) !== null), [assets]);
  // Hidden files keep their place in `assets` (they are ordered last) but render in their own section and
  // are never part of "Select all".
  const visible = useMemo(() => filtered.filter((asset) => !asset.hidden), [filtered]);
  const hiddenRows = useMemo(() => filtered.filter((asset) => asset.hidden), [filtered]);

  const selectedAssets = useMemo(
    () => selectedIds.map((id) => assets.find((asset) => asset.id === id)).filter((a): a is AssetData => Boolean(a)),
    [selectedIds, assets],
  );
  const anyHiddenSelected = selectedAssets.some((asset) => asset.hidden);
  const anyVisibleSelected = selectedAssets.some((asset) => !asset.hidden);
  const mixedSelection = anyHiddenSelected && anyVisibleSelected;
  const canCreateTransition =
    selectedAssets.length >= TRANSITION_MIN_MEMBERS &&
    selectedAssets.length <= TRANSITION_MAX_MEMBERS &&
    !selectedAssets.some((asset) => readTransition(asset.meta) !== null);

  const groupNamesFor = useCallback(
    (assetId: string) =>
      groups
        .filter((group) => readTransition(group.meta)?.members.includes(assetId))
        .map((group) => group.filename ?? "Before/After"),
    [groups],
  );

  useEffect(() => {
    setHiddenOpen(window.localStorage.getItem(`admin_files_hidden:${folder.slug}`) === "1");
  }, [folder.slug]);

  // ── Folder level actions ────────────────────────────────────────────────

  async function saveFolderName() {
    const name = nameDraft.trim();
    setRenaming(false);
    if (!name || name === folder.name) return;
    try {
      const result = await api<{ folder: FolderData; cascade?: { slugChanged?: boolean; assetsMoved?: number; pagesUpdated?: number } }>(
        `/api/folders/${folder.id}`,
        { method: "PATCH", body: JSON.stringify({ name }) },
      );
      setFolder((current) => ({ ...current, ...result.folder }));
      toast({
        kind: "success",
        message: `Renamed to “${result.folder.name}”`,
        detail: result.cascade?.slugChanged
          ? `Project URL is now /projects/${result.folder.slug} · ${result.cascade.assetsMoved ?? 0} file(s) followed · ${result.cascade.pagesUpdated ?? 0} page(s) updated`
          : undefined,
      });
      if (result.cascade?.slugChanged) {
        router.replace(`/admin/files/${result.folder.slug}`);
        router.refresh();
        return;
      }
      await reload();
    } catch (err: any) {
      toast({ kind: "error", message: "Rename failed", detail: err?.message });
    }
  }

  async function toggleHidden() {
    try {
      const result = await api<{ folder: FolderData }>(`/api/folders/${folder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden: !folder.hidden }),
      });
      setFolder((current) => ({ ...current, ...result.folder }));
      toast({
        kind: "success",
        message: folder.hidden ? "Folder is visible on /projects" : "Folder hidden from /projects",
      });
      router.refresh();
    } catch (err: any) {
      toast({ kind: "error", message: "Could not change visibility", detail: err?.message });
    }
  }

  async function deleteFolder() {
    const ok = await confirm(
      `Delete “${folder.name}” and its ${assets.length} file${assets.length === 1 ? "" : "s"}?`,
      assets.length > 0
        ? "The files are removed from Cloudflare R2 as well. This cannot be undone."
        : "This cannot be undone.",
      "danger",
      assets.length > 0 ? "Delete folder + files" : "Delete folder",
    );
    if (!ok) return;
    try {
      await api(`/api/folders/${folder.id}?contents=delete`, { method: "DELETE" });
      toast({ kind: "success", message: `Folder “${folder.name}” deleted` });
      router.push("/admin/files");
      router.refresh();
    } catch (err: any) {
      toast({ kind: "error", message: "Delete failed", detail: err?.message });
    }
  }

  async function saveDescription() {
    setSavingDescription(true);
    try {
      await api(`/api/folders/${folder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description }),
      });
      setDescriptionDirty(false);
      toast({ kind: "success", message: "Description saved" });
    } catch (err: any) {
      toast({ kind: "error", message: "Could not save description", detail: err?.message });
    } finally {
      setSavingDescription(false);
    }
  }

  async function toggleTag(slug: string) {
    const next = folder.tags.includes(slug)
      ? folder.tags.filter((entry) => entry !== slug)
      : [...folder.tags, slug];
    setFolder((current) => ({ ...current, tags: next }));
    try {
      await api(`/api/folders/${folder.id}`, { method: "PATCH", body: JSON.stringify({ tags: next }) });
      router.refresh();
    } catch (err: any) {
      setFolder((current) => ({ ...current, tags: folder.tags }));
      toast({ kind: "error", message: "Could not update tags", detail: err?.message });
    }
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const created = await api<TagData>("/api/tags", { method: "POST", body: JSON.stringify({ name }) });
      setTags((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName("");
      setCreatingTag(false);
      await toggleTag(created.slug);
    } catch (err: any) {
      toast({ kind: "error", message: "Could not create tag", detail: err?.message });
    }
  }

  async function renameTag(tag: TagData) {
    const name = window.prompt("New tag name", tag.name);
    if (!name || name.trim() === tag.name) return;
    try {
      const updated = await api<TagData>(`/api/tags?id=${tag.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      setTags((current) =>
        current
          .map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      router.refresh();
    } catch (err: any) {
      toast({ kind: "error", message: "Could not rename tag", detail: err?.message });
    }
  }

  async function deleteTag(tag: TagData) {
    const ok = await confirm(`Delete the tag “${tag.name}”?`, "It is removed from every folder.", "danger", "Delete tag");
    if (!ok) return;
    try {
      await api(`/api/tags?id=${tag.id}`, { method: "DELETE" });
      setTags((current) => current.filter((entry) => entry.id !== tag.id));
      setFolder((current) => ({ ...current, tags: current.tags.filter((slug) => slug !== tag.slug) }));
      router.refresh();
    } catch (err: any) {
      toast({ kind: "error", message: "Could not delete tag", detail: err?.message });
    }
  }

  // ── Asset actions ──────────────────────────────────────────────────────

  async function saveAsset(asset: AssetData, patch: Record<string, unknown>) {
    try {
      await api(`/api/assets/${asset.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await reload();
      router.refresh();
      return true;
    } catch (err: any) {
      toast({ kind: "error", message: "Could not save", detail: err?.message });
      return false;
    }
  }

  async function deleteAssets(ids: string[]) {
    if (!ids.length) return;
    const usage = new Set<string>();
    ids.forEach((id) => assets.find((asset) => asset.id === id)?.usedOn?.forEach((slug) => usage.add(slug)));
    const usedList = [...usage];
    const affectedGroups = [...new Set(ids.flatMap((id) => groupNamesFor(id)))];
    const ok = await confirm(
      `Delete ${ids.length} file${ids.length === 1 ? "" : "s"}?`,
      [
        usedList.length ? `Used on: ${usedList.join(", ")}.` : "",
        affectedGroups.length
          ? `In ${affectedGroups.length === 1 ? "transition" : "transitions"} ${affectedGroups.join(", ")} — a two-image transition is removed entirely, a larger one loses the image.`
          : "",
        "This removes the file from the server and cannot be undone.",
      ]
        .filter(Boolean)
        .join(" "),
      "danger",
      "Delete",
    );
    if (!ok) return;

    let failed = 0;
    for (const id of ids) {
      try {
        await api(`/api/assets/${id}`, { method: "DELETE" });
      } catch {
        failed++;
      }
    }
    setSelected({});
    await reload();
    router.refresh();
    toast({
      kind: failed ? "error" : "success",
      message: failed ? `${failed} file(s) could not be deleted` : `Deleted ${ids.length} file(s)`,
    });
  }

  /** Hide or unhide every selected file. The toolbar refuses a mixed selection, so this is unambiguous. */
  async function setHiddenSelected(hidden: boolean) {
    const ids = [...selectedIds];
    if (!ids.length) return;
    try {
      for (const id of ids) {
        await api(`/api/assets/${id}`, { method: "PATCH", body: JSON.stringify({ hidden }) });
      }
      setSelected({});
      await reload();
      router.refresh();
      toast({
        kind: "success",
        message: `${ids.length} file${ids.length === 1 ? "" : "s"} ${hidden ? "hidden" : "shown again"}`,
      });
    } catch (err: any) {
      toast({ kind: "error", message: "Could not change visibility", detail: err?.message });
    }
  }

  async function persistOrder(orderedIds: string[]) {
    setAssets((current) => {
      const byId = new Map(current.map((asset) => [asset.id, asset]));
      return orderedIds.map((id) => byId.get(id)!).filter(Boolean);
    });
    try {
      await api("/api/assets/reorder", { method: "POST", body: JSON.stringify({ orderedIds }) });
      router.refresh();
    } catch (err: any) {
      toast({ kind: "error", message: "Could not save the new order", detail: err?.message });
      void reload();
    }
  }

  function handleDrop(targetId: string) {
    const sourceId = dragId;
    setDragId(null);
    setOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const ids = assets.map((asset) => asset.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    void persistOrder(ids);
  }

  function moveToEnd() {
    if (!dragId) return;
    const ids = assets.map((asset) => asset.id);
    const from = ids.indexOf(dragId);
    if (from === -1) return;
    ids.push(ids.splice(from, 1)[0]);
    setDragId(null);
    setOverId(null);
    void persistOrder(ids);
  }

  const lightboxAsset = lightboxIndex !== null ? visible[lightboxIndex] : null;

  return (
    <div className="mx-auto max-w-7xl">
      <AlertDialog {...dialogProps} />

      {/* Back navigation */}
      <div className="mb-4">
        <Link href="/admin/files" className="inline-flex items-center gap-1 text-sm text-(--color-brand-dark) hover:underline">
          <span aria-hidden="true">←</span> All folders
        </Link>
      </div>

      {/* Heading + folder actions */}
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="mr-auto min-w-0">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                ref={nameInputRef}
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveFolderName();
                  if (event.key === "Escape") setRenaming(false);
                }}
                className="rounded border px-2 py-1 text-2xl font-semibold"
                aria-label="Folder name"
              />
              <button type="button" onClick={saveFolderName} className="rounded px-3 py-1.5 text-sm btn-positive">
                Save
              </button>
              <button type="button" onClick={() => setRenaming(false)} className="rounded px-3 py-1.5 text-sm admin-btn">
                Cancel
              </button>
            </div>
          ) : (
            <h1
              className="text-2xl font-semibold cursor-text hover:bg-(--color-bg-secondary) rounded px-1 -mx-1 inline-flex items-center gap-2"
              onClick={() => {
                setNameDraft(folder.name);
                setRenaming(true);
              }}
              title="Click to rename"
            >
              {folder.name}
              <span className="text-xs font-normal text-gray-500">click to rename</span>
            </h1>
          )}
          <p className="mt-1 text-sm text-gray-600">
            {assets.length} file{assets.length === 1 ? "" : "s"} · visible on{" "}
            <Link href={`/projects/${folder.slug}`} className="underline">
              /projects/{folder.slug}
            </Link>
            {folder.hidden && <span className="ml-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">hidden</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSeedFiles(undefined);
              setUploadOpen(true);
            }}
            className="rounded px-3 py-1.5 text-sm btn-positive"
          >
            Upload
          </button>
          <button type="button" onClick={toggleHidden} className="rounded px-3 py-1.5 text-sm admin-btn">
            {folder.hidden ? "Show on /projects" : "Hide from /projects"}
          </button>
          <button type="button" onClick={() => void deleteFolder()} className="rounded px-3 py-1.5 text-sm btn-negative">
            Delete folder…
          </button>
        </div>
      </div>

      {/* Description */}
      <div
        className="mb-6 rounded border border-(--color-border) p-3"
        style={{ backgroundColor: "var(--color-bg-secondary)" }}
      >
        <label className="mb-1 block text-sm font-medium" htmlFor="folder-description">
          Project description
        </label>
        <textarea
          id="folder-description"
          rows={3}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setDescriptionDirty(true);
          }}
          onBlur={() => descriptionDirty && void saveDescription()}
          placeholder="Shown on the project page…"
          className="w-full rounded border bg-white px-2 py-1.5 text-sm"
        />
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          {descriptionDirty ? (
            <>
              <span>Unsaved changes</span>
              <button
                type="button"
                onClick={saveDescription}
                disabled={savingDescription}
                className={`rounded px-2 py-0.5 text-xs text-white ${savingDescription ? "bg-gray-500" : "btn-positive"}`}
              >
                {savingDescription ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <span>Saved automatically when you click away.</span>
          )}
        </div>
      </div>

      {/* Tags */}
      <div
        className="mb-6 rounded border border-(--color-border) p-3"
        style={{ backgroundColor: "var(--color-bg-secondary)" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Tags</span>
          <div className="flex items-center gap-2">
            {creatingTag ? (
              <>
                <input
                  value={newTagName}
                  onChange={(event) => setNewTagName(event.target.value)}
                  placeholder="New tag"
                  className="rounded border bg-white px-2 py-1 text-sm"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void createTag();
                  }}
                />
                <button type="button" onClick={createTag} className="rounded px-2 py-1 text-sm btn-positive">
                  Create
                </button>
                <button type="button" onClick={() => setCreatingTag(false)} className="rounded px-2 py-1 text-sm admin-btn">
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setCreatingTag(true)} className="rounded px-2 py-1 text-sm btn-positive">
                ＋ New tag
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 && <span className="text-sm text-gray-500">No tags yet.</span>}
          {tags.map((tag) => {
            const active = folder.tags.includes(tag.slug);
            return (
              <span key={tag.id} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => toggleTag(tag.slug)}
                  title={tag.description ?? undefined}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1 text-sm ${active ? "btn-selected" : "admin-btn"}`}
                >
                  {tag.name}
                </button>
                <Menu
                  className="-ml-1"
                  buttonClassName="rounded-full px-1 py-1 text-xs text-gray-400 hover:text-gray-700"
                  items={[
                    { label: "Rename tag…", onSelect: () => void renameTag(tag) },
                    { label: "Delete tag…", danger: true, onSelect: () => void deleteTag(tag) },
                  ]}
                />
              </span>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search files…"
          className="w-48 rounded border bg-white px-3 py-1.5 text-sm"
          aria-label="Search files"
        />
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as "" | "image" | "video")}
          className="rounded border bg-white px-2 py-1.5 text-sm"
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          <option value="image">Photos</option>
          <option value="video">Videos</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && <span className="text-sm text-gray-700">{selectedIds.length} selected</span>}
          <button
            type="button"
            onClick={() => setSelected(Object.fromEntries(visible.map((asset) => [asset.id, true])))}
            className="rounded px-2 py-1 text-sm admin-btn"
          >
            Select all
          </button>
          {selectedIds.length > 0 && (
            <>
              <button type="button" onClick={() => setSelected({})} className="rounded px-2 py-1 text-sm admin-btn">
                Clear
              </button>
              <button
                type="button"
                onClick={() => void setHiddenSelected(anyHiddenSelected && !anyVisibleSelected ? false : true)}
                disabled={mixedSelection}
                title={mixedSelection ? "A hidden and a visible file are selected" : undefined}
                className="rounded px-2 py-1 text-sm admin-btn disabled:opacity-50"
              >
                {anyHiddenSelected && !anyVisibleSelected ? "Unhide" : "Hide"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setTransitionModal({ mode: "create" })}
            disabled={!canCreateTransition}
            title={
              canCreateTransition
                ? undefined
                : `Select ${TRANSITION_MIN_MEMBERS}–${TRANSITION_MAX_MEMBERS} images (a transition cannot contain another transition)`
            }
            className="rounded px-2 py-1 text-sm admin-btn disabled:opacity-50"
          >
            Create transition…
          </button>
          {selectedIds.length > 0 && (
            <>
              <button type="button" onClick={() => setMoveOpen(true)} className="rounded px-2 py-1 text-sm btn-positive">
                Move to…
              </button>
              <button
                type="button"
                onClick={() => void deleteAssets(selectedIds)}
                className="rounded px-2 py-1 text-sm btn-negative"
              >
                Delete selected
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hidden files: ordered last, out of dynamic galleries, kept out of "Select all". */}
      {hiddenRows.length > 0 && (
        <div
          className="mb-3 rounded-lg border border-(--color-border)"
          style={{ backgroundColor: "var(--color-bg-secondary)" }}
        >
          <button
            type="button"
            aria-expanded={hiddenOpen}
            onClick={() => {
              const next = !hiddenOpen;
              setHiddenOpen(next);
              window.localStorage.setItem(`admin_files_hidden:${folder.slug}`, next ? "1" : "0");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-(--color-brand-dark)"
          >
            <span aria-hidden="true">{hiddenOpen ? "▾" : "▸"}</span>
            Hidden from galleries ({hiddenRows.length})
          </button>
          {hiddenOpen && (
            <div className="grid grid-cols-1 gap-5 border-t border-(--color-border) p-3 sm:grid-cols-2 lg:grid-cols-3">
              {hiddenRows.map((asset) => (
                <AssetTile
                  key={asset.id}
                  asset={asset}
                  group={transitions[asset.id]}
                  selected={!!selected[asset.id]}
                  usage={asset.usedOn ?? []}
                  onToggleSelect={() => setSelected((current) => ({ ...current, [asset.id]: !current[asset.id] }))}
                  onOpen={() => undefined}
                  onRename={() => undefined}
                  onSetAlt={() => undefined}
                  onMove={() => {
                    setSelected({ [asset.id]: true });
                    setMoveOpen(true);
                  }}
                  onDelete={() => void deleteAssets([asset.id])}
                  onEditTransition={
                    transitions[asset.id]
                      ? () => setTransitionModal({ mode: "edit", groupId: asset.id })
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drop zone + grid */}
      <div
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setFileDragOver(true);
        }}
        onDragLeave={() => setFileDragOver(false)}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setFileDragOver(false);
          setSeedFiles(Array.from(event.dataTransfer.files));
          setUploadOpen(true);
        }}
        id="asset-grid"
        className={`rounded-lg border-2 border-dashed p-3 transition-colors ${
          fileDragOver ? "border-(--btn-positive-bg) bg-(--color-bg-secondary)" : "border-transparent"
        }`}
      >
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-(--color-border) bg-white px-6 py-14 text-center">
            <p className="text-lg font-medium mb-1">
              {assets.length === 0 ? "No files in this folder yet" : "No files match that search"}
            </p>
            <p className="text-sm text-gray-600">
              Drop files here, or use the Upload button. Videos are converted to 720p + 1080p MP4.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((asset, index) => (
              <AssetTile
                key={asset.id}
                asset={asset}
                group={transitions[asset.id]}
                selected={!!selected[asset.id]}
                usage={asset.usedOn ?? []}
                dragging={dragId === asset.id}
                dropTarget={overId === asset.id}
                onToggleSelect={() => setSelected((current) => ({ ...current, [asset.id]: !current[asset.id] }))}
                onOpen={() => setLightboxIndex(index)}
                onRename={() => {
                  setPrompt({ kind: "rename", asset });
                  setPromptValue(asset.filename ?? "");
                }}
                onSetAlt={() => {
                  setPrompt({ kind: "alt", asset });
                  setPromptValue(asset.alt ?? "");
                }}
                onMove={() => {
                  setSelected({ [asset.id]: true });
                  setMoveOpen(true);
                }}
                onDelete={() => void deleteAssets([asset.id])}
                onEditTransition={
                  transitions[asset.id]
                    ? () => setTransitionModal({ mode: "edit", groupId: asset.id })
                    : undefined
                }
                onReorderDragStart={(event) => {
                  setDragId(asset.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/asset-id", asset.id);
                }}
                onReorderDragOver={(event) => {
                  event.preventDefault();
                  if (overId !== asset.id) setOverId(asset.id);
                }}
                onReorderDrop={(event) => {
                  event.preventDefault();
                  handleDrop(asset.id);
                }}
                onReorderDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                  moveToEnd();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {lightboxAsset && (
        <Lightbox
          asset={lightboxAsset}
          onClose={() => setLightboxIndex(null)}
          hasPrev={lightboxIndex !== null && lightboxIndex > 0}
          hasNext={lightboxIndex !== null && lightboxIndex < filtered.length - 1}
          onPrev={() => setLightboxIndex((index) => (index === null ? index : Math.max(0, index - 1)))}
          onNext={() =>
            setLightboxIndex((index) => (index === null ? index : Math.min(filtered.length - 1, index + 1)))
          }
        />
      )}

      {/* Rename / alt prompt */}
      {prompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="mb-3 font-semibold text-gray-800">
              {prompt.kind === "rename" ? "Rename file" : "Alt text"}
            </h2>
            {prompt.kind === "rename" ? (
              <input
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
                aria-label="Filename"
                autoFocus
              />
            ) : (
              <textarea
                rows={2}
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                placeholder="Describe the image for screen readers and search engines"
                className="w-full rounded border px-2 py-1.5 text-sm"
                aria-label="Alt text"
                autoFocus
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPrompt(null)} className="rounded px-3 py-1.5 text-sm admin-btn">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const value = promptValue.trim();
                  const ok = await saveAsset(
                    prompt.asset,
                    prompt.kind === "rename" ? { filename: value } : { alt: value },
                  );
                  if (ok) setPrompt(null);
                }}
                className="rounded px-3 py-1.5 text-sm btn-positive"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {transitionModal && (
        <TransitionModal
          folderSlug={folder.slug}
          assets={assets}
          initialIds={
            transitionModal.mode === "create"
              ? visible.filter((asset) => selected[asset.id]).map((asset) => asset.id)
              : undefined
          }
          initialGroup={
            transitionModal.mode === "edit"
              ? (() => {
                  const asset = assets.find((a) => a.id === transitionModal.groupId);
                  const transition = asset ? readTransition(asset.meta) : null;
                  return asset && transition
                    ? {
                        id: asset.id,
                        name: asset.filename ?? "Before/After",
                        orderIndex: asset.orderIndex,
                        transition,
                      }
                    : undefined;
                })()
              : undefined
          }
          onClose={() => setTransitionModal(null)}
          onSaved={() => {
            void reload();
            router.refresh();
          }}
        />
      )}

      <MoveModal
        open={moveOpen}
        assetIds={selectedIds}
        folders={folders}
        fromFolder={folder.slug}
        onClose={() => setMoveOpen(false)}
        onMoved={() => {
          setSelected({});
          void reload();
          router.refresh();
        }}
        onFolderCreated={(created) => setFolders((current) => [...current, created])}
      />

      <UploadModal
        open={uploadOpen}
        folders={folders}
        initialFolder={folder.slug}
        lockedFolder
        seedFiles={seedFiles}
        onClose={() => setUploadOpen(false)}
        onFolderCreated={(created) => setFolders((current) => [...current, created])}
        onUploaded={() => {
          void reload();
          router.refresh();
        }}
      />
    </div>
  );
}

export default function FolderPageClient(props: {
  initialFolder: FolderData;
  initialAssets: AssetData[];
  initialTags: TagData[];
  initialFolders: FolderData[];
}) {
  return (
    <ToastProvider>
      <FolderPageClientInner {...props} />
    </ToastProvider>
  );
}
