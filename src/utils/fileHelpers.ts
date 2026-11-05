import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';

/**
 * Format bytes into human readable format (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'MB'}`;
}

/**
 * Trigger immediate client-side file download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/**
 * Package multiple processed files into a single ZIP and download
 */
export async function createZipAndDownload(
  files: { name: string; blob: Blob }[],
  zipFilename: string
): Promise<void> {
  const zip = new JSZip();
  files.forEach((f) => {
    zip.file(f.name, f.blob);
  });
  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, zipFilename);
}

/**
 * Generate preview thumbnail and dimensions for images
 */
export async function generateImageThumbnail(
  file: File
): Promise<{ url: string; width: number; height: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({
          url: dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = () => {
        resolve({ url: dataUrl, width: 0, height: 0 });
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      resolve({ url: '', width: 0, height: 0 });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Extract PDF page count locally using pdf-lib
 */
export async function getPdfInfo(file: File): Promise<{ pageCount: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    return { pageCount: pdfDoc.getPageCount() };
  } catch (err) {
    console.error('Failed to load PDF info', err);
    return { pageCount: 1 };
  }
}

/**
 * Calculate saved percentage
 */
export function calculateSavedPercentage(original: number, result: number): number {
  if (original <= 0 || result >= original) return 0;
  return Math.round(((original - result) / original) * 100);
}

/**
 * Safely convert any image source (Blob URL, Data URL, standard URL) with optional rotation into a PNG Uint8Array.
 * Never throws atob InvalidCharacterError because it converts via HTMLCanvasElement and Blob ArrayBuffer.
 */
export async function imageSourceToPngBytes(
  sourceUrl: string,
  degrees: number = 0
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      const rot = ((degrees % 360) + 360) % 360;
      if (rot === 90 || rot === 270) {
        canvas.width = img.naturalHeight || img.height;
        canvas.height = img.naturalWidth || img.width;
      } else {
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
      }

      if (rot !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(img, -(img.naturalWidth || img.width) / 2, -(img.naturalHeight || img.height) / 2);
      } else {
        ctx.drawImage(img, 0, 0);
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to generate PNG blob from image'));
          return;
        }
        blob.arrayBuffer()
          .then((buffer) => resolve(new Uint8Array(buffer)))
          .catch(reject);
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load image for processing'));
    img.src = sourceUrl;
  });
}

