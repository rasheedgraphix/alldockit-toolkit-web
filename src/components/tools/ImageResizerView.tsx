import React, { useState } from 'react';
import {
  Maximize2,
  Download,
  CheckCircle2,
  FileArchive,
  Lock,
  Unlock,
  Percent,
  Sparkles,
  Zap,
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
  compressAndResizeImage,
  ImageResizeCompressOptions,
} from '../../utils/imageOperations';
import { HistoryItem } from '../../types';
import { checkLicense } from '../../utils/license';
import { ProLimitModal } from '../ProLimitModal';
import { useAuth } from '../../contexts/AuthContext';

interface ResizedResultItem {
  id: string;
  name: string;
  blob: Blob;
  originalSize: number;
  newSize: number;
  originalDimensions: { width: number; height: number };
  newDimensions: { width: number; height: number };
  previewUrl: string;
}

interface ImageResizerViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const ImageResizerView: React.FC<ImageResizerViewProps> = ({ onAddToHistory }) => {
  const {
    user,
    isTrialActive,
    trialDaysLeft,
    verifyAccessBeforeAction,
    openUpgradeModal,
    guestUsage,
  } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileDetails, setFileDetails] = useState<
    { file: File; width: number; height: number; thumbUrl: string }[]
  >([]);
  const [mode, setMode] = useState<'percentage' | 'dimensions'>('percentage');
  const [percentage, setPercentage] = useState(50);
  const [targetWidth, setTargetWidth] = useState<number>(1920);
  const [targetHeight, setTargetHeight] = useState<number>(1080);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [quality, setQuality] = useState(80);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [results, setResults] = useState<ResizedResultItem[]>([]);
  const [showProModal, setShowProModal] = useState(false);

  const handleFilesSelected = async (newFiles: File[]) => {
    const details: { file: File; width: number; height: number; thumbUrl: string }[] = [];
    for (const f of newFiles) {
      const thumb = await generateImageThumbnail(f);
      details.push({
        file: f,
        width: thumb.width,
        height: thumb.height,
        thumbUrl: thumb.url,
      });
    }

    if (details.length > 0 && details[0].width > 0) {
      setTargetWidth(Math.round(details[0].width * 0.5));
      setTargetHeight(Math.round(details[0].height * 0.5));
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setFileDetails((prev) => [...prev, ...details]);
    setResults([]);
  };

  const applyPresetPercentage = (pct: number, q: number) => {
    setMode('percentage');
    setPercentage(pct);
    setQuality(q);
  };

  const handleWidthChange = (val: number) => {
    setTargetWidth(val);
    if (maintainAspectRatio && fileDetails.length > 0 && fileDetails[0].width > 0) {
      const ratio = fileDetails[0].height / fileDetails[0].width;
      setTargetHeight(Math.round(val * ratio));
    }
  };

  const handleHeightChange = (val: number) => {
    setTargetHeight(val);
    if (maintainAspectRatio && fileDetails.length > 0 && fileDetails[0].height > 0) {
      const ratio = fileDetails[0].width / fileDetails[0].height;
      setTargetWidth(Math.round(val * ratio));
    }
  };

  const handleProcess = async () => {
    if (selectedFiles.length === 0) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    if (!checkLicense().isPro && selectedFiles.length > 3) {
      setShowProModal(true);
      return;
    }
    setIsProcessing(true);
    setProgress(5);
    setStatusText('Processing image optimization...');

    const processedList: ResizedResultItem[] = [];
    const total = selectedFiles.length;

    try {
      for (let i = 0; i < total; i++) {
        const file = selectedFiles[i];
        setStatusText(`Optimizing ${file.name} (${i + 1}/${total})...`);
        setProgress(Math.round(((i + 1) / total) * 90));

        const options: ImageResizeCompressOptions = {
          mode,
          percentage,
          targetWidth,
          targetHeight,
          maintainAspectRatio,
          quality: quality / 100,
        };

        const res = await compressAndResizeImage(file, options);
        const previewUrl = URL.createObjectURL(res.blob);

        processedList.push({
          id: Math.random().toString(36).substring(2, 9),
          name: res.fileName,
          blob: res.blob,
          originalSize: res.originalSize,
          newSize: res.newSize,
          originalDimensions: res.originalDimensions,
          newDimensions: res.newDimensions,
          previewUrl,
        });

        onAddToHistory({
          toolId: 'image-compressor',
          toolName: 'Image Compressor & Resizer',
          originalName: file.name,
          resultName: res.fileName,
          originalSize: res.originalSize,
          resultSize: res.newSize,
          savedBytes: Math.max(0, res.originalSize - res.newSize),
          resultBlob: res.blob,
        });
      }

      setResults(processedList);
      setProgress(100);
      setStatusText('Optimization complete!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error processing image';
      alert(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadAllZip = async () => {
    if (results.length === 0) return;
    await createZipAndDownload(
      results.map((r) => ({ name: r.name, blob: r.blob })),
      'optimized_images.zip'
    );
  };

  const totalOriginalBytes = results.reduce((acc, r) => acc + r.originalSize, 0);
  const totalNewBytes = results.reduce((acc, r) => acc + r.newSize, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            Image Compressor & Resizer
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Reduce image payload by up to 80-90% without visible loss of sharpness. Scale dimensions effortlessly.
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

      {/* Preset Compression Targets */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-semibold text-stone-500 flex items-center pr-1">
          Compression Presets:
        </span>
        <button
          onClick={() => applyPresetPercentage(75, 75)}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 font-medium"
        >
          <Sparkles className="w-3 h-3 text-emerald-500" />
          Balanced (-60% to -70%)
        </button>
        <button
          onClick={() => applyPresetPercentage(50, 70)}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 font-medium"
        >
          <Zap className="w-3 h-3 text-amber-500" />
          Maximum Reduction (-80% to -90%)
        </button>
        <button
          onClick={() => applyPresetPercentage(100, 65)}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 font-medium"
        >
          Maintain Dimensions Only (-50%)
        </button>
      </div>

      <DropZone
        onFilesSelected={handleFilesSelected}
        acceptedFormats={['.jpg', '.jpeg', '.png', '.webp']}
        title="Drop images here to compress & resize"
        subtitle="Batch resize photos or shrink file sizes dramatically"
      />

      {selectedFiles.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Queue ({selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'})
            </h3>
            <button
              onClick={() => {
                setSelectedFiles([]);
                setFileDetails([]);
                setResults([]);
              }}
              className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              Clear All
            </button>
          </div>

          {/* Configuration Box */}
          <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-5">
            {/* Mode switch */}
            <div className="flex gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
              <button
                type="button"
                onClick={() => setMode('percentage')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  mode === 'percentage'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                Scale by Percentage
              </button>
              <button
                type="button"
                onClick={() => setMode('dimensions')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  mode === 'dimensions'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Custom Resolution (Width x Height)
              </button>
            </div>

            {/* Percentage Controls */}
            {mode === 'percentage' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Resize Scale: {percentage}%
                  </label>
                  <div className="flex gap-1.5">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setPercentage(pct)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                          percentage === pct
                            ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                            : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  min={10}
                  max={150}
                  value={percentage}
                  onChange={(e) => setPercentage(parseInt(e.target.value, 10))}
                  className="w-full accent-stone-900 dark:accent-stone-100"
                />
              </div>
            )}

            {/* Dimensions Controls */}
            {mode === 'dimensions' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      value={targetWidth}
                      onChange={(e) => handleWidthChange(parseInt(e.target.value, 10) || 100)}
                      className="w-32 px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setMaintainAspectRatio(!maintainAspectRatio)}
                    title={maintainAspectRatio ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                    className={`p-2 rounded-xl border mt-5 transition-colors ${
                      maintainAspectRatio
                        ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                        : 'bg-white dark:bg-stone-800 text-stone-500'
                    }`}
                  >
                    {maintainAspectRatio ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Unlock className="w-4 h-4" />
                    )}
                  </button>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      value={targetHeight}
                      onChange={(e) => handleHeightChange(parseInt(e.target.value, 10) || 100)}
                      className="w-32 px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Compression Quality */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Compression Encoding Quality: {quality}%
                </label>
                <span className="text-[10px] text-stone-400">
                  {quality < 70 ? 'High Compression' : quality > 85 ? 'High Quality' : 'Balanced'}
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={98}
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                className="w-full accent-stone-900 dark:accent-stone-100"
              />
            </div>

            <div className="pt-2">
              <button
                id="execute-resize-compress-button"
                onClick={handleProcess}
                disabled={isProcessing || selectedFiles.length === 0}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm cursor-pointer ${
                  !user && guestUsage >= 1
                    ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                    : 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90'
                }`}
              >
                <Maximize2 className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? 'Compressing...'
                    : !user && guestUsage >= 1
                    ? 'Start Free Trial to Resize'
                    : `Compress & Resize ${selectedFiles.length} Images`}
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
          id="resize-results-container"
          className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-bold">Optimization Complete!</h3>
            </div>

            {results.length > 1 && (
              <button
                id="download-resized-zip-button"
                onClick={handleDownloadAllZip}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-xs font-bold hover:opacity-90 shadow-sm"
              >
                <FileArchive className="w-3.5 h-3.5" />
                Download All (ZIP)
              </button>
            )}
          </div>

          <BeforeAfterBadge
            originalSize={totalOriginalBytes}
            newSize={totalNewBytes}
          />

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {results.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 text-xs"
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
                    <p className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-stone-500 font-mono">
                      {item.originalDimensions.width}x{item.originalDimensions.height} →{' '}
                      {item.newDimensions.width}x{item.newDimensions.height}
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold shrink-0 shadow-sm"
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
