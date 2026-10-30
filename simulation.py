"""
simulation.py — Python Agent-Based Crowd Simulation, Contingency Modeling,
MoIS Crowd Safety Classification & Inclusive Venue Analytics for INCLUSE · AI Festival Designer.

Consumes and produces the unified JSON schema (v1.1.0) shared with the React + Three.js
frontend (`src/types/festival.ts`), enabling seamless synchronization with `streamlit_app.py`.
"""

from __future__ import annotations

import copy
import math
from typing import Any, Dict, List, Tuple

import numpy as np

GRID_COLS = 48
GRID_ROWS = 36

PHASE_WEIGHTS: Dict[str, Dict[str, float]] = {
    "arrival": {
        "entrance": 2.8,
        "parking": 1.5,
        "booth": 1.4,
        "food": 1.1,
        "rest": 1.2,
        "stage": 0.9,
        "seating": 0.8,
        "restroom": 0.9,
        "vip": 0.8,
        "camping": 1.6,
        "medical": 0.15,
    },
    "afternoon_booths": {
        "entrance": 0.6,
        "parking": 0.3,
        "booth": 2.9,
        "food": 2.1,
        "rest": 2.2,
        "stage": 1.3,
        "seating": 1.2,
        "restroom": 1.4,
        "vip": 1.2,
        "camping": 1.1,
        "medical": 0.2,
    },
    "pre_show": {
        "entrance": 0.5,
        "parking": 0.2,
        "booth": 1.2,
        "food": 1.5,
        "rest": 1.1,
        "stage": 3.1,
        "seating": 3.0,
        "restroom": 1.6,
        "vip": 2.1,
        "camping": 0.6,
        "medical": 0.25,
    },
    "headline_show": {
        "entrance": 0.25,
        "parking": 0.15,
        "booth": 0.55,
        "food": 0.75,
        "rest": 0.65,
        "stage": 4.5,
        "seating": 4.2,
        "restroom": 0.95,
        "vip": 2.8,
        "camping": 0.4,
        "medical": 0.3,
    },
    "intermission": {
        "entrance": 0.4,
        "parking": 0.2,
        "booth": 1.3,
        "food": 4.1,
        "rest": 2.8,
        "stage": 0.9,
        "seating": 1.0,
        "restroom": 4.2,
        "vip": 1.8,
        "camping": 0.8,
        "medical": 0.35,
    },
    "egress": {
        "entrance": 4.6,
        "parking": 3.4,
        "booth": 0.25,
        "food": 0.4,
        "rest": 0.4,
        "stage": 0.2,
        "seating": 0.2,
        "restroom": 1.1,
        "vip": 0.3,
        "camping": 1.5,
        "medical": 0.2,
    },
}

PHASE_RANGES: List[Tuple[str, str, float, float]] = [
    ("arrival", "개장 및 입장 (Arrival)", 0.0, 0.18),
    ("afternoon_booths", "체험부스 관람 (Booths)", 0.18, 0.40),
    ("pre_show", "메인 무대 집결 (Gathering)", 0.40, 0.58),
    ("headline_show", "메인 피크 공연 (Headline Show)", 0.58, 0.76),
    ("intermission", "휴식·푸드 피크 (Intermission)", 0.76, 0.88),
    ("egress", "폐장 및 퇴장 (Closing Egress)", 0.88, 1.00),
]

CONTINGENCY_SCENARIOS: Dict[str, str] = {
    "normal": "정상 운영 (Normal Operations)",
    "rain": "우천 돌발상황 (Sudden Rainstorm)",
    "surge": "방문객 급증 +35% (Attendance Surge)",
    "stage_delay": "메인 공연 지연 (Main Stage Delay)",
    "medical_emergency": "응급환자 발생 (Medical Emergency Lane)",
}


def classify_mois_safety_tier(peak_density: float) -> Tuple[str, str]:
    """
    Classifies crowd density per Korea Ministry of the Interior and Safety (행정안전부)
    Crowd Safety Management Guidelines (다중운집인파사고 안전관리 가이드라인).
    """
    if peak_density < 1.5:
        return "safe", "안전 (< 1.5 명/m²)"
    if peak_density < 2.5:
        return "caution", "주의 (1.5–2.5 명/m²)"
    if peak_density < 3.5:
        return "warning", "경계 (2.5–3.5 명/m²)"
    return "danger", "위험 (≥ 3.5 명/m²)"


def get_phase_for_progress(progress: float) -> Tuple[str, str]:
    p = max(0.0, min(1.0, progress))
    for phase_id, label, lo, hi in PHASE_RANGES:
        if lo <= p <= hi:
            return phase_id, label
    return "egress", "폐장 및 퇴장 (Closing Egress)"


