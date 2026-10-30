import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import { EVENT_PHASES } from '../engine/presets';
import { Language, SimulationSnapshot } from '../types/festival';

interface SimulationTimelineDockProps {
  language: Language;
  snapshot: SimulationSnapshot;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetSim: () => void;
  simSpeed: number;
  onChangeSpeed: (speed: number) => void;
  onScrubProgress: (progress: number) => void;
  heatmapVisible: boolean;
  onToggleHeatmap: () => void;
}

export const SimulationTimelineDock: React.FC<SimulationTimelineDockProps> = ({
  language,
  snapshot,
  isPlaying,
  onTogglePlay,
  onResetSim,
  simSpeed,
  onChangeSpeed,
  onScrubProgress,
  heatmapVisible,
  onToggleHeatmap,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const speeds = [0.5, 1, 2, 4];
  const isKo = language === 'ko';

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(860px,95%)] flex flex-col items-center pointer-events-none">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 bg-white border border-b-0 border-slate-200 rounded-t-lg text-[11px] font-medium text-slate-600 hover:text-slate-900 shadow-xs cursor-pointer"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            <span>
              {isKo
                ? `시뮬레이션 타임라인 열기 (${snapshot.currentTimeLabel} · ${snapshot.phase.shortLabelKo})`
                : `Show Simulation Timeline (${snapshot.currentTimeLabel} · ${snapshot.phase.shortLabel})`}
            </span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            <span>{isKo ? '타임라인 접기' : 'Hide Controls'}</span>
          </>
        )}
      </button>

      {!collapsed && (
        <div className="pointer-events-auto w-full bg-white border border-slate-200 rounded-xl shadow-md px-4 py-3 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onTogglePlay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? (isKo ? '일시정지' : 'Pause') : isKo ? '재생' : 'Play'}</span>
              </button>
              <button
                type="button"
                onClick={onResetSim}
                title={isKo ? '개장 시각으로 초기화' : 'Reset Timeline to Event Start'}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="ml-1 flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
                {speeds.map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => onChangeSpeed(sp)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                      simSpeed === sp
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-mono font-semibold text-slate-900 text-sm">
                {snapshot.currentTimeLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-800">
                {isKo ? snapshot.phase.labelKo : snapshot.phase.label}
              </span>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline text-slate-500 font-mono text-[11px]">
                {snapshot.activeAgentCount} {isKo ? '에이전트' : 'agents'} (1:{snapshot.simulatedScaleFactor})
              </span>
            </div>

            <button
              type="button"
              onClick={onToggleHeatmap}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                heatmapVisible
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {heatmapVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{isKo ? '3D 혼잡도 히트맵' : '3D Heatmap'}</span>
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(snapshot.progress * 1000)}
              onChange={(e) => onScrubProgress(Number(e.target.value) / 1000)}
              aria-label="Simulation Timeline Scrubber"
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="grid grid-cols-6 gap-1">
              {EVENT_PHASES.map((ph) => {
                const isCurrent = snapshot.phase.id === ph.id;
                const midProgress = (ph.progressRange[0] + ph.progressRange[1]) / 2;
                return (
                  <button
                    key={ph.id}
                    type="button"
                    onClick={() => onScrubProgress(midProgress)}
                    title={isKo ? ph.descriptionKo : ph.description}
                    className={`px-2 py-1 rounded text-[11px] font-medium truncate transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    {isKo ? ph.shortLabelKo : ph.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-600">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-medium text-slate-700">
                {isKo ? '행안부 밀집도 단계:' : 'Density Scale:'}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-green-500" />
                <span>{isKo ? '안전 (<1.5)' : 'Safe (<1.5)'}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-yellow-400" />
                <span>{isKo ? '주의 (1.5–2.5)' : 'Caution (1.5–2.5)'}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-orange-500" />
                <span>{isKo ? '경계 (2.5–3.5)' : 'Warning (2.5–3.5)'}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-red-600" />
                <span>{isKo ? '위험 (≥3.5 명/m²)' : 'Critical (>=3.5)'}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-slate-700">
              <span>
                {isKo ? '피크' : 'Peak'}: {snapshot.peakDensity.toFixed(2)} {isKo ? '명/m²' : 'p/m²'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-sans truncate max-w-[180px]">
                {isKo ? '혼잡 구역' : 'Hotspot'}: {snapshot.mostCongestedZone}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};