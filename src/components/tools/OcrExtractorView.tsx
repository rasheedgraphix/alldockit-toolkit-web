import React, { useState } from 'react';
import {
  ScanText,
  Copy,
  Download,
  FileText,
  FileCode,
  CheckCircle2,
  RefreshCw,
  Globe,
  Share2,
  Star,
  ExternalLink,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { downloadBlob, formatBytes } from '../../utils/fileHelpers';
import { renderPdfPageToDataUrl } from '../../utils/pdfOperations';
import { shareViaWhatsApp, trackActionAndCheckRatePrompt, triggerRateUsModal } from '../../utils/share';
import { OUR_APPS_DATA, openMicrosoftStoreApp } from '../../data/ourApps';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import Tesseract from 'tesseract.js';
import { Document, Packer, Paragraph, TextRun } from 'docx';

interface OcrExtractorViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

const OCR_LANGUAGES = [
  { code: 'eng', name: 'English (Default)' },
  { code: 'urd', name: 'Urdu (اردو)' },
  { code: 'ara', name: 'Arabic (العربية)' },
  { code: 'spa', name: 'Spanish (Español)' },
  { code: 'fra', name: 'French (Français)' },
  { code: 'deu', name: 'German (Deutsch)' },
];

export const OcrExtractorView: React.FC<OcrExtractorViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<string>('eng');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');

  const [extractedText, setExtractedText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Handle file selection (Images or PDF)
  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setExtractedText('');

    if (file.type === 'application/pdf') {
      try {
        const { dataUrl } = await renderPdfPageToDataUrl(file, 1, 1.5);
        setPreviewUrl(dataUrl);
      } catch (err) {
        console.error('Failed to preview PDF:', err);
      }
    } else {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  // Run Tesseract OCR
  const handleRunOcr = async () => {
    if (!selectedFile) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(5);
    setStatusText('Initializing OCR neural engine...');

    try {
      let imageSource: string | File = selectedFile;
      if (selectedFile.type === 'application/pdf' && previewUrl) {
        imageSource = previewUrl;
      }

      const result = await Tesseract.recognize(imageSource, selectedLang, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const p = Math.round((m.progress || 0) * 80) + 15;
            setProgress(p);
            setStatusText(`Recognizing characters (${Math.round((m.progress || 0) * 100)}%)...`);
          } else if (m.status) {
            setStatusText(`${m.status}...`);
          }
        },
      });

      const text = result.data.text.trim();
      setExtractedText(text);
      setProgress(100);
      setStatusText('Text extraction complete!');

      // Save to history
      const textBlob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      onAddToHistory({
        toolId: 'ocr-extractor',
        toolName: 'Extract Text (OCR)',
        originalName: selectedFile.name,
        resultName: `${selectedFile.name}_extracted.txt`,
        originalSize: selectedFile.size,
        resultSize: textBlob.size,
        savedBytes: 0,
        resultBlob: textBlob,
      });

      // Track action for the repeated Rate Us popup
      trackActionAndCheckRatePrompt();
    } catch (err: any) {
      console.error('OCR error:', err);
      alert(err?.message || 'Failed to extract text from document.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download as plain TXT
  const handleDownloadTxt = () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    const fileName = selectedFile
      ? `${selectedFile.name.replace(/\.[^/.]+$/, '')}_text.txt`
      : 'extracted_text.txt';
    downloadBlob(blob, fileName);
    trackActionAndCheckRatePrompt();
  };

  // Download as Microsoft Word .docx
  const handleDownloadDocx = async () => {
    if (!extractedText) return;
    try {
      const paragraphs = extractedText
        .split('\n')
        .map((line) => new Paragraph({ children: [new TextRun(line)] }));

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
      });

      const docxBlob = await Packer.toBlob(doc);
      const fileName = selectedFile
        ? `${selectedFile.name.replace(/\.[^/.]+$/, '')}_doc.docx`
        : 'extracted_doc.docx';
      downloadBlob(docxBlob, fileName);
      trackActionAndCheckRatePrompt();
    } catch (err) {
      console.error('Docx generation error:', err);
      handleDownloadTxt();
    }
  };

  // Share extracted text via WhatsApp
  const handleWhatsAppShare = () => {
    if (!extractedText) return;
    shareViaWhatsApp({
      title: `OCR Extracted Text (${selectedFile?.name})`,
      message: extractedText.slice(0, 800) + (extractedText.length > 800 ? '...' : ''),
      toolName: 'Extract Text (OCR)',
    });
    trackActionAndCheckRatePrompt();
  };

  const wordCount = extractedText.trim() ? extractedText.trim().split(/\s+/).length : 0;
  const charCount = extractedText.length;
  const companionApp = OUR_APPS_DATA.find((a) => a.id === 'qalamcraft-doc') || OUR_APPS_DATA[0];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <ScanText className="w-5 h-5 text-emerald-500" />
            <span>Image & PDF to Text (Offline OCR)</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Extract text from scanned certificates, forms, invoices, and photos 100% offline with zero data leaks.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
          <span>⚡ Client-Side Neural OCR</span>
        </div>
      </div>

      {/* Drop Zone */}
      {!selectedFile && (
        <DropZone
          onFilesSelected={handleFilesSelected}
          acceptedFormats={['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.pdf']}
          multiple={false}
          title="Drop image or scanned PDF here to extract text"
          subtitle="Supports PNG, JPG, WEBP, BMP, and PDF files"
        />
      )}

      {/* Active Workspace */}
      {selectedFile && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-5 shadow-sm">
          {/* File Overview & Language Settings */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-3">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Document Preview"
                  className="w-12 h-12 object-cover rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm"
                />
              )}
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate max-w-xs">
                  {selectedFile.name}
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  {formatBytes(selectedFile.size)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                <span>Language:</span>
              </label>
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900"
              >
                {OCR_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setExtractedText('');
                }}
                className="text-xs text-red-500 hover:underline px-2 py-1"
              >
                Change File
              </button>
            </div>
          </div>

          {/* Action Trigger */}
          {!extractedText && !isProcessing && (
            <div className="pt-2 text-center sm:text-left">
              <button
                onClick={handleRunOcr}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <ScanText className="w-4 h-4" />
                <span>Extract Text Now</span>
              </button>
            </div>
          )}

          {/* Progress */}
          {isProcessing && <ProgressBar progress={progress} statusText={statusText} />}

          {/* Extracted Text Result Box */}
          {extractedText && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-xs sm:text-sm font-bold">Text Successfully Extracted!</span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800">
                    {wordCount} words
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800">
                    {charCount} characters
                  </span>
                </div>
              </div>

              {/* Text Area */}
              <div className="relative">
                <textarea
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  rows={10}
                  className="w-full p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-stone-900 resize-y"
                  placeholder="Extracted text will appear here..."
                />
              </div>

              {/* Action Buttons: Copy, TXT, DOCX, WhatsApp, Rate */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
                </button>

                <button
                  onClick={handleDownloadDocx}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download Word (.docx)</span>
                </button>

                <button
                  onClick={handleDownloadTxt}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .txt</span>
                </button>

                <button
                  onClick={handleWhatsAppShare}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#25D366] text-white hover:bg-[#20ba59] text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <span>Share on WhatsApp</span>
                </button>

                <button
                  onClick={() => triggerRateUsModal()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-bold transition-all cursor-pointer ml-auto"
                >
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>Rate 5★</span>
                </button>
              </div>

              {/* Cross-Promotion Companion App Box */}
              {companionApp && (
                <div className="mt-4 pt-3.5 border-t border-stone-200 dark:border-stone-800">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${companionApp.iconGradient} flex items-center justify-center text-lg shadow-sm`}
                      >
                        {companionApp.iconEmoji}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                          <span>Need to format this text in Urdu/Arabic or English?</span>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-extrabold px-1.5 py-0.5 rounded">
                            FREE
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400">
                          Try <strong>{companionApp.title}</strong> by RasheedGraphix — Full Nastaliq editor & document creator.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => openMicrosoftStoreApp(companionApp)}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-xs font-bold inline-flex items-center gap-1"
                    >
                      <span>Get Free</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
