import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MapInfo } from 'shared';
import { useGameStore } from '../../store/useGameStore';
import { fxStale } from '../../store/slices/fx';
import { activeGridOf, activeMapOf, tokenById } from '../../store/selectors';
import { buildFxPlan, type FxAnchor, type FxPhase, type FxPlan, type WorldPoint } from './timeline';
import type { FxMask } from './mask';
import { createConeFlame } from './flameCone';
import { canvasTexture, coneTex, glowTex } from './textures';

/** Ударная волна/кольцо ауры. */
const ringTex = canvasTexture((ctx) => {
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 12;
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.stroke();
});

/** Пламя: плотное тело взрыва (белый центр → цвет → прозрачный край). */
const flameTex = canvasTexture((ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,246,224,0.98)');
  g.addColorStop(0.55, 'rgba(255,214,150,0.92)');
  g.addColorStop(0.8, 'rgba(255,158,80,0.62)');
  g.addColorStop(1, 'rgba(255,96,32,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});

/** Искра/мотылёк. */
const sparkTex = canvasTexture((ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 40);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});

/** Квадратное тело взрыва (куб: Дрожь земли и подобные). */
const squareTex = canvasTexture((ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 88);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});

/** Линия/луч: полоса с затуханием к дальнему концу. */
const lineTex = canvasTexture((ctx) => {
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});

/** Гранёный щит (Shield): шестиугольник. */
const hexTex = canvasTexture((ctx) => {
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 10;
  ctx.shadowColor = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = 12;
  const r = 56;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = 64 + r * Math.cos(a);
    const y = 64 + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
});

/** Кадровый контекст: перевод мира в экран и позиции токенов. */
interface FrameCtx {
  dt: number;
  scale: number;
  project: (p: WorldPoint) => WorldPoint;
  resolve: (a: FxAnchor) => WorldPoint | null;
}

/** Отрисовщик одной фазы: сам управляет своими нодами по прогрессу t (0…1). */
interface Visual {
  group: THREE.Group;
  update: (t: number, ctx: FrameCtx) => void;
  dispose: () => void;
}

interface ParticleSet {
  points: THREE.Points;
  material: THREE.PointsMaterial;
  positions: Float32Array;
  velocities: Float32Array;
}

/** Плоскость с текстурой (спрайты в three с ортокамерой капризны — берём PlaneGeometry). */
const planeGeometry = new THREE.PlaneGeometry(1, 1);

type PlaneSprite = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

