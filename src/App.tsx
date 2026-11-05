/**
 * PDF & Image Toolkit - All in One Offline & 100% Free
 * 100% Client-side local processing using pdf-lib, PDF.js, Canvas, and Web APIs.
 * Zero server costs. Private, fast, and completely free forever.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ToolId, HistoryItem, AppSettings } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PdfMergerView } from './components/tools/PdfMergerView';
import { PdfSplitterView } from './components/tools/PdfSplitterView';
import { PdfOrganizerView } from './components/tools/PdfOrganizerView';
import { PdfToImagesView } from './components/tools/PdfToImagesView';
import { PdfWatermarkView } from './components/tools/PdfWatermarkView';
import { PdfCompressorView } from './components/tools/PdfCompressorView';
import { PdfProtectView } from './components/tools/PdfProtectView';
import { HtmlToPdfView } from './components/tools/HtmlToPdfView';
import { PdfToHtmlView } from './components/tools/PdfToHtmlView';
import { ImagesToPdfView } from './components/tools/ImagesToPdfView';
import { ImageConverterView } from './components/tools/ImageConverterView';
import { ImageResizerView } from './components/tools/ImageResizerView';
import { CertificateEditorView } from './components/tools/CertificateEditorView';
import { PdfSignatureView } from './components/tools/PdfSignatureView';
import { OcrExtractorView } from './components/tools/OcrExtractorView';
import { IdCardMergeView } from './components/tools/IdCardMergeView';
import { PassportPhotoView } from './components/tools/PassportPhotoView';
import { BarcodeStudioView } from './components/tools/BarcodeStudioView';
import { CodeScannerView } from './components/tools/CodeScannerView';
import { ExifCleanerView } from './components/tools/ExifCleanerView';
import { InvoiceMakerView } from './components/tools/InvoiceMakerView';
import { TextToSpeechView } from './components/tools/TextToSpeechView';
import { QrStudioView } from './components/tools/QrStudioView';
import { PdfUnlockView } from './components/tools/PdfUnlockView';
import { CamScannerView } from './components/tools/CamScannerView';
import { PdfCropView } from './components/tools/PdfCropView';
import { BatchRenamerView } from './components/tools/BatchRenamerView';
import { BgRemoverView } from './components/tools/BgRemoverView';
import { PdfNupView } from './components/tools/PdfNupView';
import { PdfRedactView } from './components/tools/PdfRedactView';
import { PdfResizerView } from './components/tools/PdfResizerView';
import { PhotoCollageView } from './components/tools/PhotoCollageView';
import { SpeechToTextView } from './components/tools/SpeechToTextView';
import { PdfBookletView } from './components/tools/PdfBookletView';
import { BusinessCardSheetView } from './components/tools/BusinessCardSheetView';
import { PdfGrayscaleView } from './components/tools/PdfGrayscaleView';
import { PdfFlattenView } from './components/tools/PdfFlattenView';
import { BatchWatermarkView } from './components/tools/BatchWatermarkView';
import { PdfToWordView } from './components/tools/PdfToWordView';
import { WordToPdfView } from './components/tools/WordToPdfView';
import { PdfToExcelView } from './components/tools/PdfToExcelView';
import { ExcelToPdfView } from './components/tools/ExcelToPdfView';
import { PdfToPptView } from './components/tools/PdfToPptView';
import { PptToPdfView } from './components/tools/PptToPdfView';
import { PdfRepairView } from './components/tools/PdfRepairView';
import { PdfCompareView } from './components/tools/PdfCompareView';
import { PdfToPdfaView } from './components/tools/PdfToPdfaView';
import { PdfBatesView } from './components/tools/PdfBatesView';
import { PdfExtractImagesView } from './components/tools/PdfExtractImagesView';
import { PdfBgColorView } from './components/tools/PdfBgColorView';
import { ImageStitcherView } from './components/tools/ImageStitcherView';
import { PosterTileView } from './components/tools/PosterTileView';
import { PdfMetadataView } from './components/tools/PdfMetadataView';
import { BulkCropperView } from './components/tools/BulkCropperView';
import { IdCardMakerView } from './components/tools/IdCardMakerView';
import { HistoryView } from './components/tools/HistoryView';
import { SettingsView } from './components/tools/SettingsView';
import { OurAppsView } from './components/tools/OurAppsView';
import { checkForUpdate, UpdateInfo } from './utils/updater';
import { UpdateModal } from './components/UpdateModal';
import { RateUsModal } from './components/RateUsModal';
import { useAuth } from './contexts/AuthContext';
import {
  requestNotificationPermission,
  onMessageListener,
  emitInAppNotification,
  AppNotification,
} from './utils/firebase';
import { NotificationToast } from './components/NotificationToast';
import { UpgradeModal } from './components/UpgradeModal';

const TOOL_NAMES: Record<ToolId, string> = {
  'pdf-merger': 'PDF Merger',
  'pdf-splitter': 'PDF Splitter & Page Extractor',
  'pdf-organizer': 'PDF Organize & Rotate Pages',
  'pdf-to-images': 'PDF to Images Extractor (HD)',
  'pdf-watermark': 'PDF Watermark & Page Numbering',
  'pdf-compressor': 'PDF Compressor',
  'pdf-protect': 'PDF Password Protect & Lock',
  'pdf-unlock': 'PDF Password Remover & Permanent Unlock',
  'pdf-crop': 'PDF Page Cropper & Margin Trimmer',
  'pdf-nup': 'PDF N-Up Handout Grid Maker (2-in-1, 4-in-1)',
  'pdf-redact': 'PDF Redaction & Privacy Blackout Marker',
  'pdf-resizer': 'PDF Page Size Converter (A4, Letter, Legal)',
  'photo-collage': 'Photo Collage & Before/After Studio',
  'speech-to-text': 'Voice to Text & Speech Transcriber (Live)',
  'cam-scanner': 'CamScanner Magic Filter (Shadow Remover)',
  'bg-remover': 'Image Background Remover & Transparent PNG',
  'batch-renamer': 'Batch File & Photo Renamer (ZIP)',
  'certificate-editor': 'Certificate & Text Eraser (Object/Name Remover)',
  'pdf-signature': 'PDF Digital Signature & Stamp (Offline)',
  'ocr-extractor': 'Image & PDF to Text (Offline Neural OCR)',
  'id-card-merge': 'CNIC & ID Card 2-in-1 Side Merge (A4 Ready)',
  'passport-photo': 'Passport Size Photo Maker & Studio Sheet',
  'barcode-studio': '1D Barcode Studio (Code 128 / Retail)',
  'code-scanner': 'QR & Barcode Scanner Studio (Live & Image)',
  'exif-cleaner': 'Photo Device Info, Date & GPS Location Finder',
  'invoice-maker': 'Instant Invoice & Cash Receipt Maker',
  'html-to-pdf': 'HTML to PDF Converter (Offline)',
  'pdf-to-html': 'PDF to HTML Converter (Offline)',
  'images-to-pdf': 'Images to PDF',
  'image-converter': 'Image Converter (PNG, JPG, WEBP, HEIC)',
  'image-compressor': 'Image Compressor & Resizer (-90%)',
  'text-to-speech': 'Text to Speech & Voice Reader (Offline)',
  'qr-studio': 'Smart QR Code Studio',
  'pdf-booklet': 'PDF Booklet & Magazine Maker (Saddle Stitch)',
  'business-card-sheet': 'Visiting / Business Card 10-on-A4 Studio',
  'pdf-grayscale': 'PDF Color to Grayscale & Pure B&W (Ink Saver)',
  'pdf-flatten': 'PDF Form Flattener & Anti-Tamper Lock',
  'batch-watermark': 'Batch Image Watermarker & Logo Stamper',
  'pdf-to-word': 'PDF to Word (.docx) Converter',
  'word-to-pdf': 'Word (.docx) to PDF Converter',
  'pdf-to-excel': 'PDF to Excel (.xlsx / .csv) Table Extractor',
  'excel-to-pdf': 'Excel (.xlsx / .csv) to PDF Converter',
  'pdf-to-ppt': 'PDF to PowerPoint (.pptx) Presentation Converter',
  'ppt-to-pdf': 'PowerPoint (.pptx) to PDF Converter',
  'pdf-repair': 'Repair PDF (Corrupt & Damaged File Recovery)',
  'pdf-compare': 'Compare PDF (Side-by-Side Diff Viewer)',
  'pdf-to-pdfa': 'PDF to PDF/A (ISO Long-Term Archival Converter)',
  'pdf-bates': 'PDF Header, Footer & Bates Numbering Studio',
  'pdf-extract-images': 'Extract All Images & Photos from PDF (ZIP)',
  'pdf-bg-color': 'PDF Page Background Color & Dark Mode Reader',
  'image-stitcher': 'Long Screenshot, Chat & Receipt Stitcher',
  'poster-tile': 'Poster & Banner Multi-Page A4 Tile Printer',
  'pdf-metadata': 'PDF Metadata & Properties Editor / Wiper',
  'bulk-cropper': 'Bulk Image Aspect Ratio Cropper (1:1, 16:9, 4:5)',
  'id-card-maker': 'Employee & Student ID Card Studio (Front & Back + QR)',
  history: 'Conversion History',
  settings: 'Desktop Settings & Packaging',
  'our-apps': 'More Apps by RasheedGraphix (Free Store)',
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  defaultImageQuality: 85,
  defaultPdfCompression: 'medium',
  preserveTransparency: true,
  autoDownloadAfterProcess: false,
  historyLimit: 50,
};

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolId>('pdf-merger');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('app_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('app_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // fallback
    }
    return DEFAULT_SETTINGS;
  });

  const { openLoginModal } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [autoUpdateInfo, setAutoUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showAutoUpdateModal, setShowAutoUpdateModal] = useState(false);
  const [toastNotification, setToastNotification] = useState<AppNotification | null>(null);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<'monthly' | 'annual'>('annual');
  const [showRateUsModal, setShowRateUsModal] = useState(false);

  useEffect(() => {
    const handleOpenUpgrade = (e: any) => {
      const plan = e.detail?.plan === 'monthly' ? 'monthly' : 'annual';
      setUpgradePlan(plan);
      setShowUpgradeModal(true);
    };
    const handleTriggerRateUs = () => {
      setShowRateUsModal(true);
    };

    window.addEventListener('open-upgrade-modal', handleOpenUpgrade);
    window.addEventListener('trigger-rate-us', handleTriggerRateUs);

    // Initial check: if user already has completed conversions, gently show popup
    const checkTimer = setTimeout(() => {
      const count = parseInt(localStorage.getItem('alldockit_action_counter') || '0', 10);
      if (count >= 1) {
        setShowRateUsModal(true);
      }
    }, 12000);

    return () => {
      window.removeEventListener('open-upgrade-modal', handleOpenUpgrade);
      window.removeEventListener('trigger-rate-us', handleTriggerRateUs);
      clearTimeout(checkTimer);
    };
  }, []);

  // Silently check for updates 3 seconds after application startup
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const update = await checkForUpdate();
        if (update.hasUpdate) {
          setAutoUpdateInfo(update);
          setShowAutoUpdateModal(true);
        }
      } catch (err) {
        console.warn('Silent update check failed:', err);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Request Notification permission after 5 seconds
  useEffect(() => {
    const notifTimer = setTimeout(async () => {
      try {
        await requestNotificationPermission();
      } catch (err) {
        console.warn('Error requesting notification permission:', err);
      }
    }, 5000);
    return () => clearTimeout(notifTimer);
  }, []);

  // Listen for foreground FCM and in-app notifications
  useEffect(() => {
    const unsubscribe = onMessageListener((payload) => {
      setToastNotification(payload);
    });

    const sampleTimer = setTimeout(() => {
      if (localStorage.getItem('notifications_enabled') === 'true') {
        emitInAppNotification({
          title: 'AllDocKit Toolkit',
          body: 'All new PDF to Images, Page Organizer, Watermark & QR Code tools are now ready!',
        });
      }
    }, 7000);

    return () => {
      unsubscribe();
      clearTimeout(sampleTimer);
    };
  }, []);

  // Apply dark mode class and data-theme to html document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
  }, [settings]);

  // Listen for upgrade navigation event
  useEffect(() => {
    const handleOpenUpgrade = () => {
      setActiveTool('settings');
    };
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ toolId: ToolId }>;
      if (customEvent.detail?.toolId) {
        setActiveTool(customEvent.detail.toolId);
      }
    };
    window.addEventListener('open-upgrade-settings', handleOpenUpgrade);
    window.addEventListener('navigate-tool', handleNavigate);
    return () => {
      window.removeEventListener('open-upgrade-settings', handleOpenUpgrade);
      window.removeEventListener('navigate-tool', handleNavigate);
    };
  }, []);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleAddToHistory = (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    setHistory((prev) => [newItem, ...prev].slice(0, settings.historyLimit));
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.theme) {
        setTheme(newSettings.theme);
      }
      return updated;
    });
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    setTheme(DEFAULT_SETTINGS.theme);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-stone-900 dark:bg-stone-950 dark:text-stone-100 font-sans transition-colors antialiased">
      {/* Sidebar Navigation (Desktop Static + Mobile Drawer) */}
      <Sidebar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        historyCount={history.length}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeTool={activeTool}
          theme={theme}
          onToggleTheme={toggleTheme}
          toolNames={TOOL_NAMES}
          onOpenAuth={openLoginModal}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTool}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {activeTool === 'pdf-merger' && (
                <PdfMergerView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-splitter' && (
                <PdfSplitterView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-organizer' && (
                <PdfOrganizerView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-to-images' && (
                <PdfToImagesView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-watermark' && (
                <PdfWatermarkView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-compressor' && (
                <PdfCompressorView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-protect' && (
                <PdfProtectView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-unlock' && (
                <PdfUnlockView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-crop' && (
                <PdfCropView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-nup' && (
                <PdfNupView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-redact' && (
                <PdfRedactView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-resizer' && (
                <PdfResizerView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'certificate-editor' && (
                <CertificateEditorView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-signature' && (
                <PdfSignatureView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'ocr-extractor' && (
                <OcrExtractorView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'id-card-merge' && (
                <IdCardMergeView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'passport-photo' && (
                <PassportPhotoView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'barcode-studio' && (
                <BarcodeStudioView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'code-scanner' && (
                <CodeScannerView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'exif-cleaner' && (
                <ExifCleanerView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'invoice-maker' && (
                <InvoiceMakerView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'html-to-pdf' && (
                <HtmlToPdfView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-to-html' && (
                <PdfToHtmlView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'images-to-pdf' && (
                <ImagesToPdfView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'image-converter' && (
                <ImageConverterView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'image-compressor' && (
                <ImageResizerView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'cam-scanner' && (
                <CamScannerView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'bg-remover' && (
                <BgRemoverView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'photo-collage' && (
                <PhotoCollageView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'batch-renamer' && (
                <BatchRenamerView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'text-to-speech' && (
                <TextToSpeechView onProcessComplete={handleAddToHistory} />
              )}
              {activeTool === 'speech-to-text' && (
                <SpeechToTextView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'qr-studio' && (
                <QrStudioView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-booklet' && (
                <PdfBookletView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'business-card-sheet' && (
                <BusinessCardSheetView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-grayscale' && (
                <PdfGrayscaleView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-flatten' && (
                <PdfFlattenView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'batch-watermark' && (
                <BatchWatermarkView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-to-word' && (
                <PdfToWordView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'word-to-pdf' && (
                <WordToPdfView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-to-excel' && (
                <PdfToExcelView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'excel-to-pdf' && (
                <ExcelToPdfView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-to-ppt' && (
                <PdfToPptView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'ppt-to-pdf' && (
                <PptToPdfView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-repair' && (
                <PdfRepairView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-compare' && (
                <PdfCompareView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-to-pdfa' && (
                <PdfToPdfaView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-bates' && (
                <PdfBatesView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-extract-images' && (
                <PdfExtractImagesView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-bg-color' && (
                <PdfBgColorView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'image-stitcher' && (
                <ImageStitcherView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'poster-tile' && (
                <PosterTileView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'pdf-metadata' && (
                <PdfMetadataView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'bulk-cropper' && (
                <BulkCropperView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'id-card-maker' && (
                <IdCardMakerView onAddToHistory={handleAddToHistory} />
              )}
              {activeTool === 'history' && (
                <HistoryView history={history} onClearHistory={handleClearHistory} />
              )}
              {activeTool === 'settings' && (
                <SettingsView
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onResetSettings={handleResetSettings}
                  onOpenAuth={openLoginModal}
                />
              )}
              {activeTool === 'our-apps' && <OurAppsView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Auto-Update Prompt Modal */}
      <UpdateModal
        isOpen={showAutoUpdateModal}
        updateInfo={autoUpdateInfo}
        onClose={() => setShowAutoUpdateModal(false)}
      />

      {/* Repeated Microsoft Store Rate Us Modal */}
      <RateUsModal
        isOpen={showRateUsModal}
        onClose={() => setShowRateUsModal(false)}
      />

      {/* Interactive Pro Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        defaultPlan={upgradePlan}
        onClose={() => setShowUpgradeModal(false)}
      />

      {/* Floating In-App Notification Toast */}
      <NotificationToast
        notification={toastNotification}
        onDismiss={() => setToastNotification(null)}
      />
    </div>
  );
}