def get_active_attendance_fraction(progress: float) -> float:
    p = max(0.0, min(1.0, progress))
    if p < 0.18:
        return 0.32 + (p / 0.18) * 0.46
    if p < 0.40:
        return 0.78 + ((p - 0.18) / 0.22) * 0.14
    if p < 0.76:
        return 0.92 + math.sin(((p - 0.40) / 0.36) * math.pi) * 0.08
    if p < 0.88:
        return 0.94 - ((p - 0.76) / 0.12) * 0.08
    return max(0.28, 0.86 - ((p - 0.88) / 0.12) * 0.56)


def smooth_grid_3x3(grid: np.ndarray) -> np.ndarray:
    """Applies a separable 3x3 binomial/Gaussian smoothing kernel using NumPy."""
    padded = np.pad(grid, pad_width=1, mode="edge")
    smoothed = (
        4.0 * padded[1:-1, 1:-1]
        + 2.0 * (padded[:-2, 1:-1] + padded[2:, 1:-1] + padded[1:-1, :-2] + padded[1:-1, 2:])
        + 1.0 * (padded[:-2, :-2] + padded[:-2, 2:] + padded[2:, :-2] + padded[2:, 2:])
    ) / 16.0
    return smoothed


def run_crowd_simulation(
    config: Dict[str, Any],
    facilities: List[Dict[str, Any]],
    progress: float = 0.64,
    contingency: str = "normal",
) -> Dict[str, Any]:
    """
    Runs deterministic agent sampling and spatial KDE density estimation
    for a given venue configuration, facility list, timeline progress, and contingency scenario.
    """
    venue_w = float(config.get("venueWidth", 200))
    venue_d = float(config.get("venueDepth", 150))
    base_attendance = int(config.get("expectedAttendance", 10000))
    attendance = int(round(base_attendance * (1.35 if contingency == "surge" else 1.0)))

    seed = int(config.get("seed", 20260517)) + int(round(progress * 1000))
    rng = np.random.default_rng(seed)

    phase_id, phase_label = get_phase_for_progress(progress)
    weights_by_cat = dict(PHASE_WEIGHTS[phase_id])

    if contingency == "stage_delay":
        weights_by_cat["stage"] *= 0.38
        weights_by_cat["seating"] *= 0.45
        weights_by_cat["food"] *= 1.85
        weights_by_cat["restroom"] *= 1.75
    elif contingency == "medical_emergency":
        weights_by_cat["medical"] = weights_by_cat.get("medical", 0.25) * 3.2

    active_frac = get_active_attendance_fraction(progress)
    active_visitors = int(round(attendance * active_frac))
    agent_count = min(1050, max(250, int(180 + math.sqrt(attendance) * 5.2)))
    visitors_per_agent = active_visitors / max(1, agent_count)

    if not facilities:
        empty_grid = np.zeros((GRID_ROWS, GRID_COLS), dtype=float)
        return {
            "progress": progress,
            "contingency": contingency,
            "phaseId": phase_id,
            "phaseLabel": phase_label,
            "activeVisitors": active_visitors,
            "peakDensity": 0.0,
            "avgDensity": 0.0,
            "mostCongestedZone": "None",
            "densityGrid": empty_grid.tolist(),
            "facilityOccupancy": {},
            "facilityQueues": {},
            "bottlenecks": [],
        }

    fac_weights = []
    for f in facilities:
        cat = f.get("category", "booth")
        subtype = f.get("subtype", "")
        covered = bool(f.get("covered", cat in ("booth", "restroom", "medical", "vip", "camping")))
        attr = float(f.get("attractionWeight", 1.0))
        cap = max(50.0, float(f.get("capacity", 200)))
        w = max(0.05, attr * weights_by_cat.get(cat, 1.0) * math.sqrt(cap / 200.0))

        if contingency == "rain":
            if subtype == "rain_canopy":
                w *= 2.8
            elif covered:
                w *= 1.85
            else:
                w *= 0.32
        elif contingency == "stage_delay" and f.get("id") == "stage-popup-busking":
            w *= 3.4

        fac_weights.append(w)

    probs = np.array(fac_weights, dtype=float)
    probs /= probs.sum()

    chosen_indices = rng.choice(len(facilities), size=agent_count, p=probs)
    half_w = venue_w * 0.5
    half_d = venue_d * 0.5
    cell_area = (venue_w / GRID_COLS) * (venue_d / GRID_ROWS)

    raw_grid = np.zeros((GRID_ROWS, GRID_COLS), dtype=float)
    occupancy: Dict[str, int] = {f["id"]: 0 for f in facilities}

    for idx in chosen_indices:
        fac = facilities[int(idx)]
        fx = float(fac["position"]["x"])
        fz = float(fac["position"]["z"])
        fw = float(fac["dimensions"]["width"])
        fd = float(fac["dimensions"]["depth"])
        cat = fac.get("category", "booth")

        if cat == "stage":
            ax = fx + rng.uniform(-0.48, 0.48) * fw
            az = fz + fd * 0.5 + rng.uniform(2.5, 12.0)
        elif cat in ("seating", "rest", "camping"):
            ax = fx + rng.uniform(-0.42, 0.42) * fw
            az = fz + rng.uniform(-0.42, 0.42) * fd
        else:
            angle = rng.uniform(0, 2 * math.pi)
            dist = rng.uniform(1.5, 5.5)
            ax = fx + math.cos(angle) * (fw * 0.42 + dist * 0.6)
            az = fz + math.sin(angle) * (fd * 0.42 + dist * 0.6)

        # Keep emergency ambulance corridor (x approx -7m) clear during medical dispatch
        if contingency == "medical_emergency" and abs(ax + 7.0) < 5.5:
            ax = 0.0 if ax >= -7.0 else -14.0

        ax = max(-half_w + 2.0, min(half_w - 2.0, ax))
        az = max(-half_d + 2.0, min(half_d - 2.0, az))

        col = max(0, min(GRID_COLS - 1, int(((ax + half_w) / venue_w) * GRID_COLS)))
        row = max(0, min(GRID_ROWS - 1, int(((az + half_d) / venue_d) * GRID_ROWS)))
        raw_grid[row, col] += visitors_per_agent / cell_area
        occupancy[fac["id"]] = int(round(occupancy[fac["id"]] + visitors_per_agent))

    wide_corridors = bool(config.get("accessibility", {}).get("wideCorridors", False))
    corridor_relief = 0.91 if wide_corridors else 1.0
    density_grid = smooth_grid_3x3(raw_grid) * corridor_relief

    peak_density = float(density_grid.max())
    occupied_cells = density_grid[density_grid > 0.12]
    avg_density = float(occupied_cells.mean()) if occupied_cells.size > 0 else 0.0

    peak_r, peak_c = np.unravel_index(np.argmax(density_grid), density_grid.shape)
    peak_x = -half_w + ((peak_c + 0.5) / GRID_COLS) * venue_w
    peak_z = -half_d + ((peak_r + 0.5) / GRID_ROWS) * venue_d

    most_congested_fac = min(
        facilities,
        key=lambda f: math.hypot(f["position"]["x"] - peak_x, f["position"]["z"] - peak_z),
    )
    most_congested = most_congested_fac.get("nameKo") or most_congested_fac["name"]

    queues: Dict[str, int] = {}
    bottlenecks: List[Dict[str, Any]] = []
    for f in facilities:
        fid = f["id"]
        occ = occupancy.get(fid, 0)
        cap = max(60, int(f.get("capacity", 200)))
        util = occ / cap
        q = int(round((occ - cap * 0.82) * 0.65)) if occ > cap * 0.82 else 0
        queues[fid] = q

        fc = max(0, min(GRID_COLS - 1, int(((f["position"]["x"] + half_w) / venue_w) * GRID_COLS)))
        fr = max(0, min(GRID_ROWS - 1, int(((f["position"]["z"] + half_d) / venue_d) * GRID_ROWS)))
        local_d = float(density_grid[fr, fc])

        if util > 0.92 or local_d > 2.15 or q >= 35:
            bottlenecks.append(
                {
                    "facilityId": fid,
                    "facilityName": f.get("nameKo") or f["name"],
                    "category": f["category"],
                    "peakDensity": round(max(local_d, util * 1.9), 2),
                    "estimatedQueue": q,
                    "utilizationRatio": round(util, 2),
                }
            )

    bottlenecks.sort(key=lambda b: b["peakDensity"], reverse=True)

    return {
        "progress": round(progress, 3),
        "contingency": contingency,
        "phaseId": phase_id,
        "phaseLabel": phase_label,
        "activeVisitors": active_visitors,
        "peakDensity": round(peak_density, 2),
        "avgDensity": round(avg_density, 2),
        "mostCongestedZone": most_congested,
        "densityGrid": np.round(density_grid, 3).tolist(),
        "facilityOccupancy": occupancy,
        "facilityQueues": queues,
        "bottlenecks": bottlenecks[:5],
    }


