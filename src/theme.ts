/**
 * GameHub Arena CSS variable integration.
 *
 * At runtime the platform may inject custom properties such as --accent, --bg,
 * --text, etc. onto :root.  This module reads those variables and converts them
 * into formats that Phaser can consume (hex numbers for Graphics / Camera, CSS
 * colour strings for Text objects).
 *
 * Fallback values mirror the game's own palette so the game looks correct when
 * running outside of the GameHub Arena platform.
 */

export interface Theme {
  // Hex numbers for Phaser Graphics.fillStyle / lineStyle / setBackgroundColor
  bg: number;
  bgCard: number;
  accent: number;
  danger: number;

  // CSS colour strings for Phaser Text `color` property
  textStr: string;
  textDimStr: string;
  textMutedStr: string;
  accentStr: string;
  dangerStr: string;
}

/**
 * Read a CSS custom property from :root.
 * Returns `fallback` when the property is empty or the environment has no DOM.
 */
function getCSSVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return val || fallback;
}

/**
 * Parse any valid CSS colour string to a Phaser-compatible 24-bit hex number.
 * Uses a 1×1 canvas so it handles #rgb, #rrggbb, rgb(), hsl(), named colours, etc.
 * Falls back to parsing a bare #rrggbb string when the canvas is unavailable.
 */
function parseCSSColor(css: string): number {
  if (typeof document === 'undefined') {
    return parseInt(css.replace('#', ''), 16) || 0x000000;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return parseInt(css.replace('#', ''), 16) || 0x000000;
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return (d[0] << 16) | (d[1] << 8) | d[2];
}

/**
 * Build a Theme snapshot from the current CSS custom properties.
 * Call this once at the top of each scene's create() so all colours reflect
 * whatever palette the host platform has set at that moment.
 */
export function getTheme(): Theme {
  const accentStr  = getCSSVar('--accent',    '#e94560');
  const dangerStr  = getCSSVar('--danger',    '#e94560');
  const textStr    = getCSSVar('--text',      '#ffffff');
  const textDimStr = getCSSVar('--text-dim',  '#aaaacc');
  const textMutedStr = getCSSVar('--text-muted', '#8888aa');
  const bgStr      = getCSSVar('--bg',        '#0a0a1a');
  const bgCardStr  = getCSSVar('--bg-card',   '#1a1a3a');

  return {
    bg:           parseCSSColor(bgStr),
    bgCard:       parseCSSColor(bgCardStr),
    accent:       parseCSSColor(accentStr),
    danger:       parseCSSColor(dangerStr),
    textStr,
    textDimStr,
    textMutedStr,
    accentStr,
    dangerStr,
  };
}
