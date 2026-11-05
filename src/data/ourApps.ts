export interface StoreApp {
  id: string;
  title: string;
  tagline: string;
  category: string;
  categoryType: 'all' | 'productivity' | 'education' | 'games';
  rating: number;
  reviewsCount: number;
  price: string;
  isCurrentApp?: boolean;
  featured?: boolean;
  badge?: string;
  badgeColor?: string;
  features: string[];
  storeQuery: string;
  storeWebUrl: string;
  storeProtocolUrl: string;
  iconGradient: string;
  iconEmoji: string;
  downloadPitch: string;
}

export const RASHEED_GRAPHIX_STORE = {
  publisherName: 'RasheedGraphix',
  storeWebUrl: 'https://apps.microsoft.com/search?query=RasheedGraphix',
  storeProtocolUrl: 'ms-windows-store://search/?query=RasheedGraphix',
  publisherProtocolUrl: 'ms-windows-store://publisher/?name=RasheedGraphix',
};

export const OUR_APPS_DATA: StoreApp[] = [
  {
    id: 'qalamtyping-master',
    title: 'QalamTyping Master',
    tagline: 'Master touch typing in English, Urdu Phonetic, Sindhi, and Punjabi with interactive on-screen keyboard guides, real-time speed & accuracy test.',
    category: 'Education & Typing',
    categoryType: 'education',
    rating: 5.0,
    reviewsCount: 142,
    price: 'Free',
    featured: true,
    badge: 'POPULAR',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    iconGradient: 'from-amber-500 to-orange-600',
    iconEmoji: '⌨️',
    downloadPitch: 'Boost your typing speed up to 80+ WPM with multilingual keyboard lessons and games!',
    features: [
      'English, Urdu Phonetic, Sindhi & Punjabi keyboard layouts',
      'Real-time WPM speed, accuracy tracker & error heatmaps',
      'Custom text typing tests & interactive typing games',
      '100% offline desktop speed training on Windows',
    ],
    storeQuery: 'QalamTyping Master',
    storeWebUrl: 'https://apps.microsoft.com/search?query=QalamTyping+Master',
    storeProtocolUrl: 'ms-windows-store://search/?query=QalamTyping%20Master',
  },
  {
    id: 'alldockit',
    title: 'AllDocKit - PDF & Image ToolKit',
    tagline: '100% Client-Side Privacy: Your files never leave your computer. PDF Merger, Splitter, Organizer, HD Extractor, Watermarker & QR Studio.',
    category: 'Productivity & Office',
    categoryType: 'productivity',
    rating: 4.9,
    reviewsCount: 98,
    price: 'Free',
    isCurrentApp: true,
    featured: true,
    badge: 'INSTALLED',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    iconGradient: 'from-emerald-500 to-teal-600',
    iconEmoji: '📑',
    downloadPitch: 'The exact document suite you are using right now — rate us 5 stars on Microsoft Store!',
    features: [
      'Merge, split, rotate, organize & compress PDF documents',
      '100% offline & local processing for complete data privacy',
      'Batch image converter (PNG, JPG, WebP, HEIC) & compressor',
      'Smart QR Code studio & offline text-to-speech engine',
    ],
    storeQuery: 'AllDocKit',
    storeWebUrl: 'https://apps.microsoft.com/search?query=alldockit',
    storeProtocolUrl: 'ms-windows-store://search/?query=alldockit',
  },
  {
    id: 'qalamcraft-doc',
    title: 'QalamCraft Doc',
    tagline: 'Modern and professional multilingual document editor with native Urdu Nastaliq, Pashto, Arabic and English typography support.',
    category: 'Productivity & Office',
    categoryType: 'productivity',
    rating: 5.0,
    reviewsCount: 84,
    price: 'Free',
    badge: 'NEW',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    iconGradient: 'from-emerald-600 to-green-700',
    iconEmoji: '📝',
    downloadPitch: 'Create stunning letters, resumes and books with full Nastaliq & RTL formatting support.',
    features: [
      'Full RTL bidirectional support for Urdu, Arabic & Pashto',
      'Professional document templates & resume builder',
      'Word ribbon styling, font kerning & high-res PDF exports',
      'Lightweight and starts instantly without heavy Microsoft Office bloat',
    ],
    storeQuery: 'QalamCraft Doc',
    storeWebUrl: 'https://apps.microsoft.com/search?query=QalamCraft+Doc',
    storeProtocolUrl: 'ms-windows-store://search/?query=QalamCraft%20Doc',
  },
  {
    id: 'pro-sudoku',
    title: 'Pro Sudoku - Brain Puzzle',
    tagline: 'Ultra-premium, distraction-free Sudoku game featuring real-time puzzle generation, smart candidate notes, logical hints and dark theme.',
    category: 'Brain & Puzzle Game',
    categoryType: 'games',
    rating: 4.8,
    reviewsCount: 110,
    price: 'Free',
    badge: 'FREE GAME',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    iconGradient: 'from-blue-600 to-indigo-700',
    iconEmoji: '🧩',
    downloadPitch: 'Train your brain every day with infinite unique puzzles from Easy to Expert level!',
    features: [
      'Infinite puzzles generated dynamically with guaranteed unique solutions',
      'Smart pencil marks, auto-notes & conflict detection',
      'Detailed statistics, win streaks & timer modes',
      'Zero distracting popup ads during gameplay',
    ],
    storeQuery: 'Pro Sudoku Brain Puzzle',
    storeWebUrl: 'https://apps.microsoft.com/search?query=Pro+Sudoku+Brain+Puzzle',
    storeProtocolUrl: 'ms-windows-store://search/?query=Pro%20Sudoku%20Brain%20Puzzle',
  },
  {
    id: 'relic-rush',
    title: 'Relic Rush: Sky Sanctum',
    tagline: 'Relic Rush: Sky Sanctum is a high-speed 3D endless runner adventure set across ancient floating sky temples with obstacles and collectibles.',
    category: 'Action & 3D Runner Game',
    categoryType: 'games',
    rating: 5.0,
    reviewsCount: 76,
    price: 'Free',
    badge: '3D GAME',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    iconGradient: 'from-amber-600 to-yellow-600',
    iconEmoji: '🏃‍♂️',
    downloadPitch: 'Fast-paced 3D arcade runner on floating sky islands — jump, slide, and survive!',
    features: [
      'Stunning 3D low-poly floating temple ruins and dynamic lighting',
      'Fluid keyboard / gamepad controls with responsive dodging',
      'Collect ancient golden relics and unlock unique characters',
      'Offline play ready — no constant internet connection needed',
    ],
    storeQuery: 'Relic Rush Sky Sanctum',
    storeWebUrl: 'https://apps.microsoft.com/search?query=Relic+Rush+Sky+Sanctum',
    storeProtocolUrl: 'ms-windows-store://search/?query=Relic%20Rush%20Sky%20Sanctum',
  },
];