function sprite(tex: THREE.Texture, color: string): PlaneSprite {
  const material = new THREE.MeshBasicMaterial({
    map: tex,
    color,
    transparent: true,
    // У камеры ось Y экранная (top=0, bottom=h) — обход вершин перевёрнут, нужны обе стороны.
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(planeGeometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

function particles(count: number, color: string, size: number): ParticleSet {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: sparkTex,
    color,
    size,
    sizeAttenuation: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, material, positions, velocities };
}

function stepParticles(set: ParticleSet, dt: number, drag: number, liftY = 0): void {
  const { positions, velocities } = set;
  const k = Math.pow(drag, dt / 16.7);
  for (let i = 0; i < velocities.length / 2; i++) {
    velocities[i * 2]! *= k;
    velocities[i * 2 + 1] = velocities[i * 2 + 1]! * k + liftY * dt;
    positions[i * 3] = positions[i * 3]! + velocities[i * 2]! * dt;
    positions[i * 3 + 1] = positions[i * 3 + 1]! + velocities[i * 2 + 1]! * dt;
  }
  (set.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
}

function spriteMaterial(node: PlaneSprite): THREE.MeshBasicMaterial {
  return node.material;
}

/** Снаряд: ядро с шлейфом летит по дуге от кастера к цели/точке. */
function travelVisual(phase: FxPhase): Visual {
  const group = new THREE.Group();
  const core = sprite(glowTex, phase.color);
  const trails = [sprite(glowTex, phase.color), sprite(glowTex, phase.color), sprite(glowTex, phase.color)];
  group.add(core, ...trails);
  const history: WorldPoint[] = [];

  return {
    group,
    update: (t, ctx) => {
      if (t < 0 || t > 1) {
        group.visible = false;
        return;
      }
      const from = phase.from ? ctx.resolve(phase.from) : null;
      const to = phase.to ? ctx.resolve(phase.to) : null;
      if (!from || !to) {
        group.visible = false;
        return;
      }
      group.visible = true;
      const arc = phase.arc ?? 0;
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const control = { x: mid.x - ((to.y - from.y) / len) * arc, y: mid.y + ((to.x - from.x) / len) * arc };
      const point = {
        x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * control.x + t * t * to.x,
        y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * control.y + t * t * to.y,
      };
      history.push(point);
      if (history.length > 12) history.shift();
      const screen = ctx.project(point);
      const size = 32 * ctx.scale;
      core.position.set(screen.x, screen.y, 1);
      core.scale.set(size, size, 1);
      spriteMaterial(core).opacity = 1 - 0.2 * t;
      trails.forEach((trail, i) => {
        const at = history[history.length - 1 - (i + 1) * 2] ?? point;
        const screenAt = ctx.project(at);
        const trailSize = size * (0.62 - i * 0.15);
        trail.position.set(screenAt.x, screenAt.y, 0.9);
        trail.scale.set(trailSize, trailSize, 1);
        spriteMaterial(trail).opacity = (0.6 - i * 0.15) * (1 - t);
      });
    },
    dispose: () => {
      group.clear();
      core.material.dispose();
      trails.forEach((trail) => trail.material.dispose());
    },
  };
}

/** Взрыв области: плотное пламя на весь радиус (куб — квадратная волна), ударная волна и угли. */
function burstVisual(phase: FxPhase): Visual {
  const group = new THREE.Group();
  const body = sprite(phase.shape === 'cube' ? squareTex : flameTex, phase.color);
  body.material.blending = THREE.NormalBlending;
  const hot = sprite(glowTex, '#fff2cc');
  const ring = sprite(ringTex, phase.color);
  const sparks = particles(48, phase.color, 11);
  group.add(body, hot, ring, sparks.points);
  let spawned = false;

  return {
    group,
    update: (t, ctx) => {
      if (t < 0 || t > 1) {
        group.visible = false;
        return;
      }
      const at = phase.to ? ctx.resolve(phase.to) : null;
      if (!at) {
        group.visible = false;
        return;
      }
      group.visible = true;
      const center = ctx.project(at);
      const radius = (phase.radius ?? 50) * ctx.scale;
      const ease = 1 - Math.pow(1 - Math.min(1, t / 0.5), 3);

      // Тело: быстро раздувается на весь радиус, держится и гаснет, чуть поднимаясь.
      const bodyScale = radius * 2 * (0.22 + 0.78 * ease);
      body.position.set(center.x, center.y - radius * 0.08 * t, 0.4);
      body.scale.set(bodyScale, bodyScale, 1);
      const fade = t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45);
      spriteMaterial(body).opacity = 0.95 * fade;

      // Раскалённое ядро — аддитивная вспышка в первые мгновения.
      const hotScale = radius * 1.1 * (0.3 + 0.7 * Math.min(1, t * 3));
      hot.position.set(center.x, center.y, 0.6);
      hot.scale.set(hotScale, hotScale, 1);
      spriteMaterial(hot).opacity = Math.max(0, 1 - t * 2.2) * 0.9;

      // Ударная волна: расходится чуть шире радиуса и гаснет к 70% времени.
      const ringEase = 1 - Math.pow(1 - Math.min(1, t / 0.7), 3);
      const ringScale = radius * 2.2 * (0.3 + 0.7 * ringEase);
      ring.position.set(center.x, center.y, 0.7);
      ring.scale.set(ringScale, ringScale, 1);
      spriteMaterial(ring).opacity = Math.max(0, 1 - t / 0.7) * 0.85;

      if (!spawned) {
        spawned = true;
        for (let i = 0; i < sparks.velocities.length / 2; i++) {
          const angle = Math.random() * Math.PI * 2;
          // px/ms: за ~900 мс угли пролетают 0.1–0.5 радиуса.
          const speed = (0.00015 + Math.random() * 0.00045) * radius;
          sparks.positions[i * 3] = center.x + Math.cos(angle) * radius * 0.35;
          sparks.positions[i * 3 + 1] = center.y + Math.sin(angle) * radius * 0.35;
          sparks.positions[i * 3 + 2] = 0.5;
          sparks.velocities[i * 2] = Math.cos(angle) * speed * (1 + Math.random());
          sparks.velocities[i * 2 + 1] = Math.sin(angle) * speed * (1 + Math.random());
        }
      }
      stepParticles(sparks, ctx.dt, 0.93, -0.00000035 * radius);
      sparks.material.opacity = Math.max(0, 1 - t * 1.05);
    },
    dispose: () => {
      group.clear();
      body.material.dispose();
      hot.material.dispose();
      ring.material.dispose();
      sparks.points.geometry.dispose();
      sparks.material.dispose();
    },
  };
}

/** Линия/луч: форма растёт от вершины в сторону прицела (настоящая геометрия 5e). */
function beamVisual(phase: FxPhase): Visual {
  const group = new THREE.Group();
  const tex = phase.shape === 'line' ? lineTex : coneTex;
  const body = sprite(tex, phase.color);
  body.material.blending = THREE.NormalBlending;
  const hot = sprite(tex, '#ffffff');
  const sparks = particles(30, phase.color, 10);
  group.add(body, hot, sparks.points);
  let spawned = false;

  return {
    group,
    update: (t, ctx) => {
      if (t < 0 || t > 1) {
        group.visible = false;
        return;
      }
      const at = phase.to ? ctx.resolve(phase.to) : null;
      if (!at) {
        group.visible = false;
        return;
      }
      const dirPt = phase.dir ? ctx.resolve(phase.dir) : null;
      group.visible = true;
      const anchor = ctx.project(at);
      const angle = dirPt ? Math.atan2(dirPt.y - at.y, dirPt.x - at.x) : 0;
      const ca = Math.cos(-angle);
      const sa = Math.sin(-angle);
      const len = (phase.radius ?? 50) * ctx.scale;
      const wid = (phase.width ?? phase.radius ?? 50) * ctx.scale;
      const growth = 1 - Math.pow(1 - Math.min(1, t / 0.4), 3);
      const w = len * (0.25 + 0.75 * growth);
      const h = wid * (0.35 + 0.65 * growth);
      const fade = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);

      // Локальный якорь формы — вершина у левого края по центру: позиция меша смещается,
      // чтобы при повороте вершина оставалась на точке применения.
      const place = (mesh: PlaneSprite, scale: number, z: number, opacity: number) => {
        const lx = -0.5 * w * scale;
        // Ось Y камеры экранная (вниз): поворот плоскости = +angle, иначе диагональ зеркалится.
        mesh.rotation.z = angle;
        mesh.scale.set(w * scale, h * scale, 1);
        mesh.position.set(anchor.x - lx * ca, anchor.y + lx * sa, z);
        spriteMaterial(mesh).opacity = opacity;
      };
      place(body, 1, 0.45, 0.9 * fade);
      place(hot, 0.5, 0.55, 0.45 * fade);

      if (!spawned) {
        spawned = true;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        for (let i = 0; i < sparks.velocities.length / 2; i++) {
          const along = Math.random() * w;
          const half = phase.shape === 'line' ? h / 2 : (along / Math.max(w, 1)) * (h / 2);
          const side = (Math.random() * 2 - 1) * half;
          sparks.positions[i * 3] = anchor.x + dx * along - dy * side;
          sparks.positions[i * 3 + 1] = anchor.y + dy * along + dx * side;
          sparks.positions[i * 3 + 2] = 0.5;
          const speed = 0.0002 + Math.random() * 0.0006;
          sparks.velocities[i * 2] = dx * speed + (Math.random() - 0.5) * speed;
          sparks.velocities[i * 2 + 1] = dy * speed + (Math.random() - 0.5) * speed;
        }
      }
      stepParticles(sparks, ctx.dt, 0.92);
      sparks.material.opacity = Math.max(0, 1 - t * 1.05);
    },
    dispose: () => {
      group.clear();
      body.material.dispose();
      hot.material.dispose();
      sparks.points.geometry.dispose();
      sparks.material.dispose();
    },
  };
}

/** Попадание: вспышка и короткие искры на цели. */
function impactVisual(phase: FxPhase): Visual {
  const group = new THREE.Group();
  const flash = sprite(glowTex, phase.color);
  const sparks = particles(20, phase.color, 8);
  group.add(flash, sparks.points);
  let spawned = false;

  return {
    group,
    update: (t, ctx) => {
      if (t < 0 || t > 1) {
        group.visible = false;
        return;
      }
      const at = phase.to ? ctx.resolve(phase.to) : null;
      if (!at) {
        group.visible = false;
        return;
      }
      group.visible = true;
      const center = ctx.project(at);
      const radius = (phase.radius ?? 25) * ctx.scale;
      const pulse = 1 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.3));
      const size = radius * 3 * pulse;
      flash.position.set(center.x, center.y, 1);
      flash.scale.set(size, size, 1);
      spriteMaterial(flash).opacity = Math.max(0, 1 - t * 1.05) * 0.95;

      if (!spawned) {
        spawned = true;
        for (let i = 0; i < sparks.velocities.length / 2; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (0.0006 + Math.random() * 0.0012) * radius;
          sparks.positions[i * 3] = center.x;
          sparks.positions[i * 3 + 1] = center.y;
          sparks.positions[i * 3 + 2] = 0.5;
          sparks.velocities[i * 2] = Math.cos(angle) * speed;
          sparks.velocities[i * 2 + 1] = Math.sin(angle) * speed;
        }
      }
      stepParticles(sparks, ctx.dt, 0.9);
      sparks.material.opacity = Math.max(0, 1 - t * 1.15);
    },
    dispose: () => {
      group.clear();
      flash.material.dispose();
      sparks.points.geometry.dispose();
      sparks.material.dispose();
    },
  };
}

