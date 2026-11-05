import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  loginWithGoogle as fbLoginWithGoogle,
  loginWithEmail as fbLoginWithEmail,
  registerWithEmail as fbRegisterWithEmail,
  logoutUser as fbLogoutUser,
  sendResetPassword as fbSendResetPassword,
  getFriendlyAuthErrorMessage,
  syncUserProfile,
  getUserProfile,
  upgradeUserToPro,
  startUserTrialInFirestore,
  UserProfileData,
} from '../lib/firebase';
import {
  DAILY_FREE_LIMIT,
  TRIAL_DAYS,
  getDailyFreeUsage,
  incrementDailyFreeUsage,
  getRemainingDailyFree,
  canUseDailyFree,
  isTrialActive as checkTrialActive,
  getTrialDaysLeft,
  checkConversionAccess,
} from '../lib/trial';
import { AuthModal } from '../components/AuthModal';
import { UpgradeModal } from '../components/UpgradeModal';

export type UpgradeModalType = 'guest_daily_limit' | 'eligible_for_trial' | 'trial_ended' | 'guest_limit';

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfileData | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  trialDaysLeft: number;
  isTrialActive: boolean;
  isPro: boolean;
  hasUsedTrial: boolean;
  dailyUsage: number;
  dailyLimit: number;
  remainingDaily: number;
  guestUsage: number;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  openUpgradeModal: (type: UpgradeModalType) => void;
  closeUpgradeModal: () => void;
  verifyAccessBeforeAction: () => Promise<boolean>;
  activateFreeTrial: () => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserProfile: () => Promise<UserProfileData | null>;
  upgradePlan: (plan: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyUsage, setDailyUsage] = useState<number>(() => getDailyFreeUsage());

  // Listen to daily usage changes across windows/tabs
  useEffect(() => {
    const handleUsageChange = () => {
      setDailyUsage(getDailyFreeUsage());
    };
    window.addEventListener('alldockit-daily-usage-updated', handleUsageChange);
    window.addEventListener('pixdoc-daily-usage-updated', handleUsageChange);
    return () => {
      window.removeEventListener('alldockit-daily-usage-updated', handleUsageChange);
      window.removeEventListener('pixdoc-daily-usage-updated', handleUsageChange);
    };
  }, []);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    type: UpgradeModalType;
  }>({
    isOpen: false,
    type: 'guest_daily_limit',
  });

  const refreshUserProfile = useCallback(async (): Promise<UserProfileData | null> => {
    if (!auth.currentUser) {
      setUserProfile(null);
      return null;
    }
    const profile = await getUserProfile(auth.currentUser.uid);
    if (profile) {
      setUserProfile(profile);
    }
    return profile;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const synced = await syncUserProfile(currentUser);
        setUserProfile(synced);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openLoginModal = () => setIsAuthModalOpen(true);
  const closeLoginModal = () => setIsAuthModalOpen(false);

  const openUpgradeModal = (type: UpgradeModalType) => {
    setUpgradeModal({ isOpen: true, type });
  };
  const closeUpgradeModal = () => {
    setUpgradeModal((prev) => ({ ...prev, isOpen: false }));
  };

  /**
   * Activates 7-Day Free Trial for logged in user (strictly 1-time per account).
   */
  const activateFreeTrial = async (): Promise<{ success: boolean; error?: string }> => {
    const activeUser = user || auth.currentUser;
    if (!activeUser) {
      openLoginModal();
      return { success: false, error: 'Please sign in first.' };
    }

    const res = await startUserTrialInFirestore(activeUser.uid);
    if (res.success && res.profile) {
      setUserProfile(res.profile);
      closeUpgradeModal();
      return { success: true };
    }

    return { success: false, error: res.error || 'Failed to start trial.' };
  };

  /**
   * Central gatekeeper function before converting/processing files.
   * - 5 daily free operations allowed.
   * - Pro tier & Active trial: unlimited.
   * - If daily limit (5) reached:
   *   - Guest -> opens modal to sign in for 7-day trial.
   *   - Logged in (never had trial) -> opens modal to start 7-day trial.
   *   - Logged in (already used trial) -> strictly blocked from trial, opens Pro upgrade!
   */
  const verifyAccessBeforeAction = async (): Promise<boolean> => {
    const activeUser = user || auth.currentUser;
    const result = await checkConversionAccess(activeUser);

    if (result.allowed) {
      // If user used free daily quota, increment count
      if (result.isDailyFree) {
        const newCount = incrementDailyFreeUsage();
        setDailyUsage(newCount);
      }
      return true;
    }

    // Daily limit of 5 exceeded! Open appropriate modal:
    if (result.reason === 'guest_daily_limit' || result.reason === 'guest_limit') {
      openUpgradeModal('guest_daily_limit');
      return false;
    }

    if (result.reason === 'eligible_for_trial') {
      openUpgradeModal('eligible_for_trial');
      return false;
    }

    if (result.reason === 'trial_ended') {
      openUpgradeModal('trial_ended');
      return false;
    }

    openUpgradeModal(activeUser ? 'trial_ended' : 'guest_daily_limit');
    return false;
  };

  const signInWithGoogle = async () => {
    try {
      const u = await fbLoginWithGoogle();
      const p = await getUserProfile(u.uid);
      setUserProfile(p);
      setIsAuthModalOpen(false);
    } catch (err) {
      throw new Error(getFriendlyAuthErrorMessage(err));
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const u = await fbLoginWithEmail(email, pass);
      const p = await getUserProfile(u.uid);
      setUserProfile(p);
      setIsAuthModalOpen(false);
    } catch (err) {
      throw new Error(getFriendlyAuthErrorMessage(err));
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    try {
      const u = await fbRegisterWithEmail(email, pass, name);
      const p = await getUserProfile(u.uid);
      setUserProfile(p);
      setIsAuthModalOpen(false);
    } catch (err) {
      throw new Error(getFriendlyAuthErrorMessage(err));
    }
  };

  const signOut = async () => {
    try {
      await fbLogoutUser();
      setUserProfile(null);
    } catch (err) {
      throw new Error(getFriendlyAuthErrorMessage(err));
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await fbSendResetPassword(email);
    } catch (err) {
      throw new Error(getFriendlyAuthErrorMessage(err));
    }
  };

  const upgradePlan = async (plan: string): Promise<boolean> => {
    if (!user) {
      openLoginModal();
      return false;
    }
    const success = await upgradeUserToPro(user.uid, plan);
    if (success) {
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              subscription: 'pro',
              plan,
            }
          : null
      );
      closeUpgradeModal();
    }
    return success;
  };

  const isPro = userProfile?.subscription === 'pro';
  const isTrialActive = Boolean(
    user && !isPro && checkTrialActive(userProfile?.trialStart)
  );
  const trialDaysLeft = user ? getTrialDaysLeft(userProfile?.trialStart) : 0;
  const hasUsedTrial = Boolean(userProfile?.hasUsedTrial || (userProfile?.trialStart && !isTrialActive));
  const remainingDaily = Math.max(0, DAILY_FREE_LIMIT - dailyUsage);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isAuthModalOpen,
        trialDaysLeft,
        isTrialActive,
        isPro,
        hasUsedTrial,
        dailyUsage,
        dailyLimit: DAILY_FREE_LIMIT,
        remainingDaily,
        guestUsage: dailyUsage,
        openLoginModal,
        closeLoginModal,
        openUpgradeModal,
        closeUpgradeModal,
        verifyAccessBeforeAction,
        activateFreeTrial,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        resetPassword,
        refreshUserProfile,
        upgradePlan,
      }}
    >
      {children}

      {/* Global Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={closeLoginModal} />

      {/* Global Freemium Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        type={upgradeModal.type}
        onClose={closeUpgradeModal}
        onStartTrial={async () => {
          if (!user) {
            closeUpgradeModal();
            openLoginModal();
          } else {
            await activateFreeTrial();
          }
        }}
        onSignIn={() => {
          closeUpgradeModal();
          openLoginModal();
        }}
        openLoginModal={openLoginModal}
        onUpgrade={async (plan) => {
          await upgradePlan(plan);
        }}
      />
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