/**
 * Launch Microsoft Store directly to the app page or search
 * Opens native Windows Store client if available, with web fallback
 */
export function openMicrosoftStoreApp(app: StoreApp) {
  // First try the Windows Store protocol (wakes up Microsoft Store app on Windows 10/11)
  try {
    const isWindows = /windows/i.test(navigator.userAgent);
    if (isWindows) {
      window.location.href = app.storeProtocolUrl;
      // Also provide a timeout fallback to open web page in case protocol handler didn't switch
      setTimeout(() => {
        window.open(app.storeWebUrl, '_blank', 'noopener,noreferrer');
      }, 1000);
      return;
    }
  } catch {
    // fallback
  }

  // Web fallback for non-Windows or if protocol failed
  window.open(app.storeWebUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Open all apps by RasheedGraphix in Microsoft Store
 */
export function openRasheedGraphixStore() {
  try {
    const isWindows = /windows/i.test(navigator.userAgent);
    if (isWindows) {
      window.location.href = RASHEED_GRAPHIX_STORE.storeProtocolUrl;
      setTimeout(() => {
        window.open(RASHEED_GRAPHIX_STORE.storeWebUrl, '_blank', 'noopener,noreferrer');
      }, 1000);
      return;
    }
  } catch {
    // fallback
  }

  window.open(RASHEED_GRAPHIX_STORE.storeWebUrl, '_blank', 'noopener,noreferrer');
}
