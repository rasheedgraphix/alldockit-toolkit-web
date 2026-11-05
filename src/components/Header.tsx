import React from 'react';
import { Sun, Moon, ShieldCheck, User as UserIcon, Sparkles, Crown, AlertCircle, LogIn, Menu } from 'lucide-react';
import { ToolId } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  activeTool: ToolId;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  toolNames: Record<ToolId, string>;
  onOpenAuth?: () => void;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTool,
  theme,
  onToggleTheme,
  toolNames,
  onOpenAuth,
  onOpenMobileMenu,
}) => {
  const {
    user,
    isPro,
    isTrialActive,
    trialDaysLeft,
    hasUsedTrial,
    dailyUsage,
    dailyLimit,
    remainingDaily,
    openUpgradeModal,
    openLoginModal,
  } = useAuth();
  const handleAuthClick = onOpenAuth || openLoginModal;

  return (
    <header
      id="app-header"
      className="h-16 border-b px-3 sm:px-6 flex items-center justify-between transition-colors bg-white/80 dark:bg-stone-900/80 backdrop-blur border-stone-200 dark:border-stone-800"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 focus:outline-none cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-sm sm:text-lg font-semibold text-stone-900 dark:text-stone-100 truncate">
          {toolNames[activeTool] || 'AllDocKit - Document & PDF Toolkit'}
        </h1>
        <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5" />
          Offline &amp; Private
        </span>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Pro / Trial / Daily Free Status Badge */}
        {isPro ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Crown className="w-3.5 h-3.5" />
            Pro
          </span>
        ) : isTrialActive ? (
          <span
            id="trial-badge"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Trial: {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left
          </span>
        ) : remainingDaily > 0 ? (
          <button
            id="daily-free-badge"
            onClick={() => openUpgradeModal(user ? (hasUsedTrial ? 'trial_ended' : 'eligible_for_trial') : 'guest_daily_limit')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
            title="5 Free operations per day. Resets daily!"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">{remainingDaily}/{dailyLimit} Free Today</span>
          </button>
        ) : !user ? (
          <button
            id="guest-limit-badge"
            onClick={() => openUpgradeModal('guest_daily_limit')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer animate-pulse"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>5 Free Limit Used · Start Trial</span>
          </button>
        ) : !hasUsedTrial ? (
          <button
            id="eligible-trial-badge"
            onClick={() => openUpgradeModal('eligible_for_trial')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer animate-pulse"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>5 Limit Used · Start 7-Day Trial</span>
          </button>
        ) : (
          <button
            id="trial-ended-badge"
            onClick={() => openUpgradeModal('trial_ended')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 transition-colors cursor-pointer"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>5 Limit Used · Upgrade Pro</span>
          </button>
        )}

        {handleAuthClick && (
          <button
            id="account-btn"
            onClick={handleAuthClick}
            title={user ? `Signed in as ${user.displayName || user.email}` : 'Sign In'}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer text-xs"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Account'}
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span className="hidden sm:inline font-medium">
              {user ? user.displayName || user.email?.split('@')[0] : 'Sign In'}
            </span>
          </button>
        )}

        <button
          id="theme-toggle-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-stone-700" />
          )}
        </button>
      </div>
    </header>
  );
};
