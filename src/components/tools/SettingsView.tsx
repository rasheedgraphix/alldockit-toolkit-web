import React, { useState, useEffect } from 'react';
import {
  Laptop,
  CheckCircle2,
  ShieldCheck,
  Info,
  Crown,
  Check,
  RotateCcw,
  Sparkles,
  RefreshCw,
  Bell,
  BellOff,
  Globe,
  Mail,
  FileText,
  X,
  User as UserIcon,
  LogIn,
  LogOut,
  Store,
} from 'lucide-react';
import { openRasheedGraphixStore } from '../../data/ourApps';
import { useAuth } from '../../contexts/AuthContext';
import { AppSettings } from '../../types';
import { isTauri, openExternalUrl } from '../../utils/platform';
import {
  checkLicense,
  setTestLicense,
  clearLicense,
  startFreeTrial,
  isTrialUsed,
  License,
} from '../../utils/license';
import { checkForUpdate, UpdateInfo, CURRENT_APP_VERSION } from '../../utils/updater';
import { UpdateModal } from '../UpdateModal';
import {
  requestNotificationPermission,
  getNotificationStatus,
  setNotificationStatus,
  emitInAppNotification,
} from '../../utils/firebase';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onResetSettings: () => void;
  onOpenAuth?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  onOpenAuth,
}) => {
  const { user, signOut } = useAuth();
  const [license, setLicense] = useState<License>(checkLicense());
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [updateStatusMessage, setUpdateStatusMessage] = useState<string | null>(null);

  const [notificationState, setNotificationState] = useState(() => getNotificationStatus());
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleSyncNotif = () => setNotificationState(getNotificationStatus());
    window.addEventListener('notifications-status-changed', handleSyncNotif);
    return () => window.removeEventListener('notifications-status-changed', handleSyncNotif);
  }, []);

  const handleToggleNotifications = async () => {
    setIsRequestingNotif(true);
    setNotifMessage(null);
    try {
      if (notificationState.enabled) {
        setNotificationStatus(false);
        setNotificationState(getNotificationStatus());
        setNotifMessage('Notifications disabled.');
        setTimeout(() => setNotifMessage(null), 4000);
      } else {
        const token = await requestNotificationPermission();
        const updated = getNotificationStatus();
        setNotificationState(updated);
        if (updated.enabled) {
          setNotifMessage('Notifications enabled! FCM device token registered.');
        } else {
          setNotifMessage('Notification permission not granted by browser.');
        }
        setTimeout(() => setNotifMessage(null), 4000);
      }
    } finally {
      setIsRequestingNotif(false);
    }
  };

  const handleSendTestNotification = () => {
    emitInAppNotification({
      title: 'AllDocKit Notification',
      body: 'New PDF compress feature added! Enjoy up to 90% size reduction offline.',
    });
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatusMessage(null);
    try {
      const info = await checkForUpdate();
      setUpdateInfo(info);
      if (info.hasUpdate) {
        setShowUpdateModal(true);
      } else {
        setUpdateStatusMessage(`AllDocKit is up to date (v${info.currentVersion})`);
        setTimeout(() => setUpdateStatusMessage(null), 5000);
      }
    } catch {
      setUpdateStatusMessage('Could not connect to update server.');
      setTimeout(() => setUpdateStatusMessage(null), 5000);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  useEffect(() => {
    setLicense(checkLicense());
    const handleLicenseUpdate = () => {
      setLicense(checkLicense());
    };
    window.addEventListener('license-updated', handleLicenseUpdate);
    return () => window.removeEventListener('license-updated', handleLicenseUpdate);
  }, []);

  const handleChoosePlan = (plan: 'monthly' | 'annual') => {
    window.dispatchEvent(new CustomEvent('open-upgrade-modal', { detail: { plan } }));
  };

  const handleAnnualClick = () => {
    window.dispatchEvent(new CustomEvent('open-upgrade-modal', { detail: { plan: 'annual' } }));
  };

  const handleRestorePurchase = () => {
    const current = checkLicense();
    if (current.isPro) {
      setPurchaseNotice(`Purchase restored: AllDocKit Pro (${current.plan.toUpperCase()}) is active!`);
    } else {
      setPurchaseNotice('No prior subscription found for this device.');
    }
    setTimeout(() => setPurchaseNotice(null), 4000);
  };

  const handleClearLicense = () => {
    clearLicense();
    setLicense(checkLicense());
    window.location.reload();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          Preferences & Desktop Settings
        </h2>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
          Manage your AllDocKit Pro subscription, customize default compression presets, and system settings.
        </p>
      </div>

      {purchaseNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between animate-in fade-in">
          <span>{purchaseNotice}</span>
          <button
            onClick={() => setPurchaseNotice(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Subscription Active Banner if already Pro */}
      {license.isPro && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                AllDocKit Pro Active ({license.isTrial ? '7-Day Free Trial' : `${license.plan.toUpperCase()} Plan`})
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {license.expiryDate
                  ? `Valid until ${new Date(license.expiryDate).toLocaleDateString()}`
                  : 'Active subscription'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClearLicense}
            className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
          >
            Clear Subscription
          </button>
        </div>
      )}

      {/* Upgrade to Pro Section - Exactly 2 Cards */}
      <div className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Upgrade to Pro
              </h3>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Unlock unlimited batch operations, high-speed stream optimization, and priority local features.
            </p>
          </div>
          <span className="self-start sm:self-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
            {license.isPro
              ? license.isTrial
                ? 'Pro Trial Active'
                : 'Pro Member'
              : 'Free Tier: 5 free operations/day (Resets Daily)'}
          </span>
        </div>

        {/* EXACTLY 2 CARDS SIDE-BY-SIDE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Monthly */}
          <div className="relative p-5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Monthly
                </h4>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-stone-900 dark:text-stone-100">
                    $2.99
                  </span>
                  <span className="text-xs text-stone-500 font-medium">/ month</span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 font-medium">
                  $2.99/month - No trial
                </p>
              </div>

              <div className="pt-2 border-t border-stone-200 dark:border-stone-700 space-y-2">
                <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Unlimited Conversions</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Batch PDF & Image tools</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>100% Offline Processing</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              data-product-id="alldockit.monthly"
              onClick={() => handleChoosePlan('monthly')}
              className="w-full py-2.5 px-4 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors shadow-xs"
            >
              Choose Monthly
            </button>
          </div>

          {/* Card 2: Annual - Most Popular with 7-Day Free Trial */}
          <div className="relative p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-500 dark:border-emerald-500 flex flex-col justify-between space-y-4 shadow-sm">
            {/* MOST POPULAR BADGE */}
            <div className="absolute -top-3 right-4">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-600 text-white shadow-sm">
                MOST POPULAR
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <span>Annual</span>
                </h4>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-stone-900 dark:text-stone-100">
                    $12.99
                  </span>
                  <span className="text-xs text-stone-500 font-medium">/ year</span>
                </div>
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                  7-DAY FREE TRIAL - Then $12.99/year
                </p>
              </div>

              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-900/50 space-y-2">
                <div className="flex items-center gap-2 text-xs text-stone-800 dark:text-stone-200 font-semibold">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Unlimited + All Future Features</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Maximum Speed Compression</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Priority Local Updates</span>
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                data-product-id="alldockit.annual"
                onClick={handleAnnualClick}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm"
              >
                {isTrialUsed() ? 'Choose Annual ($12.99/year)' : 'Start 7-Day Free Trial'}
              </button>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 text-center mt-2 leading-tight">
                No charge today, cancel anytime. Trial used once per device.
              </p>
            </div>
          </div>
        </div>

        {/* Restore Prior Purchase */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={handleRestorePurchase}
            className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1.5 hover:underline transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Already purchased? Restore Subscription</span>
          </button>
        </div>
      </div>

      {/* Appearance & General */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
          General Preferences
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Theme */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Theme Mode
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'light' })}
                className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all ${
                  settings.theme === 'light'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 border-transparent shadow-sm'
                    : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                Light Mode
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all ${
                  settings.theme === 'dark'
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 border-transparent shadow-sm'
                    : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                Dark Mode
              </button>
            </div>
          </div>

          {/* Default PDF Compression */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Default PDF Compression Preset
            </label>
            <select
              value={settings.defaultPdfCompression}
              onChange={(e) =>
                onUpdateSettings({
                  defaultPdfCompression: e.target.value as 'low' | 'medium' | 'high',
                })
              }
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none"
            >
              <option value="low">Low (Maximum Detail)</option>
              <option value="medium">Medium (Balanced)</option>
              <option value="high">High (Maximum File Reduction)</option>
            </select>
          </div>
        </div>

        {/* Default Image Quality Slider */}
        <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Default Image Output Quality ({settings.defaultImageQuality}%)
            </label>
            <span className="text-[11px] text-stone-500">Applied across converter and resizer</span>
          </div>
          <input
            type="range"
            min={30}
            max={100}
            value={settings.defaultImageQuality}
            onChange={(e) =>
              onUpdateSettings({ defaultImageQuality: parseInt(e.target.value, 10) })
            }
            className="w-full accent-stone-900 dark:accent-stone-100"
          />
        </div>
      </div>

      {/* Firebase Account & Cloud Profile */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                User Account
              </span>
              {user ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Authenticated
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
                  Guest
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {user
                ? `Signed in as ${user.displayName || user.email}`
                : 'Sign in to sync preferences, manage subscriptions, and restore purchases.'}
            </p>
          </div>

          <div>
            {user ? (
              <button
                type="button"
                onClick={() => signOut()}
                className="py-2 px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700/80 text-stone-700 dark:text-stone-200 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-stone-500" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Register</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Firebase Cloud Messaging Notifications */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Push Notifications
              </span>
              {notificationState.enabled ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Notifications Enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
                  <BellOff className="w-3 h-3 text-stone-400" />
                  Notifications Disabled
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              Receive Firebase Cloud Messaging alerts about new offline PDF tools, performance updates, and new releases.
            </p>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={notificationState.enabled}
            disabled={isRequestingNotif}
            onClick={handleToggleNotifications}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              notificationState.enabled ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-700'
            } ${isRequestingNotif ? 'opacity-60 cursor-not-allowed' : ''}`}
            title="Enable Notifications"
          >
            <span className="sr-only">Enable Notifications</span>
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                notificationState.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Action Controls & Token Info */}
        <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleNotifications}
              disabled={isRequestingNotif}
              className="py-1.5 px-3 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Bell className="w-3.5 h-3.5 text-stone-500" />
              <span>{notificationState.enabled ? 'Disable Notifications' : 'Enable Notifications'}</span>
            </button>

            {notificationState.enabled && (
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="py-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>Test In-App Notification</span>
              </button>
            )}
          </div>

          {notificationState.token && (
            <div className="text-[11px] font-mono text-stone-500 dark:text-stone-400 truncate max-w-xs" title={notificationState.token}>
              FCM: {notificationState.token.slice(0, 16)}...
            </div>
          )}
        </div>

        {notifMessage && (
          <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 flex items-center gap-2 animate-in fade-in">
            <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{notifMessage}</span>
          </div>
        )}

        <p className="text-[11px] text-stone-400 leading-normal">
          🔒 Offline Privacy: Firebase Cloud Messaging is only used for app news and version notifications. All PDF and image file processing is guaranteed 100% offline.
        </p>
      </div>

      {/* About AllDocKit & Software Updates */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Software Version
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                v{CURRENT_APP_VERSION}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                {isTauri() ? (
                  <>
                    <Laptop className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Windows Desktop</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Web</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Check for official AllDocKit desktop and web releases from GitHub.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCheckForUpdates}
            disabled={isCheckingUpdate}
            className="self-start sm:self-auto py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white text-xs font-semibold transition-colors shadow-xs flex items-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
            <span>{isCheckingUpdate ? 'Checking for Updates...' : 'Check for Updates'}</span>
          </button>
        </div>

        {updateStatusMessage && (
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{updateStatusMessage}</span>
          </div>
        )}
      </div>

      {/* More Apps & Games by RasheedGraphix Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-stone-900 to-stone-850 dark:from-stone-900 dark:to-stone-950 text-white border border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">More Apps &amp; Games by RasheedGraphix</h3>
              <p className="text-[11px] text-stone-400">Official Windows Store releases: Typing Masters, Document Editors &amp; Games</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
            100% FREE
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="p-2.5 rounded-xl bg-stone-800/60 border border-stone-700/60 text-xs">
            <span className="text-base block mb-1">⌨️</span>
            <div className="font-bold text-stone-200 truncate">QalamTyping Master</div>
            <div className="text-[10px] text-stone-400">Multilingual Typing</div>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800/60 border border-stone-700/60 text-xs">
            <span className="text-base block mb-1">📝</span>
            <div className="font-bold text-stone-200 truncate">QalamCraft Doc</div>
            <div className="text-[10px] text-stone-400">Urdu &amp; Arabic Editor</div>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800/60 border border-stone-700/60 text-xs">
            <span className="text-base block mb-1">🧩</span>
            <div className="font-bold text-stone-200 truncate">Pro Sudoku</div>
            <div className="text-[10px] text-stone-400">Brain Puzzle Game</div>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-800/60 border border-stone-700/60 text-xs">
            <span className="text-base block mb-1">🏃‍♂️</span>
            <div className="font-bold text-stone-200 truncate">Relic Rush</div>
            <div className="text-[10px] text-stone-400">3D Sky Runner</div>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-tool', { detail: { toolId: 'our-apps' } }))}
            className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>View All Apps &amp; Download Free</span>
          </button>

          <button
            type="button"
            onClick={openRasheedGraphixStore}
            className="text-xs text-stone-300 hover:text-white underline flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Open Microsoft Store Profile</span>
          </button>
        </div>
      </div>

      {/* About AllDocKit: Privacy, Offline Guarantee & Support */}
      <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>About AllDocKit: 100% Offline &amp; Private</span>
        </div>

        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 space-y-1.5 text-xs">
          <div className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>No Internet Needed — Zero Remote Uploads</span>
          </div>
          <p className="text-stone-500 dark:text-stone-400 leading-relaxed pl-5">
            AllDocKit operates completely on your local device. Your confidential PDF contracts, financial statements, and private images never leave your machine and are never uploaded to any remote server or third-party cloud.
          </p>
        </div>

        <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => openExternalUrl('mailto:hafiznoumanurrasheed4@gmail.com')}
              className="text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-stone-500" />
              <span>Support: hafiznoumanurrasheed4@gmail.com</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1.5 transition-colors cursor-pointer underline"
            >
              <FileText className="w-3.5 h-3.5 text-stone-500" />
              <span>Privacy Policy &amp; Terms</span>
            </button>
          </div>

          <span className="text-[11px] text-stone-400">
            AllDocKit Toolkit &copy; {new Date().getFullYear()} &bull; Built with Privacy-First Architecture
          </span>
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={onResetSettings}
          className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 underline"
        >
          Reset to Factory Defaults
        </button>
      </div>

      {/* In-App Update Modal */}
      <UpdateModal
        isOpen={showUpdateModal}
        updateInfo={updateInfo}
        onClose={() => setShowUpdateModal(false)}
      />

      {/* Comprehensive Privacy Policy Modal */}
      {showPrivacyModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowPrivacyModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    AllDocKit Official Privacy Policy &amp; Terms
                  </h3>
                  <p className="text-[11px] text-stone-500">Last updated: September 2026 &bull; Strict Zero-Knowledge Privacy</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-medium">
                🛡️ <strong>Absolute Privacy Commitment:</strong> AllDocKit is engineered as a 100% offline, client-side application. We do not operate remote file-processing servers. Your confidential PDF contracts, financial statements, book scans, photos, audio recordings, and OCR outputs stay strictly inside your local device memory.
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">1. Local Device File Processing</h4>
                <p>
                  Every operation performed in AllDocKit—including PDF merging, page splitting, page rotation, image conversion, OCR book scanning, image compression, QR generation, and audio dictation—is executed exclusively within the local browser or Electron sandbox on your CPU/GPU. No document or audio stream is ever uploaded to remote servers.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">2. No File Tracking, Logging, or Telemetry</h4>
                <p>
                  We do not inspect, log, sell, monetize, or transmit your document contents, personal notes, filenames, or conversion history. Conversion history is stored solely inside your local browser storage (IndexedDB/localStorage) on your computer, which you can clear at any time in the Conversion History tab.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">3. Subscription, License Keys &amp; Payments</h4>
                <p>
                  AllDocKit provides transparent subscription and lifetime Pro license models. Pro licenses are activated either via cryptographic license keys or authentic secure payment methods (Direct Bank Transfer, Raast IBAN, or International Credit/Debit Card). License validation operates locally with offline fallback support. No sensitive financial credentials or bank PINs are stored on our servers.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">4. Offline Guarantee &amp; Data Ownership</h4>
                <p>
                  You retain 100% full intellectual property and ownership rights of all documents, images, audio transcripts, and Word (.docx) files created or modified with AllDocKit. AllDocKit functions completely offline without requiring continuous internet connectivity.
                </p>
              </div>

              <div className="space-y-1.5 p-3 rounded-xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-emerald-600" />
                  5. Official Developer Contact &amp; Support
                </h4>
                <p>
                  If you have inquiries, custom enterprise licensing requests, feature suggestions, or need billing support, contact the official developer directly at:
                </p>
                <div className="pt-1">
                  <a
                    href="mailto:hafiznoumanurrasheed4@gmail.com"
                    className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold hover:underline text-xs"
                  >
                    hafiznoumanurrasheed4@gmail.com
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="py-2.5 px-5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
              >
                I Understand &amp; Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
