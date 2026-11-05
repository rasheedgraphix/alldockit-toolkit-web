import React, { useState, useRef, useEffect } from 'react';
import {
  Columns2,
  Image as ImageIcon,
  Download,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface PhotoCollageViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type CollagePreset = 'before-after' | '2-horizontal' | '2-vertical' | '2x2-grid' | '3x2-grid';
type AspectRatio = '1:1' | '16:9' | '4:3' | '9:16' | 'a4';

interface UploadedPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

export const PhotoCollageView: React.FC<PhotoCollageViewProps> = ({ onAddToHistory }) => {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [preset, setPreset] = useState<CollagePreset>('before-after');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [borderWidth, setBorderWidth] = useState<number>(12);
  const [borderColor, setBorderColor] = useState<'white' | 'dark' | 'transparent'>('white');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [labelLeft, setLabelLeft] = useState('BEFORE');
  const [labelRight, setLabelRight] = useState('AFTER');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    url: string;
  } | null>(null);

  const handleFilesDrop = (newFiles: File[]) => {
    const valid = newFiles.filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) {
      setErrorMessage('Please select valid image files (PNG, JPG, WEBP).');
      return;
    }

    const items: UploadedPhoto[] = valid.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...items].slice(0, 6));
    setResult(null);
    setErrorMessage(null);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setResult(null);
  };

  // Re-draw preview whenever settings change
  useEffect(() => {
    if (photos.length >= 2) {
      renderCollageToCanvas(previewCanvasRef.current, 900);
    }
  }, [photos, preset, aspectRatio, borderWidth, borderColor, showLabels, labelLeft, labelRight]);

  const getCanvasDimensions = (targetWidth: number, ratio: AspectRatio) => {
    let width = targetWidth;
    let height = targetWidth;

    if (ratio === '1:1') height = width;
    else if (ratio === '16:9') height = Math.round(width * (9 / 16));
    else if (ratio === '4:3') height = Math.round(width * (3 / 4));
    else if (ratio === '9:16') height = Math.round(width * (16 / 9));
    else if (ratio === 'a4') height = Math.round(width * 1.414); // A4 ratio

    return { width, height };
  };

  const renderCollageToCanvas = async (
    canvas: HTMLCanvasElement | null,
    baseWidth: number
  ): Promise<void> => {
    if (!canvas || photos.length === 0) return;

    const { width, height } = getCanvasDimensions(baseWidth, aspectRatio);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = borderColor === 'white' ? '#ffffff' : borderColor === 'dark' ? '#0f172a' : 'transparent';
    ctx.fillRect(0, 0, width, height);

    // Load images
    const loadedImgs: HTMLImageElement[] = [];
    for (const p of photos) {
      const img = new Image();
      img.src = p.previewUrl;
      await new Promise((res) => {
        img.onload = res;
        img.onerror = res;
      });
      loadedImgs.push(img);
    }

    const b = borderWidth * (baseWidth / 900);

    // Calculate slots based on preset
    interface Slot {
      x: number;
      y: number;
      w: number;
      h: number;
    }
    const slots: Slot[] = [];

    if (preset === 'before-after' || preset === '2-horizontal') {
      const w = (width - b * 3) / 2;
      const h = height - b * 2;
      slots.push({ x: b, y: b, w, h });
      slots.push({ x: b * 2 + w, y: b, w, h });
    } else if (preset === '2-vertical') {
      const w = width - b * 2;
      const h = (height - b * 3) / 2;
      slots.push({ x: b, y: b, w, h });
      slots.push({ x: b, y: b * 2 + h, w, h });
    } else if (preset === '2x2-grid') {
      const w = (width - b * 3) / 2;
      const h = (height - b * 3) / 2;
      slots.push({ x: b, y: b, w, h });
      slots.push({ x: b * 2 + w, y: b, w, h });
      slots.push({ x: b, y: b * 2 + h, w, h });
      slots.push({ x: b * 2 + w, y: b * 2 + h, w, h });
    } else if (preset === '3x2-grid') {
      const w = (width - b * 4) / 3;
      const h = (height - b * 3) / 2;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          slots.push({
            x: b + c * (w + b),
            y: b + r * (h + b),
            w,
            h,
          });
        }
      }
    }

    // Draw images inside slots with object-fit: cover
    for (let i = 0; i < slots.length; i++) {
      if (i >= loadedImgs.length) break;
      const slot = slots[i];
      const img = loadedImgs[i];
      if (!img.width || !img.height) continue;

      ctx.save();
      ctx.beginPath();
      ctx.rect(slot.x, slot.y, slot.w, slot.h);
      ctx.clip();

      // Cover scaling math
      const scale = Math.max(slot.w / img.width, slot.h / img.height);
      const renderW = img.width * scale;
      const renderH = img.height * scale;
      const renderX = slot.x + (slot.w - renderW) / 2;
      const renderY = slot.y + (slot.h - renderH) / 2;

      ctx.drawImage(img, renderX, renderY, renderW, renderH);
      ctx.restore();

      // Draw subtle slot border
      if (borderColor !== 'transparent') {
        ctx.strokeStyle = borderColor === 'white' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      }
    }

    // Optional Before / After Badges
    if (preset === 'before-after' && showLabels && slots.length >= 2) {
      const drawBadge = (slot: Slot, text: string, bg: string) => {
        const badgeFont = `bold ${Math.round(14 * (baseWidth / 900))}px sans-serif`;
        ctx.font = badgeFont;
        const textMetrics = ctx.measureText(text);
        const padX = 14 * (baseWidth / 900);
        const padY = 8 * (baseWidth / 900);
        const badgeW = textMetrics.width + padX * 2;
        const badgeH = 26 * (baseWidth / 900);

        const badgeX = slot.x + 12 * (baseWidth / 900);
        const badgeY = slot.y + 12 * (baseWidth / 900);

        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6 * (baseWidth / 900));
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, badgeX + padX, badgeY + badgeH / 2);
      };

      drawBadge(slots[0], labelLeft, 'rgba(15, 23, 42, 0.85)');
      drawBadge(slots[1], labelRight, 'rgba(16, 185, 129, 0.9)');
    }
  };

  const handleExport = async () => {
    if (photos.length < 2) {
      setErrorMessage('Please add at least 2 photos to generate a collage.');
      return;
    }

    setIsProcessing(true);
    setProgress(30);
    setStatusText('Rendering HD Master Collage Canvas (2400px)...');
    setErrorMessage(null);

    try {
      const exportCanvas = document.createElement('canvas');
      // High-resolution export: 2400px width
      await renderCollageToCanvas(exportCanvas, 2400);

      setProgress(80);
      setStatusText('Encoding high quality PNG image...');

      const blob = await new Promise<Blob>((resolve, reject) => {
        exportCanvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to create collage image blob.'));
          },
          'image/png',
          1.0
        );
      });

      const fileName = `PhotoCollage_${preset}_${Date.now()}.png`;
      const url = URL.createObjectURL(blob);

      setProgress(100);
      setStatusText('Collage ready!');

      setResult({
        blob,
        fileName,
        size: blob.size,
        url,
      });

      onAddToHistory({
        toolId: 'photo-collage',
        toolName: `Photo Collage (${preset})`,
        originalName: `${photos.length} Photos`,
        resultName: fileName,
        originalSize: photos.reduce((acc, p) => acc + p.file.size, 0),
        resultSize: blob.size,
        savedBytes: Math.max(0, photos.reduce((acc, p) => acc + p.file.size, 0) - blob.size),
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to render collage.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Columns2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Photo Collage & Before/After Studio
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-400 font-medium">
                100% Free & HD
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Create side-by-side Before/After comparisons, 2x2 grids, and multi-photo collages in high definition.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        {photos.length < 2 ? (
          <div className="mt-6 space-y-4">
            <DropZone
              onFilesSelected={handleFilesDrop}
              acceptedFormats={['.jpg', '.jpeg', '.png', '.webp', '.heic']}
              multiple={true}
              title="Drop 2 to 6 Photos to Make Collage"
              subtitle="Supports JPG, PNG, WEBP, HEIC. Perfect for Before/After, product showcase, & social grids."
            />

            {photos.length === 1 && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm flex items-center justify-between">
                <span>1 photo added. Please drop or add at least 1 more photo to build the collage.</span>
                <span className="text-xs font-semibold">{photos[0].file.name}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Photo Thumbnails Row */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {photos.map((item, idx) => (
                <div key={item.id} className="relative group flex-shrink-0">
                  <img
                    src={item.previewUrl}
                    alt={`Photo ${idx + 1}`}
                    className="w-20 h-20 rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700 group-hover:border-purple-500 transition"
                  />
                  <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-md font-semibold">
                    #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(item.id)}
                    className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-rose-600 text-white shadow hover:bg-rose-700 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {photos.length < 6 && (
                <label className="w-20 h-20 flex-shrink-0 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-400 flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:text-purple-600 transition">
                  <Plus className="w-5 h-5" />
                  <span className="text-[10px] mt-1 font-medium">Add Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleFilesDrop(Array.from(e.target.files));
                    }}
                  />
                </label>
              )}
            </div>

            {/* Layout & Style Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Collage Grid Layout
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreset('before-after')}
                    className={`p-2.5 rounded-xl border text-xs text-center transition ${
                      preset === 'before-after'
                        ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-semibold ring-1 ring-purple-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    Before / After
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset('2-horizontal')}
                    className={`p-2.5 rounded-xl border text-xs text-center transition ${
                      preset === '2-horizontal'
                        ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-semibold ring-1 ring-purple-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    2 Side-by-Side
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset('2-vertical')}
                    className={`p-2.5 rounded-xl border text-xs text-center transition ${
                      preset === '2-vertical'
                        ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-semibold ring-1 ring-purple-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    2 Vertical Stack
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset('2x2-grid')}
                    className={`p-2.5 rounded-xl border text-xs text-center transition ${
                      preset === '2x2-grid'
                        ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-semibold ring-1 ring-purple-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    4 Grid (2×2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset('3x2-grid')}
                    className={`p-2.5 rounded-xl border text-xs text-center transition ${
                      preset === '3x2-grid'
                        ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-semibold ring-1 ring-purple-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    6 Gallery (3×2)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['16:9', '1:1', '4:3', 'a4'] as AspectRatio[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAspectRatio(r)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                        aspectRatio === r
                          ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 ring-1 ring-purple-600'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Customization Sliders & Labels */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Border Width:</span>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={borderWidth}
                    onChange={(e) => setBorderWidth(Number(e.target.value))}
                    className="w-32 accent-purple-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-semibold">{borderWidth}px</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Border Color:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBorderColor('white')}
                      className={`w-6 h-6 rounded-md bg-white border border-slate-300 ${borderColor === 'white' ? 'ring-2 ring-purple-500' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setBorderColor('dark')}
                      className={`w-6 h-6 rounded-md bg-slate-900 border border-slate-600 ${borderColor === 'dark' ? 'ring-2 ring-purple-500' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setBorderColor('transparent')}
                      className={`w-6 h-6 rounded-md border border-dashed border-slate-400 flex items-center justify-center text-[10px] ${borderColor === 'transparent' ? 'ring-2 ring-purple-500' : ''}`}
                      title="Seamless"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              {preset === 'before-after' && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLabels}
                      onChange={(e) => setShowLabels(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    Show 'BEFORE' & 'AFTER' Badges
                  </label>

                  {showLabels && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={labelLeft}
                        onChange={(e) => setLabelLeft(e.target.value)}
                        placeholder="BEFORE"
                        className="w-24 px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 uppercase font-semibold"
                      />
                      <span className="text-xs text-slate-400">vs</span>
                      <input
                        type="text"
                        value={labelRight}
                        onChange={(e) => setLabelRight(e.target.value)}
                        placeholder="AFTER"
                        className="w-24 px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 uppercase font-semibold text-emerald-600"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Interactive Preview Canvas */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-500 mb-2">Live Collage Preview:</span>
              <div className="max-w-full overflow-hidden rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 bg-slate-950/10 dark:bg-slate-950 p-2 flex justify-center">
                <canvas ref={previewCanvasRef} className="max-h-[420px] w-auto object-contain rounded-xl" />
              </div>
            </div>

            {/* Action Button */}
            {!result && (
              <button
                type="button"
                onClick={handleExport}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5" />
                {isProcessing ? 'Generating HD Collage...' : 'Export High Definition Collage (PNG)'}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50">
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
                        HD Collage Created: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {aspectRatio.toUpperCase()} • {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    Download PNG
                  </button>
                </div>

                <TaskSuccessCard
                  title="Photo Collage Master Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={photos.reduce((acc, p) => acc + p.file.size, 0)}
                  infoBadge={`${photos.length} Photos`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
