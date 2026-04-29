/**
 * ServiceIcon · logos das apps de mensageria/email.
 *
 * Mantêm as cores da marca (reconhecimento imediato). O casing à volta é
 * tratado pelo container no Sidebar — squircle uniformizado + tint subtil
 * da cor brand + ring do accent do tema quando ativo.
 *
 * Refinamento 2026-04-24: SVGs mais fiéis aos logos oficiais (Slack, Gmail,
 * Outlook) e export de `getBrandColor()` para o tinting do container.
 */

interface Props {
  icon: string;
  className?: string;
}

export function ServiceIcon({ icon, className }: Props) {
  const svg = ICONS[icon] ?? GENERIC;
  return (
    <svg
      viewBox="0 0 24 24"
      className={`app-icon ${className ?? ""}`.trim()}
      aria-hidden="true"
      focusable="false"
    >
      {svg}
    </svg>
  );
}

/**
 * Cor dominante de cada marca — usada como tint subtil do container
 * na sidebar (baixa opacidade) para dar assinatura brand sem perder a
 * coesão do tema do Cocito.
 */
export function getBrandColor(icon: string): string {
  return BRAND_COLORS[icon] ?? "#6b7280";
}

const BRAND_COLORS: Record<string, string> = {
  slack: "#611F69",
  gmail: "#EA4335",
  outlook: "#0078D4",
  proton: "#6D4AFF",
  fastmail: "#0067B9",
  whatsapp: "#25D366",
  telegram: "#0088CC",
  discord: "#5865F2",
  teams: "#5059C9",
  "google-chat": "#00AC47",
  "google-meet": "#00897B",
  messenger: "#0084FF",
  linkedin: "#0A66C2",
  x: "#000000",
  instagram: "#DD2A7B",
};

// ─── SVGs dos logos (fiéis mas simplificados para 24×24) ────────────

