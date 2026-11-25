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
