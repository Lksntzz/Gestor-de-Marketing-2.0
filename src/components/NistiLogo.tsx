import React from "react";

interface NistiLogoProps {
  className?: string;
  variant?: "icon" | "full" | "badge" | "horizontal";
  size?: "sm" | "md" | "lg" | "xl";
  lightMode?: boolean;
}

/**
 * Exact Pixel & Vector Translation of "logo small.png":
 * Canvas: 200x200
 * 4 Water Droplets with white sticker base and drop shadows:
 * 
 * 1. Top Droplet (Pink #FF85B3 -> #FA6C9D):
 *    Spans roughly from (70, 15) to (140, 75).
 *    A smooth, rounded droplet pointing towards (145, 75), curved head at top-left.
 *
 * 2. Left Droplet (Cyan / Turquoise #6DD3D5 -> #46C4C6):
 *    Spans roughly from (15, 60) to (90, 125).
 *    Rounded head pointing out towards bottom-left, tail curving up towards (90, 60).
 *
 * 3. Bottom Droplet (Yellow #FFF37E -> #FFE552):
 *    Spans roughly from (70, 100) to (120, 190).
 *    Teardrop with pointed tail at top-right (88, 102), bulbous rounded base at (100, 185).
 *
 * 4. Right Droplet (Silver / Grey #BCC0C8 -> #9EA3AD):
 *    Spans roughly from (150, 60) to (190, 125).
 *    Curved kidney/droplet shape pointing downwards-left.
 */
export const NistiLogoIcon: React.FC<{ className?: string; size?: number }> = ({
  className = "w-9 h-9",
  size = 36,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform ${className}`}
    >
      <defs>
        {/* Soft shadow for depth under white border */}
        <filter id="nisti-sticker-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="1" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.2" />
        </filter>

        {/* 1. Pink Gradient */}
        <linearGradient id="pink-grad-exact" x1="60" y1="10" x2="145" y2="75" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFA6C6" />
          <stop offset="40%" stopColor="#FF85B3" />
          <stop offset="100%" stopColor="#F7689B" />
        </linearGradient>

        {/* 2. Cyan Gradient */}
        <linearGradient id="cyan-grad-exact" x1="15" y1="60" x2="90" y2="125" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#82E1E3" />
          <stop offset="50%" stopColor="#62CDCF" />
          <stop offset="100%" stopColor="#48BFC2" />
        </linearGradient>

        {/* 3. Yellow Gradient */}
        <linearGradient id="yellow-grad-exact" x1="70" y1="100" x2="120" y2="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFCE0" />
          <stop offset="45%" stopColor="#FFF27D" />
          <stop offset="100%" stopColor="#FCE058" />
        </linearGradient>

        {/* 4. Silver Grey Gradient */}
        <linearGradient id="grey-grad-exact" x1="150" y1="60" x2="190" y2="125" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D9DCE3" />
          <stop offset="50%" stopColor="#B4B8C1" />
          <stop offset="100%" stopColor="#989DA7" />
        </linearGradient>
      </defs>

      {/* Layer 1: White offset borders for all 4 droplets (exact sticker outline) */}
      <g filter="url(#nisti-sticker-shadow)">
        {/* Pink Droplet Background (White outline) */}
        <path
          d="M 68 12 C 90 2, 122 18, 142 55 C 148 66, 144 76, 137 78 C 127 80, 114 62, 92 42 C 72 25, 58 18, 68 12 Z"
          fill="#FFFFFF"
          transform="translate(-1, -1.5)"
        />
        {/* Cyan Droplet Background (White outline) */}
        <path
          d="M 90 58 C 65 65, 32 78, 18 102 C 6 122, 22 136, 42 130 C 58 126, 68 98, 86 74 C 94 62, 98 55, 90 58 Z"
          fill="#FFFFFF"
          transform="translate(-1.5, 0)"
        />
        {/* Yellow Droplet Background (White outline) */}
        <path
          d="M 88 102 C 91 122, 75 152, 75 170 C 75 190, 96 195, 110 186 C 122 178, 120 152, 108 128 C 100 112, 94 98, 88 102 Z"
          fill="#FFFFFF"
          transform="translate(-0.5, 1.5)"
        />
        {/* Grey Droplet Background (White outline) */}
        <path
          d="M 166 60 C 182 72, 192 94, 184 116 C 177 132, 160 134, 152 125 C 144 116, 158 96, 162 78 C 164 66, 162 58, 166 60 Z"
          fill="#FFFFFF"
          transform="translate(1.5, -1)"
        />
      </g>

      {/* Layer 2: Colored organic bodies */}
      {/* Top Pink Droplet */}
      <path
        d="M 68 12 C 90 2, 122 18, 142 55 C 148 66, 144 76, 137 78 C 127 80, 114 62, 92 42 C 72 25, 58 18, 68 12 Z"
        fill="url(#pink-grad-exact)"
      />

      {/* Left Cyan / Turquoise Droplet */}
      <path
        d="M 90 58 C 65 65, 32 78, 18 102 C 6 122, 22 136, 42 130 C 58 126, 68 98, 86 74 C 94 62, 98 55, 90 58 Z"
        fill="url(#cyan-grad-exact)"
      />

      {/* Bottom Yellow Droplet */}
      <path
        d="M 88 102 C 91 122, 75 152, 75 170 C 75 190, 96 195, 110 186 C 122 178, 120 152, 108 128 C 100 112, 94 98, 88 102 Z"
        fill="url(#yellow-grad-exact)"
      />

      {/* Right Grey Droplet */}
      <path
        d="M 166 60 C 182 72, 192 94, 184 116 C 177 132, 160 134, 152 125 C 144 116, 158 96, 162 78 C 164 66, 162 58, 166 60 Z"
        fill="url(#grey-grad-exact)"
      />
    </svg>
  );
};

export const NistiLogo: React.FC<NistiLogoProps> = ({
  className = "",
  variant = "horizontal",
  size = "md",
  lightMode = false,
}) => {
  const iconSizes = {
    sm: 30,
    md: 42,
    lg: 56,
    xl: 72,
  };

  const currentIconSize = iconSizes[size] || 42;

  if (variant === "icon") {
    return <NistiLogoIcon size={currentIconSize} className={className} />;
  }

  if (variant === "badge") {
    return (
      <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border border-[#263142] bg-[#151A22] shadow-sm ${className}`}>
        <NistiLogoIcon size={currentIconSize} />
        <div className="flex flex-col select-none">
          <span className="font-black text-xs tracking-wider text-white leading-none">
            NISTI PRINT
          </span>
          <span className="text-[10px] font-semibold text-[#7FD0D1] italic leading-tight mt-0.5 font-serif">
            papelaria criativa
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      <NistiLogoIcon size={currentIconSize} />
      <div className="flex flex-col justify-center">
        {/* Brand Text */}
        <div className="flex items-center tracking-[0.16em] font-black text-sm uppercase leading-none">
          <span className={lightMode ? "text-[#373C44]" : "text-white"}>NISTI</span>
          <span className={`ml-1.5 ${lightMode ? "text-[#373C44]" : "text-[#E2E8F0]"}`}>PRINT</span>
        </div>
        {/* Cursive Subtitle */}
        <span
          className="text-xs font-semibold text-[#7FD0D1] leading-none mt-1 tracking-wide"
          style={{
            fontFamily: "'Caveat', 'Dancing Script', 'Segoe Script', 'Brush Script MT', cursive",
          }}
        >
          papelaria criativa
        </span>
      </div>
    </div>
  );
};
