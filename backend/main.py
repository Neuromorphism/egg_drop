"""FastAPI server for the egg drop physics simulator."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from materials import MATERIALS
from physics import (
    BeamDef,
    NodeDef,
    SimResult,
    StructureDef,
    run_simulation,
)

app = FastAPI(title="Egg Drop Simulator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------
# Request / response schemas
# ------------------------------------------------------------------
class NodeIn(BaseModel):
    id: int
    x: float
    y: float


class BeamIn(BaseModel):
    id: int
    node_a: int
    node_b: int
    material: str


class SimulateRequest(BaseModel):
    nodes: list[NodeIn]
    beams: list[BeamIn]
    canvas_width: int = 800
    canvas_height: int = 600
    drop_height_px: float = 150   # distance from top of canvas to egg start


class BodyStateOut(BaseModel):
    id: str
    x: float
    y: float
    angle: float
    broken: bool


class FrameOut(BaseModel):
    t: float
    bodies: list[BodyStateOut]
    events: list[dict]


class SimulateResponse(BaseModel):
    frames: list[FrameOut]
    egg_survived: bool
    max_impulse: float
    total_mass_g: float
    drop_height_m: float
    simulation_time: float


class MaterialOut(BaseModel):
    name: str
    display_name: str
    color: str
    thickness: float
    mass_per_cm: float
    break_impulse: float | None


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@app.get("/materials", response_model=list[MaterialOut])
def get_materials():
    return [
        MaterialOut(
            name=m.name,
            display_name=m.display_name,
            color=m.color,
            thickness=m.thickness,
            mass_per_cm=m.mass_per_cm,
            break_impulse=m.break_impulse,
        )
        for m in MATERIALS.values()
    ]


@app.post("/simulate", response_model=SimulateResponse)
def simulate(req: SimulateRequest):
    if not req.beams:
        raise HTTPException(status_code=400, detail="Structure must contain at least one beam.")
    if len(req.nodes) < 2:
        raise HTTPException(status_code=400, detail="Structure must have at least two nodes.")

    unknown = [b.material for b in req.beams if b.material not in MATERIALS]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown materials: {unknown}")

    structure = StructureDef(
        nodes=[NodeDef(id=n.id, x=n.x, y=n.y) for n in req.nodes],
        beams=[BeamDef(id=b.id, node_a=b.node_a, node_b=b.node_b, material=b.material)
               for b in req.beams],
        canvas_width=req.canvas_width,
        canvas_height=req.canvas_height,
    )

    result = run_simulation(structure, req.drop_height_px)

    return SimulateResponse(
        frames=[
            FrameOut(
                t=f.t,
                bodies=[
                    BodyStateOut(id=b.id, x=b.x, y=b.y, angle=b.angle, broken=b.broken)
                    for b in f.bodies
                ],
                events=f.events,
            )
            for f in result.frames
        ],
        egg_survived=result.egg_survived,
        max_impulse=result.max_impulse,
        total_mass_g=result.total_mass_g,
        drop_height_m=result.drop_height_m,
        simulation_time=result.simulation_time,
    )


@app.get("/health")
def health():
    return {"status": "ok"}
