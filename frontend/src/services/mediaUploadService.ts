import { API_URL } from '../config/env';

export interface MediaUploadResult {
  mediaUrl: string;
  objectKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Upload a media file to MinIO via presigned URL.
 * 
 * Flow:
 * 1. Request presigned PUT URL from backend
 * 2. Upload file directly to MinIO using presigned URL
 * 3. Return the download URL and metadata
 */
export async function uploadMedia(
  token: string,
  file: {
    uri: string;
    fileName: string;
    type: string;  // MIME type
    fileSize?: number;
  }
): Promise<MediaUploadResult> {
  // 1. Get presigned URL from backend
  const presignedRes = await fetch(
    `${API_URL}/api/v1/files/presigned-url?fileName=${encodeURIComponent(file.fileName)}&contentType=${encodeURIComponent(file.type)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!presignedRes.ok) {
    throw new Error('Không thể tạo URL upload. Vui lòng thử lại.');
  }

  const { presignedUrl, downloadUrl, objectKey } = await presignedRes.json();

  // 2. Upload file to MinIO via presigned PUT URL
  const fileBlob = await fetch(file.uri);
  const blob = await fileBlob.blob();

  const uploadRes = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: blob,
  });

  if (!uploadRes.ok) {
    throw new Error('Upload file thất bại. Vui lòng thử lại.');
  }

  // 3. Return result
  return {
    mediaUrl: downloadUrl,
    objectKey,
    fileName: file.fileName,
    fileSize: file.fileSize || blob.size,
    mimeType: file.type,
  };
}

/**
 * Determine message type from MIME type.
 */
export function getMessageTypeFromMime(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}
