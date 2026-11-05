import React from 'react';
import { ArrowUpCircle, X, ExternalLink, Sparkles } from 'lucide-react';
import { UpdateInfo, openExternalUrl } from '../utils/updater';

interface UpdateModalProps {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  updateInfo,
  onClose,
}) => {
  if (!isOpen || !updateInfo) return null;

  const handleDownload = async () => {
    if (updateInfo.downloadUrl) {
      await openExternalUrl(updateInfo.downloadUrl);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl space-y-5 text-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Update Icon */}
        <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
          <ArrowUpCircle className="w-6 h-6" />
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mb-1">
            <Sparkles className="w-3 h-3" />
            <span>Update Available</span>
          </div>
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            New Version Available!
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-medium">
            New version <span className="font-bold text-emerald-600 dark:text-emerald-400">v{updateInfo.latestVersion}</span> available! Your version <span className="font-semibold text-stone-500">v{updateInfo.currentVersion}</span>. Download?
          </p>
        </div>

        {/* Release Notes (if present) */}
        {updateInfo.releaseNotes && (
          <div className="text-left p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 max-h-32 overflow-y-auto text-[11px] text-stone-600 dark:text-stone-300 font-mono whitespace-pre-line">
            {updateInfo.releaseNotes}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            <span>Download from GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};
