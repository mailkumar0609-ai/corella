// Small line icons (24px grid, 1.8 stroke) used in navigation.
type P = { size?: number };
const S = ({ size = 20, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const IconHome = (p: P) => <S {...p}><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" /></S>;
export const IconAgents = (p: P) => <S {...p}><rect x="5" y="7" width="14" height="11" rx="3" /><path d="M12 7V4M9 12h.01M15 12h.01M9.5 15.5h5" /></S>;
export const IconRuns = (p: P) => <S {...p}><path d="M5 5h14M5 12h9M5 19h5" /><path d="m15 17 2 2 4-4" /></S>;
export const IconKey = (p: P) => <S {...p}><circle cx="8" cy="15" r="3.5" /><path d="m10.5 12.5 8-8M16 7l2.5 2.5M14 9l2 2" /></S>;
export const IconCard = (p: P) => <S {...p}><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M3.5 10h17M7 14.5h3" /></S>;
export const IconOut = (p: P) => <S {...p}><path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9" /></S>;
export const IconDownload = (p: P) => <S {...p}><path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" /></S>;
export const IconBack = (p: P) => <S {...p}><path d="M15 6l-6 6 6 6" /></S>;

/** Corella mark: an open ring (the bird's eye ring) with a blush dot. */
export const Mark = ({ size = 28 }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#1b2140" />
    <path d="M21.6 10.4A8 8 0 1 0 21.6 21.6" fill="none" stroke="#f5b5b0" strokeWidth="3.6" strokeLinecap="round" />
    <circle cx="23.2" cy="16" r="2.3" fill="#f3f4f8" />
  </svg>
);
