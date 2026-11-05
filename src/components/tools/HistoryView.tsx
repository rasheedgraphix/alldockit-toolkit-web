import React from 'react';
import {
  History,
  Trash2,
  Download,
  TrendingDown,
  Layers,
  Calendar,
  FileCheck,
} from 'lucide-react';
import { HistoryItem } from '../../types';
import { formatBytes, downloadBlob } from '../../utils/fileHelpers';
import { shareViaWhatsApp } from '../../utils/share';

interface HistoryViewProps {
  history: HistoryItem[];
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onClearHistory }) => {
  const totalSaved = history.reduce((acc, item) => acc + item.savedBytes, 0);
  const totalProcessed = history.length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
            Conversion History
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Review past processing sessions and re-download completed files from this session.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear History
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center shrink-0">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Files Processed
            </p>
            <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {totalProcessed}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Disk Space Saved
            </p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatBytes(totalSaved)}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Session Privacy
            </p>
            <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              100% In-Memory RAM
            </p>
          </div>
        </div>
      </div>

      {/* History Items List */}
      {history.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-stone-50 dark:bg-stone-900/40 border border-dashed border-stone-300 dark:border-stone-800">
          <History className="w-10 h-10 text-stone-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
            No conversion history yet
          </p>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
            Operations performed in the PDF and Image tools will appear here for review and quick re-download.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const dateStr = new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                      {item.toolName}
                    </span>
                    <span className="text-[11px] text-stone-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {dateStr}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                    {item.resultName}
                  </p>
                  <p className="text-[11px] text-stone-500 font-mono">
                    {formatBytes(item.originalSize)} → {formatBytes(item.resultSize)}{' '}
                    {item.savedBytes > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        (Saved {formatBytes(item.savedBytes)})
                      </span>
                    )}
                  </p>
                </div>

                {item.resultBlob && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        shareViaWhatsApp({
                          title: `File: ${item.resultName}`,
                          message: `I processed this document using AllDocKit (${item.toolName}).`,
                          toolName: item.toolName,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:bg-[#20ba59] transition-colors shadow-xs"
                      title="Share on WhatsApp"
                    >
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={() => downloadBlob(item.resultBlob!, item.resultName)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Re-download
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
