import React, { useState } from 'react';
import {
  GitCompare,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
  Columns2,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';
import { getPdfJs } from '../../utils/pdfOperations';

interface PdfCompareViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

interface PageDiffItem {
  pageNumber: number;
  addedLines: string[];
  removedLines: string[];
  identical: boolean;
}

export const PdfCompareView: React.FC<PdfCompareViewProps> = ({ onAddToHistory }) => {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [diffs, setDiffs] = useState<PageDiffItem[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    pagesCompared: number;
    changedPages: number;
  } | null>(null);

  const extractPageLines = async (pdf: any, pageNum: number): Promise<string[]> => {
    if (pageNum > pdf.numPages) return [];
    const page = await pdf.getPage(pageNum);
    const tc = await page.getTextContent();
    const items = tc.items as any[];

    const buckets: { y: number; items: { x: number; str: string }[] }[] = [];
    for (const it of items) {
      const s = (it.str || '').trim();
      if (!s) continue;
      const x = it.transform ? it.transform[4] : 0;
      const y = it.transform ? it.transform[5] : 0;
      let b = buckets.find((bk) => Math.abs(bk.y - y) < 4);
      if (!b) {
        b = { y, items: [] };
        buckets.push(b);
      }
      b.items.push({ x, str: s });
    }
    buckets.sort((a, b) => b.y - a.y);
    return buckets.map((b) => {
      b.items.sort((x1, x2) => x1.x - x2.x);
      return b.items.map((i) => i.str).join(' ').replace(/\s{2,}/g, ' ').trim();
    });
  };

  const handleCompare = async () => {
    if (!fileA || !fileB) {
      setErrorMessage('Please upload both Original PDF (File A) and Revised PDF (File B).');
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setStatusText('Loading both PDF documents for comparison...');
    setErrorMessage(null);

    try {
      const pdfjs = await getPdfJs();
      const [bufA, bufB] = await Promise.all([fileA.arrayBuffer(), fileB.arrayBuffer()]);

      const [pdfA, pdfB] = await Promise.all([
        pdfjs.getDocument({ data: new Uint8Array(bufA) }).promise,
        pdfjs.getDocument({ data: new Uint8Array(bufB) }).promise,
      ]);

      const maxPages = Math.max(pdfA.numPages, pdfB.numPages);
      const computedDiffs: PageDiffItem[] = [];
      let changedCount = 0;

      for (let p = 1; p <= maxPages; p++) {
        setStatusText(`Comparing text & layout on Page ${p} of ${maxPages}...`);
        const [linesA, linesB] = await Promise.all([
          extractPageLines(pdfA, p),
          extractPageLines(pdfB, p),
        ]);

        const setA = new Set(linesA);
        const setB = new Set(linesB);

        const removed = linesA.filter((l) => !setB.has(l));
        const added = linesB.filter((l) => !setA.has(l));
        const identical = removed.length === 0 && added.length === 0;

        if (!identical) changedCount++;

        computedDiffs.push({
          pageNumber: p,
          addedLines: added,
          removedLines: removed,
          identical,
        });

        setProgress(Math.round(15 + (p / maxPages) * 45));
      }

      setDiffs(computedDiffs);

      // Generate Side-by-Side Comparison Report PDF
      setStatusText('Generating Side-by-Side Visual Comparison PDF Report...');
      const docA = await PDFDocument.load(bufA, { ignoreEncryption: true });
      const docB = await PDFDocument.load(bufB, { ignoreEncryption: true });
      const outDoc = await PDFDocument.create();
      const boldFont = await outDoc.embedFont(StandardFonts.HelveticaBold);
      const regFont = await outDoc.embedFont(StandardFonts.Helvetica);

      const indicesA = Array.from({ length: docA.getPageCount() }, (_, i) => i);
      const indicesB = Array.from({ length: docB.getPageCount() }, (_, i) => i);

      const embPagesA = indicesA.length > 0 ? await outDoc.embedPdf(docA, indicesA) : [];
      const embPagesB = indicesB.length > 0 ? await outDoc.embedPdf(docB, indicesB) : [];

      const sheetW = 841.89; // Landscape A4
      const sheetH = 595.28;
      const halfW = sheetW / 2;

      for (let i = 0; i < maxPages; i++) {
        const page = outDoc.addPage([sheetW, sheetH]);
        const diffInfo = computedDiffs[i];

        // Top Banner
        page.drawRectangle({
          x: 0,
          y: sheetH - 34,
          width: sheetW,
          height: 34,
          color: diffInfo.identical ? rgb(0.93, 0.98, 0.95) : rgb(0.99, 0.93, 0.93),
        });

        page.drawText(
          `Page ${i + 1} Comparison — ${
            diffInfo.identical
              ? 'IDENTICAL (No Text Changes)'
              : `DIFFERENCES FOUND (-${diffInfo.removedLines.length} Removed / +${diffInfo.addedLines.length} Added)`
          }`,
          {
            x: 20,
            y: sheetH - 22,
            size: 11,
            font: boldFont,
            color: diffInfo.identical ? rgb(0.05, 0.45, 0.25) : rgb(0.75, 0.12, 0.18),
          }
        );

        // Center divider
        page.drawLine({
          start: { x: halfW, y: 15 },
          end: { x: halfW, y: sheetH - 34 },
          thickness: 1,
          color: rgb(0.8, 0.82, 0.86),
        });

        // Draw Original (Left)
        if (i < embPagesA.length) {
          const ep = embPagesA[i];
          const boxW = halfW - 30;
          const boxH = sheetH - 65;
          const scale = Math.min(boxW / ep.width, boxH / ep.height);
          const w = ep.width * scale;
          const h = ep.height * scale;
          page.drawPage(ep, {
            x: 15 + (boxW - w) / 2,
            y: 15 + (boxH - h) / 2,
            width: w,
            height: h,
          });
        }

        // Draw Revised (Right)
        if (i < embPagesB.length) {
          const ep = embPagesB[i];
          const boxW = halfW - 30;
          const boxH = sheetH - 65;
          const scale = Math.min(boxW / ep.width, boxH / ep.height);
          const w = ep.width * scale;
          const h = ep.height * scale;
          page.drawPage(ep, {
            x: halfW + 15 + (boxW - w) / 2,
            y: 15 + (boxH - h) / 2,
            width: w,
            height: h,
          });
        }

        page.drawText('Original Document (A)', {
          x: 20,
          y: sheetH - 48,
          size: 8.5,
          font: regFont,
          color: rgb(0.4, 0.42, 0.48),
        });

        page.drawText('Revised Document (B)', {
          x: halfW + 20,
          y: sheetH - 48,
          size: 8.5,
          font: regFont,
          color: rgb(0.4, 0.42, 0.48),
        });

        setProgress(Math.round(60 + ((i + 1) / maxPages) * 35));
      }

      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = `PDF_Comparison_Report_${maxPages}_Pages.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
        pagesCompared: maxPages,
        changedPages: changedCount,
      });

      onAddToHistory({
        toolId: 'pdf-compare',
        toolName: 'Compare PDF (Diff Studio)',
        originalName: `${fileA.name} vs ${fileB.name}`,
        resultName: fileName,
        originalSize: fileA.size + fileB.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, fileA.size + fileB.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to compare PDF files.');
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
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <GitCompare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Compare PDF (Side-by-Side Diff Viewer)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Compare two versions of a contract, invoice, or book PDF to spot exact text additions, deletions, and side-by-side differences.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* File A */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                1. Original PDF (Version A)
              </span>
              {fileA && (
                <button
                  type="button"
                  onClick={() => {
                    setFileA(null);
                    setResult(null);
                    setDiffs([]);
                  }}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Change
                </button>
              )}
            </div>
            {!fileA ? (
              <DropZone
                onFilesSelected={(f) => f[0] && setFileA(f[0])}
                acceptedFormats={['.pdf']}
                multiple={false}
                title="Drop Original PDF"
                subtitle="First / Older version"
              />
            ) : (
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                <FileText className="w-6 h-6 text-purple-600 flex-shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {fileA.name}
                  </div>
                  <div className="text-[11px] text-slate-500">{formatBytes(fileA.size)}</div>
                </div>
              </div>
            )}
          </div>

          {/* File B */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                2. Revised PDF (Version B)
              </span>
              {fileB && (
                <button
                  type="button"
                  onClick={() => {
                    setFileB(null);
                    setResult(null);
                    setDiffs([]);
                  }}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Change
                </button>
              )}
            </div>
            {!fileB ? (
              <DropZone
                onFilesSelected={(f) => f[0] && setFileB(f[0])}
                acceptedFormats={['.pdf']}
                multiple={false}
                title="Drop Revised PDF"
                subtitle="Second / Modified version"
              />
            ) : (
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                <FileText className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {fileB.name}
                  </div>
                  <div className="text-[11px] text-slate-500">{formatBytes(fileB.size)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {fileA && fileB && (
          <div className="mt-6 space-y-6">
            {!result && (
              <button
                type="button"
                onClick={handleCompare}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <GitCompare className="w-5 h-5" />
                {isProcessing ? 'Comparing Documents...' : 'Compare Both PDFs & Generate Diff Report'}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50">
                <ProgressBar progress={progress} statusText={statusText} />
              </div>
            )}

            {diffs.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Columns2 className="w-4 h-4 text-purple-600" />
                  Page-by-Page Text Difference Summary
                </h4>
                <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                  {diffs.map((d) => (
                    <div
                      key={d.pageNumber}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Page {d.pageNumber}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                            d.identical
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {d.identical
                            ? 'Identical'
                            : `${d.removedLines.length} Removed • ${d.addedLines.length} Added`}
                        </span>
                      </div>

                      {!d.identical && (
                        <div className="space-y-1 font-mono text-[11px]">
                          {d.removedLines.slice(0, 5).map((line, idx) => (
                            <div
                              key={`rem-${idx}`}
                              className="p-1.5 rounded bg-rose-100/70 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300"
                            >
                              - {line}
                            </div>
                          ))}
                          {d.addedLines.slice(0, 5).map((line, idx) => (
                            <div
                              key={`add-${idx}`}
                              className="p-1.5 rounded bg-emerald-100/70 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
                            >
                              + {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                        Side-by-Side Comparison Report Ready
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.pagesCompared} Pages Compared • {result.changedPages} Pages with Differences • {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    Download Report PDF
                  </button>
                </div>

                <TaskSuccessCard
                  title="Side-by-Side Comparison Report Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={fileA.size + fileB.size}
                  infoBadge={`${result.changedPages} Changed Pages`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
