import React, { useState, useRef, useEffect } from 'react';
import {
  EyeOff,
  FileText,
  Download,
  AlertCircle,
  Undo2,
  Trash2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, rgb } from 'pdf-lib';
import { getPdfJs } from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface PdfRedactViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

interface RedactBox {
  pageIndex: number; // 0-indexed
  x: number; // in points (PDF coordinate space)
  y: number; // in points (PDF bottom-left origin)
  width: number;
  height: number;
  color: 'black' | 'white';
}

export const PdfRedactView: React.FC<PdfRedactViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [boxColor, setBoxColor] = useState<'black' | 'white'>('black');
  const [boxes, setBoxes] = useState<RedactBox[]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentDragRect, setCurrentDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [pageViewport, setPageViewport] = useState<{ width: number; height: number; scale: number } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    boxCount: number;
  } | null>(null);

  const pdfDocCache = useRef<any>(null);

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
    setBoxes([]);
    setCurrentPage(1);

    try {
      const buffer = await file.arrayBuffer();
      const pdfjs = await getPdfJs();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;
      pdfDocCache.current = pdf;
      setTotalPages(pdf.numPages);
      renderPage(1, pdf);
    } catch (e: any) {
      setErrorMessage('Failed to load PDF for redaction. Please make sure the file is valid.');
    }
  };

  const renderPage = async (pageNum: number, pdfInstance?: any) => {
    const pdf = pdfInstance || pdfDocCache.current;
    if (!pdf) return;

    try {
      const page = await pdf.getPage(pageNum);
      // Scale to comfortably fit max 700px width
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const targetWidth = Math.min(650, window.innerWidth - 80);
      const scale = targetWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale });

      setPageViewport({
        width: viewport.width,
        height: viewport.height,
        scale,
      });

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
      }

      // Sync overlay canvas
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        overlay.width = viewport.width;
        overlay.height = viewport.height;
        drawExistingBoxes(pageNum - 1, overlay, scale, viewport.height);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const drawExistingBoxes = (
    pageIndex: number,
    overlayCanvas: HTMLCanvasElement,
    scale: number,
    canvasHeight: number
  ) => {
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const pageBoxes = boxes.filter((b) => b.pageIndex === pageIndex);
    for (const b of pageBoxes) {
      const screenX = b.x * scale;
      // Convert from PDF bottom-left to canvas top-left
      const screenY = canvasHeight - (b.y + b.height) * scale;
      const screenW = b.width * scale;
      const screenH = b.height * scale;

      ctx.fillStyle = b.color === 'black' ? '#0f172a' : '#ffffff';
      ctx.fillRect(screenX, screenY, screenW, screenH);

      // Red border on overlay so white boxes remain visible
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX, screenY, screenW, screenH);
    }
  };

  useEffect(() => {
    if (overlayCanvasRef.current && pageViewport) {
      drawExistingBoxes(currentPage - 1, overlayCanvasRef.current, pageViewport.scale, pageViewport.height);
    }
  }, [boxes, currentPage, pageViewport]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayCanvasRef.current || !pageViewport) return;
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentDragRect(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || !overlayCanvasRef.current) return;
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(e.clientX - rect.left, overlayCanvasRef.current.width));
    const curY = Math.max(0, Math.min(e.clientY - rect.top, overlayCanvasRef.current.height));

    const x = Math.min(startPoint.x, curX);
    const y = Math.min(startPoint.y, curY);
    const w = Math.abs(curX - startPoint.x);
    const h = Math.abs(curY - startPoint.y);

    setCurrentDragRect({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPoint || !currentDragRect || !pageViewport) {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentDragRect(null);
      return;
    }

    if (currentDragRect.w > 4 && currentDragRect.h > 4) {
      // Convert screen coords to PDF points coords
      // Canvas origin is top-left, PDF origin is bottom-left
      const scale = pageViewport.scale;
      const pdfX = currentDragRect.x / scale;
      const pdfW = currentDragRect.w / scale;
      const pdfH = currentDragRect.h / scale;
      // In PDF, Y=0 is at bottom
      const pdfY = (pageViewport.height - (currentDragRect.y + currentDragRect.h)) / scale;

      const newBox: RedactBox = {
        pageIndex: currentPage - 1,
        x: pdfX,
        y: pdfY,
        width: pdfW,
        height: pdfH,
        color: boxColor,
      };

      setBoxes((prev) => [...prev, newBox]);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentDragRect(null);
  };

  const handleUndo = () => {
    setBoxes((prev) => prev.slice(0, -1));
  };

  const handleClearCurrentPage = () => {
    setBoxes((prev) => prev.filter((b) => b.pageIndex !== currentPage - 1));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      renderPage(newPage);
    }
  };

  const handleApplyRedaction = async () => {
    if (!selectedFile) return;
    if (boxes.length === 0) {
      setErrorMessage('Please draw at least one redaction box over sensitive content first.');
      return;
    }

    setIsProcessing(true);
    setProgress(20);
    setStatusText('Burning permanent redaction boxes into PDF pages...');
    setErrorMessage(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        if (box.pageIndex < pdfDoc.getPageCount()) {
          const page = pdfDoc.getPage(box.pageIndex);
          const colorRgb = box.color === 'black' ? rgb(0, 0, 0) : rgb(1, 1, 1);

          page.drawRectangle({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            color: colorRgb,
            borderColor: colorRgb,
            borderWidth: 0,
          });
        }
      }

      setProgress(80);
      setStatusText('Re-encoding sanitized PDF file...');

      const savedBytes = await pdfDoc.save();
      const blob = new Blob([savedBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = selectedFile.name.replace(/\.pdf$/i, '_sanitized_redacted.pdf');

      setProgress(100);
      setStatusText('PDF Redacted & Sanitized successfully!');

      setResult({
        blob,
        fileName,
        size: blob.size,
        boxCount: boxes.length,
      });

      onAddToHistory({
        toolId: 'pdf-redact',
        toolName: 'PDF Privacy Redaction (Censor)',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to apply redaction. Please try again.');
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
          <div className="p-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-200">
            <EyeOff className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF Redaction & Privacy Blackout Marker
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 font-medium">
                100% Secure & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Permanently blackout or whiteout sensitive CNIC numbers, bank accounts, signatures, or personal data.
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
              title="Drop PDF to Redact & Blackout Sensitive Data"
              subtitle="100% private in-browser editing. No data ever leaves your computer."
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {selectedFile.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)} • {totalPages} Total Pages • {boxes.length} Blackout Box(es)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setResult(null);
                  setBoxes([]);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition"
              >
                Change PDF
              </button>
            </div>

            {/* Redaction Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              {/* Color toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Marker Style:</span>
                <button
                  type="button"
                  onClick={() => setBoxColor('black')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    boxColor === 'black'
                      ? 'bg-slate-900 text-white dark:bg-black dark:text-white shadow-sm'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <span className="w-3 h-3 rounded-sm bg-black border border-slate-600 inline-block" />
                  Blackout Box
                </button>
                <button
                  type="button"
                  onClick={() => setBoxColor('white')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    boxColor === 'white'
                      ? 'bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-white font-semibold shadow-sm'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <span className="w-3 h-3 rounded-sm bg-white border border-slate-400 inline-block" />
                  Whiteout Box
                </button>
              </div>

              {/* Page Navigator */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                </button>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition"
                >
                  <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                </button>
              </div>

              {/* Undo / Clear actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={boxes.length === 0}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 flex items-center gap-1 transition"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Undo
                </button>
                <button
                  type="button"
                  onClick={handleClearCurrentPage}
                  className="px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Page
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 text-center italic">
              💡 Click and drag with your mouse/touch on the page below to draw a permanent blackout box over any text or number.
            </p>

            {/* Interactive PDF Page Canvas */}
            <div className="flex justify-center bg-slate-200/80 dark:bg-slate-950 p-4 rounded-2xl overflow-auto border border-slate-300 dark:border-slate-800">
              <div className="relative shadow-xl rounded-md overflow-hidden bg-white">
                <canvas ref={canvasRef} className="block" />
                <canvas
                  ref={overlayCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="absolute inset-0 cursor-crosshair"
                />

                {/* Live dragging visual rectangle */}
                {currentDragRect && (
                  <div
                    style={{
                      position: 'absolute',
                      left: currentDragRect.x,
                      top: currentDragRect.y,
                      width: currentDragRect.w,
                      height: currentDragRect.h,
                      backgroundColor: boxColor === 'black' ? '#0f172a' : '#ffffff',
                      border: '1.5px dashed #ef4444',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Action Button */}
            {!result && (
              <button
                type="button"
                onClick={handleApplyRedaction}
                disabled={isProcessing || boxes.length === 0}
                className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <EyeOff className="w-5 h-5" />
                {isProcessing
                  ? 'Sanitizing Document...'
                  : `Apply & Permanently Redact (${boxes.length} Box${boxes.length === 1 ? '' : 'es'})`}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
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
                        Document Sanitized: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.boxCount} Redaction Box(es) permanently embedded • Size: {formatBytes(result.size)}
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
                  title="Sanitized PDF Ready for Sharing!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.boxCount} Redaction(s)`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
