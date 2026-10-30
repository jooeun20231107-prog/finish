import React from 'react';
import {
  ArrowLeft,
  Download,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  ContingencyScenario,
  EventConfig,
  Facility,
  Language,
  LayoutComparison,
  LayoutMetricsSummary,
  MoisSafetyTier,
  PersonaEvaluation,
  XaiExplanation,
} from '../types/festival';
import {
  CONTINGENCY_INFO,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_LABELS_KO,
  formatCurrency,
  getFacilityDisplayName,
  MOIS_SAFETY_TIER_LABELS,
  OBJECTIVE_LABELS,
  OBJECTIVE_LABELS_KO,
} from '../engine/presets';

interface XaiReportViewProps {
  language: Language;
  config: EventConfig;
  facilities: Facility[];
  summary: LayoutMetricsSummary;
  comparison: LayoutComparison;
  personas: PersonaEvaluation[];
  contingency: ContingencyScenario;
  xaiReport: XaiExplanation;
  isGeneratingAiXai: boolean;
  onRequestGeminiXai: () => void;
  onDownloadReportHtml: () => void;
  onBackToWorkspace: () => void;
}

const MOIS_TIERS_ORDER: Array<{
  tier: MoisSafetyTier;
  actionKo: string;
  actionEn: string;
}> = [
  {
    tier: 'safe',
    actionKo: '정상 관람 및 자유 보행 가능 · 현행 안내 유지',
    actionEn: 'Nominal pedestrian circulation; maintain standard guidance',
  },
  {
    tier: 'caution',
    actionKo: '주요 교차로 안내요원 배치 · 일방향 유도선 점검',
    actionEn: 'Deploy junction stewards and monitor one-way flow lanes',
  },
  {
    tier: 'warning',
    actionKo: '보조 분산 게이트 개방 · 인기 부스 대기열 분리 통제',
    actionEn: 'Open relief gates and separate overlapping vendor queues',
  },
  {
    tier: 'danger',
    actionKo: '신규 유입 일시 통제 · 비상 대피통로 즉각 가동 및 공간 재배치',
    actionEn: 'Throttle inflow immediately, clear emergency spine, re-optimize layout',
  },
];

