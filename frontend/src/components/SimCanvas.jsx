/**
 * SimCanvas — handles both the structure builder and simulation playback.
 *
 * Build mode:
 *   - Click empty space → place a node
 *   - Click an existing node → start a beam (highlights pending connection)
 *   - Click a second node → create beam between them
 *   - Delete tool: click a node or beam to remove it
 *
 * Simulation mode:
 *   - Animates frames returned by the backend
 *   - Draws egg, beams, ground, shatter effects
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';

const GRID = 25;          // px snap grid
const NODE_R = 8;         // node hit-radius (px)
const CANVAS_W = 800;
const CANVAS_H = 600;
const EGG_RADIUS = 14;
const GROUND_Y = CANVAS_H - 20;

// Snap to grid
function snap(v) { return Math.round(v / GRID) * GRID; }

// Distance between two points
function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

// Check if point (px,py) is near a line segment (ax,ay)→(bx,by)
function pointNearSegment(px, py, ax, ay, bx, by, tol = 8) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay) < tol;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) < tol;
}

// Draw a cracked egg at (cx, cy)
function drawCrackedEgg(ctx, cx, cy) {
  ctx.save();
  // Outer broken shell (red tint)
  ctx.beginPath();
  ctx.ellipse(cx, cy, EGG_RADIUS * 1.2, EGG_RADIUS * 1.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239,68,68,0.25)';
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Crack lines
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 1.5;
  [[cx - 4, cy - 10, cx + 2, cy + 12],
   [cx + 5, cy - 8,  cx - 3, cy + 10],
   [cx - 6, cy,      cx + 8, cy - 4]].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
  ctx.restore();
}

// Draw a healthy egg at (cx, cy, angle)
function drawEgg(ctx, cx, cy, angle, cracked) {
  if (cracked) { drawCrackedEgg(ctx, cx, cy); return; }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  // Shell gradient
  const grad = ctx.createRadialGradient(-4, -6, 2, 0, 0, EGG_RADIUS * 1.4);
  grad.addColorStop(0, '#fffbeb');
  grad.addColorStop(0.6, '#fef3c7');
  grad.addColorStop(1, '#d97706');
  ctx.beginPath();
  ctx.ellipse(0, 0, EGG_RADIUS, EGG_RADIUS * 1.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,120,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// Draw a beam segment
function drawBeam(ctx, body, beamDef, materialColor, broken, thickness = 3) {
  // beamDef has node positions for drawing in build mode;
  // in sim mode we use body position+angle
  ctx.save();
  if (broken) {
    ctx.globalAlpha = 0.45;
  }
  ctx.strokeStyle = broken ? '#6b7280' : materialColor;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';

  if (body) {
    // Simulation mode: reconstruct from body state + stored half-length
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(body.angle);
    const hl = body.halfLength;
    ctx.beginPath();
    ctx.moveTo(-hl, 0);
    ctx.lineTo(hl, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export default function SimCanvas({
  tool, selectedMaterial, materials,
  nodes, beams, onNodesChange, onBeamsChange,
  frames, isPlaying, dropHeight,
}) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const frameIdxRef = useRef(0);
  const lastTimeRef = useRef(null);
  const [pendingNode, setPendingNode] = useState(null);   // first click in beam draw
  const [mousePos, setMousePos] = useState(null);
  const [playFrame, setPlayFrame] = useState(0);

  // Map material name → object
  const matMap = Object.fromEntries(materials.map(m => [m.name, m]));

  // Compute beam half-lengths once (used for rendering)
  const beamHalfLengths = {};
  beams.forEach(b => {
    const na = nodes.find(n => n.id === b.node_a);
    const nb = nodes.find(n => n.id === b.node_b);
    if (na && nb) beamHalfLengths[b.id] = dist(na, nb) / 2;
  });

  // Compute total structure mass (approximate, in g)
  // (shown in controls via prop; we just expose it)

  // ---------- build-mode event handlers ----------
  const getSnappedPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: snap(e.clientX - rect.left),
      y: snap(e.clientY - rect.top),
    };
  }, []);

  const findNodeAt = useCallback((pos) => {
    return nodes.find(n => dist(n, pos) <= NODE_R + 4);
  }, [nodes]);

  const findBeamAt = useCallback((pos) => {
    return beams.find(b => {
      const na = nodes.find(n => n.id === b.node_a);
      const nb = nodes.find(n => n.id === b.node_b);
      if (!na || !nb) return false;
      return pointNearSegment(pos.x, pos.y, na.x, na.y, nb.x, nb.y);
    });
  }, [beams, nodes]);

  const handleMouseMove = useCallback((e) => {
    if (frames.length > 0) return;
    const pos = getSnappedPos(e);
    setMousePos(pos);
  }, [getSnappedPos, frames]);

  const handleMouseLeave = useCallback(() => setMousePos(null), []);

  const handleClick = useCallback((e) => {
    if (frames.length > 0) return;
    const pos = getSnappedPos(e);

    if (tool === 'delete') {
      const hitNode = findNodeAt(pos);
      if (hitNode) {
        onBeamsChange(beams.filter(b => b.node_a !== hitNode.id && b.node_b !== hitNode.id));
        onNodesChange(nodes.filter(n => n.id !== hitNode.id));
        return;
      }
      const hitBeam = findBeamAt(pos);
      if (hitBeam) {
        onBeamsChange(beams.filter(b => b.id !== hitBeam.id));
      }
      return;
    }

    if (tool === 'beam') {
      const hitNode = findNodeAt(pos);
      if (hitNode) {
        if (!pendingNode) {
          setPendingNode(hitNode);
        } else if (pendingNode.id !== hitNode.id) {
          // Create beam between pendingNode and hitNode
          const exists = beams.some(
            b => (b.node_a === pendingNode.id && b.node_b === hitNode.id) ||
                 (b.node_a === hitNode.id && b.node_b === pendingNode.id)
          );
          if (!exists) {
            const newId = Date.now();
            onBeamsChange([...beams, {
              id: newId,
              node_a: pendingNode.id,
              node_b: hitNode.id,
              material: selectedMaterial,
            }]);
          }
          setPendingNode(null);
        } else {
          setPendingNode(null); // clicked same node
        }
        return;
      }

      // No node hit → place a new node
      const newNode = { id: Date.now(), x: pos.x, y: pos.y };
      const newNodes = [...nodes, newNode];
      onNodesChange(newNodes);

      if (pendingNode) {
        const newId = Date.now() + 1;
        onBeamsChange([...beams, {
          id: newId,
          node_a: pendingNode.id,
          node_b: newNode.id,
          material: selectedMaterial,
        }]);
        setPendingNode(newNode); // chain: next click connects from this node
      }
    }
  }, [tool, frames, getSnappedPos, findNodeAt, findBeamAt, pendingNode,
      nodes, beams, selectedMaterial, onNodesChange, onBeamsChange]);

  // Cancel pending node on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setPendingNode(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ---------- animation loop ----------
  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      frameIdxRef.current = 0;
      lastTimeRef.current = null;
      return;
    }

    const FPS = 60;
    const frameDuration = 1000 / FPS;

    const animate = (timestamp) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;

      if (elapsed >= frameDuration) {
        lastTimeRef.current = timestamp;
        frameIdxRef.current = Math.min(frameIdxRef.current + 1, frames.length - 1);
        setPlayFrame(frameIdxRef.current);
      }

      if (frameIdxRef.current < frames.length - 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isPlaying, frames]);

  // Reset frame on new simulation
  useEffect(() => {
    frameIdxRef.current = 0;
    setPlayFrame(0);
  }, [frames]);

  // ---------- canvas render ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bg.addColorStop(0, '#0d1117');
    bg.addColorStop(1, '#1a1d2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid
    ctx.strokeStyle = 'rgba(124,133,255,0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_W; x += GRID) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += GRID) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }

    // Ground
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(CANVAS_W, GROUND_Y); ctx.stroke();

    // Ground label
    ctx.font = '11px monospace';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('GROUND', 10, GROUND_Y - 6);

    // Drop height line (build mode only)
    if (frames.length === 0) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = 'rgba(251,191,36,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, dropHeight); ctx.lineTo(CANVAS_W, dropHeight); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(251,191,36,0.6)';
      ctx.font = '11px monospace';
      ctx.fillText(`↓ Drop zone (${(dropHeight / 200).toFixed(1)} m)`, 8, dropHeight - 5);

      // Egg ghost at drop height
      const egx = CANVAS_W / 2;
      ctx.globalAlpha = 0.2;
      drawEgg(ctx, egx, dropHeight, 0, false);
      ctx.globalAlpha = 1;
    }

    // ---- SIMULATION MODE ----
    if (frames.length > 0) {
      const frame = frames[playFrame] || frames[frames.length - 1];

      // Build a map of body states by id for quick lookup
      const bodyMap = {};
      frame.bodies.forEach(b => { bodyMap[b.id] = b; });

      // Draw beams
      beams.forEach(b => {
        const bodyState = bodyMap[`beam_${b.id}`];
        if (!bodyState) return;
        const mat = matMap[b.material];
        const color = mat ? mat.color : '#888';
        const hl = beamHalfLengths[b.id] || 30;

        ctx.save();
        if (bodyState.broken) ctx.globalAlpha = 0.35;
        ctx.strokeStyle = bodyState.broken ? '#6b7280' : color;
        ctx.lineWidth = mat ? Math.max(2, mat.thickness * 4) : 3;
        ctx.lineCap = 'round';
        ctx.translate(bodyState.x, bodyState.y);
        ctx.rotate(bodyState.angle);
        ctx.beginPath();
        ctx.moveTo(-hl, 0);
        ctx.lineTo(hl, 0);
        ctx.stroke();
        ctx.restore();
      });

      // Draw egg
      const egg = bodyMap['egg'];
      if (egg) drawEgg(ctx, egg.x, egg.y, egg.angle, egg.broken);

      // Flash on break event
      const hasBreak = frame.events.some(e => e.type === 'egg_break');
      if (hasBreak) {
        ctx.fillStyle = 'rgba(239,68,68,0.12)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      // Playback scrubber
      const progress = playFrame / Math.max(frames.length - 1, 1);
      ctx.fillStyle = '#2d3155';
      ctx.fillRect(10, CANVAS_H - 50, CANVAS_W - 20, 6);
      ctx.fillStyle = '#7c85ff';
      ctx.fillRect(10, CANVAS_H - 50, (CANVAS_W - 20) * progress, 6);

      const simT = frame.t.toFixed(2);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#7c85ff';
      ctx.fillText(`t = ${simT}s`, CANVAS_W - 80, CANVAS_H - 55);

      return; // Don't draw build-mode UI during simulation
    }

    // ---- BUILD MODE ----
    // Draw existing beams
    beams.forEach(b => {
      const na = nodes.find(n => n.id === b.node_a);
      const nb = nodes.find(n => n.id === b.node_b);
      if (!na || !nb) return;
      const mat = matMap[b.material];
      const color = mat ? mat.color : '#888';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = mat ? Math.max(2, mat.thickness * 4) : 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.stroke();
      ctx.restore();
    });

    // Ghost beam (pending connection preview)
    if (pendingNode && mousePos && tool === 'beam') {
      const mat = matMap[selectedMaterial];
      ctx.save();
      ctx.setLineDash([8, 4]);
      ctx.strokeStyle = mat ? mat.color : '#7c85ff';
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pendingNode.x, pendingNode.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.restore();
    }

    // Draw nodes
    nodes.forEach(n => {
      const isPending = pendingNode && pendingNode.id === n.id;
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2);
      ctx.fillStyle = isPending ? '#7c85ff' : '#374151';
      ctx.fill();
      ctx.strokeStyle = isPending ? '#b0b8ff' : '#6b7280';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });

    // Cursor snap dot (when no pending node)
    if (mousePos && tool === 'beam' && !findNodeAt(mousePos)) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(124,133,255,0.5)';
      ctx.fill();
      ctx.restore();
    }
  }, [nodes, beams, pendingNode, mousePos, matMap, tool, selectedMaterial,
      frames, playFrame, dropHeight, beamHalfLengths]);

  const cursor = tool === 'delete' ? 'crosshair' : 'default';

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ display: 'block', cursor }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
}
