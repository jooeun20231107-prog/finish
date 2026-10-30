import React, { useEffect, useState } from 'react';
import {
  X,
  RotateCw,
  Trash2,
  Copy,
  Info,
  Check,
  ArrowUpRight,
  FileText,
  Users,
  BarChart3,
  PanelRightClose,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  EventConfig,
  Facility,
  Language,
  LayoutMetricsSummary,
  PersonaEvaluation,
  Recommendation,
  SimulationSnapshot,
  VisitorPersonaId,
  XaiExplanation,
} from '../types/festival';
import {
  formatCurrency,
  getFacilityDisplayName,
  MOIS_SAFETY_TIER_LABELS,
} from '../engine/presets';

interface RightSidebarProps {
  language: Language;
  config: EventConfig;
  selectedFacility: Facility | null;
  onCloseSelection: () => void;
  onUpdateFacility: (updated: Facility) => void;
  onDuplicateFacility: (facility: Facility) => void;
  onDeleteFacility: (id: string) => void;
  onSelectFacilityById: (id: string) => void;
  snapshot: SimulationSnapshot;
  summary: LayoutMetricsSummary;
  personas: PersonaEvaluation[];
  activePersonaId: VisitorPersonaId | null;
  onSelectPersona: (id: VisitorPersonaId | null) => void;
  onUpgradePersona: (id: VisitorPersonaId) => void;
  xaiReport: XaiExplanation;
  onOpenXaiReportView: () => void;
  recommendations: Recommendation[];
  onApplyRecommendation: (actionType: NonNullable<Recommendation['actionType']>) => void;
  onCollapse?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  language,
  config,
  selectedFacility,
  onCloseSelection,
  onUpdateFacility,
  onDuplicateFacility,
  onDeleteFacility,
  onSelectFacilityById,
  snapshot,
  summary,
  personas,
  activePersonaId,
  onSelectPersona,
  onUpgradePersona,
  xaiReport,
  onOpenXaiReportView,
  recommendations,
  onApplyRecommendation,
  onCollapse,
}) => {
  const [activeRightTab, setActiveRightTab] = useState<'overview' | 'inclusive'>('overview');
  const [showMethodology, setShowMethodology] = useState(false);

  const [draft, setDraft] = useState<Facility | null>(selectedFacility);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(selectedFacility);
    setSavedFlash(false);
  }, [selectedFacility]);

  const isKo = language === 'ko';
  const tierInfo = MOIS_SAFETY_TIER_LABELS[summary.moisSafetyTier];

  const scoreRows: Array<{ label: string; value: number }> = isKo
    ? [
        { label: '안전성 (행안부 밀집·비상동선)', value: summary.scores.safety },
        { label: '포용적 접근성 (5대 계층)', value: summary.scores.accessibility },
        { label: '군중 흐름·혼잡 완화', value: summary.scores.crowdFlow },
        { label: '공간 분산 균형도', value: summary.scores.distributionBalance },
        { label: '운영·관리 효율성', value: summary.scores.operationalEfficiency },
        { label: '예산 집행 효율성', value: summary.scores.budgetEfficiency },
      ]
    : [
        { label: 'Safety & Egress', value: summary.scores.safety },
        { label: 'Inclusive Accessibility', value: summary.scores.accessibility },
        { label: 'Crowd-Flow Efficiency', value: summary.scores.crowdFlow },
        { label: 'Visitor Distribution', value: summary.scores.distributionBalance },
        { label: 'Operational Efficiency', value: summary.scores.operationalEfficiency },
        { label: 'Budget Efficiency', value: summary.scores.budgetEfficiency },
      ];

  const getScoreBarColor = (val: number) => {
    if (val >= 82) return 'bg-blue-600';
    if (val >= 68) return 'bg-emerald-600';
    if (val >= 52) return 'bg-amber-500';
    return 'bg-red-600';
  };

  const handleSaveFacilityEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const halfW = config.venueWidth / 2 - 4;
    const halfD = config.venueDepth / 2 - 4;
    const clamped: Facility = {
      ...draft,
      position: {
        x: Math.max(-halfW, Math.min(halfW, Number(draft.position.x) || 0)),
        z: Math.max(-halfD, Math.min(halfD, Number(draft.position.z) || 0)),
      },
      dimensions: {
        width: Math.max(4, Math.min(80, Number(draft.dimensions.width) || 8)),
        depth: Math.max(4, Math.min(80, Number(draft.dimensions.depth) || 8)),
        height: draft.dimensions.height,
      },
      capacity: Math.max(10, Number(draft.capacity) || 100),
    };
    onUpdateFacility(clamped);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  };

  return (
    <aside className="w-[320px] shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden no-print">
      {selectedFacility && draft ? (
        /* SELECTED 3D FACILITY INSPECTOR & PROPERTY EDITOR */
        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="capitalize">{selectedFacility.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{selectedFacility.id}</span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                {getFacilityDisplayName(selectedFacility, language)}
              </h2>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onCloseSelection}
                title={isKo ? '선택 해제 및 전체 분석 보기' : 'Deselect facility'}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              {onCollapse && (
                <button
                  type="button"
                  onClick={onCollapse}
                  title={isKo ? '우측 분석 패널 접기' : 'Collapse Right Sidebar'}
                  aria-label={isKo ? '우측 분석 패널 접기' : 'Collapse Right Sidebar'}
                  className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSaveFacilityEdit}
            className="flex-1 overflow-y-auto p-4 space-y-4 text-xs"
          >
            {/* Live Simulated Crowd Status for this Facility */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {isKo ? '시뮬레이션 부하' : 'Modeled Load'} ({snapshot.currentTimeLabel})
                </span>
                <span>{isKo ? snapshot.phase.shortLabelKo : snapshot.phase.shortLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-0.5">
                <div>
                  <div className="text-[11px] text-slate-500">
                    {isKo ? '현재 체류 / 수용량' : 'Visitors / Cap'}
                  </div>
                  <div className="text-sm font-mono font-semibold text-slate-900">
                    {(snapshot.facilityOccupancy[selectedFacility.id] || 0).toLocaleString()} /{' '}
                    {selectedFacility.capacity.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">
                    {isKo ? '예상 대기 인원' : 'Approx. Queue'}
                  </div>
                  <div className="text-sm font-mono font-semibold text-slate-900">
                    {(snapshot.facilityQueues[selectedFacility.id] || 0).toLocaleString()}{' '}
                    {isKo ? '명' : 'pax'}
                  </div>
                </div>
              </div>
            </div>

            {selectedFacility.notes && (
              <p className="text-slate-600 leading-relaxed">{selectedFacility.notes}</p>
            )}

            {/* Editable Properties */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900">
                {isKo ? '3D 시설 제원 및 좌표 편집' : 'Edit Spatial & Capacity Properties'}
              </h3>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  {isKo ? '시설 명칭' : 'Facility Name'}
                </label>
                <input
                  type="text"
                  value={isKo ? draft.nameKo || draft.name : draft.name}
                  onChange={(e) =>
                    setDraft(
                      isKo
                        ? { ...draft, nameKo: e.target.value }
                        : { ...draft, name: e.target.value },
                    )
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isKo ? '위치 X (m)' : 'Position X (m)'}
                  </label>
                  <input
                    type="number"
                    step={1}
                    value={Math.round(draft.position.x)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        position: { ...draft.position, x: Number(e.target.value) },
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isKo ? '위치 Z (m)' : 'Position Z (m)'}
                  </label>
                  <input
                    type="number"
                    step={1}
                    value={Math.round(draft.position.z)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        position: { ...draft.position, z: Number(e.target.value) },
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isKo ? '가로 크기 (m)' : 'Width (m)'}
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={80}
                    step={1}
                    value={draft.dimensions.width}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        dimensions: { ...draft.dimensions, width: Number(e.target.value) },
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isKo ? '세로 크기 (m)' : 'Depth (m)'}
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={80}
                    step={1}
                    value={draft.dimensions.depth}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        dimensions: { ...draft.dimensions, depth: Number(e.target.value) },
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
                  <span>{isKo ? '배치 회전각' : 'Orientation'}</span>
                  <span className="font-mono">
                    {Math.round(((draft.rotation * 180) / Math.PI + 360) % 360)}°
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[0, 90, 180, 270].map((deg) => {
                    const rad = (deg * Math.PI) / 180;
                    const active =
                      Math.round((((draft.rotation * 180) / Math.PI) % 360 + 360) % 360) === deg;
                    return (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => setDraft({ ...draft, rotation: rad })}
                        className={`flex items-center justify-center gap-1 py-1 rounded border font-mono text-[11px] cursor-pointer ${
                          active
                            ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>{deg}°</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isKo ? '수용 인원 (명)' : 'Capacity (pax)'}
                  </label>
                  <input
                    type="number"
                    min={10}
                    step={20}
                    value={draft.capacity}
                    onChange={(e) =>
                      setDraft({ ...draft, capacity: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isKo
                      ? `설치 비용 (${formatCurrency(draft.cost, 'ko')})`
                      : 'Est. Cost ($)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={draft.cost}
                    onChange={(e) =>
                      setDraft({ ...draft, cost: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
                  <span>{isKo ? '방문객 유인 가중치' : 'Attraction Weight'}</span>
                  <span className="font-mono">{draft.attractionWeight.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={3.0}
                  step={0.1}
                  value={draft.attractionWeight}
                  onChange={(e) =>
                    setDraft({ ...draft, attractionWeight: Number(e.target.value) })
                  }
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.accessibility.wheelchairAccessible}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      accessibility: {
                        ...draft.accessibility,
                        wheelchairAccessible: e.target.checked,
                        stepFreeEntry: e.target.checked,
                      },
                    })
                  }
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  {isKo
                    ? '휠체어·유모차 무단차 경사로 및 저상 카운터 적용'
                    : 'Wheelchair-accessible ramp & service counter'}
                </span>
              </label>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors cursor-pointer"
              >
                {savedFlash ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isKo ? '3D 현장에 반영됨' : 'Updated 3D Scene'}</span>
                  </>
                ) : (
                  <span>{isKo ? '변경사항 저장 및 3D 반영' : 'Save & Update 3D Scene'}</span>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onDuplicateFacility(selectedFacility)}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isKo ? '시설 복제' : 'Duplicate'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteFacility(selectedFacility.id)}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isKo ? '삭제' : 'Remove'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        /* OVERALL EVENT ANALYSIS, XAI PREVIEW & 5 INCLUSIVE PERSONAS */
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-2.5 border-b border-slate-200 shrink-0 flex items-center gap-1.5">
            <div className="flex-1 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg min-w-0">
              <button
                type="button"
                onClick={() => {
                  setActiveRightTab('overview');
                  onSelectPersona(null);
                }}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeRightTab === 'overview'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isKo ? '종합·XAI 평가' : 'Scores & XAI'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab('inclusive')}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeRightTab === 'inclusive'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isKo ? '5대 포용 접근성' : '5 Personas'}</span>
              </button>
            </div>

            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                title={isKo ? '우측 분석 패널 접기' : 'Collapse Right Sidebar'}
                aria-label={isKo ? '우측 분석 패널 접기' : 'Collapse Right Sidebar'}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {activeRightTab === 'overview' ? (
              <>
                {/* 1. Evaluation Scores */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-semibold text-slate-900">
                        {isKo ? '디지털 트윈 정량 평가 지표' : 'Venue Evaluation Metrics'}
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        {isKo
                          ? `행안부 기준: ${tierInfo.ko} (${tierInfo.threshold})`
                          : `MoIS Tier: ${tierInfo.en} (${tierInfo.threshold})`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMethodology((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium cursor-pointer"
                    >
                      <Info className="w-3 h-3" />
                      <span>{isKo ? '산출근거' : 'Method'}</span>
                    </button>
                  </div>

                  {showMethodology && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                      {isKo
                        ? '행정안전부 다중운집인파사고 안전관리 가이드라인 밀집도(명/m²), 출입구 수용률, 식음 권역 분산도, 5대 교통약자 동선 커버리지를 기반으로 산출된 사전 계획용 시뮬레이션 지표입니다.'
                        : 'Deterministic planning heuristics computed from MoIS crowd density tiers, gate capacity ratios, vendor dispersion, and inclusive route coverage.'}
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {scoreRows.map((row) => (
                      <div key={row.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700">{row.label}</span>
                          <span className="font-mono font-semibold text-slate-900">{row.value}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${getScoreBarColor(
                              row.value,
                            )}`}
                            style={{ width: `${row.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="h-px bg-slate-100" />

                {/* 2. Live Congestion, Wait Time & Timeline Sparkline */}
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-slate-900">
                      {isKo ? '혼잡도 및 대기시간 분석' : 'Congestion & Wait Time'}
                    </h2>
                    <span className="text-[11px] font-mono text-slate-500">
                      {snapshot.currentTimeLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <div>
                      <div className="text-[10px] text-slate-500">
                        {isKo ? '현재 피크 밀집' : 'Peak Density'}
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {snapshot.peakDensity.toFixed(2)} {isKo ? '명/m²' : 'p/m²'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">
                        {isKo ? '예상 평균대기' : 'Avg Wait'}
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {summary.avgWaitMinutes} {isKo ? '분' : 'min'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">
                        {isKo ? '평균 보행거리' : 'Avg Walk'}
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {summary.avgWalkingDistanceM} m
                      </div>
                    </div>
                  </div>

                  {/* Full-Day Density Sparkline */}
                  <div className="h-28 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={snapshot.timelineSeries}
                        margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="densityFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="timeLabel"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          interval={2}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            fontSize: '11px',
                            borderRadius: '8px',
                            borderColor: '#e2e8f0',
                          }}
                          formatter={(val) => [
                            `${val ?? 0} ${isKo ? '명/m²' : 'p/m²'}`,
                            isKo ? '피크 밀집도' : 'Peak Density',
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="peakDensity"
                          stroke="#2563eb"
                          strokeWidth={2}
                          fill="url(#densityFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {snapshot.bottlenecks.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-medium text-slate-500">
                        {isKo ? '예측 병목 구간 (클릭 시 3D 포커스)' : 'Modeled Hotspots (click to focus)'}
                      </p>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                        {snapshot.bottlenecks.slice(0, 3).map((b) => (
                          <button
                            key={b.facilityId}
                            type="button"
                            onClick={() => onSelectFacilityById(b.facilityId)}
                            className="w-full flex items-center justify-between px-2.5 py-2 bg-white hover:bg-slate-50 text-left text-xs cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-medium text-slate-800 truncate">
                                {b.facilityName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {isKo ? `대기 약 ${b.estimatedQueue}명` : `Queue ~${b.estimatedQueue}`} ·{' '}
                                {b.peakDensity} {isKo ? '명/m²' : 'p/m²'}
                              </div>
                            </div>
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {isKo
                        ? `${snapshot.currentTimeLabel} 기준 심각한 대기열 병목이 감지되지 않았습니다.`
                        : `No severe facility queues detected at ${snapshot.currentTimeLabel}.`}
                    </p>
                  )}
                </section>

                <div className="h-px bg-slate-100" />

                {/* 3. Explainable AI (XAI) Rationale Summary Card */}
                <section className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {isKo ? '설명 가능한 AI (XAI) 설계 근거' : 'Explainable AI (XAI) Rationale'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {xaiReport.source === 'gemini' ? 'Gemini XAI' : 'Rule XAI'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {xaiReport.safetyComplianceVerdict}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenXaiReportView}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{isKo ? 'XAI 리포트 전문 및 PDF 출력' : 'Full XAI Report & PDF Print'}</span>
                  </button>
                </section>

                {/* 4. Actionable Recommendations */}
                <section className="space-y-2.5">
                  <div>
                    <h2 className="text-xs font-semibold text-slate-900">
                      {isKo ? 'AI 개선 제안 및 원클릭 보완' : 'Design Recommendations'}
                    </h2>
                  </div>

                  <div className="space-y-2.5">
                    {recommendations.map((rec) => {
                      const title = isKo && rec.titleKo ? rec.titleKo : rec.title;
                      const rationale = isKo && rec.rationaleKo ? rec.rationaleKo : rec.rationale;
                      const actLabel =
                        isKo && rec.actionLabelKo ? rec.actionLabelKo : rec.actionLabel;

                      return (
                        <div
                          key={rec.id}
                          className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5"
                        >
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span
                              className={`font-semibold ${
                                rec.severity === 'high'
                                  ? 'text-red-700'
                                  : rec.severity === 'medium'
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                              }`}
                            >
                              {rec.severity === 'high'
                                ? isKo
                                  ? '우선 보완'
                                  : 'High Priority'
                                : rec.severity === 'medium'
                                  ? isKo
                                    ? '권장 사항'
                                    : 'Moderate'
                                  : isKo
                                    ? '기준 충족'
                                    : 'Verified'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{rec.category}</span>
                          </div>

                          <h3 className="text-xs font-semibold text-slate-900">{title}</h3>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{rationale}</p>
                          <p className="text-[10px] font-mono text-slate-500">{rec.metricTrigger}</p>

                          {rec.actionType && actLabel && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => onApplyRecommendation(rec.actionType!)}
                                className="px-2.5 py-1 rounded-md bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 text-[11px] font-semibold text-slate-800 transition-colors cursor-pointer"
                              >
                                {actLabel}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              /* TAB 2: 5 INCLUSIVE VISITOR PERSONAS (휠체어·유모차·어린이·고령자·외국인) */
              <section className="space-y-3">
                <div>
                  <h2 className="text-xs font-semibold text-slate-900">
                    {isKo
                      ? '5대 포용적 이용자 맞춤형 접근성 진단'
                      : '5 Inclusive Visitor Persona Diagnostics'}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {isKo
                      ? '카드를 클릭하면 3D 뷰포트에서 해당 계층의 핵심 편의시설이 강조 표시됩니다.'
                      : 'Click any persona card to highlight its facilities inside the 3D scene.'}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {personas.map((p) => {
                    const isSelected = activePersonaId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => onSelectPersona(isSelected ? null : p.id)}
                        className={`p-3 rounded-xl border transition-colors cursor-pointer space-y-2 ${
                          isSelected
                            ? 'bg-emerald-50/60 border-emerald-400'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">
                            {isKo ? p.labelKo : p.labelEn}
                          </span>
                          <span
                            className={`text-xs font-mono font-bold ${
                              p.score >= 82 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {p.score} / 100
                          </span>
                        </div>

                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.score >= 82 ? 'bg-emerald-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${p.score}%` }}
                          />
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {isKo ? p.keyFindingKo : p.keyFindingEn}
                        </p>

                        <div className="flex items-center justify-between pt-0.5 text-[10px] font-mono text-slate-500">
                          <span>
                            {isKo
                              ? `기준 보행거리 ${p.maxContinuousWalkM}m`
                              : `Key walk ${p.maxContinuousWalkM}m`}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpgradePersona(p.id);
                            }}
                            className="px-2 py-1 rounded bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 font-sans text-[11px] font-semibold text-slate-800 whitespace-nowrap cursor-pointer"
                          >
                            {isKo ? p.upgradeActionLabelKo : p.upgradeActionLabelEn}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};