export const XaiReportView: React.FC<XaiReportViewProps> = ({
  language,
  config,
  facilities,
  summary,
  comparison,
  personas,
  contingency,
  xaiReport,
  isGeneratingAiXai,
  onRequestGeminiXai,
  onDownloadReportHtml,
  onBackToWorkspace,
}) => {
  const isKo = language === 'ko';
  const tierInfo = MOIS_SAFETY_TIER_LABELS[summary.moisSafetyTier];
  const contInfo = CONTINGENCY_INFO[contingency];
  const avgPersonaScore = Math.round(
    personas.reduce((acc, p) => acc + p.score, 0) / Math.max(1, personas.length),
  );

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
      <div className="max-w-[1040px] mx-auto space-y-5">
        {/* Top Action Bar (hidden when printing A4 PDF) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3.5 no-print">
          <div>
            <button
              type="button"
              onClick={onBackToWorkspace}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline mb-0.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isKo ? '3D 디지털 트윈 작업공간으로 복귀' : 'Return to 3D Digital Twin'}</span>
            </button>
            <h1 className="text-base font-bold text-slate-900">
              {isKo
                ? '설명 가능한 AI (XAI) 행사 설계 근거 및 안전성 종합 리포트'
                : 'Explainable AI (XAI) Spatial Rationale & Safety Compliance Report'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRequestGeminiXai}
              disabled={isGeneratingAiXai}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 text-xs font-semibold text-blue-800 cursor-pointer"
            >
              {isGeneratingAiXai ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>
                {isGeneratingAiXai
                  ? isKo
                    ? 'AI 분석 문장 생성 중...'
                    : 'Generating AI Rationale...'
                  : isKo
                    ? '생성형 AI 심층 근거 갱신'
                    : 'Refresh Generative XAI'}
              </span>
            </button>

            <button
              type="button"
              onClick={onDownloadReportHtml}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>{isKo ? '리포트 파일 저장 (.html)' : 'Download Report (.html)'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isKo ? 'PDF 인쇄 / 내보내기' : 'Print / Save PDF'}</span>
            </button>
          </div>
        </div>

        {/* Printable A4 Report Sheet */}
        <article className="print-container bg-white border border-slate-200 rounded-xl p-8 space-y-7 text-slate-900">
          {/* Document Header */}
          <header className="border-b-2 border-slate-900 pb-5 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-blue-700 font-semibold">
                {isKo
                  ? 'INCLUSE · 생성형 AI 기반 행사 자동 설계 디지털 트윈 검증서'
                  : 'INCLUSE · GENERATIVE AI DIGITAL TWIN VENUE VALIDATION REPORT'}
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {config.eventName}
              </h2>
              <p className="text-xs text-slate-600">
                {isKo ? EVENT_TYPE_LABELS_KO[config.eventType] : EVENT_TYPE_LABELS[config.eventType]}{' '}
                · {isKo ? '설계 목표:' : 'Objective:'}{' '}
                {isKo ? OBJECTIVE_LABELS_KO[config.objective] : OBJECTIVE_LABELS[config.objective]}{' '}
                · {isKo ? '돌발 시나리오:' : 'Scenario:'}{' '}
                {isKo ? contInfo.labelKo : contInfo.labelEn}
              </p>
            </div>

            <div className="text-right font-mono text-xs text-slate-600 space-y-0.5">
              <div>
                {isKo ? '공간 규격:' : 'Footprint:'} {config.venueWidth}m × {config.venueDepth}m (
                {summary.venueAreaSqm.toLocaleString()}m²)
              </div>
              <div>
                {isKo ? '예상 방문객:' : 'Expected Attendance:'}{' '}
                {config.expectedAttendance.toLocaleString()}
                {isKo ? '명' : ' pax'} ({config.startTime}–{config.endTime})
              </div>
              <div>
                {isKo ? '생성 시각:' : 'Generated:'} {xaiReport.generatedAt} (
                {xaiReport.source === 'gemini'
                  ? isKo
                    ? '생성형 AI 엔진'
                    : 'Generative AI'
                  : isKo
                    ? '정량 규칙 기반 XAI'
                    : 'Deterministic XAI'}
                )
              </div>
            </div>
          </header>

          {/* Section 1: Headline KPI Summary Grid */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {isKo ? '1. 핵심 설계 성과 요약 (Executive KPIs)' : '1. Executive Simulation Summary'}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              <div className="p-3.5">
                <div className="text-[11px] text-slate-500">
                  {isKo ? '디지털 트윈 종합 적합도' : 'Overall Twin Score'}
                </div>
                <div className="text-xl font-mono font-bold text-blue-700 mt-1">
                  {summary.scores.overall} / 100
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {isKo
                    ? `안전 ${summary.scores.safety} · 접근성 ${summary.scores.accessibility}`
                    : `Safety ${summary.scores.safety} · Access ${summary.scores.accessibility}`}
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] text-slate-500">
                  {isKo ? '행안부 기준 피크 밀집도' : 'Peak Crowd Density'}
                </div>
                <div className={`text-xl font-mono font-bold mt-1 ${tierInfo.colorClass}`}>
                  {summary.peakDensity.toFixed(2)} {isKo ? '명/m²' : 'p/m²'}
                </div>
                <div className="text-[11px] font-medium text-slate-700 mt-0.5">
                  {isKo ? tierInfo.ko : tierInfo.en} ({tierInfo.threshold})
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] text-slate-500">
                  {isKo ? '예상 평균 대기시간' : 'Est. Avg Wait Time'}
                </div>
                <div className="text-xl font-mono font-bold text-slate-900 mt-1">
                  {summary.avgWaitMinutes}
                  {isKo ? '분' : ' min'}
                </div>
                <div className="text-[11px] font-mono text-emerald-700 font-semibold mt-0.5">
                  {comparison.waitTimeDeltaPct <= 0
                    ? isKo
                      ? `초기안 대비 ${comparison.waitTimeDeltaPct}% 단축`
                      : `${comparison.waitTimeDeltaPct}% vs. baseline`
                    : `+${comparison.waitTimeDeltaPct}%`}
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] text-slate-500">
                  {isKo ? '예상 시설 설치비 (예산율)' : 'Estimated Cost (Budget)'}
                </div>
                <div className="text-xl font-mono font-bold text-slate-900 mt-1">
                  {formatCurrency(summary.estimatedCost, language)}
                </div>
                <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                  {summary.budgetUsagePct}% / {formatCurrency(config.budget, language)}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed">
              {xaiReport.executiveSummary}
            </div>
          </section>

          {/* Section 2: Ministry of the Interior and Safety (행정안전부) Crowd Density Compliance */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>
                  {isKo
                    ? '2. 행정안전부 다중운집인파 안전관리 기준 적합성 검증'
                    : '2. MoIS Crowd Safety Guideline Compliance'}
                </span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                {isKo
                  ? '기준: 행안부 다중운집인파사고 안전관리 가이드라인 (2024)'
                  : 'Ref: Korea MoIS Crowd Safety Guidelines (2024)'}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              {xaiReport.safetyComplianceVerdict}
            </p>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">{isKo ? '안전 등급' : 'Safety Tier'}</th>
                    <th className="py-2 px-3 font-semibold">{isKo ? '밀집도 기준' : 'Density Threshold'}</th>
                    <th className="py-2 px-3 font-semibold">{isKo ? '운영 및 안전 권고 조치' : 'Operational Protocol'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? '현재 판정' : 'Current Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MOIS_TIERS_ORDER.map((row) => {
                    const info = MOIS_SAFETY_TIER_LABELS[row.tier];
                    const active = summary.moisSafetyTier === row.tier;
                    return (
                      <tr key={row.tier} className={active ? 'bg-blue-50/70 font-semibold' : ''}>
                        <td className={`py-2 px-3 ${info.colorClass}`}>
                          {isKo ? info.ko : info.en}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">{info.threshold}</td>
                        <td className="py-2 px-3 text-slate-700">
                          {isKo ? row.actionKo : row.actionEn}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {active
                            ? isKo
                              ? `해당 (${summary.peakDensity.toFixed(2)}명/m²)`
                              : `ACTIVE (${summary.peakDensity.toFixed(2)})`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Explainable AI (XAI) Spatial Placement Rationale & Before/After Deltas */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {isKo
                ? '3. 설명 가능한 AI (XAI) 공간 배치 의사결정 근거 및 전·후 비교'
                : '3. Explainable AI (XAI) Placement Rationale & Optimization Deltas'}
            </h3>

            <ul className="space-y-2 text-xs text-slate-800 list-disc pl-5 leading-relaxed">
              {xaiReport.placementRationales.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">{isKo ? '비교 항목' : 'Metric'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? '초기 설계안' : 'Baseline'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? 'AI 최적화 설계안' : 'AI Optimized'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? '개선 효과' : 'Delta'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">
                      {isKo ? '종합 설계 점수' : 'Overall Design Score'}
                    </td>
                    <td className="py-2 px-3 text-right">{comparison.originalMetrics.scores.overall}점</td>
                    <td className="py-2 px-3 text-right font-semibold text-blue-700">
                      {comparison.optimizedMetrics.scores.overall}점
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-semibold">
                      {comparison.optimizedMetrics.scores.overall -
                        comparison.originalMetrics.scores.overall >=
                      0
                        ? '+'
                        : ''}
                      {comparison.optimizedMetrics.scores.overall -
                        comparison.originalMetrics.scores.overall}
                      점
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">
                      {isKo ? '피크 군중 밀집도' : 'Peak Crowd Density'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {comparison.originalMetrics.peakDensity.toFixed(2)} 명/m²
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">
                      {comparison.optimizedMetrics.peakDensity.toFixed(2)} 명/m²
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-semibold">
                      {(
                        comparison.optimizedMetrics.peakDensity -
                        comparison.originalMetrics.peakDensity
                      ).toFixed(2)}{' '}
                      명/m²
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">
                      {isKo ? '예상 평균 대기시간' : 'Estimated Avg Wait Time'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {comparison.originalMetrics.avgWaitMinutes}분
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">
                      {comparison.optimizedMetrics.avgWaitMinutes}분
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-semibold">
                      {comparison.waitTimeDeltaPct}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">
                      {isKo ? '포용적 접근성 점수' : 'Inclusive Accessibility Score'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {comparison.originalMetrics.scores.accessibility}점
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">
                      {comparison.optimizedMetrics.scores.accessibility}점
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-semibold">
                      +
                      {Math.max(
                        0,
                        comparison.optimizedMetrics.scores.accessibility -
                          comparison.originalMetrics.scores.accessibility,
                      )}
                      점
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: 5 Inclusive Visitor Personas Evaluation */}
          <section className="space-y-3 print-page-break">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                {isKo
                  ? '4. 5대 포용적 이용자 맞춤형 접근성 진단 (INCLUSE)'
                  : '4. Inclusive Accessibility Audit Across 5 Visitor Personas'}
              </h3>
              <span className="text-xs font-mono font-semibold text-blue-700">
                {isKo ? `5대 계층 평균 ${avgPersonaScore}/100점` : `Avg ${avgPersonaScore}/100`}
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">{isKo ? '이용자 계층' : 'Visitor Persona'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? '접근성 점수' : 'Score'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? '핵심 거리 지표' : 'Key Distance'}</th>
                    <th className="py-2 px-3 font-semibold">{isKo ? '공간 검증 소견' : 'Spatial Audit Finding'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {personas.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {isKo ? p.labelKo : p.labelEn}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono font-bold ${
                          p.score >= 82 ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {p.score}/100
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">
                        {p.maxContinuousWalkM}m
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {isKo ? p.keyFindingKo : p.keyFindingEn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 5: Contingency Protocol & Complete Facility Coordinate Schedule */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {isKo
                ? '5. 돌발상황 대응 프로토콜 및 시설 배치 좌표 명세표'
                : '5. Contingency Protocol & 3D Facility Coordinate Schedule'}
            </h3>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed">
              {xaiReport.contingencyProtocol}
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2.5 font-semibold">{isKo ? '시설명' : 'Facility'}</th>
                    <th className="py-2 px-2.5 font-semibold">{isKo ? '분류' : 'Category'}</th>
                    <th className="py-2 px-2.5 font-semibold text-right">{isKo ? '좌표 (X, Z)' : 'Coords'}</th>
                    <th className="py-2 px-2.5 font-semibold text-right">{isKo ? '규격 (가로×세로)' : 'Size'}</th>
                    <th className="py-2 px-2.5 font-semibold text-right">{isKo ? '수용인원' : 'Capacity'}</th>
                    <th className="py-2 px-2.5 font-semibold text-center">{isKo ? '무장애' : 'Step-Free'}</th>
                    <th className="py-2 px-2.5 font-semibold text-right">{isKo ? '예상 비용' : 'Est. Cost'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {facilities.map((f) => (
                    <tr key={f.id}>
                      <td className="py-1.5 px-2.5 font-sans font-medium text-slate-900">
                        {getFacilityDisplayName(f, language)}
                      </td>
                      <td className="py-1.5 px-2.5 font-sans text-slate-600 capitalize">
                        {f.category}
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-slate-600">
                        ({Math.round(f.position.x)}m, {Math.round(f.position.z)}m)
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-slate-600">
                        {f.dimensions.width}m × {f.dimensions.depth}m
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-slate-800">
                        {f.capacity.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-2.5 text-center font-sans text-slate-700">
                        {f.accessibility.wheelchairAccessible ? (isKo ? '적용' : 'Yes') : '—'}
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-slate-700">
                        {formatCurrency(f.cost, language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
};