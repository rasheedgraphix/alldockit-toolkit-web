import React, { useState } from 'react';
import {
  FolderPen,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  Hash,
  ArrowRight,
  Sparkles,
  FileArchive,
  RefreshCw,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { formatBytes, createZipAndDownload } from '../../utils/fileHelpers';
import JSZip from 'jszip';

interface BatchRenamerViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

interface RenamedItem {
  originalFile: File;
  newName: string;
}

export const BatchRenamerView: React.FC<BatchRenamerViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [files, setFiles] = useState<File[]>([]);
  const [prefix, setPrefix] = useState<string>('Doc_');
  const [suffix, setSuffix] = useState<string>('');
  const [includeCounter, setIncludeCounter] = useState<boolean>(true);
  const [counterDigits, setCounterDigits] = useState<number>(3); // 001, 002
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [caseMode, setCaseMode] = useState<'keep' | 'lower' | 'upper'>('keep');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    count: number;
  } | null>(null);

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setResult(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const computeNewName = (file: File, index: number): string => {
    const lastDot = file.name.lastIndexOf('.');
    let base = lastDot >= 0 ? file.name.substring(0, lastDot) : file.name;
    const ext = lastDot >= 0 ? file.name.substring(lastDot) : '';

    // Find and Replace
    if (findText.trim()) {
      base = base.split(findText).join(replaceText);
    }

    // Case
    if (caseMode === 'lower') base = base.toLowerCase();
    else if (caseMode === 'upper') base = base.toUpperCase();

    // Counter
    let counterStr = '';
    if (includeCounter) {
      counterStr = (index + 1).toString().padStart(counterDigits, '0');
    }

    const finalBase = `${prefix}${base}${counterStr ? `_${counterStr}` : ''}${suffix}`;
    return `${finalBase}${ext}`;
  };

  const renamedList: RenamedItem[] = files.map((file, idx) => ({
    originalFile: file,
    newName: computeNewName(file, idx),
  }));

  const handleBatchDownloadZip = async () => {
    if (files.length === 0) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Packaging renamed files into ZIP archive...');

    try {
      const zip = new JSZip();

      for (let i = 0; i < renamedList.length; i++) {
        const item = renamedList[i];
        zip.file(item.newName, item.originalFile);
        setProgress(Math.round(((i + 1) / renamedList.length) * 75) + 15);
      }

      setStatusText('Compressing ZIP archive...');
      const blob = await zip.generateAsync({ type: 'blob' });
      const fileName = `Renamed_Files_${files.length}_items.zip`;

      setResult({
        blob,
        fileName,
        size: blob.size,
        count: files.length,
      });

      onAddToHistory({
        toolId: 'batch-renamer',
        toolName: 'Batch File & Photo Renamer',
        originalName: `${files.length} files (${files[0]?.name || ''}...)`,
        resultName: fileName,
        originalSize: files.reduce((acc, f) => acc + f.size, 0),
        resultSize: blob.size,
        savedBytes: 0,
        resultBlob: blob,
      });
    } catch (err: any) {
      console.error('Batch rename ZIP error:', err);
      alert('Failed to package renamed files.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <FolderPen className="w-5 h-5 text-indigo-500" />
            <span>Batch File & Photo Renamer (ZIP Suite)</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Rename dozens or hundreds of photos, PDFs, and documents at once with counters, prefixes, and find-replace.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-indigo-500/20">
          <FileArchive className="w-3.5 h-3.5" />
          <span>Instant ZIP Archive</span>
        </div>
      </div>

      {/* Upload Zone */}
      <DropZone
        onFilesSelected={handleFilesSelected}
        acceptedFormats={['*']}
        multiple={true}
        title="Drop files here to batch rename"
        subtitle="Supports all formats: PDFs, Images, Word docs, and archives"
      />

      {files.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Rules Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Renaming Rules ({files.length} Files)
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setFiles([]);
                    setResult(null);
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Clear All
                </button>
              </div>

              {/* Prefix & Suffix */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    Add Prefix
                  </label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="e.g. Doc_"
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    Add Suffix
                  </label>
                  <input
                    type="text"
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    placeholder="e.g. _Final"
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                  />
                </div>
              </div>

              {/* Numbering Counter */}
              <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950 space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-stone-800 dark:text-stone-200">
                  <input
                    type="checkbox"
                    checked={includeCounter}
                    onChange={(e) => setIncludeCounter(e.target.checked)}
                    className="rounded border-stone-300 text-indigo-600"
                  />
                  <span>Add Sequential Numbering (_001, _002)</span>
                </label>

                {includeCounter && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-stone-500">Number Padding:</span>
                    <select
                      value={counterDigits}
                      onChange={(e) => setCounterDigits(Number(e.target.value))}
                      className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800"
                    >
                      <option value={1}>1, 2, 3</option>
                      <option value={2}>01, 02, 03</option>
                      <option value={3}>001, 002, 003</option>
                      <option value={4}>0001, 0002, 0003</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Find and Replace */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    Find Text
                  </label>
                  <input
                    type="text"
                    value={findText}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder="e.g. IMG"
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    Replace With
                  </label>
                  <input
                    type="text"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="e.g. Photo"
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleBatchDownloadZip}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileArchive className="w-4 h-4" />
                  <span>Download All as Renamed ZIP ({files.length} Files)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview Table */}
          <div className="lg:col-span-7 p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                Live Renaming Preview Table
              </span>
              <span className="text-[11px] font-semibold text-stone-400">
                {files.length} items
              </span>
            </div>

            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1 text-xs">
              {renamedList.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-stone-400 text-[11px] truncate line-through">
                      {item.originalFile.name}
                    </div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.newName}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-1 text-stone-400 hover:text-red-500 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {/* Result Card */}
      {result && (
        <TaskSuccessCard
          title="All Files Successfully Renamed!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.size}
          toolName="Batch File Renamer"
          infoBadge={`${result.count} Files Packaged`}
        />
      )}
    </div>
  );
};
