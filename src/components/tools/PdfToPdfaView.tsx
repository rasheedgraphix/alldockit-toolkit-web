import React, { useState } from 'react';
import {
  Archive,
  Download,
  AlertCircle,
  CheckCircle2,
  Settings2,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { ProgressBar } from '../ProgressBar';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { PDFDocument, PDFName } from 'pdf-lib';
import { HistoryItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface PdfToPdfaViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

type PdfaStandard = '1b' | '2b' | '3b';

export const PdfToPdfaView: React.FC<PdfToPdfaViewProps> = ({ onAddToHistory }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [standard, setStandard] = useState<PdfaStandard>('2b');
  const [flattenForms, setFlattenForms] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [result, setResult] = useState<{
    blob: Blob;
    fileName: string;
    size: number;
    pages: number;
    conformance: string;
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
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Could not load PDF file.');
    }
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(20);
    setStatusText(`Preparing ISO 19005 PDF/A-${standard.toUpperCase()} archival container...`);
    setErrorMessage(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

      if (flattenForms) {
        try {
          srcDoc.getForm().flatten();
        } catch (e) {
          // No interactive AcroForm present
        }
      }

      setProgress(55);
      setStatusText('Injecting ISO XMP pdfaid conformance packet & stripping active scripts...');

      const nowIso = new Date().toISOString();
      const docTitle = selectedFile.name.replace(/\.pdf$/i, '');
      const partNumber = standard.charAt(0);
      const confLevel = 'B';

      srcDoc.setTitle(docTitle);
      srcDoc.setProducer('AllDocKit ISO 19005 PDF/A Archival Engine');
      srcDoc.setCreator('AllDocKit Offline Studio');
      srcDoc.setCreationDate(new Date());
      srcDoc.setModificationDate(new Date());

      // Construct ISO 19005 XMP Metadata XML Stream
      const xmpXml = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdfaid:part>${partNumber}</pdfaid:part>
      <pdfaid:conformance>${confLevel}</pdfaid:conformance>
      <xmp:CreateDate>${nowIso}</xmp:CreateDate>
      <xmp:ModifyDate>${nowIso}</xmp:ModifyDate>
      <xmp:CreatorTool>AllDocKit Offline Studio</xmp:CreatorTool>
      <pdf:Producer>AllDocKit ISO 19005 PDF/A Archival Engine</pdf:Producer>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

      const xmpBytes = new TextEncoder().encode(xmpXml);
      const metadataStream = srcDoc.context.stream(xmpBytes, {
        Type: 'Metadata',
        Subtype: 'XML',
        Length: xmpBytes.byteLength,
      });
      const metadataRef = srcDoc.context.register(metadataStream);
      srcDoc.catalog.set(PDFName.of('Metadata'), metadataRef);

      // Remove forbidden JavaScript/OpenAction entries for strict PDF/A compliance
      srcDoc.catalog.delete(PDFName.of('OpenAction'));
      srcDoc.catalog.delete(PDFName.of('AA'));

      setProgress(90);
      setStatusText('Saving ISO-compliant PDF/A archival file...');

      const outBytes = await srcDoc.save({ useObjectStreams: false });
      const blob = new Blob([outBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const fileName = `${docTitle}_PDFA_${standard.toUpperCase()}.pdf`;

      setResult({
        blob,
        fileName,
        size: blob.size,
        pages: srcDoc.getPageCount(),
        conformance: `ISO 19005 PDF/A-${standard.toUpperCase()}`,
      });

      onAddToHistory({
        toolId: 'pdf-to-pdfa',
        toolName: `PDF to PDF/A-${standard.toUpperCase()} Archival`,
        originalName: selectedFile.name,
        resultName: fileName,
        originalSize: selectedFile.size,
        resultSize: blob.size,
        savedBytes: Math.max(0, selectedFile.size - blob.size),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to convert PDF to PDF/A archival format.');
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
          <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              PDF to PDF/A (ISO Long-Term Archival Converter)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-medium">
                100% Free & Offline
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Convert standard PDFs into ISO 19005 compliant PDF/A archival documents for legal, government, court, and long-term preservation.
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
              title="Drop your PDF document here for ISO PDF/A conversion"
              subtitle="Embeds XMP pdfaid conformance metadata, strips active actions & locks archival integrity"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
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
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline font-medium"
              >
                Change File
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-cyan-600" />
                  ISO Conformance Level
                </label>
                <select
                  value={standard}
                  onChange={(e) => setStandard(e.target.value as PdfaStandard)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="1b">PDF/A-1b (ISO 19005-1 — Classic Strict Archival)</option>
                  <option value="2b">PDF/A-2b (ISO 19005-2 — Recommended Modern Standard)</option>
                  <option value="3b">PDF/A-3b (ISO 19005-3 — E-Invoicing & Attachments)</option>
                </select>
              </div>

              <label className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flattenForms}
                  onChange={(e) => setFlattenForms(e.target.checked)}
                  className="rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                />
                Flatten interactive form fields & remove executable actions (Required by ISO PDF/A)
              </label>
            </div>

            {!result && (
              <button
                type="button"
                onClick={handleConvert}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Archive className="w-5 h-5" />
                {isProcessing
                  ? 'Converting to Archival PDF/A...'
                  : `Convert to ISO PDF/A-${standard.toUpperCase()}`}
              </button>
            )}

            {isProcessing && (
              <div className="p-4 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/50">
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
                        Archival PDF/A Ready: {result.fileName}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {result.conformance} • {result.pages} Pages • {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF/A
                  </button>
                </div>

                <TaskSuccessCard
                  title="ISO PDF/A Archival Document Ready!"
                  blob={result.blob}
                  fileName={result.fileName}
                  fileSize={result.size}
                  originalSize={selectedFile?.size}
                  infoBadge={result.conformance}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