/** Аура баффа/лечения: мягкое кольцо и поднимающиеся мотыльки. */
function auraVisual(phase: FxPhase): Visual {
  const group = new THREE.Group();
  const ring = sprite(phase.aura === 'shield' ? hexTex : ringTex, phase.color);
  const outer = phase.aura === 'holy' ? sprite(ringTex, phase.color) : null;
  const motes = particles(phase.aura === 'holy' ? 26 : 16, phase.color, 7);
  group.add(ring, motes.points);
  if (outer) group.add(outer);
  let spawned = false;

  return {
    group,
    update: (t, ctx) => {
      if (t < 0 || t > 1) {
        group.visible = false;
        return;
      }
      const at = phase.to ? ctx.resolve(phase.to) : null;
      if (!at) {
        group.visible = false;
        return;
      }
      group.visible = true;
      const center = ctx.project(at);
      const radius = (phase.radius ?? 40) * ctx.scale;
      const ease = 1 - Math.pow(1 - Math.min(1, t * 1.15), 2);
      ring.position.set(center.x, center.y + radius * 0.25, 1);
      ring.scale.set(radius * 2 * (0.4 + 0.6 * ease), radius * (0.8 + 0.5 * ease), 1);
      spriteMaterial(ring).opacity = Math.max(0, 1 - t) * 0.7;

      if (outer) {
        const late = Math.max(0, Math.min(1, (t - 0.12) / 0.88));
        const oe = 1 - Math.pow(1 - late, 2);
        outer.position.set(center.x, center.y + radius * 0.2, 0.9);
        outer.scale.set(radius * 2.5 * (0.3 + 0.7 * oe), radius * (0.8 + 0.6 * oe), 1);
        spriteMaterial(outer).opacity = Math.max(0, 1 - t) * 0.45;
      }

      if (!spawned) {
        spawned = true;
        for (let i = 0; i < motes.velocities.length / 2; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spread = radius * (0.3 + Math.random() * 0.5);
          motes.positions[i * 3] = center.x + Math.cos(angle) * spread;
          motes.positions[i * 3 + 1] = center.y + Math.sin(angle) * spread * 0.6;
          motes.positions[i * 3 + 2] = 0.5;
          motes.velocities[i * 2] = (Math.random() - 0.5) * 0.0006 * radius;
          motes.velocities[i * 2 + 1] = -(0.0004 + Math.random() * 0.0006) * radius;
        }
      }
      stepParticles(motes, ctx.dt, 0.995);
      motes.material.opacity = Math.sin(Math.PI * Math.min(1, t)) * 0.9;
    },
    dispose: () => {
      group.clear();
      ring.material.dispose();
      outer?.material.dispose();
      motes.points.geometry.dispose();
      motes.material.dispose();
    },
  };
}