def evaluate_venue_metrics(
    config: Dict[str, Any],
    facilities: List[Dict[str, Any]],
    sim_result: Dict[str, Any],
) -> Dict[str, Any]:
    """Computes transparent heuristic scores, MoIS safety tier, and wait time matching analyticsEngine.ts."""
    venue_w = float(config.get("venueWidth", 200))
    venue_d = float(config.get("venueDepth", 150))
    attendance = max(500, int(config.get("expectedAttendance", 10000)))
    budget = max(1, int(config.get("budget", 240000)))

    total_facilities = len(facilities)
    total_capacity = sum(int(f.get("capacity", 0)) for f in facilities)
    est_cost = sum(int(f.get("cost", 0)) for f in facilities)
    budget_pct = round((est_cost / budget) * 100.0, 1)
    peak_density = float(sim_result.get("peakDensity", 1.5))
    mois_tier, mois_label = classify_mois_safety_tier(peak_density)

    portals = [f for f in facilities if f.get("category") == "entrance"]
    attractions = [f for f in facilities if f.get("category") in ("stage", "booth", "food", "rest")]
    dists = [
        math.hypot(p["position"]["x"] - a["position"]["x"], p["position"]["z"] - a["position"]["z"])
        for p in portals
        for a in attractions
    ]
    avg_walk = int(round(sum(dists) / len(dists))) if dists else 72

    gates = [
        f
        for f in facilities
        if f.get("category") == "entrance"
        and f.get("subtype") in ("main_entrance", "secondary_entrance")
    ]
    gate_cap = max(600, sum(int(f.get("capacity", 0)) for f in gates))
    gate_ratio = gate_cap / attendance
    med_count = sum(1 for f in facilities if f.get("category") == "medical")

    foods = [f for f in facilities if f.get("category") == "food"]
    food_cap = max(200, sum(int(f.get("capacity", 0)) for f in foods))
    rr_cap = max(
        150,
        sum(int(f.get("capacity", 0)) for f in facilities if f.get("category") == "restroom"),
    )
    food_spread = (
        max(f["position"]["x"] for f in foods) - min(f["position"]["x"] for f in foods)
        if len(foods) >= 2
        else 35.0
    )
    cluster_factor = 1.32 if food_spread < venue_w * 0.26 else 0.88
    wide_corr = bool(config.get("accessibility", {}).get("wideCorridors", False))
    demand_load = (attendance / food_cap) * 1.45 + (attendance / rr_cap) * 0.35 + (attendance / gate_cap) * 0.85
    avg_wait_min = round(max(3.2, min(42.0, demand_load * cluster_factor * (0.9 if wide_corr else 1.04))), 1)

    safety = int(
        max(
            18,
            min(
                99,
                round(
                    66
                    + min(18, gate_ratio * 48)
                    + min(10, med_count * 5.5)
                    - max(0.0, (peak_density - 1.8) * 14.0)
                ),
            ),
        )
    )

    acc_count = sum(
        1 for f in facilities if f.get("accessibility", {}).get("wheelchairAccessible", True)
    )
    acc_ratio = acc_count / max(1, total_facilities)
    has_family = any(f.get("subtype") == "family_lounge" for f in facilities)
    has_multi_info = any(f.get("subtype") == "multilingual_info" for f in facilities)
    accessibility = int(
        max(
            18,
            min(
                99,
                round(
                    48
                    + acc_ratio * 34
                    + (6 if wide_corr else 0)
                    + (4 if has_family else 0)
                    + (3 if has_multi_info else 0)
                    - max(0.0, (avg_walk - 85) * 0.25)
                ),
            ),
        )
    )

    spread_bonus = 9 if food_spread >= venue_w * 0.26 else -4
    crowd_flow = int(
        max(
            18,
            min(
                99,
                round(
                    86
                    + spread_bonus
                    + min(8, len(gates) * 2.5)
                    - len(sim_result.get("bottlenecks", [])) * 4.8
                    - max(0.0, (peak_density - 2.0) * 11.0)
                ),
            ),
        )
    )

    distribution = int(max(18, min(99, 84 + (6 if spread_bonus > 0 else -3))))
    operations = int(
        max(18, min(99, round(72 + min(18, (total_capacity / attendance) * 14))))
    )
    budget_eff = int(
        max(
            18,
            min(
                99,
                round(95 - abs(84 - budget_pct) * 0.42)
                if budget_pct <= 100
                else round(82 - (budget_pct - 100) * 1.45),
            ),
        )
    )

    overall = int(
        round(
            safety * 0.28
            + accessibility * 0.18
            + crowd_flow * 0.22
            + distribution * 0.12
            + operations * 0.10
            + budget_eff * 0.10
        )
    )

    return {
        "totalFacilities": total_facilities,
        "totalCapacity": total_capacity,
        "venueAreaSqm": int(venue_w * venue_d),
        "peakDensity": peak_density,
        "moisSafetyTier": mois_tier,
        "moisSafetyLabel": mois_label,
        "avgWalkingDistanceM": avg_walk,
        "avgWaitMinutes": avg_wait_min,
        "modeledBottlenecks": len(sim_result.get("bottlenecks", [])),
        "estimatedCost": est_cost,
        "budgetUsagePct": budget_pct,
        "scores": {
            "safety": safety,
            "accessibility": accessibility,
            "crowdFlow": crowd_flow,
            "distributionBalance": distribution,
            "operationalEfficiency": operations,
            "budgetEfficiency": budget_eff,
            "overall": overall,
        },
    }


