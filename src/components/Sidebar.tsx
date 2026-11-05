import React, { useState, useEffect } from 'react';
import {
  Files,
  Scissors,
  Minimize2,
  FileImage,
  RefreshCw,
  Maximize2,
  History,
  Settings,
  Shield,
  Layers,
  Stamp,
  Lock,
  QrCode,
  Sparkles,
  Volume2,
  FileCode,
  FileText,
  X,
  Crown,
  Eraser,
  Store,
  PenTool,
  ScanText,
  Star,
  CreditCard,
  Camera,
  Barcode,
  ShieldCheck,
  Scan,
  Unlock,
  Crop,
  FolderPen,
  Grid,
  EyeOff,
  Scaling,
  Columns2,
  Mic,
  BookOpen,
  Printer,
  FileOutput,
  FileSpreadsheet,
  Presentation,
  Wrench,
  GitCompare,
  Archive,
  Hash,
  Images,
  Palette,
  GalleryVerticalEnd,
  LayoutGrid,
  FileCog,
  BadgeCheck,
} from 'lucide-react';
import { ToolId } from '../types';
import { PixDocLogo } from './PixDocLogo';
import { checkLicense } from '../utils/license';

interface SidebarProps {
  activeTool: ToolId;
  onSelectTool: (id: ToolId) => void;
  historyCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: ToolId;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTool,
  onSelectTool,
  historyCount,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [license, setLicense] = useState(checkLicense());

  useEffect(() => {
    const handleUpdate = () => setLicense(checkLicense());
    window.addEventListener('license-updated', handleUpdate);
    return () => window.removeEventListener('license-updated', handleUpdate);
  }, []);

  const isPro = license.isPro;

  const handleToolClick = (id: ToolId) => {
    onSelectTool(id);
    if (onCloseMobile) onCloseMobile();
  };

