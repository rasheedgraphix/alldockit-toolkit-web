import React, { useState } from 'react';
import {
  FileText,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Plus,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { BeforeAfterBadge } from '../BeforeAfterBadge';
import { formatBytes, downloadBlob, getPdfInfo } from '../../utils/fileHelpers';
import { mergePdfFiles } from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { checkLicense } from '../../utils/license';
import { ProLimitModal } from '../ProLimitModal';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { useAuth } from '../../contexts/AuthContext';

interface PdfFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
}

interface PdfMergerViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfMergerView: React.FC<PdfMergerViewProps> = ({ onAddToHistory }) => {
  const {
    user,
    isPro,
    isTrialActive,
    trialDaysLeft,
    verifyAccessBeforeAction,
    openUpgradeModal,
    guestUsage,
  } = useAuth();
  const [files, setFiles] = useState<PdfFileItem[]>([]);
  const [outputName, setOutputName] = useState('merged_document.pdf');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    totalOriginalSize: number;
    mergedSize: number;
    totalPages: number;
  } | null>(null);
  const [showProModal, setShowProModal] = useState(false);

  const handleFilesSelected = async (newFiles: File[]) => {
    const loadedItems: PdfFileItem[] = [];
    for (const f of newFiles) {
      const info = await getPdfInfo(f);
      loadedItems.push({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        name: f.name,
        size: f.size,
        pageCount: info.pageCount,
      });
    }
    setFiles((prev) => [...prev, ...loadedItems]);
    setResult(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setFiles((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;
      return updated;
    });
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    setFiles((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;
      return updated;
    });
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleMerge = async () => {
    if (files.length === 0) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    if (!checkLicense().isPro && files.length > 3) {
      setShowProModal(true);
      return;
    }
    setIsProcessing(true);
    setProgress(5);
    setStatusText('Preparing documents...');

    try {
      const rawFiles = files.map((f) => f.file);
      const totalOriginalSize = files.reduce((acc, f) => acc + f.size, 0);

      const { blob, pageCount } = await mergePdfFiles(rawFiles, (p, text) => {
        setProgress(p);
        setStatusText(text);
      });

      const finalName = outputName.endsWith('.pdf') ? outputName : `${outputName}.pdf`;

      setResult({
        blob,
        fileName: finalName,
        totalOriginalSize,
        mergedSize: blob.size,
        totalPages: pageCount,
      });

      onAddToHistory({
        toolId: 'pdf-merger',
        toolName: 'PDF Merger',
        originalName: `${files.length} PDFs (${files.map((f) => f.name).slice(0, 2).join(', ')}${files.length > 2 ? '...' : ''})`,
        resultName: finalName,
        originalSize: totalOriginalSize,
        resultSize: blob.size,
        savedBytes: Math.max(0, totalOriginalSize - blob.size),
        resultBlob: blob,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to merge PDF files';
      alert(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Description header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            Merge PDF Documents
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Combine multiple PDF files into a single unified document with custom page order.
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

      {/* Drop Zone */}
      <DropZone
        onFilesSelected={handleFilesSelected}
        acceptedFormats={['.pdf']}
        title="Drop PDF files to merge"
        subtitle="Select multiple PDFs to arrange and combine into one"
        hint="Reorder documents before merging using arrow buttons"
      />

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Queue ({files.length} {files.length === 1 ? 'file' : 'files'} ·{' '}
              {files.reduce((sum, f) => sum + f.pageCount, 0)} total pages)
            </h3>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-2">
            {files.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {idx + 1}. {item.name}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                      {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} · {formatBytes(item.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    title="Move Up"
                    className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === files.length - 1}
                    title="Move Down"
                    className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFile(item.id)}
                    title="Remove File"
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Merge Controls */}
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Output File Name
              </label>
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="merged_document.pdf"
                className="w-full sm:w-80 px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                id="merge-action-button"
                onClick={handleMerge}
                disabled={isProcessing || files.length === 0}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm cursor-pointer ${
                  !user && guestUsage >= 1
                    ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                    : 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? 'Merging...'
                    : !user && guestUsage >= 1
                    ? 'Start Free Trial to Merge'
                    : `Merge ${files.length} PDFs`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {/* Result Card with WhatsApp, Download, and Companion App Spotlight */}
      {result && (
        <TaskSuccessCard
          title="PDFs Successfully Merged!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.mergedSize}
          originalSize={result.totalOriginalSize}
          toolName="PDF Merger"
          infoBadge={`${result.totalPages} pages total`}
        />
      )}

      {/* Pro License Limit Modal */}
      <ProLimitModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
      />
    </div>
  );
};
