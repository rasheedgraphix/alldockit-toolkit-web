import React, { useState } from 'react';
import {
  Hash,
  Download,
  AlertCircle,
  CheckCircle2,
  Settings2,
  FileText,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface PdfBatesViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfBatesView: React.FC<PdfBatesViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const [batesPrefix, setBatesPrefix] = useState('CASE-2026-');
  const [startNumber, setStartNumber] = useState<number>(1);
  const [digits, setDigits] = useState<number>(4);
  const [headerLeft, setHeaderLeft] = useState('CONFIDENTIAL RECORD');
  const [headerRight, setHeaderRight] = useState(new Date().toISOString().slice(0, 10));
  const [footerLeft, setFooterLeft] = useState('AllDocKit Legal Archive');
  const [includePageOfTotal, setIncludePageOfTotal] = useState(true);
  const [fontSize, setFontSize] = useState<number>(9);
  const [stampColor, setStampColor] = useState<'navy' | 'black' | 'crimson'>('navy');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    pages: number;
    endBates: string;
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
      setPageCount(doc.getPageCount());
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not load PDF file.');
    }
  };

  const safeAscii = (str: string) => str.replace(/[^\x20-\x7E]/g, ' ');

  const handleApplyBates = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Loading PDF pages for Bates numbering & header/footer stamping...');
    setErrorMessage(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pages = pdfDoc.getPages();
      const total = pages.length;

      const colorRgb =
        stampColor === 'navy'
          ? rgb(0.08, 0.22, 0.55)
          : stampColor === 'crimson'
          ? rgb(0.7, 0.08, 0.12)
          : rgb(0.12, 0.12, 0.12);

      let lastBates = '';

      for (let i = 0; i < total; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        const margin = 28;

        const currentNum = startNumber + i;
        const paddedNum = String(currentNum).padStart(digits, '0');
        const batesStamp = safeAscii(`${batesPrefix}${paddedNum}`);
        lastBates = batesStamp;

        // Top Left Header
        if (headerLeft.trim()) {
          page.drawText(safeAscii(headerLeft.trim()), {
            x: margin,
            y: height - 20,
            size: fontSize,
            font: regFont,
            color: colorRgb,
          });
        }

        // Top Right Header / Date
        if (headerRight.trim()) {
          const hr = safeAscii(headerRight.trim());
          const hrW = regFont.widthOfTextAtSize(hr, fontSize);
          page.drawText(hr, {
            x: width - margin - hrW,
            y: height - 20,
            size: fontSize,
            font: regFont,
            color: colorRgb,
          });
        }

        // Bottom Left Footer
        if (footerLeft.trim()) {
          page.drawText(safeAscii(footerLeft.trim()), {
            x: margin,
            y: 16,
            size: fontSize,
            font: regFont,
            color: colorRgb,
          });
        }

        // Bottom Center Page X of Y
        if (includePageOfTotal) {
          const pText = `Page ${i + 1} of ${total}`;
          const pW = regFont.widthOfTextAtSize(pText, fontSize);
          page.drawText(pText, {
            x: (width - pW) / 2,
            y: 16,
            size: fontSize,
            font: regFont,
            color: colorRgb,
          });
        }

        // Bottom Right Bates Stamp (Bold)
        const batesW = font.widthOfTextAtSize(batesStamp, fontSize + 1);
        page.drawText(batesStamp, {
          x: width - margin - batesW,
          y: 16,
          size: fontSize + 1,
          font,
          color: colorRgb,
        });

        setProgress(Math.round(20 + ((i + 1) / total) * 70));
      }

      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const fileName = `${baseName}_BatesStamped.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
        pages: total,
        endBates: lastBates,
      });

      onAddToHistory({
        toolId: 'pdf-bates',
        toolName: 'PDF Header, Footer & Bates Numbering',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to apply Bates numbering.');
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
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Hash className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF Header, Footer & Bates Numbering Studio
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Add legal Bates numbering (e.g. CASE-2026-0001), custom headers, footers, dates, and page indexing across all pages.
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
              title="Drop your PDF document here for Bates Stamping"
              subtitle="Ideal for legal case files, audit reports, medical records & corporate contracts"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)} • {pageCount !== null ? `${pageCount} Pages` : 'Reading...'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setResult(null);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change File
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Bates Prefix
                </label>
                <input
                  type="text"
                  value={batesPrefix}
                  onChange={(e) => setBatesPrefix(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Start Number
                </label>
                <input
                  type="number"
                  min={1}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value)))}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Zero Padding Digits
                </label>
                <select
                  value={digits}
                  onChange={(e) => setDigits(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value={3}>3 Digits (001)</option>
                  <option value={4}>4 Digits (0001)</option>
                  <option value={6}>6 Digits (000001)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Top-Left Header
                </label>
                <input
                  type="text"
                  value={headerLeft}
                  onChange={(e) => setHeaderLeft(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Top-Right Header (Date/Ref)
                </label>
                <input
                  type="text"
                  value={headerRight}
                  onChange={(e) => setHeaderRight(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Bottom-Left Footer
                </label>
                <input
                  type="text"
                  value={footerLeft}
                  onChange={(e) => setFooterLeft(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ink Color:</span>
                <select
                  value={stampColor}
                  onChange={(e) => setStampColor(e.target.value as any)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="navy">Legal Navy Blue</option>
                  <option value="black">Standard Black</option>
                  <option value="crimson">Official Crimson Red</option>
                </select>
              </div>

              <label className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePageOfTotal}
                  onChange={(e) => setIncludePageOfTotal(e.target.checked)}
                  className="rounded text-blue-600 w-4 h-4"
                />
                Include Center "Page X of Y" Counter
              </label>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleApplyBates}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Hash className="w-5 h-5" />
                {isProcessing
                  ? 'Applying Bates Stamps...'
                  : `Apply Header, Footer & Bates (${batesPrefix}${String(startNumber).padStart(digits, '0')})`}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
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
                        Bates Stamped PDF Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.pages} Pages Indexed (Up to {result.endBates}) • {formatBytes(result.size)}
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
                  title="Bates Indexed PDF Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.pages} Pages Stamped`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
