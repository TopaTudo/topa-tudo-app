import React from 'react';

export interface LogoProps {
  variant?: 'horizontal' | 'vertical' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'dark' | 'light';
  className?: string;
  subtitle?: string;
}

/**
 * Gera o SVG vetorial do emblema (Chave Inglesa + Raio + Escudo Hexagonal)
 */
export function renderLogoIconSvg({
  size = 48,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Emblema Topa Tudo"
    >
      <defs>
        {/* Gradiente do Escudo de Fundo */}
        <linearGradient id="shieldGrad" x1="10" y1="5" x2="90" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        {/* Gradiente da Borda do Escudo */}
        <linearGradient id="borderGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>

        {/* Gradiente do Raio Dourado */}
        <linearGradient id="lightningGrad" x1="55" y1="12" x2="35" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>

        {/* Gradiente da Chave Prateada/Azulada */}
        <linearGradient id="wrenchGrad" x1="25" y1="20" x2="75" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="50%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>

        {/* Sombra Dinâmica */}
        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Escudo Base Hexagonal Estilizado */}
      <path
        d="M50 6 L86 24 V62 L50 94 L14 62 V24 Z"
        fill="url(#shieldGrad)"
        stroke="url(#borderGrad)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* Linhas Técnicas de Precisão no Escudo */}
      <path
        d="M50 12 L78 28 V58 L50 84 L22 58 V28 Z"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="1"
        strokeOpacity="0.25"
      />

      {/* Chave Inglesa Industrial Cruzada */}
      <g transform="rotate(-30 50 50)">
        {/* Haste da Chave */}
        <rect
          x="45"
          y="28"
          width="10"
          height="48"
          rx="5"
          fill="url(#wrenchGrad)"
        />
        {/* Cabeça Aberta da Chave Inglesa (Topo) */}
        <path
          d="M38 18 C38 12 44 8 50 8 C56 8 62 12 62 18 C62 23 58 26 58 30 L42 30 C42 26 38 23 38 18 Z"
          fill="url(#wrenchGrad)"
        />
        {/* Corte Hexagonal da Chave */}
        <path
          d="M46 8 L54 8 L55 18 L50 21 L45 18 Z"
          fill="#0f172a"
        />
        {/* Orifício da Base da Chave */}
        <circle cx="50" cy="74" r="3.5" fill="#0f172a" />
      </g>

      {/* Raio Dinâmico com Brilho Dourado */}
      <path
        d="M58 14 L34 46 H48 L42 86 L68 44 H52 L58 14 Z"
        fill="url(#lightningGrad)"
        filter="url(#logoGlow)"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Ponto Central de Energia */}
      <circle cx="50" cy="50" r="2.5" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

/**
 * Retorna string SVG pura para injeção HTML direta (impressão/PDF ou offline)
 */
export function getLogoSvgRaw(theme: 'dark' | 'light' = 'dark'): string {
  const textColor = theme === 'dark' ? '#ffffff' : '#0f172a';
  const subColor = theme === 'dark' ? '#93c5fd' : '#d97706';
  const tagColor = theme === 'dark' ? '#f59e0b' : '#b45309';

  return `<svg viewBox="0 0 340 76" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;height:auto;max-height:100%;">
    <defs>
      <linearGradient id="pShieldGrad" x1="8" y1="4" x2="68" y2="72" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#1e3a8a" />
        <stop offset="50%" stopColor="#0f172a" />
        <stop offset="100%" stopColor="#020617" />
      </linearGradient>
      <linearGradient id="pBorderGrad" x1="0" y1="0" x2="76" y2="76" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
      <linearGradient id="pLightning" x1="42" y1="8" x2="28" y2="68" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
      <linearGradient id="pWrench" x1="20" y1="15" x2="58" y2="60" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="60%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#64748b" />
      </linearGradient>
    </defs>

    <!-- Ícone Escudo -->
    <g transform="translate(4, 2)">
      <path d="M36 5 L64 19 V51 L36 71 L8 51 V19 Z" fill="url(#pShieldGrad)" stroke="url(#pBorderGrad)" stroke-width="2.6" stroke-linejoin="round" />
      <g transform="rotate(-30 36 38)">
        <rect x="32" y="20" width="8" height="38" rx="4" fill="url(#pWrench)" />
        <path d="M26 13 C26 8 31 5 36 5 C41 5 46 8 46 13 C46 17 43 19 43 22 L29 22 C29 19 26 17 26 13 Z" fill="url(#pWrench)" />
        <path d="M33 5 L39 5 L40 13 L36 15 L32 13 Z" fill="#0f172a" />
        <circle cx="36" cy="54" r="2.8" fill="#0f172a" />
      </g>
      <path d="M42 12 L24 37 H35 L30 65 L50 34 H38 L42 12 Z" fill="url(#pLightning)" stroke="#ffffff" stroke-width="0.9" stroke-linejoin="round" />
    </g>

    <!-- Tipografia Oficial -->
    <g transform="translate(84, 16)">
      <text x="0" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="900" letter-spacing="2.2" fill="${textColor}">TOPA TUDO</text>
      <text x="0" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="9.5" font-weight="700" letter-spacing="2" fill="${subColor}">MANUTENÇÃO &amp; REFORMAS</text>
      <circle cx="166" cy="43" r="2" fill="${tagColor}" />
      <text x="174" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="8.5" font-weight="800" letter-spacing="1.5" fill="${tagColor}">SERVIÇOS</text>
    </g>
  </svg>`;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  theme = 'dark',
  className = '',
  subtitle = 'Manutenção & Reformas',
}) => {
  const sizePixelMap = {
    xs: 28,
    sm: 36,
    md: 46,
    lg: 58,
    xl: 74,
  };

  const iconPx = sizePixelMap[size] || 46;

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {renderLogoIconSvg({ size: iconPx })}
      </div>
    );
  }

  const isLight = theme === 'light';

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="relative mb-2">
          {renderLogoIconSvg({ size: iconPx * 1.2 })}
        </div>
        <div className="space-y-0.5">
          <h1
            className={`font-black tracking-wider leading-none ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
            style={{ fontSize: iconPx * 0.52 }}
          >
            TOPA TUDO
          </h1>
          <p
            className={`font-extrabold uppercase tracking-widest ${
              isLight ? 'text-amber-700' : 'text-amberAlert-500'
            }`}
            style={{ fontSize: Math.max(10, iconPx * 0.2) }}
          >
            {subtitle}
          </p>
        </div>
      </div>
    );
  }

  // Horizontal variant (default)
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="shrink-0 relative">
        {renderLogoIconSvg({ size: iconPx })}
      </div>
      <div className="flex flex-col leading-tight select-none">
        <span
          className={`font-black tracking-wider uppercase ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}
          style={{ fontSize: Math.max(16, iconPx * 0.44) }}
        >
          TOPA TUDO
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`font-bold tracking-widest uppercase ${
              isLight ? 'text-blue-900' : 'text-blue-200'
            }`}
            style={{ fontSize: Math.max(9, iconPx * 0.2) }}
          >
            {subtitle}
          </span>
          <span
            className={`w-1 h-1 rounded-full ${
              isLight ? 'bg-amber-600' : 'bg-amberAlert-500'
            }`}
          />
          <span
            className={`font-extrabold text-[9px] tracking-wider uppercase ${
              isLight ? 'text-amber-700' : 'text-amberAlert-400'
            }`}
          >
            Oficial
          </span>
        </div>
      </div>
    </div>
  );
};