def optimize_layout_python(
    config: Dict[str, Any], facilities: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Python mirror of the INCLUSE spatial heuristic optimizer:
    splits clustered food vendors, adds relief portals & inclusive family lounge, and enforces 100% step-free ramps.
    """
    venue_w = float(config.get("venueWidth", 200))
    venue_d = float(config.get("venueDepth", 150))
    attendance = int(config.get("expectedAttendance", 10000))
    budget = int(config.get("budget", 240000))

    opt = copy.deepcopy(facilities)
    notes: List[str] = []

    foods = [f for f in opt if f.get("category") == "food"]
    if len(foods) >= 3:
        spread_x = max(f["position"]["x"] for f in foods) - min(f["position"]["x"] for f in foods)
        if spread_x < venue_w * 0.30:
            moved = 0
            for idx, f in enumerate(foods):
                if idx % 2 == 1:
                    f["position"]["x"] = round(venue_w * 0.14 + idx * 6)
                    f["position"]["z"] = round(venue_d * 0.20 + (idx % 2) * 8)
                    f["rotation"] = 0
                    moved += 1
            if moved:
                notes.append(
                    f"편중된 푸드부스 {moved}개를 남동측 광장으로 이원화 분산하여 휴식 시간 대기열을 단축했습니다."
                )

    gates = [
        f
        for f in opt
        if f.get("category") == "entrance"
        and f.get("subtype") in ("main_entrance", "secondary_entrance")
    ]
    gate_cap = sum(int(f.get("capacity", 0)) for f in gates)
    cur_cost = sum(int(f.get("cost", 0)) for f in opt)

    if gate_cap < attendance * 0.34 and cur_cost + 9500 <= budget * 1.08:
        opt.append(
            {
                "id": "entrance-opt-south",
                "name": "South Boulevard Relief Gate",
                "nameKo": "남측 중앙 분산 출입구 (추가)",
                "category": "entrance",
                "subtype": "secondary_entrance",
                "position": {"x": 8, "z": round(venue_d * 0.42)},
                "dimensions": {"width": 15, "depth": 7, "height": 8},
                "rotation": 0,
                "capacity": 1350,
                "cost": 9500,
                "attractionWeight": 1.45,
                "colorAccent": "#0ea5e9",
                "covered": True,
                "accessibility": {
                    "wheelchairAccessible": True,
                    "stepFreeEntry": True,
                    "priorityQueue": True,
                },
            }
        )
        notes.append("남측 중앙 분산 출입구(+1,350명 수용 처리량)를 추가하여 폐장 퇴장 병목을 완화했습니다.")

    if not any(f.get("subtype") == "family_lounge" for f in opt):
        opt.append(
            {
                "id": "rest-opt-family",
                "name": "Stroller & Nursing Family Lounge",
                "nameKo": "유모차·수유 가족 쉼터",
                "category": "rest",
                "subtype": "family_lounge",
                "position": {"x": 16, "z": round(venue_d * 0.18)},
                "dimensions": {"width": 13, "depth": 9, "height": 4.2},
                "rotation": 0,
                "capacity": 180,
                "cost": 8200,
                "attractionWeight": 1.15,
                "colorAccent": "#f43f5e",
                "covered": True,
                "accessibility": {
                    "wheelchairAccessible": True,
                    "stepFreeEntry": True,
                    "priorityQueue": True,
                },
            }
        )
        notes.append("유모차 동반 가족 및 영유아를 위한 수유·가족 쉼터를 중앙 무장애 동선에 배치했습니다.")

    for f in opt:
        f.setdefault("accessibility", {})["wheelchairAccessible"] = True
        f["accessibility"]["stepFreeEntry"] = True

    if not notes:
        notes.append("기존 배치가 이미 분산 기준, 출입구 처리 용량, 무장애 접근성 기준을 충족합니다.")

    return opt, notes