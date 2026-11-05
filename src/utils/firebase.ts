import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  Messaging,
} from 'firebase/messaging';
import { app, firebaseConfig } from '../lib/firebase';

export { app, firebaseConfig };

let messagingInstance: Messaging | null = null;
let messagingChecked = false;

/**
 * Returns the Firebase Messaging instance if supported in current browser/environment.
 */
export async function getMessagingSafely(): Promise<Messaging | null> {
  if (messagingChecked) return messagingInstance;
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const supported = await isSupported();
      if (supported) {
        messagingInstance = getMessaging(app);
      }
    }
  } catch (err) {
    console.warn('Firebase Messaging not supported or placeholder config in use:', err);
  } finally {
    messagingChecked = true;
  }
  return messagingInstance;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  timestamp: number;
}

type NotificationListener = (notification: AppNotification) => void;
const listeners: Set<NotificationListener> = new Set();

/**
 * Dispatches an in-app notification to all active listeners.
 */
export function emitInAppNotification(notification: {
  title: string;
  body: string;
  icon?: string;
}): void {
  const item: AppNotification = {
    id: Math.random().toString(36).substring(2, 9),
    title: notification.title,
    body: notification.body,
    icon: notification.icon,
    timestamp: Date.now(),
  };
  listeners.forEach((fn) => fn(item));
}

/**
 * Request notification permission from the user, retrieves the FCM token,
 * and saves it to localStorage ('fcm_token').
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Web notifications are not supported in this browser environment.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messaging = await getMessagingSafely();
      let token: string | null = null;

      if (messaging) {
        try {
          token = await getToken(messaging);
        } catch (err) {
          console.warn(
            'Could not retrieve FCM token with placeholder credentials. Using local device token.',
            err
          );
        }
      }

      // If token wasn't returned by network (e.g. placeholder API key), generate local device token for testing
      if (!token) {
        token =
          localStorage.getItem('fcm_token') ||
          `fcm_placeholder_${Math.random().toString(36).substring(2, 10)}`;
      }

      localStorage.setItem('fcm_token', token);
      localStorage.setItem('notifications_enabled', 'true');
      window.dispatchEvent(
        new CustomEvent('notifications-status-changed', {
          detail: { enabled: true, token },
        })
      );
      return token;
    } else {
      localStorage.setItem('notifications_enabled', 'false');
      window.dispatchEvent(
        new CustomEvent('notifications-status-changed', {
          detail: { enabled: false, token: null },
        })
      );
      return null;
    }
  } catch (error) {
    console.warn('Failed to request notification permission:', error);
    return null;
  }
}

/**
 * Helper to check current notification status from localStorage and browser permissions.
 */
export function getNotificationStatus(): {
  enabled: boolean;
  token: string | null;
  permission: NotificationPermission | 'unsupported';
} {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { enabled: false, token: null, permission: 'unsupported' };
  }
  const savedPref = localStorage.getItem('notifications_enabled');
  // Default to enabled (true) if user hasn't explicitly set to 'false'
  const isPrefEnabled = savedPref === null || savedPref === 'true';
  const isGranted = Notification.permission === 'granted';
  
  // If browser permission is granted and user hasn't disabled it, or default state
  const enabled = isPrefEnabled && (isGranted || savedPref === null);
  const token = localStorage.getItem('fcm_token');
  return {
    enabled,
    token,
    permission: Notification.permission,
  };
}

/**
 * Sets notification preference manually (e.g., from settings toggle).
 */
export function setNotificationStatus(enabled: boolean): void {
  localStorage.setItem('notifications_enabled', enabled ? 'true' : 'false');
  window.dispatchEvent(
    new CustomEvent('notifications-status-changed', {
      detail: { enabled, token: localStorage.getItem('fcm_token') },
    })
  );
}

/**
 * Listens for foreground messages and invokes the callback for in-app toast notifications.
 */
export function onMessageListener(
  callback?: (payload: AppNotification) => void
): () => void {
  if (callback) {
    listeners.add(callback);
  }

  let unsubscribeFirebase: (() => void) | null = null;

  getMessagingSafely().then((messaging) => {
    if (messaging) {
      try {
        unsubscribeFirebase = onMessage(messaging, (payload) => {
          const title = payload.notification?.title || 'AllDocKit Update';
          const body = payload.notification?.body || '';
          const notif: AppNotification = {
            id: payload.messageId || Math.random().toString(36).substring(2, 9),
            title,
            body,
            icon: payload.notification?.icon,
            timestamp: Date.now(),
          };
          if (callback) {
            callback(notif);
          } else {
            listeners.forEach((fn) => fn(notif));
          }
        });
      } catch (err) {
        console.warn('Error attaching FCM foreground onMessage listener:', err);
      }
    }
  });

  return () => {
    if (callback) {
      listeners.delete(callback);
    }
    if (unsubscribeFirebase) {
      unsubscribeFirebase();
    }
  };
}
