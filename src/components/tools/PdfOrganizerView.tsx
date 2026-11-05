import React, { useState, useEffect } from 'react';
import {
  Layers,
  RotateCw,
  RotateCcw,
  Trash2,
  Download,
  CheckCircle2,
  Sparkles,
  ArrowUpDown,
  MoveLeft,
  MoveRight,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { formatBytes, downloadBlob, getPdfInfo } from '../../utils/fileHelpers';
import {
  generatePdfPageThumbnails,
  organizePdfPages,
  PageOrganizeItem,
} from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface PdfOrganizerViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfOrganizerView: React.FC<PdfOrganizerViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageOrganizeItem[]>([]);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [resultPdf, setResultPdf] = useState<{ blob: Blob; pageCount: number } | null>(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      setResultPdf(null);
      setIsLoadingThumbnails(true);
      setProgress(10);
      setStatusText('Generating page previews...');

      try {
        const thumbs = await generatePdfPageThumbnails(file, (p) => setProgress(p));
        const initialPages: PageOrganizeItem[] = thumbs.map((t, idx) => ({
          originalIndex: idx,
          pageNumber: t.pageNumber,
          rotation: 0,
          isDeleted: false,
          thumbnailUrl: t.thumbnailUrl,
        }));
        setPages(initialPages);
      } catch (err: any) {
        console.warn('Thumbnail generation fallback to basic structure:', err);
        const info = await getPdfInfo(file);
        const fallbackPages: PageOrganizeItem[] = Array.from(
          { length: info.pageCount },
          (_, idx) => ({
            originalIndex: idx,
            pageNumber: idx + 1,
            rotation: 0,
            isDeleted: false,
          })
        );
        setPages(fallbackPages);
      } finally {
        setIsLoadingThumbnails(false);
      }
    }
  };

  const rotatePage = (index: number, angle: number) => {
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === index ? { ...p, rotation: (p.rotation + angle + 360) % 360 } : p
      )
    );
  };

  const rotateAllPages = (angle: number) => {
    setPages((prev) =>
      prev.map((p) => ({ ...p, rotation: (p.rotation + angle + 360) % 360 }))
    );
  };

  const toggleDeletePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, isDeleted: !p.isDeleted } : p))
    );
  };

  const movePage = (fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= pages.length) return;

    setPages((prev) => {
      const newArr = [...prev];
      const temp = newArr[fromIndex];
      newArr[fromIndex] = newArr[toIndex];
      newArr[toIndex] = temp;
      return newArr;
    });
  };

  const handleSaveOrganized = async () => {
    if (!selectedFile) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    const activeCount = pages.filter((p) => !p.isDeleted).length;
    if (activeCount === 0) {
      alert('You cannot delete all pages. Keep at least one page.');
      return;
    }

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Reorganizing and applying transformations...');

    try {
      const result = await organizePdfPages(selectedFile, pages, (p, text) => {
        setProgress(p);
        setStatusText(text);
      });

      setResultPdf(result);

      onAddToHistory({
        toolId: 'pdf-organizer',
        toolName: 'PDF Page Organizer',
        originalName: selectedFile.name,
        resultName: `${selectedFile.name.replace('.pdf', '')}_organized.pdf`,
        originalSize: selectedFile.size,
        resultSize: result.blob.size,
        savedBytes: Math.max(0, selectedFile.size - result.blob.size),
        resultBlob: result.blob,
      });
    } catch (err: any) {
      console.error('Error organizing PDF:', err);
      alert(err.message || 'Failed to save organized PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!selectedFile || !resultPdf) return;
    downloadBlob(
      resultPdf.blob,
      `${selectedFile.name.replace('.pdf', '')}_organized.pdf`
    );
  };

  const activePagesCount = pages.filter((p) => !p.isDeleted).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            PDF Organize & Rotate Pages
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Reorder pages, rotate individual pages by 90°/180°, and delete unwanted pages with ease.
          </p>
        </div>
      </div>

      {!selectedFile ? (
        <DropZone
          onFilesSelected={handleFileSelected}
          acceptedFormats={['.pdf']}
          multiple={false}
          title="Drop your PDF here to organize pages"
          subtitle="Drag & drop, rotate, reorder, or delete pages in real-time."
        />
      ) : (
        <div className="space-y-6">
          {/* File summary & quick global actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800">
            <div>
              <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                {selectedFile.name}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {formatBytes(selectedFile.size)} • Total: {pages.length} pages • Active to export:{' '}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {activePagesCount} pages
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => rotateAllPages(90)}
                className="py-1.5 px-3 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Rotate All 90°
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPages([]);
                  setResultPdf(null);
                }}
                className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 font-medium px-3 py-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800"
              >
                Change File
              </button>
            </div>
          </div>

          {isLoadingThumbnails && (
            <ProgressBar progress={progress} statusText={statusText} />
          )}

          {/* Page Grid */}
          {!isLoadingThumbnails && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pages.map((page, idx) => (
                <div
                  key={`${page.originalIndex}-${idx}`}
                  className={`group relative rounded-2xl border p-2.5 transition-all flex flex-col justify-between ${
                    page.isDeleted
                      ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 opacity-50'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs hover:border-emerald-500'
                  }`}
                >
                  {/* Thumbnail with rotation */}
                  <div className="aspect-3/4 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 flex items-center justify-center relative">
                    {page.thumbnailUrl ? (
                      <img
                        src={page.thumbnailUrl}
                        alt={`Page ${page.pageNumber}`}
                        className="w-full h-full object-contain transition-transform duration-200"
                        style={{ transform: `rotate(${page.rotation}deg)` }}
                      />
                    ) : (
                      <div
                        className="text-xs font-bold text-stone-400 transition-transform"
                        style={{ transform: `rotate(${page.rotation}deg)` }}
                      >
                        Page {page.pageNumber}
                      </div>
                    )}

                    {page.rotation !== 0 && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white shadow-xs">
                        {page.rotation}°
                      </span>
                    )}

                    {page.isDeleted && (
                      <div className="absolute inset-0 bg-rose-900/40 flex items-center justify-center">
                        <span className="px-2 py-1 rounded bg-rose-600 text-white font-bold text-xs uppercase">
                          Removed
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Page Controls */}
                  <div className="mt-2 pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-[11px] text-stone-700 dark:text-stone-300">
                      #{idx + 1}
                    </span>

                    {/* Left / Right Move */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => movePage(idx, 'left')}
                        className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-20"
                        title="Move Left"
                      >
                        <MoveLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === pages.length - 1}
                        onClick={() => movePage(idx, 'right')}
                        className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-20"
                        title="Move Right"
                      >
                        <MoveRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Rotate */}
                    <button
                      type="button"
                      onClick={() => rotatePage(idx, 90)}
                      className="p-1 rounded text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                      title="Rotate 90° Clockwise"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleDeletePage(idx)}
                      className={`p-1 rounded ${
                        page.isDeleted
                          ? 'text-emerald-600 hover:bg-emerald-50'
                          : 'text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                      }`}
                      title={page.isDeleted ? 'Restore Page' : 'Delete Page'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Footer */}
          {!resultPdf && !isLoadingThumbnails && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveOrganized}
                disabled={isProcessing || activePagesCount === 0}
                className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                {isProcessing
                  ? 'Saving Organized PDF...'
                  : `Save & Export Organized PDF (${activePagesCount} Pages)`}
              </button>
            </div>
          )}

          {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

          {/* Success Download Card */}
          {resultPdf && (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                    PDF Organized Successfully!
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Exported {resultPdf.pageCount} pages • Size: {formatBytes(resultPdf.blob.size)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download Organized PDF
                </button>
                <button
                  type="button"
                  onClick={() => setResultPdf(null)}
                  className="py-2.5 px-4 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-50"
                >
                  Keep Editing
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
