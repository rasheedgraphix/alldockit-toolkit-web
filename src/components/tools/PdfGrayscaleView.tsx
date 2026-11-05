import React, { useState } from 'react';
import {
  Printer,
  Download,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Settings2,
  FileText,
  Sliders,
  Droplet,
  Contrast,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';
import { getPdfJs } from '../../utils/pdfOperations';

interface PdfGrayscaleViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type ColorMode = 'grayscale' | 'monochrome';
type QualityPreset = '150' | '200' | '300';
type ContrastBoost = 'normal' | 'boost' | 'high';

export const PdfGrayscaleView: React.FC<PdfGrayscaleViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const [colorMode, setColorMode] = useState<ColorMode>('grayscale');
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>('200');
  const [contrastBoost, setContrastBoost] = useState<ContrastBoost>('boost');
  const [threshold, setThreshold] = useState<number>(185); // For monochrome thresholding

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    pages: number;
  } | null>(null);

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please select a valid PDF file.');
      return;
    }

    setSelectedFile(file);
    setResult(null);
    setErrorMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      setPageCount(doc.getPageCount());
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not load PDF. The file may be password-protected or corrupt.');
    }
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(5);
    setStatusText('Loading PDF rendering engine...');
    setErrorMessage(null);

    try {
      const pdfjs = await getPdfJs();
      const buffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      const outDoc = await PDFDocument.create();

      // DPI factor: 72 is 1.0 scale
      const targetDpi = parseInt(qualityPreset, 10);
      const scale = targetDpi / 72;

      for (let i = 1; i <= totalPages; i++) {
        setStatusText(`Processing page ${i} of ${totalPages} (${colorMode === 'grayscale' ? 'Grayscale' : 'Pure B&W'})...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        // Original dimensions in points
        const originalViewport = page.getViewport({ scale: 1 });
        const ptWidth = originalViewport.width;
        const ptHeight = originalViewport.height;

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Canvas context could not be created');
        }

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        // Apply pixel manipulation
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const len = data.length;

        // Contrast factors
        let contrastFactor = 1.0;
        let brightnessOffset = 0;
        if (contrastBoost === 'boost') {
          contrastFactor = 1.25;
          brightnessOffset = 10;
        } else if (contrastBoost === 'high') {
          contrastFactor = 1.5;
          brightnessOffset = 20;
        }

        if (colorMode === 'grayscale') {
          for (let p = 0; p < len; p += 4) {
            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];
            // Standard perceptual luminance
            let gray = 0.299 * r + 0.587 * g + 0.114 * b;

            if (contrastFactor !== 1.0) {
              gray = (gray - 128) * contrastFactor + 128 + brightnessOffset;
            }

            gray = Math.max(0, Math.min(255, Math.round(gray)));
            data[p] = gray;
            data[p + 1] = gray;
            data[p + 2] = gray;
          }
        } else {
          // Pure Black & White (Monochrome Thresholding)
          for (let p = 0; p < len; p += 4) {
            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;

            const val = gray > threshold ? 255 : 0;
            data[p] = val;
            data[p + 1] = val;
            data[p + 2] = val;
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Convert to image bytes
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        const base64Data = dataUrl.split(',')[1];
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let b = 0; b < binaryStr.length; b++) {
          bytes[b] = binaryStr.charCodeAt(b);
        }

        const embeddedImage = await outDoc.embedJpg(bytes);
        const outPage = outDoc.addPage([ptWidth, ptHeight]);
        outPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: ptWidth,
          height: ptHeight,
        });

        const pct = Math.round((i / totalPages) * 90);
        setProgress(pct);
      }

      setProgress(95);
      setStatusText('Finalizing optimized PDF file...');
      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const modeSuffix = colorMode === 'grayscale' ? 'Grayscale' : 'Pure_BW';
      const fileName = `${baseName}_${modeSuffix}_InkSaver.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
        pages: totalPages,
      });

      onAddToHistory({
        toolId: 'pdf-grayscale',
        toolName: 'PDF Color to Grayscale / Pure B&W',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to convert PDF to grayscale.');
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
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF Color to Grayscale & Pure B&W (Ink Saver)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Unlimited
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Convert color PDFs to crisp grayscale or high-contrast monochromatic black & white. Saves up to 80% printer toner & ink!
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        {!selectedFile ? (
          <div className="mt-6">
            <DropZone
              onFilesSelected={handleFileSelect}
              acceptedFormats={['.pdf']}
              multiple={false}
              title="Drop your color PDF file here"
              subtitle="Supports textbooks, presentations, legal contracts, scans & bills (Up to 100MB)"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-slate-600 dark:text-slate-300 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)} • {pageCount !== null ? `${pageCount} Pages` : 'Reading...'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setResult(null);
                  setErrorMessage(null);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change File
              </button>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-600" />
                Ink Saver & Tone Settings
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Color Mode */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Droplet className="w-3.5 h-3.5 text-slate-500" />
                    Conversion Mode
                  </label>
                  <select
                    value={colorMode}
                    onChange={(e) => setColorMode(e.target.value as ColorMode)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="grayscale">Grayscale (Smooth Gray Tones)</option>
                    <option value="monochrome">Pure Black & White (Ultra Ink Saver)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {colorMode === 'grayscale'
                      ? 'Retains smooth shades of gray for images, charts, and text.'
                      : 'Zero gray. Strictly black text on pure white paper. Maximum ink savings.'}
                  </p>
                </div>

                {/* Contrast Boost */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Contrast className="w-3.5 h-3.5 text-slate-500" />
                    Contrast & Clarity Boost
                  </label>
                  <select
                    value={contrastBoost}
                    onChange={(e) => setContrastBoost(e.target.value as ContrastBoost)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="normal">Standard (Original)</option>
                    <option value="boost">Darker Text & Clean Background (+25%)</option>
                    <option value="high">High Contrast (+50% for Faded Scans)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Enhances dark text so it prints super sharp and readable.
                  </p>
                </div>

                {/* Quality / Resolution */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                    Print Resolution (DPI)
                  </label>
                  <select
                    value={qualityPreset}
                    onChange={(e) => setQualityPreset(e.target.value as QualityPreset)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="150">150 DPI (Fast & Compact)</option>
                    <option value="200">200 DPI (Recommended / Sharp)</option>
                    <option value="300">300 DPI (Ultra Razor Sharp)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    200 DPI is the sweet spot between crisp print sharpness and compact file size.
                  </p>
                </div>
              </div>

              {/* B&W Threshold Slider if monochrome */}
              {colorMode === 'monochrome' && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Black/White Cutoff Threshold:</span>
                    <span className="text-slate-900 dark:text-white font-mono">{threshold}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="230"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-slate-800 dark:accent-slate-200"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Lighter Text (100)</span>
                    <span>Default Balanced (185)</span>
                    <span>Thicker / Darker Text (230)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Button */}
            {!result && (
              <button
                type="button"
                onClick={handleConvert}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Printer className="w-5 h-5" />
                {isProcessing
                  ? 'Converting PDF...'
                  : `Convert to ${colorMode === 'grayscale' ? 'Grayscale' : 'Pure Black & White'} PDF`}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
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
                        Ink-Saver PDF Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.pages} Pages Converted • Size: {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>

                <TaskSuccessCard
                  title="Grayscale Ink Saver PDF Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.pages} Pages`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
