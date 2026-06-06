/**
 * Storage provider abstraction.
 * Switch between Vercel Blob (dev) and Azure Blob (prod) via STORAGE_PROVIDER env var.
 * All callers use the generic interface — never touch provider-specific SDKs directly.
 */
import crypto from 'crypto'

export type UploadResult = {
  storageKey:  string   // provider-specific path/ID
  storageUrl:  string   // public CDN or presigned URL
  fileSizeBytes: number
  mimeType:    string
  fileName:    string
  fileHash:    string   // SHA-256 hex of the raw file bytes
}

export type StorageProviderType = 'VERCEL_BLOB' | 'AZURE_BLOB' | 'LOCAL'

function getProvider(): StorageProviderType {
  const p = process.env.STORAGE_PROVIDER ?? 'VERCEL_BLOB'
  if (p !== 'VERCEL_BLOB' && p !== 'AZURE_BLOB' && p !== 'LOCAL') return 'VERCEL_BLOB'
  return p
}

/** Compute SHA-256 of file bytes */
export function hashFile(bytes: Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

/** Upload a file — auto-routes to the configured storage provider. */
export async function uploadFile(
  fileName: string,
  mimeType: string,
  bytes:    Buffer,
  folder:   string = 'vault',
): Promise<UploadResult> {
  const provider = getProvider()
  const fileHash = hashFile(bytes)

  switch (provider) {
    case 'VERCEL_BLOB':
      return uploadToVercelBlob(fileName, mimeType, bytes, folder, fileHash)

    case 'AZURE_BLOB':
      return uploadToAzureBlob(fileName, mimeType, bytes, folder, fileHash)

    case 'LOCAL':
      return uploadToLocal(fileName, mimeType, bytes, folder, fileHash)
  }
}

/** Delete a file from storage by its storage key. */
export async function deleteFile(storageKey: string): Promise<void> {
  const provider = getProvider()
  switch (provider) {
    case 'VERCEL_BLOB':
      await deleteFromVercelBlob(storageKey)
      break
    case 'AZURE_BLOB':
      await deleteFromAzureBlob(storageKey)
      break
    case 'LOCAL':
      await deleteFromLocal(storageKey)
      break
  }
}

// ── Vercel Blob ────────────────────────────────────────────────────────────────

async function uploadToVercelBlob(
  fileName: string,
  mimeType: string,
  bytes:    Buffer,
  folder:   string,
  fileHash: string,
): Promise<UploadResult> {
  // Dynamic import so Vercel Blob SDK isn't bundled server-side when unused
  const { put } = await import('@vercel/blob')
  const pathname = `${folder}/${Date.now()}-${sanitizeFileName(fileName)}`
  const blob = await put(pathname, bytes, {
    access:      'public',
    contentType: mimeType,
  })
  return {
    storageKey:   blob.url,    // Vercel Blob uses URL as key
    storageUrl:   blob.url,
    fileSizeBytes: bytes.length,
    mimeType,
    fileName,
    fileHash,
  }
}

async function deleteFromVercelBlob(storageKey: string): Promise<void> {
  const { del } = await import('@vercel/blob')
  await del(storageKey)
}

// ── Azure Blob ─────────────────────────────────────────────────────────────────
// Stubs — wire up when Azure credentials are available

async function uploadToAzureBlob(
  fileName: string,
  mimeType: string,
  bytes:    Buffer,
  folder:   string,
  fileHash: string,
): Promise<UploadResult> {
  // TODO: Wire up @azure/storage-blob when AZURE_STORAGE_CONNECTION_STRING is set
  throw new Error('Azure Blob storage not yet configured. Set STORAGE_PROVIDER=VERCEL_BLOB for dev.')
}

async function deleteFromAzureBlob(storageKey: string): Promise<void> {
  throw new Error('Azure Blob storage not yet configured.')
}

// ── Local (dev/test only) ──────────────────────────────────────────────────────

async function uploadToLocal(
  fileName:  string,
  mimeType:  string,
  bytes:     Buffer,
  folder:    string,
  fileHash:  string,
): Promise<UploadResult> {
  const fs   = await import('fs/promises')
  const path = await import('path')
  const dir  = path.join(process.cwd(), 'public', 'uploads', folder)
  await fs.mkdir(dir, { recursive: true })
  const fname = `${Date.now()}-${sanitizeFileName(fileName)}`
  const fpath = path.join(dir, fname)
  await fs.writeFile(fpath, bytes)
  const storageKey = `/uploads/${folder}/${fname}`
  return {
    storageKey,
    storageUrl:   storageKey,
    fileSizeBytes: bytes.length,
    mimeType,
    fileName,
    fileHash,
  }
}

async function deleteFromLocal(storageKey: string): Promise<void> {
  const fs   = await import('fs/promises')
  const path = await import('path')
  await fs.unlink(path.join(process.cwd(), 'public', storageKey)).catch(() => {})
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
}
