import { Shade } from './types';

/**
 * A small local shade set used only to drive the Phase 1 recolor spike tray.
 * The real catalogue (~8,000 shades across Asian Paints / Berger / Nerolac /
 * Dulux / Nippon) is served by `GET /api/shades` and gets wired in the shade
 * library task — this list is a placeholder, not the source of truth.
 */
export const SAMPLE_SHADES: Shade[] = [
  { code: '7157', name: 'Morning Glow', hex: '#e9d6b0', brand: 'Asian Paints', family: 'Yellows' },
  { code: '8071', name: 'Misty Fog', hex: '#c9cdc7', brand: 'Asian Paints', family: 'Neutrals' },
  { code: '9142', name: 'Terracotta Rise', hex: '#c06a4d', brand: 'Berger', family: 'Reds' },
  { code: '2131', name: 'Sage Whisper', hex: '#9fb79a', brand: 'Nerolac', family: 'Greens' },
  { code: '4408', name: 'Indigo Hour', hex: '#4d5b83', brand: 'Dulux', family: 'Blues' },
  { code: '6620', name: 'Electric Iris', hex: '#7c5cff', brand: 'Asian Paints', family: 'Purples' },
  { code: '1180', name: 'Warm Plaster', hex: '#d8c3a5', brand: 'Nippon', family: 'Neutrals' },
  { code: '3355', name: 'Deep Teal', hex: '#2f6f6a', brand: 'Berger', family: 'Greens' },
  { code: '5090', name: 'Rose Clay', hex: '#c98b86', brand: 'Dulux', family: 'Reds' },
  { code: '7788', name: 'Slate Dusk', hex: '#5a5d66', brand: 'Nerolac', family: 'Greys' },
  { code: '2044', name: 'Butter Cream', hex: '#f0e2c0', brand: 'Asian Paints', family: 'Yellows' },
  { code: '6612', name: 'Ocean Depth', hex: '#35567d', brand: 'Nippon', family: 'Blues' },
];
