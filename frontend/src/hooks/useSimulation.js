import { useState, useCallback } from 'react';

const API = '/api';

export function useSimulation() {
  const [frames, setFrames] = useState([]);
  const [simResult, setSimResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);

  const runSimulation = useCallback(async ({ nodes, beams, dropHeight }) => {
    if (isSimulating) return;
    setIsSimulating(true);
    setError(null);
    setFrames([]);
    setSimResult(null);
    setIsPlaying(false);

    try {
      const res = await fetch(`${API}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          beams,
          canvas_width: 800,
          canvas_height: 600,
          drop_height_px: dropHeight,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Simulation failed');
      }
      const data = await res.json();
      setFrames(data.frames);
      setSimResult(data);
      setIsPlaying(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSimulating(false);
    }
  }, [isSimulating]);

  const replay = useCallback(() => {
    setIsPlaying(false);
    setTimeout(() => setIsPlaying(true), 50);
  }, []);

  const reset = useCallback(() => {
    setFrames([]);
    setSimResult(null);
    setIsPlaying(false);
    setError(null);
  }, []);

  return { frames, simResult, isSimulating, isPlaying, error, runSimulation, replay, reset };
}
