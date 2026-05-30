const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bt_token");
}

/**
 * Upload multiple files to the server.
 * @param files  FileList from an <input type="file"> element
 * @param folder Subfolder name: dpr | attendance | materials | expenses | general
 * @returns Array of absolute URLs to the uploaded files
 */
export async function uploadFiles(files: FileList, folder: string): Promise<string[]> {
  const token = getToken();
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }

  const res = await fetch(`${BASE_URL}/upload?folder=${encodeURIComponent(folder)}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Do NOT set Content-Type — browser sets it with the correct boundary for multipart/form-data
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Upload failed");

  return (data.files as { url: string }[]).map((f) => f.url);
}

/**
 * Upload a single file to the server.
 * @returns URL string
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/upload/single?folder=${encodeURIComponent(folder)}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Upload failed");

  return data.file.url as string;
}
