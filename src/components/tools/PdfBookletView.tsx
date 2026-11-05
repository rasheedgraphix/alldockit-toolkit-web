import React, { useState } from 'react';
import {
  BookOpen,
  Printer,
  Download,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Settings2,
  FileText,
  Layers,
  FoldHorizontal,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, rgb } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface PdfBookletViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type BookletPrintOrder = 'duplex' | 'manual-separated';

export const PdfBookletView: React.FC<PdfBookletViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalPageCount, setOriginalPageCount] = useState<number | null>(null);
  const [printOrder, setPrintOrder] = useState<BookletPrintOrder>('duplex');
  const [margin, setMargin] = useState<number>(14);
  const [drawFoldLine, setDrawFoldLine] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    sheetCount: number;
    totalBookletPages: number;
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
      const pages = doc.getPageCount();
      setOriginalPageCount(pages);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not inspect PDF pages. Make sure the file is not password-protected.');
    }
  };

  const handleMakeBooklet = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(5);
    setStatusText('Reading source PDF document...');
    setErrorMessage(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const srcPageCount = srcDoc.getPageCount();

      if (srcPageCount < 1) {
        throw new Error('PDF has no pages.');
      }

      // Pad to a multiple of 4
      const bookletPageCount = Math.ceil(srcPageCount / 4) * 4;
      const sheetCount = bookletPageCount / 4;

      setProgress(20);
      setStatusText(`Calculating imposition for ${bookletPageCount} booklet pages (${sheetCount} A4 sheets)...`);

      // All indices needed from srcDoc
      const allSrcIndices: number[] = [];
      for (let i = 0; i < srcPageCount; i++) {
        allSrcIndices.push(i);
      }

      const outDoc = await PDFDocument.create();
      const embeddedPages = await outDoc.embedPdf(srcDoc, allSrcIndices);

      // Landscape A4 dimensions in points
      const sheetWidth = 841.89;
      const sheetHeight = 595.28;
      const halfWidth = sheetWidth / 2;

      interface SheetSide {
        sheetIndex: number;
        side: 'front' | 'back';
        leftIndex: number;
        rightIndex: number;
      }

      const frontSides: SheetSide[] = [];
      const backSides: SheetSide[] = [];

      for (let s = 0; s < sheetCount; s++) {
        // Front side: Left is back-most page, Right is front-most page
        frontSides.push({
          sheetIndex: s + 1,
          side: 'front',
          leftIndex: bookletPageCount - 1 - 2 * s,
          rightIndex: 2 * s,
        });

        // Back side: Left is next page, Right is corresponding back page
        backSides.push({
          sheetIndex: s + 1,
          side: 'back',
          leftIndex: 2 * s + 1,
          rightIndex: bookletPageCount - 1 - (2 * s + 1),
        });
      }

      const renderQueue: SheetSide[] =
        printOrder === 'duplex'
          ? frontSides.flatMap((front, i) => [front, backSides[i]])
          : [...frontSides, ...backSides];

      const totalRenderPages = renderQueue.length;

      for (let idx = 0; idx < totalRenderPages; idx++) {
        const item = renderQueue[idx];
        const page = outDoc.addPage([sheetWidth, sheetHeight]);

        // Draw fold guide line in center
        if (drawFoldLine) {
          page.drawLine({
            start: { x: halfWidth, y: 15 },
            end: { x: halfWidth, y: sheetHeight - 15 },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.85),
            dashArray: [4, 4],
          });
        }

        // Draw Left page
        if (item.leftIndex < srcPageCount) {
          const embLeft = embeddedPages[item.leftIndex];
          const boxW = halfWidth - margin * 2;
          const boxH = sheetHeight - margin * 2;

          const scale = Math.min(boxW / embLeft.width, boxH / embLeft.height);
          const scaledW = embLeft.width * scale;
          const scaledH = embLeft.height * scale;

          const posX = margin + (boxW - scaledW) / 2;
          const posY = margin + (boxH - scaledH) / 2;

          page.drawPage(embLeft, {
            x: posX,
            y: posY,
            width: scaledW,
            height: scaledH,
          });
        }

        // Draw Right page
        if (item.rightIndex < srcPageCount) {
          const embRight = embeddedPages[item.rightIndex];
          const boxW = halfWidth - margin * 2;
          const boxH = sheetHeight - margin * 2;

          const scale = Math.min(boxW / embRight.width, boxH / embRight.height);
          const scaledW = embRight.width * scale;
          const scaledH = embRight.height * scale;

          const posX = halfWidth + margin + (boxW - scaledW) / 2;
          const posY = margin + (boxH - scaledH) / 2;

          page.drawPage(embRight, {
            x: posX,
            y: posY,
            width: scaledW,
            height: scaledH,
          });
        }

        const pct = Math.round(25 + (idx / totalRenderPages) * 70);
        setProgress(pct);
        setStatusText(
          `Arranging Sheet ${Math.floor(idx / 2) + 1} (${item.side === 'front' ? 'Front Side' : 'Back Side'})...`
        );
      }

      setProgress(98);
      setStatusText('Saving print-ready booklet PDF...');
      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const fileName = `${baseName}_Booklet_Ready.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
        sheetCount,
        totalBookletPages: bookletPageCount,
      });

      onAddToHistory({
        toolId: 'pdf-booklet',
        toolName: 'PDF Booklet & Magazine Studio',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to generate booklet layout. Please try again.');
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
          <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF Booklet & Magazine Maker (Saddle Stitch)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Unlimited
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Transform any multi-page PDF into a foldable, ready-to-print A4 booklet. Just print double-sided, fold in half, and staple!
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
              title="Drop your multi-page PDF document here"
              subtitle="Supports books, brochures, company catalogs, magazines & lecture notes (Up to 100MB)"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* File info bar */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)} • {originalPageCount !== null ? `${originalPageCount} Pages` : 'Reading...'}
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

            {/* Imposition Info Card */}
            {originalPageCount !== null && (
              <div className="p-4 rounded-xl bg-violet-50/60 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 flex items-start gap-3">
                <FoldHorizontal className="w-5 h-5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-violet-900 dark:text-violet-300 space-y-1">
                  <p className="font-semibold text-sm">
                    Booklet Imposition Plan: {Math.ceil(originalPageCount / 4) * 4} Total Pages ({Math.ceil(originalPageCount / 4)} Physical A4 Sheets)
                  </p>
                  <p>
                    {originalPageCount % 4 !== 0
                      ? `Your document has ${originalPageCount} pages. ${4 - (originalPageCount % 4)} blank page(s) will be automatically added at the end so the booklet folds perfectly.`
                      : `Your document already has a perfect multiple of 4 pages (${originalPageCount} pages).`}
                  </p>
                </div>
              </div>
            )}

            {/* Booklet Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-violet-600" />
                Printer & Imposition Configuration
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Print Order */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Printer Duplex Mode
                  </label>
                  <select
                    value={printOrder}
                    onChange={(e) => setPrintOrder(e.target.value as BookletPrintOrder)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="duplex">
                      Interleaved Front & Back (Automatic 2-Sided Duplex Printers)
                    </option>
                    <option value="manual-separated">
                      All Fronts First, Then All Backs (Manual Duplex / Flip by Hand)
                    </option>
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {printOrder === 'duplex'
                      ? 'Best for automatic double-sided office printers (Sheet 1 Front, Sheet 1 Back, etc.).'
                      : 'Best for standard home printers: print all front sheets, flip the paper stack over, and print the back sheets.'}
                  </p>
                </div>

                {/* Margins */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Page Margin Padding
                  </label>
                  <select
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value={8}>Slim / Compact (8 pt)</option>
                    <option value={14}>Standard Booklet Margin (14 pt)</option>
                    <option value={24}>Wide Margin for Thick Stapling (24 pt)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Keeps content away from the center fold line and outer trim edges.
                  </p>
                </div>
              </div>

              {/* Guide lines toggle */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={drawFoldLine}
                    onChange={(e) => setDrawFoldLine(e.target.checked)}
                    className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                  />
                  Draw subtle center dashed fold & staple line
                </label>
                <span className="text-[11px] text-slate-400">Helps with exact folding alignment</span>
              </div>
            </div>

            {/* Action button */}
            {!result && (
              <button
                type="button"
                onClick={handleMakeBooklet}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <BookOpen className="w-5 h-5" />
                {isProcessing ? 'Generating Booklet...' : 'Create Print-Ready A4 Booklet'}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50">
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
                        Booklet Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.sheetCount} Physical A4 Sheets ({result.totalBookletPages} Booklet Pages) • {formatBytes(result.size)}
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
                  title="Print-Ready Booklet Created!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.sheetCount} Sheets (${result.totalBookletPages} Pages)`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
