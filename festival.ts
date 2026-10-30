export type Language = 'ko' | 'en';

export type EventType =
  | 'music_festival'
  | 'school_festival'
  | 'sports_event'
  | 'exhibition'
  | 'career_fair'
  | 'community_festival'
  | 'flea_market';

export type DesignObjective =
  | 'safety_first'
  | 'congestion_reduction'
  | 'accessibility_inclusion'
  | 'visitor_engagement'
  | 'operational_efficiency'
  | 'budget_efficiency';

export type ContingencyScenario =
  | 'normal'
  | 'rain'
  | 'surge'
  | 'stage_delay'
  | 'medical_emergency';

export type VisitorPersonaId =
  | 'wheelchair'
  | 'stroller'
  | 'children'
  | 'seniors'
  | 'foreigner';

export type MoisSafetyTier = 'safe' | 'caution' | 'warning' | 'danger';

export type FacilityCategory =
  | 'stage'
  | 'seating'
  | 'food'
  | 'booth'
  | 'rest'
  | 'restroom'
  | 'entrance'
  | 'medical'
  | 'parking'
  | 'vip'
  | 'camping';

export type FacilitySubtype =
  | 'main_stage'
  | 'secondary_stage'
  | 'seating_block'
  | 'food_truck'
  | 'food_stall'
  | 'experience_booth'
  | 'rest_plaza'
  | 'fountain_plaza'
  | 'play_zone'
  | 'family_lounge'
  | 'rain_canopy'
  | 'restroom_bank'
  | 'main_entrance'
  | 'secondary_entrance'
  | 'ticket_info'
  | 'multilingual_info'
  | 'medical_station'
  | 'parking_lot'
  | 'vip_lounge'
  | 'camping_zone';

export interface AccessibilitySettings {
  stepFreeRoutes: boolean;
  accessibleRestrooms: boolean;
  accessibleParking: boolean;
  wideCorridors: boolean;
}

export interface RequiredFacilitiesConfig {
  vipZone: boolean;
  campingArea: boolean;
  extraMedical: boolean;
  playRestZone: boolean;
}

export interface EventConfig {
  eventName: string;
  eventType: EventType;
  venueWidth: number; // X axis in meters (e.g., 200)
  venueDepth: number; // Z axis in meters (e.g., 150)
  expectedAttendance: number;
  startTime: string; // e.g., "10:00"
  endTime: string;   // e.g., "22:00"
  budget: number;    // in USD (1 USD ≈ 1,350 KRW for KRW display)
  objective: DesignObjective;
  foodBoothCount: number;
  experienceBoothCount: number;
  entranceCount: number;
  requiredFacilities: RequiredFacilitiesConfig;
  accessibility: AccessibilitySettings;
  seed: number;
}

export interface Facility {
  id: string;
  name: string;
  nameKo?: string;
  category: FacilityCategory;
  subtype: FacilitySubtype;
  position: {
    x: number;
    z: number;
  };
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
  rotation: number; // radians around Y
  capacity: number;
  cost: number;
  attractionWeight: number; // 0.1 to 3.0
  colorAccent: string;
  covered?: boolean;
  accessibility: {
    wheelchairAccessible: boolean;
    stepFreeEntry: boolean;
    priorityQueue: boolean;
  };
  notes?: string;
}

export interface LayerVisibility {
  stage: boolean;
  seating: boolean;
  food: boolean;
  booth: boolean;
  rest: boolean;
  restroom: boolean;
  entrance: boolean;
  medical: boolean;
  parking: boolean;
  vip: boolean;
  camping: boolean;
  landscaping: boolean;
  crowd: boolean;
  heatmap: boolean;
  pedestrianRoutes: boolean;
  evacuationRoutes: boolean;
  labels: boolean;
}

export type CameraViewMode = 'isometric' | 'top' | 'perspective';

export type EventPhaseId =
  | 'arrival'
  | 'afternoon_booths'
  | 'pre_show'
  | 'headline_show'
  | 'intermission'
  | 'egress';

export interface EventPhaseInfo {
  id: EventPhaseId;
  label: string;
  labelKo: string;
  shortLabel: string;
  shortLabelKo: string;
  progressRange: [number, number]; // 0.0 to 1.0
  description: string;
  descriptionKo: string;
}

export interface BottleneckAlert {
  facilityId: string;
  facilityName: string;
  category: FacilityCategory;
  peakDensity: number; // persons / m^2
  estimatedQueue: number; // people waiting
  utilizationRatio: number; // 0 to 2+
}

export interface TimelinePoint {
  timeLabel: string;
  progress: number;
  phaseLabel: string;
  phaseLabelKo?: string;
  peakDensity: number;
  avgDensity: number;
  activeVisitors: number;
  totalQueued: number;
  stageZoneShare: number;
  foodZoneShare: number;
  boothZoneShare: number;
}

