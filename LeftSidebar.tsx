import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Save,
  Download,
  Upload,
  Wand2,
  Layers,
  SlidersHorizontal,
  Sparkles,
  RefreshCw,
  PanelLeftClose,
} from 'lucide-react';
import {
  ContingencyScenario,
  DesignObjective,
  EventConfig,
  EventType,
  Language,
  LayerVisibility,
} from '../types/festival';
import {
  CONTINGENCY_INFO,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_LABELS_KO,
  formatCurrency,
  OBJECTIVE_LABELS,
  OBJECTIVE_LABELS_KO,
} from '../engine/presets';

interface LeftSidebarProps {
  language: Language;
  config: EventConfig;
  onChangeConfig: (updater: (prev: EventConfig) => EventConfig) => void;
  onSelectEventTypePreset: (type: EventType) => void;
  aiPrompt: string;
  onChangeAiPrompt: (value: string) => void;
  onRunAiBriefParser: () => void;
  isParsingBrief: boolean;
  aiBriefSummary: string | null;
  contingency: ContingencyScenario;
  onChangeContingency: (scenario: ContingencyScenario) => void;
  onReoptimizeContingency: () => void;
  visibility: LayerVisibility;
  onToggleVisibility: (key: keyof LayerVisibility) => void;
  onSetAllVisibility: (visible: boolean) => void;
  onGenerateDesign: () => void;
  isPlaying: boolean;
  onToggleSimulation: () => void;
  onResetDesign: () => void;
  onSaveProject: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  validationErrors: string[];
  saveStatusMessage: string | null;
  onCollapse?: () => void;
}

const LAYER_ITEMS: Array<{
  key: keyof LayerVisibility;
  labelKo: string;
  labelEn: string;
  groupKo: string;
  groupEn: string;
}> = [
  { key: 'stage', labelKo: '메인·서브 무대', labelEn: 'Stages', groupKo: '행사장 3D 시설', groupEn: 'Venue Facilities' },
  { key: 'seating', labelKo: '관객석 블록', labelEn: 'Audience & Seating', groupKo: '행사장 3D 시설', groupEn: 'Venue Facilities' },
  { key: 'food', labelKo: '푸드트럭·식음 부스', labelEn: 'Food & Beverage', groupKo: '행사장 3D 시설', groupEn: 'Venue Facilities' },
  { key: 'booth', labelKo: '체험·전시 부스', labelEn: 'Experience Booths', groupKo: '행사장 3D 시설', groupEn: 'Venue Facilities' },
  { key: 'rest', labelKo: '가족쉼터·놀이·휴게광장', labelEn: 'Rest, Family & Play', groupKo: '행사장 3D 시설', groupEn: 'Venue Facilities' },
  { key: 'restroom', labelKo: '화장실 (장애인 칸 포함)', labelEn: 'Restrooms', groupKo: '행사장 3D 시설', groupEn: 'Venue Facilities' },
  { key: 'entrance', labelKo: '출입구·매표·다국어안내', labelEn: 'Gates & Multilingual Info', groupKo: '행사장 3D 시설', groupEn: 'Venue Facilities' },
  { key: 'medical', labelKo: '응급 의료시설', labelEn: 'Medical Stations', groupKo: '행사장 3D 시설', groupEn: 'Venue Facilities' },
  { key: 'parking', labelKo: '외곽·장애인 주차장', labelEn: 'Parking Areas', groupKo: '행사장 3D 시설', groupEn: 'Venue Facilities' },
  { key: 'vip', labelKo: 'VIP 라운지 데크', labelEn: 'VIP Hospitality', groupKo: '행사장 3D 시설', groupEn: 'Venue Facilities' },
  { key: 'camping', labelKo: '캠핑·피크닉 존', labelEn: 'Camping Zones', groupKo: '행사장 3D 시설', groupEn: 'Venue Facilities' },
  { key: 'landscaping', labelKo: '수목·조경 환경', labelEn: 'Trees & Landscaping', groupKo: '시뮬레이션 및 동선 레이어', groupEn: 'Analysis & Environment' },
  { key: 'crowd', labelKo: '3D 방문객 군중 마커', labelEn: '3D Crowd Markers', groupKo: '시뮬레이션 및 동선 레이어', groupEn: 'Analysis & Environment' },
  { key: 'heatmap', labelKo: '실시간 3D 밀집 히트맵', labelEn: 'Dynamic 3D Heatmap', groupKo: '시뮬레이션 및 동선 레이어', groupEn: 'Analysis & Environment' },
  { key: 'pedestrianRoutes', labelKo: '일반·무장애 보행 동선', labelEn: 'Pedestrian Routes', groupKo: '시뮬레이션 및 동선 레이어', groupEn: 'Analysis & Environment' },
  { key: 'evacuationRoutes', labelKo: '비상 대피·구급차 동선', labelEn: 'Evacuation Routes', groupKo: '시뮬레이션 및 동선 레이어', groupEn: 'Analysis & Environment' },
  { key: 'labels', labelKo: '3D 시설 명칭 라벨', labelEn: '3D Facility Labels', groupKo: '시뮬레이션 및 동선 레이어', groupEn: 'Analysis & Environment' },
];

