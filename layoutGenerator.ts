import {
  ContingencyScenario,
  DesignObjective,
  EventConfig,
  EventType,
  Facility,
  Language,
  ParsedBriefResult,
  VisitorPersonaId,
} from '../types/festival';
import { createSeededRandom, hashStringSeed } from './prng';

interface Box2D {
  x: number;
  z: number;
  w: number;
  d: number;
}

function boxesOverlap(a: Box2D, b: Box2D, margin: number): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w + margin * 2 &&
    Math.abs(a.z - b.z) * 2 < a.d + b.d + margin * 2
  );
}

function clampToVenue(
  x: number,
  z: number,
  w: number,
  d: number,
  venueWidth: number,
  venueDepth: number,
  edgePadding = 6,
): { x: number; z: number } {
  const halfW = venueWidth / 2 - w / 2 - edgePadding;
  const halfD = venueDepth / 2 - d / 2 - edgePadding;
  return {
    x: Math.round(Math.max(-halfW, Math.min(halfW, x))),
    z: Math.round(Math.max(-halfD, Math.min(halfD, z))),
  };
}

export function validateEventConfig(config: EventConfig, lang: Language = 'ko'): string[] {
  const errors: string[] = [];
  if (!config.eventName.trim()) {
    errors.push(lang === 'ko' ? '행사명을 입력해 주세요.' : 'Event name cannot be empty.');
  }
  if (config.venueWidth < 100 || config.venueWidth > 360) {
    errors.push(
      lang === 'ko'
        ? '행사장 가로 폭은 100m ~ 360m 범위여야 합니다.'
        : 'Venue width must be between 100m and 360m.',
    );
  }
  if (config.venueDepth < 90 || config.venueDepth > 300) {
    errors.push(
      lang === 'ko'
        ? '행사장 세로 길이는 90m ~ 300m 범위여야 합니다.'
        : 'Venue depth must be between 90m and 300m.',
    );
  }
  if (config.expectedAttendance < 200 || config.expectedAttendance > 50000) {
    errors.push(
      lang === 'ko'
        ? '예상 방문객 수는 200명 ~ 50,000명 범위여야 합니다.'
        : 'Expected attendance must be between 200 and 50,000 visitors.',
    );
  }
  if (config.budget < 20000) {
    errors.push(
      lang === 'ko'
        ? '가용 예산은 최소 약 2,700만 원($20,000) 이상이어야 합니다.'
        : 'Available budget must be at least $20,000.',
    );
  }
  if (config.entranceCount < 1 || config.entranceCount > 6) {
    errors.push(
      lang === 'ko'
        ? '출입구 수는 1개 ~ 6개 사이로 설정해 주세요.'
        : 'Number of entrances/exits must be between 1 and 6.',
    );
  }
  return errors;
}

/**
 * Deterministic Client Fallback Parser for Natural-Language Event Briefs
 * (used when offline or embedded inside a static Streamlit build).
 */
export function parseBriefDeterministically(
  prompt: string,
  baseConfig: EventConfig,
): ParsedBriefResult {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  let eventType: EventType = baseConfig.eventType;
  if (/학교|대동제|한솔|학생|캠퍼스|school|campus/.test(lower)) eventType = 'school_festival';
  else if (/체육|마라톤|스포츠|운동회|sports|marathon/.test(lower)) eventType = 'sports_event';
  else if (/박람회|전시|엑스포|모빌리티|expo|exhibition/.test(lower)) eventType = 'exhibition';
  else if (/진로|취업|채용|커리어|career|job/.test(lower)) eventType = 'career_fair';
  else if (/플리마켓|벼룩|수공예|마켓|flea|market/.test(lower)) eventType = 'flea_market';
  else if (/지역|시민|마을|농특산물|문화제|community/.test(lower)) eventType = 'community_festival';
  else if (/음악|뮤직|콘서트|페스티벌|music|concert/.test(lower)) eventType = 'music_festival';

  let expectedAttendance = baseConfig.expectedAttendance;
  const manMatch = text.match(/(\d+(?:\.\d+)?)\s*만\s*명/);
  const cheonMatch = text.match(/(\d+(?:\.\d+)?)\s*천\s*명/);
  const plainPeopleMatch = text.match(/(\d{1,3}(?:,\d{3})+|\d{3,5})\s*(?:명|인|pax|people|visitors)/i);
  if (manMatch) {
    expectedAttendance = Math.round(Number(manMatch[1]) * 10000);
  } else if (cheonMatch) {
    expectedAttendance = Math.round(Number(cheonMatch[1]) * 1000);
  } else if (plainPeopleMatch) {
    expectedAttendance = Number(plainPeopleMatch[1].replace(/,/g, ''));
  }
  expectedAttendance = Math.max(300, Math.min(45000, expectedAttendance));

  let venueWidth = baseConfig.venueWidth;
  let venueDepth = baseConfig.venueDepth;
  const dimMatch = text.match(/(\d{2,3})\s*(?:m|미터)?\s*[xX×*]\s*(\d{2,3})\s*(?:m|미터)?/);
  if (dimMatch) {
    venueWidth = Math.max(100, Math.min(360, Number(dimMatch[1])));
    venueDepth = Math.max(90, Math.min(300, Number(dimMatch[2])));
  } else if (expectedAttendance <= 4000) {
    venueWidth = 160;
    venueDepth = 130;
  } else if (expectedAttendance >= 15000) {
    venueWidth = 260;
    venueDepth = 190;
  }

  let budget = baseConfig.budget;
  const eokMatch = text.match(/(\d+(?:\.\d+)?)\s*억/);
  const cheonManMatch = text.match(/(\d+(?:\.\d+)?)\s*천만\s*원/);
  const usdMatch = text.match(/\$\s*(\d{2,6}(?:,\d{3})*)/);
  if (eokMatch) {
    budget = Math.round((Number(eokMatch[1]) * 100_000_000) / 1350);
  } else if (cheonManMatch) {
    budget = Math.round((Number(cheonManMatch[1]) * 10_000_000) / 1350);
  } else if (usdMatch) {
    budget = Number(usdMatch[1].replace(/,/g, ''));
  }
  budget = Math.max(25000, Math.min(750000, budget));

  let objective: DesignObjective = baseConfig.objective;
  if (/휠체어|유모차|교통약자|고령자|어르신|어린이|포용|무장애|accessible|wheelchair|inclusive/.test(lower)) {
    objective = 'accessibility_inclusion';
  } else if (/혼잡|병목|대기|분산|congestion|queue/.test(lower)) {
    objective = 'congestion_reduction';
  } else if (/예산|절감|저비용|budget|cost/.test(lower)) {
    objective = 'budget_efficiency';
  } else if (/안전|비상|대피|밀집|safety|emergency/.test(lower)) {
    objective = 'safety_first';
  } else if (/체험|참여|만족|engagement/.test(lower)) {
    objective = 'visitor_engagement';
  }

  const foodBoothMatch = text.match(/(?:푸드|음식|매점|먹거리)\D{0,6}(\d{1,2})\s*개/);
  const expBoothMatch = text.match(/(?:체험|전시|홍보|부스)\D{0,6}(\d{1,2})\s*개/);
  const gateMatch = text.match(/(?:출입구|게이트)\D{0,6}(\d{1})\s*개/);

  const foodBoothCount = foodBoothMatch
    ? Math.max(1, Math.min(12, Number(foodBoothMatch[1])))
    : Math.max(3, Math.min(10, Math.round(expectedAttendance / 1700)));
  const experienceBoothCount = expBoothMatch
    ? Math.max(1, Math.min(16, Number(expBoothMatch[1])))
    : eventType === 'school_festival' || eventType === 'career_fair'
      ? 10
      : 7;
  const entranceCount = gateMatch
    ? Math.max(2, Math.min(6, Number(gateMatch[1])))
    : expectedAttendance >= 9000
      ? 3
      : 2;

  const inclusiveMentioned =
    /휠체어|유모차|어르신|고령자|어린이|외국인|포용|무장애|wheelchair|stroller|inclusive/.test(lower);

  let eventName = baseConfig.eventName;
  const quoteMatch = text.match(/['"「『]([^'"」』]{3,28})['"」』]/);
  if (quoteMatch) {
    eventName = quoteMatch[1];
  } else if (eventType === 'school_festival') {
    eventName = '2026 건양고 한솔 대동제';
  } else if (eventType === 'community_festival') {
    eventName = '2026 시민 포용 문화축제';
  } else if (eventType === 'career_fair') {
    eventName = '2026 청년 진로·취업 박람회';
  }

  return {
    eventName,
    eventType,
    venueWidth,
    venueDepth,
    expectedAttendance,
    budget,
    objective,
    foodBoothCount,
    experienceBoothCount,
    entranceCount,
    vipZone: /vip/i.test(lower),
    campingArea: /캠핑|텐트|피크닉|camping/.test(lower),
    extraMedical: expectedAttendance >= 8000 || /응급|의료|안전|medical/.test(lower),
    playRestZone: true,
    stepFreeRoutes: true,
    wideCorridors: inclusiveMentioned || objective === 'safety_first',
    accessibleRestrooms: true,
    accessibleParking: true,
    extractedSummary: `자연어 조건 분석 완료: ${expectedAttendance.toLocaleString()}명 규모 (${venueWidth}m×${venueDepth}m), 푸드존 ${foodBoothCount}개·체험부스 ${experienceBoothCount}개·출입구 ${entranceCount}개 및 포용적 무장애 동선 조건을 반영했습니다.`,
  };
}

