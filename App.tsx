import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DEFAULT_EVENT_CONFIG,
  DEFAULT_FACILITIES,
  DEFAULT_LAYER_VISIBILITY,
  EVENT_TYPE_PRESETS,
  formatCurrency,
  getFacilityDisplayName,
  MOIS_SAFETY_TIER_LABELS,
} from './engine/presets';
import {
  applyInclusivePersonaUpgrade,
  generateVenueLayout,
  parseBriefDeterministically,
  reoptimizeForContingency,
  validateEventConfig,
} from './engine/layoutGenerator';
import { CrowdSimulator } from './engine/crowdSimulation';
import {
  buildDeterministicXaiReport,
  buildLayoutComparison,
  evaluateInclusivePersonas,
  evaluateVenueLayout,
  generateMultiObjectiveCandidates,
  generateRuleBasedRecommendations,
} from './engine/analyticsEngine';
import {
  CandidateLayout,
  ContingencyScenario,
  DesignObjective,
  EventConfig,
  EventType,
  Facility,
  Language,
  LayerVisibility,
  ParsedBriefResult,
  Recommendation,
  SavedProjectPayload,
  SimulationSnapshot,
  VisitorPersonaId,
  XaiExplanation,
} from './types/festival';
import { LeftSidebar } from './components/LeftSidebar';
import { ThreeVenueCanvas } from './components/ThreeVenueCanvas';
import { SimulationTimelineDock } from './components/SimulationTimelineDock';
import { RightSidebar } from './components/RightSidebar';
import { BottomSummaryBar } from './components/BottomSummaryBar';
import { ComparisonView } from './components/ComparisonView';
import { AnalyticsView } from './components/AnalyticsView';
import { IntegrationView } from './components/IntegrationView';
import { XaiReportView } from './components/XaiReportView';

type NavSection = 'workspace' | 'comparison' | 'analytics' | 'xai_report' | 'integration';

const STORAGE_PREFIX = 'ai_festival_designer_proj_';

const VALID_EVENT_TYPES: EventType[] = [
  'music_festival',
  'school_festival',
  'sports_event',
  'exhibition',
  'career_fair',
  'community_festival',
  'flea_market',
];

const VALID_OBJECTIVES: DesignObjective[] = [
  'safety_first',
  'congestion_reduction',
  'accessibility_inclusion',
  'visitor_engagement',
  'operational_efficiency',
  'budget_efficiency',
];

declare global {
  interface Window {
    __STREAMLIT_INITIAL_PAYLOAD__?: {
      config?: Partial<EventConfig>;
      facilities?: Facility[];
      contingency?: ContingencyScenario;
    };
  }
}

