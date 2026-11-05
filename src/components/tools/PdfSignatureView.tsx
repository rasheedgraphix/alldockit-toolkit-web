import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PenTool,
  Type,
  Upload,
  Eraser,
  RotateCcw,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Move,
  Maximize2,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { getPdfInfo, formatBytes } from '../../utils/fileHelpers';
import { renderPdfPageToDataUrl, signPdfDocument, SignPdfOptions } from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface PdfSignatureViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type SigMode = 'draw' | 'type' | 'upload';

export const PdfSignatureView: React.FC<PdfSignatureViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagePreviewUrl, setPagePreviewUrl] = useState<string | null>(null);
  const [pageNaturalSize, setPageNaturalSize] = useState<{ width: number; height: number }>({
    width: 600,
    height: 800,
  });

  // Signature creation mode & parameters
  const [mode, setMode] = useState<SigMode>('draw');
  const [sigColor, setSigColor] = useState<string>('#1E3A8A'); // Navy blue default
  const [penWidth, setPenWidth] = useState<number>(3);
  const [typedName, setTypedName] = useState<string>('Hafiz Nouman');
  const [typedFont, setTypedFont] = useState<string>('italic');
  const [uploadedSigUrl, setUploadedSigUrl] = useState<string | null>(null);

  // Position & sizing on PDF
  const [sigXPercent, setSigXPercent] = useState<number>(65); // default bottom-right
  const [sigYPercent, setSigYPercent] = useState<number>(15);
  const [sigScale, setSigScale] = useState<number>(140); // width in points
  const [includeDateStamp, setIncludeDateStamp] = useState<boolean>(true);

  // Processing state & result
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
  } | null>(null);

  // Drawing Canvas Ref
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Load PDF page preview whenever file or currentPage changes
  useEffect(() => {
    if (!selectedFile) return;

    let isMounted = true;
    renderPdfPageToDataUrl(selectedFile, currentPage, 1.2)
      .then(({ dataUrl, width, height }) => {
        if (isMounted) {
          setPagePreviewUrl(dataUrl);
          setPageNaturalSize({ width, height });
        }
      })
      .catch((err) => {
        console.error('Error rendering PDF page preview:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedFile, currentPage]);

  // Handle PDF file selection
  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      setResult(null);
      try {
        const info = await getPdfInfo(file);
        setTotalPages(info.pageCount);
        setCurrentPage(1);
      } catch (err) {
        console.error('Error getting PDF info:', err);
      }
    }
  };

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = sigColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearDrawing = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Convert Typed Name or Drawing to PNG data URL
  const getSignatureDataUrl = useCallback((): string | null => {
    if (mode === 'draw') {
      const canvas = drawCanvasRef.current;
      if (!canvas || !hasDrawn) return null;
      return canvas.toDataURL('image/png');
    } else if (mode === 'type') {
      if (!typedName.trim()) return null;
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 140;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = sigColor;
      ctx.font = 'italic bold 44px "Brush Script MT", "Caveat", "Dancing Script", cursive, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, 200, 65);
      return canvas.toDataURL('image/png');
    } else if (mode === 'upload') {
      return uploadedSigUrl;
    }
    return null;
  }, [mode, hasDrawn, typedName, sigColor, uploadedSigUrl]);

  // Handle Image Upload for Signature
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedSigUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Click on PDF preview to reposition signature
  const handlePdfPreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPct = Math.min(Math.max((clickX / rect.width) * 100, 5), 85);
    // Note: PDF coordinate Y is from bottom, whereas browser is from top
    const yPct = Math.min(Math.max(((rect.height - clickY) / rect.height) * 100, 5), 90);

    setSigXPercent(Math.round(xPct));
    setSigYPercent(Math.round(yPct));
  };

  // Process & Sign PDF
  const handleSignPdf = async () => {
    if (!selectedFile) return;

    const signatureDataUrl = getSignatureDataUrl();
    if (!signatureDataUrl) {
      alert('Please create or upload your signature first.');
      return;
    }

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(10);
    setStatusText('Preparing PDF signer...');

    try {
      const dateText = `Signed: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}`;

      const options: SignPdfOptions = {
        signatureImageBase64: signatureDataUrl,
        targetPageNumber: currentPage,
        xPercent: sigXPercent,
        yPercent: sigYPercent,
        widthPoints: sigScale,
        heightPoints: Math.round((sigScale * 50) / 140),
        includeDateStamp: includeDateStamp,
        dateStampText: dateText,
      };

      const { blob } = await signPdfDocument(selectedFile, options, (p, text) => {
        setProgress(p);
        setStatusText(text);
      });

      const outputName = selectedFile.name.replace(/\.pdf$/i, '_signed.pdf');

      setResult({
        blob,
        fileName: outputName,
        size: blob.size,
      });

      onAddToHistory({
        toolId: 'pdf-signature',
        toolName: 'PDF Digital Signature & Stamp',
        originalName: selectedFile.name,
        resultName: outputName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: 0,
        resultBlob: blob,
      });
    } catch (err: any) {
      console.error('Sign PDF error:', err);
      alert(err?.message || 'Failed to sign PDF document.');
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
            <PenTool className="w-5 h-5 text-indigo-500" />
            <span>PDF Digital Signature & Stamp</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Draw, type, or upload your signature to stamp directly onto any page of your PDF 100% offline.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Zero Server Uploads</span>
        </div>
      </div>

      {/* Drop Zone */}
      {!selectedFile && (
        <DropZone
          onFilesSelected={handleFileSelected}
          acceptedFormats={['.pdf']}
          multiple={false}
          title="Drop your PDF here to sign"
          subtitle="Supports single or multi-page documents"
        />
      )}

      {/* Main Workspace */}
      {selectedFile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Signature Creator & Options */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  1. Create Signature
                </h3>
                {selectedFile && (
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setResult(null);
                    }}
                    className="text-[11px] text-red-500 hover:underline"
                  >
                    Change PDF
                  </button>
                )}
              </div>

              {/* Mode Switcher */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMode('draw')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    mode === 'draw'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Draw</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('type')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    mode === 'type'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Type</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('upload')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    mode === 'upload'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>
              </div>

              {/* Mode 1: Draw Canvas */}
              {mode === 'draw' && (
                <div className="space-y-3">
                  <div className="relative border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl overflow-hidden bg-stone-50 dark:bg-stone-950 flex items-center justify-center">
                    <canvas
                      ref={drawCanvasRef}
                      width={380}
                      height={140}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="cursor-crosshair touch-none w-full h-[140px]"
                    />
                    {!hasDrawn && (
                      <span className="absolute pointer-events-none text-xs text-stone-400 font-medium select-none">
                        ✍️ Sign here with mouse or finger
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {['#111827', '#1E3A8A', '#DC2626', '#047857'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setSigColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${
                            sigColor === c ? 'scale-110 border-amber-500 shadow-sm' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={clearDrawing}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mode 2: Type Signature */}
              {mode === 'type' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="e.g. Nouman Rasheed"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900"
                    />
                  </div>

                  <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-center">
                    <span
                      style={{ color: sigColor }}
                      className="text-2xl font-bold font-serif italic tracking-wide"
                    >
                      {typedName || 'Nouman Rasheed'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-stone-500">Color:</span>
                    <div className="flex items-center gap-1.5">
                      {['#111827', '#1E3A8A', '#DC2626', '#047857'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setSigColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${
                            sigColor === c ? 'scale-110 border-amber-500 shadow-sm' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 3: Upload Stamp / PNG */}
              {mode === 'upload' && (
                <div className="space-y-3">
                  <label className="block p-4 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl text-center cursor-pointer hover:border-emerald-500 transition-colors bg-stone-50 dark:bg-stone-950">
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                    <Upload className="w-6 h-6 mx-auto text-stone-400 mb-1" />
                    <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 block">
                      Upload Signature or Stamp (PNG/JPG)
                    </span>
                    <span className="text-[11px] text-stone-400">
                      Transparent PNG works best
                    </span>
                  </label>

                  {uploadedSigUrl && (
                    <div className="p-2 border border-stone-200 dark:border-stone-800 rounded-xl bg-stone-50 dark:bg-stone-950 flex items-center justify-center">
                      <img
                        src={uploadedSigUrl}
                        alt="Signature Preview"
                        className="max-h-20 object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Position & Sizing Settings */}
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  2. Sizing & Verification
                </h4>

                {/* Size Slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    <span>Signature Size</span>
                    <span>{sigScale} pt</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="240"
                    step="10"
                    value={sigScale}
                    onChange={(e) => setSigScale(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* Date Stamp Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700 dark:text-stone-300 select-none">
                  <input
                    type="checkbox"
                    checked={includeDateStamp}
                    onChange={(e) => setIncludeDateStamp(e.target.checked)}
                    className="rounded border-stone-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Calendar className="w-3.5 h-3.5 text-stone-500" />
                  <span>Include Official Date Stamp below signature</span>
                </label>
              </div>

              {/* Sign Action Button */}
              <button
                type="button"
                onClick={handleSignPdf}
                disabled={isProcessing}
                className="w-full py-3 px-4 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Sign Page {currentPage} & Download</span>
              </button>
            </div>
          </div>

          {/* Right Column: PDF Page Preview with Interactive Stamping */}
          <div className="lg:col-span-7 space-y-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
              {/* Pagination Controls */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Document Preview ({formatBytes(selectedFile.size)})
                </span>

                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold px-2">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                💡 <strong>Click anywhere</strong> on the page below to place or move your signature stamp:
              </p>

              {/* PDF Preview Canvas Box */}
              <div
                onClick={handlePdfPreviewClick}
                className="relative mx-auto rounded-xl border border-stone-300 dark:border-stone-700 shadow-md overflow-hidden bg-stone-100 dark:bg-stone-950 flex items-center justify-center min-h-[460px] cursor-crosshair select-none"
              >
                {pagePreviewUrl ? (
                  <img
                    src={pagePreviewUrl}
                    alt={`Page ${currentPage}`}
                    className="w-full object-contain pointer-events-none select-none max-h-[620px]"
                  />
                ) : (
                  <div className="text-xs text-stone-400 animate-pulse">
                    Rendering PDF page...
                  </div>
                )}

                {/* Live Signature Stamp Overlay */}
                <div
                  style={{
                    left: `${sigXPercent}%`,
                    bottom: `${sigYPercent}%`,
                    width: `${Math.round(sigScale * 0.9)}px`,
                  }}
                  className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 p-1 border-2 border-indigo-500/80 bg-indigo-500/10 rounded-lg flex flex-col items-center justify-center transition-all duration-75 shadow-lg"
                >
                  <div className="text-[10px] font-extrabold uppercase bg-indigo-600 text-white px-1.5 py-0.5 rounded shadow mb-1">
                    Signature Stamp
                  </div>

                  {mode === 'type' ? (
                    <span
                      style={{ color: sigColor }}
                      className="text-lg font-bold font-serif italic truncate"
                    >
                      {typedName || 'Nouman'}
                    </span>
                  ) : (
                    <PenTool className="w-5 h-5 text-indigo-600 mb-0.5" />
                  )}

                  {includeDateStamp && (
                    <span className="text-[9px] text-stone-700 dark:text-stone-300 font-mono mt-0.5">
                      {new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {/* Result Card with 1-Click WhatsApp Share, Download & RasheedGraphix Companion App Spotlight */}
      {result && (
        <TaskSuccessCard
          title="PDF Document Successfully Signed!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.size}
          toolName="PDF Digital Signature"
          infoBadge={`Page ${currentPage} Signed`}
        />
      )}
    </div>
  );
};
