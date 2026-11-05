import React, { useState } from 'react';
import {
  Crop,
  Download,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import JSZip from 'jszip';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface BulkCropperViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type AspectPreset = '1:1' | '16:9' | '4:5' | '3:4' | '9:16';

export const BulkCropperView: React.FC<BulkCropperViewProps> = ({ onAddToHistory }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [aspect, setAspect] = useState<AspectPreset>('1:1');
  const [anchor, setAnchor] = useState<'center' | 'top' | 'bottom'>('center');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    count: number;
    isZip: boolean;
  } | null>(null);

  const handleFilesSelected = (incoming: File[]) => {
    const valid = incoming.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(f.name));
    if (valid.length === 0) {
      setErrorMessage('Please select valid image files.');
      return;
    }
    setFiles((prev) => [...prev, ...valid]);
    setResult(null);
    setErrorMessage(null);
  };

  const getRatioNumber = (preset: AspectPreset) => {
    switch (preset) {
      case '1:1':
        return 1;
      case '16:9':
        return 16 / 9;
      case '4:5':
        return 4 / 5;
      case '3:4':
        return 3 / 4;
      case '9:16':
        return 9 / 16;
    }
  };

  const handleBatchCrop = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(10);
    setStatusText(`Cropping ${files.length} image(s) to ${aspect} aspect ratio...`);
    setErrorMessage(null);

    try {
      const targetRatio = getRatioNumber(aspect);
      const outputs: { name: string; blob: Blob }[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setStatusText(`Cropping ${i + 1} of ${files.length} (${f.name})...`);
        const url = URL.createObjectURL(f);

        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const el = new Image();
          el.onload = () => res(el);
          el.onerror = rej;
          el.src = url;
        });

        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        const srcRatio = srcW / srcH;

        let cropW = srcW;
        let cropH = srcH;

        if (srcRatio > targetRatio) {
          // Image is wider than target ratio
          cropW = Math.round(srcH * targetRatio);
        } else {
          // Image is taller than target ratio
          cropH = Math.round(srcW / targetRatio);
        }

        const cropX = Math.round((srcW - cropW) / 2);
        let cropY = Math.round((srcH - cropH) / 2);
        if (anchor === 'top') cropY = 0;
        if (anchor === 'bottom') cropY = srcH - cropH;

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');

        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        URL.revokeObjectURL(url);

        const mime = f.type || 'image/jpeg';
        const outBlob = await new Promise<Blob>((res) =>
          canvas.toBlob((b) => res(b || new Blob()), mime, 0.92)
        );

        const ext = f.name.includes('.') ? f.name.substring(f.name.lastIndexOf('.')) : '.jpg';
        const base = f.name.replace(/\.[^/.]+$/, '');
        outputs.push({
          name: `${base}_${aspect.replace(':', 'x')}${ext}`,
          blob: outBlob,
        });

        setProgress(Math.round(15 + ((i + 1) / files.length) * 75));
      }

      const isZip = outputs.length > 1;
      let finalBlob: Blob;
      let finalName: string;

      if (isZip) {
        const zip = new JSZip();
        outputs.forEach((o) => zip.file(o.name, o.blob));
        finalBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        finalName = `Bulk_Cropped_${aspect.replace(':', 'x')}_${outputs.length}_Photos.zip`;
      } else {
        finalBlob = outputs[0].blob;
        finalName = outputs[0].name;
      }

      const origTotal = files.reduce((acc, f) => acc + f.size, 0);

      setResult({
        blob: finalBlob,
        fileName: finalName,
        size: finalBlob.size,
        count: outputs.length,
        isZip,
      });

      onAddToHistory({
        toolId: 'bulk-cropper',
        toolName: `Bulk Aspect Ratio Cropper (${aspect})`,
        originalName: isZip ? `${files.length} Images` : files[0].name,
        resultName: finalName,
        originalSize: origTotal,
        resultSize: finalBlob.size,
        savedBytes: Math.max(0, origTotal - finalBlob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to crop images.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
            <Crop className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Bulk Image Aspect Ratio Cropper (1:1, 16:9, 4:5, 3:4)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Batch crop dozens of product photos, thumbnails, and portraits to exact ratios for Daraz, Amazon, YouTube, and Instagram.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        <div className="mt-6">
          <DropZone
            onFilesSelected={handleFilesSelected}
            acceptedFormats={['.png', '.jpg', '.jpeg', '.webp']}
            multiple={true}
            title="Drop multiple images here to bulk crop"
            subtitle="Supports PNG, JPG, and WebP photos"
          />
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-6">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {files.length} Image(s) Selected for Bulk Cropping
              </span>
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setResult(null);
                }}
                className="text-xs text-rose-600 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { id: '1:1', label: '1:1 Square', sub: 'Daraz / Amazon / IG' },
                { id: '16:9', label: '16:9 Widescreen', sub: 'YouTube Thumbnail' },
                { id: '4:5', label: '4:5 Portrait', sub: 'Instagram Feed' },
                { id: '3:4', label: '3:4 Official', sub: 'ID / Document Photo' },
                { id: '9:16', label: '9:16 Vertical', sub: 'Reels / Shorts / Story' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAspect(preset.id as AspectPreset)}
                  className={`p-3 rounded-xl border text-left transition ${
                    aspect === preset.id
                      ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/30 ring-2 ring-violet-500/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{preset.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{preset.sub}</div>
                </button>
              ))}
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Vertical Crop Anchor:
              </span>
              <select
                value={anchor}
                onChange={(e) => setAnchor(e.target.value as 'center' | 'top' | 'bottom')}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="center">Center Gravity (Default)</option>
                <option value="top">Top Aligned (Best for Headshots / Portraits)</option>
                <option value="bottom">Bottom Aligned</option>
              </select>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleBatchCrop}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Crop className="w-5 h-5" />
                {isProcessing
                  ? 'Cropping Batch...'
                  : `Crop ${files.length} Image(s) to ${aspect}`}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50">
                <ProgressBar progress={progress} statusText={statusText} />
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                        Cropped Batch Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.count} Images Cropped to {aspect} • {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    {result.isZip ? 'Download ZIP' : 'Download Image'}
                  </button>
                </div>

                <TaskSuccessCard
                  title="Bulk Aspect Ratio Crop Complete!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={files.reduce((acc, f) => acc + f.size, 0)}
                  infoBadge={`${result.count} Files (${aspect})`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
