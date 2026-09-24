const PATHS = {
  calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  today: 'M3 12h2M19 12h2M5 8v8M19 8v8M8 6v12M16 6v12M8 12h8',
  templates: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  menu: 'M12 5h.01M12 12h.01M12 19h.01',
  back: 'M15 18l-6-6 6-6',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={name === 'menu' ? 3 : 2}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
