import type { ReactNode } from "react";

interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/** One family of stroke icons on a 24×24 grid: 1.75px line, round caps. Decorative: always aria-hidden. */
function createIcon(displayName: string, paths: ReactNode) {
  const Icon = ({ size = 18, strokeWidth = 1.75, className }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
}

export const ArrowLeft = createIcon("ArrowLeft", <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>);
export const ArrowRight = createIcon("ArrowRight", <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>);
export const Undo = createIcon("Undo", <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>);
export const Flip = createIcon("Flip", <><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></>);
export const Send = createIcon("Send", <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>);
export const Check = createIcon("Check", <path d="M20 6 9 17l-5-5" />);
export const Close = createIcon("Close", <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const Play = createIcon("Play", <polygon points="6 3 20 12 6 21 6 3" />);
export const Stop = createIcon("Stop", <rect width="14" height="14" x="5" y="5" rx="2" />);
export const Retry = createIcon("Retry", <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></>);
export const Book = createIcon("Book", <><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></>);
export const Message = createIcon("Message", <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
export const Board = createIcon(
  "Board",
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 12h18" />
    <path d="M12 3v18" />
    <rect width="9" height="9" x="3" y="3" fill="currentColor" stroke="none" opacity="0.28" />
    <rect width="9" height="9" x="12" y="12" fill="currentColor" stroke="none" opacity="0.28" />
  </>,
);
export const Lock = createIcon("Lock", <><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>);
export const Search = createIcon("Search", <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>);
export const ChevronLeft = createIcon("ChevronLeft", <path d="m15 18-6-6 6-6" />);
export const More = createIcon(
  "More",
  <>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </>,
);
export const Plus = createIcon("Plus", <><path d="M5 12h14" /><path d="M12 5v14" /></>);
export const Upload = createIcon("Upload", <><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></>);
export const Copy = createIcon("Copy", <><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" /></>);
