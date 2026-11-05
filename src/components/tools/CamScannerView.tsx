import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Sliders,
  Sparkles,
  Download,
  RotateCw,
  Printer,
  CheckCircle2,
  Share2,
  Trash2,
  Eye,
  FileCheck,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { formatBytes } from '../../utils/fileHelpers';

interface CamScannerViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type ScanFilter = 'magic' | 'bw' | 'grayscale' | 'original';

export const CamScannerView: React.FC<CamScannerViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<ScanFilter>('magic');
  const [brightness, setBrightness] = useState<number>(20);
  const [contrast, setContrast] = useState<number>(35);
  const [rotation, setRotation] = useState<number>(0);

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
      setRotation(0);
      setResult(null);
    }
  };

  // Render CamScanner Filter onto Canvas
  useEffect(() => {
    if (!previewUrl) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const isSwapped = rotation === 90 || rotation === 270;
      canvas.width = isSwapped ? img.height : img.width;
      canvas.height = isSwapped ? img.width : img.height;

      ctx.save();
      if (rotation !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
      } else {
        ctx.drawImage(img, 0, 0);
      }
      ctx.restore();

      if (filterMode === 'original') return;

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Contrast factor calculation
      const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      const bFactor = brightness * 1.5;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Apply Brightness & Contrast
        r = cFactor * (r - 128) + 128 + bFactor;
        g = cFactor * (g - 128) + 128 + bFactor;
        b = cFactor * (b - 128) + 128 + bFactor;

        if (filterMode === 'bw') {
          // Pure Black & White Document Thresholding
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const val = gray > 145 ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        } else if (filterMode === 'grayscale') {
          // Crisp Grayscale
          const gray = Math.min(255, Math.max(0, 0.299 * r + 0.587 * g + 0.114 * b));
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        } else if (filterMode === 'magic') {
          // Magic Color (CamScanner style: whitens background, enhances ink & colored stamps)
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum > 180) {
            // Push light background shadows towards pure white
            const boost = (lum - 180) * 1.2;
            r = Math.min(255, r + boost);
            g = Math.min(255, g + boost);
            b = Math.min(255, b + boost);
          } else if (lum < 110) {
            // Darken ink text for sharpness
            r = Math.max(0, r * 0.85);
            g = Math.max(0, g * 0.85);
            b = Math.max(0, b * 0.85);
          }
          data[i] = Math.min(255, Math.max(0, r));
          data[i + 1] = Math.min(255, Math.max(0, g));
          data[i + 2] = Math.min(255, Math.max(0, b));
        }
      }

      ctx.putImageData(imgData, 0, 0);
    };
    img.src = previewUrl;
  }, [previewUrl, filterMode, brightness, contrast, rotation]);

  // Export Cleaned Image as PDF
  const handleExportPdf = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedFile) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(30);
    setStatusText('Rendering scanned page onto A4 printable sheet...');

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const commaIdx = dataUrl.indexOf(',');
      const rawBase64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      const binary = atob(rawBase64);
      const imgBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        imgBytes[i] = binary.charCodeAt(i);
      }

      const pdfDoc = await PDFDocument.create();
      // Standard A4: 595.28 x 841.89 pt
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width: pageWidth, height: pageHeight } = page.getSize();
      const scannedImg = await pdfDoc.embedPng(imgBytes);

      // Fit image within A4 margins
      const margin = 28;
      const availW = pageWidth - margin * 2;
      const availH = pageHeight - margin * 2;

      const imgAspect = canvas.width / canvas.height;
      const pageAspect = availW / availH;

      let drawW = availW;
      let drawH = availH;

      if (imgAspect > pageAspect) {
        drawW = availW;
        drawH = availW / imgAspect;
      } else {
        drawH = availH;
        drawW = availH * imgAspect;
      }

      const x = (pageWidth - drawW) / 2;
      const y = (pageHeight - drawH) / 2;

      page.drawImage(scannedImg, {
        x,
        y,
        width: drawW,
        height: drawH,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = `${selectedFile.name.replace(/\.[^/.]+$/, '')}_scanned.pdf`;

      setResult({ blob, fileName, size: blob.size });

      onAddToHistory({
        toolId: 'cam-scanner',
        toolName: 'CamScanner Document Filter',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: 0,
        resultBlob: blob,
      });
    } catch (err: any) {
      console.error('CamScanner PDF error:', err);
      alert('Failed to generate scanned document PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Export as Clean PNG Image
  const handleExportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedFile) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = `${selectedFile.name.replace(/\.[^/.]+$/, '')}_scanned.png`;
      setResult({ blob, fileName, size: blob.size });

      onAddToHistory({
        toolId: 'cam-scanner',
        toolName: 'CamScanner Document Filter',
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
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>CamScanner Magic Filter (Shadow & Darkness Remover)</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Turn phone photos of books, certificates, receipts, and notes into clean, bright white scanned documents.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-500/20">
          <Printer className="w-3.5 h-3.5" />
          <span>Office Print Quality</span>
        </div>
      </div>

      {!selectedFile && (
        <DropZone
          onFilesSelected={handleFilesSelected}
          acceptedFormats={['.jpg', '.jpeg', '.png', '.webp']}
          multiple={false}
          title="Drop phone photo of document here"
          subtitle="Supports certificates, book pages, receipts, and invoices"
        />
      )}

      {selectedFile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Scan Enhancements
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setResult(null);
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Change Photo
                </button>
              </div>

              {/* Preset Filter Modes */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-2">
                  Scanner Preset
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  {[
                    { id: 'magic', label: '✨ Magic Color', desc: 'Whitens paper, keeps stamps' },
                    { id: 'bw', label: '📄 Sharp B&W', desc: 'Jet black text on white' },
                    { id: 'grayscale', label: '🌫️ Grayscale', desc: 'Textbooks & diagrams' },
                    { id: 'original', label: '📷 Original', desc: 'No filter applied' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setFilterMode(mode.id as ScanFilter)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        filterMode === mode.id
                          ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold shadow-xs'
                          : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <div className="text-xs">{mode.label}</div>
                      <div className="text-[10px] text-stone-400 font-normal mt-0.5">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rotation & Sliders */}
              <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-stone-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Orientation
                  </span>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Rotate 90° ({rotation}°)</span>
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    <span>Paper Whitening / Brightness</span>
                    <span>+{brightness}</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="60"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    <span>Text Sharpness / Contrast</span>
                    <span>+{contrast}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Download as Printable PDF (A4 Sheet)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportImage}
                  className="w-full py-2.5 px-4 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Clean Image (PNG)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Canvas Viewport Preview */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
            <span className="text-xs font-bold text-stone-500 mb-3">
              Real-Time Document Preview ({filterMode.toUpperCase()})
            </span>

            <div className="p-3 bg-stone-100 dark:bg-stone-950 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-inner max-h-[500px] max-w-full overflow-auto flex items-center justify-center">
              <canvas ref={canvasRef} className="max-h-[460px] max-w-full object-contain rounded shadow" />
            </div>

            <p className="text-[11px] text-stone-400 mt-3 text-center">
              💡 Shadows and yellow cast are automatically eliminated, producing clean paper scans ready for submission.
            </p>
          </div>
        </div>
      )}

      {/* Progress */}
      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {/* Result Card */}
      {result && (
        <TaskSuccessCard
          title="Document Cleaned & Scanned Successfully!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.size}
          toolName="CamScanner Magic Filter"
          infoBadge="High-Contrast Scanned Document"
        />
      )}
    </div>
  );
};