/**
 * Heuristic Spatial Layout Generator with Inclusive Facilities (Family Lounge + Multilingual Hub).
 */
export function generateVenueLayout(config: EventConfig): Facility[] {
  const seed =
    config.seed ^
    hashStringSeed(
      `${config.eventType}-${config.venueWidth}x${config.venueDepth}-${config.objective}-${config.foodBoothCount}-${config.experienceBoothCount}-${config.entranceCount}`,
    );
  const rand = createSeededRandom(seed);

  const W = config.venueWidth;
  const D = config.venueDepth;
  const minMargin =
    config.accessibility.wideCorridors ||
    config.objective === 'safety_first' ||
    config.objective === 'accessibility_inclusion'
      ? 5.5
      : 3.6;

  const placed: Box2D[] = [];
  const facilities: Facility[] = [];

  // Reserve central emergency evacuation spine (x = -7 across Z)
  placed.push({ x: -7, z: 8, w: config.accessibility.wideCorridors ? 10 : 7, d: D * 0.56 });

  const tryPlace = (
    preferredX: number,
    preferredZ: number,
    width: number,
    depth: number,
    edgePad = 6,
  ): { x: number; z: number } => {
    const base = clampToVenue(preferredX, preferredZ, width, depth, W, D, edgePad);
    if (!placed.some((b) => boxesOverlap({ x: base.x, z: base.z, w: width, d: depth }, b, minMargin))) {
      placed.push({ x: base.x, z: base.z, w: width, d: depth });
      return base;
    }
    for (let radius = 5; radius <= 75; radius += 5) {
      for (let angleStep = 0; angleStep < 12; angleStep++) {
        const theta = (angleStep / 12) * Math.PI * 2 + rand() * 0.25;
        const cand = clampToVenue(
          base.x + Math.cos(theta) * radius,
          base.z + Math.sin(theta) * radius,
          width,
          depth,
          W,
          D,
          edgePad,
        );
        if (!placed.some((b) => boxesOverlap({ x: cand.x, z: cand.z, w: width, d: depth }, b, minMargin))) {
          placed.push({ x: cand.x, z: cand.z, w: width, d: depth });
          return cand;
        }
      }
    }
    placed.push({ x: base.x, z: base.z, w: width, d: depth });
    return base;
  };

  const allAccessible =
    config.accessibility.stepFreeRoutes || config.objective === 'accessibility_inclusion';

  // 1. Parking Lot along North-East perimeter
  const parkW = Math.min(36, Math.round(W * 0.18));
  const parkD = Math.min(54, Math.round(D * 0.36));
  const parkPos = tryPlace(W * 0.37, -D * 0.18, parkW, parkD, 4);
  facilities.push({
    id: 'parking-main',
    name: 'Perimeter & Accessible Parking',
    nameKo: '외곽 주차장 (장애인 전용면 포함)',
    category: 'parking',
    subtype: 'parking_lot',
    position: parkPos,
    dimensions: { width: parkW, depth: parkD, height: 0.4 },
    rotation: 0,
    capacity: Math.round(parkW * parkD * 0.45),
    cost: config.objective === 'budget_efficiency' ? 11500 : 14000,
    attractionWeight: 0.8,
    colorAccent: '#475569',
    covered: false,
    accessibility: {
      wheelchairAccessible: config.accessibility.accessibleParking || allAccessible,
      stepFreeEntry: true,
      priorityQueue: config.accessibility.accessibleParking,
    },
    notes: '주출입구 인접 장애인 전용 구획이 포함된 방문객 주차장입니다.',
  });

  // 2. Main Stage
  const isStageCentric =
    config.eventType === 'music_festival' ||
    config.eventType === 'school_festival' ||
    config.eventType === 'sports_event';
  const stageW = isStageCentric ? Math.min(42, Math.max(28, Math.round(W * 0.19))) : 24;
  const stageD = isStageCentric ? 19 : 14;
  const stagePos = tryPlace(-6, -D * 0.31, stageW, stageD, 7);
  facilities.push({
    id: 'stage-main',
    name:
      config.eventType === 'career_fair' || config.eventType === 'exhibition'
        ? 'Keynote & Presentation Stage'
        : config.eventType === 'flea_market'
          ? 'Acoustic Busking Stage'
          : 'Main Performance Stage',
    nameKo:
      config.eventType === 'career_fair' || config.eventType === 'exhibition'
        ? '키노트 발표 무대'
        : config.eventType === 'flea_market'
          ? '어쿠스틱 버스킹 무대'
          : '메인 공연 무대',
    category: 'stage',
    subtype: 'main_stage',
    position: stagePos,
    dimensions: { width: stageW, depth: stageD, height: isStageCentric ? 14 : 9.5 },
    rotation: 0,
    capacity: Math.round(config.expectedAttendance * (isStageCentric ? 0.42 : 0.22)),
    cost: config.objective === 'budget_efficiency' ? 44000 : isStageCentric ? 66000 : 35000,
    attractionWeight: isStageCentric ? 2.7 : 1.5,
    colorAccent: '#2563eb',
    covered: true,
    accessibility: {
      wheelchairAccessible: true,
      stepFreeEntry: true,
      priorityQueue: allAccessible,
    },
    notes: '전면 안전 완충 구역 및 무장애 경사로가 적용된 중심 무대입니다.',
  });

  // 3. Audience / Seating Blocks
  const seatBlocks = config.eventType === 'flea_market' ? 1 : 2;
  const seatSafetyGap = config.objective === 'safety_first' ? 12 : 9;
  for (let i = 0; i < seatBlocks; i++) {
    const sw = seatBlocks === 1 ? 26 : 21;
    const sd = isStageCentric ? 22 : 16;
    const targetX = seatBlocks === 1 ? stagePos.x : stagePos.x + (i === 0 ? -15 : 15);
    const targetZ = stagePos.z + stageD / 2 + seatSafetyGap + sd / 2;
    const pos = tryPlace(targetX, targetZ, sw, sd, 7);
    facilities.push({
      id: `seating-${i + 1}`,
      name: seatBlocks === 1 ? 'Central Viewing Lawn' : `Audience Block ${i === 0 ? 'A (West)' : 'B (East)'}`,
      nameKo: seatBlocks === 1 ? '중앙 관람 잔디석' : `관객석 ${i === 0 ? 'A구역 (서측·휠체어석)' : 'B구역 (동측)'}`,
      category: 'seating',
      subtype: 'seating_block',
      position: pos,
      dimensions: { width: sw, depth: sd, height: 2.0 },
      rotation: 0,
      capacity: Math.round((config.expectedAttendance * (isStageCentric ? 0.4 : 0.2)) / seatBlocks),
      cost: 13000,
      attractionWeight: isStageCentric ? 2.1 : 1.25,
      colorAccent: '#3b82f6',
      covered: false,
      accessibility: {
        wheelchairAccessible: true,
        stepFreeEntry: true,
        priorityQueue: i === 0 || allAccessible,
      },
    });
  }

  // 4. Optional VIP Zone & Camping Area
  if (config.requiredFacilities.vipZone) {
    const vipPos = tryPlace(stagePos.x + stageW / 2 + 16, stagePos.z + 6, 19, 13, 7);
    facilities.push({
      id: 'vip-lounge-1',
      name: 'VIP Hospitality Lounge',
      nameKo: 'VIP 라운지 데크',
      category: 'vip',
      subtype: 'vip_lounge',
      position: vipPos,
      dimensions: { width: 19, depth: 13, height: 5.5 },
      rotation: -Math.PI / 2,
      capacity: Math.round(config.expectedAttendance * 0.05),
      cost: 21000,
      attractionWeight: 1.3,
      colorAccent: '#7c3aed',
      covered: true,
      accessibility: {
        wheelchairAccessible: true,
        stepFreeEntry: true,
        priorityQueue: true,
      },
    });
  }

  if (config.requiredFacilities.campingArea) {
    const campPos = tryPlace(-W * 0.32, -D * 0.28, 34, 28, 6);
    facilities.push({
      id: 'camping-zone-1',
      name: 'Meadow Camping Village',
      nameKo: '캠핑·피크닉 빌리지',
      category: 'camping',
      subtype: 'camping_zone',
      position: campPos,
      dimensions: { width: 34, depth: 28, height: 3.5 },
      rotation: 0,
      capacity: Math.round(config.expectedAttendance * 0.08),
      cost: 12500,
      attractionWeight: 0.95,
      colorAccent: '#0d9488',
      covered: true,
      accessibility: {
        wheelchairAccessible: allAccessible,
        stepFreeEntry: true,
        priorityQueue: false,
      },
    });
  }

  // 5. Entrances & Exits
  const portalSpecs: Array<{
    x: number;
    z: number;
    rot: number;
    name: string;
    nameKo: string;
    main?: boolean;
  }> = [
    {
      x: W * 0.41,
      z: D * 0.16,
      rot: Math.PI / 2,
      name: 'Main East Gate Arch',
      nameKo: '동측 주출입구 아치',
      main: true,
    },
    {
      x: -W * 0.28,
      z: D * 0.42,
      rot: 0,
      name: 'South-West Park Gate',
      nameKo: '남서측 보조 출입구',
    },
    {
      x: W * 0.12,
      z: D * 0.42,
      rot: 0,
      name: 'South Boulevard Gate',
      nameKo: '남측 중앙 분산 게이트',
    },
    {
      x: -W * 0.41,
      z: -D * 0.04,
      rot: -Math.PI / 2,
      name: 'West Promenade Gate',
      nameKo: '서측 산책로 게이트',
    },
    {
      x: W * 0.18,
      z: -D * 0.42,
      rot: Math.PI,
      name: 'North Transit Gate',
      nameKo: '북측 대중교통 출입구',
    },
    {
      x: -W * 0.12,
      z: D * 0.42,
      rot: 0,
      name: 'Central South Egress Gate',
      nameKo: '남측 비상 퇴장 게이트',
    },
  ];

  const entranceCapacityEach = Math.max(
    900,
    Math.round((config.expectedAttendance * 0.36) / config.entranceCount),
  );

  for (let i = 0; i < config.entranceCount; i++) {
    const spec = portalSpecs[i % portalSpecs.length];
    const isVert = Math.abs(Math.sin(spec.rot)) > 0.5;
    const ew = isVert ? 8 : 15;
    const ed = isVert ? 16 : 7;
    const pos = tryPlace(spec.x, spec.z, ew, ed, 3);
    facilities.push({
      id: `entrance-${i + 1}`,
      name: spec.name,
      nameKo: spec.nameKo,
      category: 'entrance',
      subtype: spec.main ? 'main_entrance' : 'secondary_entrance',
      position: pos,
      dimensions: { width: ew, depth: ed, height: spec.main ? 9.5 : 8 },
      rotation: spec.rot,
      capacity: spec.main ? Math.round(entranceCapacityEach * 1.25) : entranceCapacityEach,
      cost: spec.main ? 11500 : 8800,
      attractionWeight: spec.main ? 1.9 : 1.35,
      colorAccent: spec.main ? '#2563eb' : '#0ea5e9',
      covered: true,
      accessibility: {
        wheelchairAccessible: true,
        stepFreeEntry: true,
        priorityQueue: i === 0 || allAccessible,
      },
    });
  }

  // Multilingual Info & Box Office near Main Gate
  const infoPos = tryPlace(W * 0.27, D * 0.22, 12, 8, 6);
  facilities.push({
    id: 'info-multilingual-1',
    name: 'Multilingual Info & Lost-Child Hub',
    nameKo: '다국어 종합안내소 · 미아보호소',
    category: 'entrance',
    subtype: 'multilingual_info',
    position: infoPos,
    dimensions: { width: 12, depth: 8, height: 4.5 },
    rotation: 0,
    capacity: 340,
    cost: 7600,
    attractionWeight: 1.15,
    colorAccent: '#0284c7',
    covered: true,
    accessibility: {
      wheelchairAccessible: true,
      stepFreeEntry: true,
      priorityQueue: true,
    },
    notes: '주출입구 직결 한·영·중·일 다국어 안내 및 미아보호 통합 부스입니다.',
  });

  // 6. Food Trucks & Stalls
  const splitFoodZones =
    config.objective === 'congestion_reduction' ||
    config.objective === 'visitor_engagement' ||
    config.objective === 'safety_first';
  const foodColors = ['#f97316', '#ef4444', '#06b6d4', '#eab308', '#10b981', '#ec4899', '#8b5cf6'];
  const foodNames = [
    ['Seoul Street Kitchen Truck', '푸드트럭 1 (스트리트 키친)'],
    ['Artisan Wood-Fired Pizza', '푸드트럭 2 (화덕 피자)'],
    ['Citrus Cold Brew & Gelato', '푸드트럭 3 (콜드브루·젤라또)'],
    ['Craft Smokehouse Pavilion', '음식 부스 4 (바비큐 존)'],
    ['Fresh Berry & Bento Stall', '음식 부스 5 (수제 도시락)'],
    ['Taco & Churro Cruiser', '푸드트럭 6 (타코·츄러스)'],
    ['Matcha & Waffle Bar', '음식 부스 7 (와플·음료)'],
    ['Crispy Skewer Market Stall', '음식 부스 8 (로컬 분식)'],
  ];

  for (let i = 0; i < config.foodBoothCount; i++) {
    const isTruck = i < Math.ceil(config.foodBoothCount * 0.55);
    const fw = isTruck ? 10 : 8;
    const fd = isTruck ? 5.5 : 7;
    const inEastSplit = splitFoodZones && i % 2 === 1;
    const targetX = inEastSplit ? W * 0.14 + (i % 3) * 10 : -W * 0.25 + (i % 2) * 12;
    const targetZ = inEastSplit
      ? D * 0.21
      : -D * 0.05 + Math.floor(i / (splitFoodZones ? 2 : 1.5)) * 13;
    const pos = tryPlace(targetX, targetZ, fw, fd, 6);
    const pair = foodNames[i % foodNames.length];
    facilities.push({
      id: `food-${i + 1}`,
      name: pair[0],
      nameKo: pair[1],
      category: 'food',
      subtype: isTruck ? 'food_truck' : 'food_stall',
      position: pos,
      dimensions: { width: fw, depth: fd, height: 4.1 },
      rotation: isTruck && !inEastSplit ? Math.PI / 2 : 0,
      capacity: Math.round(230 + (config.expectedAttendance / 1000) * 8),
      cost: isTruck ? 5200 : 4400,
      attractionWeight: 1.75,
      colorAccent: foodColors[i % foodColors.length],
      covered: !isTruck,
      accessibility: {
        wheelchairAccessible: true,
        stepFreeEntry: true,
        priorityQueue: allAccessible && i === 0,
      },
    });
  }

  // 7. Experience / Exhibition Booths
  const boothColors = ['#2563eb', '#f59e0b', '#6366f1', '#10b981', '#8b5cf6', '#0ea5e9'];
  const cols = Math.max(2, Math.ceil(Math.sqrt(config.experienceBoothCount)));
  for (let i = 0; i < config.experienceBoothCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const spreadWest = splitFoodZones && i >= Math.ceil(config.experienceBoothCount * 0.65);
    const bx = spreadWest ? -W * 0.16 - col * 11 : W * 0.17 + col * 11.5;
    const bz = spreadWest ? D * 0.12 + row * 11 : -D * 0.08 + row * 12;
    const pos = tryPlace(bx, bz, 8, 8, 6);
    facilities.push({
      id: `booth-${i + 1}`,
      name:
        config.eventType === 'career_fair'
          ? `Employer Pavilion #${i + 1}`
          : config.eventType === 'flea_market'
            ? `Maker Canopy #${i + 1}`
            : `Experience Booth #${i + 1}`,
      nameKo:
        config.eventType === 'school_festival'
          ? `학생 동아리 체험부스 #${i + 1}`
          : config.eventType === 'career_fair'
            ? `진로·직업체험 부스 #${i + 1}`
            : `체험·전시 부스 #${i + 1}`,
      category: 'booth',
      subtype: 'experience_booth',
      position: pos,
      dimensions: { width: 8, depth: 8, height: 5 },
      rotation: 0,
      capacity: 185,
      cost: config.objective === 'budget_efficiency' ? 4600 : 5600,
      attractionWeight: 1.4 + (i % 3) * 0.15,
      colorAccent: boothColors[i % boothColors.length],
      covered: true,
      accessibility: {
        wheelchairAccessible: allAccessible || i % 4 !== 3,
        stepFreeEntry: true,
        priorityQueue: false,
      },
    });
  }

  // 8. Rest Areas, Family Lounge & Play Plaza
  const restPos = tryPlace(-W * 0.14, D * 0.27, 24, 16, 6);
  facilities.push({
    id: 'rest-dining-main',
    name: 'Shaded Parasol Dining Plaza',
    nameKo: '그늘막 파라솔 휴게 광장',
    category: 'rest',
    subtype: 'rest_plaza',
    position: restPos,
    dimensions: { width: 24, depth: 16, height: 3.5 },
    rotation: 0,
    capacity: 500,
    cost: 9200,
    attractionWeight: 1.35,
    colorAccent: '#0ea5e9',
    covered: false,
    accessibility: {
      wheelchairAccessible: true,
      stepFreeEntry: true,
      priorityQueue: false,
    },
  });

  // Inclusive Family & Stroller Nursing Lounge
  const famPos = tryPlace(W * 0.06, D * 0.16, 13, 9, 6);
  facilities.push({
    id: 'rest-family-lounge',
    name: 'Stroller & Nursing Family Lounge',
    nameKo: '유모차·수유 가족 쉼터',
    category: 'rest',
    subtype: 'family_lounge',
    position: famPos,
    dimensions: { width: 13, depth: 9, height: 4.2 },
    rotation: 0,
    capacity: 180,
    cost: 8200,
    attractionWeight: 1.15,
    colorAccent: '#f43f5e',
    covered: true,
    accessibility: {
      wheelchairAccessible: true,
      stepFreeEntry: true,
      priorityQueue: true,
    },
  });

  if (config.requiredFacilities.playRestZone) {
    const playPos = tryPlace(-W * 0.32, D * 0.18, 26, 22, 6);
    facilities.push({
      id: 'rest-play-zone',
      name: 'Central Fountain & Kids Play Plaza',
      nameKo: '어린이 놀이·분수 광장',
      category: 'rest',
      subtype: 'play_zone',
      position: playPos,
      dimensions: { width: 26, depth: 22, height: 14 },
      rotation: 0,
      capacity: 620,
      cost: 18500,
      attractionWeight: 1.55,
      colorAccent: '#ec4899',
      covered: false,
      accessibility: {
        wheelchairAccessible: true,
        stepFreeEntry: true,
        priorityQueue: false,
      },
    });
  }

  // 9. Restrooms
  const restroomCount = config.expectedAttendance >= 8500 ? 3 : 2;
  const rrTargets = [
    { x: 4, z: D * 0.32, name: 'South Central Restrooms', nameKo: '남측 중앙 화장실 (장애인 칸)' },
    { x: -W * 0.2, z: -D * 0.32, name: 'North-West Stage Restrooms', nameKo: '북서측 무대 화장실' },
    { x: W * 0.24, z: -D * 0.24, name: 'East Plaza Restrooms', nameKo: '동측 부스존 화장실' },
  ];
  for (let i = 0; i < restroomCount; i++) {
    const pos = tryPlace(rrTargets[i].x, rrTargets[i].z, 14, 7, 6);
    facilities.push({
      id: `restroom-${i + 1}`,
      name: rrTargets[i].name,
      nameKo: rrTargets[i].nameKo,
      category: 'restroom',
      subtype: 'restroom_bank',
      position: pos,
      dimensions: { width: 14, depth: 7, height: 3.8 },
      rotation: 0,
      capacity: 260,
      cost: 10500,
      attractionWeight: 1.5,
      colorAccent: '#0284c7',
      covered: true,
      accessibility: {
        wheelchairAccessible: config.accessibility.accessibleRestrooms || allAccessible,
        stepFreeEntry: true,
        priorityQueue: true,
      },
    });
  }

  // 10. Medical Stations
  const medCount =
    config.requiredFacilities.extraMedical ||
    config.objective === 'safety_first' ||
    config.expectedAttendance >= 10500
      ? 2
      : 1;
  const medTargets = [
    { x: W * 0.22, z: D * 0.3, name: 'Primary Emergency Medical Center', nameKo: '응급 의료 본부' },
    { x: -W * 0.18, z: -D * 0.14, name: 'Stage West First Aid Post', nameKo: '무대 서측 응급구호소' },
  ];
  for (let i = 0; i < medCount; i++) {
    const pos = tryPlace(medTargets[i].x, medTargets[i].z, 13, 8.5, 6);
    facilities.push({
      id: `medical-${i + 1}`,
      name: medTargets[i].name,
      nameKo: medTargets[i].nameKo,
      category: 'medical',
      subtype: 'medical_station',
      position: pos,
      dimensions: { width: 13, depth: 8.5, height: 4.5 },
      rotation: 0,
      capacity: 120,
      cost: 12500,
      attractionWeight: 0.35,
      colorAccent: '#dc2626',
      covered: true,
      accessibility: {
        wheelchairAccessible: true,
        stepFreeEntry: true,
        priorityQueue: true,
      },
    });
  }

  return facilities;
}

