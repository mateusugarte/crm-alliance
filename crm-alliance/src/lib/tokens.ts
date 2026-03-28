/**
 * Alliance Design Tokens — fonte única de verdade para cores e valores visuais.
 * Use estas constantes em qualquer lugar que precise de valores em JS/TS
 * (ex: Chart.js, inline styles em bibliotecas de terceiros que não leem CSS).
 *
 * Para Tailwind: prefira as classes geradas pelos tokens do globals.css
 * (bg-alliance-blue, text-alliance-dark, etc.).
 */

// ---------------------------------------------------------------------------
// Cores Alliance
// ---------------------------------------------------------------------------

export const ALLIANCE_COLORS = {
  /** Azul principal — links, CTAs, ícones ativos */
  blue: '#1E90FF',
  /** Azul escuro — fundo da sidebar, cards featured */
  dark: '#0A2EAD',
  /** Azul médio — hover states, gradientes */
  mid: '#1565C0',
  /** Cinza claro — fundo de cards */
  card: '#F0F0F0',
  /** Cinza coluna — fundo das colunas do Kanban */
  col: '#E8E8E8',
  /** Cinza input — fundo de campos de texto */
  input: '#D9D9D9',
  /** Cinza chat — fundo da área de mensagens */
  chat: '#CCCCCC',
} as const

// ---------------------------------------------------------------------------
// Cores de badges
// ---------------------------------------------------------------------------

export const BADGE_COLORS = {
  joao: '#FF6B00',
  mateus: '#3D3D3D',
  ia: '#0A2EAD',
  quente: '#FF4500',
  morno: '#FF8C00',
  frio: '#1E90FF',
} as const

// ---------------------------------------------------------------------------
// Helpers para Chart.js e outros contextos que não leem CSS vars
// ---------------------------------------------------------------------------

/**
 * Retorna a cor Alliance blue lida do CSS custom property em runtime.
 * Usa como fallback o valor hardcoded caso `document` não esteja disponível (SSR).
 */
export function getAllianceBlue(): string {
  if (typeof document === 'undefined') return ALLIANCE_COLORS.blue
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-alliance-blue')
    .trim()
  return value || ALLIANCE_COLORS.blue
}

/**
 * Retorna a cor Alliance dark lida do CSS custom property em runtime.
 */
export function getAllianceDark(): string {
  if (typeof document === 'undefined') return ALLIANCE_COLORS.dark
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-alliance-dark')
    .trim()
  return value || ALLIANCE_COLORS.dark
}

// ---------------------------------------------------------------------------
// Utilitário de transparência — substitui `color + '18'` (hex frágil)
// ---------------------------------------------------------------------------

/**
 * Converte um hex (3 ou 6 dígitos) para rgba com alpha fornecido.
 *
 * @example
 * hexToRgba('#FF6B00', 0.09) // 'rgba(255, 107, 0, 0.09)'
 * hexToRgba('#F60', 0.1)     // 'rgba(255, 102, 0, 0.10)'
 */
export function hexToRgba(hex: string, alpha: number): string {
  // Remove '#' e normaliza para 6 dígitos
  let clean = hex.replace('#', '')
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (clean.length !== 6) return `rgba(0,0,0,${alpha})`

  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ---------------------------------------------------------------------------
// Alturas determinísticas para ChartsSkeleton (evita Math.random())
// ---------------------------------------------------------------------------

/** Array fixo de alturas percentuais para barras do skeleton de gráficos.
 *  Determinístico: evita flash de layout entre SSR e hydration. */
export const CHART_SKELETON_HEIGHTS = [65, 45, 80, 55, 70, 40, 90] as const
