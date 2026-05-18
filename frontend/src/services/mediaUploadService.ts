import { API_URL, HOST } from '../config/env';
import { Platform } from 'react-native';

export interface MediaUploadResult {
  mediaUrl: string;
  objectKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Upload file lên MinIO bằng XMLHttpRequest (tương thích React Native).
 * fetch().blob() KHÔNG hoạt động với content:// URI trên Android,
 * nên phải dùng XMLHttpRequest + FormData-like body.
 */
function uploadToPresignedUrl(
  presignedUrl: string,
  fileUri: string,
  contentType: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      console.log('[MediaUpload] PUT response status:', xhr.status);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            `Upload PUT thất bại (status ${xhr.status}): ${xhr.responseText}`,
          ),
        );
      }
    };

    xhr.onerror = () => {
      console.error('[MediaUpload] XHR error');
      reject(new Error('Lỗi mạng khi upload file'));
    };

    xhr.open('PUT', presignedUrl, true);
    xhr.setRequestHeader('Content-Type', contentType);

    // React Native trên Android: gửi file trực tiếp qua URI
    // XMLHttpRequest của RN hỗ trợ gửi object {uri, type, name} dưới dạng raw body
    if (Platform.OS === 'android') {
      // Trên Android, dùng Blob từ URI thông qua RN's native XMLHttpRequest
      const fileBody = {
        uri: fileUri,
        type: contentType,
        name: 'upload',
      };
      xhr.send(fileBody as any);
    } else {
      // iOS: fetch().blob() hoạt động bình thường
      fetch(fileUri)
        .then(res => res.blob())
        .then(blob => xhr.send(blob))
        .catch(reject);
    }
  });
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
    type: string; // MIME type
    fileSize?: number;
  },
): Promise<MediaUploadResult> {
  console.log('[MediaUpload] Starting upload for:', file.fileName, file.type);
  console.log('[MediaUpload] File URI:', file.uri);

  // 1. Get presigned URL from backend
  const presignedApiUrl = `${API_URL}/api/v1/files/presigned-url?fileName=${encodeURIComponent(file.fileName)}&contentType=${encodeURIComponent(file.type)}&clientHost=${HOST}`;
  console.log('[MediaUpload] Requesting presigned URL from:', presignedApiUrl);

  const presignedRes = await fetch(presignedApiUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!presignedRes.ok) {
    const errorText = await presignedRes.text().catch(() => 'unknown');
    console.error('[MediaUpload] Presigned URL failed:', presignedRes.status, errorText);
    throw new Error(`Không thể tạo URL upload (${presignedRes.status}). Vui lòng thử lại.`);
  }

  let { presignedUrl, downloadUrl, objectKey } = await presignedRes.json();
  console.log('[MediaUpload] Got presigned URL:', presignedUrl);
  console.log('[MediaUpload] Download URL:', downloadUrl);

  // 2. Upload file to MinIO via presigned PUT URL (dùng XHR thay vì fetch)
  await uploadToPresignedUrl(presignedUrl, file.uri, file.type);
  console.log('[MediaUpload] ✅ Upload successful!');

  // 3. Return result
  return {
    mediaUrl: downloadUrl,
    objectKey,
    fileName: file.fileName,
    fileSize: file.fileSize || 0,
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
