import { describe, expect, it } from 'vitest';
import {
  DARK_BACKGROUND,
  LIGHT_BACKGROUND,
  accentFor,
  contrastRatio,
  parseHex,
  readableAccent,
  textOn,
} from './color';

const ratio = (a: string, b: string) =>
  contrastRatio(parseHex(a) as [number, number, number], parseHex(b) as [number, number, number]);

describe('color', () => {
  it('parses short and long hex colors', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('e4a15d')).toEqual([228, 161, 93]);
    expect(parseHex('nope')).toBeNull();
  });

  it('keeps colors that already read well', () => {
    expect(readableAccent('#ffd166')).toBe('#ffd166');
  });

  it('lightens dark cover colors on the dark theme', () => {
    const accent = readableAccent('#1a0f35', DARK_BACKGROUND);
    expect(ratio(accent, DARK_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
  });

  it('darkens light cover colors on the light theme', () => {
    const accent = accentFor('#f1e4a0', 'light');
    expect(ratio(accent, LIGHT_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back to the default accent for missing colors', () => {
    expect(ratio(accentFor(null), DARK_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
  });

  it('picks black or white text on top of a color', () => {
    expect(textOn('#ffd166')).toBe('#000000');
    expect(textOn('#102a46')).toBe('#ffffff');
  });
});
