export type TargetImageFormat = 'jpg' | 'png' | 'webp';

export interface ImageConversionOptions {
  targetFormat: TargetImageFormat;
  quality: number; // 0.1 to 1.0 (10% to 100%)
  backgroundColor?: string; // For JPG when converting from transparent PNG/WEBP (default '#FFFFFF')
}

export interface ImageResizeCompressOptions {
  mode: 'percentage' | 'dimensions' | 'compress-only';
  percentage?: number; // e.g. 50 (for 50%)
  targetWidth?: number;
  targetHeight?: number;
  maintainAspectRatio: boolean;
  quality: number; // 0.1 to 1.0
  targetFormat?: TargetImageFormat | 'original';
}

/**
 * Load an image file into an HTMLImageElement
 */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // If it's HEIC or atypical format, check if browser supports it or try object URL
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          `Unable to decode "${file.name}". Please ensure it is a valid image (PNG, JPG, WEBP, or standard format).`
        )
      );
    };

    img.src = objectUrl;
  });
}

/**
 * Detect the image format from filename extension
 */
export function getImageFormat(fileName: string): 'jpg' | 'png' | 'webp' | 'heic' | 'other' {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'png') return 'png';
  if (ext === 'webp') return 'webp';
  if (ext === 'heic' || ext === 'heif') return 'heic';
  return 'other';
}

/**
 * Check if the file is already in the target format
 */
export function isSameFormat(file: File, targetFormat: TargetImageFormat): boolean {
  const current = getImageFormat(file.name);
  return current === targetFormat;
}

/**
 * Convert an image file to a new target format (PNG, JPG, WEBP) with quality & background fill
 */
export async function convertSingleImage(
  file: File,
  options: ImageConversionOptions
): Promise<{ blob: Blob; fileName: string; originalSize: number; newSize: number }> {
  // Prevent converting to same format
  if (isSameFormat(file, options.targetFormat)) {
    throw new Error(`Already in ${options.targetFormat.toUpperCase()} format`);
  }

  const img = await loadImageFromFile(file);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D rendering context not available');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // If converting to JPG, transparency will turn black unless filled with background color
  if (options.targetFormat === 'jpg') {
    ctx.fillStyle = options.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw image
  ctx.drawImage(img, 0, 0);

  const mimeMap: Record<TargetImageFormat, string> = {
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };

  const targetMime = mimeMap[options.targetFormat];
  const quality = options.targetFormat === 'png' ? undefined : options.quality;

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to encode image to target format'));
      },
      targetMime,
      quality
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const newFileName = `${baseName}.${options.targetFormat}`;

  return {
    blob,
    fileName: newFileName,
    originalSize: file.size,
    newSize: blob.size,
  };
}

/**
 * Compress and/or Resize an image with custom dimensions or percentage reduction
 */
export async function compressAndResizeImage(
  file: File,
  options: ImageResizeCompressOptions
): Promise<{
  blob: Blob;
  fileName: string;
  originalSize: number;
  newSize: number;
  originalDimensions: { width: number; height: number };
  newDimensions: { width: number; height: number };
}> {
  const img = await loadImageFromFile(file);
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;

  let targetW = origW;
  let targetH = origH;

  if (options.mode === 'percentage') {
    const scale = Math.max(0.05, Math.min(2.0, (options.percentage || 100) / 100));
    targetW = Math.round(origW * scale);
    targetH = Math.round(origH * scale);
  } else if (options.mode === 'dimensions') {
    const desiredW = options.targetWidth || origW;
    const desiredH = options.targetHeight || origH;

    if (options.maintainAspectRatio) {
      const ratio = origW / origH;
      if (desiredW / desiredH > ratio) {
        targetH = desiredH;
        targetW = Math.round(desiredH * ratio);
      } else {
        targetW = desiredW;
        targetH = Math.round(desiredW / ratio);
      }
    } else {
      targetW = desiredW;
      targetH = desiredH;
    }
  }

  // Ensure minimum dimensions
  targetW = Math.max(1, targetW);
  targetH = Math.max(1, targetH);

  // High quality canvas scaling
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D rendering context not available');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Determine output format
  let targetFormat = options.targetFormat || 'original';
  let mimeType = 'image/jpeg';
  let ext = 'jpg';

  if (targetFormat === 'original') {
    if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
      mimeType = 'image/png';
      ext = 'png';
    } else if (file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp')) {
      mimeType = 'image/webp';
      ext = 'webp';
    } else {
      mimeType = 'image/jpeg';
      ext = 'jpg';
    }
  } else {
    const formatMap: Record<TargetImageFormat, { mime: string; ext: string }> = {
      jpg: { mime: 'image/jpeg', ext: 'jpg' },
      png: { mime: 'image/png', ext: 'png' },
      webp: { mime: 'image/webp', ext: 'webp' },
    };
    mimeType = formatMap[targetFormat].mime;
    ext = formatMap[targetFormat].ext;
  }

  // If output is JPG and source may be transparent, fill background with white
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
  }

  // Step-down resizing for very large downscales to avoid aliasing artifacts
  if (origW / targetW > 2 || origH / targetH > 2) {
    let currentCanvas = document.createElement('canvas');
    currentCanvas.width = origW;
    currentCanvas.height = origH;
    let currentCtx = currentCanvas.getContext('2d')!;
    currentCtx.drawImage(img, 0, 0);

    let curW = origW;
    let curH = origH;

    while (curW / 2 > targetW && curH / 2 > targetH) {
      curW = Math.round(curW / 2);
      curH = Math.round(curH / 2);
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = curW;
      stepCanvas.height = curH;
      const stepCtx = stepCanvas.getContext('2d')!;
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.drawImage(currentCanvas, 0, 0, curW, curH);
      currentCanvas = stepCanvas;
    }

    ctx.drawImage(currentCanvas, 0, 0, targetW, targetH);
  } else {
    ctx.drawImage(img, 0, 0, targetW, targetH);
  }

  const quality = mimeType === 'image/png' ? undefined : options.quality;

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to encode resized image'));
      },
      mimeType,
      quality
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const fileName = `${baseName}_optimized.${ext}`;

  return {
    blob,
    fileName,
    originalSize: file.size,
    newSize: blob.size,
    originalDimensions: { width: origW, height: origH },
    newDimensions: { width: targetW, height: targetH },
  };
}
