import React, { useState } from 'react';
import {
  RefreshCw,
  Download,
  CheckCircle2,
  FileArchive,
  Trash2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { BeforeAfterBadge } from '../BeforeAfterBadge';
import {
  formatBytes,
  downloadBlob,
  createZipAndDownload,
  generateImageThumbnail,
} from '../../utils/fileHelpers';
import {
  convertSingleImage,
  TargetImageFormat,
  getImageFormat,
  isSameFormat,
} from '../../utils/imageOperations';
import { HistoryItem } from '../../types';
import { checkLicense } from '../../utils/license';
import { ProLimitModal } from '../ProLimitModal';
import { useAuth } from '../../contexts/AuthContext';

interface ConvertedResultItem {
  id: string;
  name: string;
  blob: Blob;
  originalSize: number;
  newSize: number;
  originalName: string;
  previewUrl: string;
}

interface ImageConverterViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const ImageConverterView: React.FC<ImageConverterViewProps> = ({ onAddToHistory }) => {
  const {
    user,
    isTrialActive,
    trialDaysLeft,
    verifyAccessBeforeAction,
    openLoginModal,
    openUpgradeModal,
    guestUsage,
  } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [targetFormat, setTargetFormat] = useState<TargetImageFormat>('webp');
  const [quality, setQuality] = useState(85); // 10 to 100%
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [results, setResults] = useState<ConvertedResultItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showProModal, setShowProModal] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 3500);
  };

  /**
   * Calculate available target formats based on selected files
   * - If source is JPG/JPEG -> return ['png', 'webp']
   * - If source is PNG -> return ['jpg', 'webp']
   * - If source is WEBP -> return ['jpg', 'png']
   * - If source is HEIC -> return ['jpg', 'png']
   * - If multiple files with mixed formats -> return ['jpg', 'png', 'webp']
   */
  const getAvailableFormatsForFiles = (files: File[]): TargetImageFormat[] => {
    if (files.length === 0) return ['jpg', 'png', 'webp'];

    const formats = new Set(files.map((f) => getImageFormat(f.name)));

    // If multiple files with mixed formats are selected -> return all
    if (formats.size > 1) {
      return ['jpg', 'png', 'webp'];
    }

    const source = getImageFormat(files[0].name);
    if (source === 'jpg') return ['png', 'webp'];
    if (source === 'png') return ['jpg', 'webp'];
    if (source === 'webp') return ['jpg', 'png'];
    if (source === 'heic') return ['jpg', 'png'];
    return ['jpg', 'png', 'webp'];
  };

  const getAvailableFormats = (): TargetImageFormat[] => {
    return getAvailableFormatsForFiles(selectedFiles);
  };

  const handleFilesSelected = async (newFiles: File[]) => {
    const updatedFiles = [...selectedFiles, ...newFiles];
    setSelectedFiles(updatedFiles);
    setResults([]);

    // Auto-select the first available format as default when file changes
    const available = getAvailableFormatsForFiles(updatedFiles);
    if (available.length > 0) {
      setTargetFormat(available[0]);
    }

    // Generate thumbnails
    for (const file of newFiles) {
      const thumb = await generateImageThumbnail(file);
      setThumbnails((prev) => ({ ...prev, [file.name + file.size]: thumb.url }));
    }
  };

  const removeFile = (index: number) => {
    const updated = selectedFiles.filter((_, idx) => idx !== index);
    setSelectedFiles(updated);
    if (updated.length > 0) {
      const available = getAvailableFormatsForFiles(updated);
      if (!available.includes(targetFormat)) {
        setTargetFormat(available[0]);
      }
    }
  };

  const setQuickPreset = (target: TargetImageFormat, q: number) => {
    setTargetFormat(target);
    setQuality(q);
  };

  // Determine the primary source format for preset highlighting
  const firstSourceFormat = selectedFiles.length > 0 ? getImageFormat(selectedFiles[0].name) : null;

  const isPresetActive = (sourceReq: string | null, targetReq: TargetImageFormat) => {
    if (sourceReq === null) {
      return targetFormat === targetReq;
    }
    return firstSourceFormat === sourceReq && targetFormat === targetReq;
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) return;

    // Freemium check: 1 free guest conversion -> 7-day free trial -> Upgrade screen
    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    if (!checkLicense().isPro && selectedFiles.length > 3) {
      setShowProModal(true);
      return;
    }
    setIsProcessing(true);
    setProgress(5);
    setStatusText('Starting batch conversion...');

    const processedList: ConvertedResultItem[] = [];
    const totalFiles = selectedFiles.length;
    let skippedCount = 0;

    try {
      for (let i = 0; i < totalFiles; i++) {
        const file = selectedFiles[i];

        // If source and target are same, skip that file and notify user
        if (isSameFormat(file, targetFormat)) {
          skippedCount++;
          continue;
        }

        setStatusText(`Converting ${file.name} (${i + 1}/${totalFiles})...`);
        setProgress(Math.round(((i + 1) / totalFiles) * 90));

        const res = await convertSingleImage(file, {
          targetFormat,
          quality: quality / 100,
          backgroundColor,
        });

        const previewUrl = URL.createObjectURL(res.blob);

        processedList.push({
          id: Math.random().toString(36).substring(2, 9),
          name: res.fileName,
          blob: res.blob,
          originalSize: res.originalSize,
          newSize: res.newSize,
          originalName: file.name,
          previewUrl,
        });

        onAddToHistory({
          toolId: 'image-converter',
          toolName: `Image Converter (${targetFormat.toUpperCase()})`,
          originalName: file.name,
          resultName: res.fileName,
          originalSize: res.originalSize,
          resultSize: res.newSize,
          savedBytes: Math.max(0, res.originalSize - res.newSize),
          resultBlob: res.blob,
        });
      }

      if (skippedCount > 0) {
        showToast(`Already in ${targetFormat.toUpperCase()} format`);
      }

      setResults(processedList);
      setProgress(100);
      setStatusText(
        processedList.length > 0
          ? 'All images converted successfully!'
          : `Skipped: file is already in ${targetFormat.toUpperCase()} format.`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error converting image';
      if (message.includes('Already in')) {
        showToast(message);
      } else {
        alert(message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadAllZip = async () => {
    if (results.length === 0) return;
    await createZipAndDownload(
      results.map((r) => ({ name: r.name, blob: r.blob })),
      `converted_images_${targetFormat}.zip`
    );
  };

  const totalOriginalBytes = results.reduce((acc, r) => acc + r.originalSize, 0);
  const totalNewBytes = results.reduce((acc, r) => acc + r.newSize, 0);
  const availableFormats = getAvailableFormats();

  return (
    <div className="space-y-6 max-w-4xl mx-auto relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="converter-toast"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-500 text-white shadow-xl text-xs font-bold transition-all animate-bounce"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            Universal Image Converter
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Convert between PNG, JPG, WEBP, and HEIC instantly. Transparency is preserved where supported.
          </p>
        </div>

        {user ? (
          isTrialActive && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold self-start sm:self-auto">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Trial: {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left</span>
            </div>
          )
        ) : guestUsage === 0 ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto">
            <Sparkles className="w-3.5 h-3.5" />
            <span>1 Free Guest Conversion</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openUpgradeModal('guest_limit')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-colors cursor-pointer self-start sm:self-auto animate-pulse"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Free Limit Reached · Start 7-Day Trial</span>
          </button>
        )}
      </div>

      {/* Quick Presets with active auto-highlighting */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-semibold text-stone-500 flex items-center pr-1">
          Presets:
        </span>
        <button
          onClick={() => setQuickPreset('jpg', 90)}
          className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
            isPresetActive('png', 'jpg')
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 border-stone-900 dark:border-stone-100 shadow-sm'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border-stone-200 dark:border-stone-700'
          }`}
        >
          PNG → JPG
        </button>
        <button
          onClick={() => setQuickPreset('png', 100)}
          className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
            isPresetActive('jpg', 'png')
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 border-stone-900 dark:border-stone-100 shadow-sm'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border-stone-200 dark:border-stone-700'
          }`}
        >
          JPG → PNG
        </button>
        <button
          onClick={() => setQuickPreset('webp', 85)}
          className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
            isPresetActive(null, 'webp')
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 border-stone-900 dark:border-stone-100 shadow-sm'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border-stone-200 dark:border-stone-700'
          }`}
        >
          Any → WEBP (Ultra Fast)
        </button>
        <button
          onClick={() => setQuickPreset('jpg', 92)}
          className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
            isPresetActive('heic', 'jpg')
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 border-stone-900 dark:border-stone-100 shadow-sm'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border-stone-200 dark:border-stone-700'
          }`}
        >
          HEIC → JPG (iPhone)
        </button>
      </div>

      <DropZone
        onFilesSelected={handleFilesSelected}
        acceptedFormats={['.jpg', '.jpeg', '.png', '.webp', '.heic', '.bmp']}
        title="Drop images here to convert"
        subtitle="Supports PNG, JPG, WEBP, HEIC, and BMP files"
        hint="Convert single images or batch convert dozens at once"
      />

      {/* Selected Files & Settings */}
      {selectedFiles.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Selected Files ({selectedFiles.length})
            </h3>
            <button
              onClick={() => {
                setSelectedFiles([]);
                setResults([]);
              }}
              className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              Clear All
            </button>
          </div>

          {/* Files List Preview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {selectedFiles.map((file, idx) => {
              const thumbUrl = thumbnails[file.name + file.size];
              return (
                <div
                  key={idx}
                  className="relative group p-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 mb-1.5 flex items-center justify-center">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-stone-400 font-mono">
                        {file.name.split('.').pop()?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-stone-900 dark:text-stone-100 truncate">
                    {file.name}
                  </p>
                  <p className="text-[10px] text-stone-500 font-mono">{formatBytes(file.size)}</p>
                  <button
                    onClick={() => removeFile(idx)}
                    title="Remove"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Settings Box */}
          <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Dynamic Target Formats */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Convert To Format
                </label>
                <div
                  className={`grid gap-2 ${
                    availableFormats.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                  }`}
                >
                  {availableFormats.map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setTargetFormat(fmt)}
                      className={`py-2 text-xs font-bold uppercase rounded-xl transition-all ${
                        targetFormat === fmt
                          ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:border-stone-400'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Quality ({quality}%)
                  </label>
                  {targetFormat === 'png' && (
                    <span className="text-[10px] text-stone-400">PNG is lossless</span>
                  )}
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={quality}
                  disabled={targetFormat === 'png'}
                  onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                  className="w-full accent-stone-900 dark:accent-stone-100 disabled:opacity-40"
                />
                <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                  <span>Small Size (50%)</span>
                  <span>Recommended (85%)</span>
                  <span>Maximum (100%)</span>
                </div>
              </div>

              {/* Background Color Fill for JPG */}
              {targetFormat === 'jpg' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    Background Color for Transparency
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-stone-300 dark:border-stone-700 cursor-pointer p-0.5 bg-white dark:bg-stone-800"
                    />
                    <span className="text-xs font-mono text-stone-700 dark:text-stone-300">
                      {backgroundColor.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBackgroundColor('#FFFFFF')}
                      className="px-2 py-1 text-[11px] rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                    >
                      White
                    </button>
                    <button
                      type="button"
                      onClick={() => setBackgroundColor('#000000')}
                      className="px-2 py-1 text-[11px] rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                    >
                      Black
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                id="convert-images-execute-button"
                onClick={handleConvert}
                disabled={isProcessing || selectedFiles.length === 0}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm cursor-pointer ${
                  !user && guestUsage >= 1
                    ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                    : 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>
                  {isProcessing
                    ? 'Converting...'
                    : !user && guestUsage >= 1
                    ? 'Start Free Trial to Convert'
                    : `Convert ${selectedFiles.length} Images to ${targetFormat.toUpperCase()}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {/* Results View */}
      {results.length > 0 && (
        <div
          id="conversion-results-container"
          className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-bold">
                {results.length} {results.length === 1 ? 'Image' : 'Images'} Converted!
              </h3>
            </div>

            {results.length > 1 && (
              <button
                id="download-converted-zip-button"
                onClick={handleDownloadAllZip}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-xs font-bold hover:opacity-90 shadow-sm"
              >
                <FileArchive className="w-3.5 h-3.5" />
                Download All (ZIP)
              </button>
            )}
          </div>

          {/* Aggregate comparison */}
          {results.length > 1 && (
            <BeforeAfterBadge
              originalSize={totalOriginalBytes}
              newSize={totalNewBytes}
            />
          )}

          {/* File results list */}
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {results.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-200 dark:bg-stone-700 shrink-0">
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {item.name}
                    </p>
                    <BeforeAfterBadge
                      originalSize={item.originalSize}
                      newSize={item.newSize}
                      compact
                    />
                  </div>
                </div>

                <button
                  onClick={() => downloadBlob(item.blob, item.name)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold shrink-0 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
            ))}
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
