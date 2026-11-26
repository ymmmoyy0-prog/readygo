/** 線條圖示（currentColor），24×24 */
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "square" as const, "aria-hidden": true };

export const ClockIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2.5" />
  </svg>
);

export const BusIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <rect x="4" y="3" width="16" height="15" />
    <path d="M4 11h16M7 18v3M17 18v3" />
    <path d="M7.5 14.5h1M15.5 14.5h1" />
  </svg>
);

export const TrainIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M6 3h12v13H6z" />
    <path d="M6 10h12M9 6.5h6" />
    <path d="M8 16l-3 5M16 16l3 5M7 19h10" />
  </svg>
);

export const CarIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M3 16v-4l2.5-6h13L21 12v4z" />
    <path d="M3 12h18M6 16v3M18 16v3" />
    <path d="M6.5 14h1M16.5 14h1" />
  </svg>
);

export const ListIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 5.5l1 1 2-2M4 11.5l1 1 2-2M4 17.5l1 1 2-2" />
  </svg>
);

export const PlusIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const SpeakerIcon = ({ size = 24, off = false }: { size?: number; off?: boolean }) => (
  <svg {...base} width={size} height={size}>
    <path d="M4 9h4l5-4v14l-5-4H4z" />
    {off ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11" />}
  </svg>
);

export const SunIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const SkipIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M5 5l9 7-9 7z" />
    <path d="M18 5v14" />
  </svg>
);

export const ChartIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M4 20h16M4 20V4" />
    <path d="M7 16l4-5 3 3 5-7" />
  </svg>
);

export const PencilIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M4 20l1-5L16 4l4 4L9 19z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const TrashIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
);

export const ShareUpIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M8 9H5v11h14V9h-3" />
    <path d="M12 3v12M8 7l4-4 4 4" />
  </svg>
);

export const AddSquareIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <rect x="4" y="4" width="16" height="16" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

export const LinkIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  </svg>
);

export const PhoneIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <rect x="7" y="2" width="10" height="20" />
    <path d="M11 18h2" />
  </svg>
);

export const PlayIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M7 5l12 7-12 7z" />
  </svg>
);

export const RefreshIcon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M20 12a8 8 0 11-2.3-5.6" />
    <path d="M20 4v5h-5" />
  </svg>
);
