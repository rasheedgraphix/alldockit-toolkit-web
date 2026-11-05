import React, { useState } from 'react';
import {
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Settings2,
  FileOutput,
  Edit3,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } from 'docx';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';
import { getPdfJs } from '../../utils/pdfOperations';

interface PdfToWordViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfToWordView: React.FC<PdfToWordViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [preservePageBreaks, setPreservePageBreaks] = useState(true);
  const [detectHeadings, setDetectHeadings] = useState(true);
  const [extractedPreview, setExtractedPreview] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    pages: number;
    wordCount: number;
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
    setExtractedPreview('');
    setErrorMessage(null);

    try {
      const pdfjs = await getPdfJs();
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      setPageCount(pdf.numPages);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not load PDF file. Ensure it is not password-locked.');
    }
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(10);
    setStatusText('Loading PDF layout & text streams...');
    setErrorMessage(null);

    try {
      const pdfjs = await getPdfJs();
      const buffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const totalPages = pdf.numPages;

      const docChildren: Paragraph[] = [];
      let fullPreviewText = '';
      let totalWords = 0;

      for (let p = 1; p <= totalPages; p++) {
        setStatusText(`Extracting paragraphs & layout from page ${p} of ${totalPages}...`);
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];

        // Group text items by Y coordinate (line reconstruction)
        const lineBuckets: { y: number; height: number; items: { x: number; str: string }[] }[] = [];

        for (const item of items) {
          if (!item.str || !item.str.trim()) continue;
          const x = item.transform ? item.transform[4] : 0;
          const y = item.transform ? item.transform[5] : 0;
          const h = item.height || 12;

          let bucket = lineBuckets.find((b) => Math.abs(b.y - y) < 4);
          if (!bucket) {
            bucket = { y, height: h, items: [] };
            lineBuckets.push(bucket);
          }
          bucket.items.push({ x, str: item.str });
        }

        // Sort top-to-bottom (higher Y first in PDF coordinates)
        lineBuckets.sort((a, b) => b.y - a.y);

        const pageLines: { text: string; height: number }[] = [];
        for (const bucket of lineBuckets) {
          bucket.items.sort((a, b) => a.x - b.x);
          const lineStr = bucket.items.map((it) => it.str).join(' ').replace(/\s{2,}/g, ' ').trim();
          if (lineStr) {
            pageLines.push({ text: lineStr, height: bucket.height });
            totalWords += lineStr.split(/\s+/).length;
          }
        }

        if (pageLines.length === 0) {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `[Page ${p} — Scanned image page without embedded digital text]`,
                  italics: true,
                  color: '64748B',
                }),
              ],
              spacing: { after: 200 },
            })
          );
        } else {
          for (const lineObj of pageLines) {
            const isHeading = detectHeadings && (lineObj.height > 15 || (lineObj.text.length < 70 && lineObj.text === lineObj.text.toUpperCase() && /[A-Z]/.test(lineObj.text)));

            if (isHeading) {
              docChildren.push(
                new Paragraph({
                  text: lineObj.text,
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 220, after: 120 },
                })
              );
            } else {
              docChildren.push(
                new Paragraph({
                  children: [new TextRun({ text: lineObj.text, size: 24 })],
                  spacing: { after: 140, line: 276 },
                })
              );
            }
          }
        }

        fullPreviewText += `--- Page ${p} ---\n` + pageLines.map((l) => l.text).join('\n') + '\n\n';

        if (preservePageBreaks && p < totalPages) {
          docChildren.push(
            new Paragraph({
              children: [new PageBreak()],
            })
          );
        }

        setProgress(Math.round(15 + (p / totalPages) * 75));
      }

      setProgress(92);
      setStatusText('Building Microsoft Word (.docx) document...');

      const wordDoc = new Document({
        sections: [
          {
            properties: {},
            children: docChildren,
          },
        ],
      });

      const docxBlob = await Packer.toBlob(wordDoc);
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const fileName = `${baseName}_Editable.docx`;

      setExtractedPreview(fullPreviewText.trim());
      setResult({
        blob: docxBlob,
        fileName,
        size: docxBlob.size,
        pages: totalPages,
        wordCount: totalWords,
      });

      onAddToHistory({
        toolId: 'pdf-to-word',
        toolName: 'PDF to Word (.docx) Converter',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: docxBlob.size,
        savedBytes: Math.max(0, selectedFile.size - docxBlob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to convert PDF to Word document.');
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
            <FileOutput className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF to Word (.docx) Converter
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Convert PDF documents into editable Microsoft Word (.docx) files while reconstructing lines, headings, and page breaks locally.
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
              title="Drop your PDF file here to convert to Word (.docx)"
              subtitle="Extracts paragraphs, headings & text structure into an editable Word document"
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
                  setExtractedPreview('');
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change File
              </button>
            </div>

            {/* Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-600" />
                Word Reconstruction Options
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preservePageBreaks}
                    onChange={(e) => setPreservePageBreaks(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  Insert Word page breaks matching original PDF pages
                </label>

                <label className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detectHeadings}
                    onChange={(e) => setDetectHeadings(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  Auto-detect titles & section headings by font size
                </label>
              </div>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleConvert}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileOutput className="w-5 h-5" />
                {isProcessing ? 'Converting to Word (.docx)...' : 'Convert PDF to Word (.docx)'}
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
                        Word Document Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.pages} Pages • {result.wordCount.toLocaleString()} Words • {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    Download .DOCX
                  </button>
                </div>

                {extractedPreview && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5" />
                      Extracted Document Content Preview
                    </label>
                    <textarea
                      readOnly
                      value={extractedPreview}
                      rows={7}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 font-mono"
                    />
                  </div>
                )}

                <TaskSuccessCard
                  title="Microsoft Word (.docx) Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.wordCount} Words`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
