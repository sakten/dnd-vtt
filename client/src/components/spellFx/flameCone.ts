import * as THREE from 'three';
import { coneTex, glowTex, tongueTex } from './textures';

export interface FlamePoint {
  x: number;
  y: number;
}

/** Минимальный кадровый контекст: масштаб и перевод мировых координат в экран. */
export interface FlameCtx {
  scale: number;
  project: (p: FlamePoint) => FlamePoint;
}

export interface ConeFlameSource<C extends FlameCtx = FlameCtx> {
  /** Мировая точка вершины конуса (обычно руки кастера); null — скрыть эффект. */
  apex: (ctx: C) => FlamePoint | null;
  /** Направление конуса (радианы, экранная ось Y вниз). */
  angle: (ctx: C) => number;
  /** Длина конуса в мировых px. */
  length: number;
  color: string;
}

export interface FlameVisual<C extends FlameCtx = FlameCtx> {
  group: THREE.Group;
  update: (t: number, ctx: C) => void;
  dispose: () => void;
}

function plane(tex: THREE.Texture, color: string): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const material = new THREE.MeshBasicMaterial({
    map: tex,
    color,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Конус пламени: статичная яркая область (вершина у кастера, раскрыв в сторону прицела)
 * и летящие внутри языки огня. Общий код для игры и лаборатории.
 */
export function createConeFlame<C extends FlameCtx>(source: ConeFlameSource<C>): FlameVisual<C> {
  const group = new THREE.Group();
  const wash = plane(coneTex, source.color);
  const core = plane(glowTex, '#fff6d8');
  group.add(wash, core);

  const COUNT = 54;
  const halfAngle = Math.atan(0.5);
  const colorDeep = new THREE.Color(source.color);
  const colorMid = colorDeep.clone().lerp(new THREE.Color('#ffffff'), 0.35);
  const colorCore = colorDeep.clone().lerp(new THREE.Color('#ffffff'), 0.82);
  const tongues = Array.from({ length: COUNT }, (_, i) => {
    const mesh = plane(tongueTex, source.color);
    group.add(mesh);
    return {
      mesh,
      angle: (Math.random() * 2 - 1) * halfAngle * 0.92,
      speed: 0.12 + Math.random() * 0.07,
      spawn: (i / COUNT) * 0.4 + Math.random() * 0.06,
      size: 18 + Math.random() * 26,
      curl: Math.random() * 2 - 1,
    };
  });

  return {
    group,
    update: (t, ctx) => {
      if (t < 0 || t > 1) {
        group.visible = false;
        return;
      }
      const at = source.apex(ctx);
      if (!at) {
        group.visible = false;
        return;
      }
      group.visible = true;
      const anchor = ctx.project(at);
      const angle = source.angle(ctx);
      const lenWorld = source.length;
      const lenScreen = lenWorld * ctx.scale;
      const fade = t < 0.68 ? 1 : Math.max(0, 1 - (t - 0.68) / 0.32);

      // Дымка — сразу вся область, без роста: конус стоит на месте, движутся только языки.
      const w = lenScreen;
      const ca = Math.cos(-angle);
      const sa = Math.sin(-angle);
      const lx = -0.5 * w;
      wash.rotation.z = angle;
      wash.scale.set(w, w, 1);
      wash.position.set(anchor.x - lx * ca, anchor.y + lx * sa, 0.4);
      wash.material.opacity = 0.38 * Math.min(1, t / 0.08) * fade;
      const coreSize = 86 * ctx.scale * (0.92 + 0.08 * Math.sin(t * 30));
      core.position.set(anchor.x, anchor.y, 0.5);
      core.scale.set(coreSize, coreSize, 1);
      core.material.opacity = 0.85 * fade;

      for (const g of tongues) {
        const age = (t - g.spawn) / 0.55;
        const material = g.mesh.material;
        if (age <= 0 || age >= 1) {
          material.opacity = 0;
          continue;
        }
        // Языки летят по конусу от вершины к основанию; за основание не выходят.
        const raw = (g.speed / 0.1) * lenWorld * (age - age * age * 0.35);
        const dist = Math.min(lenWorld, raw);
        const edge = Math.max(0, 1 - Math.max(0, (raw - lenWorld * 0.85) / (lenWorld * 0.3)));
        const lateral = g.curl * 0.16 * lenWorld * age * age;
        const ta = angle + g.angle;
        const wx = at.x + Math.cos(ta) * dist - Math.sin(ta) * lateral;
        const wy = at.y + Math.sin(ta) * dist + Math.cos(ta) * lateral;
        const screen = ctx.project({ x: wx, y: wy });
        g.mesh.position.set(screen.x, screen.y, 0.55);
        g.mesh.rotation.z = ta + g.curl * age * 0.4;
        const reach = 0.5 + 0.9 * Math.min(1, dist / lenWorld);
        const size = g.size * reach * Math.sin(Math.PI * age) ** 0.6 * ctx.scale;
        g.mesh.scale.set(size * 0.5, size, 1);
        material.opacity = Math.sin(Math.PI * age) * 0.85 * fade * edge;
        if (age < 0.35) material.color.copy(colorCore).lerp(colorMid, age / 0.35);
        else material.color.copy(colorMid).lerp(colorDeep, (age - 0.35) / 0.65);
      }
    },
    dispose: () => {
      group.clear();
      wash.geometry.dispose();
      wash.material.dispose();
      core.geometry.dispose();
      core.material.dispose();
      tongues.forEach((g) => {
        g.mesh.geometry.dispose();
        g.mesh.material.dispose();
      });
    },
  };
}
