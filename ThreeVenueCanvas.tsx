import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  RotateCcw,
  Box,
  Compass,
  Eye,
  Tag,
  Globe,
  RefreshCw,
  PanelLeft,
  PanelRight,
} from 'lucide-react';
import {
  CameraViewMode,
  ContingencyScenario,
  EventConfig,
  Facility,
  FacilityCategory,
  Language,
  LayerVisibility,
  SimulationSnapshot,
} from '../types/festival';
import { CONTINGENCY_INFO, getFacilityDisplayName } from '../engine/presets';
import { buildVenueRoutes, CrowdSimulator } from '../engine/crowdSimulation';
import {
  buildFacilityGroup,
  buildLandscapingTrees,
  buildRouteLayers,
  buildVenueGroundAndPerimeter,
} from '../engine/venueMeshBuilder';

interface ThreeVenueCanvasProps {
  language: Language;
  onToggleLanguage: () => void;
  config: EventConfig;
  facilities: Facility[];
  visibility: LayerVisibility;
  onToggleVisibility: (key: keyof LayerVisibility) => void;
  selectedFacilityId: string | null;
  highlightedFacilityIds?: string[];
  onSelectFacility: (id: string | null) => void;
  simulatorRef: React.MutableRefObject<CrowdSimulator>;
  isPlaying: boolean;
  simSpeed: number;
  simProgress: number;
  contingency: ContingencyScenario;
  onChangeContingency: (scenario: ContingencyScenario) => void;
  onReoptimizeContingency: () => void;
  onSnapshotUpdate: (snapshot: SimulationSnapshot) => void;
  activeLayoutBadge: 'original' | 'optimized';
  isLeftSidebarOpen?: boolean;
  onToggleLeftSidebar?: () => void;
  isRightSidebarOpen?: boolean;
  onToggleRightSidebar?: () => void;
  children?: React.ReactNode;
}

const _dummy = new THREE.Object3D();
const _headDummy = new THREE.Object3D();
const _projVec = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _agentPalette = [
  new THREE.Color('#2563eb'),
  new THREE.Color('#f97316'),
  new THREE.Color('#0d9488'),
  new THREE.Color('#7c3aed'),
];

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function writeHeatmapTextureData(
  densityGrid: Float32Array,
  rgbaBuffer: Uint8Array,
  cols: number,
  rows: number,
): void {
  const total = cols * rows;
  for (let i = 0; i < total; i++) {
    const d = densityGrid[i];
    const idx = i * 4;
    if (d < 0.12) {
      rgbaBuffer[idx] = 34;
      rgbaBuffer[idx + 1] = 197;
      rgbaBuffer[idx + 2] = 94;
      rgbaBuffer[idx + 3] = 0;
      continue;
    }

    let r = 34;
    let g = 197;
    let b = 94;
    let alpha = 120;

    if (d < 0.85) {
      const t = (d - 0.12) / 0.73;
      r = Math.round(34 + (234 - 34) * t);
      g = Math.round(197 + (179 - 197) * t);
      b = Math.round(94 + (8 - 94) * t);
      alpha = Math.round(70 + t * 85);
    } else if (d < 1.8) {
      const t = (d - 0.85) / 0.95;
      r = Math.round(234 + (249 - 234) * t);
      g = Math.round(179 + (115 - 179) * t);
      b = Math.round(8 + (22 - 8) * t);
      alpha = Math.round(155 + t * 40);
    } else if (d < 2.9) {
      const t = (d - 1.8) / 1.1;
      r = Math.round(249 + (220 - 249) * t);
      g = Math.round(115 + (38 - 115) * t);
      b = Math.round(22 + (38 - 22) * t);
      alpha = Math.round(195 + t * 35);
    } else {
      r = 220;
      g = 38;
      b = 38;
      alpha = 235;
    }

    rgbaBuffer[idx] = r;
    rgbaBuffer[idx + 1] = g;
    rgbaBuffer[idx + 2] = b;
    rgbaBuffer[idx + 3] = alpha;
  }
}

