import React from 'react';

interface AllDocKitLogoProps {
  size?: number;
  className?: string;
  showBadge?: boolean;
}

export const PixDocLogo: React.FC<AllDocKitLogoProps> = ({
  size = 36,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 drop-shadow-sm ${className}`}
    >
      <defs>
        <linearGradient id="adk_react_bg" x1="64" y1="40" x2="448" y2="472" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="50%" stopColor="#090D16" />
          <stop offset="100%" stopColor="#030712" />
        </linearGradient>

        <linearGradient id="adk_react_rim" x1="100" y1="50" x2="400" y2="450" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
          <stop offset="50%" stopColor="#10B981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.1" />
        </linearGradient>

        <linearGradient id="adk_react_doc_primary" x1="160" y1="110" x2="350" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="60%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>

        <linearGradient id="adk_react_doc_pdf" x1="200" y1="160" x2="380" y2="420" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F43F5E" />
          <stop offset="50%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#BE123C" />
        </linearGradient>

        <linearGradient id="adk_react_fold" x1="290" y1="120" x2="350" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="100%" stopColor="#A7F3D0" />
        </linearGradient>

        <linearGradient id="adk_react_sparkle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        <filter id="adk_react_shadow" x="-15%" y="-15%" width="130%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="16" stdDeviation="16" floodColor="#000000" floodOpacity="0.55" />
        </filter>
      </defs>

      <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#adk_react_bg)" stroke="#1E293B" strokeWidth="4" />
      <rect x="28" y="28" width="456" height="456" rx="104" fill="none" stroke="url(#adk_react_rim)" strokeWidth="4" />

      <g filter="url(#adk_react_shadow)">
        <path d="M128 160C128 142.327 142.327 128 160 128H270L340 198V330C340 347.673 325.673 362 308 362H160C142.327 362 128 347.673 128 330V160Z" fill="#1E293B" stroke="#334155" strokeWidth="6" />
        <path d="M152 140C152 122.327 166.327 108 184 108H300L370 178V350C370 367.673 355.673 382 338 382H184C166.327 382 152 367.673 152 350V140Z" fill="url(#adk_react_doc_primary)" />
        <path d="M300 108V154C300 167.255 310.745 178 324 178H370L300 108Z" fill="url(#adk_react_fold)" />
        <rect x="188" y="180" width="180" height="200" rx="18" fill="url(#adk_react_doc_pdf)" stroke="#090D16" strokeWidth="6" />

        <rect x="220" y="218" width="70" height="12" rx="6" fill="#FFFFFF" fillOpacity="0.9" />
        <rect x="220" y="246" width="116" height="10" rx="5" fill="#FFFFFF" fillOpacity="0.75" />
        <rect x="220" y="270" width="96" height="10" rx="5" fill="#FFFFFF" fillOpacity="0.75" />
        <rect x="220" y="294" width="60" height="10" rx="5" fill="#FFFFFF" fillOpacity="0.75" />

        <circle cx="340" cy="350" r="38" fill="#0F172A" stroke="#38BDF8" strokeWidth="4" />
        <path d="M328 360L340 334L352 360H346L343.5 354H336.5L334 360H328ZM338 350H342L340 344L338 350Z" fill="#38BDF8" />

        <path d="M208 142L213.5 156.5L228 162L213.5 167.5L208 182L202.5 167.5L188 162L202.5 156.5L208 142Z" fill="url(#adk_react_sparkle)" />
        <circle cx="250" cy="148" r="4" fill="#FDE047" />
      </g>
    </svg>
  );
};

export const AllDocKitLogo = PixDocLogo;