const SAMPLE_PROMPTS_KO = [
  {
    short: '건양고 대동제 3.2천명',
    text: "'2026 건양고 한솔 대동제' 160m×130m 운동장, 예상 3,200명, 예산 1억 원, 푸드트럭 6개·동아리 체험부스 9개, 휠체어·유모차·어르신 포용 무장애 동선 최우선",
  },
  {
    short: '시민 음악축제 1만명',
    text: "'2026 시민 포용 뮤직 페스티벌' 200m×150m 잔디광장, 1만 명 방문, 예산 3.2억 원, 행안부 다중운집 안전기준 준수 및 출입구 3개·응급의료 2개소 배치",
  },
  {
    short: '진로박람회 5천명',
    text: "'2026 청년 진로·취업 박람회' 170m×130m 야외광장, 5,000명 규모, 예산 1.6억 원, 체험·상담 부스 12개, 대기시간 단축 및 혼잡도 완화 중심",
  },
];

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  language,
  config,
  onChangeConfig,
  onSelectEventTypePreset,
  aiPrompt,
  onChangeAiPrompt,
  onRunAiBriefParser,
  isParsingBrief,
  aiBriefSummary,
  contingency,
  onChangeContingency,
  onReoptimizeContingency,
  visibility,
  onToggleVisibility,
  onSetAllVisibility,
  onGenerateDesign,
  isPlaying,
  onToggleSimulation,
  onResetDesign,
  onSaveProject,
  onExportJson,
  onImportJson,
  validationErrors,
  saveStatusMessage,
  onCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'setup' | 'layers'>('setup');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isKo = language === 'ko';

  const groupKeys = isKo
    ? ['행사장 3D 시설', '시뮬레이션 및 동선 레이어']
    : ['Venue Facilities', 'Analysis & Environment'];

  return (
    <aside className="w-[290px] shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden no-print">
      {/* Segmented Sidebar Switcher + Collapse Button */}
      <div className="p-2.5 border-b border-slate-200 shrink-0 flex items-center gap-1.5">
        <div className="flex-1 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'setup'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isKo ? 'AI 설계 설정' : 'Config'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('layers')}
            className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'layers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {isKo ? '레이어' : 'Layers'} ({LAYER_ITEMS.filter((i) => visibility[i.key]).length})
            </span>
          </button>
        </div>

        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title={isKo ? '좌측 설정 패널 접기' : 'Collapse Left Sidebar'}
            aria-label={isKo ? '좌측 설정 패널 접기' : 'Collapse Left Sidebar'}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Validation & Save Alerts */}
      {validationErrors.length > 0 && (
        <div className="mx-3 mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
          {validationErrors.map((err, idx) => (
            <p key={idx}>{err}</p>
          ))}
        </div>
      )}

      {saveStatusMessage && (
        <div className="mx-3 mt-2 px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed">
          {saveStatusMessage}
        </div>
      )}

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-5">
        {activeTab === 'setup' ? (
          <>
            {/* Section 0: Generative AI Natural Language Brief Parser */}
            <section className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  {isKo ? '생성형 AI 자연어 조건 입력' : 'Generative AI Event Brief'}
                </span>
                <span className="text-[10px] font-mono text-blue-700">Gemini 3.8</span>
              </div>

              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => onChangeAiPrompt(e.target.value)}
                placeholder={
                  isKo
                    ? '예: 건양고 운동장 160x130m에 3,200명 규모 대동제, 푸드트럭 6개와 휠체어·유모차 무장애 동선 중심 설계'
                    : 'e.g., 5,000-person campus festival on 170x130m field, 6 food trucks, wheelchair & stroller accessible'
                }
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
              />

              <div className="flex flex-wrap gap-1">
                {SAMPLE_PROMPTS_KO.map((sample) => (
                  <button
                    key={sample.short}
                    type="button"
                    onClick={() => onChangeAiPrompt(sample.text)}
                    className="px-2 py-0.5 text-[10px] font-medium text-slate-700 bg-white hover:bg-blue-50 border border-slate-200 rounded transition-colors cursor-pointer"
                  >
                    {sample.short}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={isParsingBrief || !aiPrompt.trim()}
                onClick={onRunAiBriefParser}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isParsingBrief
                    ? isKo
                      ? 'AI 요구사항 해석 중...'
                      : 'Parsing Brief...'
                    : isKo
                      ? 'AI 조건 해석 및 3D 자동 설계'
                      : 'Parse Brief & Generate 3D'}
                </span>
              </button>

              {aiBriefSummary && (
                <p className="text-[11px] text-slate-700 bg-white/90 border border-blue-100 rounded-md p-2 leading-relaxed">
                  {aiBriefSummary}
                </p>
              )}
            </section>

            {/* Section 1: Event Identity & Schedule */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-slate-900">
                {isKo ? '행사 기본 정보' : 'Event Basics'}
              </h2>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  {isKo ? '행사명' : 'Event Name'}
                </label>
                <input
                  type="text"
                  value={config.eventName}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({ ...prev, eventName: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  {isKo ? '행사 유형 (표준 템플릿 로드)' : 'Event Type (loads preset)'}
                </label>
                <select
                  value={config.eventType}
                  onChange={(e) => onSelectEventTypePreset(e.target.value as EventType)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((typeKey) => (
                    <option key={typeKey} value={typeKey}>
                      {isKo ? EVENT_TYPE_LABELS_KO[typeKey] : EVENT_TYPE_LABELS[typeKey]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isKo ? '가로 폭 (m)' : 'Width (m)'}
                  </label>
                  <input
                    type="number"
                    min={100}
                    max={360}
                    step={10}
                    value={config.venueWidth}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        venueWidth: Number(e.target.value) || 160,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isKo ? '세로 길이 (m)' : 'Depth (m)'}
                  </label>
                  <input
                    type="number"
                    min={90}
                    max={300}
                    step={10}
                    value={config.venueDepth}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        venueDepth: Number(e.target.value) || 120,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
                  <span>{isKo ? '예상 방문객 수' : 'Expected Attendance'}</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {config.expectedAttendance.toLocaleString()} {isKo ? '명' : 'pax'}
                  </span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={25000}
                  step={200}
                  value={config.expectedAttendance}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      expectedAttendance: Number(e.target.value),
                    }))
                  }
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isKo ? '운영 시작' : 'Start Time'}
                  </label>
                  <input
                    type="time"
                    value={config.startTime}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({ ...prev, startTime: e.target.value }))
                    }
                    className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {isKo ? '운영 종료' : 'End Time'}
                  </label>
                  <input
                    type="time"
                    value={config.endTime}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({ ...prev, endTime: e.target.value }))
                    }
                    className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
                  <span>{isKo ? '가용 예산 규모' : 'Available Budget'}</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(config.budget, language)}
                  </span>
                </div>
                <input
                  type="range"
                  min={40000}
                  max={600000}
                  step={10000}
                  value={config.budget}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      budget: Number(e.target.value),
                    }))
                  }
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </section>

            <div className="h-px bg-slate-100" />

            {/* Section 2: Digital Twin Contingency Scenario & Real-Time Re-Optimization */}
            <section className="space-y-2.5">
              <h2 className="text-xs font-semibold text-slate-900">
                {isKo ? '디지털 트윈 돌발상황 대응' : 'Contingency Simulation'}
              </h2>
              <select
                value={contingency}
                onChange={(e) => onChangeContingency(e.target.value as ContingencyScenario)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(CONTINGENCY_INFO) as ContingencyScenario[]).map((scen) => (
                  <option key={scen} value={scen}>
                    {isKo ? CONTINGENCY_INFO[scen].labelKo : CONTINGENCY_INFO[scen].labelEn}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {isKo
                  ? CONTINGENCY_INFO[contingency].descKo
                  : CONTINGENCY_INFO[contingency].descEn}
              </p>
              {contingency !== 'normal' && (
                <button
                  type="button"
                  onClick={onReoptimizeContingency}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>{isKo ? '돌발상황 실시간 재배치 실행' : 'Run Real-Time Re-Optimizer'}</span>
                </button>
              )}
            </section>

            <div className="h-px bg-slate-100" />

            {/* Section 3: Design Objective & Booth Counts */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-slate-900">
                {isKo ? '다목적 설계 목표 및 시설 수량' : 'Objective & Facility Counts'}
              </h2>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  {isKo ? '최우선 최적화 목표' : 'Primary Optimization Objective'}
                </label>
                <select
                  value={config.objective}
                  onChange={(e) =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      objective: e.target.value as DesignObjective,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(Object.keys(OBJECTIVE_LABELS) as DesignObjective[]).map((objKey) => (
                    <option key={objKey} value={objKey}>
                      {isKo ? OBJECTIVE_LABELS_KO[objKey] : OBJECTIVE_LABELS[objKey]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1 truncate">
                    {isKo ? '푸드부스' : 'Food Units'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={config.foodBoothCount}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        foodBoothCount: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                      }))
                    }
                    className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1 truncate">
                    {isKo ? '체험부스' : 'Exp. Booths'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={config.experienceBoothCount}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        experienceBoothCount: Math.max(
                          1,
                          Math.min(16, Number(e.target.value) || 1),
                        ),
                      }))
                    }
                    className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1 truncate">
                    {isKo ? '출입구 수' : 'Gates'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={config.entranceCount}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        entranceCount: Math.max(1, Math.min(6, Number(e.target.value) || 2)),
                      }))
                    }
                    className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
              </div>
            </section>

            <div className="h-px bg-slate-100" />

            {/* Section 4: Required Facilities & Accessibility */}
            <section className="space-y-2.5">
              <h2 className="text-xs font-semibold text-slate-900">
                {isKo ? '필수 특화 구역' : 'Required Zones'}
              </h2>
              <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.requiredFacilities.vipZone}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        requiredFacilities: {
                          ...prev.requiredFacilities,
                          vipZone: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{isKo ? 'VIP 라운지' : 'VIP Lounge'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.requiredFacilities.campingArea}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        requiredFacilities: {
                          ...prev.requiredFacilities,
                          campingArea: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{isKo ? '캠핑·피크닉존' : 'Camping Area'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.requiredFacilities.extraMedical}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        requiredFacilities: {
                          ...prev.requiredFacilities,
                          extraMedical: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{isKo ? '제2 응급의료소' : '2nd Medical'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.requiredFacilities.playRestZone}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        requiredFacilities: {
                          ...prev.requiredFacilities,
                          playRestZone: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{isKo ? '어린이 놀이광장' : 'Kids Play Plaza'}</span>
                </label>
              </div>

              <h2 className="text-xs font-semibold text-slate-900 pt-2">
                {isKo ? '포용적 무장애 설계 조건' : 'Inclusive Accessibility'}
              </h2>
              <div className="space-y-1.5 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.accessibility.stepFreeRoutes}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        accessibility: {
                          ...prev.accessibility,
                          stepFreeRoutes: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{isKo ? '전 시설 무단차 휠체어 경사로' : 'Step-free wheelchair ramps'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.accessibility.wideCorridors}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        accessibility: {
                          ...prev.accessibility,
                          wideCorridors: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{isKo ? '5.2m 휠체어·유모차 광폭 통로' : 'Wide 5.2m accessible corridors'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.accessibility.accessibleRestrooms}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        accessibility: {
                          ...prev.accessibility,
                          accessibleRestrooms: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{isKo ? '장애인 전용 화장실 칸 확보' : 'Accessible restroom stalls'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.accessibility.accessibleParking}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        accessibility: {
                          ...prev.accessibility,
                          accessibleParking: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{isKo ? '주출입구 인접 장애인 주차면' : 'Reserved accessible parking bays'}</span>
                </label>
              </div>
            </section>
          </>
        ) : (
          /* Scene Layer & Facility Visibility Toggles */
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-900">
                {isKo ? '3D 디지털 트윈 레이어' : '3D Layer Visibility'}
              </h2>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => onSetAllVisibility(true)}
                  className="text-blue-600 hover:underline font-medium cursor-pointer"
                >
                  {isKo ? '전체 켜기' : 'Show All'}
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => onSetAllVisibility(false)}
                  className="text-slate-500 hover:underline font-medium cursor-pointer"
                >
                  {isKo ? '최소 표시' : 'Minimal'}
                </button>
              </div>
            </div>

            {groupKeys.map((groupName) => (
              <div key={groupName} className="space-y-1.5">
                <p className="text-[11px] font-medium text-slate-500">{groupName}</p>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {LAYER_ITEMS.filter((item) =>
                    isKo ? item.groupKo === groupName : item.groupEn === groupName,
                  ).map((item) => {
                    const checked = visibility[item.key];
                    return (
                      <label
                        key={item.key}
                        className="flex items-center justify-between px-3 py-2 bg-white hover:bg-slate-50 text-xs text-slate-700 cursor-pointer"
                      >
                        <span>{isKo ? item.labelKo : item.labelEn}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleVisibility(item.key)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* Pinned Functional Action Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70 space-y-2 shrink-0">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onGenerateDesign}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5 shrink-0" />
            <span>{isKo ? '자동 배치 실행' : 'Generate Design'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleSimulation}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              isPlaying
                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 shrink-0" /> : <Play className="w-3.5 h-3.5 shrink-0" />}
            <span>{isPlaying ? (isKo ? '시뮬 일시정지' : 'Pause Sim') : isKo ? '군중 시뮬 실행' : 'Run Sim'}</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={onResetDesign}
            title={isKo ? '초기 표준 배치로 복원' : 'Reset to Default Layout'}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
            <span>{isKo ? '초기화' : 'Reset'}</span>
          </button>
          <button
            type="button"
            onClick={onSaveProject}
            title={isKo ? '브라우저에 현재 설계 저장' : 'Save Project'}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 whitespace-nowrap cursor-pointer"
          >
            <Save className="w-3 h-3 shrink-0" />
            <span>{isKo ? '저장' : 'Save'}</span>
          </button>
          <button
            type="button"
            onClick={onExportJson}
            title={isKo ? 'JSON 설계 데이터 내보내기' : 'Export JSON'}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3 h-3 shrink-0" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={isKo ? 'JSON 설계 파일 불러오기' : 'Import JSON'}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 whitespace-nowrap cursor-pointer"
          >
            <Upload className="w-3 h-3 shrink-0" />
            <span>{isKo ? '열기' : 'Import'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportJson(file);
              e.target.value = '';
            }}
          />
        </div>

        <a
          href="/incluse-ai-festival-designer-source.zip"
          download="incluse-ai-festival-designer-source.zip"
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <Download className="w-3 h-3 shrink-0" />
          <span>{isKo ? '전체 소스코드 다운로드 (.zip)' : 'Download Full Source (.zip)'}</span>
        </a>
      </div>
    </aside>
  );
};