export interface SimulationSnapshot {
  progress: number; // 0 to 1
  currentTimeLabel: string;
  phase: EventPhaseInfo;
  contingency: ContingencyScenario;
  activeAgentCount: number;
  simulatedScaleFactor: number; // real attendees represented per 3D agent
  peakDensity: number; // persons / m^2
  avgActiveDensity: number; // persons / m^2 in occupied cells
  mostCongestedZone: string;
  bottlenecks: BottleneckAlert[];
  facilityOccupancy: Record<string, number>;
  facilityQueues: Record<string, number>;
  gridCols: number;
  gridRows: number;
  densityGrid: Float32Array; // persons / m^2 per cell
  timelineSeries: TimelinePoint[];
}

export interface AnalysisScores {
  safety: number;              // 0-100
  accessibility: number;       // 0-100
  crowdFlow: number;           // 0-100
  distributionBalance: number; // 0-100
  operationalEfficiency: number; // 0-100
  budgetEfficiency: number;    // 0-100
  overall: number;             // 0-100 weighted by objective
}

export interface PersonaEvaluation {
  id: VisitorPersonaId;
  labelKo: string;
  labelEn: string;
  score: number; // 0-100
  maxContinuousWalkM: number;
  facilityCoveragePct: number;
  status: 'optimal' | 'needs_attention';
  keyFindingKo: string;
  keyFindingEn: string;
  upgradeActionLabelKo: string;
  upgradeActionLabelEn: string;
  highlightFacilityIds: string[];
}

export interface Recommendation {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: 'Safety' | 'Congestion' | 'Accessibility' | 'Operations' | 'Budget';
  title: string;
  titleKo?: string;
  rationale: string;
  rationaleKo?: string;
  metricTrigger: string;
  actionType?:
    | 'optimize_layout'
    | 'add_entrance'
    | 'add_food_booths'
    | 'enable_accessibility'
    | 'add_medical'
    | 'reoptimize_contingency';
  actionLabel?: string;
  actionLabelKo?: string;
}

export interface LayoutMetricsSummary {
  totalFacilities: number;
  totalCapacity: number;
  venueAreaSqm: number;
  peakDensity: number;
  moisSafetyTier: MoisSafetyTier;
  avgWalkingDistanceM: number;
  avgWaitMinutes: number;
  modeledBottlenecks: number;
  facilityUtilizationPct: number;
  estimatedCost: number;
  budgetUsagePct: number;
  scores: AnalysisScores;
}

export interface LayoutComparison {
  originalConfig: EventConfig;
  originalFacilities: Facility[];
  originalMetrics: LayoutMetricsSummary;
  optimizedFacilities: Facility[];
  optimizedMetrics: LayoutMetricsSummary;
  waitTimeDeltaPct: number;
  optimizationNotes: string[];
  optimizationNotesKo: string[];
  improved: boolean;
}

export interface CandidateLayout {
  id: 'A' | 'B' | 'C' | 'D';
  nameKo: string;
  nameEn: string;
  focusKo: string;
  focusEn: string;
  objective: DesignObjective;
  facilities: Facility[];
  configOverride: EventConfig;
  metrics: LayoutMetricsSummary;
  waitTimeDeltaPct: number;
  evaluatedVariations: number;
  highlightsKo: string[];
  highlightsEn: string[];
}

export interface XaiExplanation {
  executiveSummary: string;
  safetyComplianceVerdict: string;
  placementRationales: string[];
  inclusiveDesignHighlights: string[];
  contingencyProtocol: string;
  source: 'gemini' | 'heuristic';
  generatedAt: string;
}

export interface ParsedBriefResult {
  eventName: string;
  eventType: EventType;
  venueWidth: number;
  venueDepth: number;
  expectedAttendance: number;
  budget: number;
  objective: DesignObjective;
  foodBoothCount: number;
  experienceBoothCount: number;
  entranceCount: number;
  vipZone?: boolean;
  campingArea?: boolean;
  extraMedical?: boolean;
  playRestZone?: boolean;
  stepFreeRoutes?: boolean;
  wideCorridors?: boolean;
  accessibleRestrooms?: boolean;
  accessibleParking?: boolean;
  extractedSummary: string;
}

export interface SavedProjectPayload {
  schemaVersion: '1.1.0' | '1.0.0';
  savedAt: string;
  config: EventConfig;
  facilities: Facility[];
  activeLayoutMode: 'original' | 'optimized';
  contingency?: ContingencyScenario;
  optimizedFacilities: Facility[] | null;
  metricsSummary: LayoutMetricsSummary;
  personas?: PersonaEvaluation[];
}