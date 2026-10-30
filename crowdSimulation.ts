import {
  BottleneckAlert,
  ContingencyScenario,
  EventConfig,
  EventPhaseId,
  EventPhaseInfo,
  Facility,
  FacilityCategory,
  SimulationSnapshot,
  TimelinePoint,
} from '../types/festival';
import { EVENT_PHASES } from './presets';
import { createSeededRandom, hashStringSeed } from './prng';

export interface SimulatedAgent {
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  speed: number;
  targetX: number;
  targetZ: number;
  waypointsX: number[];
  waypointsZ: number[];
  wpIndex: number;
  targetFacilityId: string;
  dwellRemaining: number;
  laneOffset: number;
  colorIndex: number;
  active: boolean;
}

export interface RouteSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  isEvacuation?: boolean;
}

const GRID_COLS = 48;
const GRID_ROWS = 36;

const PHASE_CATEGORY_WEIGHTS: Record<EventPhaseId, Record<FacilityCategory, number>> = {
  arrival: {
    entrance: 2.8,
    parking: 1.5,
    booth: 1.4,
    food: 1.1,
    rest: 1.2,
    stage: 0.9,
    seating: 0.8,
    restroom: 0.9,
    vip: 0.8,
    camping: 1.6,
    medical: 0.15,
  },
  afternoon_booths: {
    entrance: 0.6,
    parking: 0.3,
    booth: 2.9,
    food: 2.1,
    rest: 2.2,
    stage: 1.3,
    seating: 1.2,
    restroom: 1.4,
    vip: 1.2,
    camping: 1.1,
    medical: 0.2,
  },
  pre_show: {
    entrance: 0.5,
    parking: 0.2,
    booth: 1.2,
    food: 1.5,
    rest: 1.1,
    stage: 3.1,
    seating: 3.0,
    restroom: 1.6,
    vip: 2.1,
    camping: 0.6,
    medical: 0.25,
  },
  headline_show: {
    entrance: 0.25,
    parking: 0.15,
    booth: 0.55,
    food: 0.75,
    rest: 0.65,
    stage: 4.5,
    seating: 4.2,
    restroom: 0.95,
    vip: 2.8,
    camping: 0.4,
    medical: 0.3,
  },
  intermission: {
    entrance: 0.4,
    parking: 0.2,
    booth: 1.3,
    food: 4.1,
    rest: 2.8,
    stage: 0.9,
    seating: 1.0,
    restroom: 4.2,
    vip: 1.8,
    camping: 0.8,
    medical: 0.35,
  },
  egress: {
    entrance: 4.6,
    parking: 3.4,
    booth: 0.25,
    food: 0.4,
    rest: 0.4,
    stage: 0.2,
    seating: 0.2,
    restroom: 1.1,
    vip: 0.3,
    camping: 1.5,
    medical: 0.2,
  },
};

function getActiveAttendanceFraction(progress: number, contingency: ContingencyScenario): number {
  let base = 0.5;
  if (progress < 0.18) {
    base = 0.32 + (progress / 0.18) * 0.46;
  } else if (progress < 0.40) {
    base = 0.78 + ((progress - 0.18) / 0.22) * 0.14;
  } else if (progress < 0.76) {
    base = 0.92 + Math.sin(((progress - 0.4) / 0.36) * Math.PI) * 0.08;
  } else if (progress < 0.88) {
    base = 0.94 - ((progress - 0.76) / 0.12) * 0.08;
  } else {
    base = Math.max(0.28, 0.86 - ((progress - 0.88) / 0.12) * 0.56);
  }

  if (contingency === 'surge') {
    return Math.min(1.35, base * 1.35);
  }
  if (contingency === 'rain') {
    return base * 0.94;
  }
  return base;
}

export function getPhaseForProgress(progress: number): EventPhaseInfo {
  const clamped = Math.max(0, Math.min(1, progress));
  for (const phase of EVENT_PHASES) {
    if (clamped >= phase.progressRange[0] && clamped <= phase.progressRange[1]) {
      return phase;
    }
  }
  return EVENT_PHASES[EVENT_PHASES.length - 1];
}

