import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  Star,
  CheckCircle2,
  Sparkles,
  Share2,
  Check,
  Gamepad2,
  BookOpen,
  Briefcase,
  Layers,
  Store,
  ShieldCheck,
} from 'lucide-react';
import {
  OUR_APPS_DATA,
  StoreApp,
  openMicrosoftStoreApp,
  openRasheedGraphixStore,
  RASHEED_GRAPHIX_STORE,
} from '../../data/ourApps';

export const OurAppsView: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'productivity' | 'education' | 'games'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPublisher, setCopiedPublisher] = useState(false);

  const filteredApps = activeCategory === 'all'
    ? OUR_APPS_DATA
    : OUR_APPS_DATA.filter((app) => app.categoryType === activeCategory);

  const handleShareApp = async (app: StoreApp, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(app.storeWebUrl);
        setCopiedId(app.id);
        setTimeout(() => setCopiedId(null), 2500);
      }
    } catch {
      // fallback
    }
  };

  const handleSharePublisher = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(RASHEED_GRAPHIX_STORE.storeWebUrl);
        setCopiedPublisher(true);
        setTimeout(() => setCopiedPublisher(null as unknown as boolean), 2500);
      }
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Publisher Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 dark:from-stone-900 dark:via-stone-950 dark:to-stone-900 border border-stone-800 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Official Microsoft Store Publisher • RasheedGraphix</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Explore Apps &amp; Games by RasheedGraphix
            </h1>

            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              Discover lightweight, 100% free desktop tools and games engineered for Windows 10 &amp; 11.
              Fast installs directly via Microsoft Store with zero malware, zero popups, and full privacy.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-stone-400">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                100% Free Downloads
              </span>
              <span className="text-stone-600">•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Verified by Microsoft
              </span>
              <span className="text-stone-600">•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                No Adware / Safe
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={openRasheedGraphixStore}
              className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-emerald-500/20 cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>Open in Microsoft Store</span>
              <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
            </button>

            <button
              type="button"
              onClick={handleSharePublisher}
              className="py-2 px-3 rounded-xl bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700 text-stone-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {copiedPublisher ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Store Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share All Apps Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Category Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === 'all'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'bg-stone-100 text-stone-600 dark:bg-stone-800/80 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Apps &amp; Games</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-400/20">
            {OUR_APPS_DATA.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('productivity')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === 'productivity'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'bg-stone-100 text-stone-600 dark:bg-stone-800/80 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Productivity &amp; Office</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-400/20">2</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('education')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === 'education'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'bg-stone-100 text-stone-600 dark:bg-stone-800/80 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Education &amp; Typing</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-400/20">1</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('games')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === 'games'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'bg-stone-100 text-stone-600 dark:bg-stone-800/80 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>Games (3D &amp; Brain)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-400/20">2</span>
        </button>
      </div>

      {/* Apps Showcase Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredApps.map((app) => {
          const isCopied = copiedId === app.id;

          return (
            <div
              key={app.id}
              className={`relative flex flex-col justify-between rounded-2xl p-5 sm:p-6 transition-all duration-200 border bg-white dark:bg-stone-900/90 shadow-sm hover:shadow-md ${
                app.isCurrentApp
                  ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                  : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
              }`}
            >
              {/* Card Header */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.iconGradient} text-white flex items-center justify-center text-2xl shadow-md shrink-0`}
                    >
                      <span>{app.iconEmoji}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                          {app.title}
                        </h3>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                        {app.category}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-600 dark:text-stone-300 font-medium">
                        <div className="flex items-center text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          <span className="font-bold ml-1">{app.rating.toFixed(1)}</span>
                        </div>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {app.price}
                        </span>
                        <span>•</span>
                        <span className="text-stone-400">Microsoft Store</span>
                      </div>
                    </div>
                  </div>

                  {app.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider shrink-0 ${
                        app.badgeColor || 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      {app.badge}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                  {app.tagline}
                </p>

                {/* Feature Bullet Points */}
                <div className="space-y-1.5 pt-1">
                  {app.features.map((feat, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-[11px] text-stone-600 dark:text-stone-400"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Download pitch callout */}
                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/70 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="font-medium italic">{app.downloadPitch}</span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-5 mt-4 border-t border-stone-100 dark:border-stone-800/80 flex items-center gap-2.5">
                {app.isCurrentApp ? (
                  <button
                    type="button"
                    onClick={() => openMicrosoftStoreApp(app)}
                    className="flex-1 py-2.5 px-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                    <span>Rate 5 Stars on Store</span>
                    <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openMicrosoftStoreApp(app)}
                    className="flex-1 py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-emerald-500/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Get Free on Microsoft Store</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80 ml-0.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => handleShareApp(app, e)}
                  title="Copy link to share"
                  className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
                  aria-label={`Share ${app.title}`}
                >
                  {isCopied ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Promotion Footer Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
              Want more tools or custom software?
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              All applications are built with extreme care for desktop performance, privacy, and zero subscriptions.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openRasheedGraphixStore}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs shrink-0"
        >
          <span>View All on Windows Store</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
