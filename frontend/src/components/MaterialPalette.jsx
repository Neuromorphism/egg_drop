import React from 'react';
import { MATERIAL_ICONS, MATERIAL_DESCRIPTIONS } from '../utils/materials.js';

const styles = {
  panel: {
    width: 220,
    background: '#1a1d2e',
    borderRight: '1px solid #2d3155',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 12px',
    gap: 8,
    overflowY: 'auto',
  },
  heading: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#7c85b3',
    marginBottom: 4,
  },
  card: (selected, color) => ({
    border: selected ? `2px solid ${color}` : '2px solid transparent',
    borderRadius: 10,
    padding: '10px 12px',
    cursor: 'pointer',
    background: selected ? `${color}18` : '#242740',
    transition: 'all 0.15s',
    outline: 'none',
  }),
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dot: (color) => ({
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.15)',
  }),
  name: {
    fontWeight: 600,
    fontSize: 13,
    color: '#e2e8f0',
  },
  desc: {
    fontSize: 11,
    color: '#8891b2',
    lineHeight: 1.4,
  },
  stats: {
    display: 'flex',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  stat: (color) => ({
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 4,
    background: `${color}22`,
    color,
    fontWeight: 600,
    letterSpacing: '0.04em',
  }),
  divider: {
    height: 1,
    background: '#2d3155',
    margin: '8px 0',
  },
  toolHeading: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#7c85b3',
    marginBottom: 4,
  },
  toolBtn: (active) => ({
    padding: '8px 12px',
    borderRadius: 8,
    border: active ? '2px solid #7c85ff' : '2px solid transparent',
    background: active ? '#7c85ff22' : '#242740',
    color: active ? '#b0b8ff' : '#8891b2',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'left',
    transition: 'all 0.15s',
  }),
};

export default function MaterialPalette({ materials, selected, onSelect, tool, onToolChange }) {
  return (
    <div style={styles.panel}>
      <div style={styles.heading}>Tools</div>
      <button style={styles.toolBtn(tool === 'beam')} onClick={() => onToolChange('beam')}>
        📐 Draw Beam
      </button>
      <button style={styles.toolBtn(tool === 'delete')} onClick={() => onToolChange('delete')}>
        🗑️ Delete
      </button>

      <div style={styles.divider} />
      <div style={styles.heading}>Materials</div>

      {materials.map((mat) => (
        <button
          key={mat.name}
          style={styles.card(selected === mat.name, mat.color)}
          onClick={() => { onSelect(mat.name); onToolChange('beam'); }}
        >
          <div style={styles.cardHeader}>
            <div style={styles.dot(mat.color)} />
            <span style={styles.name}>
              {MATERIAL_ICONS[mat.name] || '▪'} {mat.display_name}
            </span>
          </div>
          <div style={styles.desc}>
            {MATERIAL_DESCRIPTIONS[mat.name] || ''}
          </div>
          <div style={styles.stats}>
            <span style={styles.stat(mat.color)}>
              {mat.mass_per_cm.toFixed(2)} g/cm
            </span>
            {mat.break_impulse != null ? (
              <span style={styles.stat('#f59e0b')}>
                breaks @ {mat.break_impulse} N·s
              </span>
            ) : (
              <span style={styles.stat('#22c55e')}>unbreakable</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
