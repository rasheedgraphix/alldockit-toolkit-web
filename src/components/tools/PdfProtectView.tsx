import React, { useState } from 'react';
import {
  Lock,
  Download,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  Printer,
  Copy,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { formatBytes, downloadBlob, getPdfInfo } from '../../utils/fileHelpers';
import { protectPdfDocument } from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface PdfProtectViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfProtectView: React.FC<PdfProtectViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [resultPdf, setResultPdf] = useState<{ blob: Blob; pageCount: number } | null>(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      const info = await getPdfInfo(file);
      setPageCount(info.pageCount);
      setResultPdf(null);
      setErrorMsg('');
    }
  };

  const handleProtect = async () => {
    if (!selectedFile) return;

    if (!password.trim()) {
      setErrorMsg('Please enter a password to lock this PDF document.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter the same password.');
      return;
    }

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setErrorMsg('');
    setIsProcessing(true);
    setProgress(20);
    setStatusText('Encrypting PDF streams with AES-256 military-grade encryption...');

    try {
      const result = await protectPdfDocument(
        selectedFile,
        password,
        {
          allowPrinting,
          allowCopying,
        },
        (p, text) => {
          setProgress(p);
          setStatusText(text);
        }
      );

      setResultPdf(result);

      onAddToHistory({
        toolId: 'pdf-protect',
        toolName: 'PDF Password Protect',
        originalName: selectedFile.name,
        resultName: `${selectedFile.name.replace('.pdf', '')}_password_protected.pdf`,
        originalSize: selectedFile.size,
        resultSize: result.blob.size,
        savedBytes: 0,
        resultBlob: result.blob,
      });
    } catch (err: any) {
      console.error('Error securing PDF:', err);
      setErrorMsg(err.message || 'Failed to encrypt PDF with password.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!selectedFile || !resultPdf) return;
    downloadBlob(
      resultPdf.blob,
      `${selectedFile.name.replace('.pdf', '')}_locked.pdf`
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Lock className="w-5 h-5 text-rose-500" />
            PDF Password Protect (AES-256)
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Lock PDF documents with standard AES-256 password encryption. When opened in any viewer, it will require this password.
          </p>
        </div>
      </div>

      {!selectedFile ? (
        <DropZone
          onFilesSelected={handleFileSelected}
          acceptedFormats={['.pdf']}
          multiple={false}
          title="Drop your PDF here to lock with password"
          subtitle="Enforces standard AES-256 encryption. Requires password to open on Chrome, Acrobat, or Mobile."
        />
      ) : (
        <div className="space-y-6">
          {/* File summary */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800">
            <div>
              <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                {selectedFile.name}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {formatBytes(selectedFile.size)} • {pageCount} pages
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                setResultPdf(null);
                setPassword('');
                setConfirmPassword('');
              }}
              className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 font-medium px-3 py-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            >
              Change File
            </button>
          </div>

          {!resultPdf && (
            <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-5 shadow-xs">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300">
                <ShieldCheck className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <span className="font-bold block">Real AES-256 PDF Encryption</span>
                  Once encrypted, nobody can view, print, or extract contents without entering this password.
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Set Document Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="e.g. Secret123#"
                      className="w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type your password"
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Permissions options */}
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Allowed User Permissions (When unlocked)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2.5 cursor-pointer text-stone-700 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={allowPrinting}
                      onChange={(e) => setAllowPrinting(e.target.checked)}
                      className="rounded accent-rose-600"
                    />
                    <Printer className="w-4 h-4 text-stone-400" />
                    <span>Allow Document Printing</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer text-stone-700 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={allowCopying}
                      onChange={(e) => setAllowCopying(e.target.checked)}
                      className="rounded accent-rose-600"
                    />
                    <Copy className="w-4 h-4 text-stone-400" />
                    <span>Allow Text & Graphics Copying</span>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleProtect}
                  disabled={isProcessing || !password}
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  {isProcessing ? 'Encrypting with AES-256...' : 'Lock & Encrypt PDF Document'}
                </button>
              </div>
            </div>
          )}

          {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

          {/* Success Card */}
          {resultPdf && (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                    PDF Locked with Password Successfully!
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Encrypted with AES-256 • When you open this PDF, it will require your password: <strong className="font-mono">{password}</strong>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="py-2.5 px-5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download Password-Protected PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResultPdf(null);
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="py-2.5 px-4 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-50"
                >
                  Protect Another
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
