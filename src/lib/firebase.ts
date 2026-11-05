import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  type User,
  type AuthError,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
};

// Initialize Firebase App safely
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with database ID safely
export const db =
  firebaseConfigJson.firestoreDatabaseId &&
  firebaseConfigJson.firestoreDatabaseId !== '(default)' &&
  firebaseConfigJson.firestoreDatabaseId !== ''
    ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
    : getFirestore(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export interface UserProfileData {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt?: unknown;
  lastLoginAt?: unknown;
  trialStart?: unknown;
  hasUsedTrial?: boolean;
  subscription?: 'free' | 'free_trial' | 'pro' | string;
  plan?: string;
  upgradedAt?: unknown;
}

/**
 * Fetch user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfileData | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfileData;
    }
    return null;
  } catch (error) {
    console.warn('Could not fetch user profile from Firestore:', error);
    return null;
  }
}

/**
 * Sync user profile to Firestore `/users/{uid}` document.
 * Initializes default 'free' profile with 5 daily requests.
 * Preserves 1-time trial history strictly.
 */
export async function syncUserProfile(user: User): Promise<UserProfileData | null> {
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const newProfile = {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        hasUsedTrial: false,
        subscription: 'free' as const,
      };
      await setDoc(userRef, newProfile);
      return {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || '',
        hasUsedTrial: false,
        subscription: 'free',
      };
    } else {
      const data = snap.data() as UserProfileData;
      const updates: Record<string, unknown> = {
        lastLoginAt: serverTimestamp(),
        displayName: user.displayName || data?.displayName || '',
        photoURL: user.photoURL || data?.photoURL || '',
      };

      // Check if user had an active trial that expired (> 7 days)
      if (data.trialStart) {
        let startMs = 0;
        const ts = data.trialStart as { toMillis?: () => number; seconds?: number } | number | string | Date;
        if (typeof ts === 'object' && ts && 'toMillis' in ts && typeof ts.toMillis === 'function') {
          startMs = ts.toMillis();
        } else if (typeof ts === 'object' && ts && 'seconds' in ts && typeof ts.seconds === 'number') {
          startMs = ts.seconds * 1000;
        } else if (ts instanceof Date) {
          startMs = ts.getTime();
        } else if (typeof ts === 'number') {
          startMs = ts;
        } else if (typeof ts === 'string') {
          startMs = new Date(ts).getTime();
        }

        const elapsedMs = Date.now() - startMs;
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

        if (elapsedMs >= sevenDaysMs && data.subscription === 'free_trial') {
          updates.subscription = 'free';
          updates.hasUsedTrial = true;
        }
      }

      await setDoc(userRef, updates, { merge: true });
      return {
        ...data,
        ...updates,
      } as UserProfileData;
    }
  } catch (error) {
    console.warn('Could not sync user profile to Firestore (may be offline):', error);
    return null;
  }
}

/**
 * Activates the 1-time 7-Day Free Trial for a user in Firestore.
 * Strictly checks that the user has NEVER used a trial before.
 */
export async function startUserTrialInFirestore(uid: string): Promise<{ success: boolean; error?: string; profile?: UserProfileData }> {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      return { success: false, error: 'User profile not found.' };
    }

    const data = snap.data() as UserProfileData;

    // Strict check: if user already used trial or trialStart exists, reject!
    if (data.hasUsedTrial || data.trialStart) {
      return {
        success: false,
        error: 'You have already used your 1-time Free Trial on this account.',
      };
    }

    if (data.subscription === 'pro') {
      return { success: false, error: 'You are already a Pro member.' };
    }

    const updates = {
      subscription: 'free_trial',
      trialStart: serverTimestamp(),
      hasUsedTrial: true,
    };

    await setDoc(userRef, updates, { merge: true });

    const updatedProfile: UserProfileData = {
      ...data,
      subscription: 'free_trial',
      trialStart: new Date(),
      hasUsedTrial: true,
    };

    return { success: true, profile: updatedProfile };
  } catch (err) {
    console.error('Failed to start trial in Firestore:', err);
    return { success: false, error: 'Failed to activate trial. Please try again.' };
  }
}

/**
 * Upgrades user to Pro in Firestore
 */
export async function upgradeUserToPro(uid: string, plan: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        subscription: 'pro',
        plan,
        upgradedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('Failed to upgrade user to pro in Firestore:', err);
    return false;
  }
}

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await syncUserProfile(result.user);
  return result.user;
}

/**
 * Sign in with Email and Password
 */
export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  await syncUserProfile(credential.user);
  return credential.user;
}

/**
 * Register with Email and Password
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  displayName?: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName && displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  await syncUserProfile(credential.user);
  return credential.user;
}

/**
 * Sign out current user
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Send password reset email
 */
export async function sendResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Helper to translate Firebase Auth errors to human-friendly text
 */
export function getFriendlyAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return 'An unexpected error occurred.';
  const code = (error as AuthError).code;

  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/unauthorized-domain': {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      return `Domain "${currentHost}" is not authorized in Firebase Console. Please add "${currentHost}" (or your domain) to Firebase Authentication > Settings > Authorized domains.`;
    }
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing.';
    case 'auth/cancelled-popup-request':
      return 'Popup request was cancelled.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by browser. Please allow popups for this site.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    default:
      return (error as Error).message || 'Authentication failed. Please try again.';
  }
}

export type { User };
