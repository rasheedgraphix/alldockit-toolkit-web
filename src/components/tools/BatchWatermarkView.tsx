import React, { useState, useRef, useEffect } from 'react';
import {
  Stamp,
  Download,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Settings2,
  Image as ImageIcon,
  Type,
  Grid,
  FileArchive,
  Layers,
  RotateCw,
  Eye,
  Trash2,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import JSZip from 'jszip';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface BatchWatermarkViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type WatermarkType = 'text' | 'logo';
type Position =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'tiled';

interface BatchImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

export const BatchWatermarkView: React.FC<BatchWatermarkViewProps> = ({ onAddToHistory }) => {
  const [images, setImages] = useState<BatchImageItem[]>([]);
  const [watermarkType, setWatermarkType] = useState<WatermarkType>('text');

  // Text options
  const [watermarkText, setWatermarkText] = useState('© Rasheed Graphix');
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSizePercent, setFontSizePercent] = useState<number>(5); // % of image width
  const [opacity, setOpacity] = useState<number>(50); // 0-100%
  const [rotation, setRotation] = useState<number>(-30); // degrees
  const [position, setPosition] = useState<Position>('bottom-right');

  // Logo options
  const [logoFile, setLogoFile] = useState<{ file: File; img: HTMLImageElement; dataUrl: string } | null>(null);
  const [logoSizePercent, setLogoSizePercent] = useState<number>(20); // % of image width

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    const newItems: BatchImageItem[] = [];

    files.forEach((file) => {
      if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)) {
        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
    });

    if (newItems.length === 0) {
      setErrorMessage('Please select valid image files (PNG, JPG, WebP, etc.).');
      return;
    }

    setImages((prev) => [...prev, ...newItems]);
    setResult(null);
    setErrorMessage(null);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setLogoFile({ file, img, dataUrl });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      return filtered;
    });
    setResult(null);
  };

  const clearAllImages = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setResult(null);
  };

  // Draw live preview on first image
  useEffect(() => {
    if (images.length === 0) return;
    const firstImg = new Image();
    firstImg.onload = () => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fit preview into max 500x350
      const maxW = 500;
      const maxH = 320;
      const scale = Math.min(maxW / firstImg.width, maxH / firstImg.height, 1);
      canvas.width = Math.round(firstImg.width * scale);
      canvas.height = Math.round(firstImg.height * scale);

      ctx.drawImage(firstImg, 0, 0, canvas.width, canvas.height);

      drawWatermarkOnCanvas(ctx, canvas.width, canvas.height);
    };
    firstImg.src = images[0].previewUrl;
  }, [
    images,
    watermarkType,
    watermarkText,
    textColor,
    fontSizePercent,
    opacity,
    rotation,
    position,
    logoFile,
    logoSizePercent,
  ]);

  const drawWatermarkOnCanvas = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    ctx.save();
    ctx.globalAlpha = opacity / 100;

    if (watermarkType === 'text') {
      const fontSize = Math.max(12, Math.round((width * fontSizePercent) / 100));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'middle';

      // Text shadow for readability on any background
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const metrics = ctx.measureText(watermarkText);
      const textW = metrics.width;
      const textH = fontSize;

      if (position === 'tiled') {
        const stepX = textW + 80;
        const stepY = textH + 70;
        const rad = (rotation * Math.PI) / 180;

        for (let y = -height; y < height * 2; y += stepY) {
          for (let x = -width; x < width * 2; x += stepX) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rad);
            ctx.fillText(watermarkText, 0, 0);
            ctx.restore();
          }
        }
      } else {
        const { x, y } = computeAnchorCoords(position, width, height, textW, textH, 20);
        ctx.save();
        ctx.translate(x + textW / 2, y);
        if (rotation !== 0) {
          ctx.rotate((rotation * Math.PI) / 180);
        }
        ctx.fillText(watermarkText, -textW / 2, 0);
        ctx.restore();
      }
    } else if (watermarkType === 'logo' && logoFile) {
      const logoW = Math.max(30, Math.round((width * logoSizePercent) / 100));
      const logoRatio = logoFile.img.width / logoFile.img.height;
      const logoH = logoW / logoRatio;

      if (position === 'tiled') {
        const stepX = logoW + 60;
        const stepY = logoH + 60;
        const rad = (rotation * Math.PI) / 180;

        for (let y = -height; y < height * 2; y += stepY) {
          for (let x = -width; x < width * 2; x += stepX) {
            ctx.save();
            ctx.translate(x + logoW / 2, y + logoH / 2);
            ctx.rotate(rad);
            ctx.drawImage(logoFile.img, -logoW / 2, -logoH / 2, logoW, logoH);
            ctx.restore();
          }
        }
      } else {
        const { x, y } = computeAnchorCoords(position, width, height, logoW, logoH, 20);
        ctx.save();
        ctx.translate(x + logoW / 2, y + logoH / 2);
        if (rotation !== 0) {
          ctx.rotate((rotation * Math.PI) / 180);
        }
        ctx.drawImage(logoFile.img, -logoW / 2, -logoH / 2, logoW, logoH);
        ctx.restore();
      }
    }

    ctx.restore();
  };

  const computeAnchorCoords = (
    pos: Position,
    w: number,
    h: number,
    itemW: number,
    itemH: number,
    padding: number
  ) => {
    let x = padding;
    let y = padding;

    switch (pos) {
      case 'top-left':
        x = padding;
        y = padding + itemH / 2;
        break;
      case 'top-center':
        x = (w - itemW) / 2;
        y = padding + itemH / 2;
        break;
      case 'top-right':
        x = w - itemW - padding;
        y = padding + itemH / 2;
        break;
      case 'center-left':
        x = padding;
        y = h / 2;
        break;
      case 'center':
        x = (w - itemW) / 2;
        y = h / 2;
        break;
      case 'center-right':
        x = w - itemW - padding;
        y = h / 2;
        break;
      case 'bottom-left':
        x = padding;
        y = h - padding - itemH / 2;
        break;
      case 'bottom-center':
        x = (w - itemW) / 2;
        y = h - padding - itemH / 2;
        break;
      case 'bottom-right':
      default:
        x = w - itemW - padding;
        y = h - padding - itemH / 2;
        break;
    }

    return { x, y };
  };

  const handleProcessBatch = async () => {
    if (images.length === 0) return;
    if (watermarkType === 'logo' && !logoFile) {
      setErrorMessage('Please upload a logo image before stamping.');
      return;
    }

    setIsProcessing(true);
    setProgress(5);
    setStatusText('Starting batch watermarking engine...');
    setErrorMessage(null);

    try {
      const processedBlobs: { name: string; blob: Blob }[] = [];
      const totalImages = images.length;

      for (let i = 0; i < totalImages; i++) {
        const item = images[i];
        setStatusText(`Watermarking image ${i + 1} of ${totalImages} (${item.file.name})...`);

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const loadedImg = new Image();
          loadedImg.onload = () => resolve(loadedImg);
          loadedImg.onerror = (e) => reject(e);
          loadedImg.src = item.previewUrl;
        });

        // Full native resolution canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawWatermarkOnCanvas(ctx, canvas.width, canvas.height);

        const mime = item.file.type || 'image/jpeg';
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob(
            (b) => resolve(b || new Blob()),
            mime,
            0.92
          );
        });

        const ext = item.file.name.includes('.')
          ? item.file.name.substring(item.file.name.lastIndexOf('.'))
          : '.jpg';
        const baseName = item.file.name.replace(/\.[^/.]+$/, '');
        const outName = `${baseName}_watermarked${ext}`;

        processedBlobs.push({ name: outName, blob });
        setProgress(Math.round(((i + 1) / totalImages) * 85));
      }

      let finalBlob: Blob;
      let finalName: string;
      const isZip = processedBlobs.length > 1;

      if (isZip) {
        setProgress(90);
        setStatusText('Compressing all watermarked images into ZIP archive...');
        const zip = new JSZip();
        processedBlobs.forEach((pb) => {
          zip.file(pb.name, pb.blob);
        });
        const zipContent = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        });
        finalBlob = zipContent;
        finalName = `Watermarked_Images_${processedBlobs.length}_Files.zip`;
      } else {
        finalBlob = processedBlobs[0].blob;
        finalName = processedBlobs[0].name;
      }

      setResult({
        blob: finalBlob,
        fileName: finalName,
        size: finalBlob.size,
        count: processedBlobs.length,
        isZip,
      });

      const totalOriginalBytes = images.reduce((acc, curr) => acc + curr.file.size, 0);

      onAddToHistory({
        toolId: 'batch-watermark',
        toolName: 'Batch Watermark & Logo Stamper',
        originalName: isZip ? `${images.length} Image Batch` : images[0].file.name,
        resultName: finalName,
        originalSize: totalOriginalBytes,
        resultSize: finalBlob.size,
        savedBytes: Math.max(0, totalOriginalBytes - finalBlob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to process watermark batch.');
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
          <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400">
            <Stamp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Batch Image Watermarker & Logo Stamper
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Unlimited
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Apply custom text copyright or PNG company logo watermark across multiple images in bulk. Download individually or as a single ZIP!
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        {/* Drop zone for bulk images */}
        <div className="mt-6">
          <DropZone
            onFilesSelected={handleFilesSelected}
            acceptedFormats={['.png', '.jpg', '.jpeg', '.webp', '.bmp']}
            multiple={true}
            title={images.length > 0 ? 'Add more images to batch' : 'Drop multiple images here to watermark'}
            subtitle="Batch process up to 50 photos simultaneously (PNG, JPG, WebP)"
          />
        </div>

        {images.length > 0 && (
          <div className="space-y-6 pt-2">
            {/* Image Queue Summary Bar */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-pink-500" />
                {images.length} image{images.length > 1 ? 's' : ''} queued for watermarking
              </span>
              <button
                type="button"
                onClick={clearAllImages}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            </div>

            {/* Live Preview & Configuration Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Preview Window (5 cols) */}
              <div className="lg:col-span-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-pink-600" />
                    Live Watermark Preview
                  </span>
                  <span className="text-[11px] text-slate-400">Image 1 of {images.length}</span>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900/5 dark:bg-slate-950 p-2 flex items-center justify-center min-h-[220px]">
                  <canvas ref={previewCanvasRef} className="max-w-full max-h-64 rounded shadow-sm" />
                </div>
              </div>

              {/* Settings Controls (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Mode Selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWatermarkType('text')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                      watermarkType === 'text'
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <Type className="w-4 h-4" />
                    Text Watermark
                  </button>

                  <button
                    type="button"
                    onClick={() => setWatermarkType('logo')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                      watermarkType === 'logo'
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    Logo Stamp
                  </button>
                </div>

                {watermarkType === 'text' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Watermark Text
                      </label>
                      <input
                        type="text"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        placeholder="e.g. © 2026 Rasheed Graphix"
                        className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Text Color
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="color"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                          />
                          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{textColor}</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Font Size ({fontSizePercent}%)
                        </label>
                        <input
                          type="range"
                          min="2"
                          max="15"
                          value={fontSizePercent}
                          onChange={(e) => setFontSizePercent(Number(e.target.value))}
                          className="mt-2 w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-600"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Upload Logo File (PNG recommended)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="mt-1 block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Logo Width ({logoSizePercent}% of image)
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="60"
                        value={logoSizePercent}
                        onChange={(e) => setLogoSizePercent(Number(e.target.value))}
                        className="mt-2 w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-600"
                      />
                    </div>
                  </div>
                )}

                {/* Common options: Opacity & Position */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Opacity ({opacity}%)
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                      className="mt-2 w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Rotation ({rotation}°)
                    </label>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      value={rotation}
                      onChange={(e) => setRotation(Number(e.target.value))}
                      className="mt-2 w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-600"
                    />
                  </div>
                </div>

                {/* 9-Point Placement Grid */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Position Alignment
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 w-fit">
                      {(
                        [
                          'top-left',
                          'top-center',
                          'top-right',
                          'center-left',
                          'center',
                          'center-right',
                          'bottom-left',
                          'bottom-center',
                          'bottom-right',
                        ] as Position[]
                      ).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setPosition(pos)}
                          className={`w-6 h-6 rounded flex items-center justify-center text-[10px] transition ${
                            position === pos
                              ? 'bg-pink-600 text-white font-bold'
                              : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                          title={pos}
                        >
                          •
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setPosition('tiled')}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                        position === 'tiled'
                          ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      Tile Diagonally Across Entire Image
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            {!result && (
              <button
                type="button"
                onClick={handleProcessBatch}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Stamp className="w-5 h-5" />
                {isProcessing
                  ? 'Watermarking Images...'
                  : `Stamp & Export ${images.length} Image${images.length > 1 ? 's' : ''} ${
                      images.length > 1 ? '(ZIP)' : ''
                    }`}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-pink-50/50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900/50">
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
                        Batch Watermarking Complete: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.count} Images Processed • Size: {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    {result.isZip ? 'Download All (ZIP)' : 'Download Image'}
                  </button>
                </div>

                <TaskSuccessCard
                  title="Watermarked Images Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={images.reduce((acc, curr) => acc + curr.file.size, 0)}
                  infoBadge={`${result.count} Files ${result.isZip ? '(ZIP Archive)' : ''}`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
