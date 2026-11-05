import React, { useState } from 'react';
import {
  Download,
  Share2,
  Star,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { downloadBlob, formatBytes } from '../utils/fileHelpers';
import { shareViaWhatsApp, shareFileOrText, triggerRateUsModal, trackActionAndCheckRatePrompt } from '../utils/share';
import { OUR_APPS_DATA, openMicrosoftStoreApp, StoreApp } from '../data/ourApps';

interface TaskSuccessCardProps {
  title?: string;
  blob: Blob;
  fileName: string;
  fileSize?: number;
  originalSize?: number;
  infoBadge?: string;
  toolName?: string;
  onDownloadDone?: () => void;
}

export const TaskSuccessCard: React.FC<TaskSuccessCardProps> = ({
  title = 'Processing Completed Successfully!',
  blob,
  fileName,
  fileSize = blob.size,
  originalSize,
  infoBadge,
  toolName,
  onDownloadDone,
}) => {
  const [downloaded, setDownloaded] = useState(false);

  // Pick a companion app to spotlight (excluding alldockit itself)
  const companionApps = OUR_APPS_DATA.filter((a) => !a.isCurrentApp);
  const [featuredApp] = useState<StoreApp>(() => {
    const randomIndex = Math.floor(Math.random() * companionApps.length);
    return companionApps[randomIndex] || companionApps[0];
  });

  const handleDownload = () => {
    downloadBlob(blob, fileName);
    setDownloaded(true);
    trackActionAndCheckRatePrompt();
    if (onDownloadDone) onDownloadDone();
  };

  const handleWhatsAppShare = () => {
    trackActionAndCheckRatePrompt();
    shareViaWhatsApp({
      title: `Processed File: ${fileName}`,
      message: `I just processed "${fileName}" (${formatBytes(fileSize)}) securely and offline with AllDocKit.`,
      toolName: toolName,
    });
  };

  const handleSystemShare = async () => {
    trackActionAndCheckRatePrompt();
    await shareFileOrText({
      title: fileName,
      text: `Processed "${fileName}" using AllDocKit Toolkit by RasheedGraphix`,
      file: blob,
      fileName: fileName,
    });
  };

  const savedBytes = originalSize && originalSize > fileSize ? originalSize - fileSize : 0;
  const savedPercent = originalSize && savedBytes > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4 shadow-sm animate-in fade-in duration-200">
      {/* Top Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <h3 className="text-sm sm:text-base font-bold">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {infoBadge && (
            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {infoBadge}
            </span>
          )}
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
            {formatBytes(fileSize)}
          </span>
        </div>
      </div>

      {/* Compression stats if available */}
      {savedBytes > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-700 dark:text-emerald-300">
          <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>
            Saved <strong>{formatBytes(savedBytes)}</strong> ({savedPercent}% reduction)
          </span>
        </div>
      )}

      {/* Main Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>{downloaded ? 'Download Again' : `Download ${fileName}`}</span>
        </button>

        {/* WhatsApp Share Button */}
        <button
          onClick={handleWhatsAppShare}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white hover:bg-[#20ba59] text-xs sm:text-sm font-bold shadow-md shadow-[#25D366]/20 transition-all cursor-pointer active:scale-95"
          title="Share on WhatsApp"
        >
          <span className="text-sm leading-none font-sans font-bold">WhatsApp</span>
        </button>

        {/* System Share (if mobile/desktop supports it) */}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={handleSystemShare}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold transition-all cursor-pointer"
            title="System Share"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        )}

        {/* Rate Us Button */}
        <button
          onClick={() => triggerRateUsModal()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-bold transition-all cursor-pointer ml-auto"
        >
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span>Rate 5★</span>
        </button>
      </div>

      {/* Cross-Promotion Companion App Spotlight */}
      {featuredApp && (
        <div className="mt-4 pt-3.5 border-t border-stone-200/80 dark:border-stone-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <span>💡 Free Companion App by RasheedGraphix</span>
            </span>
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('navigate-tool', { detail: { toolId: 'our-apps' } })
                );
              }}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Explore All Apps</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-stone-50 to-stone-100 dark:from-stone-800/50 dark:to-stone-800/80 border border-stone-200/80 dark:border-stone-700/60">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${featuredApp.iconGradient} flex items-center justify-center text-xl shadow-sm shrink-0`}
              >
                {featuredApp.iconEmoji}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                    {featuredApp.title}
                  </h4>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    FREE
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                  {featuredApp.tagline}
                </p>
              </div>
            </div>

            <button
              onClick={() => openMicrosoftStoreApp(featuredApp)}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 text-[11px] font-bold inline-flex items-center gap-1.5 transition-all shadow-sm"
            >
              <span>Get on Store</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