export function formatTimeFromProgress(
  progress: number,
  startTime: string,
  endTime: string,
): string {
  const parseMinutes = (str: string, fallback: number) => {
    const parts = str.split(':').map(Number);
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    return fallback;
  };
  const startMin = parseMinutes(startTime, 10 * 60);
  let endMin = parseMinutes(endTime, 22 * 60);
  if (endMin <= startMin) endMin += 12 * 60;

  const currentMin = Math.round(startMin + Math.max(0, Math.min(1, progress)) * (endMin - startMin));
  const hrs = Math.floor((currentMin % (24 * 60)) / 60);
  const mins = currentMin % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function buildVenueRoutes(config: EventConfig, facilities: Facility[]): RouteSegment[] {
  const W = config.venueWidth;
  const D = config.venueDepth;
  const corridorW = config.accessibility.wideCorridors ? 5.2 : 3.8;
  const routes: RouteSegment[] = [];

  const hubZ = 6;
  const westX = -W * 0.2;
  const eastX = W * 0.2;
  const northZ = -D * 0.22;
  const southZ = D * 0.28;

  routes.push({ x1: -W * 0.38, z1: hubZ, x2: W * 0.38, z2: hubZ, width: corridorW });
  routes.push({ x1: -W * 0.34, z1: southZ, x2: W * 0.34, z2: southZ, width: corridorW });
  routes.push({ x1: westX, z1: northZ, x2: westX, z2: southZ, width: corridorW });
  routes.push({ x1: eastX, z1: northZ, x2: eastX, z2: southZ, width: corridorW });
  routes.push({ x1: -7, z1: northZ - 6, x2: -7, z2: southZ, width: corridorW * 1.15 });

  for (const f of facilities) {
    if (f.category === 'entrance') {
      const targetX = Math.abs(f.position.x) > W * 0.3 ? (f.position.x > 0 ? eastX : westX) : f.position.x;
      const targetZ = Math.abs(f.position.z) > D * 0.3 ? southZ : hubZ;
      routes.push({
        x1: f.position.x,
        z1: f.position.z,
        x2: targetX,
        z2: targetZ,
        width: corridorW,
      });
    }
  }

  routes.push({
    x1: -7,
    z1: -D * 0.26,
    x2: -7,
    z2: D * 0.45,
    width: 4.5,
    isEvacuation: true,
  });
  routes.push({
    x1: -W * 0.45,
    z1: hubZ,
    x2: W * 0.45,
    z2: hubZ,
    width: 4.5,
    isEvacuation: true,
  });

  const medicals = facilities.filter((f) => f.category === 'medical');
  for (const med of medicals) {
    routes.push({
      x1: med.position.x,
      z1: med.position.z,
      x2: med.position.x > 0 ? W * 0.46 : -W * 0.46,
      z2: med.position.z,
      width: 4.4,
      isEvacuation: true,
    });
  }

  return routes;
}

function isFacilityCovered(f: Facility): boolean {
  if (typeof f.covered === 'boolean') return f.covered;
  return (
    f.subtype === 'experience_booth' ||
    f.subtype === 'food_stall' ||
    f.subtype === 'vip_lounge' ||
    f.subtype === 'family_lounge' ||
    f.subtype === 'rain_canopy' ||
    f.subtype === 'restroom_bank' ||
    f.subtype === 'medical_station' ||
    f.subtype === 'ticket_info' ||
    f.subtype === 'multilingual_info'
  );
}

export class CrowdSimulator {
  private config: EventConfig;
  private facilities: Facility[];
  private contingency: ContingencyScenario = 'normal';
  public agents: SimulatedAgent[] = [];
  public maxAgents = 750;
  private currentProgress = 0.62;
  private currentPhaseId: EventPhaseId = 'headline_show';
  private rand: () => number;
  private densityGrid = new Float32Array(GRID_COLS * GRID_ROWS);
  private scratchGrid = new Float32Array(GRID_COLS * GRID_ROWS);
  private cachedTimeline: TimelinePoint[] = [];

  private bucketHeads = new Int32Array(256);
  private bucketNext = new Int32Array(900);

  constructor(
    config: EventConfig,
    facilities: Facility[],
    contingency: ContingencyScenario = 'normal',
  ) {
    this.config = config;
    this.facilities = facilities;
    this.contingency = contingency;
    this.rand = createSeededRandom(config.seed ^ 0x9e3779b9);
    this.rebuild(config, facilities, this.currentProgress, contingency);
  }

  public getGridDimensions(): { cols: number; rows: number } {
    return { cols: GRID_COLS, rows: GRID_ROWS };
  }

  public getContingency(): ContingencyScenario {
    return this.contingency;
  }

  public rebuild(
    config: EventConfig,
    facilities: Facility[],
    progress = this.currentProgress,
    contingency: ContingencyScenario = this.contingency,
  ): void {
    this.config = config;
    this.facilities = facilities;
    this.contingency = contingency;
    this.currentProgress = Math.max(0, Math.min(1, progress));
    this.currentPhaseId = getPhaseForProgress(this.currentProgress).id;

    const layoutHash = facilities
      .map((f) => `${f.id}:${Math.round(f.position.x)},${Math.round(f.position.z)},${f.capacity}`)
      .join('|');
    this.rand = createSeededRandom(config.seed ^ hashStringSeed(`${layoutHash}-${contingency}`));

    const effectiveAttendance =
      contingency === 'surge' ? Math.round(config.expectedAttendance * 1.35) : config.expectedAttendance;

    const targetCount = Math.min(
      820,
      Math.max(220, Math.round(180 + Math.sqrt(effectiveAttendance) * 5.2)),
    );
    this.maxAgents = targetCount;
    this.agents = new Array(targetCount);

    const speedFactor = contingency === 'rain' ? 0.82 : 1.0;

    for (let i = 0; i < targetCount; i++) {
      this.agents[i] = {
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        heading: this.rand() * Math.PI * 2,
        speed: (4.2 + this.rand() * 2.4) * speedFactor,
        targetX: 0,
        targetZ: 0,
        waypointsX: [0, 0, 0],
        waypointsZ: [0, 0, 0],
        wpIndex: 0,
        targetFacilityId: '',
        dwellRemaining: 0,
        laneOffset: (this.rand() - 0.5) * 4.4,
        colorIndex: i % 4,
        active: true,
      };
    }

    this.cachedTimeline = this.computeFullDayTimeline();
    this.distributeAgentsForPhase(this.currentProgress, true);
  }

  private getEffectiveFacilityWeight(f: Facility, phaseId: EventPhaseId): number {
    const baseWeights = PHASE_CATEGORY_WEIGHTS[phaseId];
    let catMult = baseWeights[f.category] ?? 1.0;

    if (this.contingency === 'rain') {
      if (f.subtype === 'rain_canopy') {
        catMult *= 4.2;
      } else if (isFacilityCovered(f)) {
        catMult *= 2.35;
      } else {
        catMult *= 0.28;
      }
    } else if (this.contingency === 'stage_delay') {
      if (f.category === 'stage' || f.category === 'seating') {
        catMult *= 0.35;
      } else if (f.category === 'food' || f.category === 'restroom' || f.category === 'booth') {
        catMult *= 2.15;
      }
    } else if (this.contingency === 'surge') {
      if (f.category === 'entrance' || f.category === 'food' || f.category === 'restroom') {
        catMult *= 1.38;
      }
    } else if (this.contingency === 'medical_emergency') {
      if (f.category === 'medical') {
        catMult *= 1.8;
      }
    }

    return Math.max(0.05, f.attractionWeight * catMult * Math.sqrt(Math.max(50, f.capacity) / 200));
  }

  private pickTargetFacility(phaseId: EventPhaseId, r: () => number): Facility {
    if (this.facilities.length === 0) {
      return {
        id: 'center',
        name: 'Central Plaza',
        category: 'rest',
        subtype: 'rest_plaza',
        position: { x: 0, z: 0 },
        dimensions: { width: 16, depth: 16, height: 1 },
        rotation: 0,
        capacity: 500,
        cost: 0,
        attractionWeight: 1,
        colorAccent: '#3b82f6',
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: false },
      };
    }

    let totalW = 0;
    for (let i = 0; i < this.facilities.length; i++) {
      totalW += this.getEffectiveFacilityWeight(this.facilities[i], phaseId);
    }

    let roll = r() * totalW;
    for (let i = 0; i < this.facilities.length; i++) {
      const f = this.facilities[i];
      roll -= this.getEffectiveFacilityWeight(f, phaseId);
      if (roll <= 0) return f;
    }
    return this.facilities[this.facilities.length - 1];
  }

  private samplePointNearFacility(f: Facility, r: () => number): { x: number; z: number } {
    const isRot90 = Math.abs(Math.sin(f.rotation)) > 0.7;
    const effW = isRot90 ? f.dimensions.depth : f.dimensions.width;
    const effD = isRot90 ? f.dimensions.width : f.dimensions.depth;

    if (f.category === 'stage') {
      return {
        x: f.position.x + (r() - 0.5) * (effW * 0.95),
        z: f.position.z + effD * 0.5 + 2.5 + r() * 9.5,
      };
    }
    if (f.category === 'seating' || f.category === 'rest' || f.category === 'camping') {
      return {
        x: f.position.x + (r() - 0.5) * (effW * 0.82),
        z: f.position.z + (r() - 0.5) * (effD * 0.82),
      };
    }
    const angle = r() * Math.PI * 2;
    const dist = 1.5 + r() * 4.5;
    return {
      x: f.position.x + Math.cos(angle) * (effW * 0.42 + dist * 0.6),
      z: f.position.z + Math.sin(angle) * (effD * 0.42 + dist * 0.6),
    };
  }

  private assignRouteToAgent(agent: SimulatedAgent, dest: Facility, r: () => number): void {
    const pt = this.samplePointNearFacility(dest, r);
    const W = this.config.venueWidth;
    const D = this.config.venueDepth;
    let clampedX = Math.max(-W * 0.46, Math.min(W * 0.46, pt.x));
    const clampedZ = Math.max(-D * 0.46, Math.min(D * 0.46, pt.z));

    // Keep central ambulance corridor (x ≈ -7) clear during medical emergency
    if (this.contingency === 'medical_emergency' && Math.abs(clampedX + 7) < 5.5) {
      clampedX = clampedX >= -7 ? -1.0 : -13.0;
    }

    const midHubX =
      Math.abs(agent.x - clampedX) > 32
        ? (agent.x + clampedX) * 0.5 + agent.laneOffset
        : clampedX + agent.laneOffset * 0.4;
    const midHubZ =
      Math.abs(agent.z - clampedZ) > 28
        ? Math.abs(clampedZ) < 18
          ? 6 + agent.laneOffset
          : (agent.z + clampedZ) * 0.5
        : clampedZ;

    agent.waypointsX[0] = Math.max(-W * 0.45, Math.min(W * 0.45, midHubX));
    agent.waypointsZ[0] = Math.max(-D * 0.45, Math.min(D * 0.45, midHubZ));
    agent.waypointsX[1] = clampedX;
    agent.waypointsZ[1] = clampedZ;
    agent.wpIndex = 0;
    agent.targetX = clampedX;
    agent.targetZ = clampedZ;
    agent.targetFacilityId = dest.id;
    agent.dwellRemaining = 1.5 + r() * 5.0;

    if (dest.category === 'stage' || dest.category === 'seating') agent.colorIndex = 1;
    else if (dest.category === 'food' || dest.category === 'rest') agent.colorIndex = 2;
    else if (dest.category === 'vip') agent.colorIndex = 3;
    else agent.colorIndex = 0;
  }

  public distributeAgentsForPhase(progress: number, instantPlace: boolean): void {
    this.currentProgress = Math.max(0, Math.min(1, progress));
    const phase = getPhaseForProgress(this.currentProgress);
    this.currentPhaseId = phase.id;

    const activeFrac = Math.min(1.0, getActiveAttendanceFraction(this.currentProgress, this.contingency));
    const activeCount = Math.max(15, Math.round(this.maxAgents * activeFrac));

    const phaseSeed =
      this.config.seed ^
      hashStringSeed(`${phase.id}-${this.contingency}-${Math.round(this.currentProgress * 100)}`);
    const localRand = createSeededRandom(phaseSeed);

    const entrances = this.facilities.filter((f) => f.category === 'entrance');

    for (let i = 0; i < this.maxAgents; i++) {
      const ag = this.agents[i];
      ag.active = i < activeCount;
      if (!ag.active) continue;

      const dest = this.pickTargetFacility(phase.id, localRand);
      if (instantPlace) {
        if (localRand() < 0.68) {
          const pos = this.samplePointNearFacility(dest, localRand);
          ag.x = pos.x;
          ag.z = pos.z;
          if (this.contingency === 'medical_emergency' && Math.abs(ag.x + 7) < 5.5) {
            ag.x = ag.x >= -7 ? -1.0 : -13.0;
          }
          const nextDest = this.pickTargetFacility(phase.id, localRand);
          this.assignRouteToAgent(ag, nextDest, localRand);
          ag.dwellRemaining = localRand() * 3.5;
        } else {
          const originFacility =
            phase.id === 'arrival' && entrances.length > 0
              ? entrances[i % entrances.length]
              : this.pickTargetFacility(phase.id, localRand);
          const startPos = this.samplePointNearFacility(originFacility, localRand);
          const endPos = this.samplePointNearFacility(dest, localRand);
          const t = localRand();
          ag.x = startPos.x + (endPos.x - startPos.x) * t + ag.laneOffset * 0.5;
          ag.z = startPos.z + (endPos.z - startPos.z) * t;
          if (this.contingency === 'medical_emergency' && Math.abs(ag.x + 7) < 5.5) {
            ag.x = ag.x >= -7 ? -1.0 : -13.0;
          }
          this.assignRouteToAgent(ag, dest, localRand);
          ag.dwellRemaining = 0;
        }
      } else {
        this.assignRouteToAgent(ag, dest, localRand);
      }
    }
  }

  public step(dt: number, speedMultiplier: number, isPlaying: boolean): void {
    const clampedDt = Math.min(0.08, Math.max(0.001, dt));

    if (isPlaying) {
      const nextProgress = this.currentProgress + (clampedDt * speedMultiplier) / 75;
      this.currentProgress = nextProgress > 1 ? 0 : nextProgress;

      const newPhase = getPhaseForProgress(this.currentProgress);
      if (newPhase.id !== this.currentPhaseId) {
        this.currentPhaseId = newPhase.id;
        this.distributeAgentsForPhase(this.currentProgress, false);
      } else {
        const activeFrac = Math.min(
          1.0,
          getActiveAttendanceFraction(this.currentProgress, this.contingency),
        );
        const activeCount = Math.max(15, Math.round(this.maxAgents * activeFrac));
        for (let i = 0; i < this.maxAgents; i++) {
          this.agents[i].active = i < activeCount;
        }
      }
    }

    this.bucketHeads.fill(-1);
    const W = this.config.venueWidth;
    const D = this.config.venueDepth;
    const halfW = W * 0.5;
    const halfD = D * 0.5;

    for (let i = 0; i < this.maxAgents; i++) {
      const ag = this.agents[i];
      if (!ag.active) continue;
      const bx = Math.max(0, Math.min(15, Math.floor(((ag.x + halfW) / W) * 16)));
      const bz = Math.max(0, Math.min(15, Math.floor(((ag.z + halfD) / D) * 16)));
      const bIdx = bz * 16 + bx;
      this.bucketNext[i] = this.bucketHeads[bIdx];
      this.bucketHeads[bIdx] = i;
    }

    const moveDt = clampedDt * (isPlaying ? Math.max(0.5, Math.min(3.0, speedMultiplier)) : 0.45);

    for (let i = 0; i < this.maxAgents; i++) {
      const ag = this.agents[i];
      if (!ag.active) continue;

      // Active emergency ambulance corridor repulsion when medical_emergency is active
      if (this.contingency === 'medical_emergency' && Math.abs(ag.x + 7) < 5.2) {
        const pushDir = ag.x >= -7 ? 1 : -1;
        ag.x += pushDir * 8.5 * moveDt;
      }

      if (ag.dwellRemaining > 0) {
        ag.dwellRemaining -= moveDt;
        ag.x += Math.sin(i * 1.7 + this.currentProgress * 120) * 0.015;
        continue;
      }

      const wx = ag.waypointsX[ag.wpIndex];
      const wz = ag.waypointsZ[ag.wpIndex];
      const dx = wx - ag.x;
      const dz = wz - ag.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < 4.0) {
        if (ag.wpIndex < 1) {
          ag.wpIndex++;
        } else {
          const nextDest = this.pickTargetFacility(this.currentPhaseId, this.rand);
          this.assignRouteToAgent(ag, nextDest, this.rand);
        }
        continue;
      }

      const dist = Math.sqrt(distSq);
      let dirX = dx / dist;
      let dirZ = dz / dist;

      const bx = Math.max(0, Math.min(15, Math.floor(((ag.x + halfW) / W) * 16)));
      const bz = Math.max(0, Math.min(15, Math.floor(((ag.z + halfD) / D) * 16)));
      let sepX = 0;
      let sepZ = 0;
      let checks = 0;
      let neighbor = this.bucketHeads[bz * 16 + bx];
      while (neighbor !== -1 && checks < 8) {
        if (neighbor !== i) {
          const other = this.agents[neighbor];
          const ox = ag.x - other.x;
          const oz = ag.z - other.z;
          const d2 = ox * ox + oz * oz;
          if (d2 > 0.01 && d2 < 3.6) {
            const inv = 1 / Math.sqrt(d2);
            sepX += ox * inv;
            sepZ += oz * inv;
          }
          checks++;
        }
        neighbor = this.bucketNext[neighbor];
      }

      dirX += sepX * 0.42;
      dirZ += sepZ * 0.42;
      const norm = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
      dirX /= norm;
      dirZ /= norm;

      ag.vx = dirX * ag.speed;
      ag.vz = dirZ * ag.speed;
      ag.x = Math.max(-halfW + 3, Math.min(halfW - 3, ag.x + ag.vx * moveDt));
      ag.z = Math.max(-halfD + 3, Math.min(halfD - 3, ag.z + ag.vz * moveDt));
      ag.heading = Math.atan2(ag.vx, ag.vz);
    }
  }

  public seekToProgress(progress: number): void {
    this.distributeAgentsForPhase(progress, true);
  }

  public getSnapshot(): SimulationSnapshot {
    const W = this.config.venueWidth;
    const D = this.config.venueDepth;
    const halfW = W * 0.5;
    const halfD = D * 0.5;
    const cellAreaSqm = (W / GRID_COLS) * (D / GRID_ROWS);

    let activeAgents = 0;
    for (let i = 0; i < this.maxAgents; i++) {
      if (this.agents[i].active) activeAgents++;
    }

    const activeFraction = getActiveAttendanceFraction(this.currentProgress, this.contingency);
    const activeRealVisitors = Math.round(this.config.expectedAttendance * activeFraction);
    const visitorsPerAgent = activeAgents > 0 ? activeRealVisitors / activeAgents : 1;

    this.scratchGrid.fill(0);

    for (let i = 0; i < this.maxAgents; i++) {
      const ag = this.agents[i];
      if (!ag.active) continue;
      const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(((ag.x + halfW) / W) * GRID_COLS)));
      const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(((ag.z + halfD) / D) * GRID_ROWS)));
      this.scratchGrid[row * GRID_COLS + col] += visitorsPerAgent / cellAreaSqm;
    }

    this.densityGrid.fill(0);
    let peakDensity = 0;
    let occupiedSum = 0;
    let occupiedCells = 0;
    let peakCol = 0;
    let peakRow = 0;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        let acc = 0;
        let weightSum = 0;
        for (let dr = -1; dr <= 1; dr++) {
          const nr = r + dr;
          if (nr < 0 || nr >= GRID_ROWS) continue;
          for (let dc = -1; dc <= 1; dc++) {
            const nc = c + dc;
            if (nc < 0 || nc >= GRID_COLS) continue;
            const w = dr === 0 && dc === 0 ? 4 : dr === 0 || dc === 0 ? 2 : 1;
            acc += this.scratchGrid[nr * GRID_COLS + nc] * w;
            weightSum += w;
          }
        }
        const corridorRelief = this.config.accessibility.wideCorridors ? 0.9 : 1.0;
        const val = (acc / weightSum) * corridorRelief;
        this.densityGrid[r * GRID_COLS + c] = val;
        if (val > peakDensity) {
          peakDensity = val;
          peakCol = c;
          peakRow = r;
        }
        if (val > 0.12) {
          occupiedSum += val;
          occupiedCells++;
        }
      }
    }

    const facilityOccupancy: Record<string, number> = {};
    const facilityQueues: Record<string, number> = {};
    for (const f of this.facilities) {
      facilityOccupancy[f.id] = 0;
      facilityQueues[f.id] = 0;
    }

    for (let i = 0; i < this.maxAgents; i++) {
      const ag = this.agents[i];
      if (!ag.active) continue;
      let nearest: Facility | null = null;
      let bestDistSq = Infinity;
      for (let j = 0; j < this.facilities.length; j++) {
        const f = this.facilities[j];
        const radius = Math.max(f.dimensions.width, f.dimensions.depth) * 0.85 + 9;
        const dx = ag.x - f.position.x;
        const dz = ag.z - f.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius && d2 < bestDistSq) {
          bestDistSq = d2;
          nearest = f;
        }
      }
      if (nearest) {
        facilityOccupancy[nearest.id] = Math.round(
          (facilityOccupancy[nearest.id] || 0) + visitorsPerAgent,
        );
      }
    }

    const bottlenecks: BottleneckAlert[] = [];
    for (const f of this.facilities) {
      const occ = facilityOccupancy[f.id] || 0;
      const effectiveServiceCap = Math.max(60, f.capacity);
      const util = occ / effectiveServiceCap;
      const queue =
        occ > effectiveServiceCap * 0.82 ? Math.round((occ - effectiveServiceCap * 0.82) * 0.65) : 0;
      facilityQueues[f.id] = queue;

      const fCol = Math.max(
        0,
        Math.min(GRID_COLS - 1, Math.floor(((f.position.x + halfW) / W) * GRID_COLS)),
      );
      const fRow = Math.max(
        0,
        Math.min(GRID_ROWS - 1, Math.floor(((f.position.z + halfD) / D) * GRID_ROWS)),
      );
      let localMaxDensity = this.densityGrid[fRow * GRID_COLS + fCol];
      if (fRow + 1 < GRID_ROWS) {
        localMaxDensity = Math.max(localMaxDensity, this.densityGrid[(fRow + 1) * GRID_COLS + fCol]);
      }

      if (util > 0.92 || localMaxDensity > 2.15 || queue >= 35) {
        bottlenecks.push({
          facilityId: f.id,
          facilityName: f.nameKo || f.name,
          category: f.category,
          peakDensity: Number(Math.max(localMaxDensity, util * 1.9).toFixed(2)),
          estimatedQueue: queue,
          utilizationRatio: Number(util.toFixed(2)),
        });
      }
    }

    bottlenecks.sort((a, b) => b.peakDensity - a.peakDensity);

    const peakWorldX = -halfW + ((peakCol + 0.5) / GRID_COLS) * W;
    const peakWorldZ = -halfD + ((peakRow + 0.5) / GRID_ROWS) * D;
    let mostCongestedZone = '중앙 보행 광장';
    let minZoneDist = Infinity;
    for (const f of this.facilities) {
      const d = Math.hypot(f.position.x - peakWorldX, f.position.z - peakWorldZ);
      if (d < minZoneDist) {
        minZoneDist = d;
        mostCongestedZone = f.nameKo || f.name;
      }
    }

    return {
      progress: this.currentProgress,
      currentTimeLabel: formatTimeFromProgress(
        this.currentProgress,
        this.config.startTime,
        this.config.endTime,
      ),
      phase: getPhaseForProgress(this.currentProgress),
      contingency: this.contingency,
      activeAgentCount: activeAgents,
      simulatedScaleFactor: Number(visitorsPerAgent.toFixed(1)),
      peakDensity: Number(peakDensity.toFixed(2)),
      avgActiveDensity: Number((occupiedCells > 0 ? occupiedSum / occupiedCells : 0).toFixed(2)),
      mostCongestedZone,
      bottlenecks: bottlenecks.slice(0, 5),
      facilityOccupancy,
      facilityQueues,
      gridCols: GRID_COLS,
      gridRows: GRID_ROWS,
      densityGrid: this.densityGrid,
      timelineSeries: this.cachedTimeline,
    };
  }

  private computeFullDayTimeline(): TimelinePoint[] {
    const points: TimelinePoint[] = [];
    const steps = 12;
    const W = this.config.venueWidth;
    const D = this.config.venueDepth;
    const areaFactor = (200 * 150) / Math.max(8000, W * D);
    const surgeMult = this.contingency === 'surge' ? 1.35 : 1.0;
    const baseCrowdLoad = ((this.config.expectedAttendance * surgeMult) / 10000) * Math.sqrt(areaFactor);

    const foodCount = Math.max(1, this.facilities.filter((f) => f.category === 'food').length);
    const restroomCount = Math.max(1, this.facilities.filter((f) => f.category === 'restroom').length);
    const rainCanopyCount = this.facilities.filter((f) => f.subtype === 'rain_canopy').length;
    const entranceCap = Math.max(
      600,
      this.facilities
        .filter((f) => f.category === 'entrance')
        .reduce((s, f) => s + f.capacity, 0),
    );

    const foods = this.facilities.filter((f) => f.category === 'food');
    const foodSpread =
      foods.length >= 2
        ? Math.max(...foods.map((f) => f.position.x)) - Math.min(...foods.map((f) => f.position.x))
        : 20;
    const clusterPenalty = foodSpread < W * 0.25 ? 1.24 : 0.92;
    const rainPenalty =
      this.contingency === 'rain' ? Math.max(0.95, 1.36 - rainCanopyCount * 0.16) : 1.0;

    for (let s = 0; s <= steps; s++) {
      const p = s / steps;
      const phase = getPhaseForProgress(p);
      const activeFrac = getActiveAttendanceFraction(p, this.contingency);
      const activeVisitors = Math.round(this.config.expectedAttendance * activeFrac);

      let phasePeakMult = 1.6;
      let queued = 0;
      let stageShare = 25;
      let foodShare = 20;
      let boothShare = 30;

      if (phase.id === 'arrival') {
        phasePeakMult = 1.75 * (3000 / entranceCap);
        queued = Math.round(Math.max(0, activeVisitors * 0.18 - entranceCap * 0.45));
        stageShare = 18;
        foodShare = 16;
        boothShare = 28;
      } else if (phase.id === 'afternoon_booths') {
        phasePeakMult = 1.45 * rainPenalty;
        queued = Math.round(activeVisitors * 0.05 * rainPenalty);
        stageShare = 22;
        foodShare = 26;
        boothShare = 42;
      } else if (phase.id === 'pre_show') {
        phasePeakMult = (this.contingency === 'stage_delay' ? 2.65 : 2.25) * rainPenalty;
        queued = Math.round(activeVisitors * (this.contingency === 'stage_delay' ? 0.14 : 0.07));
        stageShare = this.contingency === 'stage_delay' ? 26 : 52;
        foodShare = this.contingency === 'stage_delay' ? 38 : 20;
        boothShare = this.contingency === 'stage_delay' ? 28 : 18;
      } else if (phase.id === 'headline_show') {
        phasePeakMult = (this.contingency === 'stage_delay' ? 2.75 : 2.85) * rainPenalty;
        queued = Math.round(activeVisitors * (this.contingency === 'stage_delay' ? 0.16 : 0.04));
        stageShare = this.contingency === 'stage_delay' ? 30 : 68;
        foodShare = this.contingency === 'stage_delay' ? 40 : 12;
        boothShare = this.contingency === 'stage_delay' ? 22 : 10;
      } else if (phase.id === 'intermission') {
        phasePeakMult =
          ((2.55 * clusterPenalty * 5) / Math.max(2.5, foodCount + restroomCount * 0.6)) * rainPenalty;
        queued = Math.round(
          ((activeVisitors * 0.22 * clusterPenalty) / Math.max(1.5, foodCount * 0.38)) * rainPenalty,
        );
        stageShare = 20;
        foodShare = 46;
        boothShare = 22;
      } else {
        phasePeakMult = 2.1 * (3200 / entranceCap);
        queued = Math.round(Math.max(0, activeVisitors * 0.24 - entranceCap * 0.5));
        stageShare = 10;
        foodShare = 10;
        boothShare = 12;
      }

      const corridorRelief = this.config.accessibility.wideCorridors ? 0.91 : 1.0;
      const peakDensity = Number(
        Math.min(5.4, Math.max(0.35, baseCrowdLoad * phasePeakMult * corridorRelief)).toFixed(2),
      );
      const avgDensity = Number((peakDensity * 0.36).toFixed(2));

      points.push({
        timeLabel: formatTimeFromProgress(p, this.config.startTime, this.config.endTime),
        progress: p,
        phaseLabel: phase.shortLabel,
        phaseLabelKo: phase.shortLabelKo,
        peakDensity,
        avgDensity,
        activeVisitors,
        totalQueued: Math.max(0, queued),
        stageZoneShare: stageShare,
        foodZoneShare: foodShare,
        boothZoneShare: boothShare,
      });
    }
    return points;
  }
}