export default function App() {
  // Check if launched inside Streamlit with pre-injected configuration
  const initialBootstrap = useMemo(() => {
    const ext = window.__STREAMLIT_INITIAL_PAYLOAD__;
    const cfg: EventConfig = ext?.config
      ? { ...DEFAULT_EVENT_CONFIG, ...ext.config }
      : DEFAULT_EVENT_CONFIG;
    const facs: Facility[] =
      ext?.facilities && Array.isArray(ext.facilities) && ext.facilities.length > 0
        ? ext.facilities
        : DEFAULT_FACILITIES;
    const cont: ContingencyScenario = ext?.contingency || 'normal';
    return { cfg, facs, cont };
  }, []);

  const [language, setLanguage] = useState<Language>('ko');
  const [activeNav, setActiveNav] = useState<NavSection>('workspace');
  const [config, setConfig] = useState<EventConfig>(initialBootstrap.cfg);
  const [originalFacilities, setOriginalFacilities] = useState<Facility[]>(initialBootstrap.facs);
  const [activeLayoutMode, setActiveLayoutMode] = useState<'original' | 'optimized'>('original');
  const [contingency, setContingency] = useState<ContingencyScenario>(initialBootstrap.cont);
  const [visibility, setVisibility] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [activePersonaId, setActivePersonaId] = useState<VisitorPersonaId | null>(null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);

  // Generative AI Natural-Language Brief Parser state
  const [aiPrompt, setAiPrompt] = useState<string>(
    '건양고등학교 운동장(160m×130m)에서 3,200명 규모 한솔 대동제를 기획 중입니다. 예산은 약 1억 원이며, 푸드트럭 6개와 학생 체험부스 9개, 휠체어·유모차·어르신 모두 안전한 포용적 무장애 동선으로 자동 설계해 주세요.',
  );
  const [isParsingBrief, setIsParsingBrief] = useState<boolean>(false);
  const [aiBriefSummary, setAiBriefSummary] = useState<string | null>(null);

  // Multi-objective Candidate & XAI Report state
  const [candidateSeedOffset, setCandidateSeedOffset] = useState<number>(0);
  const [approvedCandidateId, setApprovedCandidateId] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [aiXaiOverride, setAiXaiOverride] = useState<XaiExplanation | null>(null);
  const [isGeneratingAiXai, setIsGeneratingAiXai] = useState<boolean>(false);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);
  const [savedProjectsVersion, setSavedProjectsVersion] = useState(0);

  const isKo = language === 'ko';

  // Build deterministic Before/After comparison whenever config, baseline facilities, or contingency change
  const comparison = useMemo(
    () => buildLayoutComparison(config, originalFacilities, 0.64, contingency),
    [config, originalFacilities, contingency],
  );

  const activeFacilities =
    activeLayoutMode === 'optimized'
      ? comparison.optimizedFacilities
      : originalFacilities;

  const activeEffectiveConfig = useMemo<EventConfig>(() => {
    if (activeLayoutMode === 'optimized') {
      return {
        ...config,
        accessibility: {
          ...config.accessibility,
          stepFreeRoutes: true,
          wideCorridors: true,
        },
      };
    }
    return config;
  }, [config, activeLayoutMode]);

  // Persistent CrowdSimulator instance
  const simulatorRef = useRef<CrowdSimulator>(
    new CrowdSimulator(activeEffectiveConfig, activeFacilities, contingency),
  );

  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() =>
    simulatorRef.current.getSnapshot(),
  );

  // Rebuild simulator whenever active config, active facilities, or contingency scenario change
  useEffect(() => {
    simulatorRef.current.rebuild(
      activeEffectiveConfig,
      activeFacilities,
      simulatorRef.current.getSnapshot().progress,
      contingency,
    );
    setSnapshot(simulatorRef.current.getSnapshot());
  }, [activeEffectiveConfig, activeFacilities, contingency]);

  // Clear stale Gemini XAI override when underlying layout/scenario changes
  useEffect(() => {
    setAiXaiOverride(null);
  }, [activeEffectiveConfig, activeFacilities, contingency, language]);

  // Live evaluation metrics, 5 Inclusive Personas, Candidates A–D, XAI report & recommendations
  const summary = useMemo(
    () => evaluateVenueLayout(activeEffectiveConfig, activeFacilities, snapshot),
    [activeEffectiveConfig, activeFacilities, snapshot],
  );

  const personas = useMemo(
    () => evaluateInclusivePersonas(activeEffectiveConfig, activeFacilities),
    [activeEffectiveConfig, activeFacilities],
  );

  const candidates = useMemo<CandidateLayout[]>(() => {
    const seededCfg: EventConfig = {
      ...config,
      seed: (config.seed + candidateSeedOffset) & 0x7fffffff,
    };
    return generateMultiObjectiveCandidates(seededCfg, originalFacilities);
  }, [config, originalFacilities, candidateSeedOffset]);

  const deterministicXai = useMemo(
    () =>
      buildDeterministicXaiReport(
        activeEffectiveConfig,
        summary,
        comparison,
        personas,
        contingency,
        language,
      ),
    [activeEffectiveConfig, summary, comparison, personas, contingency, language],
  );

  const xaiReport = aiXaiOverride || deterministicXai;

  const recommendations = useMemo(
    () =>
      generateRuleBasedRecommendations(
        activeEffectiveConfig,
        activeFacilities,
        snapshot,
        summary,
      ),
    [activeEffectiveConfig, activeFacilities, snapshot, summary],
  );

  const selectedFacility = useMemo(
    () => activeFacilities.find((f) => f.id === selectedFacilityId) ?? null,
    [activeFacilities, selectedFacilityId],
  );

  const highlightedFacilityIds = useMemo(() => {
    if (!activePersonaId) return [];
    const found = personas.find((p) => p.id === activePersonaId);
    return found ? found.highlightFacilityIds : [];
  }, [activePersonaId, personas]);

  // Saved projects list in browser localStorage
  const savedProjects = useMemo(() => {
    void savedProjectsVersion;
    const list: Array<{
      key: string;
      name: string;
      savedAt: string;
      payload: SavedProjectPayload;
    }> = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as SavedProjectPayload;
            if (parsed?.config?.eventName && Array.isArray(parsed.facilities)) {
              list.push({
                key,
                name: parsed.config.eventName,
                savedAt: parsed.savedAt,
                payload: parsed,
              });
            }
          }
        }
      }
    } catch {
      // Ignore storage quota / privacy mode restrictions
    }
    return list.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }, [savedProjectsVersion]);

  const flashStatus = useCallback((msg: string) => {
    setSaveStatusMessage(msg);
    window.setTimeout(() => {
      setSaveStatusMessage((cur) => (cur === msg ? null : cur));
    }, 3400);
  }, []);

  // Handlers
  const handleChangeConfig = useCallback(
    (updater: (prev: EventConfig) => EventConfig) => {
      setConfig((prev) => {
        const next = updater(prev);
        setValidationErrors(validateEventConfig(next, language));
        return next;
      });
    },
    [language],
  );

  const handleSelectEventTypePreset = useCallback((type: EventType) => {
    const preset = EVENT_TYPE_PRESETS[type] || {};
    const nextCfg: EventConfig = {
      ...DEFAULT_EVENT_CONFIG,
      ...preset,
      eventType: type,
      seed: Date.now() & 0x7fffffff,
    };
    setConfig(nextCfg);
    setValidationErrors([]);
    setActiveLayoutMode('original');
    setApprovedCandidateId(null);
    setSelectedFacilityId(null);
    if (type === 'music_festival') {
      setOriginalFacilities(DEFAULT_FACILITIES);
    } else {
      setOriginalFacilities(generateVenueLayout(nextCfg));
    }
  }, []);

  // Generative AI Brief Parser (/api/ai/parse-brief + deterministic fallback)
  const applyParsedBrief = useCallback(
    (parsed: ParsedBriefResult, sourceLabel: string) => {
      const eventType: EventType = VALID_EVENT_TYPES.includes(parsed.eventType)
        ? parsed.eventType
        : config.eventType;
      const objective: DesignObjective = VALID_OBJECTIVES.includes(parsed.objective)
        ? parsed.objective
        : config.objective;

      const nextCfg: EventConfig = {
        ...config,
        eventName: (parsed.eventName || config.eventName).slice(0, 60),
        eventType,
        venueWidth: Math.max(100, Math.min(360, Math.round(parsed.venueWidth || config.venueWidth))),
        venueDepth: Math.max(90, Math.min(300, Math.round(parsed.venueDepth || config.venueDepth))),
        expectedAttendance: Math.max(
          200,
          Math.min(50000, Math.round(parsed.expectedAttendance || config.expectedAttendance)),
        ),
        budget: Math.max(20000, Math.min(900000, Math.round(parsed.budget || config.budget))),
        objective,
        foodBoothCount: Math.max(
          1,
          Math.min(12, Math.round(parsed.foodBoothCount || config.foodBoothCount)),
        ),
        experienceBoothCount: Math.max(
          1,
          Math.min(16, Math.round(parsed.experienceBoothCount || config.experienceBoothCount)),
        ),
        entranceCount: Math.max(
          2,
          Math.min(6, Math.round(parsed.entranceCount || config.entranceCount)),
        ),
        requiredFacilities: {
          vipZone: parsed.vipZone ?? config.requiredFacilities.vipZone,
          campingArea: parsed.campingArea ?? config.requiredFacilities.campingArea,
          extraMedical: parsed.extraMedical ?? config.requiredFacilities.extraMedical,
          playRestZone: parsed.playRestZone ?? true,
        },
        accessibility: {
          stepFreeRoutes: parsed.stepFreeRoutes ?? true,
          wideCorridors: parsed.wideCorridors ?? true,
          accessibleRestrooms: parsed.accessibleRestrooms ?? true,
          accessibleParking: parsed.accessibleParking ?? true,
        },
        seed: (Date.now() + 3571) & 0x7fffffff,
      };

      const generated = generateVenueLayout(nextCfg);
      setConfig(nextCfg);
      setOriginalFacilities(generated);
      setActiveLayoutMode('original');
      setApprovedCandidateId(null);
      setSelectedFacilityId(null);
      setValidationErrors([]);
      setAiBriefSummary(parsed.extractedSummary);
      setActiveNav('workspace');
      flashStatus(
        language === 'ko'
          ? `[${sourceLabel}] '${nextCfg.eventName}' (${generated.length}개 3D 시설) 자동 설계가 완료되었습니다.`
          : `[${sourceLabel}] Generated ${generated.length}-facility 3D Twin for ${nextCfg.eventName}.`,
      );
    },
    [config, flashStatus, language],
  );

  const handleRunAiBriefParser = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setIsParsingBrief(true);
    try {
      const response = await fetch('/api/ai/parse-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (response.ok) {
        const json = (await response.json()) as { data?: ParsedBriefResult };
        if (json?.data) {
          applyParsedBrief(json.data, language === 'ko' ? '생성형 AI 해석' : 'Gemini AI');
          setIsParsingBrief(false);
          return;
        }
      }
      const fallback = parseBriefDeterministically(aiPrompt, config);
      applyParsedBrief(fallback, language === 'ko' ? '구조화 규칙 해석' : 'Structured Parser');
    } catch {
      const fallback = parseBriefDeterministically(aiPrompt, config);
      applyParsedBrief(fallback, language === 'ko' ? '구조화 규칙 해석' : 'Structured Parser');
    } finally {
      setIsParsingBrief(false);
    }
  }, [aiPrompt, applyParsedBrief, config, language]);

  // Explainable AI (XAI) Deep Rationale Generator (/api/ai/xai-report + fallback)
  const handleRequestGeminiXai = useCallback(async () => {
    setIsGeneratingAiXai(true);
    try {
      const response = await fetch('/api/ai/xai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: activeEffectiveConfig,
          summary,
          comparisonSummary: {
            originalOverall: comparison.originalMetrics.scores.overall,
            optimizedOverall: comparison.optimizedMetrics.scores.overall,
            originalDensity: comparison.originalMetrics.peakDensity,
            optimizedDensity: comparison.optimizedMetrics.peakDensity,
            waitTimeDeltaPct: comparison.waitTimeDeltaPct,
          },
          personas: personas.map((p) => ({
            persona: p.labelKo,
            score: p.score,
            finding: p.keyFindingKo,
          })),
          contingency,
          language,
        }),
      });
      if (response.ok) {
        const json = await response.json();
        if (json?.report) {
          setAiXaiOverride({
            ...json.report,
            source: 'gemini',
            generatedAt: new Date().toLocaleTimeString(language === 'ko' ? 'ko-KR' : 'en-US'),
          });
          flashStatus(
            language === 'ko'
              ? '생성형 AI 기반 XAI 심층 근거 리포트가 갱신되었습니다.'
              : 'Generative AI XAI rationale updated.',
          );
          setIsGeneratingAiXai(false);
          return;
        }
      }
      setAiXaiOverride({
        ...deterministicXai,
        generatedAt: new Date().toLocaleTimeString(language === 'ko' ? 'ko-KR' : 'en-US'),
      });
      flashStatus(
        language === 'ko'
          ? '정량 시뮬레이션 수치 기반 XAI 리포트가 최신화되었습니다.'
          : 'Refreshed deterministic XAI validation report.',
      );
    } catch {
      setAiXaiOverride({
        ...deterministicXai,
        generatedAt: new Date().toLocaleTimeString(language === 'ko' ? 'ko-KR' : 'en-US'),
      });
    } finally {
      setIsGeneratingAiXai(false);
    }
  }, [
    activeEffectiveConfig,
    comparison,
    contingency,
    deterministicXai,
    flashStatus,
    language,
    personas,
    summary,
  ]);

  const handleGenerateDesign = useCallback(() => {
    const errors = validateEventConfig(config, language);
    setValidationErrors(errors);
    if (errors.length > 0) {
      setActiveNav('workspace');
      return;
    }
    const nextCfg = { ...config, seed: (config.seed + 7919) & 0x7fffffff };
    setConfig(nextCfg);
    const generated = generateVenueLayout(nextCfg);
    setOriginalFacilities(generated);
    setActiveLayoutMode('original');
    setApprovedCandidateId(null);
    setSelectedFacilityId(null);
    setActiveNav('workspace');
    flashStatus(
      language === 'ko'
        ? `'${nextCfg.eventName}' 3D 디지털 트윈(${generated.length}개 시설)이 생성되었습니다.`
        : `Generated ${generated.length}-facility layout for ${nextCfg.eventName}.`,
    );
  }, [config, flashStatus, language]);

  const handleResetDesign = useCallback(() => {
    setConfig(DEFAULT_EVENT_CONFIG);
    setOriginalFacilities(DEFAULT_FACILITIES);
    setActiveLayoutMode('original');
    setContingency('normal');
    setApprovedCandidateId(null);
    setActivePersonaId(null);
    setVisibility(DEFAULT_LAYER_VISIBILITY);
    setSelectedFacilityId(null);
    setValidationErrors([]);
    simulatorRef.current.seekToProgress(0.62);
    setSnapshot(simulatorRef.current.getSnapshot());
    flashStatus(
      language === 'ko'
        ? '초기 올림픽공원 표준 페스티벌 레이아웃으로 복원되었습니다.'
        : 'Reset to default Olympic Park festival layout.',
    );
  }, [flashStatus, language]);

  const handleScrubProgress = useCallback((progress: number) => {
    simulatorRef.current.seekToProgress(progress);
    setSnapshot(simulatorRef.current.getSnapshot());
  }, []);

  const handleResetSim = useCallback(() => {
    setIsPlaying(false);
    simulatorRef.current.seekToProgress(0.05);
    setSnapshot(simulatorRef.current.getSnapshot());
  }, []);

  const handleToggleVisibility = useCallback((key: keyof LayerVisibility) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSetAllVisibility = useCallback((visible: boolean) => {
    setVisibility({
      stage: true,
      seating: visible,
      food: visible,
      booth: visible,
      rest: visible,
      restroom: visible,
      entrance: true,
      medical: visible,
      parking: visible,
      vip: visible,
      camping: visible,
      landscaping: visible,
      crowd: true,
      heatmap: visible,
      pedestrianRoutes: true,
      evacuationRoutes: false,
      labels: visible,
    });
  }, []);

  // Facility CRUD operations
  const mutateFacilities = useCallback(
    (mutator: (current: Facility[]) => Facility[]) => {
      const base =
        activeLayoutMode === 'optimized'
          ? comparison.optimizedFacilities
          : originalFacilities;
      const updated = mutator(base);
      setOriginalFacilities(updated);
      if (activeLayoutMode === 'optimized') {
        setActiveLayoutMode('original');
      }
    },
    [activeLayoutMode, comparison.optimizedFacilities, originalFacilities],
  );

  const handleUpdateFacility = useCallback(
    (updatedFacility: Facility) => {
      mutateFacilities((list) =>
        list.map((f) => (f.id === updatedFacility.id ? updatedFacility : f)),
      );
    },
    [mutateFacilities],
  );

  const handleDuplicateFacility = useCallback(
    (source: Facility) => {
      const newId = `${source.category}-${Date.now().toString().slice(-4)}`;
      const copy: Facility = {
        ...source,
        id: newId,
        name: `${source.name} (Copy)`,
        nameKo: source.nameKo ? `${source.nameKo} (복제)` : undefined,
        position: {
          x: Math.min(config.venueWidth / 2 - 8, source.position.x + source.dimensions.width + 4),
          z: source.position.z,
        },
        dimensions: { ...source.dimensions },
        accessibility: { ...source.accessibility },
      };
      mutateFacilities((list) => [...list, copy]);
      setSelectedFacilityId(newId);
    },
    [config.venueWidth, mutateFacilities],
  );

  const handleDeleteFacility = useCallback(
    (id: string) => {
      mutateFacilities((list) => list.filter((f) => f.id !== id));
      setSelectedFacilityId(null);
    },
    [mutateFacilities],
  );

  // Real-Time Contingency Re-Optimization
  const handleReoptimizeContingency = useCallback(() => {
    const result = reoptimizeForContingency(
      activeEffectiveConfig,
      activeFacilities,
      contingency,
    );
    setConfig(result.updatedConfig);
    setOriginalFacilities(result.facilities);
    setActiveLayoutMode('original');
    if (contingency === 'medical_emergency') {
      setVisibility((prev) => ({ ...prev, evacuationRoutes: true }));
    }
    flashStatus(language === 'ko' ? result.actionSummaryKo : result.actionSummaryEn);
  }, [activeEffectiveConfig, activeFacilities, contingency, flashStatus, language]);

  // 1-Click Inclusive Persona Spatial Upgrade
  const handleUpgradePersona = useCallback(
    (personaId: VisitorPersonaId) => {
      const result = applyInclusivePersonaUpgrade(
        activeEffectiveConfig,
        activeFacilities,
        personaId,
      );
      setConfig(result.updatedConfig);
      setOriginalFacilities(result.facilities);
      setActiveLayoutMode('original');
      setActivePersonaId(personaId);
      flashStatus(language === 'ko' ? result.messageKo : result.messageEn);
    },
    [activeEffectiveConfig, activeFacilities, flashStatus, language],
  );

  // Actionable Recommendation Fix Handler
  const handleApplyRecommendation = useCallback(
    (actionType: NonNullable<Recommendation['actionType']>) => {
      if (actionType === 'reoptimize_contingency') {
        handleReoptimizeContingency();
        return;
      }
      if (actionType === 'optimize_layout') {
        setActiveLayoutMode('optimized');
        flashStatus(
          language === 'ko'
            ? 'AI 공간 최적화 레이아웃으로 전환되었습니다 (푸드존 이원화 및 비상통로 확장).'
            : 'Switched to Optimized Layout (food stalls split & corridors widened).',
        );
        return;
      }
      if (actionType === 'add_entrance') {
        const newGate: Facility = {
          id: `entrance-relief-${Date.now().toString().slice(-3)}`,
          name: 'South Boulevard Relief Gate',
          nameKo: '남측 보조 분산 출입구',
          category: 'entrance',
          subtype: 'secondary_entrance',
          position: { x: 10, z: Math.round(config.venueDepth * 0.42) },
          dimensions: { width: 15, depth: 7, height: 8 },
          rotation: 0,
          capacity: 1400,
          cost: 11000,
          attractionWeight: 1.45,
          colorAccent: '#0ea5e9',
          covered: true,
          accessibility: {
            wheelchairAccessible: true,
            stepFreeEntry: true,
            priorityQueue: true,
          },
          notes: '입·퇴장 병목 완화를 위해 추가된 분산 출입 게이트입니다.',
        };
        mutateFacilities((list) => [...list, newGate]);
        setConfig((prev) => ({ ...prev, entranceCount: Math.min(6, prev.entranceCount + 1) }));
        setSelectedFacilityId(newGate.id);
        flashStatus(
          language === 'ko'
            ? '남측 보조 분산 출입구(+1,400명 처리 용량)가 추가되었습니다.'
            : 'Added South Boulevard Relief Gate (+1,400 portal capacity).',
        );
        return;
      }
      if (actionType === 'add_food_booths') {
        const f1: Facility = {
          id: `food-added-${Date.now().toString().slice(-3)}a`,
          name: 'East Plaza Noodle & Bao Stall',
          nameKo: '동측 광장 누들·분식 부스',
          category: 'food',
          subtype: 'food_stall',
          position: {
            x: Math.round(config.venueWidth * 0.14),
            z: Math.round(config.venueDepth * 0.22),
          },
          dimensions: { width: 8, depth: 7, height: 4.2 },
          rotation: 0,
          capacity: 230,
          cost: 5500,
          attractionWeight: 1.7,
          colorAccent: '#f97316',
          covered: true,
          accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: false },
        };
        const f2: Facility = {
          id: `food-added-${Date.now().toString().slice(-3)}b`,
          name: 'East Plaza Craft Lemonade',
          nameKo: '동측 광장 에이드·음료 부스',
          category: 'food',
          subtype: 'food_stall',
          position: {
            x: Math.round(config.venueWidth * 0.22),
            z: Math.round(config.venueDepth * 0.22),
          },
          dimensions: { width: 8, depth: 7, height: 4.2 },
          rotation: 0,
          capacity: 220,
          cost: 5200,
          attractionWeight: 1.6,
          colorAccent: '#10b981',
          covered: true,
          accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: false },
        };
        mutateFacilities((list) => [...list, f1, f2]);
        setConfig((prev) => ({ ...prev, foodBoothCount: Math.min(12, prev.foodBoothCount + 2) }));
        flashStatus(
          language === 'ko'
            ? '동측 광장에 푸드 부스 2개소가 분산 증설되었습니다.'
            : 'Added 2 East Plaza food stalls to distribute intermission demand.',
        );
        return;
      }
      if (actionType === 'enable_accessibility') {
        setConfig((prev) => ({
          ...prev,
          accessibility: {
            stepFreeRoutes: true,
            accessibleRestrooms: true,
            accessibleParking: true,
            wideCorridors: true,
          },
        }));
        mutateFacilities((list) =>
          list.map((f) => ({
            ...f,
            accessibility: {
              ...f.accessibility,
              wheelchairAccessible: true,
              stepFreeEntry: true,
            },
          })),
        );
        flashStatus(
          language === 'ko'
            ? '5.2m 무장애 광폭 통로 및 전 시설 무단차 경사로가 적용되었습니다.'
            : 'Enabled 5.2m wide corridors and 100% step-free facility ramps.',
        );
        return;
      }
      if (actionType === 'add_medical') {
        const med: Facility = {
          id: `medical-west-${Date.now().toString().slice(-3)}`,
          name: 'Stage-West First Aid Station',
          nameKo: '무대 서측 보조 응급구호소',
          category: 'medical',
          subtype: 'medical_station',
          position: {
            x: -Math.round(config.venueWidth * 0.18),
            z: -Math.round(config.venueDepth * 0.18),
          },
          dimensions: { width: 13, depth: 8.5, height: 4.5 },
          rotation: 0,
          capacity: 120,
          cost: 15500,
          attractionWeight: 0.35,
          colorAccent: '#dc2626',
          covered: true,
          accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
        };
        mutateFacilities((list) => [...list, med]);
        setSelectedFacilityId(med.id);
        flashStatus(
          language === 'ko'
            ? '메인 무대 서측 보조 응급구호소가 추가되었습니다.'
            : 'Added Stage-West First Aid Station for balanced medical coverage.',
        );
      }
    },
    [config.venueDepth, config.venueWidth, flashStatus, handleReoptimizeContingency, language, mutateFacilities],
  );

  // Multi-objective Candidate Preview / Approve / Regenerate handlers
  const handlePreviewCandidateIn3D = useCallback(
    (candidate: CandidateLayout) => {
      setConfig(candidate.configOverride);
      setOriginalFacilities(candidate.facilities);
      setActiveLayoutMode('original');
      setSelectedFacilityId(null);
      setActiveNav('workspace');
      flashStatus(
        language === 'ko'
          ? `${candidate.nameKo}을(를) 3D 디지털 트윈에 불러왔습니다.`
          : `Loaded ${candidate.nameEn} into 3D Digital Twin.`,
      );
    },
    [flashStatus, language],
  );

  const handleApproveCandidate = useCallback(
    (candidate: CandidateLayout) => {
      setConfig(candidate.configOverride);
      setOriginalFacilities(candidate.facilities);
      setActiveLayoutMode('original');
      setApprovedCandidateId(candidate.id);
      setSelectedFacilityId(null);
      flashStatus(
        language === 'ko'
          ? `[승인 완료] ${candidate.nameKo}이 최종 행사 설계안으로 확정되었습니다.`
          : `Approved ${candidate.nameEn} as active venue baseline.`,
      );
    },
    [flashStatus, language],
  );

  const handleRegenerateCandidates = useCallback(() => {
    setCandidateSeedOffset((prev) => prev + 2903);
    setApprovedCandidateId(null);
    flashStatus(
      language === 'ko'
        ? '새로운 시드 기반 다목적 후보안(Layout A~D) 4종이 재생성되었습니다.'
        : 'Regenerated 4 fresh Pareto candidate layouts (Layouts A–D).',
    );
  }, [flashStatus, language]);

  // Standalone HTML Report Download (works reliably even inside restricted iframes)
  const handleDownloadReportHtml = useCallback(() => {
    const tier = MOIS_SAFETY_TIER_LABELS[summary.moisSafetyTier];
    const htmlContent = `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <title>${config.eventName} — INCLUSE XAI Safety & Accessibility Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Noto Sans KR", sans-serif; color: #0f172a; max-width: 920px; margin: 32px auto; padding: 0 24px; line-height: 1.6; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 20px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
    .kpi-label { font-size: 11px; color: #64748b; }
    .kpi-val { font-size: 20px; font-weight: 700; font-family: monospace; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    th { background: #f8fafc; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${config.eventName}</h1>
  <div class="meta">INCLUSE 생성형 AI 행사 자동 설계 검증서 · 규격 ${config.venueWidth}m × ${config.venueDepth}m (${summary.venueAreaSqm.toLocaleString()}m²) · 예상 방문객 ${config.expectedAttendance.toLocaleString()}명</div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">종합 적합도</div><div class="kpi-val">${summary.scores.overall} / 100</div></div>
    <div class="kpi"><div class="kpi-label">행안부 기준 피크 밀집도</div><div class="kpi-val">${summary.peakDensity.toFixed(2)} 명/m² (${tier.ko})</div></div>
    <div class="kpi"><div class="kpi-label">예상 평균 대기시간</div><div class="kpi-val">${summary.avgWaitMinutes}분 (${comparison.waitTimeDeltaPct}%)</div></div>
    <div class="kpi"><div class="kpi-label">예상 시설 비용</div><div class="kpi-val">${formatCurrency(summary.estimatedCost, language)} (${summary.budgetUsagePct}%)</div></div>
  </div>
  <h2>1. 종합 요약 및 행안부 안전관리 기준 판정</h2>
  <p>${xaiReport.executiveSummary}</p>
  <p>${xaiReport.safetyComplianceVerdict}</p>
  <h2>2. 설명 가능한 AI (XAI) 공간 배치 근거</h2>
  <ul>${xaiReport.placementRationales.map((r) => `<li>${r}</li>`).join('')}</ul>
  <h2>3. 5대 포용적 이용자 접근성 진단</h2>
  <table>
    <thead><tr><th>이용자 계층</th><th>점수</th><th>핵심 보행지표</th><th>검증 소견</th></tr></thead>
    <tbody>${personas.map((p) => `<tr><td>${p.labelKo}</td><td>${p.score}/100</td><td>${p.maxContinuousWalkM}m</td><td>${p.keyFindingKo}</td></tr>`).join('')}</tbody>
  </table>
  <h2>4. 시설 배치 좌표 명세표 (${activeFacilities.length}개)</h2>
  <table>
    <thead><tr><th>시설명</th><th>분류</th><th>좌표(X,Z)</th><th>규격</th><th>수용정원</th><th>비용</th></tr></thead>
    <tbody>${activeFacilities.map((f) => `<tr><td>${getFacilityDisplayName(f, language)}</td><td>${f.category}</td><td>(${Math.round(f.position.x)}m, ${Math.round(f.position.z)}m)</td><td>${f.dimensions.width}m×${f.dimensions.depth}m</td><td>${f.capacity.toLocaleString()}</td><td>${formatCurrency(f.cost, language)}</td></tr>`).join('')}</tbody>
  </table>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.eventName.replace(/\s+/g, '_')}_INCLUSE_XAI_Report.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeFacilities, comparison.waitTimeDeltaPct, config, language, personas, summary, xaiReport]);

  // Build current project export payload (v1.1.0)
  const currentProjectPayload = useMemo<SavedProjectPayload>(
    () => ({
      schemaVersion: '1.1.0',
      savedAt: new Date().toISOString(),
      config: activeEffectiveConfig,
      facilities: activeFacilities,
      activeLayoutMode,
      contingency,
      optimizedFacilities: comparison.optimizedFacilities,
      metricsSummary: summary,
      personas,
    }),
    [
      activeEffectiveConfig,
      activeFacilities,
      activeLayoutMode,
      comparison.optimizedFacilities,
      contingency,
      personas,
      summary,
    ],
  );

  const handleSaveProject = useCallback(() => {
    try {
      const slug = config.eventName
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/g, '_')
        .slice(0, 32);
      const key = `${STORAGE_PREFIX}${slug || 'venue'}`;
      localStorage.setItem(key, JSON.stringify(currentProjectPayload));
      setSavedProjectsVersion((v) => v + 1);
      flashStatus(
        language === 'ko'
          ? `'${config.eventName}' 프로젝트가 브라우저에 저장되었습니다.`
          : `Saved "${config.eventName}" locally.`,
      );
    } catch {
      flashStatus(
        language === 'ko'
          ? '브라우저 저장소에 저장할 수 없습니다.'
          : 'Unable to save to browser storage.',
      );
    }
  }, [config.eventName, currentProjectPayload, flashStatus, language]);

  const handleExportJson = useCallback(() => {
    const jsonStr = JSON.stringify(currentProjectPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = config.eventName
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-|-$/g, '');
    a.href = url;
    a.download = `${slug || 'incluse-festival-layout'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flashStatus(
      language === 'ko'
        ? '디지털 트윈 설정 및 3D 좌표 JSON 파일이 다운로드되었습니다.'
        : 'Exported configuration & 3D layout JSON.',
    );
  }, [config.eventName, currentProjectPayload, flashStatus, language]);

  const handleImportJson = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (parsed?.config && Array.isArray(parsed.facilities) && parsed.facilities.length > 0) {
            setConfig({ ...DEFAULT_EVENT_CONFIG, ...parsed.config });
            setOriginalFacilities(parsed.facilities);
            if (parsed.contingency) {
              setContingency(parsed.contingency);
            }
            setActiveLayoutMode('original');
            setSelectedFacilityId(null);
            setValidationErrors([]);
            flashStatus(
              language === 'ko'
                ? `'${parsed.config.eventName || file.name}' 설계 파일을 불러왔습니다.`
                : `Imported "${parsed.config.eventName || file.name}".`,
            );
          } else {
            setValidationErrors([
              language === 'ko'
                ? '유효하지 않은 JSON 스키마입니다: config 또는 facilities 배열이 누락되었습니다.'
                : 'Invalid JSON schema: missing "config" or "facilities" array.',
            ]);
          }
        } catch {
          setValidationErrors([
            language === 'ko'
              ? '업로드된 JSON 파일을 해석할 수 없습니다.'
              : 'Could not parse uploaded JSON file.',
          ]);
        }
      };
      reader.readAsText(file);
    },
    [flashStatus, language],
  );

  const handleLoadSavedProject = useCallback(
    (payload: SavedProjectPayload) => {
      setConfig({ ...DEFAULT_EVENT_CONFIG, ...payload.config });
      setOriginalFacilities(payload.facilities);
      if (payload.contingency) {
        setContingency(payload.contingency);
      }
      setActiveLayoutMode('original');
      setSelectedFacilityId(null);
      setValidationErrors([]);
      flashStatus(
        language === 'ko'
          ? `'${payload.config.eventName}' 프로젝트를 불러왔습니다.`
          : `Loaded "${payload.config.eventName}".`,
      );
    },
    [flashStatus, language],
  );

  const handleDeleteSavedProject = useCallback((key: string) => {
    try {
      localStorage.removeItem(key);
      setSavedProjectsVersion((v) => v + 1);
    } catch {
      // Ignore
    }
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-6 no-print">
        {/* Zone 1: Brand Wordmark (single text element) */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('workspace');
          }}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          INCLUSE · AI Festival Designer
        </a>

        {/* Zone 2: Clean Single-Line Navigation Links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveNav('workspace')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeNav === 'workspace'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            {isKo ? '3D 디지털 트윈' : '3D Workspace'}
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('comparison')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeNav === 'comparison'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            {isKo ? '다목적 후보안·비교' : 'Candidates & Compare'}
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('analytics')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeNav === 'analytics'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            {isKo ? '군중·혼잡도 분석' : 'Crowd Analytics'}
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('xai_report')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeNav === 'xai_report'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            {isKo ? 'XAI·PDF 리포트' : 'XAI & PDF Report'}
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('integration')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeNav === 'integration'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            {isKo ? '소스코드 파일 받기' : 'Source Files & JSON'}
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleGenerateDesign}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isKo ? 'AI 자동 설계 실행' : 'Generate Design'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {activeNav === 'workspace' && (
        <>
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Region 1: Collapsible Left Configuration, Natural-Language Brief & Contingency Sidebar */}
            {isLeftSidebarOpen && (
              <LeftSidebar
                language={language}
                config={config}
                onChangeConfig={handleChangeConfig}
                onSelectEventTypePreset={handleSelectEventTypePreset}
                aiPrompt={aiPrompt}
                onChangeAiPrompt={setAiPrompt}
                onRunAiBriefParser={handleRunAiBriefParser}
                isParsingBrief={isParsingBrief}
                aiBriefSummary={aiBriefSummary}
                contingency={contingency}
                onChangeContingency={setContingency}
                onReoptimizeContingency={handleReoptimizeContingency}
                visibility={visibility}
                onToggleVisibility={handleToggleVisibility}
                onSetAllVisibility={handleSetAllVisibility}
                onGenerateDesign={handleGenerateDesign}
                isPlaying={isPlaying}
                onToggleSimulation={() => setIsPlaying((p) => !p)}
                onResetDesign={handleResetDesign}
                onSaveProject={handleSaveProject}
                onExportJson={handleExportJson}
                onImportJson={handleImportJson}
                validationErrors={validationErrors}
                saveStatusMessage={saveStatusMessage}
                onCollapse={() => setIsLeftSidebarOpen(false)}
              />
            )}

            {/* Region 2: Central Interactive 3D Venue */}
            <main className="flex-1 min-w-0 relative h-full">
              {/* Left Seam Open/Close Handle */}
              <button
                type="button"
                onClick={() => setIsLeftSidebarOpen((open) => !open)}
                title={
                  isLeftSidebarOpen
                    ? isKo
                      ? '좌측 설정 패널 접기'
                      : 'Collapse Left Sidebar'
                    : isKo
                      ? '좌측 설정 패널 열기'
                      : 'Expand Left Sidebar'
                }
                aria-label={isLeftSidebarOpen ? 'Collapse Left Sidebar' : 'Expand Left Sidebar'}
                className={`absolute left-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center border border-l-0 border-slate-300 rounded-r-lg shadow-sm transition-colors cursor-pointer no-print ${
                  isLeftSidebarOpen
                    ? 'w-5 h-14 bg-white text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                    : 'px-2 py-3 bg-white text-slate-800 hover:text-blue-700 hover:bg-blue-50 gap-1 font-semibold text-xs'
                }`}
              >
                {isLeftSidebarOpen ? (
                  <ChevronLeft className="w-3.5 h-3.5" />
                ) : (
                  <>
                    <span className="[writing-mode:vertical-rl] tracking-tight">
                      {isKo ? '설계 설정' : 'Setup'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
                  </>
                )}
              </button>

              {/* Right Seam Open/Close Handle */}
              <button
                type="button"
                onClick={() => setIsRightSidebarOpen((open) => !open)}
                title={
                  isRightSidebarOpen
                    ? isKo
                      ? '우측 분석 패널 접기'
                      : 'Collapse Right Sidebar'
                    : isKo
                      ? '우측 분석 패널 열기'
                      : 'Expand Right Sidebar'
                }
                aria-label={isRightSidebarOpen ? 'Collapse Right Sidebar' : 'Expand Right Sidebar'}
                className={`absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center border border-r-0 border-slate-300 rounded-l-lg shadow-sm transition-colors cursor-pointer no-print ${
                  isRightSidebarOpen
                    ? 'w-5 h-14 bg-white text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                    : 'px-2 py-3 bg-white text-slate-800 hover:text-blue-700 hover:bg-blue-50 gap-1 font-semibold text-xs'
                }`}
              >
                {isRightSidebarOpen ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <>
                    <ChevronLeft className="w-3.5 h-3.5 text-blue-600" />
                    <span className="[writing-mode:vertical-rl] tracking-tight">
                      {isKo ? '분석·편집' : 'Analysis'}
                    </span>
                  </>
                )}
              </button>

              <ThreeVenueCanvas
                language={language}
                onToggleLanguage={() => setLanguage((l) => (l === 'ko' ? 'en' : 'ko'))}
                config={activeEffectiveConfig}
                facilities={activeFacilities}
                visibility={visibility}
                onToggleVisibility={handleToggleVisibility}
                selectedFacilityId={selectedFacilityId}
                highlightedFacilityIds={highlightedFacilityIds}
                onSelectFacility={(id) => {
                  setSelectedFacilityId(id);
                  if (id) {
                    setIsRightSidebarOpen(true);
                  }
                }}
                simulatorRef={simulatorRef}
                isPlaying={isPlaying}
                simSpeed={simSpeed}
                simProgress={snapshot.progress}
                contingency={contingency}
                onChangeContingency={setContingency}
                onReoptimizeContingency={handleReoptimizeContingency}
                onSnapshotUpdate={setSnapshot}
                activeLayoutBadge={activeLayoutMode}
                isLeftSidebarOpen={isLeftSidebarOpen}
                onToggleLeftSidebar={() => setIsLeftSidebarOpen((open) => !open)}
                isRightSidebarOpen={isRightSidebarOpen}
                onToggleRightSidebar={() => setIsRightSidebarOpen((open) => !open)}
              >
                <SimulationTimelineDock
                  language={language}
                  snapshot={snapshot}
                  isPlaying={isPlaying}
                  onTogglePlay={() => setIsPlaying((p) => !p)}
                  onResetSim={handleResetSim}
                  simSpeed={simSpeed}
                  onChangeSpeed={setSimSpeed}
                  onScrubProgress={handleScrubProgress}
                  heatmapVisible={visibility.heatmap}
                  onToggleHeatmap={() => handleToggleVisibility('heatmap')}
                />
              </ThreeVenueCanvas>
            </main>

            {/* Region 3: Collapsible Right Facility Inspector, XAI Summary & 5 Inclusive Personas Panel */}
            {isRightSidebarOpen && (
              <RightSidebar
                language={language}
                config={activeEffectiveConfig}
                selectedFacility={selectedFacility}
                onCloseSelection={() => setSelectedFacilityId(null)}
                onUpdateFacility={handleUpdateFacility}
                onDuplicateFacility={handleDuplicateFacility}
                onDeleteFacility={handleDeleteFacility}
                onSelectFacilityById={(id) => setSelectedFacilityId(id)}
                snapshot={snapshot}
                summary={summary}
                personas={personas}
                activePersonaId={activePersonaId}
                onSelectPersona={setActivePersonaId}
                onUpgradePersona={handleUpgradePersona}
                xaiReport={xaiReport}
                onOpenXaiReportView={() => setActiveNav('xai_report')}
                recommendations={recommendations}
                onApplyRecommendation={handleApplyRecommendation}
                onCollapse={() => setIsRightSidebarOpen(false)}
              />
            )}
          </div>

          {/* Region 4: Bottom Summary Panel & Before/After Toggle */}
          <BottomSummaryBar
            language={language}
            config={activeEffectiveConfig}
            summary={summary}
            comparison={comparison}
            activeLayoutMode={activeLayoutMode}
            onSwitchLayoutMode={(mode) => {
              setActiveLayoutMode(mode);
              setSelectedFacilityId(null);
            }}
            onOpenComparisonView={() => setActiveNav('comparison')}
          />
        </>
      )}

      {activeNav === 'comparison' && (
        <ComparisonView
          language={language}
          config={config}
          comparison={comparison}
          candidates={candidates}
          approvedCandidateId={approvedCandidateId}
          activeLayoutMode={activeLayoutMode}
          onPreviewCandidateIn3D={handlePreviewCandidateIn3D}
          onApproveCandidate={handleApproveCandidate}
          onRegenerateCandidates={handleRegenerateCandidates}
          onOpenXaiReport={() => setActiveNav('xai_report')}
          onActivateIn3D={(mode) => {
            setActiveLayoutMode(mode);
            setSelectedFacilityId(null);
          }}
          onPromoteOptimizedToBaseline={() => {
            setOriginalFacilities(comparison.optimizedFacilities);
            setConfig((prev) => ({
              ...prev,
              accessibility: {
                ...prev.accessibility,
                stepFreeRoutes: true,
                wideCorridors: true,
              },
            }));
            setActiveLayoutMode('original');
            setSelectedFacilityId(null);
            setActiveNav('workspace');
            flashStatus(
              language === 'ko'
                ? 'AI 최적화 레이아웃이 기본 설계안으로 확정되었습니다.'
                : 'Applied Optimized Layout as active baseline.',
            );
          }}
          onBackToWorkspace={() => setActiveNav('workspace')}
        />
      )}

      {activeNav === 'analytics' && (
        <AnalyticsView
          language={language}
          config={activeEffectiveConfig}
          facilities={activeFacilities}
          snapshot={snapshot}
          summary={summary}
          onInspectFacilityIn3D={(id) => {
            setSelectedFacilityId(id);
            setActiveNav('workspace');
          }}
          onBackToWorkspace={() => setActiveNav('workspace')}
        />
      )}

      {activeNav === 'xai_report' && (
        <XaiReportView
          language={language}
          config={activeEffectiveConfig}
          facilities={activeFacilities}
          summary={summary}
          comparison={comparison}
          personas={personas}
          contingency={contingency}
          xaiReport={xaiReport}
          isGeneratingAiXai={isGeneratingAiXai}
          onRequestGeminiXai={handleRequestGeminiXai}
          onDownloadReportHtml={handleDownloadReportHtml}
          onBackToWorkspace={() => setActiveNav('workspace')}
        />
      )}

      {activeNav === 'integration' && (
        <IntegrationView
          language={language}
          currentPayload={currentProjectPayload}
          savedProjects={savedProjects}
          onLoadSavedProject={handleLoadSavedProject}
          onDeleteSavedProject={handleDeleteSavedProject}
          onExportJson={handleExportJson}
          onBackToWorkspace={() => setActiveNav('workspace')}
        />
      )}
    </div>
  );
}