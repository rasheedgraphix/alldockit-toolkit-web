import React, { useState, useEffect } from 'react';
import {
  Crop,
  Download,
  Scissors,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { getPdfInfo, formatBytes } from '../../utils/fileHelpers';
import { renderPdfPageToDataUrl } from '../../utils/pdfOperations';

interface PdfCropViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfCropView: React.FC<PdfCropViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagePreviewUrl, setPagePreviewUrl] = useState<string | null>(null);

  // Margins in percentage
  const [topPercent, setTopPercent] = useState<number>(8);
  const [bottomPercent, setBottomPercent] = useState<number>(8);
  const [leftPercent, setLeftPercent] = useState<number>(8);
  const [rightPercent, setRightPercent] = useState<number>(8);
  const [applyToAll, setApplyToAll] = useState<boolean>(true);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
  } | null>(null);

  // Load preview
  useEffect(() => {
    if (!selectedFile) return;

    let isMounted = true;
    renderPdfPageToDataUrl(selectedFile, currentPage, 1.2)
      .then(({ dataUrl }) => {
        if (isMounted) setPagePreviewUrl(dataUrl);
      })
      .catch((err) => console.warn('Crop preview render error:', err));

    return () => {
      isMounted = false;
    };
  }, [selectedFile, currentPage]);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      setResult(null);
      try {
        const info = await getPdfInfo(file);
        setTotalPages(info.pageCount);
        setCurrentPage(1);
      } catch (err) {
        console.warn('Get PDF info error:', err);
      }
    }
  };

  const applyPreset = (preset: 'minimal' | 'moderate' | 'headerFooter' | 'none') => {
    if (preset === 'minimal') {
      setTopPercent(5);
      setBottomPercent(5);
      setLeftPercent(5);
      setRightPercent(5);
    } else if (preset === 'moderate') {
      setTopPercent(12);
      setBottomPercent(12);
      setLeftPercent(10);
      setRightPercent(10);
    } else if (preset === 'headerFooter') {
      setTopPercent(14);
      setBottomPercent(14);
      setLeftPercent(4);
      setRightPercent(4);
    } else {
      setTopPercent(0);
      setBottomPercent(0);
      setLeftPercent(0);
      setRightPercent(0);
    }
  };

  const handleCropPdf = async () => {
    if (!selectedFile) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(20);
    setStatusText('Loading PDF pages into memory...');

    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pageCount = pdfDoc.getPageCount();

      setProgress(50);
      setStatusText(`Trimming margins on ${applyToAll ? pageCount : 1} page(s)...`);

      const targetIndices = applyToAll
        ? Array.from({ length: pageCount }, (_, i) => i)
        : [currentPage - 1];

      for (const idx of targetIndices) {
        const page = pdfDoc.getPage(idx);
        const { width, height } = page.getSize();

        // Calculate crop bounds in points
        const cropX = (leftPercent / 100) * width;
        const cropY = (bottomPercent / 100) * height;
        const cropW = width - ((leftPercent + rightPercent) / 100) * width;
        const cropH = height - ((topPercent + bottomPercent) / 100) * height;

        if (cropW > 50 && cropH > 50) {
          page.setCropBox(cropX, cropY, cropW, cropH);
          page.setMediaBox(cropX, cropY, cropW, cropH);
        }
      }

      setProgress(85);
      setStatusText('Re-encoding cropped document...');

      const croppedBytes = await pdfDoc.save();
      const blob = new Blob([croppedBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = selectedFile.name.replace(/\.pdf$/i, '_cropped.pdf');

      setResult({ blob, fileName, size: blob.size });

      onAddToHistory({
        toolId: 'pdf-crop',
        toolName: 'PDF Page Cropper & Margin Trimmer',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: 0,
        resultBlob: blob,
      });
    } catch (err: any) {
      console.error('PDF crop error:', err);
      alert('Failed to crop PDF document.');
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
            <Crop className="w-5 h-5 text-indigo-500" />
            <span>PDF Page Cropper & Margin Trimmer</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Trim unnecessary white borders, remove headers/footers, and crop slide margins to save printer toner and ink.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-indigo-500/20">
          <Scissors className="w-3.5 h-3.5" />
          <span>Batch Page Trimming</span>
        </div>
      </div>

      {!selectedFile && (
        <DropZone
          onFilesSelected={handleFilesSelected}
          acceptedFormats={['.pdf']}
          multiple={false}
          title="Drop PDF here to crop margins"
          subtitle="Supports single or multi-page documents"
        />
      )}

      {selectedFile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Crop Specifications
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setResult(null);
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Change PDF
                </button>
              </div>

              {/* Presets */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-2">
                  Quick Trimming Presets
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => applyPreset('minimal')}
                    className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-indigo-500 text-left"
                  >
                    <span>Trim 5% Borders</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('moderate')}
                    className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-indigo-500 text-left"
                  >
                    <span>Trim 10% White Margins</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('headerFooter')}
                    className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-indigo-500 text-left"
                  >
                    <span>Cut Header & Footer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('none')}
                    className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-indigo-500 text-left"
                  >
                    <span>Reset Margins</span>
                  </button>
                </div>
              </div>

              {/* Margin Sliders */}
              <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-stone-800 text-xs">
                <div>
                  <div className="flex justify-between font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    <span>Top Margin</span>
                    <span>{topPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="35"
                    value={topPercent}
                    onChange={(e) => setTopPercent(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    <span>Bottom Margin</span>
                    <span>{bottomPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="35"
                    value={bottomPercent}
                    onChange={(e) => setBottomPercent(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      <span>Left</span>
                      <span>{leftPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={leftPercent}
                      onChange={(e) => setLeftPercent(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      <span>Right</span>
                      <span>{rightPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={rightPercent}
                      onChange={(e) => setRightPercent(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>

                {/* Apply Target */}
                <label className="flex items-center gap-2 cursor-pointer pt-2 font-medium text-stone-700 dark:text-stone-300">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => setApplyToAll(e.target.checked)}
                    className="rounded border-stone-300 text-indigo-600"
                  />
                  <span>Apply crop to all {totalPages} pages</span>
                </label>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCropPdf}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Crop className="w-4 h-4" />
                  <span>Crop & Save Document</span>
                </button>
              </div>
            </div>
          </div>

          {/* Visual Preview Column */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold text-stone-600 dark:text-stone-300">
                Visual Crop Area Preview
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="p-1 rounded-lg border border-stone-200 dark:border-stone-700 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold px-1">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="p-1 rounded-lg border border-stone-200 dark:border-stone-700 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Preview Box with Visual Crop Overlay */}
            <div className="relative mx-auto rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-950 p-2 overflow-hidden flex items-center justify-center max-h-[500px]">
              {pagePreviewUrl ? (
                <div className="relative">
                  <img
                    src={pagePreviewUrl}
                    alt="Page preview"
                    className="max-h-[460px] object-contain shadow-sm"
                  />
                  {/* Red Crop Overlay Border */}
                  <div
                    style={{
                      top: `${topPercent}%`,
                      bottom: `${bottomPercent}%`,
                      left: `${leftPercent}%`,
                      right: `${rightPercent}%`,
                    }}
                    className="absolute border-2 border-dashed border-red-500 bg-red-500/10 pointer-events-none transition-all duration-75 shadow-sm"
                  >
                    <span className="absolute top-1 left-1 bg-red-600 text-white font-mono text-[9px] px-1 py-0.5 rounded shadow">
                      Crop Area
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-stone-400 py-20 animate-pulse">
                  Rendering PDF page...
                </div>
              )}
            </div>

            <p className="text-[11px] text-stone-400 mt-2 text-center">
              💡 Content inside the red dashed box will be kept; borders outside will be trimmed off.
            </p>
          </div>
        </div>
      )}

      {/* Progress */}
      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {/* Result Card */}
      {result && (
        <TaskSuccessCard
          title="PDF Document Successfully Cropped!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.size}
          toolName="PDF Margin Cropper"
          infoBadge="Trimmed White Margins"
        />
      )}
    </div>
  );
};
