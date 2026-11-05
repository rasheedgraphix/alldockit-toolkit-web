import React, { useState, useRef, useEffect } from 'react';
import {
  Eraser,
  Sparkles,
  Download,
  Pipette,
  Layers,
  RotateCcw,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { formatBytes } from '../../utils/fileHelpers';

interface BgRemoverViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const BgRemoverView: React.FC<BgRemoverViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [targetColor, setTargetColor] = useState<{ r: number; g: number; b: number }>({
    r: 255,
    g: 255,
    b: 255,
  });
  const [tolerance, setTolerance] = useState<number>(30); // 0 to 100
  const [replaceMode, setReplaceMode] = useState<'transparent' | 'color'>('transparent');
  const [replacementColorHex, setReplacementColorHex] = useState<string>('#FFFFFF');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
    }
  };

  // Render Transparent Image on Canvas
  useEffect(() => {
    if (!previewUrl) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Color distance tolerance threshold (0 - 441 max distance)
      const threshold = (tolerance / 100) * 350;

      // Parse replacement color if in replace mode
      let repR = 255, repG = 255, repB = 255;
      if (replaceMode === 'color') {
        const hex = replacementColorHex.replace('#', '');
        repR = parseInt(hex.substring(0, 2), 16) || 0;
        repG = parseInt(hex.substring(2, 4), 16) || 0;
        repB = parseInt(hex.substring(4, 6), 16) || 0;
      }

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Euclidean distance in RGB color space
        const dist = Math.sqrt(
          (r - targetColor.r) ** 2 +
          (g - targetColor.g) ** 2 +
          (b - targetColor.b) ** 2
        );

        if (dist <= threshold) {
          if (replaceMode === 'transparent') {
            // Feather edge if near threshold
            if (dist > threshold * 0.75) {
              const alphaRatio = (dist - threshold * 0.75) / (threshold * 0.25);
              data[i + 3] = Math.round(data[i + 3] * alphaRatio);
            } else {
              data[i + 3] = 0; // Pure transparent
            }
          } else {
            // Color Replacement
            data[i] = repR;
            data[i + 1] = repG;
            data[i + 2] = repB;
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    };
    img.src = previewUrl;
  }, [previewUrl, targetColor, tolerance, replaceMode, replacementColorHex]);

  // Click on canvas to sample background color
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    try {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      setTargetColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
    } catch {
      // ignore
    }
  };

  const handleDownloadTransparentPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedFile) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = `${selectedFile.name.replace(/\.[^/.]+$/, '')}_transparent.png`;
      setResult({ blob, fileName, size: blob.size });

      onAddToHistory({
        toolId: 'bg-remover',
        toolName: 'Background Remover & Transparent PNG',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: 0,
        resultBlob: blob,
      });
    }, 'image/png');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Eraser className="w-5 h-5 text-indigo-500" />
            <span>Image Background Remover & Transparent PNG Studio</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Convert white, solid, or green backgrounds of signatures, logos, stamps, and photos to 100% transparent PNGs offline.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-indigo-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>100% Client-Side Alpha Mask</span>
        </div>
      </div>

      {!selectedFile && (
        <DropZone
          onFilesSelected={handleFilesSelected}
          acceptedFormats={['.png', '.jpg', '.jpeg', '.webp']}
          multiple={false}
          title="Drop signature, logo, or photo here to remove background"
          subtitle="Supports PNG, JPG, and WebP"
        />
      )}

      {selectedFile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Background Settings
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setResult(null);
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Change Image
                </button>
              </div>

              {/* Target Background Preset */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-2">
                  Target Color to Erase
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetColor({ r: 255, g: 255, b: 255 })}
                    className="flex-1 py-2 px-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-indigo-500 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-stone-300 bg-white" />
                    <span>Pure White</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetColor({ r: 0, g: 255, b: 0 })}
                    className="flex-1 py-2 px-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-indigo-500 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-green-500" />
                    <span>Green Screen</span>
                  </button>
                </div>
                <p className="text-[11px] text-stone-400 mt-1.5">
                  💡 Or click anywhere on the image preview to sample custom background color!
                </p>
              </div>

              {/* Tolerance Slider */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                  <span>Color Removal Tolerance</span>
                  <span>{tolerance}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Output Mode Switcher */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setReplaceMode('transparent')}
                  className={`py-2 px-3 rounded-xl border font-bold text-center transition-all ${
                    replaceMode === 'transparent'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                      : 'border-stone-200 dark:border-stone-700 text-stone-600'
                  }`}
                >
                  Transparent PNG
                </button>
                <button
                  type="button"
                  onClick={() => setReplaceMode('color')}
                  className={`py-2 px-3 rounded-xl border font-bold text-center transition-all ${
                    replaceMode === 'color'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                      : 'border-stone-200 dark:border-stone-700 text-stone-600'
                  }`}
                >
                  Color Replace
                </button>
              </div>

              {replaceMode === 'color' && (
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    New Background Color
                  </label>
                  <input
                    type="color"
                    value={replacementColorHex}
                    onChange={(e) => setReplacementColorHex(e.target.value)}
                    className="w-full h-8 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadTransparentPng}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Transparent PNG</span>
                </button>
              </div>
            </div>
          </div>

          {/* Canvas Preview Column */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
            <span className="text-xs font-bold text-stone-500 mb-3">
              Transparency Checkerboard View (Click on preview to pick color)
            </span>

            {/* Checkerboard background wrapper */}
            <div
              style={{
                backgroundImage: `linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`,
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              }}
              className="p-3 rounded-2xl border border-stone-300 dark:border-stone-700 max-h-[500px] max-w-full overflow-auto flex items-center justify-center cursor-crosshair"
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="max-h-[460px] max-w-full object-contain rounded shadow"
              />
            </div>

            <p className="text-[11px] text-stone-400 mt-3 text-center">
              💡 The checkerboard pattern indicates areas that will be 100% transparent in the downloaded PNG.
            </p>
          </div>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <TaskSuccessCard
          title="Transparent PNG Ready for Download!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.size}
          toolName="Background Remover"
          infoBadge="100% Transparent Alpha PNG"
        />
      )}
    </div>
  );
};