/** Конус: волна «языков» пламени от вершины (лабораторный вариант №5) + дымка и ядро. */
/** Конус: игровой модуль пламени (общий с лабораторией) — вершина у кастера, языки внутри. */
function flameConeVisual(phase: FxPhase): Visual {
  const visual = createConeFlame({
    apex: (ctx: FrameCtx) => (phase.to ? ctx.resolve(phase.to) : null),
    angle: (ctx: FrameCtx) => {
      const at = phase.to ? ctx.resolve(phase.to) : null;
      const dir = phase.dir ? ctx.resolve(phase.dir) : null;
      return at && dir ? Math.atan2(dir.y - at.y, dir.x - at.x) : 0;
    },
    length: phase.radius ?? 50,
    color: phase.color,
  });
  return {
    group: visual.group,
    update: (t, ctx) => visual.update(t, ctx),
    dispose: () => visual.dispose(),
  };
}
function createVisual(phase: FxPhase): Visual {
  if (phase.kind === 'travel') return travelVisual(phase);
  if (phase.kind === 'burst') return burstVisual(phase);
  if (phase.kind === 'impact') return impactVisual(phase);
  if (phase.kind === 'shape') return phase.shape === 'line' ? beamVisual(phase) : flameConeVisual(phase);
  return auraVisual(phase);
}

