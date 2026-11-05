import { User } from 'firebase/auth';
import {
  getUserProfile,
  syncUserProfile,
  startUserTrialInFirestore,
  UserProfileData,
} from './firebase';

export const DAILY_FREE_LIMIT = 5;
export const TRIAL_DAYS = 7;
export const DAILY_STORAGE_KEY = 'alldockit_daily_free_usage_v3';
export const TRIAL_USED_LOCAL_KEY = 'alldockit_trial_used_accounts_v3';

let inMemoryDailyCount = 0;
let inMemoryDate = '';

function getTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function safeGetStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(key);
      if (v !== null && v !== undefined && v !== '') return v;
    }
  } catch {
    // LocalStorage restricted
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const v = sessionStorage.getItem(key);
      if (v !== null && v !== undefined && v !== '') return v;
    }
  } catch {
    // SessionStorage restricted
  }
  try {
    if (typeof document !== 'undefined' && document.cookie) {
      const match = document.cookie.match(new RegExp('(^|;\\s*)' + key + '=([^;]*)'));
      if (match && match[2]) return decodeURIComponent(match[2]);
    }
  } catch {
    // Cookie restricted
  }
  return null;
}

function safeSetStorage(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
    }
  } catch {
    // LocalStorage restricted
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, val);
    }
  } catch {
    // SessionStorage restricted
  }
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${key}=${encodeURIComponent(val)}; path=/; max-age=31536000; SameSite=Lax`;
    }
  } catch {
    // Cookie restricted
  }
}

/**
 * Returns today's free conversion count.
 * Automatically resets to 0 when date changes.
 */
export function getDailyFreeUsage(): number {
  const today = getTodayKey();
  if (inMemoryDate !== today) {
    inMemoryDate = today;
    inMemoryDailyCount = 0;
  }

  const raw = safeGetStorage(DAILY_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === today && typeof parsed.count === 'number') {
        inMemoryDailyCount = Math.max(inMemoryDailyCount, parsed.count);
        return inMemoryDailyCount;
      }
    } catch {
      // Fallback
    }
  }

  return inMemoryDailyCount;
}

/**
 * Increments today's free conversion count and triggers custom event.
 */
export function incrementDailyFreeUsage(): number {
  const today = getTodayKey();
  const current = getDailyFreeUsage();
  const updated = current + 1;
  inMemoryDailyCount = updated;
  inMemoryDate = today;

  safeSetStorage(
    DAILY_STORAGE_KEY,
    JSON.stringify({
      date: today,
      count: updated,
    })
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('alldockit-daily-usage-updated', {
        detail: { count: updated, remaining: Math.max(0, DAILY_FREE_LIMIT - updated) },
      })
    );
    window.dispatchEvent(
      new CustomEvent('pixdoc-daily-usage-updated', {
        detail: { count: updated, remaining: Math.max(0, DAILY_FREE_LIMIT - updated) },
      })
    );
  }

  return updated;
}

/**
 * Returns how many free conversions are remaining today.
 */
export function getRemainingDailyFree(): number {
  const used = getDailyFreeUsage();
  return Math.max(0, DAILY_FREE_LIMIT - used);
}

/**
 * Checks if user still has daily free allowance (less than 5).
 */
export function canUseDailyFree(): boolean {
  return getDailyFreeUsage() < DAILY_FREE_LIMIT;
}

/**
 * Parses trialStart timestamp.
 */
export function parseTrialStartTime(trialStart: unknown): number | null {
  if (!trialStart) return null;
  if (typeof (trialStart as { toMillis?: () => number }).toMillis === 'function') {
    return (trialStart as { toMillis: () => number }).toMillis();
  }
  if (typeof (trialStart as { toDate?: () => Date }).toDate === 'function') {
    return (trialStart as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof (trialStart as { seconds?: number }).seconds === 'number') {
    return (trialStart as { seconds: number }).seconds * 1000;
  }
  if (trialStart instanceof Date) {
    return trialStart.getTime();
  }
  if (typeof trialStart === 'number') {
    return trialStart;
  }
  if (typeof trialStart === 'string') {
    const parsed = new Date(trialStart).getTime();
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Determines whether a 7-day free trial is currently active.
 */
export function isTrialActive(trialStart: unknown): boolean {
  const startMs = parseTrialStartTime(trialStart);
  if (!startMs) return false;
  const elapsedMs = Date.now() - startMs;
  const trialDurationMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return elapsedMs < trialDurationMs;
}

/**
 * Returns number of days left in 7-day trial (rounded up, min 0).
 */
export function getTrialDaysLeft(trialStart: unknown): number {
  const startMs = parseTrialStartTime(trialStart);
  if (!startMs) return 0;
  const elapsedMs = Date.now() - startMs;
  const trialDurationMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = trialDurationMs - elapsedMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: 'guest_daily_limit' | 'eligible_for_trial' | 'trial_ended' | 'guest_limit';
  isGuest?: boolean;
  isPro?: boolean;
  isTrial?: boolean;
  isDailyFree?: boolean;
  remainingDaily?: number;
  daysLeft?: number;
  profile?: UserProfileData | null;
}

/**
 * Central Gatekeeper Validation:
 * 1. Pro users: Unlimited access.
 * 2. Active Trial users: Unlimited access (up to 7 days).
 * 3. Free Allowance: 5 free conversions per day for all users!
 * 4. When 5 daily limit is reached:
 *    - If Guest: prompted to Sign In to get 7-Day Free Trial.
 *    - If Logged In (Never used trial): prompted to Start 1-Time 7-Day Free Trial.
 *    - If Logged In (Trial expired / used): strictly blocked from re-trialling, prompted to Upgrade to Pro!
 */
export async function checkConversionAccess(user: User | null): Promise<AccessCheckResult> {
  // 1. Check logged-in user specific rules (Pro / Trial)
  if (user) {
    const profile = await getUserProfile(user.uid);

    // Pro has unlimited access
    if (profile?.subscription === 'pro') {
      return { allowed: true, isPro: true, profile };
    }

    // If currently in active 7-day trial
    if (profile?.trialStart && isTrialActive(profile.trialStart)) {
      const daysLeft = getTrialDaysLeft(profile.trialStart);
      return { allowed: true, isTrial: true, daysLeft, profile };
    }
  }

  // 2. Check 5 Free Daily requests
  if (canUseDailyFree()) {
    const remaining = getRemainingDailyFree();
    return {
      allowed: true,
      isDailyFree: true,
      remainingDaily: remaining,
      isGuest: !user,
    };
  }

  // 3. Daily limit of 5 is exhausted! Determine next step:
  if (!user) {
    return {
      allowed: false,
      reason: 'guest_daily_limit',
      isGuest: true,
      remainingDaily: 0,
    };
  }

  const profile = await getUserProfile(user.uid);

  // If user has never used trial before, they are eligible to start 7-day trial
  const hasEverUsedTrial = Boolean(profile?.hasUsedTrial || profile?.trialStart);
  if (!hasEverUsedTrial) {
    return {
      allowed: false,
      reason: 'eligible_for_trial',
      remainingDaily: 0,
      profile,
    };
  }

  // Strictly 1-time trial per account! Once trial ended, they cannot re-trial
  return {
    allowed: false,
    reason: 'trial_ended',
    remainingDaily: 0,
    daysLeft: 0,
    profile,
  };
}
