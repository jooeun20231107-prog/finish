import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  FileText,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  CandidateLayout,
  EventConfig,
  Facility,
  Language,
  LayoutComparison,
} from '../types/festival';
import { formatCurrency, MOIS_SAFETY_TIER_LABELS } from '../engine/presets';

interface ComparisonViewProps {
  language: Language;
  config: EventConfig;
  comparison: LayoutComparison;
  candidates: CandidateLayout[];
  approvedCandidateId: 'A' | 'B' | 'C' | 'D' | null;
  activeLayoutMode: 'original' | 'optimized';
  onPreviewCandidateIn3D: (candidate: CandidateLayout) => void;
  onApproveCandidate: (candidate: CandidateLayout) => void;
  onRegenerateCandidates: () => void;
  onOpenXaiReport: () => void;
  onActivateIn3D: (mode: 'original' | 'optimized') => void;
  onPromoteOptimizedToBaseline: () => void;
  onBackToWorkspace: () => void;
}

const VenueFootprintSvg: React.FC<{
  widthM: number;
  depthM: number;
  facilities: Facility[];
  highlightIds?: Set<string>;
  compact?: boolean;
}> = ({ widthM, depthM, facilities, highlightIds, compact = false }) => {
  const halfW = widthM / 2;
  const halfD = depthM / 2;

  return (
    <svg
      viewBox={`${-halfW - 10} ${-halfD - 10} ${widthM + 20} ${depthM + 20}`}
      className={`w-full ${compact ? 'h-40' : 'h-60'} bg-[#eef4fa] rounded-lg border border-slate-200`}
    >
      <rect
        x={-halfW}
        y={-halfD}
        width={widthM}
        height={depthM}
        rx={4}
        fill="#cdeac0"
        stroke="#94a3b8"
        strokeWidth={1.2}
      />
      <line
        x1={-7}
        y1={-halfD}
        x2={-7}
        y2={halfD}
        stroke="#e2e8f0"
        strokeWidth={4.5}
      />
      <line
        x1={-halfW}
        y1={6}
        x2={halfW}
        y2={6}
        stroke="#e2e8f0"
        strokeWidth={4}
      />

      {facilities.map((f) => {
        const isRot90 = Math.abs(Math.sin(f.rotation)) > 0.7;
        const w = isRot90 ? f.dimensions.depth : f.dimensions.width;
        const d = isRot90 ? f.dimensions.width : f.dimensions.depth;
        const isChanged = highlightIds?.has(f.id);

        return (
          <g key={f.id}>
            <rect
              x={f.position.x - w / 2}
              y={f.position.z - d / 2}
              width={w}
              height={d}
              rx={1.5}
              fill={f.colorAccent || '#2563eb'}
              fillOpacity={0.88}
              stroke={isChanged ? '#0f172a' : '#ffffff'}
              strokeWidth={isChanged ? 1.8 : 0.9}
            />
          </g>
        );
      })}
    </svg>
  );
};

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  language,
  config,
  comparison,
  candidates,
  approvedCandidateId,
  activeLayoutMode,
  onPreviewCandidateIn3D,
  onApproveCandidate,
  onRegenerateCandidates,
  onOpenXaiReport,
  onActivateIn3D,
  onPromoteOptimizedToBaseline,
  onBackToWorkspace,
}) => {
  const isKo = language === 'ko';
  const { originalMetrics: orig, optimizedMetrics: opt } = comparison;

  const changedIds = new Set<string>();
  for (const ofac of comparison.optimizedFacilities) {
    const match = comparison.originalFacilities.find((x) => x.id === ofac.id);
    if (
      !match ||
      Math.hypot(match.position.x - ofac.position.x, match.position.z - ofac.position.z) > 1.5
    ) {
      changedIds.add(ofac.id);
    }
  }

  const workflowSteps = isKo
    ? [
        '1. 행사 정보·자연어 입력',
        '2. 제약 조건·규격 검증',
        '3. 3D 디지털 트윈 생성',
        '4. 다목적 변이 탐색',
        '5. 군중·돌발 시뮬레이션',
        '6. 후보안 A·B·C·D 도출',
        '7. XAI 근거 리포트',
        '8. 설계안 최종 승인',
      ]
    : [
        '1. Event Brief Input',
        '2. Constraint Validation',
        '3. 3D Digital Twin',
        '4. Evolutionary Search',
        '5. Crowd & Alert Sim',
        '6. Pareto Layouts A–D',
        '7. XAI Rationale',
        '8. Approve / Regenerate',
      ];

  const metricRows = [
    {
      label: isKo ? '행안부 기준 피크 밀집도' : 'Estimated Peak Density',
      before: `${orig.peakDensity.toFixed(2)} ${isKo ? '명/m²' : 'p/m²'}`,
      after: `${opt.peakDensity.toFixed(2)} ${isKo ? '명/m²' : 'p/m²'}`,
      deltaNum: Number((opt.peakDensity - orig.peakDensity).toFixed(2)),
      unit: isKo ? ' 명/m²' : ' p/m²',
      lowerIsBetter: true,
    },
    {
      label: isKo ? '예상 평균 서비스 대기시간' : 'Estimated Avg Wait Time',
      before: `${orig.avgWaitMinutes}${isKo ? '분' : ' min'}`,
      after: `${opt.avgWaitMinutes}${isKo ? '분' : ' min'}`,
      deltaNum: Number((opt.avgWaitMinutes - orig.avgWaitMinutes).toFixed(1)),
      unit: isKo ? `분 (${comparison.waitTimeDeltaPct}%)` : ` min (${comparison.waitTimeDeltaPct}%)`,
      lowerIsBetter: true,
    },
    {
      label: isKo ? '평균 보행 이동거리' : 'Average Walking Distance',
      before: `${orig.avgWalkingDistanceM} m`,
      after: `${opt.avgWalkingDistanceM} m`,
      deltaNum: opt.avgWalkingDistanceM - orig.avgWalkingDistanceM,
      unit: ' m',
      lowerIsBetter: true,
    },
    {
      label: isKo ? '예측 병목 혼잡 구역 수' : 'Modeled Bottlenecks',
      before: `${orig.modeledBottlenecks}${isKo ? '곳' : ''}`,
      after: `${opt.modeledBottlenecks}${isKo ? '곳' : ''}`,
      deltaNum: opt.modeledBottlenecks - orig.modeledBottlenecks,
      unit: isKo ? '곳' : '',
      lowerIsBetter: true,
    },
    {
      label: isKo ? '포용적 무장애 접근성 점수' : 'Accessibility Score',
      before: `${orig.scores.accessibility} / 100`,
      after: `${opt.scores.accessibility} / 100`,
      deltaNum: opt.scores.accessibility - orig.scores.accessibility,
      unit: isKo ? '점' : ' pts',
      lowerIsBetter: false,
    },
    {
      label: isKo ? '예상 시설 설치비 (예산 대비)' : 'Estimated Budget Usage',
      before: `${formatCurrency(orig.estimatedCost, language)} (${orig.budgetUsagePct}%)`,
      after: `${formatCurrency(opt.estimatedCost, language)} (${opt.budgetUsagePct}%)`,
      deltaNum: opt.estimatedCost - orig.estimatedCost,
      unit: ' COST',
      lowerIsBetter: true,
    },
  ];

  const chartData = [
    {
      metric: isKo ? '안전성' : 'Safety',
      Original: orig.scores.safety,
      Optimized: opt.scores.safety,
    },
    {
      metric: isKo ? '포용 접근성' : 'Accessibility',
      Original: orig.scores.accessibility,
      Optimized: opt.scores.accessibility,
    },
    {
      metric: isKo ? '혼잡 흐름' : 'Crowd Flow',
      Original: orig.scores.crowdFlow,
      Optimized: opt.scores.crowdFlow,
    },
    {
      metric: isKo ? '공간 분산' : 'Distribution',
      Original: orig.scores.distributionBalance,
      Optimized: opt.scores.distributionBalance,
    },
    {
      metric: isKo ? '운영 효율' : 'Operations',
      Original: orig.scores.operationalEfficiency,
      Optimized: opt.scores.operationalEfficiency,
    },
    {
      metric: isKo ? '예산 효율' : 'Budget Eff.',
      Original: orig.scores.budgetEfficiency,
      Optimized: opt.scores.budgetEfficiency,
    },
  ];

  const activeNotes = isKo ? comparison.optimizationNotesKo : comparison.optimizationNotes;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={onBackToWorkspace}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isKo ? '3D 디지털 트윈 작업공간 복귀' : 'Return to 3D Digital Twin'}</span>
            </button>
            <h1 className="text-xl font-bold text-slate-900">
              {isKo
                ? '다목적 AI 설계 후보안 탐색 (Layout A~D) 및 전·후 정량 비교'
                : 'Multi-Objective AI Candidate Explorer (Layouts A–D) & Spatial Comparison'}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {isKo
                ? `${config.eventName} 대상 다목적 파레토 최적화 후보안 4종 비교 및 승인/재생성 의사결정 워크플로우`
                : `Compare 4 Pareto-optimal candidate layouts and Before/After spatial metrics for ${config.eventName}.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRegenerateCandidates}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>{isKo ? '후보안 재생성 요청' : 'Regenerate Candidates'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenXaiReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-800 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>{isKo ? 'XAI 근거 · PDF 리포트 보기' : 'Open XAI & PDF Report'}</span>
            </button>
            <button
              type="button"
              onClick={onPromoteOptimizedToBaseline}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
            >
              <span>{isKo ? 'AI 최적화안을 기본 설계로 확정' : 'Apply Optimized as Baseline'}</span>
            </button>
          </div>
        </div>

        {/* INCLUSE End-to-End Automated Design Pipeline Strip */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800">
              {isKo
                ? 'INCLUSE 생성형 AI 행사 자동 설계 프로세스 (다중 변이 시뮬레이션 기반)'
                : 'INCLUSE Automated Event Design & Approval Pipeline'}
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {isKo
                ? `시드 탐색 완료: 총 ${(candidates.length * 64).toLocaleString()}개 공간 변이 평가`
                : `${(candidates.length * 64).toLocaleString()} spatial variations evaluated`}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
            {workflowSteps.map((step, i) => {
              const isApprovalStep = i === 7;
              return (
                <div
                  key={step}
                  className={`px-2.5 py-2 rounded-md border text-[11px] font-medium truncate ${
                    isApprovalStep && approvedCandidateId
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {step}
                </div>
              );
            })}
          </div>
        </div>

        {/* Multi-Objective Candidate Explorer: Layout A, B, C, D */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              {isKo
                ? '다목적 최적화 후보 설계안 비교 (Layout A · B · C · D)'
                : 'Multi-Objective Candidate Layouts (Layout A · B · C · D)'}
            </h2>
            {approvedCandidateId && (
              <span className="text-xs font-semibold text-emerald-700">
                {isKo
                  ? `현재 승인된 설계안: Layout ${approvedCandidateId}`
                  : `Approved Baseline: Layout ${approvedCandidateId}`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {candidates.map((cand) => {
              const isApproved = approvedCandidateId === cand.id;
              const tier = MOIS_SAFETY_TIER_LABELS[cand.metrics.moisSafetyTier];
              const highlights = isKo ? cand.highlightsKo : cand.highlightsEn;

              return (
                <div
                  key={cand.id}
                  className={`bg-white rounded-xl border p-4 flex flex-col justify-between space-y-3 ${
                    isApproved ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">
                          {isKo ? cand.nameKo : cand.nameEn}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {isKo ? cand.focusKo : cand.focusEn}
                        </p>
                      </div>
                      <span className="text-sm font-mono font-bold text-blue-700 shrink-0">
                        {cand.metrics.scores.overall}
                        <span className="text-[10px] text-slate-400">/100</span>
                      </span>
                    </div>

                    <VenueFootprintSvg
                      widthM={cand.configOverride.venueWidth}
                      depthM={cand.configOverride.venueDepth}
                      facilities={cand.facilities}
                      compact
                    />

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100 text-[11px]">
                      <div>
                        <div className="text-slate-400">{isKo ? '피크 밀집도' : 'Density'}</div>
                        <div className={`font-mono font-semibold ${tier.colorClass}`}>
                          {cand.metrics.peakDensity.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">{isKo ? '대기시간 변화' : 'Wait Delta'}</div>
                        <div className="font-mono font-semibold text-emerald-700">
                          {cand.waitTimeDeltaPct <= 0
                            ? `${cand.waitTimeDeltaPct}%`
                            : `+${cand.waitTimeDeltaPct}%`}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">{isKo ? '예산율' : 'Budget'}</div>
                        <div className="font-mono font-semibold text-slate-800">
                          {cand.metrics.budgetUsagePct}%
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-1 text-[11px] text-slate-600 list-disc pl-4 leading-snug">
                      {highlights.map((h, idx) => (
                        <li key={idx}>{h}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onPreviewCandidateIn3D(cand)}
                      className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                    >
                      <Eye className="w-3 h-3 text-blue-600" />
                      <span>{isKo ? '3D 미리보기' : '3D Preview'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onApproveCandidate(cand)}
                      className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        isApproved
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {isApproved && <Check className="w-3 h-3" />}
                      <span>{isApproved ? (isKo ? '승인됨' : 'Approved') : isKo ? '설계안 승인' : 'Approve'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Side-by-Side Before & After 2D Spatial Footprints */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {isKo ? '기존 배치안 (최적화 전 기준)' : 'Original Venue Configuration'}
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  {orig.totalFacilities}
                  {isKo ? '개 시설 · 종합 점수 ' : ' facilities · Score '}
                  {orig.scores.overall}/100
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onActivateIn3D('original');
                  onBackToWorkspace();
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  activeLayoutMode === 'original'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {activeLayoutMode === 'original'
                  ? isKo
                    ? '3D 뷰포트 표시 중'
                    : 'Active in 3D'
                  : isKo
                    ? '3D로 전환'
                    : 'View in 3D'}
              </button>
            </div>
            <VenueFootprintSvg
              widthM={config.venueWidth}
              depthM={config.venueDepth}
              facilities={comparison.originalFacilities}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {isKo ? 'AI 공간 최적화 배치안 (개선 후)' : 'AI Optimized Venue Configuration'}
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  {opt.totalFacilities}
                  {isKo ? '개 시설 · 종합 점수 ' : ' facilities · Score '}
                  {opt.scores.overall}/100
                  {changedIds.size > 0 &&
                    (isKo
                      ? ` · 변경/증설 ${changedIds.size}개 강조`
                      : ` · ${changedIds.size} modified units outlined`)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onActivateIn3D('optimized');
                  onBackToWorkspace();
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  activeLayoutMode === 'optimized'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {activeLayoutMode === 'optimized'
                  ? isKo
                    ? '3D 뷰포트 표시 중'
                    : 'Active in 3D'
                  : isKo
                    ? '3D로 전환'
                    : 'View in 3D'}
              </button>
            </div>
            <VenueFootprintSvg
              widthM={config.venueWidth}
              depthM={config.venueDepth}
              facilities={comparison.optimizedFacilities}
              highlightIds={changedIds}
            />
          </div>
        </div>

        {/* Quantitative Comparison Table & Score Breakdown Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">
                {isKo ? '설계 전·후 핵심 정량 지표 비교' : 'Key Operational & Safety Deltas'}
              </h2>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">{isKo ? '평가 지표' : 'Metric'}</th>
                    <th className="py-2.5 px-4 font-medium text-right">{isKo ? '기존 설계' : 'Original'}</th>
                    <th className="py-2.5 px-4 font-medium text-right">{isKo ? '최적화 설계' : 'Optimized'}</th>
                    <th className="py-2.5 px-4 font-medium text-right">{isKo ? '증감 변화' : 'Net Change'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {metricRows.map((row) => {
                    const isZero = row.deltaNum === 0;
                    const isPositiveOutcome = row.lowerIsBetter
                      ? row.deltaNum < 0
                      : row.deltaNum > 0;
                    const deltaFormatted =
                      row.unit === ' COST'
                        ? `${row.deltaNum >= 0 ? '+' : '-'}${formatCurrency(Math.abs(row.deltaNum), language)}`
                        : `${row.deltaNum > 0 ? '+' : ''}${row.deltaNum}${row.unit}`;

                    return (
                      <tr key={row.label} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-sans font-medium text-slate-800">
                          {row.label}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">{row.before}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">
                          {row.after}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-semibold ${
                            isZero
                              ? 'text-slate-400'
                              : isPositiveOutcome
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {isZero ? (isKo ? '변동 없음' : 'No change') : deltaFormatted}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 flex flex-col">
            <h2 className="text-sm font-bold text-slate-900 mb-2">
              {isKo
                ? '6대 평가 축 점수 프로파일 (기존 vs 최적화)'
                : 'Score Profile (Original vs Optimized)'}
            </h2>
            <div className="flex-1 min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', borderColor: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="Original"
                    name={isKo ? '기존 설계' : 'Original'}
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Optimized"
                    name={isKo ? 'AI 최적화' : 'Optimized'}
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Optimization Modification Log */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            {comparison.improved ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-slate-500" />
            )}
            <h2 className="text-sm font-bold text-slate-900">
              {isKo ? 'AI 공간 최적화 실행 내역 (XAI 변경 로그)' : 'Spatial Optimizer Execution Notes'}
            </h2>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-5">
            {activeNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 pt-1">
            {isKo
              ? '참고: 분산 출입구·화장실·가족쉼터 증설 시 실제 추가되는 가설 시설 설치 비용이 예산 지표에 투명하게 반영됩니다.'
              : 'Note: Where adding relief gates, restrooms, or family lounges increases capital cost, Budget Usage reflects the actual added expenditure.'}
          </p>
        </div>
      </div>
    </div>
  );
};