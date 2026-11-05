import React, { useState } from 'react';
import {
  FileImage,
  Download,
  CheckCircle2,
  FileArchive,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { formatBytes, downloadBlob, createZipAndDownload, getPdfInfo } from '../../utils/fileHelpers';
import { renderPdfPagesToImages } from '../../utils/pdfOperations';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface PdfToImagesViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

export const PdfToImagesView: React.FC<PdfToImagesViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [quality, setQuality] = useState<number>(90);
  const [dpiScale, setDpiScale] = useState<number>(2.0); // 1.0 (Standard), 2.0 (High Res HD), 3.0 (Ultra HD)
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [extractedImages, setExtractedImages] = useState<
    { pageNumber: number; blob: Blob; url: string; width: number; height: number }[] | null
  >(null);

  const handleFileSelected = async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      const info = await getPdfInfo(file);
      setPageCount(info.pageCount);
      setExtractedImages(null);
    }
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setIsProcessing(true);
    setProgress(5);
    setStatusText('Preparing PDF page rendering engine...');

    try {
      const results = await renderPdfPagesToImages(
        selectedFile,
        format,
        quality / 100,
        dpiScale,
        (p, text) => {
          setProgress(p);
          setStatusText(text);
        }
      );

      const mappedImages = results.map((item) => ({
        ...item,
        url: URL.createObjectURL(item.blob),
      }));

      setExtractedImages(mappedImages);

      const totalResultSize = results.reduce((sum, item) => sum + item.blob.size, 0);

      onAddToHistory({
        toolId: 'pdf-to-images',
        toolName: 'PDF to Images',
        originalName: selectedFile.name,
        resultName: `${results.length} ${format.toUpperCase()} images (${selectedFile.name.replace('.pdf', '')}_images.zip)`,
        originalSize: selectedFile.size,
        resultSize: totalResultSize,
        savedBytes: 0,
      });
    } catch (err: any) {
      console.error('Extraction error:', err);
      alert(err.message || 'Failed to extract images from PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadAllZip = async () => {
    if (!selectedFile || !extractedImages) return;
    const baseName = selectedFile.name.replace('.pdf', '');
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const filesToZip = extractedImages.map((img) => ({
      name: `${baseName}_page_${img.pageNumber}.${ext}`,
      blob: img.blob,
    }));
    await createZipAndDownload(filesToZip, `${baseName}_extracted_pages.zip`);
  };

  const handleDownloadSingle = (item: { pageNumber: number; blob: Blob }) => {
    if (!selectedFile) return;
    const baseName = selectedFile.name.replace('.pdf', '');
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    downloadBlob(item.blob, `${baseName}_page_${item.pageNumber}.${ext}`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <FileImage className="w-5 h-5 text-indigo-500" />
            PDF to Images Extractor
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Convert every PDF page into crystal clear HD JPG or PNG images with 1-click ZIP export.
          </p>
        </div>
      </div>

      {!selectedFile ? (
        <DropZone
          onFilesSelected={handleFileSelected}
          acceptedFormats={['.pdf']}
          multiple={false}
          title="Drop your PDF here to convert to images"
          subtitle="Supports single & multi-page PDF documents. 100% private in-browser rendering."
        />
      ) : (
        <div className="space-y-6">
          {/* File summary */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                PDF
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate max-w-md">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  {formatBytes(selectedFile.size)} • {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                setExtractedImages(null);
              }}
              className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 font-medium px-3 py-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            >
              Change File
            </button>
          </div>

          {/* Configuration Options */}
          {!extractedImages && (
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Image Export Settings
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Format selection */}
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                    Output Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormat('png')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        format === 'png'
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                      }`}
                    >
                      PNG (Lossless)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormat('jpeg')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        format === 'jpeg'
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                          : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                      }`}
                    >
                      JPG (Compact)
                    </button>
                  </div>
                </div>

                {/* Resolution / DPI */}
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                    Resolution Quality
                  </label>
                  <select
                    value={dpiScale}
                    onChange={(e) => setDpiScale(parseFloat(e.target.value))}
                    className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                  >
                    <option value="1.0">Standard (72 DPI - Fast)</option>
                    <option value="2.0">High Definition (150 DPI - Recommended)</option>
                    <option value="3.0">Ultra HD Print (300 DPI - Sharpest)</option>
                  </select>
                </div>

                {/* JPG Quality if applicable */}
                {format === 'jpeg' && (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[11px] font-medium text-stone-700 dark:text-stone-300">
                        JPEG Quality
                      </label>
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        {quality}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={quality}
                      onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  {isProcessing ? 'Converting Pages...' : `Convert ${pageCount} Pages to ${format.toUpperCase()}`}
                </button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {isProcessing && (
            <ProgressBar progress={progress} statusText={statusText} />
          )}

          {/* Results Grid */}
          {extractedImages && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Successfully converted {extractedImages.length} {extractedImages.length === 1 ? 'page' : 'pages'} to HD images!
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadAllZip}
                    className="py-2 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <FileArchive className="w-4 h-4" />
                    Download All as ZIP
                  </button>
                  <button
                    onClick={() => setExtractedImages(null)}
                    className="py-2 px-3 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-50"
                  >
                    Reconfigure
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {extractedImages.map((img) => (
                  <div
                    key={img.pageNumber}
                    className="group relative rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-2 shadow-xs hover:border-indigo-400 transition-all flex flex-col justify-between"
                  >
                    <div className="aspect-3/4 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-2">
                      <img
                        src={img.url}
                        alt={`Page ${img.pageNumber}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800 text-[11px]">
                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                        Page {img.pageNumber}
                      </span>
                      <button
                        onClick={() => handleDownloadSingle(img)}
                        className="p-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded"
                        title="Download Page"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
