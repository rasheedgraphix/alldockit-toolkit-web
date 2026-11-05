import React, { useState } from 'react';
import {
  GalleryVerticalEnd,
  Download,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface ImageStitcherViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

interface StitchItem {
  id: string;
  file: File;
  url: string;
}

export const ImageStitcherView: React.FC<ImageStitcherViewProps> = ({ onAddToHistory }) => {
  const [items, setItems] = useState<StitchItem[]>([]);
  const [direction, setDirection] = useState<'vertical' | 'horizontal'>('vertical');
  const [outputFormat, setOutputFormat] = useState<'png' | 'jpg' | 'pdf'>('png');
  const [spacing, setSpacing] = useState<number>(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    dimensions: string;
    previewUrl?: string;
  } | null>(null);

  const handleFilesSelected = (files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(f.name));
    if (valid.length === 0) {
      setErrorMessage('Please select valid image files.');
      return;
    }
    const newItems = valid.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      url: URL.createObjectURL(f),
    }));
    setItems((prev) => [...prev, ...newItems]);
    setResult(null);
    setErrorMessage(null);
  };

  const moveItem = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    setItems(copy);
    setResult(null);
  };

  const handleStitch = async () => {
    if (items.length < 2) {
      setErrorMessage('Please upload at least 2 screenshots or images to stitch together.');
      return;
    }

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Loading images & calculating continuous canvas dimensions...');
    setErrorMessage(null);

    try {
      const loadedImgs = await Promise.all(
        items.map(
          (it) =>
            new Promise<HTMLImageElement>((res, rej) => {
              const el = new Image();
              el.onload = () => res(el);
              el.onerror = rej;
              el.src = it.url;
            })
        )
      );

      let canvasW = 0;
      let canvasH = 0;

      if (direction === 'vertical') {
        // Normalize all images to the width of the first image
        canvasW = Math.min(2000, Math.max(...loadedImgs.map((im) => im.naturalWidth || im.width)));
        for (const im of loadedImgs) {
          const scale = canvasW / (im.naturalWidth || im.width);
          canvasH += Math.round((im.naturalHeight || im.height) * scale);
        }
        canvasH += spacing * (loadedImgs.length - 1);
      } else {
        canvasH = Math.min(1600, Math.max(...loadedImgs.map((im) => im.naturalHeight || im.height)));
        for (const im of loadedImgs) {
          const scale = canvasH / (im.naturalHeight || im.height);
          canvasW += Math.round((im.naturalWidth || im.width) * scale);
        }
        canvasW += spacing * (loadedImgs.length - 1);
      }

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);

      let cursor = 0;
      for (let i = 0; i < loadedImgs.length; i++) {
        const im = loadedImgs[i];
        if (direction === 'vertical') {
          const scale = canvasW / (im.naturalWidth || im.width);
          const drawH = Math.round((im.naturalHeight || im.height) * scale);
          ctx.drawImage(im, 0, cursor, canvasW, drawH);
          cursor += drawH + spacing;
        } else {
          const scale = canvasH / (im.naturalHeight || im.height);
          const drawW = Math.round((im.naturalWidth || im.width) * scale);
          ctx.drawImage(im, cursor, 0, drawW, canvasH);
          cursor += drawW + spacing;
        }
        setProgress(Math.round(25 + ((i + 1) / loadedImgs.length) * 55));
      }

      setProgress(90);
      setStatusText(`Exporting continuous ${outputFormat.toUpperCase()}...`);

      let finalBlob: Blob;
      let fileName: string;
      let previewUrl: string | undefined;

      if (outputFormat === 'pdf') {
        const jpgUrl = canvas.toDataURL('image/jpeg', 0.92);
        const b64 = jpgUrl.split(',')[1];
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);

        const pdfDoc = await PDFDocument.create();
        const embImg = await pdfDoc.embedJpg(u8);
        const ptW = 595.28;
        const ptH = Math.round((canvasH / canvasW) * ptW);
        const page = pdfDoc.addPage([ptW, ptH]);
        page.drawImage(embImg, { x: 0, y: 0, width: ptW, height: ptH });

        const outBytes = await pdfDoc.save();
        finalBlob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
        fileName = `Stitched_Long_Document_${items.length}_Parts.pdf`;
        previewUrl = jpgUrl;
      } else {
        const mime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mime, 0.92);
        finalBlob = await (await fetch(dataUrl)).blob();
        fileName = `Stitched_Long_Image_${items.length}_Parts.${outputFormat}`;
        previewUrl = dataUrl;
      }

      const origTotal = items.reduce((acc, it) => acc + it.file.size, 0);

      setResult({
        blob: finalBlob,
        fileName,
        size: finalBlob.size,
        dimensions: `${canvasW} × ${canvasH} px`,
        previewUrl,
      });

      onAddToHistory({
        toolId: 'image-stitcher',
        toolName: 'Long Screenshot & Receipt Stitcher',
        originalName: `${items.length} Images`,
        resultName: fileName,
        originalSize: origTotal,
        resultSize: finalBlob.size,
        savedBytes: Math.max(0, origTotal - finalBlob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to stitch images.');
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
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <GalleryVerticalEnd className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Long Screenshot, Chat & Receipt Stitcher
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Merge multiple WhatsApp chat screenshots, bank receipts, or webpage captures into 1 continuous long image or single-page PDF.
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
            title="Drop 2 or more screenshots / receipts here"
            subtitle="Stitches vertically (top-to-bottom) or horizontally (left-to-right)"
          />
        </div>

        {items.length > 0 && (
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Stitch Order ({items.length} Images):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setItems([]);
                    setResult(null);
                  }}
                  className="text-xs text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                {items.map((it, idx) => (
                  <div
                    key={it.id}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <img src={it.url} alt="" className="w-10 h-10 object-cover rounded border" />
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {idx + 1}. {it.file.name}
                        </div>
                        <div className="text-[10px] text-slate-500">{formatBytes(it.file.size)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveItem(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(idx, 1)}
                        disabled={idx === items.length - 1}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Stitch Direction
                </label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as 'vertical' | 'horizontal')}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="vertical">Vertical (Top-to-Bottom Long Scroll)</option>
                  <option value="horizontal">Horizontal (Side-by-Side Panorama)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Output Format
                </label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as 'png' | 'jpg' | 'pdf')}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="png">Lossless Long PNG Image (.png)</option>
                  <option value="jpg">Compact Long JPEG Image (.jpg)</option>
                  <option value="pdf">Continuous Single-Page PDF (.pdf)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Gap Between Images (px)
                </label>
                <select
                  value={spacing}
                  onChange={(e) => setSpacing(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value={0}>0 px (Seamless Direct Stitch)</option>
                  <option value={8}>8 px White Divider</option>
                  <option value={20}>20 px Padded Divider</option>
                </select>
              </div>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleStitch}
                disabled={isProcessing || items.length < 2}
                className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <GalleryVerticalEnd className="w-5 h-5" />
                {isProcessing ? 'Stitching Images...' : `Stitch ${items.length} Images Together`}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
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
                        Stitched File Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Dimensions: {result.dimensions} • Size: {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>

                <TaskSuccessCard
                  title="Continuous Stitched File Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={items.reduce((acc, it) => acc + it.file.size, 0)}
                  infoBadge={result.dimensions}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
