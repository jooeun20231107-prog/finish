import * as THREE from 'three';
import { EventConfig, Facility } from '../types/festival';
import { RouteSegment } from './crowdSimulation';
import { createSeededRandom } from './prng';

function makeStripedAwningTexture(primaryHex: string, stripeHex = '#ffffff'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const stripes = 8;
  const sw = canvas.width / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? primaryHex : stripeHex;
    ctx.fillRect(i * sw, 0, sw, canvas.height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeStageScreenTexture(accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e3a8a');
  grad.addColorStop(1, '#312e81');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 28; i++) {
    const h = 40 + Math.sin(i * 0.55) * 35 + ((i * 29) % 55);
    ctx.fillStyle = i % 3 === 0 ? '#38bdf8' : i % 2 === 0 ? accentHex : '#a855f7';
    ctx.fillRect(28 + i * 16.5, 128 - h / 2, 10, h);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 236);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeParkingLotTexture(widthM: number, depthM: number, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 20);
  ctx.lineTo(canvas.width / 2, canvas.height - 20);
  ctx.stroke();
  ctx.setLineDash([]);

  const bays = Math.max(6, Math.round(depthM / 4.2));
  const step = (canvas.height - 32) / bays;
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 3;
  for (let i = 0; i <= bays; i++) {
    const y = 16 + i * step;
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(88, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvas.width - 88, y);
    ctx.lineTo(canvas.width - 10, y);
    ctx.stroke();

    if (i < 2 && i < bays) {
      ctx.fillStyle = 'rgba(37, 99, 235, 0.45)';
      ctx.fillRect(14, y + 4, 70, step - 8);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  void widthM;
  return tex;
}

function makeLowPolyVehicle(colorHex: string): THREE.Group {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.32,
    metalness: 0.35,
  });
  const cabinMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.2,
    metalness: 0.1,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.12,
    metalness: 0.6,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.85,
    metalness: 0.1,
  });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.75, 1.9), bodyMat);
  chassis.position.y = 0.55;
  chassis.castShadow = true;
  car.add(chassis);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 1.68), cabinMat);
  cabin.position.set(-0.15, 1.2, 0);
  cabin.castShadow = true;
  car.add(cabin);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.48, 1.72), glassMat);
  windshield.position.set(-0.15, 1.18, 0);
  car.add(windshield);

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelPositions: Array<[number, number, number]> = [
    [-1.25, 0.34, 0.92],
    [1.25, 0.34, 0.92],
    [-1.25, 0.34, -0.92],
    [1.25, 0.34, -0.92],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    car.add(w);
  }
  return car;
}

