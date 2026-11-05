import React, { useState } from 'react';
import {
  Unlock,
  Lock,
  Eye,
  EyeOff,
  FileText,
  CheckCircle2,
  Download,
  AlertCircle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import { getPdfJs } from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { formatBytes } from '../../utils/fileHelpers';

interface PdfUnlockViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfUnlockView: React.FC<PdfUnlockViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    pageCount: number;
  } | null>(null);

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setPassword('');
      setResult(null);
      setErrorMessage(null);
    }
  };

  const handleUnlockPdf = async () => {
    if (!selectedFile) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(20);
    setStatusText('Testing encryption key & loading document...');
    setErrorMessage(null);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      let blob: Blob | null = null;
      let pageCount = 0;

      // Method 1: Try pdf-lib with ignoreEncryption: true (handles permissions/owner locks)
      let unlockedViaPdfLib = false;
      if (!password) {
        try {
          const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
          pageCount = pdfDoc.getPageCount();
          const unlockedBytes = await pdfDoc.save();
          blob = new Blob([unlockedBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
          unlockedViaPdfLib = true;
        } catch {
          // If this fails, password decryption is needed
        }
      }

      if (!unlockedViaPdfLib) {
        // Method 2: Decrypt with PDF.js engine
        const pdfjs = await getPdfJs();
        let pdf: any;
        try {
          const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(arrayBuffer),
            password: password || '',
          });
          pdf = await loadingTask.promise;
        } catch (pdfErr: any) {
          if (!password) {
            throw new Error('This document is password-protected. Please enter the password above and click Unlock PDF.');
          } else {
            throw new Error('Incorrect password. Please verify the password and try again.');
          }
        }

        pageCount = pdf.numPages;
        const newPdfDoc = await PDFDocument.create();

        for (let i = 1; i <= pageCount; i++) {
          setProgress(Math.round(20 + (i / pageCount) * 70));
          setStatusText(`Decrypted page ${i} of ${pageCount}...`);
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
            const imgDataUrl = canvas.toDataURL('image/jpeg', 0.94);
            const imgBytes = await (await fetch(imgDataUrl)).arrayBuffer();
            const embedded = await newPdfDoc.embedJpg(imgBytes);
            const newPage = newPdfDoc.addPage([viewport.width / 2.0, viewport.height / 2.0]);
            newPage.drawImage(embedded, {
              x: 0,
              y: 0,
              width: viewport.width / 2.0,
              height: viewport.height / 2.0,
            });
          }
        }

        const unlockedBytes = await newPdfDoc.save();
        blob = new Blob([unlockedBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      }

      if (!blob) {
        throw new Error('Unable to decrypt and process this document. Please check the file and password.');
      }

      const fileName = selectedFile.name.replace(/\.pdf$/i, '_unlocked.pdf');

      setProgress(100);
      setStatusText('PDF permanently unlocked!');

      setResult({
        blob,
        fileName,
        size: blob.size,
        pageCount,
      });

      onAddToHistory({
        toolId: 'pdf-unlock',
        toolName: 'PDF Password Remover & Unlock',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: 0,
        resultBlob: blob,
      });
    } catch (err: any) {
      console.warn('Unlock PDF error:', err);
      setErrorMessage(err?.message || 'Failed to unlock PDF. Please check the password.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Unlock className="w-5 h-5 text-emerald-500" />
            <span>PDF Password Remover & Permanent Unlock</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Permanently decrypt bank statements, utility bills, and salary slips so you never have to re-enter passwords again.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
          <span>🔓 100% Client-Side Decrypt</span>
        </div>
      </div>

      {!selectedFile && (
        <DropZone
          onFilesSelected={handleFilesSelected}
          acceptedFormats={['.pdf']}
          multiple={false}
          title="Drop password-protected PDF here"
          subtitle="Supports encrypted PDFs, bank statements, and protected documents"
        />
      )}

      {selectedFile && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm">
          {/* File Header */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate max-w-xs sm:max-w-md">
                  {selectedFile.name}
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  {formatBytes(selectedFile.size)} • Encrypted Document
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setResult(null);
                setPassword('');
                setErrorMessage(null);
              }}
              className="text-xs text-red-500 hover:underline"
            >
              Change PDF
            </button>
          </div>

          {/* Password Input Box */}
          <div className="space-y-3 pt-1">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
              Enter Current PDF Password
            </label>
            <div className="relative max-w-md">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUnlockPdf();
                }}
                placeholder="e.g. your CNIC, date of birth, or password"
                className="w-full pl-4 pr-10 py-2.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              💡 Once unlocked, you can open and print this PDF anywhere without prompting for a password.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleUnlockPdf}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" />
              <span>Unlock PDF Permanently</span>
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

      {/* Result Card */}
      {result && (
        <TaskSuccessCard
          title="PDF Password Permanently Removed!"
          blob={result.blob}
          fileName={result.fileName}
          fileSize={result.size}
          originalSize={selectedFile?.size}
          toolName="PDF Password Unlocker"
          infoBadge={`${result.pageCount} Pages • Completely Decrypted`}
        />
      )}
    </div>
  );
};
