type AppLogoProps = {
  fill?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function AppLogo({ fill = "rgba(169, 255, 83, 0.8)", size = 40, strokeWidth = 1, className }: AppLogoProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" className={className}>
      <title>Raw Agents</title>

      {/* Antenna */}
      <line x1="12" y1="2" x2="12" y2="5" stroke={fill} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="12" cy="2" r="1" fill={fill} />

      {/* Head */}
      <rect x="4" y="5" width="16" height="12" rx="3" stroke={fill} strokeWidth={strokeWidth} />

      {/* Eyes */}
      <circle cx="9" cy="10" r="1.5" fill={fill} />
      <circle cx="15" cy="10" r="1.5" fill={fill} />

      {/* Mouth */}
      <path d="M9 14h6" stroke={fill} strokeWidth={strokeWidth} strokeLinecap="round" />

      {/* Ears */}
      <rect x="1" y="9" width="2" height="4" rx="1" fill={fill} opacity="0.6" />
      <rect x="21" y="9" width="2" height="4" rx="1" fill={fill} opacity="0.6" />
    </svg>
  );
}
