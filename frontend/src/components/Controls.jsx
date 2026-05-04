import React from 'react';
import { formatMass } from '../utils/materials.js';

const s = {
  panel: {
    background: '#1a1d2e',
    borderTop: '1px solid #2d3155',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#7c85b3',
  },
  value: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e2e8f0',
  },
  slider: {
    accentColor: '#7c85ff',
    cursor: 'pointer',
    width: 160,
  },
  btn: (variant) => ({
    padding: '10px 24px',
    borderRadius: 10,
    border: 'none',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.15s',
    ...(variant === 'primary' ? {
      background: 'linear-gradient(135deg, #7c85ff, #a78bfa)',
      color: '#fff',
      boxShadow: '0 4px 20px rgba(124,133,255,0.4)',
    } : variant === 'danger' ? {
      background: '#2d1f1f',
      color: '#f87171',
      border: '1px solid #7f1d1d',
    } : {
      background: '#242740',
      color: '#8891b2',
    }),
  }),
  divider: { width: 1, height: 40, background: '#2d3155' },
  result: (survived) => ({
    padding: '8px 16px',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    background: survived ? '#14532d' : '#7f1d1d',
    color: survived ? '#86efac' : '#fca5a5',
    border: `1px solid ${survived ? '#166534' : '#991b1b'}`,
  }),
};

export default function Controls({
  dropHeight, onDropHeightChange,
  onSimulate, onReset, onClear,
  isSimulating, simResult, totalMassG,
}) {
  const canvasH = 600;
  const dropM = ((dropHeight / 200)).toFixed(1);  // 200 px/m

  return (
    <div style={s.panel}>
      {/* Drop height */}
      <div style={s.group}>
        <span style={s.label}>Drop Height</span>
        <span style={s.value}>{dropM} m</span>
        <input
          type="range" min={80} max={canvasH - 150} step={10}
          value={dropHeight}
          onChange={(e) => onDropHeightChange(Number(e.target.value))}
          style={s.slider}
          disabled={isSimulating}
        />
      </div>

      <div style={s.divider} />

      {/* Structure mass */}
      <div style={s.group}>
        <span style={s.label}>Structure Mass</span>
        <span style={s.value}>{formatMass(totalMassG)}</span>
      </div>

      <div style={s.divider} />

      {/* Buttons */}
      <button style={s.btn('primary')} onClick={onSimulate} disabled={isSimulating}>
        {isSimulating ? '⏳ Simulating…' : '🥚 Drop Egg!'}
      </button>
      <button style={s.btn('secondary')} onClick={onReset} disabled={isSimulating}>
        ↩ Replay
      </button>
      <button style={s.btn('danger')} onClick={onClear} disabled={isSimulating}>
        🗑 Clear
      </button>

      {/* Result badge */}
      {simResult && (
        <>
          <div style={s.divider} />
          <div style={s.result(simResult.egg_survived)}>
            {simResult.egg_survived ? '🎉 Egg Survived!' : '💥 Egg Cracked!'}
          </div>
          <div style={s.group}>
            <span style={s.label}>Peak Impact</span>
            <span style={s.value}>{simResult.max_impulse} N·s</span>
          </div>
        </>
      )}
    </div>
  );
}
