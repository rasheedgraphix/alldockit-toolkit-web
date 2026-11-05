import React, { useState } from 'react';
import {
  Scissors,
  Download,
  CheckCircle2,
  FileText,
  FileArchive,
  Trash2,
  Layers,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { formatBytes, downloadBlob, createZipAndDownload, getPdfInfo } from '../../utils/fileHelpers';
import { splitPdfFile } from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface PdfSplitterViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfSplitterView: React.FC<PdfSplitterViewProps> = ({ onAddToHistory }) => {
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
  const [mode, setMode] = useState<'range' | 'delete' | 'every-page'>('range');
  const [pageRange, setPageRange] = useState('1');
  const [deletedPages, setDeletedPages] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [results, setResults] = useState<{ name: string; blob: Blob; pageCount: number }[] | null>(
    null
  );

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      const info = await getPdfInfo(file);
      setPageCount(info.pageCount);
      setPageRange(`1-${Math.min(3, info.pageCount)}`);
      setDeletedPages([]);
      setResults(null);
    }
  };

  const togglePageDeletion = (pageNum: number) => {
    setDeletedPages((prev) =>
      prev.includes(pageNum) ? prev.filter((p) => p !== pageNum) : [...prev, pageNum]
    );
  };

  const handleSplit = async () => {
    if (!selectedFile) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(10);
    setStatusText('Analyzing document structure...');

    try {
      const { files: outputFiles } = await splitPdfFile(
        selectedFile,
        {
          mode,
          pageRange,
          pagesToDelete: deletedPages,
        },
        (p, text) => {
          setProgress(p);
          setStatusText(text);
        }
      );

      setResults(outputFiles);

      const totalResultSize = outputFiles.reduce((sum, f) => sum + f.blob.size, 0);

      onAddToHistory({
        toolId: 'pdf-splitter',
        toolName: 'PDF Splitter',
        originalName: selectedFile.name,
        resultName:
          outputFiles.length === 1
            ? outputFiles[0].name
            : `${outputFiles.length} files (${selectedFile.name.replace('.pdf', '')}_split.zip)`,
        originalSize: selectedFile.size,
        resultSize: totalResultSize,
        savedBytes: Math.max(0, selectedFile.size - totalResultSize),
        resultBlob: outputFiles.length === 1 ? outputFiles[0].blob : undefined,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to split PDF';
      alert(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadAllAsZip = async () => {
    if (!results || results.length === 0 || !selectedFile) return;
    const zipName = `${selectedFile.name.replace('.pdf', '')}_split_pages.zip`;
    await createZipAndDownload(results, zipName);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            Split & Extract PDF Pages
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Extract specific page ranges, delete unwanted pages, or split an entire PDF into individual pages.
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
          title="Drop a PDF file to split"
          subtitle="Extract ranges, delete pages, or split into single page files"
        />
      ) : (
        <div className="space-y-6">
          {/* File Header */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-stone-500 font-mono">
                  {pageCount} total pages · {formatBytes(selectedFile.size)}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                setResults(null);
              }}
              className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 underline"
            >
              Choose different file
            </button>
          </div>

          {/* Mode Selector */}
          <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-5">
            <div className="flex flex-wrap gap-2 border-b border-stone-200 dark:border-stone-800 pb-4">
              <button
                type="button"
                onClick={() => setMode('range')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  mode === 'range'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                }`}
              >
                Extract Page Range
              </button>
              <button
                type="button"
                onClick={() => setMode('delete')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  mode === 'delete'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                }`}
              >
                Delete Specific Pages
              </button>
              <button
                type="button"
                onClick={() => setMode('every-page')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  mode === 'every-page'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                }`}
              >
                Extract Every Single Page
              </button>
            </div>

            {/* Mode-specific configuration */}
            {mode === 'range' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                  Page Range Expression
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={pageRange}
                    onChange={(e) => setPageRange(e.target.value)}
                    placeholder="e.g. 1-3, 5, 8-10"
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPageRange(`1-${pageCount}`)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:opacity-80"
                    >
                      All (1-{pageCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageRange('1')}
                      className="px-3 py-1.5 rounded-lg text-xs bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:opacity-80"
                    >
                      First Page Only
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-stone-500">
                  Separate individual pages with commas or ranges with hyphens (e.g. 1-4, 7, 9-12).
                </p>
              </div>
            )}

            {mode === 'delete' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
                    Click pages to mark for deletion ({deletedPages.length} marked)
                  </p>
                  {deletedPages.length > 0 && (
                    <button
                      onClick={() => setDeletedPages([])}
                      className="text-xs text-stone-500 hover:underline"
                    >
                      Reset selection
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-2 bg-white dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700">
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => {
                    const isDeleted = deletedPages.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePageDeletion(p)}
                        className={`h-11 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                          isDeleted
                            ? 'bg-red-500 text-white line-through opacity-80'
                            : 'bg-stone-100 dark:bg-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-600'
                        }`}
                      >
                        <span>p. {p}</span>
                        {isDeleted && <span className="text-[9px]">DELETE</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-stone-500">
                  Pages highlighted in red will be removed. The rest will be saved in the new PDF.
                </p>
              </div>
            )}

            {mode === 'every-page' && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                This will create {pageCount} separate individual PDF files, which you can download
                individually or in one click as a ZIP file.
              </div>
            )}

            <div className="pt-2">
              <button
                id="split-execute-button"
                onClick={handleSplit}
                disabled={isProcessing}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm cursor-pointer ${
                  !user && guestUsage >= 1
                    ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                    : 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90'
                }`}
              >
                <Scissors className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? 'Processing...'
                    : !user && guestUsage >= 1
                    ? 'Start Free Trial to Split'
                    : 'Execute Split Operation'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {results && results.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-bold">Split Complete!</h3>
            </div>
            {results.length > 1 && (
              <button
                id="download-split-zip-button"
                onClick={handleDownloadAllAsZip}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 shadow-sm"
              >
                <FileArchive className="w-3.5 h-3.5" />
                Download All as ZIP
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-stone-500 shrink-0" />
                  <span className="font-medium text-stone-900 dark:text-stone-100 truncate">
                    {r.name}
                  </span>
                  <span className="text-[11px] text-stone-500 font-mono">
                    ({formatBytes(r.blob.size)})
                  </span>
                </div>
                <button
                  onClick={() => downloadBlob(r.blob, r.name)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-600 font-medium shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
