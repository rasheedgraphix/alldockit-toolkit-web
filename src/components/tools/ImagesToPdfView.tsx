import React, { useState } from 'react';
import {
  FileImage,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  CheckCircle2,
  Settings2,
  Layers,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { BeforeAfterBadge } from '../BeforeAfterBadge';
import { formatBytes, downloadBlob, generateImageThumbnail } from '../../utils/fileHelpers';
import { convertImagesToPdf, ImagesToPdfOptions } from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { checkLicense } from '../../utils/license';
import { ProLimitModal } from '../ProLimitModal';
import { useAuth } from '../../contexts/AuthContext';

interface ImageFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  thumbnailUrl: string;
  width: number;
  height: number;
}

interface ImagesToPdfViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const ImagesToPdfView: React.FC<ImagesToPdfViewProps> = ({ onAddToHistory }) => {
  const {
    user,
    isTrialActive,
    trialDaysLeft,
    verifyAccessBeforeAction,
    openUpgradeModal,
    guestUsage,
  } = useAuth();
  const [images, setImages] = useState<ImageFileItem[]>([]);
  const [outputName, setOutputName] = useState('images_collection.pdf');
  const [options, setOptions] = useState<ImagesToPdfOptions>({
    pageSize: 'fit',
    orientation: 'auto',
    margin: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    totalOriginalSize: number;
    pdfSize: number;
    pageCount: number;
  } | null>(null);
  const [showProModal, setShowProModal] = useState(false);

  const handleFilesSelected = async (newFiles: File[]) => {
    const loaded: ImageFileItem[] = [];
    for (const f of newFiles) {
      const thumb = await generateImageThumbnail(f);
      loaded.push({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        name: f.name,
        size: f.size,
        thumbnailUrl: thumb.url,
        width: thumb.width,
        height: thumb.height,
      });
    }
    setImages((prev) => [...prev, ...loaded]);
    setResult(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const arr = [...prev];
      const temp = arr[index];
      arr[index] = arr[index - 1];
      arr[index - 1] = temp;
      return arr;
    });
  };

  const moveDown = (index: number) => {
    if (index === images.length - 1) return;
    setImages((prev) => {
      const arr = [...prev];
      const temp = arr[index];
      arr[index] = arr[index + 1];
      arr[index + 1] = temp;
      return arr;
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleConvert = async () => {
    if (images.length === 0) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    if (!checkLicense().isPro && images.length > 3) {
      setShowProModal(true);
      return;
    }
    setIsProcessing(true);
    setProgress(10);
    setStatusText('Compiling images into PDF document...');

    try {
      const rawFiles = images.map((i) => i.file);
      const totalOriginalSize = images.reduce((acc, i) => acc + i.size, 0);

      const { blob, pageCount } = await convertImagesToPdf(rawFiles, options, (p, text) => {
        setProgress(p);
        setStatusText(text);
      });

      const finalName = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`;

      setResult({
        blob,
        fileName: finalName,
        totalOriginalSize,
        pdfSize: blob.size,
        pageCount,
      });

      onAddToHistory({
        toolId: 'images-to-pdf',
        toolName: 'Images to PDF',
        originalName: `${images.length} images (${images.map((i) => i.name).slice(0, 2).join(', ')}${images.length > 2 ? '...' : ''})`,
        resultName: finalName,
        originalSize: totalOriginalSize,
        resultSize: blob.size,
        savedBytes: Math.max(0, totalOriginalSize - blob.size),
        resultBlob: blob,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to convert images to PDF';
      alert(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            Convert Images to PDF
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Combine JPG, PNG, and WEBP photos into a polished PDF with customizable page formats and margins.
          </p>
        </div>

        {user ? (
          isTrialActive && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold self-start sm:self-auto">
              <span>Trial: {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left</span>
            </div>
          )
        ) : guestUsage === 0 ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto">
            <span>1 Free Guest Conversion</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openUpgradeModal('guest_limit')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-colors cursor-pointer self-start sm:self-auto animate-pulse"
          >
            <span>Free Limit Reached · Start 7-Day Trial</span>
          </button>
        )}
      </div>

      <DropZone
        onFilesSelected={handleFilesSelected}
        acceptedFormats={['.jpg', '.jpeg', '.png', '.webp']}
        title="Drop images here (JPG, PNG, WEBP)"
        subtitle="Reorder images as pages before generating your PDF"
        hint="Supports high-resolution camera and scan uploads"
      />

      {images.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Selected Images ({images.length})
            </h3>
            <button
              onClick={() => setImages([])}
              className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              Clear All
            </button>
          </div>

          {/* Grid of uploaded images with thumbnails */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div
                key={img.id}
                className="group relative p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between"
              >
                <div className="relative aspect-video rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 mb-2">
                  {img.thumbnailUrl ? (
                    <img
                      src={img.thumbnailUrl}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileImage className="w-6 h-6 text-stone-400" />
                    </div>
                  )}
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/70 text-white">
                    #{idx + 1}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-medium text-stone-900 dark:text-stone-100 truncate">
                    {img.name}
                  </p>
                  <p className="text-[10px] text-stone-500 font-mono">
                    {img.width > 0 && `${img.width}x${img.height} · `}
                    {formatBytes(img.size)}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800 mt-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      title="Move Left/Up"
                      className="p-1 rounded text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === images.length - 1}
                      title="Move Right/Down"
                      className="p-1 rounded text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeImage(img.id)}
                    title="Remove"
                    className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Options Panel */}
          <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
              <Settings2 className="w-4 h-4" />
              <span>Page Layout Settings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Page Size */}
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Page Dimensions
                </label>
                <select
                  value={options.pageSize}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      pageSize: e.target.value as ImagesToPdfOptions['pageSize'],
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none"
                >
                  <option value="fit">Fit to Image Size (Full Bleed)</option>
                  <option value="a4">Standard A4 Sheet</option>
                  <option value="letter">US Letter Sheet</option>
                </select>
              </div>

              {/* Orientation */}
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Page Orientation
                </label>
                <select
                  value={options.orientation}
                  disabled={options.pageSize === 'fit'}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      orientation: e.target.value as ImagesToPdfOptions['orientation'],
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none disabled:opacity-50"
                >
                  <option value="auto">Auto (Match Image)</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              {/* Margins */}
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Margins
                </label>
                <select
                  value={options.margin}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      margin: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none"
                >
                  <option value={0}>No Margin (0 pt)</option>
                  <option value={18}>Narrow (18 pt / ~6mm)</option>
                  <option value={36}>Standard (36 pt / ~12mm)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Output File Name
              </label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="images_collection.pdf"
                className="w-full sm:w-80 px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                id="convert-images-to-pdf-button"
                onClick={handleConvert}
                disabled={isProcessing || images.length === 0}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm cursor-pointer ${
                  !user && guestUsage >= 1
                    ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                    : 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? 'Generating PDF...'
                    : !user && guestUsage >= 1
                    ? 'Start Free Trial to Generate PDF'
                    : `Generate PDF (${images.length} Pages)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {result && (
        <div
          id="images-to-pdf-result-card"
          className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-bold">Images Successfully Converted to PDF!</h3>
            </div>
            <span className="text-xs font-medium text-stone-500">
              {result.pageCount} pages · {formatBytes(result.pdfSize)}
            </span>
          </div>

          <div className="pt-2">
            <button
              id="download-images-pdf-button"
              onClick={() => downloadBlob(result.blob, result.fileName)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download {result.fileName}</span>
            </button>
          </div>
        </div>
      )}

      {/* Pro License Limit Modal */}
      <ProLimitModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
      />
    </div>
  );
};
