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

export const CompareIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" />
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

export const KanbanIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="9.5" y="4" width="5" height="10" rx="1.5" />
    <rect x="16" y="4" width="5" height="13" rx="1.5" />
  </svg>
);
