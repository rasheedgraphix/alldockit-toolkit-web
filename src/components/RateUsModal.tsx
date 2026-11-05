import React, { useState, useEffect } from 'react';
import { Star, Heart, X, ExternalLink, Sparkles, CheckCircle2 } from 'lucide-react';
import { openMicrosoftStoreReview } from '../utils/share';
import { OUR_APPS_DATA, openMicrosoftStoreApp } from '../data/ourApps';

interface RateUsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RateUsModal: React.FC<RateUsModalProps> = ({ isOpen, onClose }) => {
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedRating(5);
      setHasSubmitted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRateStore = () => {
    setHasSubmitted(true);
    openMicrosoftStoreReview();
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const companionApp = OUR_APPS_DATA.find((a) => a.id === 'qalamcraft-doc') || OUR_APPS_DATA[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-6 sm:p-7 overflow-hidden text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow decoration */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="Remind me later"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4 animate-bounce">
          <Star className="w-8 h-8 text-white fill-white" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-2 border border-amber-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Support Free Software</span>
        </div>

        <h3 className="text-xl font-extrabold text-stone-900 dark:text-stone-100">
          Loving AllDocKit?
        </h3>

        <p className="text-xs text-stone-600 dark:text-stone-400 mt-2 max-w-sm mx-auto leading-relaxed">
          Your 5-star rating on the Microsoft Store helps <strong className="text-stone-900 dark:text-stone-100">RasheedGraphix</strong> keep this toolkit 100% free, offline, and private for everyone!
        </p>

        {/* Interactive Star Selection */}
        <div className="flex items-center justify-center gap-2 my-5">
          {[1, 2, 3, 4, 5].map((star) => {
            const active = (hoverRating !== null ? hoverRating : selectedRating) >= star;
            return (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                onClick={() => setSelectedRating(star)}
                className="p-1 rounded-lg transition-transform hover:scale-125 focus:outline-none"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    active
                      ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                      : 'text-stone-300 dark:text-stone-700'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="space-y-3">
          <button
            onClick={handleRateStore}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            {hasSubmitted ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Opening Microsoft Store...</span>
              </>
            ) : (
              <>
                <Star className="w-5 h-5 fill-white" />
                <span>Rate 5 Stars on Microsoft Store</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Remind Me Later
          </button>
        </div>

        {/* Companion App Cross-Promotion Box */}
        {companionApp && (
          <div className="mt-5 pt-4 border-t border-stone-200 dark:border-stone-800 text-left">
            <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 mb-2 font-medium">
              <span>Also from RasheedGraphix:</span>
              <span className="text-emerald-500 font-bold">100% Free</span>
            </div>

            <div
              onClick={() => {
                openMicrosoftStoreApp(companionApp);
                onClose();
              }}
              className="group flex items-center gap-3 p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 hover:border-emerald-500/50 transition-all cursor-pointer"
            >
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${companionApp.iconGradient} flex items-center justify-center text-lg shadow-sm shrink-0`}
              >
                {companionApp.iconEmoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <span className="truncate">{companionApp.title}</span>
                  <ExternalLink className="w-3 h-3 text-stone-400 group-hover:text-emerald-500" />
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                  {companionApp.tagline}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
