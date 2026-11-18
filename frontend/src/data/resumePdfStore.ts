export interface StoredResumePdf {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  updatedAt: string;
}

const DB_NAME = 'bishal_portfolio_files_db';
const STORE_NAME = 'files';
const RESUME_KEY = 'resume_pdf';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function saveResumePdfFile(file: File): Promise<StoredResumePdf> {
  const db = await openDb();
  const record: StoredResumePdf = {
    blob: file.slice(0, file.size, 'application/pdf'),
    fileName: file.name,
    sizeBytes: file.size,
    updatedAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record, RESUME_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to store PDF'));
  });
  db.close();
  window.dispatchEvent(new CustomEvent('portfolio-resume-updated'));
  return record;
}

export async function loadResumePdfFile(): Promise<StoredResumePdf | null> {
  try {
    const db = await openDb();
    const record = await new Promise<StoredResumePdf | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(RESUME_KEY);
      req.onsuccess = () => resolve((req.result as StoredResumePdf | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return record;
  } catch {
    return null;
  }
}

export async function clearResumePdfFile(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(RESUME_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    window.dispatchEvent(new CustomEvent('portfolio-resume-updated'));
  } catch {
    // ignore
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
