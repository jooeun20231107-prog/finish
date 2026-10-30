import React from 'react';
import { ArrowRight, GitCompare } from 'lucide-react';
import {
  EventConfig,
  Language,
  LayoutComparison,
  LayoutMetricsSummary,
} from '../types/festival';
import { formatCurrency, MOIS_SAFETY_TIER_LABELS } from '../engine/presets';

interface BottomSummaryBarProps {
  language: Language;
  config: EventConfig;
  summary: LayoutMetricsSummary;
  comparison: LayoutComparison;
  activeLayoutMode: 'original' | 'optimized';
  onSwitchLayoutMode: (mode: 'original' | 'optimized') => void;
  onOpenComparisonView: () => void;
}

export const BottomSummaryBar: React.FC<BottomSummaryBarProps> = ({
  language,
  config,
  summary,
  comparison,
  activeLayoutMode,
  onSwitchLayoutMode,
  onOpenComparisonView,
}) => {
  const isKo = language === 'ko';
  const scoreDelta =
    comparison.optimizedMetrics.scores.overall - comparison.originalMetrics.scores.overall;
  const tierInfo = MOIS_SAFETY_TIER_LABELS[summary.moisSafetyTier];

  return (
    <section className="h-[108px] shrink-0 bg-white border-t border-slate-200 px-5 flex items-center justify-between gap-6 overflow-x-auto no-print">
      {/* Left/Center: 6 Compact Summary Metrics */}
      <div className="flex items-center divide-x divide-slate-200 shrink-0">
        <div className="pr-4">
          <div className="text-[11px] text-slate-500">{isKo ? '총 배치 시설' : 'Facilities'}</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
            {summary.totalFacilities}
            {isKo ? '개' : ''}
          </div>
          <div className="text-[11px] text-slate-500">
            {isKo ? `수용 ${summary.totalCapacity.toLocaleString()}명` : `Cap ${summary.totalCapacity.toLocaleString()}`}
          </div>
        </div>

        <div className="px-4">
          <div className="text-[11px] text-slate-500">{isKo ? '전체 행사장 면적' : 'Venue Area'}</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
            {summary.venueAreaSqm.toLocaleString()} m²
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {config.venueWidth}m × {config.venueDepth}m
          </div>
        </div>

        <div className="px-4">
          <div className="text-[11px] text-slate-500">
            {isKo ? '피크 군중 밀집도 (행안부)' : 'Peak Crowd Density'}
          </div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
            {summary.peakDensity.toFixed(2)} {isKo ? '명/m²' : 'p/m²'}
          </div>
          <div className={`text-[11px] font-medium ${tierInfo.colorClass}`}>
            {isKo ? tierInfo.ko : tierInfo.en}
          </div>
        </div>

        <div className="px-4">
          <div className="text-[11px] text-slate-500">
            {isKo ? '예상 평균 대기시간' : 'Est. Avg Wait Time'}
          </div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
            {summary.avgWaitMinutes} {isKo ? '분' : 'min'}
          </div>
          <div className="text-[11px] font-mono text-emerald-700">
            {comparison.waitTimeDeltaPct < 0
              ? isKo
                ? `최적화 시 ${comparison.waitTimeDeltaPct}% 단축`
                : `${comparison.waitTimeDeltaPct}% w/ Optimizer`
              : isKo
                ? `보행 평균 ${summary.avgWalkingDistanceM}m`
                : `Walk avg ${summary.avgWalkingDistanceM}m`}
          </div>
        </div>

        <div className="px-4">
          <div className="text-[11px] text-slate-500">{isKo ? '예산 집행 추정액' : 'Budget Usage'}</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
            {formatCurrency(summary.estimatedCost, language)}
          </div>
          <div
            className={`text-[11px] font-mono ${
              summary.budgetUsagePct > 100 ? 'text-red-700 font-semibold' : 'text-slate-500'
            }`}
          >
            {summary.budgetUsagePct}% / {formatCurrency(config.budget, language)}
          </div>
        </div>

        <div className="pl-4">
          <div className="text-[11px] text-slate-500">
            {isKo ? 'AI 설계 종합 적합도' : 'Overall Design Score'}
          </div>
          <div className="text-lg font-mono font-bold text-blue-600 mt-0.5">
            {summary.scores.overall} / 100
          </div>
          <div className="text-[11px] text-slate-500">
            {summary.scores.overall >= 82
              ? isKo
                ? '안전·포용 기준 충족'
                : 'Ready for approval'
              : isKo
                ? '다목적 최적화 권장'
                : 'Optimization available'}
          </div>
        </div>
      </div>

      {/* Right: Before / After Layout Switcher & Multi-Objective Candidate Explorer Link */}
      <div className="flex items-center gap-3 pl-4 border-l border-slate-200 shrink-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-800">
              {isKo ? '설계 전·후 즉시 비교' : 'Before / After Layout'}
            </span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-[11px] text-slate-600">
              {isKo ? '점수' : 'Score'} {comparison.originalMetrics.scores.overall}{' '}
              <ArrowRight className="inline w-3 h-3" />{' '}
              {comparison.optimizedMetrics.scores.overall} (
              {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => onSwitchLayoutMode('original')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeLayoutMode === 'original'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isKo
                  ? `기본 배치 (${comparison.originalMetrics.totalFacilities})`
                  : `Original (${comparison.originalMetrics.totalFacilities})`}
              </button>
              <button
                type="button"
                onClick={() => onSwitchLayoutMode('optimized')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeLayoutMode === 'optimized'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isKo
                  ? `최적화안 (${comparison.optimizedMetrics.totalFacilities})`
                  : `Optimized (${comparison.optimizedMetrics.totalFacilities})`}
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenComparisonView}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 whitespace-nowrap transition-colors cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{isKo ? '후보안 A~D · 전후 비교' : 'Candidates A–D & Compare'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};