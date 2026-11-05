import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Settings2,
  Table,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';
import { parseSpreadsheetFile } from '../../utils/officePackager';

interface ExcelToPdfViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const ExcelToPdfView: React.FC<ExcelToPdfViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>([]);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [zebraStripes, setZebraStripes] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    pages: number;
    totalRows: number;
  } | null>(null);

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setResult(null);
    setErrorMessage(null);

    try {
      const parsed = await parseSpreadsheetFile(file);
      setSheets(parsed);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Could not parse Excel / CSV file.');
    }
  };

  const safeAscii = (str: string) =>
    str
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');

  const handleConvert = async () => {
    if (!selectedFile || sheets.length === 0) return;

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Typesetting spreadsheet grid into PDF...');
    setErrorMessage(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageW = orientation === 'landscape' ? 841.89 : 595.28;
      const pageH = orientation === 'landscape' ? 595.28 : 841.89;
      const margin = 36;
      const tableW = pageW - margin * 2;
      const rowH = 20;

      let totalRenderedRows = 0;

      for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
        const sheet = sheets[sIdx];
        const rows = sheet.rows;
        if (rows.length === 0) continue;

        const maxCols = Math.min(12, Math.max(...rows.map((r) => r.length), 1));
        const colW = tableW / maxCols;

        let page = pdfDoc.addPage([pageW, pageH]);
        let cursorY = pageH - margin;

        // Sheet header title
        page.drawText(safeAscii(`Sheet: ${sheet.name}`), {
          x: margin,
          y: cursorY - 12,
          size: 13,
          font: boldFont,
          color: rgb(0.06, 0.35, 0.22),
        });
        cursorY -= 26;

        for (let r = 0; r < rows.length; r++) {
          if (cursorY - rowH < margin + 20) {
            page = pdfDoc.addPage([pageW, pageH]);
            cursorY = pageH - margin;
          }

          const row = rows[r];
          const rowBottom = cursorY - rowH;
          const isHeader = r === 0;

          if (isHeader) {
            page.drawRectangle({
              x: margin,
              y: rowBottom,
              width: tableW,
              height: rowH,
              color: rgb(0.06, 0.45, 0.28),
            });
          } else if (zebraStripes && r % 2 === 1) {
            page.drawRectangle({
              x: margin,
              y: rowBottom,
              width: tableW,
              height: rowH,
              color: rgb(0.95, 0.97, 0.96),
            });
          }

          for (let c = 0; c < maxCols; c++) {
            const cellX = margin + c * colW;
            page.drawRectangle({
              x: cellX,
              y: rowBottom,
              width: colW,
              height: rowH,
              borderColor: rgb(0.82, 0.85, 0.88),
              borderWidth: 0.5,
            });

            const rawVal = safeAscii(row[c] || '');
            const maxChars = Math.max(4, Math.floor(colW / 5.2));
            page.drawText(rawVal.slice(0, maxChars), {
              x: cellX + 4,
              y: rowBottom + 6,
              size: 8.5,
              font: isHeader ? boldFont : regularFont,
              color: isHeader ? rgb(1, 1, 1) : rgb(0.12, 0.15, 0.2),
            });
          }

          cursorY = rowBottom;
          totalRenderedRows++;
        }

        setProgress(Math.round(20 + ((sIdx + 1) / sheets.length) * 70));
      }

      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const fileName = `${baseName}_Spreadsheet.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
        pages: pdfDoc.getPageCount(),
        totalRows: totalRenderedRows,
      });

      onAddToHistory({
        toolId: 'excel-to-pdf',
        toolName: 'Excel (.xlsx) to PDF Converter',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to convert Excel to PDF.');
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
          <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Excel (.xlsx / .csv) to PDF Converter
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Convert Microsoft Excel workbooks (.xlsx) and CSV data tables into clean, print-ready A4 table PDFs.
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
              acceptedFormats={['.xlsx', '.csv', '.tsv']}
              multiple={false}
              title="Drop your Excel (.xlsx) or CSV file here"
              subtitle="Supports multi-sheet Excel workbooks (.xlsx), .csv & .tsv spreadsheets"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)} • {sheets.length} Sheet(s) Detected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setSheets([]);
                  setResult(null);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change File
              </button>
            </div>

            {sheets.length > 0 && sheets[0].rows.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-teal-600" />
                  Sheet Preview: {sheets[0].name} ({sheets[0].rows.length} rows)
                </span>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left border-collapse text-xs">
                    <tbody>
                      {sheets[0].rows.slice(0, 10).map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={
                            rIdx === 0
                              ? 'bg-teal-50/70 dark:bg-teal-950/40 font-semibold text-slate-900 dark:text-white'
                              : 'border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          }
                        >
                          {row.slice(0, 8).map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5 border-r border-slate-200 dark:border-slate-800 truncate max-w-[160px]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Page Orientation:</span>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as 'landscape' | 'portrait')}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="landscape">Landscape (Best for Wide Columns)</option>
                  <option value="portrait">Portrait (Standard Vertical)</option>
                </select>
              </div>

              <label className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={zebraStripes}
                  onChange={(e) => setZebraStripes(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                Zebra Alternating Row Shading & Header Color
              </label>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleConvert}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-5 h-5" />
                {isProcessing ? 'Generating PDF Table...' : 'Convert Excel to PDF'}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/50">
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
                        Spreadsheet PDF Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.pages} Pages • {result.totalRows} Rows • {formatBytes(result.size)}
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
                  title="Excel Converted to PDF!"
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
