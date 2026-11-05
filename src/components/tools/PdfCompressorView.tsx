import React, { useState } from 'react';
import {
  Minimize2,
  Download,
  CheckCircle2,
  FileText,
  Gauge,
  Sparkles,
  Zap,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { BeforeAfterBadge } from '../BeforeAfterBadge';
import { formatBytes, downloadBlob, getPdfInfo } from '../../utils/fileHelpers';
import { compressPdfFile } from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface PdfCompressorViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfCompressorView: React.FC<PdfCompressorViewProps> = ({ onAddToHistory }) => {
  const {
    user,
    isTrialActive,
    trialDaysLeft,
    verifyAccessBeforeAction,
    openUpgradeModal,
    guestUsage,
  } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [level, setLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    originalSize: number;
    newSize: number;
  } | null>(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      const info = await getPdfInfo(file);
      setPageCount(info.pageCount);
      setResult(null);
    }
  };

  const handleCompress = async () => {
    if (!selectedFile) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Initiating compression engines...');

    try {
      const { blob, originalSize, newSize } = await compressPdfFile(
        selectedFile,
        level,
        (p, text) => {
          setProgress(p);
          setStatusText(text);
        }
      );

      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const fileName = `${baseName}_compressed.pdf`;

      setResult({
        blob,
        fileName,
        originalSize,
        newSize,
      });

      onAddToHistory({
        toolId: 'pdf-compressor',
        toolName: 'PDF Compressor',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize,
        resultSize: newSize,
        savedBytes: Math.max(0, originalSize - newSize),
        resultBlob: blob,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to compress PDF';
      alert(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            Compress PDF Document
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Reduce PDF file size locally using cross-reference deduplication, stream packing, and structure optimization.
          </p>
        </div>

        {user ? (
          isTrialActive && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold self-start sm:self-auto">
              <span>Trial: {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left</span>
            </div>
          )
        ) : guestUsage === 0 ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto">
            <span>1 Free Guest Conversion</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openUpgradeModal('guest_limit')}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-colors cursor-pointer self-start sm:self-auto animate-pulse"
          >
            <span>Free Limit Reached · Start 7-Day Trial</span>
          </button>
        )}
      </div>

      {!selectedFile ? (
        <DropZone
          onFilesSelected={handleFileSelected}
          acceptedFormats={['.pdf']}
          multiple={false}
          title="Drop a PDF file to compress"
          subtitle="Choose between Low, Medium, or High compression levels"
        />
      ) : (
        <div className="space-y-6">
          {/* File Card */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-stone-500 font-mono">
                  {pageCount} pages · {formatBytes(selectedFile.size)}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                setResult(null);
              }}
              className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 underline"
            >
              Choose different file
            </button>
          </div>

          {/* Compression Level Selector */}
          <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
              Select Compression Level
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Low */}
              <div
                onClick={() => setLevel('low')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  level === 'low'
                    ? 'border-stone-900 bg-white dark:border-stone-100 dark:bg-stone-800 shadow-sm ring-2 ring-stone-900/10 dark:ring-stone-100/10'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Low Compression
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Best visual fidelity. Cleans up redundant objects and repacks stream tables losslessly.
                </p>
              </div>

              {/* Medium */}
              <div
                onClick={() => setLevel('medium')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  level === 'medium'
                    ? 'border-stone-900 bg-white dark:border-stone-100 dark:bg-stone-800 shadow-sm ring-2 ring-stone-900/10 dark:ring-stone-100/10'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Medium (Recommended)
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Optimal balance between size reduction and crispness. Strips metadata and condenses streams.
                </p>
              </div>

              {/* High */}
              <div
                onClick={() => setLevel('high')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  level === 'high'
                    ? 'border-stone-900 bg-white dark:border-stone-100 dark:bg-stone-800 shadow-sm ring-2 ring-stone-900/10 dark:ring-stone-100/10'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    High Compression
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Maximum file reduction. Strips unreferenced resources and applies dense PDF 1.5 object compaction.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="compress-execute-button"
                onClick={handleCompress}
                disabled={isProcessing}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm cursor-pointer ${
                  !user && guestUsage >= 1
                    ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                    : 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90'
                }`}
              >
                <Minimize2 className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? 'Compressing...'
                    : !user && guestUsage >= 1
                    ? 'Start Free Trial to Compress'
                    : 'Compress PDF'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {result && (
        <div
          id="compress-result-card"
          className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-bold">PDF Successfully Compressed!</h3>
            </div>
          </div>

          <BeforeAfterBadge
            originalSize={result.originalSize}
            newSize={result.newSize}
          />

          <div className="pt-2">
            <button
              id="download-compressed-pdf-button"
              onClick={() => downloadBlob(result.blob, result.fileName)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download {result.fileName}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
