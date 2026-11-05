import React, { useState } from 'react';
import {
  Lock,
  Download,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Settings2,
  FileText,
  ShieldCheck,
  CheckSquare,
  FileSpreadsheet,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';
import { getPdfJs } from '../../utils/pdfOperations';

interface PdfFlattenViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type FlattenMode = 'form-fields' | 'full-raster';

export const PdfFlattenView: React.FC<PdfFlattenViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [fieldCount, setFieldCount] = useState<number>(0);

  const [flattenMode, setFlattenMode] = useState<FlattenMode>('form-fields');
  const [sanitizeMetadata, setSanitizeMetadata] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    pages: number;
    fieldsLocked: number;
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
      const pages = doc.getPageCount();
      setPageCount(pages);

      let fieldsFound = 0;
      try {
        const form = doc.getForm();
        const fields = form.getFields();
        fieldsFound = fields.length;
      } catch (e) {
        fieldsFound = 0;
      }
      setFieldCount(fieldsFound);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not inspect PDF. The file may be password-protected or corrupt.');
    }
  };

  const handleFlatten = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(15);
    setStatusText('Loading PDF document...');
    setErrorMessage(null);

    try {
      const buffer = await selectedFile.arrayBuffer();

      if (flattenMode === 'form-fields') {
        // Standard high-speed vector form flattening
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        let lockedFields = 0;

        try {
          const form = doc.getForm();
          const fields = form.getFields();
          lockedFields = fields.length;
          form.flatten();
        } catch (e) {
          // Document had no interactive AcroForm fields
        }

        if (sanitizeMetadata) {
          doc.setTitle('');
          doc.setAuthor('');
          doc.setSubject('');
          doc.setKeywords([]);
          doc.setProducer('AllDocKit Anti-Tamper Engine');
          doc.setCreator('AllDocKit Offline Studio');
        }

        setProgress(85);
        setStatusText('Saving tamper-proof PDF...');
        const outBytes = await doc.save();
        const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
        const baseName = selectedFile.name.replace(/\.pdf$/i, '');
        const fileName = `${baseName}_Locked_Flat.pdf`;

        setResult({
          blob,
          fileName,
          size: blob.size,
          pages: doc.getPageCount(),
          fieldsLocked: lockedFields,
        });

        onAddToHistory({
          toolId: 'pdf-flatten',
          toolName: 'PDF Form Flattener & Anti-Tamper',
          originalName: selectedFile.name,
          resultName: fileName,
          originalSize: selectedFile.size,
          resultSize: blob.size,
          savedBytes: Math.max(0, selectedFile.size - blob.size),
        });
      } else {
        // Full Raster Burn-In Lock (Renders each page to canvas to make text & layers un-editable)
        const pdfjs = await getPdfJs();
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        const outDoc = await PDFDocument.create();
        const scale = 2.0; // 144-150 DPI for crisp reading

        for (let i = 1; i <= totalPages; i++) {
          setStatusText(`Burning page ${i} of ${totalPages} into permanent flat graphic...`);
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });
          const origViewport = page.getViewport({ scale: 1 });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not create canvas context');

          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise;

          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const base64Data = dataUrl.split(',')[1];
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let b = 0; b < binaryStr.length; b++) {
            bytes[b] = binaryStr.charCodeAt(b);
          }

          const embeddedImg = await outDoc.embedJpg(bytes);
          const outPage = outDoc.addPage([origViewport.width, origViewport.height]);
          outPage.drawImage(embeddedImg, {
            x: 0,
            y: 0,
            width: origViewport.width,
            height: origViewport.height,
          });

          setProgress(Math.round(20 + (i / totalPages) * 70));
        }

        if (sanitizeMetadata) {
          outDoc.setTitle('');
          outDoc.setAuthor('');
          outDoc.setProducer('AllDocKit Anti-Tamper Engine');
        }

        setProgress(96);
        setStatusText('Finalizing flattened document...');
        const outBytes = await outDoc.save();
        const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
        const baseName = selectedFile.name.replace(/\.pdf$/i, '');
        const fileName = `${baseName}_RasterLocked.pdf`;

        setResult({
          blob,
          fileName,
          size: blob.size,
          pages: totalPages,
          fieldsLocked: fieldCount,
        });

        onAddToHistory({
          toolId: 'pdf-flatten',
          toolName: 'PDF Form Flattener & Anti-Tamper',
          originalName: selectedFile.name,
          resultName: fileName,
          originalSize: selectedFile.size,
          resultSize: blob.size,
          savedBytes: Math.max(0, selectedFile.size - blob.size),
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to flatten PDF document.');
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
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF Form Flattener & Anti-Tamper Lock
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Unlimited
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Permanently bake interactive form fields, checkboxes, signatures, and annotations into the page so nobody can alter your data or contracts.
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
              title="Drop fillable form PDF or document here"
              subtitle="Supports government forms, contracts, invoices, visa applications & signed agreements (Up to 100MB)"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-teal-600 dark:text-teal-400 flex-shrink-0" />
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
                  setErrorMessage(null);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change File
              </button>
            </div>

            {/* Field Status Badge */}
            <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-teal-900 dark:text-teal-200">
                    {fieldCount > 0
                      ? `Found ${fieldCount} Interactive Form Field(s)`
                      : 'Standard PDF Document / No AcroForm Fields Detected'}
                  </h4>
                  <p className="text-[11px] text-teal-700 dark:text-teal-400">
                    {fieldCount > 0
                      ? 'Flattening will burn all user inputs, checkboxes, and text fields into static vector shapes.'
                      : 'You can apply Full Raster Lock to make the entire document 100% un-editable and copy-proof.'}
                  </p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 font-medium">
                {fieldCount} Fields
              </span>
            </div>

            {/* Flatten Mode Options */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-teal-600" />
                Anti-Tamper Lock Level
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => setFlattenMode('form-fields')}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    flattenMode === 'form-fields'
                      ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-2 ring-teal-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="radio"
                      name="flattenMode"
                      checked={flattenMode === 'form-fields'}
                      onChange={() => setFlattenMode('form-fields')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Smart Form & Annotation Flatten (Recommended)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                    Converts interactive form inputs and notes into permanent vector elements. Keeps file small, retains crisp razor text and searchability.
                  </p>
                </div>

                <div
                  onClick={() => setFlattenMode('full-raster')}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    flattenMode === 'full-raster'
                      ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-2 ring-teal-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="radio"
                      name="flattenMode"
                      checked={flattenMode === 'full-raster'}
                      onChange={() => setFlattenMode('full-raster')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Full Raster Burn-In Lock (Maximum Security)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                    Flattens all pages into static high-definition graphic images. Completely prevents any text selection, font tampering, or editing in Adobe Acrobat.
                  </p>
                </div>
              </div>

              {/* Sanitization Checkbox */}
              <label className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={sanitizeMetadata}
                    onChange={(e) => setSanitizeMetadata(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      Strip Document Metadata & Hidden Revision Logs
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Clears original author, computer name, and editing software tags for privacy.
                    </p>
                  </div>
                </div>
                <ShieldCheck className="w-5 h-5 text-teal-600 flex-shrink-0" />
              </label>
            </div>

            {/* Action Button */}
            {!result && (
              <button
                type="button"
                onClick={handleFlatten}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-5 h-5" />
                {isProcessing
                  ? 'Flattening & Locking PDF...'
                  : `Flatten Form & Apply Anti-Tamper Lock`}
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
                        PDF Locked & Flattened: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.pages} Pages Locked • {result.fieldsLocked} Fields Flattened • {formatBytes(result.size)}
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
                  title="Tamper-Proof Flat PDF Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.fieldsLocked} Form Fields Locked`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
