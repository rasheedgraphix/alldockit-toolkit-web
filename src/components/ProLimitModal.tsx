import React from 'react';
import { Crown, Sparkles, X, Check } from 'lucide-react';
import { startFreeTrial, isTrialUsed } from '../utils/license';

interface ProLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

export const ProLimitModal: React.FC<ProLimitModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
}) => {
  if (!isOpen) return null;

  const handleStartTrial = () => {
    if (!isTrialUsed()) {
      const success = startFreeTrial();
      if (success) {
        window.dispatchEvent(new CustomEvent('license-updated'));
        onClose();
      }
    } else {
      alert('You already used your free trial!');
      onClose();
      if (onUpgrade) {
        onUpgrade();
      } else {
        window.dispatchEvent(new CustomEvent('open-upgrade-settings'));
      }
    }
  };

  const handleChooseMonthly = () => {
    onClose();
    if (onUpgrade) {
      onUpgrade();
    } else {
      window.dispatchEvent(new CustomEvent('open-upgrade-settings'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl text-center space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
          <Crown className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            Free Limit Reached
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed max-w-xs mx-auto font-medium">
            Start your 7-Day FREE Trial of Annual Plan - Unlimited conversions!
          </p>
        </div>

        {/* Benefits List */}
        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 text-left space-y-2 text-xs">
          <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Unlimited batch conversions (100+ files)</span>
          </div>
          <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>High-speed local processing & maximum compression</span>
          </div>
          <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>No limits, no watermarks, 100% offline</span>
          </div>
        </div>

        {/* Action Buttons: Primary Green Free Trial & Secondary Monthly */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleStartTrial}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Start Free Trial (Annual)</span>
          </button>
          <button
            type="button"
            onClick={handleChooseMonthly}
            className="w-full py-2.5 px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Choose Monthly $2.99
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
