import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  statusText?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, statusText }) => {
  return (
    <div
      id="conversion-progress-bar"
      className="p-4 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2.5 transition-all"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium text-stone-800 dark:text-stone-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600 dark:text-stone-400" />
          <span>{statusText || 'Processing files...'}</span>
        </div>
        <span className="font-semibold text-stone-900 dark:text-stone-100 font-mono">
          {Math.round(progress)}%
        </span>
      </div>

      <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
        <div
          className="h-full bg-stone-900 dark:bg-stone-100 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
};
