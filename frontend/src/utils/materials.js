// Material metadata for the frontend (colors, icons, descriptions).
// Authoritative data comes from the backend /materials endpoint at startup.

export const MATERIAL_ICONS = {
  straw:     '🥤',
  balsa:     '🪵',
  popsicle:  '🍦',
  aluminum:  '⚙️',
  foam:      '🧽',
  rubber:    '🔴',
};

export const MATERIAL_DESCRIPTIONS = {
  straw:    'Light & springy. Great for cushioning but snaps easily.',
  balsa:    'Ultra-light wood. Good strength-to-weight ratio.',
  popsicle: 'Classic stick. Stiff and sturdy for its weight.',
  aluminum: 'Heavy but nearly unbreakable. Use sparingly!',
  foam:     'Soft padding. Absorbs shock without breaking.',
  rubber:   'Very bouncy. Wraps and dampens vibration.',
};

export function formatMass(g) {
  return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g.toFixed(1)} g`;
}
