/**
 * Category colour is data: a coach picks it, so no fixed foreground is safe.
 * White on the seeded palette measured 2.78:1 on Transition, 3.16:1 on Offense
 * and 3.68:1 on Turnovers, all under the 4.5 bar for text.
 *
 * Choosing black or white per colour, whichever has the higher ratio, clears
 * every colour the app ships: the worst case across all eighteen presets, both
 * the original values and the ones plan 023 re-hued, is 4.59:1.
 *
 * Worth knowing before touching the presets again: 023 optimised them for
 * CIELAB separation, not for contrast, and it cost some headroom. Offense went
 * from 6.64:1 to 4.59:1 and Transition from 7.56:1 to 5.94:1. Both still pass,
 * but there is much less room than there looks.
 */

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function ratio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The readable ink for text sitting on `background`, as a hex string.
 * Falls back to white for anything that is not a 6-digit hex, which is what
 * the colour picker always produces.
 */
export function inkOn(background: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(background)) return "#ffffff";
  const bg = luminance(background);
  return ratio(1, bg) >= ratio(0, bg) ? "#ffffff" : "#000000";
}
