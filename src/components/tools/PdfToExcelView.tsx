import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Settings2,
  Table,
  FileText,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';
import { getPdfJs } from '../../utils/pdfOperations';
import { generateXlsxBlob } from '../../utils/officePackager';

interface PdfToExcelViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfToExcelView: React.FC<PdfToExcelViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [sheetMode, setSheetMode] = useState<'single-sheet' | 'per-page'>('single-sheet');
  const [outputFormat, setOutputFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [previewRows, setPreviewRows] = useState<string[][]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    totalRows: number;
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
    setPreviewRows([]);
    setErrorMessage(null);

    try {
      const pdfjs = await getPdfJs();
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      setPageCount(pdf.numPages);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not load PDF file.');
    }
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(10);
    setStatusText('Scanning PDF coordinate grid for tables & columns...');
    setErrorMessage(null);

    try {
      const pdfjs = await getPdfJs();
      const buffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const totalPages = pdf.numPages;

      const perPageSheets: { name: string; rows: string[][] }[] = [];
      const combinedRows: string[][] = [];

      for (let p = 1; p <= totalPages; p++) {
        setStatusText(`Extracting tabular rows & columns from page ${p} of ${totalPages}...`);
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];

        // Group items by Y coordinate (within 5pt tolerance = same table row)
        const rowGroups: { y: number; cells: { x: number; text: string }[] }[] = [];

        for (const item of items) {
          const str = (item.str || '').trim();
          if (!str) continue;
          const x = item.transform ? item.transform[4] : 0;
          const y = item.transform ? item.transform[5] : 0;

          let group = rowGroups.find((g) => Math.abs(g.y - y) < 5);
          if (!group) {
            group = { y, cells: [] };
            rowGroups.push(group);
          }
          group.cells.push({ x, text: str });
        }

        // Sort top-to-bottom
        rowGroups.sort((a, b) => b.y - a.y);

        const pageRows: string[][] = [];

        for (const group of rowGroups) {
          group.cells.sort((a, b) => a.x - b.x);
          // Merge fragments that are very close horizontally (< 12pt gap)
          const mergedCells: string[] = [];
          let lastX: number | null = null;
          let lastWidth = 0;

          for (const cell of group.cells) {
            if (lastX !== null && cell.x - (lastX + lastWidth) < 12) {
              mergedCells[mergedCells.length - 1] += ' ' + cell.text;
            } else {
              mergedCells.push(cell.text);
            }
            lastX = cell.x;
            lastWidth = cell.text.length * 5.2;
          }

          if (mergedCells.length > 0) {
            pageRows.push(mergedCells);
            combinedRows.push(mergedCells);
          }
        }

        perPageSheets.push({
          name: `Page ${p}`,
          rows: pageRows.length > 0 ? pageRows : [['No tabular text on this page']],
        });

        setProgress(Math.round(15 + (p / totalPages) * 70));
      }

      setProgress(90);
      setStatusText(`Generating ${outputFormat.toUpperCase()} spreadsheet...`);

      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      let outBlob: Blob;
      let fileName: string;

      if (outputFormat === 'xlsx') {
        const sheetsToSave =
          sheetMode === 'single-sheet'
            ? [{ name: 'Extracted Data', rows: combinedRows.length > 0 ? combinedRows : [['No Data']] }]
            : perPageSheets;
        outBlob = await generateXlsxBlob(sheetsToSave);
        fileName = `${baseName}_Spreadsheet.xlsx`;
      } else {
        const csvLines = combinedRows.map((row) =>
          row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
        );
        outBlob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        fileName = `${baseName}_Spreadsheet.csv`;
      }

      setPreviewRows(combinedRows.slice(0, 15));
      setResult({
        blob: outBlob,
        fileName,
        size: outBlob.size,
        totalRows: combinedRows.length,
      });

      onAddToHistory({
        toolId: 'pdf-to-excel',
        toolName: 'PDF to Excel (.xlsx) Converter',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: outBlob.size,
        savedBytes: Math.max(0, selectedFile.size - outBlob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to extract Excel data from PDF.');
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
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF to Excel (.xlsx / .csv) Table Extractor
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Extract tables, financial statements, bank ledgers, and price lists from PDF directly into Microsoft Excel (.xlsx).
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
              title="Drop your PDF with tables, invoices or ledgers here"
              subtitle="Reconstructs columns & rows into native Microsoft Excel (.xlsx) or CSV"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
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
                  setPreviewRows([]);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change File
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Spreadsheet Format
                </label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as 'xlsx' | 'csv')}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="xlsx">Microsoft Excel Workbook (.xlsx)</option>
                  <option value="csv">Comma Separated Values (.csv)</option>
                </select>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Worksheet Layout
                </label>
                <select
                  value={sheetMode}
                  onChange={(e) => setSheetMode(e.target.value as 'single-sheet' | 'per-page')}
                  disabled={outputFormat === 'csv'}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                >
                  <option value="single-sheet">Merge All Pages into 1 Continuous Sheet</option>
                  <option value="per-page">Separate Worksheet Tab per PDF Page</option>
                </select>
              </div>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleConvert}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-5 h-5" />
                {isProcessing ? 'Extracting Spreadsheet...' : `Convert PDF to ${outputFormat.toUpperCase()}`}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
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
                        Excel File Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.totalRows} Extracted Rows • {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    Download .{outputFormat.toUpperCase()}
                  </button>
                </div>

                {previewRows.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-emerald-600" />
                      Extracted Spreadsheet Preview (First 15 Rows)
                    </span>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-left border-collapse text-xs">
                        <tbody>
                          {previewRows.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className={
                                rIdx === 0
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 font-semibold text-slate-900 dark:text-white'
                                  : 'border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                              }
                            >
                              {row.slice(0, 8).map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-1.5 border-r border-slate-200 dark:border-slate-800 truncate max-w-[180px]">
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

                <TaskSuccessCard
                  title="Excel Spreadsheet Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.totalRows} Rows`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
