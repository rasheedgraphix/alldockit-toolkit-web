import React, { useState } from 'react';
import {
  Scaling,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Maximize2,
  FileSpreadsheet,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface PdfResizerViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type StandardPaper = 'a4' | 'letter' | 'legal' | 'a3' | 'a5';

const PAPER_SIZES: Record<StandardPaper, { name: string; width: number; height: number; desc: string }> = {
  a4: { name: 'A4', width: 595.28, height: 841.89, desc: 'International Standard (210 × 297 mm)' },
  letter: { name: 'US Letter', width: 612.0, height: 792.0, desc: 'USA & Corporate Standard (8.5 × 11 in)' },
  legal: { name: 'US Legal', width: 612.0, height: 1008.0, desc: 'Court Stamp Paper & Contracts (8.5 × 14 in)' },
  a3: { name: 'A3', width: 841.89, height: 1190.55, desc: 'Large Poster & Architectural (297 × 420 mm)' },
  a5: { name: 'A5', width: 419.53, height: 595.28, desc: 'Booklet & Prescription Pad (148 × 210 mm)' },
};

export const PdfResizerView: React.FC<PdfResizerViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourcePageCount, setSourcePageCount] = useState<number | null>(null);
  const [targetPaper, setTargetPaper] = useState<StandardPaper>('a4');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [fitMode, setFitMode] = useState<'fit' | 'stretch' | 'center'>('fit');
  const [margin, setMargin] = useState<number>(18); // points

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    pageCount: number;
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
      setSourcePageCount(doc.getPageCount());
    } catch {
      setErrorMessage('Failed to read PDF. Please check the file.');
    }
  };

  const handleResize = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Loading document pages for page size conversion...');
    setErrorMessage(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const totalPages = srcDoc.getPageCount();

      const outDoc = await PDFDocument.create();
      const basePaper = PAPER_SIZES[targetPaper];

      const pageIndices = Array.from({ length: totalPages }, (_, i) => i);
      const embeddedPages = await outDoc.embedPdf(srcDoc, pageIndices);

      for (let i = 0; i < totalPages; i++) {
        setProgress(Math.round(20 + (i / totalPages) * 70));
        setStatusText(`Converting page ${i + 1} of ${totalPages} to ${basePaper.name}...`);

        const embedded = embeddedPages[i];
        const embW = embedded.width;
        const embH = embedded.height;

        // Determine orientation
        let isLandscape = false;
        if (orientation === 'auto') {
          isLandscape = embW > embH;
        } else {
          isLandscape = orientation === 'landscape';
        }

        const pageWidth = isLandscape ? Math.max(basePaper.width, basePaper.height) : Math.min(basePaper.width, basePaper.height);
        const pageHeight = isLandscape ? Math.min(basePaper.width, basePaper.height) : Math.max(basePaper.width, basePaper.height);

        const newPage = outDoc.addPage([pageWidth, pageHeight]);

        let drawX = 0;
        let drawY = 0;
        let drawW = pageWidth;
        let drawH = pageHeight;

        if (fitMode === 'fit') {
          const availW = pageWidth - margin * 2;
          const availH = pageHeight - margin * 2;
          const scale = Math.min(availW / embW, availH / embH);
          drawW = embW * scale;
          drawH = embH * scale;
          drawX = margin + (availW - drawW) / 2;
          drawY = margin + (availH - drawH) / 2;
        } else if (fitMode === 'center') {
          drawW = embW;
          drawH = embH;
          drawX = (pageWidth - drawW) / 2;
          drawY = (pageHeight - drawH) / 2;
        } else {
          // Stretch to fill
          drawX = margin;
          drawY = margin;
          drawW = pageWidth - margin * 2;
          drawH = pageHeight - margin * 2;
        }

        newPage.drawPage(embedded, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });
      }

      setProgress(95);
      setStatusText('Saving converted document...');

      const savedBytes = await outDoc.save();
      const blob = new Blob([savedBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = selectedFile.name.replace(/\.pdf$/i, `_${targetPaper.toUpperCase()}.pdf`);

      setProgress(100);
      setStatusText('PDF Resized successfully!');

      setResult({
        blob,
        fileName,
        size: blob.size,
        pageCount: totalPages,
      });

      onAddToHistory({
        toolId: 'pdf-resizer',
        toolName: `PDF Page Size Converter (${basePaper.name})`,
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resize PDF pages.');
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
            <Scaling className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF Page Size Converter (A4, Letter, Legal)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-400 font-medium">
                100% Free & Unlimited
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Convert court affidavits, US Letter, or overseas documents to standard A4 or Legal with safe printer margins.
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
              title="Drop PDF to change page dimensions"
              subtitle="Supports Legal stamp papers, US Letter, A4, A3, Booklets (Up to 100MB)"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
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
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition"
              >
                Change PDF
              </button>
            </div>

            {/* Target Paper Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Select Target Paper Standard
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['a4', 'letter', 'legal'] as StandardPaper[]).map((key) => {
                  const item = PAPER_SIZES[key];
                  const active = targetPaper === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTargetPaper(key)}
                      className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        active
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold ring-1 ring-blue-600'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold">{item.name}</span>
                        {key === 'a4' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                            Standard
                          </span>
                        )}
                        {key === 'legal' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-medium">
                            Stamp Paper
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Orientation & Scaling Fit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Page Orientation
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrientation('auto')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-medium text-center transition ${
                      orientation === 'auto'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Auto (Match Page)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-medium text-center transition ${
                      orientation === 'portrait'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Portrait (Vertical)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-medium text-center transition ${
                      orientation === 'landscape'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Landscape
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Content Fit & Scaling
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFitMode('fit')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-medium text-center transition ${
                      fitMode === 'fit'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Fit to Margins (Safe)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitMode('stretch')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-medium text-center transition ${
                      fitMode === 'stretch'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Fill Entire Page
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitMode('center')}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-medium text-center transition ${
                      fitMode === 'center'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Keep Original Scale
                  </button>
                </div>
              </div>
            </div>

            {/* Action Button */}
            {!result && (
              <button
                type="button"
                onClick={handleResize}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Scaling className="w-5 h-5" />
                {isProcessing
                  ? 'Resizing Document...'
                  : `Convert All Pages to ${PAPER_SIZES[targetPaper].name}`}
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
                        Resized PDF Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.pageCount} Pages converted to {PAPER_SIZES[targetPaper].name} • Size: {formatBytes(result.size)}
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
                  title="Resized PDF Ready to Download!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={PAPER_SIZES[targetPaper].name}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
