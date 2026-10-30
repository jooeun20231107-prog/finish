import React, { useState } from 'react';
import { ArrowLeft, Search, ArrowUpRight } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  EventConfig,
  Facility,
  Language,
  LayoutMetricsSummary,
  SimulationSnapshot,
} from '../types/festival';
import {
  CONTINGENCY_INFO,
  formatCurrency,
  getFacilityDisplayName,
} from '../engine/presets';

interface AnalyticsViewProps {
  language: Language;
  config: EventConfig;
  facilities: Facility[];
  snapshot: SimulationSnapshot;
  summary: LayoutMetricsSummary;
  onInspectFacilityIn3D: (id: string) => void;
  onBackToWorkspace: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  language,
  config,
  facilities,
  snapshot,
  summary,
  onInspectFacilityIn3D,
  onBackToWorkspace,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const isKo = language === 'ko';
  const contInfo = CONTINGENCY_INFO[snapshot.contingency];

  const filteredFacilities = facilities.filter((f) => {
    const q = searchTerm.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      (f.nameKo && f.nameKo.toLowerCase().includes(q)) ||
      f.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-[1260px] mx-auto space-y-6">
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
                ? '시간대별 군중 흐름 · 병목 밀집도 및 시설 가동률 분석'
                : 'Crowd Dynamics & Facility Utilization Analytics'}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {isKo
                ? `${config.eventName} (${config.expectedAttendance.toLocaleString()}명 규모 · 시나리오: ${contInfo.shortKo}) 전 시간대 밀집도 및 시설별 대기열 시뮬레이션`
                : `Time-series density estimates, queue loads, and individual facility telemetry for ${config.eventName} (${config.expectedAttendance.toLocaleString()} expected visitors).`}
            </p>
          </div>
          <div className="text-xs font-mono text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg">
            {isKo ? '현재 시점:' : 'Snapshot:'} {snapshot.currentTimeLabel} ·{' '}
            {isKo ? snapshot.phase.labelKo : snapshot.phase.label}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-slate-900">
              {isKo
                ? '전 시간대 피크 군중 밀집도 추이 (행안부 경계선 2.5명/m² 표시)'
                : 'Modeled Density Curve Across Event Schedule'}
            </h2>
            <p className="text-xs text-slate-500">
              {isKo
                ? `운영 시간(${config.startTime}~${config.endTime}) 동안 최대 밀집도(명/m²) 및 활성 구역 평균 밀집도 변화`
                : `Peak crowd density (persons/m²) vs. average active zone density from ${config.startTime} to ${config.endTime}.`}
            </p>
            <div className="h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={snapshot.timelineSeries}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', borderColor: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <ReferenceLine
                    y={2.5}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    label={{
                      value: isKo ? '행안부 경계 (2.5)' : 'MoIS Warning (2.5)',
                      position: 'insideTopRight',
                      fill: '#b45309',
                      fontSize: 10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="peakDensity"
                    name={isKo ? '피크 밀집도 (명/m²)' : 'Peak Density (p/m²)'}
                    stroke="#dc2626"
                    strokeWidth={2.2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgDensity"
                    name={isKo ? '활성 구역 평균 (명/m²)' : 'Avg Active Density (p/m²)'}
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-slate-900">
              {isKo
                ? '행사 단계별 구역 체류 인원 비중 변화 (%)'
                : 'Visitor Distribution Shift by Event Phase (%)'}
            </h2>
            <p className="text-xs text-slate-500">
              {isKo
                ? '무대·관객석, 푸드·쉼터, 체험부스 권역 간 시간대별 관람객 이동 분포'
                : 'Share of active attendees drawn toward Stage/Seating, Food & Rest, and Experience Booths.'}
            </p>
            <div className="h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={snapshot.timelineSeries}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', borderColor: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="stageZoneShare"
                    name={isKo ? '무대·관객석 %' : 'Stage & Seating %'}
                    stackId="a"
                    fill="#2563eb"
                  />
                  <Bar
                    dataKey="foodZoneShare"
                    name={isKo ? '푸드·휴게존 %' : 'Food & Rest %'}
                    stackId="a"
                    fill="#f97316"
                  />
                  <Bar
                    dataKey="boothZoneShare"
                    name={isKo ? '체험부스 %' : 'Booths %'}
                    stackId="a"
                    fill="#0d9488"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Facility Inventory & Live Occupancy Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isKo
                  ? `전체 3D 시설 명세 및 실시간 체류·대기 현황 (${filteredFacilities.length} / ${summary.totalFacilities}개)`
                  : `Complete Facility Schedule & Modeled Load (${filteredFacilities.length} of ${summary.totalFacilities})`}
              </h2>
              <p className="text-xs text-slate-500">
                {isKo
                  ? '행을 클릭하면 3D 디지털 트윈 화면에서 해당 시설로 즉시 포커스·편집합니다.'
                  : 'Click any row to highlight and edit that facility inside the 3D scene.'}
              </p>
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isKo ? '시설명 또는 카테고리 검색...' : 'Filter by facility or category...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-medium">{isKo ? '시설명' : 'Facility Name'}</th>
                  <th className="py-2.5 px-4 font-medium">{isKo ? '분류' : 'Category'}</th>
                  <th className="py-2.5 px-4 font-medium text-right">{isKo ? '3D 좌표 (X, Z)' : 'Coords (X, Z)'}</th>
                  <th className="py-2.5 px-4 font-medium text-right">{isKo ? '규격' : 'Footprint'}</th>
                  <th className="py-2.5 px-4 font-medium text-right">{isKo ? '수용 정원' : 'Capacity'}</th>
                  <th className="py-2.5 px-4 font-medium text-right">
                    {isKo ? `체류 인원 (${snapshot.currentTimeLabel})` : `Load (${snapshot.currentTimeLabel})`}
                  </th>
                  <th className="py-2.5 px-4 font-medium text-right">{isKo ? '예상 대기열' : 'Est. Queue'}</th>
                  <th className="py-2.5 px-4 font-medium text-right">{isKo ? '설치 비용' : 'Cost'}</th>
                  <th className="py-2.5 px-4 font-medium text-right">{isKo ? '3D 보기' : 'Inspect'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredFacilities.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center font-sans text-slate-500">
                      {isKo
                        ? `"${searchTerm}" 검색 결과와 일치하는 시설이 없습니다.`
                        : `No facilities match "${searchTerm}".`}
                    </td>
                  </tr>
                ) : (
                  filteredFacilities.map((f) => {
                    const occ = snapshot.facilityOccupancy[f.id] || 0;
                    const q = snapshot.facilityQueues[f.id] || 0;
                    return (
                      <tr
                        key={f.id}
                        onClick={() => onInspectFacilityIn3D(f.id)}
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-900">
                          {getFacilityDisplayName(f, language)}
                        </td>
                        <td className="py-2.5 px-4 font-sans capitalize text-slate-600">
                          {f.category}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600">
                          ({Math.round(f.position.x)}, {Math.round(f.position.z)})
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600">
                          {f.dimensions.width}m × {f.dimensions.depth}m
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-800">
                          {f.capacity.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                          {occ.toLocaleString()}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right ${
                            q > 40 ? 'text-red-700 font-semibold' : 'text-slate-600'
                          }`}
                        >
                          {q}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600">
                          {formatCurrency(f.cost, language)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <ArrowUpRight className="w-3.5 h-3.5 inline text-blue-600" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};