export const ThreeVenueCanvas: React.FC<ThreeVenueCanvasProps> = ({
  language,
  onToggleLanguage,
  config,
  facilities,
  visibility,
  onToggleVisibility,
  selectedFacilityId,
  highlightedFacilityIds = [],
  onSelectFacility,
  simulatorRef,
  isPlaying,
  simSpeed,
  simProgress,
  contingency,
  onChangeContingency,
  onReoptimizeContingency,
  onSnapshotUpdate,
  activeLayoutBadge,
  isLeftSidebarOpen = true,
  onToggleLeftSidebar,
  isRightSidebarOpen = true,
  onToggleRightSidebar,
  children,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [cameraMode, setCameraMode] = useState<CameraViewMode>('isometric');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const stateRef = useRef({
    language,
    config,
    facilities,
    visibility,
    selectedFacilityId,
    highlightedFacilityIds,
    isPlaying,
    simSpeed,
    contingency,
    onSelectFacility,
    onSnapshotUpdate,
  });
  stateRef.current = {
    language,
    config,
    facilities,
    visibility,
    selectedFacilityId,
    highlightedFacilityIds,
    isPlaying,
    simSpeed,
    contingency,
    onSelectFacility,
    onSnapshotUpdate,
  };

  const sceneHandlesRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: THREE.WebGLRenderer;
    sunLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    envRoot: THREE.Group;
    facilitiesRoot: THREE.Group;
    facilityMap: Map<string, THREE.Group>;
    landscapingRoot: THREE.Group;
    pedestrianRoot: THREE.Group;
    evacuationRoot: THREE.Group;
    selectionRingGroup: THREE.Group;
    emergencyCorridorMesh: THREE.Mesh;
    rainLines: THREE.LineSegments;
    rainPositions: Float32Array;
    heatmapMesh: THREE.Mesh;
    heatmapTexture: THREE.DataTexture;
    heatmapRgba: Uint8Array;
    visitorBodies: THREE.InstancedMesh;
    visitorHeads: THREE.InstancedMesh;
    cameraTransition: {
      active: boolean;
      pos: THREE.Vector3;
      look: THREE.Vector3;
    };
    maxAnisotropy: number;
  } | null>(null);

  const getPresetCameraPose = (mode: CameraViewMode, w: number, d: number) => {
    const span = Math.max(w, d);
    if (mode === 'top') {
      return {
        pos: new THREE.Vector3(0, span * 0.92, 0.01),
        look: new THREE.Vector3(0, 0, 0),
      };
    }
    if (mode === 'perspective') {
      return {
        pos: new THREE.Vector3(0, span * 0.25, span * 0.62),
        look: new THREE.Vector3(-4, 4, -12),
      };
    }
    return {
      pos: new THREE.Vector3(-span * 0.56, span * 0.54, span * 0.62),
      look: new THREE.Vector3(2, 0, 2),
    };
  };

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL context could not be initialized on this browser.');
      return;
    }

    const rect = mount.getBoundingClientRect();
    const initW = Math.max(300, rect.width || 900);
    const initH = Math.max(300, rect.height || 640);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(initW, initH);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('WebGL rendering context paused. Restoring automatically...');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef4fa');
    scene.fog = new THREE.Fog('#eef4fa', 210, 520);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight('#dbeafe', '#86efac', 0.85);
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fffbeb', 1.65);
    sunLight.position.set(-85, 135, 95);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(2048, 2048);
    const shadowBound = 145;
    sunLight.shadow.camera.left = -shadowBound;
    sunLight.shadow.camera.right = shadowBound;
    sunLight.shadow.camera.top = shadowBound;
    sunLight.shadow.camera.bottom = -shadowBound;
    sunLight.shadow.camera.near = 20;
    sunLight.shadow.camera.far = 360;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#bfdbfe', 0.45);
    rimLight.position.set(90, 65, -90);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(36, initW / initH, 1, 900);
    const initPose = getPresetCameraPose(
      'isometric',
      stateRef.current.config.venueWidth,
      stateRef.current.config.venueDepth,
    );
    camera.position.copy(initPose.pos);
    camera.lookAt(initPose.look);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 35;
    controls.maxDistance = 380;
    controls.target.copy(initPose.look);
    controls.update();

    const envRoot = new THREE.Group();
    const pedestrianRoot = new THREE.Group();
    const evacuationRoot = new THREE.Group();
    const landscapingRoot = new THREE.Group();
    const facilitiesRoot = new THREE.Group();
    const selectionRingGroup = new THREE.Group();
    selectionRingGroup.visible = false;

    const ringMat = new THREE.MeshBasicMaterial({
      color: '#2563eb',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const selPlane = new THREE.Mesh(new THREE.RingGeometry(0.47, 0.52, 4), ringMat);
    selPlane.rotation.x = -Math.PI / 2;
    selPlane.rotation.z = Math.PI / 4;
    selPlane.position.y = 0.24;
    selectionRingGroup.add(selPlane);

    const selBeacon = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.2, 4),
      new THREE.MeshBasicMaterial({ color: '#2563eb' }),
    );
    selBeacon.rotation.x = Math.PI;
    selBeacon.position.y = 14;
    selectionRingGroup.add(selBeacon);

    // 3D Emergency Ambulance Corridor Strip (visible during medical_emergency)
    const emergGeo = new THREE.PlaneGeometry(11, 140);
    emergGeo.rotateX(-Math.PI / 2);
    const emergMat = new THREE.MeshBasicMaterial({
      color: '#ef4444',
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const emergencyCorridorMesh = new THREE.Mesh(emergGeo, emergMat);
    emergencyCorridorMesh.position.set(-7, 0.22, 6);
    emergencyCorridorMesh.visible = false;

    // 3D Rain Streaks System (visible during rain contingency)
    const rainDropCount = 420;
    const rainPositions = new Float32Array(rainDropCount * 6);
    for (let i = 0; i < rainDropCount; i++) {
      const rx = (Math.random() - 0.5) * 240;
      const ry = Math.random() * 65 + 4;
      const rz = (Math.random() - 0.5) * 190;
      const base = i * 6;
      rainPositions[base] = rx;
      rainPositions[base + 1] = ry;
      rainPositions[base + 2] = rz;
      rainPositions[base + 3] = rx - 0.6;
      rainPositions[base + 4] = ry - 3.6;
      rainPositions[base + 5] = rz + 0.4;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: '#60a5fa',
      transparent: true,
      opacity: 0.52,
    });
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.visible = false;

    // Dynamic 3D Heatmap Overlay Mesh
    const { cols, rows } = simulatorRef.current.getGridDimensions();
    const heatmapRgba = new Uint8Array(cols * rows * 4);
    const heatmapTexture = new THREE.DataTexture(heatmapRgba, cols, rows, THREE.RGBAFormat);
    heatmapTexture.colorSpace = THREE.SRGBColorSpace;
    heatmapTexture.magFilter = THREE.LinearFilter;
    heatmapTexture.minFilter = THREE.LinearFilter;
    heatmapTexture.flipY = false;
    heatmapTexture.needsUpdate = true;

    const heatmapMat = new THREE.MeshBasicMaterial({
      map: heatmapTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const heatmapGeo = new THREE.PlaneGeometry(1, 1);
    heatmapGeo.rotateX(-Math.PI / 2);
    const heatmapMesh = new THREE.Mesh(heatmapGeo, heatmapMat);
    heatmapMesh.position.y = 0.18;
    heatmapMesh.renderOrder = 4;

    const maxVisitors = 850;
    const bodyGeo = new THREE.CylinderGeometry(0.32, 0.42, 1.35, 8);
    bodyGeo.translate(0, 0.68, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.65 });
    const visitorBodies = new THREE.InstancedMesh(bodyGeo, bodyMat, maxVisitors);
    visitorBodies.castShadow = !isSoftwareGl;
    visitorBodies.frustumCulled = false;

    const headGeo = new THREE.SphereGeometry(0.28, 8, 8);
    headGeo.translate(0, 1.58, 0);
    const headMat = new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.6 });
    const visitorHeads = new THREE.InstancedMesh(headGeo, headMat, maxVisitors);
    visitorHeads.frustumCulled = false;

    for (let i = 0; i < maxVisitors; i++) {
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      visitorBodies.setMatrixAt(i, _dummy.matrix);
      visitorHeads.setMatrixAt(i, _dummy.matrix);
      visitorBodies.setColorAt(i, _agentPalette[i % _agentPalette.length]);
    }

    scene.add(
      envRoot,
      pedestrianRoot,
      evacuationRoot,
      emergencyCorridorMesh,
      heatmapMesh,
      landscapingRoot,
      facilitiesRoot,
      selectionRingGroup,
      visitorBodies,
      visitorHeads,
      rainLines,
    );

    const cameraTransition = {
      active: false,
      pos: initPose.pos.clone(),
      look: initPose.look.clone(),
    };

    controls.addEventListener('start', () => {
      cameraTransition.active = false;
    });

    sceneHandlesRef.current = {
      scene,
      camera,
      controls,
      renderer,
      sunLight,
      hemiLight,
      envRoot,
      facilitiesRoot,
      facilityMap: new Map(),
      landscapingRoot,
      pedestrianRoot,
      evacuationRoot,
      selectionRingGroup,
      emergencyCorridorMesh,
      rainLines,
      rainPositions,
      heatmapMesh,
      heatmapTexture,
      heatmapRgba,
      visitorBodies,
      visitorHeads,
      cameraTransition,
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    };

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastHoverTime = 0;

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownX = ev.clientX;
      pointerDownY = ev.clientY;
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - pointerDownX, ev.clientY - pointerDownY) > 6) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((ev.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(facilitiesRoot.children, true);
      const visibleHit = hits.find((h) => {
        let cur: THREE.Object3D | null = h.object;
        while (cur) {
          if (!cur.visible && cur !== h.object) return false;
          cur = cur.parent;
        }
        return Boolean(h.object.userData?.facilityId);
      });

      if (visibleHit) {
        stateRef.current.onSelectFacility(visibleHit.object.userData.facilityId);
      } else {
        stateRef.current.onSelectFacility(null);
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 55) return;
      lastHoverTime = now;

      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((ev.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(facilitiesRoot.children, true);
      const visibleHit = hits.find((h) => {
        let cur: THREE.Object3D | null = h.object;
        while (cur) {
          if (!cur.visible && cur !== h.object) return false;
          cur = cur.parent;
        }
        return Boolean(h.object.userData?.facilityId);
      });

      if (visibleHit) {
        renderer.domElement.style.cursor = 'pointer';
        const fId = visibleHit.object.userData.facilityId as string;
        const found = stateRef.current.facilities.find((f) => f.id === fId);
        setHoveredName(found ? getFacilityDisplayName(found, stateRef.current.language) : null);
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredName(null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, entry.contentRect.width);
        const h = Math.max(200, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(mount);

    let frameId = 0;
    let lastTime = performance.now();
    let lastMetricsEmit = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (st === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      const now = performance.now();
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;

      const cur = stateRef.current;
      const sim = simulatorRef.current;

      if (cameraTransition.active) {
        const alpha = 1 - Math.exp(-6.5 * dt);
        camera.position.lerp(cameraTransition.pos, alpha);
        controls.target.lerp(cameraTransition.look, alpha);
        if (
          camera.position.distanceToSquared(cameraTransition.pos) < 0.25 &&
          controls.target.distanceToSquared(cameraTransition.look) < 0.25
        ) {
          camera.position.copy(cameraTransition.pos);
          controls.target.copy(cameraTransition.look);
          cameraTransition.active = false;
        }
      }
      controls.update();

      // Animate 3D Rain Streaks if contingency === 'rain'
      if (rainLines.visible) {
        const fallDist = 52 * dt;
        for (let i = 0; i < rainDropCount; i++) {
          const base = i * 6;
          rainPositions[base + 1] -= fallDist;
          rainPositions[base + 4] -= fallDist;
          if (rainPositions[base + 4] < 0) {
            const resetY = 66 + (i % 12);
            rainPositions[base + 1] = resetY;
            rainPositions[base + 4] = resetY - 3.6;
          }
        }
        (rainLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }

      sim.step(dt, cur.simSpeed, cur.isPlaying);
      const agents = sim.agents;
      const showCrowd = cur.visibility.crowd;

      for (let i = 0; i < maxVisitors; i++) {
        if (showCrowd && i < agents.length && agents[i].active) {
          const ag = agents[i];
          const bob = cur.isPlaying ? Math.abs(Math.sin(now * 0.008 + i)) * 0.14 : 0;
          _dummy.position.set(ag.x, bob, ag.z);
          _dummy.rotation.set(0, ag.heading, 0);
          _dummy.scale.setScalar(1);
          _dummy.updateMatrix();
          visitorBodies.setMatrixAt(i, _dummy.matrix);

          _headDummy.position.set(ag.x, bob, ag.z);
          _headDummy.rotation.set(0, 0, 0);
          _headDummy.scale.setScalar(1);
          _headDummy.updateMatrix();
          visitorHeads.setMatrixAt(i, _headDummy.matrix);

          visitorBodies.setColorAt(i, _agentPalette[ag.colorIndex % _agentPalette.length]);
        } else {
          _dummy.position.set(0, -50, 0);
          _dummy.scale.setScalar(0.0001);
          _dummy.updateMatrix();
          visitorBodies.setMatrixAt(i, _dummy.matrix);
          visitorHeads.setMatrixAt(i, _dummy.matrix);
        }
      }
      visitorBodies.instanceMatrix.needsUpdate = true;
      visitorHeads.instanceMatrix.needsUpdate = true;
      if (visitorBodies.instanceColor) visitorBodies.instanceColor.needsUpdate = true;

      if (now - lastMetricsEmit > (cur.isPlaying ? 180 : 450)) {
        lastMetricsEmit = now;
        const snap = sim.getSnapshot();
        const { cols: gc, rows: gr } = sim.getGridDimensions();
        writeHeatmapTextureData(snap.densityGrid, heatmapRgba, gc, gr);
        heatmapTexture.needsUpdate = true;
        if (cur.isPlaying) {
          cur.onSnapshotUpdate(snap);
        }
      }

      if (selectionRingGroup.visible) {
        selBeacon.position.y = 13.5 + Math.sin(now * 0.004) * 0.65;
      }

      if (cur.visibility.labels) {
        const cw = renderer.domElement.clientWidth;
        const ch = renderer.domElement.clientHeight;
        for (let i = 0; i < cur.facilities.length; i++) {
          const f = cur.facilities[i];
          const el = labelRefs.current[f.id];
          if (!el) continue;

          const catVisible = cur.visibility[f.category as keyof LayerVisibility];
          if (!catVisible) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            continue;
          }

          _projVec.set(f.position.x, f.dimensions.height + 2.6, f.position.z);
          _projVec.project(camera);

          if (_projVec.z > 1 || _projVec.z < -1) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
          } else {
            const sx = (_projVec.x * 0.5 + 0.5) * cw;
            const sy = (-_projVec.y * 0.5 + 0.5) * ch;
            el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -100%)`;
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
          }
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      renderer.dispose();
    };
  }, [simulatorRef]);

  // Rebuild 3D Ground, Facilities, Landscaping & Routes whenever config or facilities change
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    const disposeChildren = (grp: THREE.Group) => {
      while (grp.children.length > 0) {
        const child = grp.children[0];
        child.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry?.dispose();
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => mat.dispose());
            } else {
              m.material?.dispose();
            }
          }
        });
        grp.remove(child);
      }
    };

    disposeChildren(handles.envRoot);
    disposeChildren(handles.facilitiesRoot);
    disposeChildren(handles.landscapingRoot);
    disposeChildren(handles.pedestrianRoot);
    disposeChildren(handles.evacuationRoot);
    handles.facilityMap.clear();

    handles.envRoot.add(buildVenueGroundAndPerimeter(config));
    handles.landscapingRoot.add(buildLandscapingTrees(config, facilities));

    const routes = buildVenueRoutes(config, facilities);
    const { pedestrianGroup, evacuationGroup } = buildRouteLayers(routes);
    handles.pedestrianRoot.add(pedestrianGroup);
    handles.evacuationRoot.add(evacuationGroup);

    for (const f of facilities) {
      const fGroup = buildFacilityGroup(f, handles.maxAnisotropy);
      fGroup.visible = Boolean(visibility[f.category as keyof LayerVisibility]);
      handles.facilitiesRoot.add(fGroup);
      handles.facilityMap.set(f.id, fGroup);
    }

    handles.heatmapMesh.scale.set(config.venueWidth, 1, config.venueDepth);
    handles.emergencyCorridorMesh.scale.set(1, 1, config.venueDepth / 150);

    const snap = simulatorRef.current.getSnapshot();
    const { cols, rows } = simulatorRef.current.getGridDimensions();
    writeHeatmapTextureData(snap.densityGrid, handles.heatmapRgba, cols, rows);
    handles.heatmapTexture.needsUpdate = true;
  }, [config, facilities, simulatorRef]);

  // Sync Weather & Contingency 3D Atmosphere
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    if (contingency === 'rain') {
      handles.scene.background = new THREE.Color('#dbe4ef');
      handles.scene.fog = new THREE.Fog('#dbe4ef', 180, 460);
      handles.sunLight.intensity = 1.05;
      handles.hemiLight.intensity = 0.95;
      handles.rainLines.visible = true;
    } else {
      handles.scene.background = new THREE.Color('#eef4fa');
      handles.scene.fog = new THREE.Fog('#eef4fa', 210, 520);
      handles.sunLight.intensity = 1.65;
      handles.hemiLight.intensity = 0.85;
      handles.rainLines.visible = false;
    }

    handles.emergencyCorridorMesh.visible = contingency === 'medical_emergency';
    if (contingency === 'medical_emergency') {
      handles.evacuationRoot.visible = true;
    } else {
      handles.evacuationRoot.visible = visibility.evacuationRoutes;
    }
  }, [contingency, visibility.evacuationRoutes]);

  // Refresh heatmap texture immediately when simProgress scrubs manually
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;
    const snap = simulatorRef.current.getSnapshot();
    const { cols, rows } = simulatorRef.current.getGridDimensions();
    writeHeatmapTextureData(snap.densityGrid, handles.heatmapRgba, cols, rows);
    handles.heatmapTexture.needsUpdate = true;
  }, [simProgress, simulatorRef]);

  // Sync Category & Layer Visibility toggles
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    for (const f of facilities) {
      const grp = handles.facilityMap.get(f.id);
      if (grp) {
        grp.visible = Boolean(visibility[f.category as keyof LayerVisibility]);
      }
    }

    handles.landscapingRoot.visible = visibility.landscaping;
    handles.heatmapMesh.visible = visibility.heatmap;
    handles.pedestrianRoot.visible = visibility.pedestrianRoutes;
    handles.evacuationRoot.visible =
      contingency === 'medical_emergency' ? true : visibility.evacuationRoutes;
    handles.visitorBodies.visible = visibility.crowd;
    handles.visitorHeads.visible = visibility.crowd;
  }, [visibility, facilities, contingency]);

  // Sync Selected Facility & Persona Highlighted Facilities
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    handles.facilitiesRoot.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive && !mat.emissiveMap) {
          mat.emissive.setHex(0x000000);
        }
      }
    });

    // Persona multi-facility highlight (emerald accent)
    for (const hId of highlightedFacilityIds) {
      const grp = handles.facilityMap.get(hId);
      if (grp) {
        grp.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (mat && mat.emissive && !mat.emissiveMap) {
              mat.emissive.setHex(0x047857);
              mat.emissiveIntensity = 0.28;
            }
          }
        });
      }
    }

    if (!selectedFacilityId) {
      handles.selectionRingGroup.visible = false;
      return;
    }

    const sel = facilities.find((f) => f.id === selectedFacilityId);
    const selGrp = handles.facilityMap.get(selectedFacilityId);
    if (!sel || !selGrp) {
      handles.selectionRingGroup.visible = false;
      return;
    }

    const span = Math.max(sel.dimensions.width, sel.dimensions.depth) + 4.5;
    handles.selectionRingGroup.position.set(sel.position.x, 0, sel.position.z);
    handles.selectionRingGroup.children[0].scale.set(span, span, 1);
    handles.selectionRingGroup.visible = true;

    selGrp.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive && !mat.emissiveMap) {
          mat.emissive.setHex(0x1e3a8a);
          mat.emissiveIntensity = 0.24;
        }
      }
    });
  }, [selectedFacilityId, highlightedFacilityIds, facilities]);

  const applyCameraPreset = (mode: CameraViewMode) => {
    setCameraMode(mode);
    const handles = sceneHandlesRef.current;
    if (!handles) return;
    const pose = getPresetCameraPose(mode, config.venueWidth, config.venueDepth);
    handles.cameraTransition.pos.copy(pose.pos);
    handles.cameraTransition.look.copy(pose.look);
    handles.cameraTransition.active = true;
  };

  const handleZoom = (factor: number) => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;
    _targetPos.copy(handles.camera.position).sub(handles.controls.target).multiplyScalar(factor);
    const len = _targetPos.length();
    if (len >= 38 && len <= 370) {
      handles.cameraTransition.pos.copy(handles.controls.target).add(_targetPos);
      handles.cameraTransition.look.copy(handles.controls.target);
      handles.cameraTransition.active = true;
    }
  };

  const handleToggleFullscreen = () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const highlightSet = new Set(highlightedFacilityIds);

  const labeledFacilities = facilities.filter((f, idx) => {
    if (f.id === selectedFacilityId || highlightSet.has(f.id)) return true;
    if (
      f.category === 'stage' ||
      f.category === 'medical' ||
      f.category === 'parking' ||
      f.category === 'vip' ||
      f.category === 'camping'
    ) {
      return true;
    }
    if (f.category === 'entrance' || f.category === 'rest' || f.category === 'restroom') {
      return true;
    }
    if (f.category === 'seating' && idx === 1) return true;
    if (f.category === 'food' && f.id.endsWith('1')) return true;
    if (f.category === 'booth' && f.id.endsWith('1')) return true;
    return false;
  });

  const quickLayerButtons: Array<{
    key: keyof LayerVisibility;
    labelKo: string;
    labelEn: string;
    dotColor: string;
  }> = [
    { key: 'stage', labelKo: '무대', labelEn: 'Stage', dotColor: 'bg-blue-600' },
    { key: 'seating', labelKo: '관객석', labelEn: 'Seating', dotColor: 'bg-sky-500' },
    { key: 'food', labelKo: '푸드존', labelEn: 'Food', dotColor: 'bg-orange-500' },
    { key: 'booth', labelKo: '체험부스', labelEn: 'Booths', dotColor: 'bg-indigo-500' },
    { key: 'heatmap', labelKo: '혼잡도 히트맵', labelEn: 'Heatmap', dotColor: 'bg-red-500' },
    { key: 'crowd', labelKo: '방문객', labelEn: 'Crowd', dotColor: 'bg-teal-600' },
    { key: 'evacuationRoutes', labelKo: '비상통로', labelEn: 'Evac Routes', dotColor: 'bg-emerald-600' },
  ];

  const categoryColorDot = (cat: FacilityCategory) => {
    switch (cat) {
      case 'stage':
        return 'bg-blue-500';
      case 'food':
        return 'bg-orange-500';
      case 'medical':
        return 'bg-red-500';
      case 'vip':
        return 'bg-purple-500';
      case 'camping':
        return 'bg-teal-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full overflow-hidden bg-[#eef4fa] select-none"
    >
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Projected 3D Callout Labels */}
      {visibility.labels && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
          {labeledFacilities.map((f) => {
            const isSel = f.id === selectedFacilityId;
            const isPersonaHighlighted = highlightSet.has(f.id);
            return (
              <button
                key={f.id}
                ref={(el) => {
                  labelRefs.current[f.id] = el;
                }}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectFacility(f.id);
                }}
                style={{ opacity: 0 }}
                className={`absolute left-0 top-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-tight whitespace-nowrap shadow-sm transition-colors cursor-pointer ${
                  isSel
                    ? 'bg-blue-600 text-white ring-2 ring-white'
                    : isPersonaHighlighted
                      ? 'bg-emerald-700 text-white ring-2 ring-white'
                      : 'bg-slate-900/90 text-white hover:bg-blue-600'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${categoryColorDot(f.category)}`} />
                <span>{getFacilityDisplayName(f, language)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Top-Left Layer Filter & Contingency Scenario Toolbar (Opaque surface — zero backdrop-blur) */}
      <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-2 max-w-[calc(100%-220px)]">
        <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm">
          {onToggleLeftSidebar && (
            <>
              <button
                type="button"
                onClick={onToggleLeftSidebar}
                title={
                  isLeftSidebarOpen
                    ? language === 'ko'
                      ? '좌측 설정 패널 접기'
                      : 'Hide Left Panel'
                    : language === 'ko'
                      ? '좌측 설정 패널 열기'
                      : 'Show Left Panel'
                }
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isLeftSidebarOpen
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <PanelLeft className="w-3.5 h-3.5" />
                {!isLeftSidebarOpen && (
                  <span>{language === 'ko' ? '설정 열기' : 'Setup'}</span>
                )}
              </button>
              <div className="h-4 w-px bg-slate-200 mx-0.5" />
            </>
          )}

          {quickLayerButtons.map((btn) => {
            const active = visibility[btn.key];
            return (
              <button
                key={btn.key}
                type="button"
                onClick={() => onToggleVisibility(btn.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-xs ${btn.dotColor}`} />
                <span>{language === 'ko' ? btn.labelKo : btn.labelEn}</span>
              </button>
            );
          })}

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          <button
            type="button"
            onClick={() => onToggleVisibility('labels')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              visibility.labels
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{language === 'ko' ? '명칭' : 'Labels'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleLanguage}
            title="Switch UI Language (한국어 / English)"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>{language === 'ko' ? '한국어 · EN' : 'EN · 한국어'}</span>
          </button>

          {activeLayoutBadge === 'optimized' && (
            <span className="ml-1 text-xs font-semibold text-emerald-700 px-1.5">
              {language === 'ko' ? '최적화 배치 적용 중' : 'Optimized Layout'}
            </span>
          )}
        </div>

        {/* Digital Twin Contingency Scenario Switcher & 1-Click Re-Optimizer */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm text-xs">
          <span className="font-semibold text-slate-700 whitespace-nowrap">
            {language === 'ko' ? '돌발상황 시뮬레이션:' : 'Contingency:'}
          </span>
          <select
            value={contingency}
            onChange={(e) => onChangeContingency(e.target.value as ContingencyScenario)}
            aria-label="Contingency Scenario"
            className={`px-2 py-0.5 rounded border text-xs font-medium focus:outline-none cursor-pointer ${
              contingency === 'normal'
                ? 'bg-slate-50 border-slate-200 text-slate-800'
                : 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
            }`}
          >
            {(Object.keys(CONTINGENCY_INFO) as ContingencyScenario[]).map((cKey) => (
              <option key={cKey} value={cKey}>
                {language === 'ko'
                  ? CONTINGENCY_INFO[cKey].labelKo
                  : CONTINGENCY_INFO[cKey].labelEn}
              </option>
            ))}
          </select>

          {contingency !== 'normal' && (
            <button
              type="button"
              onClick={onReoptimizeContingency}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{language === 'ko' ? '실시간 재배치 실행' : 'Re-Optimize Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Hover Tooltip Readout */}
      {hoveredName && (
        <div className="pointer-events-none absolute top-28 left-3 z-20 bg-slate-900 text-white text-xs font-medium px-2.5 py-1 rounded-md shadow-sm">
          {language === 'ko' ? `클릭하여 상세 편집: ${hoveredName}` : `Click to inspect: ${hoveredName}`}
        </div>
      )}

      {/* Top-Right Camera Preset & Viewport Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
          <button
            type="button"
            onClick={() => applyCameraPreset('isometric')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              cameraMode === 'isometric'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>{language === 'ko' ? '쿼터뷰 3D' : 'Isometric'}</span>
          </button>
          <button
            type="button"
            onClick={() => applyCameraPreset('top')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              cameraMode === 'top'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{language === 'ko' ? '평면도' : 'Top-Down'}</span>
          </button>
          <button
            type="button"
            onClick={() => applyCameraPreset('perspective')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              cameraMode === 'perspective'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{language === 'ko' ? '현장 시점' : 'Perspective'}</span>
          </button>

          {onToggleRightSidebar && (
            <>
              <div className="h-4 w-px bg-slate-200 mx-0.5" />
              <button
                type="button"
                onClick={onToggleRightSidebar}
                title={
                  isRightSidebarOpen
                    ? language === 'ko'
                      ? '우측 분석 패널 접기'
                      : 'Hide Right Panel'
                    : language === 'ko'
                      ? '우측 분석 패널 열기'
                      : 'Show Right Panel'
                }
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isRightSidebarOpen
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {!isRightSidebarOpen && (
                  <span>{language === 'ko' ? '분석 열기' : 'Analysis'}</span>
                )}
                <PanelRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col bg-white border border-slate-200 rounded-lg p-1 shadow-sm gap-0.5">
          <button
            type="button"
            onClick={() => handleZoom(0.8)}
            title="Zoom In"
            aria-label="Zoom In"
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(1.25)}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => applyCameraPreset('isometric')}
            title="Reset Default Isometric View"
            aria-label="Reset View"
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-200 my-0.5" />
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label="Toggle Fullscreen"
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {webglError && (
        <div className="absolute inset-x-6 top-28 z-30 bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-sm">
          {webglError}
        </div>
      )}

      {children}
    </div>
  );
};