export function buildFacilityGroup(facility: Facility, maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  group.name = `facility-${facility.id}`;
  group.position.set(facility.position.x, 0, facility.position.z);
  group.rotation.y = facility.rotation;

  const W = facility.dimensions.width;
  const D = facility.dimensions.depth;
  const H = facility.dimensions.height;
  const accent = facility.colorAccent || '#2563eb';

  switch (facility.subtype) {
    case 'main_stage':
    case 'secondary_stage': {
      const deckMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.72, metalness: 0.15 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 1.8, D), deckMat);
      deck.position.y = 0.9;
      deck.castShadow = true;
      deck.receiveShadow = true;
      group.add(deck);

      const carpetMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.85, metalness: 0.05 });
      const thrust = new THREE.Mesh(new THREE.BoxGeometry(W * 0.45, 1.84, 3.4), carpetMat);
      thrust.position.set(0, 0.92, D * 0.5 + 1.2);
      thrust.castShadow = true;
      group.add(thrust);

      const trussMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.3, metalness: 0.8 });
      const pillarOffsets: Array<[number, number]> = [
        [-W * 0.44, -D * 0.42],
        [W * 0.44, -D * 0.42],
        [-W * 0.44, D * 0.38],
        [W * 0.44, D * 0.38],
      ];
      for (const [px, pz] of pillarOffsets) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.9, H - 1.5, 0.9), trussMat);
        col.position.set(px, 1.8 + (H - 1.5) / 2, pz);
        col.castShadow = true;
        group.add(col);
      }

      const roofMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, metalness: 0.25 });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 1.3, D * 0.92), roofMat);
      roof.position.set(0, H + 0.6, -0.3);
      roof.castShadow = true;
      group.add(roof);

      const screenTex = makeStageScreenTexture(accent);
      const screenMat = new THREE.MeshStandardMaterial({
        map: screenTex,
        emissive: new THREE.Color('#1d4ed8'),
        emissiveMap: screenTex,
        emissiveIntensity: 0.45,
        roughness: 0.25,
      });
      const screen = new THREE.Mesh(new THREE.BoxGeometry(W * 0.78, H * 0.66, 0.7), screenMat);
      screen.position.set(0, 1.8 + H * 0.36, -D * 0.38);
      group.add(screen);

      const spkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5, metalness: 0.4 });
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, H * 0.55, 2.2), spkMat);
        wing.position.set(side * (W * 0.48 + 1.2), 1.8 + H * 0.38, D * 0.26);
        wing.castShadow = true;
        group.add(wing);
      }

      for (let m = -2; m <= 2; m++) {
        const mon = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.9), spkMat);
        mon.position.set(m * (W * 0.14), 2.05, D * 0.42);
        mon.rotation.x = -0.3;
        group.add(mon);
      }

      const beamMat = new THREE.MeshBasicMaterial({
        color: '#60a5fa',
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      });
      for (const bx of [-W * 0.26, 0, W * 0.26]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, H * 1.15, 16, 1, true), beamMat);
        cone.position.set(bx, H * 0.52, D * 0.32);
        cone.rotation.x = 0.38;
        group.add(cone);
      }
      break;
    }

    case 'seating_block': {
      const padMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.85, metalness: 0.05 });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(W, 0.32, D), padMat);
      pad.position.y = 0.16;
      pad.receiveShadow = true;
      group.add(pad);

      const aisleMat = new THREE.MeshStandardMaterial({ color: '#93c5fd', roughness: 0.8 });
      const aisle = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.36, D * 0.96), aisleMat);
      aisle.position.y = 0.18;
      group.add(aisle);

      const rowMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, metalness: 0.15 });
      const backMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.55 });
      const numRows = Math.max(4, Math.min(9, Math.floor(D / 2.6)));
      const rowSpacing = (D - 3) / numRows;
      const sideW = (W - 3.8) / 2;

      for (let r = 0; r < numRows; r++) {
        const rz = -D / 2 + 2 + r * rowSpacing;
        const stepH = 0.35 + (r / numRows) * 0.7;
        for (const side of [-1, 1]) {
          const sx = side * (sideW / 2 + 1.4);
          const bench = new THREE.Mesh(new THREE.BoxGeometry(sideW, stepH, 1.1), rowMat);
          bench.position.set(sx, 0.32 + stepH / 2, rz);
          bench.castShadow = true;
          bench.receiveShadow = true;
          group.add(bench);

          const backrest = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.55, 0.25), backMat);
          backrest.position.set(sx, 0.32 + stepH + 0.22, rz + 0.42);
          group.add(backrest);
        }
      }

      const railMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.4, metalness: 0.7 });
      const frontRail = new THREE.Mesh(new THREE.BoxGeometry(W, 0.95, 0.2), railMat);
      frontRail.position.set(0, 0.5, -D / 2 + 0.2);
      group.add(frontRail);
      break;
    }

    case 'food_truck': {
      const bodyMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.38, metalness: 0.22 });
      const roofMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6, metalness: 0.1 });
      const glassMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.15, metalness: 0.65 });
      const wheelMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.85 });

      const truckLen = Math.min(W, 9.2);
      const truckWid = Math.min(D, 4.2);

      const box = new THREE.Mesh(new THREE.BoxGeometry(truckLen * 0.74, 3.0, truckWid), bodyMat);
      box.position.set(-truckLen * 0.1, 2.0, 0);
      box.castShadow = true;
      group.add(box);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(truckLen * 0.72, 0.3, truckWid * 0.94), roofMat);
      cap.position.set(-truckLen * 0.1, 3.62, 0);
      group.add(cap);

      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.2), roofMat);
      ac.position.set(-truckLen * 0.15, 3.95, 0);
      group.add(ac);

      const cab = new THREE.Mesh(new THREE.BoxGeometry(truckLen * 0.26, 2.35, truckWid * 0.94), bodyMat);
      cab.position.set(truckLen * 0.38, 1.68, 0);
      cab.castShadow = true;
      group.add(cab);

      const wind = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.95, truckWid * 0.82), glassMat);
      wind.position.set(truckLen * 0.5, 2.15, 0);
      group.add(wind);

      const counterMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.5 });
      const windowRecess = new THREE.Mesh(
        new THREE.BoxGeometry(truckLen * 0.46, 1.25, 0.25),
        counterMat,
      );
      windowRecess.position.set(-truckLen * 0.1, 2.2, truckWid * 0.5 + 0.05);
      group.add(windowRecess);

      const awningTex = makeStripedAwningTexture(accent, '#ffffff');
      const awningMat = new THREE.MeshStandardMaterial({ map: awningTex, roughness: 0.65 });
      const awning = new THREE.Mesh(new THREE.BoxGeometry(truckLen * 0.52, 0.15, 1.6), awningMat);
      awning.position.set(-truckLen * 0.1, 3.0, truckWid * 0.5 + 0.75);
      awning.rotation.x = 0.24;
      awning.castShadow = true;
      group.add(awning);

      const wGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14);
      wGeo.rotateX(Math.PI / 2);
      for (const wx of [-truckLen * 0.32, truckLen * 0.34]) {
        for (const wz of [-truckWid * 0.46, truckWid * 0.46]) {
          const wh = new THREE.Mesh(wGeo, wheelMat);
          wh.position.set(wx, 0.55, wz);
          group.add(wh);
        }
      }
      break;
    }

    case 'food_stall': {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.25, D),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.8 }),
      );
      base.position.y = 0.125;
      group.add(base);

      const woodMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.72 });
      const counter = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 1.15, 1.1), woodMat);
      counter.position.set(0, 0.7, D * 0.3);
      counter.castShadow = true;
      group.add(counter);

      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.86, 2.6, 0.6),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.65 }),
      );
      wall.position.set(0, 1.45, -D * 0.32);
      wall.castShadow = true;
      group.add(wall);

      const postMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.6, roughness: 0.35 });
      for (const px of [-W * 0.4, W * 0.4]) {
        for (const pz of [-D * 0.36, D * 0.36]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.1, 8), postMat);
          p.position.set(px, 1.65, pz);
          group.add(p);
        }
      }

      const stripeTex = makeStripedAwningTexture(accent, '#ffffff');
      const canopyMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 });
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(W, D) * 0.68, 1.6, 4), canopyMat);
      roof.position.y = 3.85;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
      break;
    }

    case 'experience_booth': {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.22, D),
        new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.8 }),
      );
      pad.position.y = 0.11;
      pad.receiveShadow = true;
      group.add(pad);

      const legMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.65, roughness: 0.35 });
      for (const px of [-W * 0.42, W * 0.42]) {
        for (const pz of [-D * 0.42, D * 0.42]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.0, 0.28), legMat);
          leg.position.set(px, 1.6, pz);
          leg.castShadow = true;
          group.add(leg);
        }
      }

      const fasciaMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45 });
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.55, D * 0.94), fasciaMat);
      fascia.position.y = 3.2;
      group.add(fascia);

      const peakMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 });
      const peak = new THREE.Mesh(new THREE.ConeGeometry(W * 0.68, 2.2, 4), peakMat);
      peak.position.y = 4.55;
      peak.rotation.y = Math.PI / 4;
      peak.castShadow = true;
      group.add(peak);

      const table = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.62, 0.95, 1.4),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }),
      );
      table.position.set(0, 0.6, 0.6);
      group.add(table);

      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6), legMat);
      flagPole.position.set(W * 0.48, 2.1, D * 0.48);
      group.add(flagPole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.6, 0.08), fasciaMat);
      flag.position.set(W * 0.48 + 0.35, 2.7, D * 0.48);
      group.add(flag);
      break;
    }

    case 'family_lounge': {
      // Warm Barrier-Free Stroller & Nursing Family Pavilion
      const rampPad = new THREE.Mesh(
        new THREE.BoxGeometry(W + 1.2, 0.18, D + 1.4),
        new THREE.MeshStandardMaterial({ color: '#ffe4e6', roughness: 0.85 }),
      );
      rampPad.position.y = 0.09;
      rampPad.receiveShadow = true;
      group.add(rampPad);

      const wallMat = new THREE.MeshStandardMaterial({ color: '#fff1f2', roughness: 0.6 });
      const roseMat = new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.42 });
      const glassMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.2, metalness: 0.4 });

      const bldg = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 3.2, D * 0.8), wallMat);
      bldg.position.y = 1.65;
      bldg.castShadow = true;
      group.add(bldg);

      const win = new THREE.Mesh(new THREE.BoxGeometry(W * 0.65, 1.4, D * 0.84), glassMat);
      win.position.y = 1.75;
      group.add(win);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 0.55, D * 0.94), roseMat);
      roof.position.y = 3.5;
      roof.castShadow = true;
      group.add(roof);

      // Stroller parking canopy in front
      const awning = new THREE.Mesh(new THREE.BoxGeometry(W * 0.72, 0.18, 2.2), roseMat);
      awning.position.set(0, 2.55, D * 0.4 + 0.9);
      group.add(awning);
      break;
    }

    case 'rain_canopy': {
      // Large Translucent Tensile Membrane Rain Shelter Canopy
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.16, D),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.85 }),
      );
      deck.position.y = 0.08;
      deck.receiveShadow = true;
      group.add(deck);

      const mastMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.7, roughness: 0.3 });
      const membraneMat = new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        roughness: 0.35,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
      });
      const trimMat = new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 });

      for (const px of [-W * 0.44, 0, W * 0.44]) {
        for (const pz of [-D * 0.42, D * 0.42]) {
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, H - 0.8, 10), mastMat);
          mast.position.set(px, (H - 0.8) / 2, pz);
          mast.castShadow = true;
          group.add(mast);
        }
      }

      const canopy = new THREE.Mesh(new THREE.BoxGeometry(W + 1.4, 0.35, D + 1.4), membraneMat);
      canopy.position.y = H - 0.8;
      canopy.castShadow = true;
      group.add(canopy);

      const ridge = new THREE.Mesh(new THREE.ConeGeometry(Math.min(W, D) * 0.55, 1.8, 4), trimMat);
      ridge.position.y = H + 0.2;
      ridge.rotation.y = Math.PI / 4;
      group.add(ridge);
      break;
    }

    case 'rest_plaza':
    case 'fountain_plaza': {
      const patio = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.18, D),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.88 }),
      );
      patio.position.y = 0.09;
      patio.receiveShadow = true;
      group.add(patio);

      const cols = Math.max(2, Math.floor(W / 8));
      const rows = Math.max(2, Math.floor(D / 7.5));
      const umbrellaColors = ['#0ea5e9', '#f97316', '#eab308', '#10b981', '#ec4899'];
      const woodMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.78 });
      const poleMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.6, roughness: 0.3 });

      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tx = -W / 2 + (W / (cols + 1)) * (c + 1);
          const tz = -D / 2 + (D / (rows + 1)) * (r + 1);

          const tbl = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.16, 12), woodMat);
          tbl.position.set(tx, 0.85, tz);
          tbl.castShadow = true;
          group.add(tbl);

          const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.7, 8), poleMat);
          ped.position.set(tx, 1.45, tz);
          group.add(ped);

          const umbColor = umbrellaColors[idx % umbrellaColors.length];
          const umb = new THREE.Mesh(
            new THREE.ConeGeometry(2.3, 0.85, 8),
            new THREE.MeshStandardMaterial({ color: umbColor, roughness: 0.55 }),
          );
          umb.position.set(tx, 3.0, tz);
          umb.castShadow = true;
          group.add(umb);
          idx++;
        }
      }
      break;
    }

    case 'play_zone': {
      const plaza = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.2, D),
        new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.85 }),
      );
      plaza.position.y = 0.1;
      plaza.receiveShadow = true;
      group.add(plaza);

      const fx = W * 0.22;
      const brickMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.75 });
      const waterMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.18, metalness: 0.2 });

      const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.75, 20), brickMat);
      basin.position.set(fx, 0.48, 0);
      basin.castShadow = true;
      group.add(basin);

      const water = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.82, 20), waterMat);
      water.position.set(fx, 0.52, 0);
      group.add(water);

      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 1.6, 16), brickMat);
      tier2.position.set(fx, 1.3, 0);
      group.add(tier2);

      const wx = -W * 0.18;
      const wheelR = 6.2;
      const centerH = 8.0;
      const strutMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.65, roughness: 0.3 });
      const rimMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', metalness: 0.4, roughness: 0.35 });

      for (const zSide of [-1.4, 1.4]) {
        const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 9.2, 8), strutMat);
        legL.position.set(wx - 2.3, 4.3, zSide);
        legL.rotation.z = -0.26;
        legL.castShadow = true;
        group.add(legL);

        const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 9.2, 8), strutMat);
        legR.position.set(wx + 2.3, 4.3, zSide);
        legR.rotation.z = 0.26;
        legR.castShadow = true;
        group.add(legR);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.18, 10, 28), rimMat);
        ring.position.set(wx, centerH, zSide * 0.65);
        ring.castShadow = true;
        group.add(ring);
      }

      const GondolaColors = ['#f97316', '#ec4899', '#eab308', '#06b6d4', '#8b5cf6', '#10b981'];
      for (let g = 0; g < 10; g++) {
        const ang = (g / 10) * Math.PI * 2;
        const gx = wx + Math.cos(ang) * wheelR;
        const gy = centerH + Math.sin(ang) * wheelR;
        const gondola = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 1.15, 1.3),
          new THREE.MeshStandardMaterial({ color: GondolaColors[g % GondolaColors.length], roughness: 0.4 }),
        );
        gondola.position.set(gx, gy - 0.5, 0);
        gondola.castShadow = true;
        group.add(gondola);
      }
      break;
    }

    case 'restroom_bank': {
      const wallMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.65 });
      const fasciaMat = new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.45 });
      const doorMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.5, metalness: 0.3 });

      const bldg = new THREE.Mesh(new THREE.BoxGeometry(W, 3.1, D * 0.78), wallMat);
      bldg.position.y = 1.55;
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      group.add(bldg);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.5, D * 0.9), fasciaMat);
      roof.position.y = 3.35;
      roof.castShadow = true;
      group.add(roof);

      const stallCount = Math.max(4, Math.floor(W / 2.2));
      const spacing = (W - 2) / stallCount;
      for (let i = 0; i < stallCount; i++) {
        const dx = -W / 2 + 1 + spacing * (i + 0.5);
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.15, 0.14), doorMat);
        door.position.set(dx, 1.15, D * 0.39 + 0.05);
        group.add(door);
      }
      break;
    }

    case 'medical_station': {
      const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 });
      const redMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.45 });

      const bldg = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 3.4, D * 0.82), whiteMat);
      bldg.position.y = 1.7;
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      group.add(bldg);

      const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.4, D * 0.88), redMat);
      roofTrim.position.y = 3.6;
      group.add(roofTrim);

      const crossH = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.3), redMat);
      crossH.position.y = 3.85;
      group.add(crossH);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 4.2), redMat);
      crossV.position.y = 3.85;
      group.add(crossV);

      const canopy = new THREE.Mesh(new THREE.BoxGeometry(W * 0.5, 0.2, 2.4), whiteMat);
      canopy.position.set(0, 2.7, D * 0.41 + 1.0);
      group.add(canopy);
      break;
    }

    case 'main_entrance':
    case 'secondary_entrance': {
      const span = Math.max(W, D);
      const thick = Math.min(W, D);
      const isAlongZ = D > W;

      const archGroup = new THREE.Group();
      if (isAlongZ) archGroup.rotation.y = Math.PI / 2;

      const towerMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.25 });
      const trimMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 });
      const bannerMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.35 });

      const halfSpan = span * 0.42;
      for (const side of [-1, 1]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, H, thick * 0.55), towerMat);
        tower.position.set(side * halfSpan, H / 2, 0);
        tower.castShadow = true;
        archGroup.add(tower);

        const flag = new THREE.Mesh(
          new THREE.ConeGeometry(0.65, H * 0.85, 6),
          new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.5 }),
        );
        flag.position.set(side * (halfSpan + 2.1), H * 0.45, 0);
        archGroup.add(flag);
      }

      const header = new THREE.Mesh(new THREE.BoxGeometry(span * 0.96, 2.4, thick * 0.62), bannerMat);
      header.position.set(0, H - 1.1, 0);
      header.castShadow = true;
      archGroup.add(header);

      const accentStrip = new THREE.Mesh(new THREE.BoxGeometry(span * 0.86, 0.9, thick * 0.66), trimMat);
      accentStrip.position.set(0, H - 1.1, 0);
      archGroup.add(accentStrip);

      const laneCount = Math.max(3, Math.floor((span - 4) / 2.6));
      for (let l = 0; l < laneCount; l++) {
        const lx = -halfSpan + 2.2 + l * ((span - 5) / Math.max(1, laneCount - 1));
        const turnstile = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.05, 1.8), trimMat);
        turnstile.position.set(lx, 0.52, 0);
        archGroup.add(turnstile);
      }

      group.add(archGroup);
      break;
    }

    case 'ticket_info':
    case 'multilingual_info': {
      const bodyMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6 });
      const roofMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4 });
      const glassMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.2, metalness: 0.5 });

      const bldg = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 3.2, D * 0.82), bodyMat);
      bldg.position.y = 1.6;
      bldg.castShadow = true;
      group.add(bldg);

      const win = new THREE.Mesh(new THREE.BoxGeometry(W * 0.72, 1.3, D * 0.86), glassMat);
      win.position.y = 1.85;
      group.add(win);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 1.0, 0.7, D + 1.0), roofMat);
      roof.position.y = 3.55;
      roof.castShadow = true;
      group.add(roof);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(facility.subtype === 'multilingual_info' ? 1.15 : 0.85, 16, 16),
        new THREE.MeshStandardMaterial({
          color: facility.subtype === 'multilingual_info' ? '#0ea5e9' : accent,
          roughness: 0.3,
          metalness: 0.25,
        }),
      );
      beacon.position.y = 4.75;
      group.add(beacon);

      if (facility.subtype === 'multilingual_info') {
        const orbitRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.55, 0.1, 8, 24),
          new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.4, roughness: 0.3 }),
        );
        orbitRing.position.y = 4.75;
        orbitRing.rotation.x = Math.PI / 3;
        group.add(orbitRing);
      }
      break;
    }

    case 'vip_lounge': {
      const deckMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.75 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 0.65, D), deckMat);
      deck.position.y = 0.325;
      deck.castShadow = true;
      deck.receiveShadow = true;
      group.add(deck);

      const canopyMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.42, metalness: 0.2 });
      const postMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.7, roughness: 0.3 });
      for (const px of [-W * 0.44, W * 0.44]) {
        for (const pz of [-D * 0.42, D * 0.42]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.0, 8), postMat);
          p.position.set(px, 2.6, pz);
          group.add(p);
        }
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 0.45, D * 0.94), canopyMat);
      roof.position.y = 4.65;
      roof.castShadow = true;
      group.add(roof);

      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.6, 1.15, 1.5),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35 }),
      );
      bar.position.set(0, 1.2, -D * 0.28);
      group.add(bar);

      const sofaMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.65 });
      for (const sx of [-W * 0.25, W * 0.25]) {
        const sofa = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 1.6), sofaMat);
        sofa.position.set(sx, 1.0, D * 0.2);
        group.add(sofa);
      }
      break;
    }

    case 'camping_zone': {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.14, D),
        new THREE.MeshStandardMaterial({ color: '#d9f99d', roughness: 0.92 }),
      );
      pad.position.y = 0.07;
      pad.receiveShadow = true;
      group.add(pad);

      const tentColors = ['#0d9488', '#0284c7', '#f59e0b', '#6366f1', '#10b981'];
      const cols = Math.max(2, Math.floor(W / 10));
      const rows = Math.max(2, Math.floor(D / 9.5));
      let tIdx = 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tx = -W / 2 + (W / (cols + 1)) * (c + 1);
          const tz = -D / 2 + (D / (rows + 1)) * (r + 1);
          const tentMat = new THREE.MeshStandardMaterial({
            color: tentColors[tIdx % tentColors.length],
            roughness: 0.68,
          });
          const tent = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.3, 4), tentMat);
          tent.position.set(tx, 1.25, tz);
          tent.rotation.y = Math.PI / 4 + ((tIdx % 3) - 1) * 0.12;
          tent.castShadow = true;
          group.add(tent);
          tIdx++;
        }
      }
      break;
    }

    case 'parking_lot': {
      const lotTex = makeParkingLotTexture(W, D, maxAnisotropy);
      const lotMat = new THREE.MeshStandardMaterial({
        map: lotTex,
        roughness: 0.88,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const lot = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, D), lotMat);
      lot.position.y = 0.08;
      lot.receiveShadow = true;
      group.add(lot);

      const carColors = ['#ef4444', '#3b82f6', '#eab308', '#f8fafc', '#10b981', '#64748b'];
      const rand = createSeededRandom(Math.round(W * 31 + D * 17));
      const bays = Math.max(5, Math.floor(D / 5.5));
      for (let b = 0; b < bays; b++) {
        const bz = -D / 2 + 3.5 + b * ((D - 7) / Math.max(1, bays - 1));
        for (const side of [-1, 1]) {
          if (rand() < 0.68) {
            const car = makeLowPolyVehicle(carColors[Math.floor(rand() * carColors.length)]);
            car.position.set(side * (W * 0.31), 0.16, bz);
            if (side === 1) car.rotation.y = Math.PI;
            group.add(car);
          }
        }
      }
      break;
    }
  }

  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(5, W + 1.2), Math.max(3.2, H + 1), Math.max(5, D + 1.2)),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitBox.position.y = Math.max(1.6, H / 2);
  hitBox.layers.enable(1);
  hitBox.userData = { facilityId: facility.id };
  group.add(hitBox);

  return group;
}

