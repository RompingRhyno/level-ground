"use client";
import React, { useEffect, useState } from "react";
import AdminFilesView from "./AdminFilesView";

export default function AdminFilesApp() {
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  async function loadFolders() {
    const res = await fetch(`/api/folders`);
    const data = await res.json();
    setFolders(data || []);
  }

  useEffect(()=>{ loadFolders(); }, []);

  async function moveAssets(assetIds: string[], folderSlug: string) {
    await Promise.all(assetIds.map(id => fetch(`/api/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: folderSlug }) })));
  }

  async function deleteAssets(assetIds: string[]) {
    await Promise.all(assetIds.map(id => fetch(`/api/assets/${id}`, { method: 'DELETE' })));
  }

  async function handleDrop(folderSlug: string, assetIds: string[]) {
    await moveAssets(assetIds, folderSlug);
    await loadFolders();
  }

  return (
    <div>
      <AdminFilesView initialFolder={selectedFolder} folders={folders} onMove={moveAssets} onDelete={deleteAssets} onRefreshFolders={loadFolders} />
    </div>
  );
}
