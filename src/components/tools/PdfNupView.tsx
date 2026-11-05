import React, { useState } from 'react';
import {
  Grid,
  FileText,
  Download,
  AlertCircle,
  Sparkles,
  Settings2,
  CheckCircle2,
  LayoutGrid,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, rgb } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface PdfNupViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type NupMode = '2-up' | '4-up' | '8-up';
type PageOrientation = 'portrait' | 'landscape';

export const PdfNupView: React.FC<PdfNupViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourcePageCount, setSourcePageCount] = useState<number | null>(null);
  const [nupMode, setNupMode] = useState<NupMode>('2-up');
  const [orientation, setOrientation] = useState<PageOrientation>('landscape');
  const [drawBorder, setDrawBorder] = useState(true);
  const [margin, setMargin] = useState<number>(18); // points

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    sheetCount: number;
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
      const count = doc.getPageCount();
      setSourcePageCount(count);
      // Auto-set landscape for 2-up, landscape for 4-up
      if (nupMode === '2-up') setOrientation('landscape');
      else if (nupMode === '4-up') setOrientation('portrait');
    } catch (e: any) {
      setErrorMessage('Failed to read PDF pages. Please verify the file is not corrupted.');
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Loading document pages for multi-page handout layout...');
    setErrorMessage(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const totalPages = srcDoc.getPageCount();

      if (totalPages === 0) {
        throw new Error('PDF has 0 pages.');
      }

      const outDoc = await PDFDocument.create();

      // Determine grid configuration: rows, cols
      let cols = 2;
      let rows = 1;
      let perSheet = 2;

      if (nupMode === '2-up') {
        cols = orientation === 'landscape' ? 2 : 1;
        rows = orientation === 'landscape' ? 1 : 2;
        perSheet = 2;
      } else if (nupMode === '4-up') {
        cols = 2;
        rows = 2;
        perSheet = 4;
      } else if (nupMode === '8-up') {
        cols = orientation === 'landscape' ? 4 : 2;
        rows = orientation === 'landscape' ? 2 : 4;
        perSheet = 8;
      }

      // Standard A4 dimensions in points: 595.28 x 841.89
      const a4Short = 595.28;
      const a4Long = 841.89;
      const sheetWidth = orientation === 'portrait' ? a4Short : a4Long;
      const sheetHeight = orientation === 'portrait' ? a4Long : a4Short;

      const totalSheets = Math.ceil(totalPages / perSheet);

      // Embed all pages
      const pageIndices = Array.from({ length: totalPages }, (_, i) => i);
      const embeddedPages = await outDoc.embedPdf(srcDoc, pageIndices);

      const cellGap = 12;
      const usableWidth = sheetWidth - margin * 2 - cellGap * (cols - 1);
      const usableHeight = sheetHeight - margin * 2 - cellGap * (rows - 1);
      const cellWidth = usableWidth / cols;
      const cellHeight = usableHeight / rows;

      for (let sheetIdx = 0; sheetIdx < totalSheets; sheetIdx++) {
        setProgress(Math.round(20 + (sheetIdx / totalSheets) * 70));
        setStatusText(`Generating handout sheet ${sheetIdx + 1} of ${totalSheets}...`);

        const sheet = outDoc.addPage([sheetWidth, sheetHeight]);

        for (let cellIdx = 0; cellIdx < perSheet; cellIdx++) {
          const pageIndex = sheetIdx * perSheet + cellIdx;
          if (pageIndex >= totalPages) break;

          const embedded = embeddedPages[pageIndex];
          const embWidth = embedded.width;
          const embHeight = embedded.height;

          // Calculate col and row (0-indexed from top-left)
          const col = cellIdx % cols;
          const row = Math.floor(cellIdx / cols);

          // Calculate cell bounds
          const cellX = margin + col * (cellWidth + cellGap);
          // PDF origin (0,0) is bottom-left
          const cellY = sheetHeight - margin - (row + 1) * cellHeight - row * cellGap;

          // Fit page inside cell while preserving aspect ratio
          const scale = Math.min(cellWidth / embWidth, cellHeight / embHeight);
          const drawW = embWidth * scale;
          const drawH = embHeight * scale;

          // Center page inside the cell
          const drawX = cellX + (cellWidth - drawW) / 2;
          const drawY = cellY + (cellHeight - drawH) / 2;

          sheet.drawPage(embedded, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
          });

          // Optional clean border around each embedded page
          if (drawBorder) {
            sheet.drawRectangle({
              x: drawX,
              y: drawY,
              width: drawW,
              height: drawH,
              borderColor: rgb(0.78, 0.8, 0.83),
              borderWidth: 0.75,
            });
          }
        }
      }

      setProgress(95);
      setStatusText('Saving final printable handout document...');

      const savedBytes = await outDoc.save();
      const blob = new Blob([savedBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = selectedFile.name.replace(/\.pdf$/i, `_${nupMode}_handout.pdf`);

      setProgress(100);
      setStatusText('Handout created successfully!');

      setResult({
        blob,
        fileName,
        size: blob.size,
        sheetCount: totalSheets,
      });

      onAddToHistory({
        toolId: 'pdf-nup',
        toolName: `PDF ${nupMode.toUpperCase()} Handout Grid`,
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to process N-Up layout. Please try again.');
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
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Grid className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF N-Up Handout Grid Maker (2-in-1, 4-in-1, 8-in-1)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Unlimited
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Print slides, book pages, lecture notes & handouts on a single A4 sheet to save 50% to 75% paper!
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
              title="Drop your multi-page PDF here"
              subtitle="Supports presentation slides, lecture notes, receipts, books (Up to 100MB)"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {selectedFile.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)} • {sourcePageCount !== null ? `${sourcePageCount} Pages` : 'Loading...'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setResult(null);
                  setSourcePageCount(null);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition"
              >
                Change File
              </button>
            </div>

            {/* Layout Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Pages Per Sheet (N-Up Layout)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNupMode('2-up');
                      setOrientation('landscape');
                    }}
                    className={`py-3 px-3 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      nupMode === '2-up'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base font-bold">2-in-1</span>
                    <span className="text-[11px] opacity-75">Save 50% Paper</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNupMode('4-up');
                      setOrientation('portrait');
                    }}
                    className={`py-3 px-3 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      nupMode === '4-up'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base font-bold">4-in-1 (2×2)</span>
                    <span className="text-[11px] opacity-75">Save 75% Paper</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNupMode('8-up');
                      setOrientation('landscape');
                    }}
                    className={`py-3 px-3 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      nupMode === '8-up'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base font-bold">8-in-1</span>
                    <span className="text-[11px] opacity-75">Pocket Handout</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Target Sheet Orientation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`py-3 px-3 rounded-xl border text-center transition ${
                      orientation === 'landscape'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    Landscape (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`py-3 px-3 rounded-xl border text-center transition ${
                      orientation === 'portrait'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    Portrait (Vertical)
                  </button>
                </div>
              </div>
            </div>

            {/* Additional Options */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300 font-medium">
                <input
                  type="checkbox"
                  checked={drawBorder}
                  onChange={(e) => setDrawBorder(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                Draw clean separator borders around each slide/page
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Sheet Margins:</span>
                <select
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value={9}>Compact (9 pt)</option>
                  <option value={18}>Standard (18 pt)</option>
                  <option value={36}>Wide (36 pt)</option>
                </select>
              </div>
            </div>

            {/* Action Button */}
            {!result && (
              <button
                type="button"
                onClick={handleProcess}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Grid className="w-5 h-5" />
                {isProcessing ? 'Generating Handout...' : `Create ${nupMode.toUpperCase()} Printable Handout`}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
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
                        Handout Created: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Total {result.sheetCount} Printable A4 Sheet(s) • Size: {formatBytes(result.size)}
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
                  title="Handout Sheet Ready to Print!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.sheetCount} Sheets`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
