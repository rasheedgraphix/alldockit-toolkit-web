import React, { useState } from 'react';
import {
  FileCog,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
  Eraser,
  Save,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface PdfMetadataViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfMetadataView: React.FC<PdfMetadataViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [subject, setSubject] = useState('');
  const [keywords, setKeywords] = useState('');
  const [creator, setCreator] = useState('');
  const [producer, setProducer] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
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
      setTitle(doc.getTitle() || '');
      setAuthor(doc.getAuthor() || '');
      setSubject(doc.getSubject() || '');
      setKeywords((doc.getKeywords() || '').toString());
      setCreator(doc.getCreator() || '');
      setProducer(doc.getProducer() || '');
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not inspect PDF metadata.');
    }
  };

  const handleWipeFields = () => {
    setTitle('');
    setAuthor('');
    setSubject('');
    setKeywords('');
    setCreator('');
    setProducer('');
  };

  const handleSaveMetadata = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(25);
    setStatusText('Writing updated PDF document dictionary & properties...');
    setErrorMessage(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });

      doc.setTitle(title.trim());
      doc.setAuthor(author.trim());
      doc.setSubject(subject.trim());
      doc.setKeywords(
        keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      );
      doc.setCreator(creator.trim());
      doc.setProducer(producer.trim());
      doc.setModificationDate(new Date());

      setProgress(90);
      const outBytes = await doc.save();
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const fileName = `${baseName}_MetadataUpdated.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
      });

      onAddToHistory({
        toolId: 'pdf-metadata',
        toolName: 'PDF Metadata Editor & Cleaner',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to update PDF metadata.');
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
          <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
            <FileCog className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF Metadata & Properties Editor / Wiper
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Inspect, edit, or completely wipe hidden PDF properties (Title, Author, Subject, Keywords, Creator & Producer tags).
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
              title="Drop your PDF file here to inspect or edit metadata"
              subtitle="Reads existing Author, Title, Keywords & Software Producer properties"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-sky-600 dark:text-sky-400 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)} • {pageCount !== null ? `${pageCount} Pages` : 'Reading...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleWipeFields}
                  className="text-xs px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 font-semibold flex items-center gap-1 hover:bg-rose-100"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  1-Click Clear All Fields
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setResult(null);
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600 underline font-medium"
                >
                  Change File
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter document title..."
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Author / Organization
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Enter author name..."
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Subject / Description
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject..."
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Keywords (comma separated)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="invoice, legal, 2026..."
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Creator Application
                </label>
                <input
                  type="text"
                  value={creator}
                  onChange={(e) => setCreator(e.target.value)}
                  placeholder="e.g. AllDocKit Studio"
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  PDF Producer
                </label>
                <input
                  type="text"
                  value={producer}
                  onChange={(e) => setProducer(e.target.value)}
                  placeholder="e.g. AllDocKit Engine"
                  className="mt-1 w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleSaveMetadata}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {isProcessing ? 'Updating Metadata...' : 'Save Updated PDF Metadata'}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-sky-50/50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50">
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
                        Metadata Saved: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Size: {formatBytes(result.size)}
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
                  title="PDF Properties Updated!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge="Metadata Updated"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
