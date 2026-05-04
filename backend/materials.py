"""
Material property definitions for egg drop simulation.
Physical units: mass in grams, force in mN, distance in cm.
Pymunk uses pixels as length — we scale 1 px = 0.5 cm.
"""

from dataclasses import dataclass


@dataclass
class Material:
    name: str
    display_name: str
    color: str          # hex for frontend rendering
    density: float      # g/cm³
    elasticity: float   # restitution coefficient 0–1
    friction: float     # coulomb friction coefficient
    thickness: float    # beam cross-section diameter, cm
    break_impulse: float  # impulse (N·s) that causes failure; None = indestructible
    mass_per_cm: float  # computed from density * cross_section area


MATERIALS: dict[str, Material] = {
    "straw": Material(
        name="straw",
        display_name="Plastic Straw",
        color="#F5E642",
        density=0.3,
        elasticity=0.4,
        friction=0.4,
        thickness=0.6,
        break_impulse=0.08,
        mass_per_cm=0.085,
    ),
    "balsa": Material(
        name="balsa",
        display_name="Balsa Wood",
        color="#D4A55A",
        density=0.16,
        elasticity=0.15,
        friction=0.6,
        thickness=0.8,
        break_impulse=0.25,
        mass_per_cm=0.08,
    ),
    "popsicle": Material(
        name="popsicle",
        display_name="Popsicle Stick",
        color="#C8894E",
        density=0.55,
        elasticity=0.2,
        friction=0.7,
        thickness=1.0,
        break_impulse=0.6,
        mass_per_cm=0.43,
    ),
    "aluminum": Material(
        name="aluminum",
        display_name="Aluminum Strut",
        color="#A8B8C8",
        density=2.7,
        elasticity=0.1,
        friction=0.35,
        thickness=0.6,
        break_impulse=8.0,
        mass_per_cm=0.76,
    ),
    "foam": Material(
        name="foam",
        display_name="Foam Padding",
        color="#FF9EBC",
        density=0.04,
        elasticity=0.7,
        friction=0.9,
        thickness=2.0,
        break_impulse=None,  # foam doesn't snap; it compresses
        mass_per_cm=0.13,
    ),
    "rubber": Material(
        name="rubber",
        display_name="Rubber Band",
        color="#CC4444",
        density=1.2,
        elasticity=0.85,
        friction=0.9,
        thickness=0.3,
        break_impulse=0.15,
        mass_per_cm=0.085,
    ),
}
