"""
2D egg-drop physics simulation using Pymunk (Chipmunk wrapper).

Coordinate system: Pymunk uses Y-up; the frontend uses Y-down canvas coords.
We accept frontend (Y-down) coordinates, flip Y internally, then flip results
back before returning so the frontend never needs to know.

Scale: 1 frontend pixel = 0.5 cm = 0.005 m
       PX_PER_M = 200  →  200 px = 1 m

Simulation scenario
-------------------
The user builds a catching structure in the lower canvas area.
Bottom-most nodes (within GROUND_PIN_ZONE px of the ground line) are
pinned to the ground — they act as the structure's footprint.
The egg drops from drop_height_px (measured from the TOP of the canvas
downward) and falls into the structure.

If no nodes fall within the pin zone, the whole structure is shifted so
its lowest nodes rest on the ground (simulating a single-body drop).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

import pymunk

from materials import MATERIALS, Material

# ------------------------------------------------------------------
# Physics constants
# ------------------------------------------------------------------
PX_PER_M       = 200.0            # 200 px = 1 m  →  1 px = 0.5 cm
GRAVITY_PX     = 9.81 * PX_PER_M  # px/s²  ≈ 1962
SUBSTEPS       = 6
TARGET_FPS     = 60
DT             = 1.0 / TARGET_FPS
MAX_SIM_TIME   = 5.0              # seconds
EGG_RADIUS_PX  = 14.0            # visual + collision radius
EGG_MASS_KG    = 0.060           # 60 g
# Impulse (N·s) that cracks a raw egg — empirically ~0.3–0.6 N·s
EGG_BREAK_NS   = 0.45
GROUND_Y_PX    = 20              # pymunk Y of the ground (Y-up from canvas bottom)
GROUND_PIN_ZONE = 80             # canvas-px above ground → nodes get pinned

# Collision types
CT_EGG    = 1
CT_BEAM   = 2
CT_GROUND = 3


# ------------------------------------------------------------------
# Data models
# ------------------------------------------------------------------
@dataclass
class NodeDef:
    id: int
    x: float   # frontend px (Y-down)
    y: float


@dataclass
class BeamDef:
    id: int
    node_a: int
    node_b: int
    material: str


@dataclass
class StructureDef:
    nodes: list[NodeDef]
    beams: list[BeamDef]
    canvas_width: int
    canvas_height: int


@dataclass
class BodyState:
    id: str
    x: float
    y: float
    angle: float
    broken: bool = False


@dataclass
class Frame:
    t: float
    bodies: list[BodyState]
    events: list[dict] = field(default_factory=list)


@dataclass
class SimResult:
    frames: list[Frame]
    egg_survived: bool
    max_impulse: float
    total_mass_g: float
    drop_height_m: float
    simulation_time: float


# ------------------------------------------------------------------
# Coordinate helpers (frontend Y-down  ↔  Pymunk Y-up)
# ------------------------------------------------------------------
def to_pymunk(x: float, y: float, canvas_height: int) -> tuple[float, float]:
    return x, canvas_height - y


def to_frontend(x: float, y: float, canvas_height: int) -> tuple[float, float]:
    return x, canvas_height - y


# ------------------------------------------------------------------
# Simulation
# ------------------------------------------------------------------
def run_simulation(structure: StructureDef, drop_height_px: float) -> SimResult:
    space = pymunk.Space()
    space.gravity = (0, -GRAVITY_PX)
    space.damping = 0.998

    h = structure.canvas_height

    # ---- Ground (static) -------------------------------------------
    ground = pymunk.Segment(space.static_body, (-2000, GROUND_Y_PX), (2000, GROUND_Y_PX), 4)
    ground.friction = 1.0
    ground.elasticity = 0.02
    ground.collision_type = CT_GROUND
    space.add(ground)

    # Side walls
    wall_l = pymunk.Segment(space.static_body, (0, 0), (0, h), 4)
    wall_r = pymunk.Segment(space.static_body,
                             (structure.canvas_width, 0), (structure.canvas_width, h), 4)
    for w in (wall_l, wall_r):
        w.friction = 0.5
        w.elasticity = 0.0
        w.collision_type = CT_GROUND
        space.add(w)

    # ---- Material map -----------------------------------------------
    mat_map: dict[str, Material] = {k: v for k, v in MATERIALS.items()}
    node_map: dict[int, NodeDef] = {n.id: n for n in structure.nodes}

    # ---- Auto-translate structure to sit on the ground --------------
    # Find the lowest canvas-Y (highest Y value in Y-down coords = closest to ground)
    if structure.nodes:
        max_canvas_y = max(n.y for n in structure.nodes)
        ground_canvas_y = h - GROUND_Y_PX          # e.g. 580
        if max_canvas_y < ground_canvas_y - GROUND_PIN_ZONE:
            # Shift entire structure down so lowest nodes are 20px above ground
            shift = ground_canvas_y - max_canvas_y - 30
            for nd in structure.nodes:
                nd.y += shift

    # ---- Build beam bodies ------------------------------------------
    beam_bodies: dict[int, pymunk.Body] = {}
    beam_shapes: dict[int, pymunk.Shape] = {}
    beam_half_lengths: dict[int, float] = {}
    broken_beams: set[int] = set()
    total_mass_g = 0.0
    # Collision filter: beams don't collide with each other (same group)
    beam_filter = pymunk.ShapeFilter(group=1)

    for beam in structure.beams:
        mat = mat_map.get(beam.material)
        if mat is None:
            continue

        na = node_map[beam.node_a]
        nb = node_map[beam.node_b]
        ax, ay = to_pymunk(na.x, na.y, h)
        bx, by = to_pymunk(nb.x, nb.y, h)

        length_px = math.hypot(bx - ax, by - ay)
        if length_px < 2:
            continue

        length_cm = (length_px / PX_PER_M) * 100
        mass_g = mat.mass_per_cm * length_cm
        total_mass_g += mass_g
        mass_kg = mass_g / 1000.0

        half = length_px / 2.0
        beam_half_lengths[beam.id] = half

        radius = max(1.0, mat.thickness * PX_PER_M / 200.0)
        moment = pymunk.moment_for_segment(mass_kg, (-half, 0), (half, 0), radius)
        body = pymunk.Body(mass_kg, moment)
        body.position = (ax + bx) / 2, (ay + by) / 2
        body.angle = math.atan2(by - ay, bx - ax)

        seg = pymunk.Segment(body, (-half, 0), (half, 0), radius)
        seg.density = mat.density
        seg.elasticity = mat.elasticity
        seg.friction = mat.friction
        seg.collision_type = CT_BEAM
        seg.filter = beam_filter

        space.add(body, seg)
        beam_bodies[beam.id] = body
        beam_shapes[beam.id] = seg

    # ---- Pin joints at shared nodes ---------------------------------
    # Group nodes → list of (beam_id, endpoint_side)
    node_beam_eps: dict[int, list[tuple[int, str]]] = {}
    for beam in structure.beams:
        for nid, side in [(beam.node_a, "a"), (beam.node_b, "b")]:
            node_beam_eps.setdefault(nid, []).append((beam.id, side))

    ground_canvas_y = h - GROUND_Y_PX
    for node_id, eps in node_beam_eps.items():
        nd = node_map[node_id]
        anchor_pm = to_pymunk(nd.x, nd.y, h)

        # Pin to ground if within the pin zone
        if nd.y >= ground_canvas_y - GROUND_PIN_ZONE:
            for bid, _ in eps:
                body = beam_bodies.get(bid)
                if body is None:
                    continue
                j = pymunk.PivotJoint(space.static_body, body, anchor_pm)
                j.max_bias = 1e7
                space.add(j)
            continue   # don't add inter-beam joints for ground-pinned nodes

        # Connect beams to each other at this shared node
        if len(eps) < 2:
            continue
        bid0, _ = eps[0]
        body0 = beam_bodies.get(bid0)
        if body0 is None:
            continue
        for bid1, _ in eps[1:]:
            body1 = beam_bodies.get(bid1)
            if body1 is None:
                continue
            j = pymunk.PivotJoint(body0, body1, anchor_pm)
            j.max_bias = 1e7
            space.add(j)

    # ---- Egg body ---------------------------------------------------
    egg_cx = structure.canvas_width / 2.0
    egg_cy = drop_height_px            # frontend Y-down
    egg_px, egg_py = to_pymunk(egg_cx, egg_cy, h)

    egg_moment = pymunk.moment_for_circle(EGG_MASS_KG, 0, EGG_RADIUS_PX)
    egg_body = pymunk.Body(EGG_MASS_KG, egg_moment)
    egg_body.position = egg_px, egg_py

    egg_shape = pymunk.Circle(egg_body, EGG_RADIUS_PX)
    egg_shape.elasticity = 0.15
    egg_shape.friction = 0.8
    egg_shape.collision_type = CT_EGG
    egg_shape.filter = pymunk.ShapeFilter(
        group=0,
        mask=pymunk.ShapeFilter.ALL_MASKS()
    )
    space.add(egg_body, egg_shape)

    # ---- Egg collision tracking -------------------------------------
    max_impulse_pymunk: float = 0.0
    egg_broken = False
    frame_events: list[dict] = []

    def post_solve_egg(arbiter: pymunk.Arbiter, space, data):
        nonlocal max_impulse_pymunk, egg_broken
        imp = math.hypot(*arbiter.total_impulse)
        if imp > max_impulse_pymunk:
            max_impulse_pymunk = imp
        imp_ns = imp / PX_PER_M
        if imp_ns > EGG_BREAK_NS and not egg_broken:
            egg_broken = True
            frame_events.append({"type": "egg_break", "t": round(data["t"], 3)})
        return True

    # Egg vs beam
    h_eb = space.add_collision_handler(CT_EGG, CT_BEAM)
    h_eb.data["t"] = 0.0
    h_eb.post_solve = post_solve_egg

    # Egg vs ground (direct hit if no structure catches it)
    h_eg = space.add_collision_handler(CT_EGG, CT_GROUND)
    h_eg.data["t"] = 0.0
    h_eg.post_solve = post_solve_egg

    # ---- Simulation loop -------------------------------------------
    frames: list[Frame] = []
    t = 0.0
    sub_dt = DT / SUBSTEPS
    next_frame_t = 0.0
    frame_interval = 1.0 / TARGET_FPS
    settle_count = 0

    while t <= MAX_SIM_TIME:
        h_eb.data["t"] = t
        h_eg.data["t"] = t

        for _ in range(SUBSTEPS):
            space.step(sub_dt)

        # Snapshot this frame
        if t >= next_frame_t:
            bodies_state: list[BodyState] = []

            # Egg
            ex, ey = to_frontend(*egg_body.position, h)
            bodies_state.append(BodyState(
                id="egg", x=round(ex, 2), y=round(ey, 2),
                angle=round(-egg_body.angle, 4),
                broken=egg_broken,
            ))

            # Beams
            for beam in structure.beams:
                body = beam_bodies.get(beam.id)
                if body is None:
                    continue
                fx, fy = to_frontend(*body.position, h)
                bodies_state.append(BodyState(
                    id=f"beam_{beam.id}",
                    x=round(fx, 2), y=round(fy, 2),
                    angle=round(-body.angle, 4),
                    broken=(beam.id in broken_beams),
                ))

            current_events = [e for e in frame_events
                               if abs(e.get("t", 0) - t) < frame_interval * 2]
            frames.append(Frame(t=round(t, 3), bodies=bodies_state, events=current_events))
            next_frame_t += frame_interval

        # Check beam breaks (via force magnitude heuristic)
        for beam in structure.beams:
            if beam.id in broken_beams:
                continue
            mat = mat_map.get(beam.material)
            if mat is None or mat.break_impulse is None:
                continue
            body = beam_bodies.get(beam.id)
            if body is None:
                continue
            force_mag_ns = math.hypot(*body.force) * DT / PX_PER_M
            if force_mag_ns > mat.break_impulse * 0.5:
                broken_beams.add(beam.id)
                frame_events.append({"type": "beam_break", "beam_id": beam.id, "t": round(t, 3)})

        t += DT

        # Early exit once settled
        v_egg = math.hypot(*egg_body.velocity)
        if egg_broken and t > 0.4:
            break
        if t > 1.0 and v_egg < 8:
            settle_count += 1
            if settle_count > 20:
                break
        else:
            settle_count = 0

    return SimResult(
        frames=frames,
        egg_survived=not egg_broken,
        max_impulse=round(max_impulse_pymunk / PX_PER_M, 4),
        total_mass_g=round(total_mass_g, 1),
        drop_height_m=round(drop_height_px / PX_PER_M, 2),
        simulation_time=round(t, 2),
    )
