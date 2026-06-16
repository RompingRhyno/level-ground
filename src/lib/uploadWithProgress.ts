export type UploadItem = {
  id: string;
  file: File;
  preview?: string;
  progress: number;
  status: "converting" | "idle" | "uploading" | "done" | "error";
  convertingLabel?: string;
  error?: string;
  key?: string;
  publicUrl?: string;
};

export function uploadWithProgress(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress: (p: number) => void,
  extraHeaders?: Record<string, string>,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", contentType);
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        xhr.setRequestHeader(k, v);
      }
    }
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