interface ActiveFx {
  plan: FxPlan;
  startedAt: number;
  visuals: Visual[];
}

/**
 * Косметические эффекты применения (fx:play): three.js-оверлей над столом.
 * Координаты мира переводятся в экран каждый кадр — эффект «прилипает» к карте
 * при панораме/зуме. Очередь последовательная; у кастера старт отложен до конца
 * его анимации d20 (поле `notBefore`).
 */
export default function SpellFxOverlay({ mask }: { mask?: FxMask | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const maskRef = useRef<FxMask | null>(mask ?? null);
  maskRef.current = mask ?? null;

  // Вкладка в фоне: копить эффекты не нужно — при возврате они бы проиграли пачкой.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) useGameStore.getState().clearFxQueue();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', display: 'block' });
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -100, 100);
    camera.position.z = 10;
    const root = new THREE.Group();
    scene.add(root);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let active: ActiveFx | null = null;
    let last = performance.now();
    let lastW = 0;
    let lastH = 0;
    let raf = 0;
    let disposed = false;

    const resolve = (a: FxAnchor, map: MapInfo | null): WorldPoint | null => {
      if ('point' in a) return a.point;
      const token = tokenById(map, a.tokenId);
      return token ? { x: token.x, y: token.y } : null;
    };

    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(64, now - last);
      last = now;
      const state = useGameStore.getState();
      const { view, viewport } = state;
      const map = activeMapOf(state);

      if (viewport.w !== lastW || viewport.h !== lastH) {
        lastW = viewport.w;
        lastH = viewport.h;
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(lastW, lastH, false);
        renderer.domElement.style.width = `${lastW}px`;
        renderer.domElement.style.height = `${lastH}px`;
        camera.right = lastW;
        camera.bottom = lastH;
        camera.updateProjectionMatrix();
      }

      // Маска видимости: игрок видит эффект только в открытых клетках (DM — везде).
      const visibleMask = maskRef.current;
      const canvasEl = renderer.domElement;
      if (visibleMask) {
        const url = `url(${visibleMask.url})`;
        if (canvasEl.style.getPropertyValue('mask-image') !== url) {
          canvasEl.style.setProperty('mask-image', url);
          canvasEl.style.setProperty('-webkit-mask-image', url);
          canvasEl.style.setProperty('mask-repeat', 'no-repeat');
        }
        canvasEl.style.setProperty(
          'mask-size',
          `${visibleMask.width * view.scale}px ${visibleMask.height * view.scale}px`
        );
        canvasEl.style.setProperty(
          'mask-position',
          `${view.x + visibleMask.offsetX * view.scale}px ${view.y + visibleMask.offsetY * view.scale}px`
        );
      } else if (canvasEl.style.getPropertyValue('mask-image')) {
        canvasEl.style.removeProperty('mask-image');
        canvasEl.style.removeProperty('-webkit-mask-image');
        canvasEl.style.removeProperty('mask-size');
        canvasEl.style.removeProperty('mask-position');
      }

      // Следующий эффект очереди: чужую карту, reduced-motion и протухшие просто пропускаем.
      if (!active && state.fxQueue.length > 0) {
        const next = state.fxQueue[0]!;
        if (next.mapId !== state.scene.activeMapId || reduced || fxStale(next, now)) {
          state.dequeueFx(next.id);
        } else if (now >= next.notBefore && viewport.w > 0 && viewport.h > 0) {
          const plan = buildFxPlan(next, activeGridOf(state));
          const visuals = plan.phases.map(createVisual);
          visuals.forEach((visual) => root.add(visual.group));
          active = { plan, startedAt: now, visuals };
          state.dequeueFx(next.id);
        }
      }

      const ctx: FrameCtx = {
        dt,
        scale: view.scale,
        project: (p) => ({ x: view.x + p.x * view.scale, y: view.y + p.y * view.scale }),
        resolve: (a) => resolve(a, map),
      };

      if (active) {
        const elapsed = now - active.startedAt;
        for (let i = 0; i < active.plan.phases.length; i++) {
          const phase = active.plan.phases[i]!;
          active.visuals[i]!.update((elapsed - phase.at) / phase.dur, ctx);
        }
        if (elapsed >= active.plan.duration) {
          active.visuals.forEach((visual) => {
            root.remove(visual.group);
            visual.dispose();
          });
          active = null;
        }
      }

      if (active) renderer.render(scene, camera);
      else renderer.clear();
    };

    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (active) {
        active.visuals.forEach((visual) => {
          root.remove(visual.group);
          visual.dispose();
        });
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={ref} className="spell-fx" data-testid="spell-fx" />;
}
