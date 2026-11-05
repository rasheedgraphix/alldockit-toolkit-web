import React, { useState, useRef, useEffect } from 'react';
import {
  Scan,
  Camera,
  Upload,
  Copy,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Zap,
  QrCode,
  Barcode,
  Eye,
  StopCircle,
} from 'lucide-react';
import { DropZone } from '../DropZone';
import { TaskSuccessCard } from '../TaskSuccessCard';
import { HistoryItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { shareViaWhatsApp, trackActionAndCheckRatePrompt, triggerRateUsModal } from '../../utils/share';
import { OUR_APPS_DATA, openMicrosoftStoreApp } from '../../data/ourApps';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface CodeScannerViewProps {
  onAddToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
}

interface ScanResult {
  text: string;
  formatName: string;
  timestamp: number;
}

export const CodeScannerView: React.FC<CodeScannerViewProps> = ({ onAddToHistory }) => {
  const { verifyAccessBeforeAction } = useAuth();

  const [activeTab, setActiveTab] = useState<'image' | 'camera'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-barcode-reader-viewport';

  // Initialize camera list
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          setSelectedCameraId(devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('Camera enumeration error or permission not granted yet:', err);
      });

    return () => {
      // Stop camera if component unmounts
      if (html5QrCodeRef.current && isCameraActive) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Handle Scanning from Uploaded Image File
  const handleScanImageFile = async (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setScanResult(null);
    setErrorMessage(null);
    setIsScanning(true);

    try {
      // Initialize scanner instance with all supported 1D and 2D formats
      const html5QrCode = new Html5Qrcode('file-scanner-hidden-zone', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR,
        ],
        verbose: false,
      });

      const decodedText = await html5QrCode.scanFile(file, false);

      const resultObj: ScanResult = {
        text: decodedText,
        formatName: decodedText.length > 30 ? 'QR Code' : 'Barcode / QR Code',
        timestamp: Date.now(),
      };

      setScanResult(resultObj);

      // Log to history
      const resultBlob = new Blob([decodedText], { type: 'text/plain;charset=utf-8' });
      onAddToHistory({
        toolId: 'code-scanner',
        toolName: 'QR & Barcode Scanner',
        originalName: file.name,
        resultName: `Decoded: ${decodedText.slice(0, 30)}`,
        originalSize: file.size,
        resultSize: resultBlob.size,
        savedBytes: 0,
        resultBlob: resultBlob,
      });

      trackActionAndCheckRatePrompt();
    } catch (err: any) {
      console.warn('Scan file error, attempting native BarcodeDetector fallback:', err);
      // Fallback: Try native BarcodeDetector if available in browser
      try {
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector();
          const img = new Image();
          img.src = URL.createObjectURL(file);
          await new Promise((res) => {
            img.onload = res;
          });
          const detected = await detector.detect(img);
          if (detected && detected.length > 0) {
            const first = detected[0];
            const resultObj: ScanResult = {
              text: first.rawValue,
              formatName: first.format || 'Detected Code',
              timestamp: Date.now(),
            };
            setScanResult(resultObj);
            trackActionAndCheckRatePrompt();
            return;
          }
        }
      } catch (fallbackErr) {
        console.warn('Native fallback failed:', fallbackErr);
      }

      setErrorMessage(
        'No valid QR code or Barcode detected in this image. Please ensure the code is clear, well-lit, and not blurry.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  // Start Live Webcam / Camera Scanning
  const handleStartCamera = async () => {
    const canProceed = await verifyAccessBeforeAction();
    if (!canProceed) return;

    setScanResult(null);
    setErrorMessage(null);

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
          verbose: false,
        });
      }

      const cameraId = selectedCameraId || { facingMode: 'environment' };

      await html5QrCodeRef.current.start(
        cameraId,
        {
          fps: 15,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
        },
        (decodedText, decodedResult) => {
          // Success callback
          const format =
            decodedResult?.result?.format?.formatName || 'QR / Barcode';

          setScanResult({
            text: decodedText,
            formatName: format,
            timestamp: Date.now(),
          });

          // Play short beep if supported
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 1800;
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.12);
          } catch {
            // ignore audio context failures
          }

          // Stop camera once scanned
          handleStopCamera();

          // Log to history
          const resultBlob = new Blob([decodedText], { type: 'text/plain;charset=utf-8' });
          onAddToHistory({
            toolId: 'code-scanner',
            toolName: 'QR & Barcode Scanner',
            originalName: 'Live Camera Scan',
            resultName: `Decoded: ${decodedText.slice(0, 30)}`,
            originalSize: 0,
            resultSize: resultBlob.size,
            savedBytes: 0,
            resultBlob: resultBlob,
          });

          trackActionAndCheckRatePrompt();
        },
        (errorMessage) => {
          // frame parse error (silent)
        }
      );

      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera start error:', err);
      setErrorMessage(
        'Unable to access camera. Please check camera permissions in your system settings.'
      );
      setIsCameraActive(false);
    }
  };

  // Stop Live Webcam
  const handleStopCamera = async () => {
    if (html5QrCodeRef.current && isCameraActive) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.warn('Error stopping camera:', err);
      }
      setIsCameraActive(false);
    }
  };

  const handleCopy = () => {
    if (!scanResult) return;
    navigator.clipboard.writeText(scanResult.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUrl = (val: string) => {
    try {
      const url = new URL(val);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const companionApp = OUR_APPS_DATA.find((a) => a.id === 'qalamcraft-doc') || OUR_APPS_DATA[0];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hidden container for file-based scanner */}
      <div id="file-scanner-hidden-zone" className="hidden" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Scan className="w-5 h-5 text-indigo-500" />
            <span>Smart QR Code & 1D Barcode Scanner</span>
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Instantly decode QR Codes, retail Barcodes (Code 128, EAN-13, UPC), and DataMatrix from photos or live webcam.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
          <Zap className="w-3.5 h-3.5" />
          <span>100% Client-Side Engine</span>
        </div>
      </div>

      {/* Tab Selector: Upload Image vs Live Camera */}
      <div className="flex items-center gap-2 p-1.5 bg-stone-100 dark:bg-stone-800 rounded-2xl max-w-md">
        <button
          type="button"
          onClick={() => {
            if (isCameraActive) handleStopCamera();
            setActiveTab('image');
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'image'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload Image / Photo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'camera'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Live Webcam Scanner</span>
        </button>
      </div>

      {/* Tab 1: Image Upload Mode */}
      {activeTab === 'image' && (
        <div className="space-y-4">
          {!previewUrl && (
            <DropZone
              onFilesSelected={(files) => {
                if (files.length > 0) handleScanImageFile(files[0]);
              }}
              acceptedFormats={['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif']}
              multiple={false}
              title="Drop QR code or Barcode image here"
              subtitle="Supports screenshots, phone photos, PNG, JPG, and WebP"
            />
          )}

          {previewUrl && (
            <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Uploaded Code Image
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setScanResult(null);
                    setErrorMessage(null);
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Scan Another Image
                </button>
              </div>

              <div className="h-56 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex items-center justify-center overflow-hidden p-2">
                <img
                  src={previewUrl}
                  alt="Scanned Code"
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              </div>

              {isScanning && (
                <div className="text-center py-4 space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                    Scanning image for QR Code and Barcode patterns...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live Camera Scanner Mode */}
      {activeTab === 'camera' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-indigo-500" />
                <span>Webcam / Device Camera</span>
              </h3>
              <p className="text-[11px] text-stone-500">
                Hold any QR code or barcode product in front of the lens.
              </p>
            </div>

            {cameras.length > 1 && (
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                disabled={isCameraActive}
                className="px-3 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Camera ${c.id}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Video Viewport Container */}
          <div className="relative mx-auto max-w-sm h-80 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 bg-stone-950 overflow-hidden flex items-center justify-center">
            <div id={scannerContainerId} className="w-full h-full object-cover" />

            {/* Target Box Guide Overlay */}
            {isCameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-64 h-64 border-2 border-emerald-400 rounded-2xl shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                  {/* Laser Scan Beam */}
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse top-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            {!isCameraActive && (
              <div className="text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-stone-800 text-stone-400 flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6" />
                </div>
                <p className="text-xs text-stone-400">
                  Camera is currently off. Click below to start scanning.
                </p>
              </div>
            )}
          </div>

          {/* Camera Trigger Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            {!isCameraActive ? (
              <button
                type="button"
                onClick={handleStartCamera}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Start Live Camera</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopCamera}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <StopCircle className="w-4 h-4" />
                <span>Stop Camera</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
          {errorMessage}
        </div>
      )}

      {/* Decoded Result Card */}
      {scanResult && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-stone-900 border border-emerald-500/40 shadow-lg space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <h3 className="text-sm sm:text-base font-bold">Successfully Decoded!</h3>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              {scanResult.formatName}
            </span>
          </div>

          {/* Result Text Content */}
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 font-mono text-xs text-stone-900 dark:text-stone-100 break-all select-all">
            {scanResult.text}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Data'}</span>
            </button>

            {isUrl(scanResult.text) && (
              <a
                href={scanResult.text}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open URL</span>
              </a>
            )}

            {/* Google Search lookup for product barcodes */}
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(scanResult.text)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-all"
            >
              <Search className="w-4 h-4" />
              <span>Search Product Online</span>
            </a>

            {/* WhatsApp Share */}
            <button
              onClick={() => {
                shareViaWhatsApp({
                  title: `Scanned ${scanResult.formatName}`,
                  message: scanResult.text,
                  toolName: 'QR & Barcode Scanner',
                });
                trackActionAndCheckRatePrompt();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share on WhatsApp</span>
            </button>

            {/* Rate Us Button */}
            <button
              onClick={() => triggerRateUsModal()}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-bold transition-all cursor-pointer ml-auto"
            >
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
                      <span>Need to write or print documents?</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-extrabold px-1.5 py-0.5 rounded">
                        FREE
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Try <strong>{companionApp.title}</strong> by RasheedGraphix on Microsoft Store.
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
  );
};
