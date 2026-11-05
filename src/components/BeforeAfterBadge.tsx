import React from 'react';
import { ArrowRight, Sparkles, TrendingDown } from 'lucide-react';
import { formatBytes, calculateSavedPercentage } from '../utils/fileHelpers';

interface BeforeAfterBadgeProps {
  originalSize: number;
  newSize: number;
  compact?: boolean;
}

export const BeforeAfterBadge: React.FC<BeforeAfterBadgeProps> = ({
  originalSize,
  newSize,
  compact = false,
}) => {
  const savedBytes = Math.max(0, originalSize - newSize);
  const savedPercent = calculateSavedPercentage(originalSize, newSize);
  const isReduced = originalSize > newSize;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="line-through text-stone-400 dark:text-stone-500 font-mono">
          {formatBytes(originalSize)}
        </span>
        <ArrowRight className="w-3 h-3 text-stone-400" />
        <span className="font-semibold text-stone-800 dark:text-stone-200 font-mono">
          {formatBytes(newSize)}
        </span>
        {isReduced && savedPercent > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            -{savedPercent}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      id="before-after-card"
      className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
            Original Size
          </p>
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 font-mono">
            {formatBytes(originalSize)}
          </p>
        </div>

        <ArrowRight className="w-4 h-4 text-stone-400" />

        <div>
          <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
            Output Size
          </p>
          <p className="text-sm font-bold text-stone-900 dark:text-stone-100 font-mono">
            {formatBytes(newSize)}
          </p>
        </div>
      </div>

      {isReduced && savedBytes > 0 ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
            <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold tracking-tight">
              Saved {formatBytes(savedBytes)} ({savedPercent}%)
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-xs text-stone-500">
          <Sparkles className="w-3.5 h-3.5 text-stone-400" />
          <span>High Fidelity Output</span>
        </div>
      )}
    </div>
  );
};