  const pdfTools: NavItem[] = [
    { id: 'pdf-merger', label: 'PDF Merger', icon: Files },
    { id: 'pdf-splitter', label: 'PDF Splitter', icon: Scissors },
    {
      id: 'html-to-pdf',
      label: 'HTML to PDF',
      icon: FileCode,
      badge: 'NEW',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      id: 'pdf-to-html',
      label: 'PDF to HTML',
      icon: FileText,
      badge: 'NEW',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'pdf-organizer',
      label: 'Organize & Rotate',
      icon: Layers,
      badge: 'NEW',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'pdf-to-images',
      label: 'PDF to Images',
      icon: FileImage,
      badge: 'HD',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'pdf-watermark',
      label: 'Watermark & Numbers',
      icon: Stamp,
      badge: 'NEW',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      id: 'pdf-signature',
      label: 'Sign & Stamp PDF',
      icon: PenTool,
      badge: 'NEW',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'id-card-merge',
      label: 'CNIC 2-in-1 Side Merge',
      icon: CreditCard,
      badge: 'A4',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      id: 'invoice-maker',
      label: 'Invoice & Bill Maker',
      icon: FileText,
      badge: 'NEW',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    { id: 'pdf-compressor', label: 'PDF Compressor', icon: Minimize2 },
    {
      id: 'pdf-protect',
      label: 'Security & Lock',
      icon: Lock,
    },
    {
      id: 'pdf-unlock',
      label: 'Unlock PDF Password',
      icon: Unlock,
      badge: 'DECRYPT',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'pdf-crop',
      label: 'Crop PDF Margins',
      icon: Crop,
      badge: 'TRIM',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'pdf-nup',
      label: 'N-Up Handout Grid',
      icon: Grid,
      badge: '2-in-1',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'pdf-redact',
      label: 'Redaction & Blackout',
      icon: EyeOff,
      badge: 'CENSOR',
      badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    },
    {
      id: 'pdf-resizer',
      label: 'PDF Page Resizer',
      icon: Scaling,
      badge: 'A4/LEGAL',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      id: 'pdf-booklet',
      label: 'Booklet Maker (Saddle Stitch)',
      icon: BookOpen,
      badge: 'A4 BOOK',
      badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    },
    {
      id: 'pdf-grayscale',
      label: 'Color to B&W / Grayscale',
      icon: Printer,
      badge: 'INK SAVER',
      badgeColor: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    },
    {
      id: 'pdf-flatten',
      label: 'PDF Form Flattener Lock',
      icon: Lock,
      badge: 'ANTI-TAMPER',
      badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
    },
    {
      id: 'pdf-to-word',
      label: 'PDF to Word (.docx)',
      icon: FileOutput,
      badge: 'DOCX',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      id: 'word-to-pdf',
      label: 'Word (.docx) to PDF',
      icon: FileText,
      badge: 'WORD',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'pdf-to-excel',
      label: 'PDF to Excel (.xlsx)',
      icon: FileSpreadsheet,
      badge: 'XLSX',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'excel-to-pdf',
      label: 'Excel (.xlsx) to PDF',
      icon: FileSpreadsheet,
      badge: 'SHEET',
      badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
    },
    {
      id: 'pdf-to-ppt',
      label: 'PDF to PowerPoint (.pptx)',
      icon: Presentation,
      badge: 'PPTX',
      badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    },
    {
      id: 'ppt-to-pdf',
      label: 'PowerPoint (.pptx) to PDF',
      icon: Presentation,
      badge: 'SLIDES',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      id: 'pdf-repair',
      label: 'Repair Corrupt PDF',
      icon: Wrench,
      badge: 'RECOVER',
      badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    },
    {
      id: 'pdf-compare',
      label: 'Compare PDF (Diff)',
      icon: GitCompare,
      badge: 'DIFF',
      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    },
    {
      id: 'pdf-to-pdfa',
      label: 'PDF to PDF/A (Archival)',
      icon: Archive,
      badge: 'ISO',
      badgeColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
    },
    {
      id: 'pdf-bates',
      label: 'Header, Footer & Bates',
      icon: Hash,
      badge: 'LEGAL',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      id: 'pdf-extract-images',
      label: 'Extract All PDF Images',
      icon: Images,
      badge: 'ZIP',
      badgeColor: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300',
    },
    {
      id: 'pdf-bg-color',
      label: 'PDF Background & Dark Mode',
      icon: Palette,
      badge: 'EYE CARE',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      id: 'pdf-metadata',
      label: 'PDF Metadata Editor',
      icon: FileCog,
      badge: 'CLEAN',
      badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    },
  ];

  const imageTools: NavItem[] = [
    {
      id: 'cam-scanner',
      label: 'CamScanner Filter',
      icon: Sparkles,
      badge: 'A4 SCAN',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      id: 'bg-remover',
      label: 'Background Remover',
      icon: Eraser,
      badge: 'PNG',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'photo-collage',
      label: 'Photo Collage Studio',
      icon: Columns2,
      badge: 'SPLIT',
      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    },
    {
      id: 'batch-renamer',
      label: 'Batch File Renamer',
      icon: FolderPen,
      badge: 'ZIP',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      id: 'passport-photo',
      label: 'Passport Photo Maker',
      icon: Camera,
      badge: '4x6',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'barcode-studio',
      label: '1D Barcode Studio',
      icon: Barcode,
      badge: 'Code 128',
      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    },
    {
      id: 'code-scanner',
      label: 'QR & Barcode Scanner',
      icon: Scan,
      badge: 'LIVE',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'exif-cleaner',
      label: 'Photo Info & GPS Finder',
      icon: ShieldCheck,
      badge: 'GPS/DEVICE',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'ocr-extractor',
      label: 'Extract Text (OCR)',
      icon: ScanText,
      badge: 'OFFLINE',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'certificate-editor',
      label: 'Certificate & Text Eraser',
      icon: Eraser,
    },
    {
      id: 'text-to-speech',
      label: 'Text to Speech (Voice)',
      icon: Volume2,
      badge: 'OFFLINE',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'speech-to-text',
      label: 'Voice to Text (Urdu/Eng)',
      icon: Mic,
      badge: 'LIVE',
      badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    },
    { id: 'images-to-pdf', label: 'Images to PDF', icon: FileImage },
    {
      id: 'image-converter',
      label: 'Image Converter',
      icon: RefreshCw,
      badge: 'All Formats',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'image-compressor',
      label: 'Compress & Resize',
      icon: Maximize2,
      badge: '-90%',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'qr-studio',
      label: 'QR Code Studio',
      icon: QrCode,
      badge: 'PRO',
      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    },
    {
      id: 'business-card-sheet',
      label: 'Card 10-on-A4 Studio',
      icon: CreditCard,
      badge: '10-UP A4',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      id: 'batch-watermark',
      label: 'Batch Watermark & Logo',
      icon: Stamp,
      badge: 'BULK ZIP',
      badgeColor: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
    },
    {
      id: 'image-stitcher',
      label: 'Long Screenshot Stitcher',
      icon: GalleryVerticalEnd,
      badge: 'LONG',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    },
    {
      id: 'poster-tile',
      label: 'Poster Multi-Page Printer',
      icon: LayoutGrid,
      badge: '4-16 A4',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'bulk-cropper',
      label: 'Bulk Aspect Ratio Crop',
      icon: Crop,
      badge: '1:1/16:9',
      badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    },
    {
      id: 'id-card-maker',
      label: 'Staff & Student ID Maker',
      icon: BadgeCheck,
      badge: 'CR80 QR',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
  ];

  const systemTools: NavItem[] = [
    {
      id: 'our-apps',
      label: 'Our Apps & Games',
      icon: Store,
      badge: 'FREE',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      badge: historyCount > 0 ? `${historyCount}` : undefined,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      badge: license.isTrial ? 'TRIAL' : isPro ? 'PRO' : 'FREE',
      badgeColor: isPro
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close sidebar overlay"
          onClick={onCloseMobile}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onCloseMobile?.();
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden cursor-pointer animate-fade-in"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-auto w-68 border-r flex flex-col justify-between transition-transform duration-200 ease-in-out bg-stone-50 dark:bg-stone-950 border-stone-200 dark:border-stone-800 select-none shrink-0 shadow-2xl lg:shadow-none ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 space-y-5 overflow-y-auto flex-1">
          {/* Brand + Mobile Close Button */}
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2.5">
              <PixDocLogo size={36} />
              <div>
                <h2 className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <span>AllDocKit</span>
                  <span className="text-[9px] px-1 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    100% FREE
                  </span>
                </h2>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  All-in-One Document Kit
                </p>
              </div>
            </div>

            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800 cursor-pointer"
                aria-label="Close navigation sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* PDF Tools Section */}
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-semibold tracking-wider text-stone-400 dark:text-stone-500 uppercase">
              PDF Suite
            </p>
            {pdfTools.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  id={`sidebar-nav-${tool.id}`}
                  onClick={() => handleToolClick(tool.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-1">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap truncate">{tool.label}</span>
                  </div>
                  {tool.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ml-1 ${
                        isActive
                          ? 'bg-white/20 text-white dark:bg-stone-900/20 dark:text-stone-900'
                          : tool.badgeColor || 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                      }`}
                    >
                      {tool.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Image Tools Section */}
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-semibold tracking-wider text-stone-400 dark:text-stone-500 uppercase">
              Image & Utilities
            </p>
            {imageTools.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  id={`sidebar-nav-${tool.id}`}
                  onClick={() => handleToolClick(tool.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-1">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap truncate">{tool.label}</span>
                  </div>
                  {tool.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ml-1 ${
                        isActive
                          ? 'bg-white/20 text-white dark:bg-stone-900/20 dark:text-stone-900'
                          : tool.badgeColor || 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                      }`}
                    >
                      {tool.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* System & History */}
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-semibold tracking-wider text-stone-400 dark:text-stone-500 uppercase">
              Workspace
            </p>
            {systemTools.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  id={`sidebar-nav-${tool.id}`}
                  onClick={() => handleToolClick(tool.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-1">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap truncate">{tool.label}</span>
                  </div>
                  {tool.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ml-1 ${
                        isActive
                          ? 'bg-white/20 text-white dark:bg-stone-900/20 dark:text-stone-900'
                          : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                      }`}
                    >
                      {tool.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Pro Upgrade Callout in Sidebar */}
          {!isPro && (
            <div className="pt-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/15 via-emerald-500/10 to-teal-500/15 border border-amber-500/30 text-stone-900 dark:text-stone-100 shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-400">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>AllDocKit Pro</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500 text-white font-black tracking-wide">
                    PRO
                  </span>
                </div>
                <p className="text-[10px] text-stone-600 dark:text-stone-400 mb-2 leading-tight">
                  Unlimited operations, zero ads, batch tools. Card / Bank IBAN.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-upgrade-modal', { detail: { plan: 'annual' } }));
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Upgrade to Pro</span>
                </button>
              </div>
            </div>
          )}

          {isPro && (
            <div className="pt-2">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-2 text-xs font-bold">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">AllDocKit Pro Activated</span>
              </div>
            </div>
          )}
        </div>

        {/* Security & Offline Badge Footer */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 space-y-2.5">
          {/* Direct Rate 5 Stars on Microsoft Store Trigger */}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('trigger-rate-us'));
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 hover:from-amber-500/25 hover:to-orange-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer group"
          >
            <Star className="w-4 h-4 fill-amber-400 text-amber-500 group-hover:scale-125 transition-transform" />
            <span>Rate 5 Stars on Store</span>
          </button>

          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-100 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight text-stone-600 dark:text-stone-400">
              <span className="font-semibold text-stone-900 dark:text-stone-200 block mb-0.5">
                AllDocKit - 100% Private & Local
              </span>
              100% client-side. All document processing runs securely on your device.
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
