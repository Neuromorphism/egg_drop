import React, { useState, useEffect, useMemo } from 'react';
import MaterialPalette from './components/MaterialPalette.jsx';
import SimCanvas from './components/SimCanvas.jsx';
import Controls from './components/Controls.jsx';
import { useSimulation } from './hooks/useSimulation.js';

const CANVAS_W = 800;
const CANVAS_H = 600;
const DEFAULT_DROP_HEIGHT = 150;   // px from top of canvas

// Estimate structure mass in grams
function estimateMass(nodes, beams, materials) {
  const matMap = Object.fromEntries(materials.map(m => [m.name, m]));
  return beams.reduce((sum, b) => {
    const na = nodes.find(n => n.id === b.node_a);
    const nb = nodes.find(n => n.id === b.node_b);
    if (!na || !nb) return sum;
    const lenPx = Math.hypot(nb.x - na.x, nb.y - na.y);
    const lenCm = lenPx / 200 * 100;   // 200 px/m → cm
    const mat = matMap[b.material];
    return sum + (mat ? mat.mass_per_cm * lenCm : 0);
  }, 0);
}

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0f1117',
    color: '#e2e8f0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '10px 24px',
    background: '#1a1d2e',
    borderBottom: '1px solid #2d3155',
    flexShrink: 0,
  },
  logo: {
    fontSize: 28,
    lineHeight: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: '#e2e8f0',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 12,
    color: '#7c85b3',
    marginTop: 2,
  },
  badge: {
    marginLeft: 'auto',
    padding: '4px 10px',
    borderRadius: 6,
    background: '#242740',
    fontSize: 11,
    color: '#7c85b3',
    fontWeight: 600,
    border: '1px solid #2d3155',
  },
  workspace: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  canvasArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    background: '#0d1117',
    padding: 16,
  },
  canvasWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 0 0 1px #2d3155, 0 20px 60px rgba(0,0,0,0.6)',
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    color: '#4b5563',
    textAlign: 'center',
  },
  errorBanner: {
    background: '#7f1d1d',
    border: '1px solid #991b1b',
    borderRadius: 8,
    padding: '8px 16px',
    marginTop: 8,
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: 600,
  },
  instructionPanel: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'rgba(26,29,46,0.92)',
    border: '1px solid #2d3155',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 11,
    color: '#7c85b3',
    lineHeight: 1.7,
    maxWidth: 220,
    backdropFilter: 'blur(4px)',
  },
};

const HINTS_BUILD = [
  '📐 Select a material → click canvas to place nodes',
  '🔗 Click two nodes to connect them with a beam',
  '🗑 Switch to Delete → click node/beam to remove',
  '⎋ Press Escape to cancel current connection',
  '🥚 Click "Drop Egg!" to run the simulation',
];

const HINTS_SIM = [
  '▶ Watch the egg fall into your structure',
  '↩ Click Replay to watch again',
  '🗑 Click Clear to redesign your structure',
];

export default function App() {
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('balsa');
  const [tool, setTool] = useState('beam');
  const [nodes, setNodes] = useState([]);
  const [beams, setBeams] = useState([]);
  const [dropHeight, setDropHeight] = useState(DEFAULT_DROP_HEIGHT);

  const { frames, simResult, isSimulating, isPlaying, error, runSimulation, replay, reset } =
    useSimulation();

  // Load material list from backend on mount
  useEffect(() => {
    fetch('/api/materials')
      .then(r => r.json())
      .then(setMaterials)
      .catch(() => {
        // Fallback for when backend isn't running (dev preview)
        setMaterials([
          { name: 'straw',     display_name: 'Plastic Straw',  color: '#F5E642', thickness: 0.6, mass_per_cm: 0.085, break_impulse: 0.08 },
          { name: 'balsa',     display_name: 'Balsa Wood',     color: '#D4A55A', thickness: 0.8, mass_per_cm: 0.08,  break_impulse: 0.25 },
          { name: 'popsicle',  display_name: 'Popsicle Stick', color: '#C8894E', thickness: 1.0, mass_per_cm: 0.43,  break_impulse: 0.6  },
          { name: 'aluminum',  display_name: 'Aluminum Strut', color: '#A8B8C8', thickness: 0.6, mass_per_cm: 0.76,  break_impulse: 8.0  },
          { name: 'foam',      display_name: 'Foam Padding',   color: '#FF9EBC', thickness: 2.0, mass_per_cm: 0.13,  break_impulse: null },
          { name: 'rubber',    display_name: 'Rubber Band',    color: '#CC4444', thickness: 0.3, mass_per_cm: 0.085, break_impulse: 0.15 },
        ]);
      });
  }, []);

  const totalMassG = useMemo(
    () => estimateMass(nodes, beams, materials),
    [nodes, beams, materials]
  );

  const handleSimulate = () => {
    runSimulation({ nodes, beams, dropHeight });
  };

  const handleClear = () => {
    reset();
    setNodes([]);
    setBeams([]);
  };

  const inSimMode = frames.length > 0;
  const hints = inSimMode ? HINTS_SIM : HINTS_BUILD;

  return (
    <div style={styles.app}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>🥚</span>
        <div>
          <div style={styles.title}>Egg Drop Simulator</div>
          <div style={styles.subtitle}>Design, build, and test your protection structure</div>
        </div>
        <span style={styles.badge}>Physics NeMo · 2D</span>
      </div>

      {/* Workspace */}
      <div style={styles.workspace}>
        {/* Material / tool palette */}
        <MaterialPalette
          materials={materials}
          selected={selectedMaterial}
          onSelect={setSelectedMaterial}
          tool={tool}
          onToolChange={setTool}
        />

        {/* Canvas area */}
        <div style={styles.canvasArea}>
          <div style={{ position: 'relative' }}>
            <div style={styles.canvasWrapper}>
              <SimCanvas
                tool={tool}
                selectedMaterial={selectedMaterial}
                materials={materials}
                nodes={nodes}
                beams={beams}
                onNodesChange={setNodes}
                onBeamsChange={setBeams}
                frames={frames}
                isPlaying={isPlaying}
                dropHeight={dropHeight}
              />
            </div>

            {/* Inline hint overlay */}
            <div style={styles.instructionPanel}>
              {hints.map((h, i) => <div key={i}>{h}</div>)}
            </div>
          </div>

          {error && <div style={styles.errorBanner}>Error: {error}</div>}

          <div style={styles.hint}>
            {inSimMode
              ? `Simulation complete · ${frames.length} frames · ${simResult?.simulation_time}s`
              : `${nodes.length} nodes · ${beams.length} beams`}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <Controls
        dropHeight={dropHeight}
        onDropHeightChange={setDropHeight}
        onSimulate={handleSimulate}
        onReset={replay}
        onClear={handleClear}
        isSimulating={isSimulating}
        simResult={simResult}
        totalMassG={totalMassG}
      />
    </div>
  );
}
