// Accent colors come from AniList cover colors, which can be very dark or very
// light. These helpers adjust them so text and borders stay readable (WCAG AA).

import { DEFAULT_ACCENT } from './globals';

export const DARK_BACKGROUND = '#07111f';
export const LIGHT_BACKGROUND = '#f7faff';
const MIN_CONTRAST = 4.5;

type Rgb = [number, number, number];

export function parseHex(hex: string | null | undefined): Rgb | null {
  const value = (hex ?? '').trim().replace(/^#/, '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16)) as Rgb;
}

const toHex = (rgb: Rgb) =>
  `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

const channelLuminance = (channel: number) => {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

function relativeLuminance(rgb: Rgb) {
  const [r, g, b] = rgb.map(channelLuminance);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Rgb, b: Rgb) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const mix = (from: Rgb, to: Rgb, amount: number): Rgb =>
  from.map((channel, index) => channel + (to[index] - channel) * amount) as Rgb;

// Moves the color towards white (dark backgrounds) or black (light backgrounds)
// in small steps until it reaches the minimum contrast.
export function readableAccent(
  color: string | null | undefined,
  background: string = DARK_BACKGROUND,
  minimum = MIN_CONTRAST,
) {
  const base = parseHex(color) ?? (parseHex(DEFAULT_ACCENT) as Rgb);
  const backgroundRgb = parseHex(background) as Rgb;
  const target: Rgb = relativeLuminance(backgroundRgb) < 0.5 ? [255, 255, 255] : [0, 0, 0];

  for (let step = 0; step <= 20; step += 1) {
    const candidate = mix(base, target, step * 0.05);
    if (contrastRatio(candidate, backgroundRgb) >= minimum) return toHex(candidate);
  }
  return toHex(target);
}

// Black or white, whichever reads better on top of the given color.
export function textOn(color: string | null | undefined) {
  const rgb = parseHex(color) ?? (parseHex(DEFAULT_ACCENT) as Rgb);
  return contrastRatio(rgb, [0, 0, 0]) >= contrastRatio(rgb, [255, 255, 255])
    ? '#000000'
    : '#ffffff';
}

export const accentFor = (color: string | null | undefined, theme: 'dark' | 'light' = 'dark') =>
  readableAccent(color, theme === 'light' ? LIGHT_BACKGROUND : DARK_BACKGROUND);
