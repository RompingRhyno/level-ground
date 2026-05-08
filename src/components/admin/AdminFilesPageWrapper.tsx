"use client";
import React, { useState } from "react";
import FileUploader from "./FileUploader";
import AdminFilesApp from "./AdminFilesApp";

export default function AdminFilesPageWrapper() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', backgroundColor: 'var(--color-bg-secondary)', padding: '1rem 0' }}>
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-lg font-medium pb-4">Upload</h2>
          <div className="mt-2">
            <FileUploader onUploadComplete={() => setRefreshKey((k) => k + 1)} />
          </div>
        </div>
      </div>

      <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '1rem 0' }}>
        <div className="max-w-7xl mx-auto px-4">
          <AdminFilesApp refreshKey={refreshKey} />
        </div>
      </div>
    </>
  );
}
