import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Crop,
  Download,
  Grid,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Printer,
  FileCheck,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface PassportPhotoViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type PhotoStandard = '35x45' | '2x2' | '30x40' | '1x1';
type PaperSize = '4x6' | 'a4' | 'single';

const STANDARDS: { id: PhotoStandard; label: string; widthMm: number; heightMm: number }[] = [
  { id: '35x45', label: '35 × 45 mm (Standard Passport / Pak / UK / EU)', widthMm: 35, heightMm: 45 },
  { id: '2x2', label: '2 × 2 inches / 51 × 51 mm (US Visa / Passport)', widthMm: 50.8, heightMm: 50.8 },
  { id: '30x40', label: '30 × 40 mm (ID Card / License)', widthMm: 30, heightMm: 40 },
  { id: '1x1', label: '1 × 1 inch (Stamp Size)', widthMm: 25.4, heightMm: 25.4 },
];

export const PassportPhotoView: React.FC<PassportPhotoViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [standard, setStandard] = useState<PhotoStandard>('35x45');
  const [paper, setPaper] = useState<PaperSize>('4x6');
  const [bgColor, setBgColor] = useState<string>('original');
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [includeCutBorder, setIncludeCutBorder] = useState<boolean>(true);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
  } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      setPhotoUrl(URL.createObjectURL(file));
      setZoom(1.0);
      setPanX(0);
      setPanY(0);
      setResult(null);
    }
  };

  const selectedStandard = STANDARDS.find((s) => s.id === standard) || STANDARDS[0];

  // Draw single cropped preview
  useEffect(() => {
    if (!photoUrl) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const targetAspect = selectedStandard.widthMm / selectedStandard.heightMm;
      canvas.width = 400;
      canvas.height = Math.round(400 / targetAspect);

      // Background
      if (bgColor !== 'original') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Draw image with zoom and pan
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.clip();

      const baseWidth = canvas.width * zoom;
      const baseHeight = (img.height / img.width) * baseWidth;
      const x = (canvas.width - baseWidth) / 2 + panX;
      const y = (canvas.height - baseHeight) / 2 + panY;

      ctx.drawImage(img, x, y, baseWidth, baseHeight);

      if (includeCutBorder) {
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
      }

      ctx.restore();
    };
    img.src = photoUrl;
  }, [photoUrl, standard, bgColor, zoom, panX, panY, includeCutBorder, selectedStandard]);

  // Generate Single Photo Blob
  const renderSinglePhotoDataUrl = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!photoUrl) return reject('No photo');
      const img = new Image();
      img.onload = () => {
        const targetAspect = selectedStandard.widthMm / selectedStandard.heightMm;
        const canvas = document.createElement('canvas');
        // Render at 300 DPI (approx 12 points per mm)
        const dpiScale = 12;
        canvas.width = Math.round(selectedStandard.widthMm * dpiScale);
        canvas.height = Math.round(selectedStandard.heightMm * dpiScale);
        const ctx = canvas.getContext('2d')!;

        if (bgColor !== 'original') {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.clip();

        const baseWidth = canvas.width * zoom;
        const baseHeight = (img.height / img.width) * baseWidth;
        const x = (canvas.width - baseWidth) / 2 + (panX * canvas.width) / 400;
        const y = (canvas.height - baseHeight) / 2 + (panY * canvas.height) / (400 / targetAspect);

        ctx.drawImage(img, x, y, baseWidth, baseHeight);

        if (includeCutBorder) {
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(0, 0, canvas.width, canvas.height);
        }

        ctx.restore();
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = photoUrl;
    });
  };

  const handleGenerateGrid = async () => {
    if (!photoUrl) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(20);
    setStatusText('Cropping photo to official biometric ratio...');

    try {
      const singlePhotoDataUrl = await renderSinglePhotoDataUrl();

      if (paper === 'single') {
        setProgress(80);
        setStatusText('Saving high-resolution photo...');
        const commaIdx = singlePhotoDataUrl.indexOf(',');
        const rawBase64 = commaIdx >= 0 ? singlePhotoDataUrl.slice(commaIdx + 1) : singlePhotoDataUrl;
        const binary = atob(rawBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/png' });
        const fileName = `passport_photo_${standard}.png`;

        setResult({ blob, fileName, size: blob.size });

        onAddToHistory({
          toolId: 'passport-photo',
          toolName: 'Passport Size Photo Maker',
          originalName: selectedFile?.name || 'Photo',
          resultName: fileName,
          originalSize: selectedFile?.size || 0,
          resultSize: blob.size,
          savedBytes: 0,
          resultBlob: blob,
        });
        return;
      }

      setProgress(50);
      setStatusText('Generating printable photo sheet (PDF)...');

      const pdfDoc = await PDFDocument.create();

      // Points: 1mm = 2.83465pt
      const mmToPt = 2.83465;

      let sheetWidthPt = 4 * 72; // 4x6 default (288 x 432 pt)
      let sheetHeightPt = 6 * 72;
      let cols = 2;
      let rows = 4;

      if (paper === '4x6') {
        // 4 x 6 inches
        sheetWidthPt = 4 * 72;
        sheetHeightPt = 6 * 72;
        cols = selectedStandard.widthMm > 40 ? 2 : 2;
        rows = selectedStandard.heightMm > 45 ? 3 : 4;
      } else if (paper === 'a4') {
        // A4 page (595.28 x 841.89 pt)
        sheetWidthPt = 595.28;
        sheetHeightPt = 841.89;
        cols = 4;
        rows = 5;
      }

      const page = pdfDoc.addPage([sheetWidthPt, sheetHeightPt]);

      const photoWidthPt = selectedStandard.widthMm * mmToPt;
      const photoHeightPt = selectedStandard.heightMm * mmToPt;

      const commaIdx = singlePhotoDataUrl.indexOf(',');
      const rawBase64 = commaIdx >= 0 ? singlePhotoDataUrl.slice(commaIdx + 1) : singlePhotoDataUrl;
      const binary = atob(rawBase64);
      const photoBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        photoBytes[i] = binary.charCodeAt(i);
      }
      const photoImg = await pdfDoc.embedPng(photoBytes);

      // Center the grid on the sheet
      const gapPt = 12; // spacing between photos
      const gridWidth = cols * photoWidthPt + (cols - 1) * gapPt;
      const gridHeight = rows * photoHeightPt + (rows - 1) * gapPt;

      const startX = (sheetWidthPt - gridWidth) / 2;
      const startY = (sheetHeightPt - gridHeight) / 2 + (rows - 1) * (photoHeightPt + gapPt);

      setProgress(75);
      setStatusText(`Arranging ${cols * rows} photos onto grid sheet...`);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = startX + c * (photoWidthPt + gapPt);
          const y = startY - r * (photoHeightPt + gapPt);

          page.drawImage(photoImg, {
            x,
            y,
            width: photoWidthPt,
            height: photoHeightPt,
          });
        }
      }

      setProgress(95);
      setStatusText('Finalizing printable sheet...');

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = `Passport_Photos_${cols * rows}_grid_${paper}.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
      });

      onAddToHistory({
        toolId: 'passport-photo',
        toolName: 'Passport Size Photo Maker',
        originalName: selectedFile?.name || 'Selfie',
        resultName: fileName,
        originalSize: selectedFile?.size || 0,
        resultSize: blob.size,
        savedBytes: 0,
        resultBlob: blob,
      });
    } catch (err: any) {
      console.error('Passport photo error:', err);
      alert(err?.message || 'Failed to generate passport photos.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-500" />
            <span>Passport Size Photo Maker & Grid Sheet</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Create official biometric passport photos with crop, zoom, studio background tints, and printable 4x6 / A4 grids.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-indigo-500/20">
          <Printer className="w-3.5 h-3.5" />
          <span>Studio 4x6 Ready</span>
        </div>
      </div>

      {!selectedFile && (
        <DropZone
          onFilesSelected={handleFilesSelected}
          acceptedFormats={['.png', '.jpg', '.jpeg', '.webp']}
          multiple={false}
          title="Drop your photo or selfie here"
          subtitle="PNG, JPG, or WEBP portrait photo"
        />
      )}

      {selectedFile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Photo Specifications
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPhotoUrl(null);
                  }}
                  className="text-[11px] text-red-500 hover:underline"
                >
                  Change Photo
                </button>
              </div>

              {/* Standard Selector */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                  Biometric Standard
                </label>
                <select
                  value={standard}
                  onChange={(e) => setStandard(e.target.value as PhotoStandard)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {STANDARDS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Paper Grid Selector */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                  Sheet Layout / Print Target
                </label>
                <select
                  value={paper}
                  onChange={(e) => setPaper(e.target.value as PaperSize)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="4x6">4 × 6 inch Photo Paper (6-8 Photos Sheet)</option>
                  <option value="a4">Standard A4 Sheet (20 Photos Grid)</option>
                  <option value="single">Single Photo (Cropped PNG only)</option>
                </select>
              </div>

              {/* Background Color */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1.5">
                  Studio Background Tint
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'original', label: 'Original', color: 'transparent' },
                    { id: '#FFFFFF', label: 'White', color: '#FFFFFF' },
                    { id: '#2B6CB0', label: 'Blue', color: '#2B6CB0' },
                    { id: '#E2E8F0', label: 'Grey', color: '#E2E8F0' },
                    { id: '#F7FAFC', label: 'Light', color: '#F7FAFC' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBgColor(bg.id)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                        bgColor === bg.id
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zoom Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                  <span className="flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Zoom Face</span>
                  </span>
                  <span>{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Pan Adjustment (Horizontal & Vertical) */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-stone-500 block mb-1">
                    Pan Horizontal
                  </span>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={panX}
                    onChange={(e) => setPanX(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-stone-500 block mb-1">
                    Pan Vertical
                  </span>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={panY}
                    onChange={(e) => setPanY(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>

              {/* Cutting line */}
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={includeCutBorder}
                  onChange={(e) => setIncludeCutBorder(e.target.checked)}
                  className="rounded border-stone-300 text-indigo-600"
                />
                <span>Include cutting border lines around photos</span>
              </label>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleGenerateGrid}
                disabled={isProcessing}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Grid className="w-4 h-4" />
                <span>
                  {paper === 'single' ? 'Download Single Cropped Photo' : `Generate Printable ${paper.toUpperCase()} Sheet`}
                </span>
              </button>
            </div>
          </div>

          {/* Preview Column */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
            <span className="text-xs font-bold text-stone-600 dark:text-stone-300 mb-3">
              Live Biometric Crop Preview ({selectedStandard.label})
            </span>

            <div className="p-3 bg-stone-100 dark:bg-stone-950 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-inner flex items-center justify-center max-w-sm">
              <canvas
                ref={previewCanvasRef}
                className="rounded-lg shadow-md max-h-[360px] object-contain"
              />
            </div>

            <p className="text-[11px] text-stone-400 mt-3 text-center">
              💡 Use Zoom & Pan sliders to position your face centrally with head and chin clearly visible.
            </p>
          </div>
        </div>
      )}

      {/* Progress */}
      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {/* Result Card */}
      {result && (
        <TaskSuccessCard
          title="Passport Photos Ready for Printing!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.size}
          toolName="Passport Size Photo Maker"
          infoBadge={paper === 'single' ? 'Single Photo' : 'Multi-Photo Grid Sheet'}
        />
      )}
    </div>
  );
};