export function buildVenueGroundAndPerimeter(config: EventConfig): THREE.Group {
  const envGroup = new THREE.Group();
  envGroup.name = 'venue-environment';

  const W = config.venueWidth;
  const D = config.venueDepth;

  const outerTerrain = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: '#dce8d6', roughness: 0.95, metalness: 0.0 }),
  );
  outerTerrain.rotation.x = -Math.PI / 2;
  outerTerrain.position.y = -0.08;
  outerTerrain.receiveShadow = true;
  envGroup.add(outerTerrain);

  const roadW = 13;
  const roadMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.9, metalness: 0.05 });
  const outerW = W + roadW * 2 + 8;
  const outerD = D + roadW * 2 + 8;

  const roadRing = new THREE.Mesh(new THREE.BoxGeometry(outerW, 0.08, outerD), roadMat);
  roadRing.position.y = -0.04;
  roadRing.receiveShadow = true;
  envGroup.add(roadRing);

  const sidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(W + 6, 0.14, D + 6),
    new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.85 }),
  );
  sidewalk.position.y = -0.03;
  sidewalk.receiveShadow = true;
  envGroup.add(sidewalk);

  const turf = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.16, D),
    new THREE.MeshStandardMaterial({ color: '#a3d977', roughness: 0.92, metalness: 0.0 }),
  );
  turf.position.y = -0.02;
  turf.receiveShadow = true;
  envGroup.add(turf);

  const stripeMat = new THREE.MeshBasicMaterial({ color: '#f8fafc' });
  const roadSouthZ = D / 2 + 4 + roadW / 2;
  const roadEastX = W / 2 + 4 + roadW / 2;

  for (let x = -W / 2; x <= W / 2; x += 12) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 0.35), stripeMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.02, roadSouthZ);
    envGroup.add(dash);
  }
  for (let z = -D / 2; z <= D / 2; z += 12) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 5.5), stripeMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(roadEastX, 0.02, z);
    envGroup.add(dash);
  }

  const fenceMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.5, metalness: 0.5 });
  const halfW = W / 2;
  const halfD = D / 2;

  const railN = new THREE.Mesh(new THREE.BoxGeometry(W, 0.18, 0.18), fenceMat);
  railN.position.set(0, 0.95, -halfD);
  envGroup.add(railN);

  const railW = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, D), fenceMat);
  railW.position.set(-halfW, 0.95, 0);
  envGroup.add(railW);

  return envGroup;
}

