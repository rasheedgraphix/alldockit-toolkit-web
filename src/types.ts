export type ToolId =
  | 'pdf-merger'
  | 'pdf-splitter'
  | 'pdf-organizer'
  | 'pdf-to-images'
  | 'pdf-watermark'
  | 'pdf-compressor'
  | 'pdf-protect'
  | 'pdf-unlock'
  | 'pdf-crop'
  | 'pdf-nup'
  | 'pdf-redact'
  | 'pdf-resizer'
  | 'photo-collage'
  | 'speech-to-text'
  | 'certificate-editor'
  | 'html-to-pdf'
  | 'pdf-to-html'
  | 'images-to-pdf'
  | 'image-converter'
  | 'image-compressor'
  | 'pdf-signature'
  | 'ocr-extractor'
  | 'id-card-merge'
  | 'passport-photo'
  | 'barcode-studio'
  | 'code-scanner'
  | 'exif-cleaner'
  | 'cam-scanner'
  | 'bg-remover'
  | 'batch-renamer'
  | 'invoice-maker'
  | 'text-to-speech'
  | 'qr-studio'
  | 'pdf-booklet'
  | 'business-card-sheet'
  | 'pdf-grayscale'
  | 'pdf-flatten'
  | 'batch-watermark'
  | 'pdf-to-word'
  | 'word-to-pdf'
  | 'pdf-to-excel'
  | 'excel-to-pdf'
  | 'pdf-to-ppt'
  | 'ppt-to-pdf'
  | 'pdf-repair'
  | 'pdf-compare'
  | 'pdf-to-pdfa'
  | 'pdf-bates'
  | 'pdf-extract-images'
  | 'pdf-bg-color'
  | 'image-stitcher'
  | 'poster-tile'
  | 'pdf-metadata'
  | 'bulk-cropper'
  | 'id-card-maker'
  | 'history'
  | 'settings'
  | 'our-apps';

export type ToolCategory = 'pdf' | 'image' | 'utility' | 'system';

export interface ToolMeta {
  id: ToolId;
  name: string;
  category: ToolCategory;
  description: string;
  badge?: string;
  acceptedFormats: string[];
}

export interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  thumbnailUrl?: string;
  pageCount?: number;
  dimensions?: { width: number; height: number };
  status: 'idle' | 'processing' | 'done' | 'error';
  errorMessage?: string;
  resultBlob?: Blob;
  resultName?: string;
  resultSize?: number;
}

export interface HistoryItem {
  id: string;
  toolId: ToolId;
  toolName: string;
  originalName: string;
  resultName: string;
  originalSize: number;
  resultSize: number;
  savedBytes: number;
  timestamp: number;
  resultBlob?: Blob;
  downloadUrl?: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  defaultImageQuality: number;
  defaultPdfCompression: 'low' | 'medium' | 'high';
  preserveTransparency: boolean;
  autoDownloadAfterProcess: boolean;
  historyLimit: number;
}
