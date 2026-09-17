// Shared colours, fonts and the logical canvas size every scene draws into.
// The canvas is scaled to fit the stage, so scenes can use fixed coordinates.
const Theme = {
  width: 1000,
  height: 620,

  font: 'Menlo,Consolas,monospace',
  uiFont: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',

  bg: '#0d1117',
  surface: '#161b26',
  surface2: '#1e2533',
  grid: '#1b2130',
  line: '#2c3547',
  text: '#e6e9f2',
  muted: '#8b93a7',
  dim: '#566076',

  accent: '#7c9cff',
  cyan: '#22d3ee',
  green: '#4ade80',
  yellow: '#fbbf24',
  orange: '#fb923c',
  red: '#f87171',
  pink: '#f472b6',
  purple: '#c084fc',

  palette: ['#7c9cff', '#22d3ee', '#4ade80', '#fbbf24', '#fb923c', '#f472b6', '#c084fc', '#f87171'],

  colorFor(i) {
    return this.palette[((i % this.palette.length) + this.palette.length) % this.palette.length];
  },

  // Stable colour for any string/number value.
  colorForValue(v) {
    const s = String(v);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return this.colorFor(Math.abs(h));
  },
};