export function buildLandscapingTrees(config: EventConfig, facilities: Facility[]): THREE.Group {
  const treeGroup = new THREE.Group();
  treeGroup.name = 'landscaping-trees';

  const W = config.venueWidth;
  const D = config.venueDepth;
  const rand = createSeededRandom(config.seed ^ 0x517cc1b7);

  const coords: Array<{ x: number; z: number; scale: number; tint: number }> = [];

  const overlapsFacility = (tx: number, tz: number) =>
    facilities.some(
      (f) =>
        Math.abs(tx - f.position.x) < f.dimensions.width / 2 + 4.5 &&
        Math.abs(tz - f.position.z) < f.dimensions.depth / 2 + 4.5,
    );

  for (let x = -W * 0.58; x <= W * 0.58; x += 14) {
    coords.push({ x, z: -D * 0.62, scale: 0.9 + rand() * 0.35, tint: rand() });
    coords.push({ x, z: D * 0.63, scale: 0.9 + rand() * 0.35, tint: rand() });
  }
  for (let z = -D * 0.54; z <= D * 0.54; z += 14) {
    coords.push({ x: -W * 0.62, z, scale: 0.9 + rand() * 0.35, tint: rand() });
    coords.push({ x: W * 0.63, z, scale: 0.9 + rand() * 0.35, tint: rand() });
  }

  for (let i = 0; i < 65; i++) {
    const tx = (rand() - 0.5) * (W - 14);
    const tz = (rand() - 0.5) * (D - 14);
    if (Math.abs(tx + 7) < 14 && tz < 12) continue;
    if (Math.abs(tz - 6) < 6.5) continue;
    if (!overlapsFacility(tx, tz)) {
      coords.push({ x: tx, z: tz, scale: 0.78 + rand() * 0.36, tint: rand() });
    }
  }

  const count = coords.length;
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.48, 2.4, 7);
  trunkGeo.translate(0, 1.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });

  const crownLowGeo = new THREE.SphereGeometry(2.1, 10, 8);
  crownLowGeo.translate(0, 3.3, 0);
  const crownTopGeo = new THREE.SphereGeometry(1.5, 10, 8);
  crownTopGeo.translate(0, 4.9, 0);
  const crownMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const crownsLow = new THREE.InstancedMesh(crownLowGeo, crownMat, count);
  const crownsTop = new THREE.InstancedMesh(crownTopGeo, crownMat, count);
  crownsLow.castShadow = true;
  crownsTop.castShadow = true;

  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  const greens = ['#4ade80', '#22c55e', '#16a34a', '#65a30d'];

  for (let i = 0; i < count; i++) {
    const item = coords[i];
    dummy.position.set(item.x, 0, item.z);
    dummy.scale.setScalar(item.scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crownsLow.setMatrixAt(i, dummy.matrix);
    crownsTop.setMatrixAt(i, dummy.matrix);

    c.set(greens[Math.floor(item.tint * greens.length) % greens.length]);
    crownsLow.setColorAt(i, c);
    c.offsetHSL(0.02, 0, 0.05);
    crownsTop.setColorAt(i, c);
  }

  trunks.instanceMatrix.needsUpdate = true;
  crownsLow.instanceMatrix.needsUpdate = true;
  crownsTop.instanceMatrix.needsUpdate = true;
  if (crownsLow.instanceColor) crownsLow.instanceColor.needsUpdate = true;
  if (crownsTop.instanceColor) crownsTop.instanceColor.needsUpdate = true;
  trunks.computeBoundingSphere();
  crownsLow.computeBoundingSphere();
  crownsTop.computeBoundingSphere();

  treeGroup.add(trunks, crownsLow, crownsTop);
  return treeGroup;
}

export function buildRouteLayers(routes: RouteSegment[]): {
  pedestrianGroup: THREE.Group;
  evacuationGroup: THREE.Group;
} {
  const pedestrianGroup = new THREE.Group();
  const evacuationGroup = new THREE.Group();

  const pedMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.88,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const evacMat = new THREE.MeshBasicMaterial({
    color: '#10b981',
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  for (const seg of routes) {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const len = Math.hypot(dx, dz);
    if (len < 1) continue;

    const midX = (seg.x1 + seg.x2) / 2;
    const midZ = (seg.z1 + seg.z2) / 2;
    const angle = Math.atan2(dx, dz);

    if (seg.isEvacuation) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(seg.width * 0.55, len), evacMat);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = angle;
      strip.position.set(midX, 0.12, midZ);
      evacuationGroup.add(strip);
    } else {
      const pathMesh = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.08, len + seg.width * 0.5), pedMat);
      pathMesh.position.set(midX, 0.04, midZ);
      pathMesh.rotation.y = angle;
      pathMesh.receiveShadow = true;
      pedestrianGroup.add(pathMesh);
    }
  }

  return { pedestrianGroup, evacuationGroup };
}