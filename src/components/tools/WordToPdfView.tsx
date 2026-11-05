import React, { useState } from 'react';
import {
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Settings2,
  FileSpreadsheet,
  Eye,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';
import { parseDocxFile, ParsedWordBlock } from '../../utils/officePackager';

interface WordToPdfViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const WordToPdfView: React.FC<WordToPdfViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [blocks, setBlocks] = useState<ParsedWordBlock[]>([]);
  const [addPageNumbers, setAddPageNumbers] = useState(true);
  const [fontSize, setFontSize] = useState<number>(11);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    pages: number;
  } | null>(null);

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setResult(null);
    setErrorMessage(null);

    try {
      const parsed = await parseDocxFile(file);
      setBlocks(parsed);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Could not parse Word document. Please upload a valid .docx or .txt file.');
    }
  };

  // Safe sanitizer for WinAnsi StandardFonts
  const safeAscii = (str: string) =>
    str
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');

  const handleConvert = async () => {
    if (!selectedFile || blocks.length === 0) return;

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Initializing A4 PDF typesetting engine...');
    setErrorMessage(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageW = 595.28;
      const pageH = 841.89;
      const margin = 50;
      const contentW = pageW - margin * 2;

      let currentPage = pdfDoc.addPage([pageW, pageH]);
      let cursorY = pageH - margin;

      const ensureSpace = (neededHeight: number) => {
        if (cursorY - neededHeight < margin + 25) {
          currentPage = pdfDoc.addPage([pageW, pageH]);
          cursorY = pageH - margin;
        }
      };

      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];

        if (b.type === 'heading' && b.text) {
          const headSize = fontSize + 4;
          ensureSpace(headSize + 18);
          cursorY -= 6;
          const clean = safeAscii(b.text);
          currentPage.drawText(clean.slice(0, 95), {
            x: margin,
            y: cursorY,
            size: headSize,
            font: boldFont,
            color: rgb(0.08, 0.12, 0.22),
          });
          cursorY -= headSize + 10;
        } else if (b.type === 'paragraph' && b.text) {
          const activeFont = b.bold ? boldFont : regularFont;
          const words = safeAscii(b.text).split(/\s+/);
          let line = '';
          const lineH = fontSize * 1.45;

          for (const w of words) {
            const test = line ? `${line} ${w}` : w;
            if (activeFont.widthOfTextAtSize(test, fontSize) <= contentW) {
              line = test;
            } else {
              ensureSpace(lineH);
              currentPage.drawText(line, {
                x: margin,
                y: cursorY,
                size: fontSize,
                font: activeFont,
                color: rgb(0.15, 0.18, 0.24),
              });
              cursorY -= lineH;
              line = w;
            }
          }
          if (line) {
            ensureSpace(lineH);
            currentPage.drawText(line, {
              x: margin,
              y: cursorY,
              size: fontSize,
              font: activeFont,
              color: rgb(0.15, 0.18, 0.24),
            });
            cursorY -= lineH;
          }
          cursorY -= 6;
        } else if (b.type === 'table' && b.rows && b.rows.length > 0) {
          const numCols = Math.max(...b.rows.map((r) => r.length), 1);
          const colW = contentW / numCols;
          const rowH = 20;

          for (let r = 0; r < b.rows.length; r++) {
            ensureSpace(rowH + 4);
            const row = b.rows[r];
            const rowTop = cursorY;
            const rowBottom = cursorY - rowH;

            if (r === 0) {
              currentPage.drawRectangle({
                x: margin,
                y: rowBottom,
                width: contentW,
                height: rowH,
                color: rgb(0.93, 0.95, 0.98),
              });
            }

            for (let c = 0; c < numCols; c++) {
              const cellX = margin + c * colW;
              currentPage.drawRectangle({
                x: cellX,
                y: rowBottom,
                width: colW,
                height: rowH,
                borderColor: rgb(0.78, 0.82, 0.87),
                borderWidth: 0.5,
              });

              const cellStr = safeAscii(row[c] || '');
              const maxChars = Math.max(4, Math.floor(colW / 5.5));
              currentPage.drawText(cellStr.slice(0, maxChars), {
                x: cellX + 4,
                y: rowBottom + 6,
                size: 9,
                font: r === 0 ? boldFont : regularFont,
                color: rgb(0.1, 0.12, 0.18),
              });
            }
            cursorY = rowBottom;
          }
          cursorY -= 12;
        }

        if (i % 10 === 0) {
          setProgress(Math.round(20 + (i / blocks.length) * 65));
        }
      }

      const pages = pdfDoc.getPages();
      if (addPageNumbers) {
        pages.forEach((p, idx) => {
          const footer = `Page ${idx + 1} of ${pages.length}`;
          const fw = regularFont.widthOfTextAtSize(footer, 9);
          p.drawText(footer, {
            x: (pageW - fw) / 2,
            y: 22,
            size: 9,
            font: regularFont,
            color: rgb(0.45, 0.48, 0.52),
          });
        });
      }

      setProgress(95);
      setStatusText('Saving PDF document...');
      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const fileName = `${baseName}_Converted.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
        pages: pages.length,
      });

      onAddToHistory({
        toolId: 'word-to-pdf',
        toolName: 'Word (.docx) to PDF Converter',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to convert Word file to PDF.');
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
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Word (.docx) to PDF Converter
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Convert Microsoft Word (.docx), Markdown (.md), or Text (.txt) documents into clean, print-ready A4 PDFs locally.
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
              acceptedFormats={['.docx', '.txt', '.md']}
              multiple={false}
              title="Drop your Word (.docx) document here"
              subtitle="Supports Microsoft Word (.docx), .txt & .md files (100% private & offline)"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)} • {blocks.length} Paragraphs / Blocks Detected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setBlocks([]);
                  setResult(null);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change File
              </button>
            </div>

            {/* Live Document Preview */}
            {blocks.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-500" />
                  Parsed Word Content Preview ({blocks.length} blocks)
                </span>
                <div className="max-h-48 overflow-y-auto p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {blocks.slice(0, 25).map((b, idx) =>
                    b.type === 'heading' ? (
                      <h4 key={idx} className="font-bold text-slate-900 dark:text-white text-sm">
                        {b.text}
                      </h4>
                    ) : b.type === 'table' ? (
                      <div key={idx} className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                        [Table: {b.rows?.length || 0} rows]
                      </div>
                    ) : (
                      <p key={idx} className={b.bold ? 'font-semibold' : ''}>
                        {b.text}
                      </p>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Body Font Size:</span>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value={10}>10 pt (Compact)</option>
                  <option value={11}>11 pt (Standard)</option>
                  <option value={12}>12 pt (Large)</option>
                </select>
              </div>

              <label className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addPageNumbers}
                  onChange={(e) => setAddPageNumbers(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                Include Page Numbers in Footer
              </label>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleConvert}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileText className="w-5 h-5" />
                {isProcessing ? 'Generating PDF...' : 'Convert Word (.docx) to PDF'}
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
                        PDF Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.pages} A4 Pages • {formatBytes(result.size)}
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
                  title="Word Converted to A4 PDF!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.pages} Pages`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