function resolveFacilityOverlaps(facilities: Facility[], W: number, D: number, margin = 3.5): void {
  const occupied: Box2D[] = [];
  for (const f of facilities) {
    const isRot90 = Math.abs(Math.sin(f.rotation)) > 0.7;
    const effW = isRot90 ? f.dimensions.depth : f.dimensions.width;
    const effD = isRot90 ? f.dimensions.width : f.dimensions.depth;
    let candidate = { x: f.position.x, z: f.position.z };
    if (occupied.some((b) => boxesOverlap({ x: candidate.x, z: candidate.z, w: effW, d: effD }, b, margin))) {
      for (let r = 6; r <= 56; r += 6) {
        let found = false;
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const c = clampToVenue(
            f.position.x + Math.cos(ang) * r,
            f.position.z + Math.sin(ang) * r,
            effW,
            effD,
            W,
            D,
            5,
          );
          if (!occupied.some((b) => boxesOverlap({ x: c.x, z: c.z, w: effW, d: effD }, b, margin))) {
            candidate = c;
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    f.position = candidate;
    occupied.push({ x: candidate.x, z: candidate.z, w: effW, d: effD });
  }
}

/**
 * Heuristic Layout Optimizer for Before/After Comparison.
 */
export function optimizeVenueLayout(
  config: EventConfig,
  currentFacilities: Facility[],
): { facilities: Facility[]; notes: string[]; notesKo: string[] } {
  const W = config.venueWidth;
  const D = config.venueDepth;
  const notes: string[] = [];
  const notesKo: string[] = [];
  const next: Facility[] = currentFacilities.map((f) => ({
    ...f,
    position: { ...f.position },
    dimensions: { ...f.dimensions },
    accessibility: { ...f.accessibility },
  }));

  // 1. De-cluster Food & Beverage facilities across West and South-East plazas
  const foods = next.filter((f) => f.category === 'food');
  if (foods.length >= 3) {
    const avgX = foods.reduce((s, f) => s + f.position.x, 0) / foods.length;
    const spreadX =
      Math.max(...foods.map((f) => f.position.x)) - Math.min(...foods.map((f) => f.position.x));
    if (spreadX < W * 0.32) {
      let movedCount = 0;
      foods.forEach((f, idx) => {
        if (idx % 2 === 1) {
          const targetX = avgX < 0 ? Math.round(W * 0.12 + idx * 7) : Math.round(-W * 0.18 - idx * 6);
          const targetZ = Math.round(D * 0.2 + (idx % 2) * 9);
          f.position = clampToVenue(
            targetX,
            targetZ,
            f.dimensions.width,
            f.dimensions.depth,
            W,
            D,
            7,
          );
          f.rotation = 0;
          movedCount++;
        }
      });
      if (movedCount > 0) {
        notes.push(
          `Redistributed ${movedCount} food vendor(s) to a secondary culinary zone to split intermission queues.`,
        );
        notesKo.push(
          `서측에 편중된 푸드부스 중 ${movedCount}개를 남동측 광장으로 분산 배치하여 휴식 시간 대기열 교차를 해소했습니다.`,
        );
      }
    }
  }

  // 2. Widen central emergency & viewing corridor between seating blocks and Main Stage
  const stage = next.find((f) => f.category === 'stage');
  const seats = next.filter((f) => f.category === 'seating');
  if (stage && seats.length >= 2) {
    const leftSeat = seats[0];
    const rightSeat = seats[1];
    const currentGap =
      Math.abs(rightSeat.position.x - leftSeat.position.x) -
      (leftSeat.dimensions.width + rightSeat.dimensions.width) / 2;
    if (currentGap < 9) {
      leftSeat.position.x = Math.round(stage.position.x - leftSeat.dimensions.width / 2 - 5.5);
      rightSeat.position.x = Math.round(stage.position.x + rightSeat.dimensions.width / 2 + 5.5);
      notes.push(
        'Widened central audience aisle to 11m and aligned blocks symmetrically with Main Stage for rapid emergency egress.',
      );
      notesKo.push(
        '객석 중앙 비상 대피 통로 폭을 11m로 확장하고 메인 무대 중심축과 대칭 정렬하여 응급 진출입 동선을 확보했습니다.',
      );
    }
    seats.forEach((s) => {
      const minZ = stage.position.z + stage.dimensions.depth / 2 + 11 + s.dimensions.depth / 2;
      if (s.position.z < minZ) {
        s.position.z = Math.round(minZ);
        if (!notes.some((n) => n.includes('front stage safety'))) {
          notes.push('Expanded front stage safety buffer to 11m to lower crush density during headline sets.');
          notesKo.push(
            '메인 무대 전면 안전 완충 구역을 11m 이상으로 이격하여 피크 공연 시 밀집 압박 위험을 낮췄습니다.',
          );
        }
      }
    });
  }

  // 3. Check arrival/egress gate capacity vs expected attendance
  const portals = next.filter(
    (f) => f.category === 'entrance' && (f.subtype === 'main_entrance' || f.subtype === 'secondary_entrance'),
  );
  const totalGateCap = portals.reduce((s, f) => s + f.capacity, 0);
  const currentCost = next.reduce((s, f) => s + f.cost, 0);
  if (totalGateCap < config.expectedAttendance * 0.34 && currentCost + 9500 <= config.budget * 1.08) {
    const gatePos = clampToVenue(8, D * 0.42, 15, 7, W, D, 3);
    next.push({
      id: 'entrance-opt-south',
      name: 'South Boulevard Relief Gate',
      nameKo: '남측 중앙 분산 출입구 (추가)',
      category: 'entrance',
      subtype: 'secondary_entrance',
      position: gatePos,
      dimensions: { width: 15, depth: 7, height: 8 },
      rotation: 0,
      capacity: 1350,
      cost: 9500,
      attractionWeight: 1.45,
      colorAccent: '#0ea5e9',
      covered: true,
      accessibility: {
        wheelchairAccessible: true,
        stepFreeEntry: true,
        priorityQueue: true,
      },
      notes: '입·퇴장 병목 완화를 위해 최적화가 자동 추가한 분산 게이트입니다.',
    });
    notes.push('Added South Boulevard Relief Gate (+1,350 portal capacity) to reduce closing-hour exit queues.');
    notesKo.push(
      '남측 중앙 분산 출입구(+1,350명 수용 처리량)를 추가하여 개장·폐장 시간대 출입구 병목을 완화했습니다.',
    );
  }

  // 4. Add East Restroom Bank if attendance >= 8,000 and <= 2 restroom banks exist
  const restrooms = next.filter((f) => f.category === 'restroom');
  const updatedCost = next.reduce((s, f) => s + f.cost, 0);
  if (config.expectedAttendance >= 8000 && restrooms.length <= 2 && updatedCost + 10000 <= config.budget * 1.08) {
    const rrPos = clampToVenue(W * 0.26, -D * 0.14, 13, 6.5, W, D, 6);
    next.push({
      id: 'restroom-opt-east',
      name: 'East Boulevard Restrooms',
      nameKo: '동측 부스존 화장실 (추가)',
      category: 'restroom',
      subtype: 'restroom_bank',
      position: rrPos,
      dimensions: { width: 13, depth: 6.5, height: 3.8 },
      rotation: 0,
      capacity: 240,
      cost: 10000,
      attractionWeight: 1.35,
      colorAccent: '#0284c7',
      covered: true,
      accessibility: {
        wheelchairAccessible: true,
        stepFreeEntry: true,
        priorityQueue: true,
      },
    });
    notes.push('Added East Boulevard Restrooms to shorten intermission walking distance and queue length.');
    notesKo.push(
      '체험부스 밀집 동측 구역에 화장실을 증설하여 평균 보행 거리 및 대기 시간을 단축했습니다.',
    );
  }

  // 5. Ensure inclusive Family Lounge & Multilingual Kiosk exist
  if (!next.some((f) => f.subtype === 'family_lounge')) {
    const famPos = clampToVenue(16, D * 0.18, 13, 9, W, D, 6);
    next.push({
      id: 'rest-opt-family',
      name: 'Stroller & Nursing Family Lounge',
      nameKo: '유모차·수유 가족 쉼터',
      category: 'rest',
      subtype: 'family_lounge',
      position: famPos,
      dimensions: { width: 13, depth: 9, height: 4.2 },
      rotation: 0,
      capacity: 180,
      cost: 8200,
      attractionWeight: 1.15,
      colorAccent: '#f43f5e',
      covered: true,
      accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
    });
    notes.push('Added Stroller & Nursing Family Lounge along the central step-free plaza.');
    notesKo.push('유모차 동반 가족 및 영유아를 위한 수유·가족 쉼터를 중앙 무장애 동선에 배치했습니다.');
  }

  // 6. Upgrade step-free & wheelchair accessibility on any non-compliant booths
  let upgradedAccess = 0;
  next.forEach((f) => {
    if (!f.accessibility.wheelchairAccessible) {
      f.accessibility.wheelchairAccessible = true;
      f.accessibility.stepFreeEntry = true;
      upgradedAccess++;
    }
  });
  if (upgradedAccess > 0) {
    notes.push(`Upgraded ${upgradedAccess} facility ramp(s) to 100% wheelchair-accessible step-free entry.`);
    notesKo.push(
      `단차가 존재하던 ${upgradedAccess}개 시설에 휠체어·유모차 겸용 무단차 경사로를 100% 적용했습니다.`,
    );
  }

  resolveFacilityOverlaps(next, W, D, 3.5);

  if (notes.length === 0) {
    notes.push('Current layout already satisfies spatial clearance, portal capacity, and accessibility heuristics.');
    notesKo.push('현재 배치가 이미 비상 이격 거리, 출입구 처리 용량, 무장애 접근성 기준을 모두 충족하고 있습니다.');
  }

  return { facilities: next, notes, notesKo };
}

/**
 * Real-Time Contingency Re-Optimization (돌발상황 실시간 재배치 엔진).
 */
export function reoptimizeForContingency(
  config: EventConfig,
  currentFacilities: Facility[],
  scenario: ContingencyScenario,
): { facilities: Facility[]; updatedConfig: EventConfig; actionSummaryKo: string; actionSummaryEn: string } {
  const W = config.venueWidth;
  const D = config.venueDepth;
  const next: Facility[] = currentFacilities.map((f) => ({
    ...f,
    position: { ...f.position },
    dimensions: { ...f.dimensions },
    accessibility: { ...f.accessibility },
  }));
  let updatedConfig: EventConfig = {
    ...config,
    accessibility: { ...config.accessibility, wideCorridors: true, stepFreeRoutes: true },
  };

  if (scenario === 'rain') {
    if (!next.some((f) => f.subtype === 'rain_canopy')) {
      next.push(
        {
          id: 'rain-canopy-central',
          name: 'Central Emergency Rain Canopy A',
          nameKo: '우천 대비 대형 비가림 캐노피 A',
          category: 'rest',
          subtype: 'rain_canopy',
          position: { x: -4, z: 12 },
          dimensions: { width: 26, depth: 16, height: 6.2 },
          rotation: 0,
          capacity: 850,
          cost: 9000,
          attractionWeight: 2.1,
          colorAccent: '#0284c7',
          covered: true,
          accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
          notes: '우천 돌발상황 시 야외 관람객을 즉각 수용하는 막구조 비가림 쉘터입니다.',
        },
        {
          id: 'rain-canopy-east',
          name: 'East Plaza Rain Shelter Canopy B',
          nameKo: '우천 대비 동측 비가림 캐노피 B',
          category: 'rest',
          subtype: 'rain_canopy',
          position: { x: Math.round(W * 0.14), z: Math.round(D * 0.26) },
          dimensions: { width: 22, depth: 14, height: 5.8 },
          rotation: 0,
          capacity: 650,
          cost: 7500,
          attractionWeight: 1.9,
          colorAccent: '#0284c7',
          covered: true,
          accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
        },
      );
    }
    resolveFacilityOverlaps(next, W, D, 3.2);
    return {
      facilities: next,
      updatedConfig,
      actionSummaryKo:
        '우천 대응 재최적화 완료: 중앙·동측 광장에 대형 비가림 캐노피 2개소(+1,500명 수용)를 긴급 배치하여 실내 부스 과밀을 분산했습니다.',
      actionSummaryEn:
        'Rainstorm re-optimization applied: deployed 2 tensile rain canopies (+1,500 covered capacity) to relieve indoor booth crowding.',
    };
  }

  if (scenario === 'surge') {
    if (!next.some((f) => f.id.startsWith('entrance-surge'))) {
      next.push({
        id: 'entrance-surge-relief',
        name: 'Emergency Surge Relief Gate',
        nameKo: '인파 급증 비상 분산 게이트',
        category: 'entrance',
        subtype: 'secondary_entrance',
        position: { x: 10, z: Math.round(D * 0.42) },
        dimensions: { width: 16, depth: 7, height: 8.2 },
        rotation: 0,
        capacity: 1800,
        cost: 9500,
        attractionWeight: 1.6,
        colorAccent: '#0ea5e9',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      });
      next.push({
        id: 'food-surge-express',
        name: 'Express Beverage & Snack Kiosk',
        nameKo: '고속 배식 푸드 익스프레스 부스',
        category: 'food',
        subtype: 'food_stall',
        position: { x: Math.round(W * 0.18), z: Math.round(D * 0.24) },
        dimensions: { width: 9, depth: 7, height: 4.2 },
        rotation: 0,
        capacity: 380,
        cost: 4800,
        attractionWeight: 1.8,
        colorAccent: '#10b981',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      });
      updatedConfig = {
        ...updatedConfig,
        entranceCount: Math.min(6, updatedConfig.entranceCount + 1),
        foodBoothCount: Math.min(12, updatedConfig.foodBoothCount + 1),
      };
    }
    resolveFacilityOverlaps(next, W, D, 3.8);
    return {
      facilities: next,
      updatedConfig,
      actionSummaryKo:
        '방문객 급증(+35%) 재최적화 완료: 남측 비상 분산 게이트 개방(+1,800명) 및 5.2m 광폭 보행로·익스프레스 매점을 가동했습니다.',
      actionSummaryEn:
        'Crowd surge (+35%) re-optimization applied: opened emergency relief gate (+1,800 pax) and express food kiosk with 5.2m wide corridors.',
    };
  }

  if (scenario === 'stage_delay') {
    if (!next.some((f) => f.id === 'stage-popup-busking')) {
      next.push({
        id: 'stage-popup-busking',
        name: 'Pop-Up Acoustic Sub-Stage',
        nameKo: '공연 지연 분산용 서브 버스킹 무대',
        category: 'stage',
        subtype: 'secondary_stage',
        position: { x: Math.round(W * 0.14), z: Math.round(D * 0.28) },
        dimensions: { width: 18, depth: 11, height: 7.5 },
        rotation: Math.PI,
        capacity: 1100,
        cost: 12000,
        attractionWeight: 2.2,
        colorAccent: '#6366f1',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      });
    }
    resolveFacilityOverlaps(next, W, D, 3.6);
    return {
      facilities: next,
      updatedConfig,
      actionSummaryKo:
        '공연 지연 대응 재최적화 완료: 남동측 광장에 서브 버스킹 무대(1,100명 수용)를 가동하여 푸드존·화장실 역류 인파를 흡수했습니다.',
      actionSummaryEn:
        'Stage delay re-optimization applied: activated South-East Pop-Up Sub-Stage (1,100 pax) to absorb intermission backflow.',
    };
  }

  if (scenario === 'medical_emergency') {
    // Clear central corridor x in [-15, 2] for non-stage facilities & add forward triage post
    for (const f of next) {
      if (f.category !== 'stage' && Math.abs(f.position.x + 7) < 9) {
        f.position.x = f.position.x >= -7 ? 8 : -22;
      }
    }
    if (!next.some((f) => f.id === 'medical-forward-triage')) {
      next.push({
        id: 'medical-forward-triage',
        name: 'Forward Stage Triage Post',
        nameKo: '무대 전방 긴급 응급처치소',
        category: 'medical',
        subtype: 'medical_station',
        position: { x: -24, z: -32 },
        dimensions: { width: 12, depth: 8, height: 4.4 },
        rotation: 0,
        capacity: 100,
        cost: 11000,
        attractionWeight: 0.5,
        colorAccent: '#dc2626',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      });
    }
    resolveFacilityOverlaps(next, W, D, 4.0);
    return {
      facilities: next,
      updatedConfig,
      actionSummaryKo:
        '응급환자 대응 재최적화 완료: 중앙 구급차 전용 통로(폭 12m) 내 간섭 시설을 즉시 이격하고 무대 전방 응급처치소를 배치했습니다.',
      actionSummaryEn:
        'Medical emergency re-optimization applied: cleared 12m central ambulance spine and deployed Forward Stage Triage Post.',
    };
  }

  const opt = optimizeVenueLayout(config, next);
  return {
    facilities: opt.facilities,
    updatedConfig,
    actionSummaryKo: '표준 다목적 공간 최적화를 적용하여 동선 분산 및 무장애 통로를 확보했습니다.',
    actionSummaryEn: 'Applied multi-objective spatial optimization across corridors and food zones.',
  };
}

/**
 * Targeted 1-Click Inclusive Upgrade for any of the 5 Visitor Personas.
 */
export function applyInclusivePersonaUpgrade(
  config: EventConfig,
  currentFacilities: Facility[],
  personaId: VisitorPersonaId,
): { facilities: Facility[]; updatedConfig: EventConfig; messageKo: string; messageEn: string } {
  const W = config.venueWidth;
  const D = config.venueDepth;
  const next: Facility[] = currentFacilities.map((f) => ({
    ...f,
    position: { ...f.position },
    dimensions: { ...f.dimensions },
    accessibility: { ...f.accessibility },
  }));
  let updatedConfig: EventConfig = { ...config };

  if (personaId === 'wheelchair') {
    updatedConfig = {
      ...config,
      accessibility: {
        stepFreeRoutes: true,
        wideCorridors: true,
        accessibleRestrooms: true,
        accessibleParking: true,
      },
    };
    next.forEach((f) => {
      f.accessibility.wheelchairAccessible = true;
      f.accessibility.stepFreeEntry = true;
    });
    return {
      facilities: next,
      updatedConfig,
      messageKo: '휠체어 이용자 맞춤 보완 완료: 전 시설 무단차 경사로 100% 적용 및 5.2m 광폭 회전 통로를 확보했습니다.',
      messageEn: 'Wheelchair upgrade applied: 100% step-free ramps and 5.2m turning corridors enabled.',
    };
  }

  if (personaId === 'stroller') {
    updatedConfig = {
      ...config,
      accessibility: { ...config.accessibility, stepFreeRoutes: true, wideCorridors: true },
    };
    if (!next.some((f) => f.subtype === 'family_lounge')) {
      next.push({
        id: 'rest-family-stroller',
        name: 'Stroller & Nursing Family Lounge',
        nameKo: '유모차·수유 가족 전용 쉼터',
        category: 'rest',
        subtype: 'family_lounge',
        position: { x: 16, z: 22 },
        dimensions: { width: 14, depth: 9, height: 4.2 },
        rotation: 0,
        capacity: 200,
        cost: 8500,
        attractionWeight: 1.2,
        colorAccent: '#f43f5e',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      });
    }
    resolveFacilityOverlaps(next, W, D, 3.8);
    return {
      facilities: next,
      updatedConfig,
      messageKo: '유모차 동반 가족 보완 완료: 수유·유모차 보관 전용 가족 쉼터 및 우회 완충 보행로를 확보했습니다.',
      messageEn: 'Stroller & family upgrade applied: added dedicated Nursing & Stroller Family Lounge.',
    };
  }

  if (personaId === 'children') {
    if (!next.some((f) => f.subtype === 'play_zone')) {
      next.push({
        id: 'rest-kids-play',
        name: 'Safe Kids Play & Fountain Zone',
        nameKo: '어린이 안전 놀이·분수 광장',
        category: 'rest',
        subtype: 'play_zone',
        position: { x: -Math.round(W * 0.3), z: Math.round(D * 0.2) },
        dimensions: { width: 26, depth: 22, height: 14 },
        rotation: 0,
        capacity: 600,
        cost: 18500,
        attractionWeight: 1.55,
        colorAccent: '#ec4899',
        covered: false,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      });
    } else {
      // Ensure play_zone is safely buffered >= 55m away from main_stage
      const stage = next.find((f) => f.subtype === 'main_stage');
      const play = next.find((f) => f.subtype === 'play_zone');
      if (stage && play && Math.hypot(play.position.x - stage.position.x, play.position.z - stage.position.z) < 55) {
        play.position = clampToVenue(-W * 0.32, D * 0.24, play.dimensions.width, play.dimensions.depth, W, D, 6);
      }
    }
    resolveFacilityOverlaps(next, W, D, 3.6);
    return {
      facilities: next,
      updatedConfig,
      messageKo: '어린이 안전 동선 보완 완료: 고밀집 무대 구역과 분리된 어린이 놀이광장 및 미아보호 안내 동선을 최적화했습니다.',
      messageEn: 'Child safety upgrade applied: buffered Kids Play Plaza away from high-density stage pit.',
    };
  }

  if (personaId === 'seniors') {
    if (!next.some((f) => f.id === 'rest-senior-north')) {
      next.push({
        id: 'rest-senior-north',
        name: 'Senior Shaded Rest & Hydration Pavilion',
        nameKo: '어르신 그늘 쉼터 (중간 휴식존)',
        category: 'rest',
        subtype: 'rest_plaza',
        position: { x: 14, z: -12 },
        dimensions: { width: 16, depth: 12, height: 3.6 },
        rotation: 0,
        capacity: 280,
        cost: 6800,
        attractionWeight: 1.2,
        colorAccent: '#10b981',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
        notes: '연속 보행거리 50m 이내 휴식을 보장하는 어르신 친화 그늘 쉼터입니다.',
      });
    }
    resolveFacilityOverlaps(next, W, D, 3.6);
    return {
      facilities: next,
      updatedConfig,
      messageKo: '고령자 맞춤 보완 완료: 주동선 중간 지점에 그늘 쉼터를 추가하여 연속 보행거리를 50m 이하로 단축했습니다.',
      messageEn: 'Senior comfort upgrade applied: added mid-promenade shaded rest pavilion (<50m walk intervals).',
    };
  }

  // foreigner persona
  const mainGate = next.find((f) => f.subtype === 'main_entrance') || next.find((f) => f.category === 'entrance');
  const existingMulti = next.find((f) => f.subtype === 'multilingual_info');
  if (!existingMulti) {
    const gx = mainGate ? mainGate.position.x - 16 : W * 0.28;
    const gz = mainGate ? mainGate.position.z + 6 : D * 0.2;
    next.push({
      id: 'info-multilingual-gate',
      name: 'Global Multilingual Welcome Hub (KR/EN/JP/CN)',
      nameKo: '다국어 글로벌 안내소 (주출입구 직결)',
      category: 'entrance',
      subtype: 'multilingual_info',
      position: clampToVenue(gx, gz, 12, 8, W, D, 5),
      dimensions: { width: 12, depth: 8, height: 4.6 },
      rotation: 0,
      capacity: 320,
      cost: 7800,
      attractionWeight: 1.25,
      colorAccent: '#0284c7',
      covered: true,
      accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
    });
  } else if (mainGate) {
    existingMulti.position = clampToVenue(
      mainGate.position.x - 16,
      mainGate.position.z + 8,
      existingMulti.dimensions.width,
      existingMulti.dimensions.depth,
      W,
      D,
      5,
    );
  }
  resolveFacilityOverlaps(next, W, D, 3.6);
  return {
    facilities: next,
    updatedConfig,
    messageKo: '외국인 이용자 보완 완료: 주출입구 직결 지점에 다국어(한·영·일·중) 글로벌 안내 부스를 전진 배치했습니다.',
    messageEn: 'International visitor upgrade applied: positioned Multilingual Welcome Hub directly inside Main Gate.',
  };
}