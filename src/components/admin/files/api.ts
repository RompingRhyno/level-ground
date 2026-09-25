"use client";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

/** JSON fetch that surfaces server error messages instead of silently failing. */
export async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && (payload.message || payload.error)) ||
      (typeof payload === "string" && payload) ||
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status, payload);
  }

  return payload as T;
}

export const filesApi = {
  folders: () => api<any[]>("/api/folders"),
  folderCards: () => api<import("./types").FolderData[]>("/api/folders"),
  assets: (query: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const suffix = params.toString() ? `?${params}` : "";
    return api<import("./types").AssetData[]>(`/api/assets${suffix}`);
  },
  storage: () => api<import("./types").StorageInfo>("/api/storage"),
  tags: () => api<import("./types").TagData[]>("/api/tags"),
  usage: (ids: string[]) =>
    api<{ usage: Record<string, string[]> }>("/api/assets/usage", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};
