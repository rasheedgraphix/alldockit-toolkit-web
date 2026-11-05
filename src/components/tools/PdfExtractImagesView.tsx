import React, { useState } from 'react';
import {
  Images,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import JSZip from 'jszip';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';
import { getPdfJs } from '../../utils/pdfOperations';

interface PdfExtractImagesViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

interface ExtractedImgItem {
  id: string;
  name: string;
  pageNumber: number;
  width: number;
  height: number;
  dataUrl: string;
  blob: Blob;
}

export const PdfExtractImagesView: React.FC<PdfExtractImagesViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [extractedList, setExtractedList] = useState<ExtractedImgItem[]>([]);
  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg'>('png');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    count: number;
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
    setExtractedList([]);
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

  const handleExtract = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(10);
    setStatusText('Scanning PDF object streams for embedded images & figures...');
    setErrorMessage(null);

    try {
      const pdfjs = await getPdfJs();
      const buffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const totalPages = pdf.numPages;

      const items: ExtractedImgItem[] = [];
      const mime = imgFormat === 'png' ? 'image/png' : 'image/jpeg';
      const ext = imgFormat === 'png' ? 'png' : 'jpg';

      for (let p = 1; p <= totalPages; p++) {
        setStatusText(`Inspecting Page ${p} of ${totalPages} for embedded photos & graphics...`);
        const page = await pdf.getPage(p);
        let foundRawImageOnPage = false;

        try {
          const opList = await page.getOperatorList();
          const OPS = pdfjs.OPS || {};

          for (let i = 0; i < opList.fnArray.length; i++) {
            const fn = opList.fnArray[i];
            if (
              fn === OPS.paintImageXObject ||
              fn === OPS.paintJpegXObject ||
              fn === OPS.paintInlineImageXObject
            ) {
              const objId = opList.argsArray[i]?.[0];
              if (!objId) continue;

              const imgObj: any = await new Promise((resolve) => {
                try {
                  page.objs.get(objId, (obj: any) => resolve(obj));
                } catch {
                  resolve(null);
                }
              });

              if (imgObj && imgObj.width > 32 && imgObj.height > 32) {
                const c = document.createElement('canvas');
                c.width = imgObj.width;
                c.height = imgObj.height;
                const ctx = c.getContext('2d');
                if (ctx) {
                  if (imgObj.bitmap) {
                    ctx.drawImage(imgObj.bitmap, 0, 0);
                    foundRawImageOnPage = true;
                  } else if (imgObj.data) {
                    const imageData = ctx.createImageData(imgObj.width, imgObj.height);
                    const src = imgObj.data;
                    const dst = imageData.data;
                    if (src.length === imgObj.width * imgObj.height * 4) {
                      dst.set(src);
                    } else if (src.length === imgObj.width * imgObj.height * 3) {
                      for (let j = 0, k = 0; j < src.length; j += 3, k += 4) {
                        dst[k] = src[j];
                        dst[k + 1] = src[j + 1];
                        dst[k + 2] = src[j + 2];
                        dst[k + 3] = 255;
                      }
                    }
                    ctx.putImageData(imageData, 0, 0);
                    foundRawImageOnPage = true;
                  }

                  if (foundRawImageOnPage) {
                    const dataUrl = c.toDataURL(mime, 0.92);
                    const blob = await (await fetch(dataUrl)).blob();
                    const idxNum = items.length + 1;
                    items.push({
                      id: `img-${p}-${idxNum}`,
                      name: `Page_${p}_Image_${idxNum}.${ext}`,
                      pageNumber: p,
                      width: imgObj.width,
                      height: imgObj.height,
                      dataUrl,
                      blob,
                    });
                  }
                }
              }
            }
          }
        } catch {
          // Fallback to page figure capture below
        }

        // If page had vector artwork / composite photo without standalone XObject bitmap, extract high-res visual plate
        if (!foundRawImageOnPage) {
          const vp = page.getViewport({ scale: 2.0 });
          const c = document.createElement('canvas');
          c.width = Math.floor(vp.width);
          c.height = Math.floor(vp.height);
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, c.width, c.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            const dataUrl = c.toDataURL(mime, 0.92);
            const blob = await (await fetch(dataUrl)).blob();
            const idxNum = items.length + 1;
            items.push({
              id: `plate-${p}-${idxNum}`,
              name: `Page_${p}_Graphic_${idxNum}.${ext}`,
              pageNumber: p,
              width: c.width,
              height: c.height,
              dataUrl,
              blob,
            });
          }
        }

        setProgress(Math.round(15 + (p / totalPages) * 70));
      }

      setProgress(90);
      setStatusText(`Packaging ${items.length} extracted images into ZIP archive...`);

      const zip = new JSZip();
      items.forEach((it) => {
        zip.file(it.name, it.blob);
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
      });

      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const fileName = `${baseName}_Extracted_Images_${items.length}.zip`;

      setExtractedList(items);
      setResult({
        blob: zipBlob,
        fileName,
        size: zipBlob.size,
        count: items.length,
      });

      onAddToHistory({
        toolId: 'pdf-extract-images',
        toolName: 'Extract All Images from PDF',
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: zipBlob.size,
        savedBytes: Math.max(0, selectedFile.size - zipBlob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to extract images from PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = () => {
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
          <div className="p-2.5 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-600 dark:text-fuchsia-400">
            <Images className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Extract All Images & Photos from PDF
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pull embedded photos, logos, diagrams, and high-res graphics out of any PDF file and download individually or as a ZIP.
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
              title="Drop your PDF file here to extract all embedded images"
              subtitle="Extracts embedded XObject bitmaps, photos, and figures into PNG or JPG"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-fuchsia-600 dark:text-fuchsia-400 flex-shrink-0" />
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
                  setExtractedList([]);
                  setResult(null);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change File
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Export Image Format:
              </span>
              <select
                value={imgFormat}
                onChange={(e) => setImgFormat(e.target.value as 'png' | 'jpeg')}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="png">Lossless PNG (.png)</option>
                <option value="jpeg">Compact High-Quality JPEG (.jpg)</option>
              </select>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleExtract}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Images className="w-5 h-5" />
                {isProcessing ? 'Extracting Images...' : 'Extract All Images from PDF'}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-fuchsia-50/50 dark:bg-fuchsia-950/30 border border-fuchsia-100 dark:border-fuchsia-900/50">
                <ProgressBar progress={progress} statusText={statusText} />
              </div>
            )}

            {extractedList.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Extracted Images Gallery ({extractedList.length} items — click any image to save individually):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                  {extractedList.map((item) => (
                    <a
                      key={item.id}
                      href={item.dataUrl}
                      download={item.name}
                      className="group relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 flex flex-col items-center hover:border-fuchsia-500 transition"
                    >
                      <img
                        src={item.dataUrl}
                        alt={item.name}
                        className="h-24 object-contain rounded"
                      />
                      <span className="mt-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate w-full text-center">
                        Page {item.pageNumber} ({item.width}×{item.height})
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                        Extracted {result.count} Images: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        ZIP Archive Size: {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    Download All (ZIP)
                  </button>
                </div>

                <TaskSuccessCard
                  title="Extracted Images ZIP Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={`${result.count} Images`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
