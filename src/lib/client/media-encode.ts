"use client";

import type { FFmpeg as FFmpegType } from "@ffmpeg/ffmpeg";

/**
 * Client-side media preparation.
 *
 * Everything that reaches R2 must be browser-playable: HEIC photos are converted to JPEG, and
 * videos are re-encoded to H.264/AAC MP4. Videos are emitted twice — a 1280-wide (720p) and a
 * 1920-wide (1080p) rendition — plus a poster frame, so the player can pick a size from the
 * display box (`clientWidth × devicePixelRatio`) and show something before playback starts.
 *
 * ffmpeg core/wasm are fetched from unpkg at runtime; the JS wrapper is self-hosted under
 * /ffmpeg so it resolves same-origin (CSP-safe).
 */

const FFMPEG_LOCAL = "/ffmpeg/ffmpeg/index.js";
const UTIL_LOCAL = "/ffmpeg/util/index.js";
// eslint-disable-next-line no-new-func
const cdnImport = new Function("url", "return import(url)") as (url: string) => Promise<Record<string, unknown>>;

let ffmpegInstance: FFmpegType | null = null;

async function getFFmpeg(): Promise<FFmpegType> {
  const { FFmpeg } = (await cdnImport(FFMPEG_LOCAL)) as { FFmpeg: new () => FFmpegType };
  const { toBlobURL } = (await cdnImport(UTIL_LOCAL)) as {
    toBlobURL: (url: string, type: string) => Promise<string>;
  };
  if (!ffmpegInstance) ffmpegInstance = new FFmpeg();
  if (!ffmpegInstance.loaded) {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
  }
  return ffmpegInstance;
}

const WEB_SAFE = /\.(webm|ogv|ogg)$/i;

export type EncodedRendition = {
  blob: Blob;
  name: string;
  role: "primary" | "720p" | "poster";
  width?: number;
  height?: number;
  mime: string;
};

export type PreparedMedia = {
  /** Files to upload, in order. First entry is the registered asset. */
  files: EncodedRendition[];
  /** Extra asset metadata (variant + poster URLs are filled in after upload). */
  meta: Record<string, unknown>;
  previewUrl?: string;
};

function renameTo(filename: string, suffix: string, ext: string): string {
  const base = filename.replace(/\.[^.]+$/, "").slice(0, 80);
  return `${base}${suffix}.${ext}`;
}

async function readVideoSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  if (typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const size = { width: video.videoWidth, height: video.videoHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

/** Convert HEIC/HEIF photos to JPEG (no-op for everything else). */
export async function convertIfHeic(file: File): Promise<File> {
  const isHeic = file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic) return file;
  try {
    const heic2any = (await import("heic2any")).default;
    const blob = (await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 })) as Blob;
    return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
  } catch (err) {
    console.warn("[media] HEIC conversion failed, keeping original", err);
    return file;
  }
}

/**
 * Re-encode a video to web-safe renditions + poster.
 * Falls back to the original file (with a warning) when the WASM core cannot be loaded.
 */
export async function prepareVideo(
  file: File,
  onProgress: (percent: number) => void,
  onLabel: (label: string) => void,
): Promise<PreparedMedia> {
  if (!file.type.startsWith("video/")) {
    return { files: [{ blob: file, name: file.name, role: "primary", mime: file.type }], meta: {} };
  }

  // Already web-safe containers (VP8/VP9): upload as-is, no renditions.
  if (WEB_SAFE.test(file.name) || file.type === "video/webm" || file.type === "video/ogg") {
    return {
      files: [{ blob: file, name: file.name, role: "primary", mime: file.type }],
      meta: {},
      previewUrl: undefined,
    };
  }

  try {
    onLabel("Loading encoder…");
    const ffmpeg = await getFFmpeg();
    const { fetchFile } = (await cdnImport(UTIL_LOCAL)) as { fetchFile: (data: Blob) => Promise<Uint8Array> };

    const ext = (file.name.match(/\.[^.]+$/) || [".mp4"])[0];
    const inputName = `input${ext}`;
    const out720 = renameTo(file.name, "-720p", "mp4");
    const out1080 = renameTo(file.name, "-1080p", "mp4");
    const posterName = renameTo(file.name, "-poster", "jpg");

    onLabel("Reading file…");
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const progressHandler = ({ progress }: { progress: number }) => {
      // ffmpeg reports progress across all outputs; cap at 99 until the write completes.
      onProgress(Math.min(99, Math.round(progress * 100)));
    };
    ffmpeg.on("progress", progressHandler);

    // One decode, two renditions (720p first so the primary upload can start sooner) + poster.
    // `-map 0:a?` keeps audio when present and silently skips it otherwise.
    const common = ["-c:v", "libx264", "-crf", "28", "-preset", "medium", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart"];
    await ffmpeg.exec([
      "-i", inputName,
      "-map", "0:v", "-map", "0:a?", "-vf", "scale='min(1280,iw)':-2", ...common, out720,
      "-map", "0:v", "-map", "0:a?", "-vf", "scale='min(1920,iw)':-2", ...common, out1080,
    ]);

    onLabel("Capturing poster…");
    await ffmpeg.exec([
      "-ss", "1", "-i", inputName, "-frames:v", "1",
      "-vf", "scale='min(1280,iw)':-2", "-q:v", "4", posterName,
    ]);

    ffmpeg.off("progress", progressHandler);

    onLabel("Finishing…");
    const read = async (name: string): Promise<Uint8Array> => {
      const data = await ffmpeg.readFile(name);
      return typeof data === "string" ? new TextEncoder().encode(data) : data;
    };

    const bytes720 = await read(out720);
    const bytes1080 = await read(out1080);
    const bytesPoster = await read(posterName);
    for (const name of [inputName, out720, out1080, posterName]) {
      await ffmpeg.deleteFile(name).catch(() => {});
    }

    const blob720 = new Blob([bytes720 as BlobPart], { type: "video/mp4" });
    const blob1080 = new Blob([bytes1080 as BlobPart], { type: "video/mp4" });
    const blobPoster = new Blob([bytesPoster as BlobPart], { type: "image/jpeg" });
    const size = await readVideoSize(blob1080);

    onProgress(100);

    return {
      files: [
        { blob: blob1080, name: out1080, role: "primary", mime: "video/mp4", width: size?.width, height: size?.height },
        { blob: blob720, name: out720, role: "720p", mime: "video/mp4" },
        { blob: blobPoster, name: posterName, role: "poster", mime: "image/jpeg" },
      ],
      meta: {
        variants: { "1080p": null, "720p": null },
        poster: null,
        width: size?.width ?? null,
        height: size?.height ?? null,
        variantsPending: true,
      },
      previewUrl: URL.createObjectURL(blobPoster),
    };
  } catch (err) {
    console.warn("[media] transcode failed, uploading original file", err);
    return {
      files: [{ blob: file, name: file.name, role: "primary", mime: file.type }],
      meta: { transcodeFailed: true },
    };
  }
}

/** Prepare any file for upload: photos pass through (HEIC converted), videos are encoded. */
export async function prepareMedia(
  file: File,
  onProgress: (percent: number) => void,
  onLabel: (label: string) => void,
): Promise<PreparedMedia> {
  const image = await convertIfHeic(file);
  if (image.type.startsWith("image/")) {
    const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const url = URL.createObjectURL(image);
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
    return {
      files: [{ blob: image, name: image.name, role: "primary", mime: image.type, width: size?.width, height: size?.height }],
      meta: { width: size?.width ?? null, height: size?.height ?? null },
      previewUrl: URL.createObjectURL(image),
    };
  }
  return prepareVideo(image, onProgress, onLabel);
}
