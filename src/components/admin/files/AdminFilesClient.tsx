"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AlertDialog from "@/components/ui/AlertDialog";
import { useConfirm } from "@/components/admin/useConfirm";
import { api, filesApi } from "./api";
import type { FolderData } from "./types";
import FolderCard from "./FolderCard";
import UploadModal from "./UploadModal";
import { ToastProvider, useToast } from "./Toast";

/**
 * Media library home: one card per project folder, ordered by hand and split into
 * "shown on /projects" and "hidden". Uploads always target a folder — either the button in the
 * toolbar or drag-and-drop onto a card.
 */
const HIDDEN_SECTION_KEY = "level-ground.admin.hiddenFolders.v1";

function AdminFilesClientInner({ initialFolders }: { initialFolders: FolderData[] }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialogProps } = useConfirm();

  const [folders, setFolders] = useState<FolderData[]>(initialFolders);
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<string | null>(null);
  const [seedFiles, setSeedFiles] = useState<File[] | undefined>(undefined);
  const [dragSlug, setDragSlug] = useState<string | null>(null);
  const [overSlug, setOverSlug] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [hideNew, setHideNew] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(HIDDEN_SECTION_KEY) !== "collapsed";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(HIDDEN_SECTION_KEY, hiddenOpen ? "expanded" : "collapsed");
    } catch {
      // ignore unavailable storage
    }
  }, [hiddenOpen]);

  const reload = useCallback(async () => {
    try {
      setFolders(await filesApi.folderCards());
    } catch (err: any) {
      toast({ kind: "error", message: "Could not load folders", detail: err?.message });
    }
  }, [toast]);

  useEffect(() => {
    // Keep in sync with server-side ordering after mutations elsewhere.
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((folder) => folder.name.toLowerCase().includes(q));
  }, [folders, query]);

  const visible = filtered.filter((folder) => !folder.hidden);
  const hidden = filtered.filter((folder) => folder.hidden);

  async function createFolder() {
    const name = newName.trim();
    if (!name) return;
    setSavingNew(true);
    try {
      await api("/api/folders", { method: "POST", body: JSON.stringify({ name, hidden: hideNew }) });
      setNewName("");
      setHideNew(false);
      setCreating(false);
      await reload();
      toast({ kind: "success", message: `Folder “${name}” created` });
    } catch (err: any) {
      toast({ kind: "error", message: "Could not create folder", detail: err?.message });
    } finally {
      setSavingNew(false);
    }
  }

  async function renameFolder(folder: FolderData, name: string) {
    try {
      const result = await api<{ cascade?: { slugChanged?: boolean; assetsMoved?: number; pagesUpdated?: number } }>(
        `/api/folders/${folder.id}`,
        { method: "PATCH", body: JSON.stringify({ name }) },
      );
      await reload();
      const cascade = result?.cascade;
      toast({
        kind: "success",
        message: `Renamed to “${name}”`,
        detail: cascade?.slugChanged
          ? `Project URL updated · ${cascade.assetsMoved ?? 0} file(s) moved with it`
          : undefined,
      });
    } catch (err: any) {
      toast({ kind: "error", message: "Rename failed", detail: err?.message });
    }
  }

  async function toggleHidden(folder: FolderData) {
    try {
      await api(`/api/folders/${folder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden: !folder.hidden }),
      });
      await reload();
      toast({
        kind: "success",
        message: folder.hidden ? `“${folder.name}” is back on /projects` : `“${folder.name}” hidden from /projects`,
      });
    } catch (err: any) {
      toast({ kind: "error", message: "Could not change visibility", detail: err?.message });
    }
  }

  async function deleteFolder(folder: FolderData) {
    const message =
      folder.assetCount > 0
        ? `Delete “${folder.name}” and its ${folder.assetCount} file${folder.assetCount === 1 ? "" : "s"}?`
        : `Delete the empty folder “${folder.name}”?`;
    const ok = await confirm(
      message,
      folder.assetCount > 0
        ? "The files are removed from Cloudflare R2 as well. This cannot be undone."
        : "This cannot be undone.",
      "danger",
      folder.assetCount > 0 ? "Delete folder + files" : "Delete folder",
    );
    if (!ok) return;
    try {
      await api(`/api/folders/${folder.id}?contents=delete`, { method: "DELETE" });
      await reload();
      toast({ kind: "success", message: `Folder “${folder.name}” deleted` });
      router.refresh();
    } catch (err: any) {
      toast({ kind: "error", message: "Delete failed", detail: err?.message });
    }
  }

  async function persistOrder(visibleSlugs: string[]) {
    const hiddenSlugs = folders.filter((folder) => folder.hidden).map((folder) => folder.slug);
    const bySlug = new Map(folders.map((folder) => [folder.slug, folder]));
    const ordered = [...visibleSlugs, ...hiddenSlugs].map((slug) => bySlug.get(slug)!).filter(Boolean);
    setFolders(ordered);
    try {
      await api("/api/folders/reorder", {
        method: "POST",
        body: JSON.stringify({ orderedIds: ordered.map((folder) => folder.id) }),
      });
      router.refresh();
    } catch (err: any) {
      toast({ kind: "error", message: "Could not save the new order", detail: err?.message });
      void reload();
    }
  }

  function handleReorderDrop(targetSlug: string) {
    const sourceSlug = dragSlug;
    setDragSlug(null);
    setOverSlug(null);
    if (!sourceSlug || sourceSlug === targetSlug) return;

    const sourceIsHidden = folders.find((folder) => folder.slug === sourceSlug)?.hidden ?? false;
    const targetIsHidden = folders.find((folder) => folder.slug === targetSlug)?.hidden ?? false;
    if (sourceIsHidden !== targetIsHidden) {
      toast({ kind: "info", message: "Hidden and visible folders keep separate order" });
      return;
    }

    const group = visible.some((folder) => folder.slug === sourceSlug) ? visible : hidden;
    const slugs = group.map((folder) => folder.slug);
    const from = slugs.indexOf(sourceSlug);
    const to = slugs.indexOf(targetSlug);
    if (from === -1 || to === -1) return;
    slugs.splice(to, 0, slugs.splice(from, 1)[0]);

    if (group === visible) {
      void persistOrder(slugs);
    } else {
      const bySlug = new Map(folders.map((folder) => [folder.slug, folder]));
      const visibleSlugs = visible.map((folder) => folder.slug);
      const reordered = [...visibleSlugs, ...slugs].map((slug) => bySlug.get(slug)!).filter(Boolean);
      setFolders(reordered);
      api("/api/folders/reorder", {
        method: "POST",
        body: JSON.stringify({ orderedIds: reordered.map((folder) => folder.id) }),
      }).catch((err) => toast({ kind: "error", message: "Could not save the new order", detail: err?.message }));
    }
  }

  function renderCards(list: FolderData[]) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.map((folder) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            dragging={dragSlug === folder.slug}
            dropTarget={overSlug === folder.slug}
            onOpen={() => router.push(`/admin/files/${folder.slug}`)}
            onRename={(name) => renameFolder(folder, name)}
            onToggleHidden={() => toggleHidden(folder)}
            onDelete={() => void deleteFolder(folder)}
            onAddFiles={() => {
              setUploadFolder(folder.slug);
              setSeedFiles(undefined);
              setUploadOpen(true);
            }}
            onDropFiles={(files) => {
              setUploadFolder(folder.slug);
              setSeedFiles(files);
              setUploadOpen(true);
            }}
            onReorderDragStart={(event) => {
              setDragSlug(folder.slug);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/folder-slug", folder.slug);
            }}
            onReorderDragOver={(event) => {
              event.preventDefault();
              if (overSlug !== folder.slug) setOverSlug(folder.slug);
            }}
            onReorderDrop={(event) => {
              event.preventDefault();
              handleReorderDrop(folder.slug);
            }}
            onReorderDragEnd={() => {
              setDragSlug(null);
              setOverSlug(null);
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <AlertDialog {...dialogProps} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold mr-auto">Projects</h1>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search folders…"
          className="rounded border px-3 py-1.5 text-sm w-56"
          aria-label="Search folders"
        />
        <button
          type="button"
          onClick={() => setCreating((open) => !open)}
          className={`rounded px-3 py-1.5 text-sm ${creating ? "admin-btn" : "btn-positive"}`}
        >
          {creating ? "Cancel" : "＋ New folder"}
        </button>
        <button
          type="button"
          onClick={() => {
            setUploadFolder(null);
            setSeedFiles(undefined);
            setUploadOpen(true);
          }}
          className="rounded px-3 py-1.5 text-sm btn-positive"
        >
          Upload
        </button>
      </div>

      {creating && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded border bg-white p-3">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Folder name (project address)"
            className="flex-1 min-w-[14rem] rounded border px-3 py-1.5 text-sm"
            onKeyDown={(event) => {
              if (event.key === "Enter") void createFolder();
            }}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={hideNew} onChange={(event) => setHideNew(event.target.checked)} />
            Hide from /projects
          </label>
          <button
            type="button"
            onClick={createFolder}
            disabled={savingNew || !newName.trim()}
            className={`rounded px-3 py-1.5 text-sm ${savingNew || !newName.trim() ? "bg-gray-500 cursor-not-allowed text-white" : "btn-positive"}`}
          >
            {savingNew ? "Creating…" : "Create folder"}
          </button>
        </div>
      )}

      <p className="mb-4 text-sm text-gray-600">
        Drag cards to reorder how they appear on <Link href="/projects" className="underline">/projects</Link>. Drop image or
        video files straight onto a folder to upload into it. Hidden folders keep their own order, above.
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-(--color-border) bg-white px-6 py-16 text-center">
          <p className="text-lg font-medium mb-1">
            {folders.length === 0 ? "No project folders yet" : "No folders match that search"}
          </p>
          <p className="text-sm text-gray-600">
            {folders.length === 0
              ? "Create a folder for each job — every file you upload lives inside one."
              : "Try a different name."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {hidden.length > 0 && (
            <section className="rounded-lg border border-(--color-border) bg-white/70 p-4">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <button
                  type="button"
                  onClick={() => setHiddenOpen((open) => !open)}
                  aria-expanded={hiddenOpen}
                  aria-controls="hidden-folders"
                  className="flex items-center gap-2 text-lg font-medium"
                >
                  <span
                    className={`text-xs transition-transform ${hiddenOpen ? "rotate-90" : ""}`}
                    aria-hidden="true"
                  >
                    ▶
                  </span>
                  Hidden from /projects ({hidden.length})
                </button>
                <p className="text-sm text-gray-600">
                  Kept in the library, not listed on the public portfolio.
                </p>
              </div>
              {hiddenOpen && <div id="hidden-folders">{renderCards(hidden)}</div>}
            </section>
          )}

          <section>
            <h2 className="mb-4 text-lg font-medium">Projects ({visible.length})</h2>
            {renderCards(visible)}
          </section>
        </div>
      )}

      <UploadModal
        open={uploadOpen}
        folders={folders}
        initialFolder={uploadFolder}
        seedFiles={seedFiles}
        onClose={() => setUploadOpen(false)}
        onFolderCreated={(folder) => setFolders((current) => [...current, folder])}
        onUploaded={() => {
          void reload();
          router.refresh();
        }}
      />
    </div>
  );
}

export default function AdminFilesClient({ initialFolders }: { initialFolders: FolderData[] }) {
  return (
    <ToastProvider>
      <AdminFilesClientInner initialFolders={initialFolders} />
    </ToastProvider>
  );
}
