// Minimal inline icon set (stroke-based, inherits currentColor).
type P = { className?: string };
const base = (className?: string) => ({
  className,
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const GlobeIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </svg>
);

export const BarIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const CurveIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 17c3-1 4-9 7-9s3 6 6 6 3-6 5-6" />
    <circle cx="3" cy="17" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="10" cy="8" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="16" cy="14" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="21" cy="8" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const PatternsIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="8" r="2.5" />
    <circle cx="9" cy="17" r="2.5" />
    <path d="M8 7.5 16 8M8 15l8-5" />
  </svg>
);

export const HomeIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 11l8-7 8 7M6 10v9h12v-9" />
  </svg>
);

export const PieIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3a9 9 0 1 0 9 9h-9V3Z" />
  </svg>
);

export const FunnelIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
  </svg>
);

export const DotsIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </svg>
);

export const LeadIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6M22 11h-6" />
  </svg>
);

export const SpendIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 1.2-1 1.7-2.5 2s-2.5.8-2.5 2a2.5 2 0 0 0 5 0" />
  </svg>
);

export const CplIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 17l5-5 4 4 8-9" />
    <path d="M16 7h4v4" />
  </svg>
);

export const WhatsAppIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 21l1.6-4.8A8.5 8.5 0 1 1 8.2 19.4L3 21Z" />
    <path d="M8.5 8.7c.2-.5.4-.5.6-.5h.5c.15 0 .35 0 .5.4.2.5.7 1.7.75 1.85.05.15.1.3 0 .5-.1.2-.15.3-.3.45s-.3.35-.45.45c-.15.15-.3.3-.15.6.15.3.7 1.15 1.5 1.85 1.05.95 1.9 1.25 2.2 1.4.3.15.5.1.65-.1.15-.2.6-.7.8-.95.2-.25.4-.2.65-.1.25.1 1.6.75 1.85.9.25.15.4.2.45.35.05.15.05.85-.2 1.65-.25.8-1.45 1.5-2.05 1.55-.55.05-1.1.1-3.65-.9-2.6-1.05-4.35-3.75-4.5-3.95-.15-.2-1.15-1.55-1.15-2.95s.75-2.1.95-2.35Z" fill="currentColor" stroke="none" />
  </svg>
);

export const CtrIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9 9l11 4-5 2-2 5-4-11Z" />
    <path d="M3 3v3M3 3h3" />
  </svg>
);

export const InsightIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 2v3M4.9 4.9l2.1 2.1M2 12h3M19 12h3M17 7l2.1-2.1" />
    <path d="M9 18h6M10 21h4" />
    <path d="M8 13a4 4 0 1 1 8 0c0 1.5-1 2.5-2 3.5H10c-1-1-2-2-2-3.5Z" />
  </svg>
);

export const MapIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
);

export const TargetIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);

export const SocialIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

export const ArrowLeftIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);