const ICONS: Record<string, JSX.Element> = {
  /* Slack · 4 peças em cruz com extremidades arredondadas (oficial) */
  slack: (
    <g>
      {/* pink (top) */}
      <path
        d="M9 3.75a1.5 1.5 0 013 0V9a1.5 1.5 0 01-3 0V3.75zM6 9a1.5 1.5 0 01-1.5 1.5H3a1.5 1.5 0 010-3h3V9z"
        fill="#E01E5A"
      />
      <path d="M6 7.5a1.5 1.5 0 011.5-1.5H9v3H7.5A1.5 1.5 0 016 7.5z" fill="#E01E5A" />
      {/* yellow (right) */}
      <path
        d="M20.25 15a1.5 1.5 0 010 3H15a1.5 1.5 0 010-3h5.25zM15 18a1.5 1.5 0 01-1.5-1.5v-3a1.5 1.5 0 013 0V18z"
        fill="#ECB22E"
      />
      <path d="M16.5 18a1.5 1.5 0 011.5 1.5V21a1.5 1.5 0 01-3 0v-1.5A1.5 1.5 0 0116.5 18z" fill="#ECB22E" />
      {/* green (bottom) */}
      <path
        d="M15 20.25a1.5 1.5 0 01-3 0V15a1.5 1.5 0 013 0v5.25zM18 15a1.5 1.5 0 011.5-1.5H21a1.5 1.5 0 010 3h-3V15z"
        fill="#2EB67D"
      />
      <path d="M18 16.5a1.5 1.5 0 01-1.5 1.5H15v-3h1.5A1.5 1.5 0 0118 16.5z" fill="#2EB67D" />
      {/* blue (left) */}
      <path
        d="M3.75 9a1.5 1.5 0 010-3H9a1.5 1.5 0 010 3H3.75zM9 6a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-3 0V6z"
        fill="#36C5F0"
      />
      <path d="M7.5 6A1.5 1.5 0 016 4.5V3a1.5 1.5 0 013 0v1.5A1.5 1.5 0 017.5 6z" fill="#36C5F0" />
    </g>
  ),

  /* Gmail · envelope com "M" tricolor */
  gmail: (
    <g>
      <path
        d="M3 6.5C3 5.67 3.67 5 4.5 5h1.75L12 9.6 17.75 5h1.75c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5H18V10l-6 4.5L6 10v9H4.5C3.67 19 3 18.33 3 17.5v-11z"
        fill="#EA4335"
      />
      <path d="M3 6.5L12 13l9-6.5V8l-9 6.5L3 8V6.5z" fill="#C5221F" />
      <path d="M18 10v9h1.5c.83 0 1.5-.67 1.5-1.5V6.5l-3 3z" fill="#FBBC04" />
      <path d="M3 6.5v11c0 .83.67 1.5 1.5 1.5H6V10l-3-3.5z" fill="#34A853" />
      <path d="M6 10l6 4.5L18 10V5h-.25L12 9.6 6.25 5H6v5z" fill="#4285F4" />
    </g>
  ),

  /* Outlook · quadrado azul com envelope branco + letra O */
  outlook: (
    <g>
      <rect x="2" y="4" width="20" height="16" rx="2.2" fill="#0078D4" />
      <ellipse cx="8.5" cy="12" rx="3.5" ry="4.3" fill="#fff" />
      <ellipse cx="8.5" cy="12" rx="1.7" ry="2.4" fill="#0078D4" />
      <rect x="13.3" y="8.8" width="6.4" height="6.4" rx="0.6" fill="#50D9FF" />
      <path d="M13.5 9.2l3 2.6 3.1-2.6" stroke="#fff" strokeWidth="0.7" fill="none" />
    </g>
  ),

  /* Proton · envelope com padrão vertical */
  proton: (
    <g>
      <rect x="2" y="4" width="20" height="16" rx="2.2" fill="#6D4AFF" />
      <path d="M5 8l7 5 7-5v2l-7 5-7-5V8z" fill="#fff" />
      <path d="M5 10v8h2V12l5 3.5L17 12v6h2v-8l-7 5-7-5z" fill="#fff" opacity="0.85" />
    </g>
  ),

  /* Fastmail · envelope azul com bandeira */
  fastmail: (
    <g>
      <rect x="2" y="4" width="20" height="16" rx="2.2" fill="#0067B9" />
      <path d="M5 10h14M5 14h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 14l3 0 -2 2 2 0" stroke="#4ECBFF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
  ),

  /* WhatsApp · bolha verde com fone branco */
  whatsapp: (
    <g>
      <path
        d="M12 2.5c-5.3 0-9.6 4.3-9.6 9.6 0 1.7.4 3.3 1.2 4.7L2 21.5l4.9-1.3c1.4.8 3 1.2 4.6 1.2h.1c5.3 0 9.6-4.3 9.6-9.6 0-2.5-1-4.9-2.8-6.8-1.8-1.8-4.2-2.5-6.4-2.5z"
        fill="#25D366"
      />
      <path
        d="M16.7 13.9c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.1-.5 0c-.7-.4-1.4-.8-2-1.5-.5-.6-.9-1.2-1-1.5-.1-.2 0-.3.1-.5.1-.1.2-.3.3-.4.1-.1.1-.2.2-.4.1-.1 0-.3 0-.4s-.6-1.4-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3s-.8.8-.8 2 .8 2.3 1 2.4c.1.2 1.7 2.5 4 3.5 1.5.6 2.1.7 2.9.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.5-.3z"
        fill="#fff"
      />
    </g>
  ),

  /* Telegram · círculo azul com avião de papel */
  telegram: (
    <g>
      <circle cx="12" cy="12" r="10" fill="#0088CC" />
      <path
        d="M16.6 8.2l-1.6 7.6c-.1.5-.5.6-.9.4l-2.6-1.9-1.3 1.2c-.1.1-.3.3-.5.3l.2-2.7 4.9-4.4c.2-.2-.1-.3-.3-.1L8.4 12l-2.6-.8c-.6-.2-.6-.6.1-.9l9.8-3.8c.5-.2.9.1.9.7z"
        fill="#fff"
      />
    </g>
  ),

  /* Discord · mascote */
  discord: (
    <g>
      <path
        d="M19.5 5.5A15 15 0 0015.5 4l-.35.65a12.5 12.5 0 00-6.3 0L8.5 4a15 15 0 00-4 1.5C2 9 1.5 12.5 1.7 16c1.6 1.2 3.3 2 4.9 2.5l.9-1.4c-.85-.3-1.7-.75-2.45-1.3l.55-.4a10.5 10.5 0 008.8 0l.55.4c-.75.55-1.6 1-2.45 1.3l.9 1.4c1.6-.5 3.3-1.3 4.9-2.5.35-4.2-.5-7.7-2.8-10.5z"
        fill="#5865F2"
      />
      <ellipse cx="9" cy="12.5" rx="1.4" ry="1.7" fill="#fff" />
      <ellipse cx="15" cy="12.5" rx="1.4" ry="1.7" fill="#fff" />
    </g>
  ),

  /* Microsoft Teams · T com badge */
  teams: (
    <g>
      <rect x="2" y="5" width="14" height="14" rx="1.8" fill="#5059C9" />
      <rect x="5" y="9" width="8" height="1.5" fill="#fff" />
      <rect x="8.25" y="9" width="1.5" height="7" fill="#fff" />
      <circle cx="18.5" cy="8.5" r="2.8" fill="#7B83EB" />
      <rect x="14.5" y="10.5" width="8" height="8" rx="1.8" fill="#7B83EB" />
      <rect x="16.2" y="12.8" width="4.6" height="1" fill="#fff" />
      <rect x="18" y="12.8" width="1" height="4.5" fill="#fff" />
    </g>
  ),

  /* Google Chat · bolha verde com "chat corner" */
  "google-chat": (
    <g>
      <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-9l-5 4v-4H5a2 2 0 01-2-2V5z" fill="#00AC47" />
      <circle cx="8.5" cy="10" r="1.3" fill="#fff" />
      <circle cx="12" cy="10" r="1.3" fill="#fff" />
      <circle cx="15.5" cy="10" r="1.3" fill="#fff" />
    </g>
  ),

  /* Google Meet · câmara verde-teal */
  "google-meet": (
    <g>
      <rect x="2.5" y="6.5" width="13" height="11" rx="2" fill="#00897B" />
      <path d="M15.5 10.2l5.2-2.4a.6.6 0 01.8.55v7.3a.6.6 0 01-.85.55l-5.15-2.4z" fill="#00897B" />
    </g>
  ),

  /* Messenger · bolha com raio */
  messenger: (
    <g>
      <path
        d="M12 2.5c-5.3 0-9.5 4-9.5 9 0 2.8 1.3 5.3 3.4 7v3.5l3.2-1.8c.9.2 1.9.4 2.9.4 5.3 0 9.5-4 9.5-9s-4.2-9.1-9.5-9.1z"
        fill="url(#mg-grad)"
      />
      <defs>
        <linearGradient id="mg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00B2FF" />
          <stop offset="100%" stopColor="#006AFF" />
        </linearGradient>
      </defs>
      <path d="M6.5 13.5l3.9-4 2.5 2 4.6-4-4.1 4.3-2.5-2z" fill="#fff" />
    </g>
  ),

  /* LinkedIn · in azul */
  linkedin: (
    <g>
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#0A66C2" />
      <rect x="5" y="9.5" width="3" height="8.5" fill="#fff" />
      <circle cx="6.5" cy="6.5" r="1.7" fill="#fff" />
      <path
        d="M11 9.5h2.7v1.3c.7-.95 1.7-1.5 2.9-1.5 2 0 3.1 1.3 3.1 3.6V18h-3v-4.3c0-1.1-.5-1.7-1.5-1.7s-1.5.6-1.5 1.7V18h-3v-8.5z"
        fill="#fff"
      />
    </g>
  ),

  /* X · ícone preto com X branco */
  x: (
    <g>
      <rect x="2" y="2" width="20" height="20" rx="3.6" fill="#000" />
      <path
        d="M15.3 6h2.1l-4.55 5.2 5.35 7.1h-4.2l-3.3-4.3-3.75 4.3H4.75l4.85-5.55L4.5 6h4.3l2.95 3.9L15.3 6zm-.75 11h1.2L8.25 7h-1.3l7.6 10z"
        fill="#fff"
      />
    </g>
  ),

  /* Instagram · quadrado gradiente */
  instagram: (
    <g>
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F58529" />
          <stop offset="50%" stopColor="#DD2A7B" />
          <stop offset="100%" stopColor="#8134AF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5.4" fill="url(#ig-grad)" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.6" r="1" fill="#fff" />
    </g>
  ),
};

const GENERIC = (
  <g>
    <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" opacity="0.15" />
    <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.5" />
  </g>
);
