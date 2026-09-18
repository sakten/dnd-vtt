import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const COLS = 5;
const ROWS = 4;

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

interface DicePalette {
  light: string;
  mid: string;
  dark: string;
  ink: string;
}

const CRIT_PALETTE: DicePalette = { light: '#ffefb8', mid: '#f0c04a', dark: '#c8912a', ink: '#3a2504' };
/** Ручной бросок: приглушённый серый камень, без золотого блеска. */
const ROLL_PALETTE: DicePalette = { light: '#d7d8dc', mid: '#92949c', dark: '#5f6169', ink: '#25262b' };

function buildAtlas(palette: DicePalette): THREE.CanvasTexture {
  const cell = 128;
  const canvas = document.createElement('canvas');
  canvas.width = COLS * cell;
  canvas.height = ROWS * cell;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let i = 0; i < 20; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * cell;
      const y = row * cell;
      const g = ctx.createRadialGradient(x + cell / 2, y + cell / 2, cell * 0.08, x + cell / 2, y + cell / 2, cell * 0.52);
      g.addColorStop(0, palette.light);
      g.addColorStop(0.65, palette.mid);
      g.addColorStop(1, palette.dark);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cell, cell);
      ctx.fillStyle = palette.ink;
      ctx.font = `800 ${Math.round(cell * 0.44)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x + cell / 2, y + cell / 2 + cell * 0.02);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

interface BuiltGeometry {
  geometry: THREE.BufferGeometry;
  normals: THREE.Vector3[];
  ups: THREE.Vector3[];
}

function buildGeometry(): BuiltGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const pos = geometry.getAttribute('position');
  const count = pos.count;
  const faces = count / 3;
  const uv = new Float32Array(count * 2);
  const normals: THREE.Vector3[] = [];
  const ups: THREE.Vector3[] = [];
  const S = 1.15;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  for (let f = 0; f < faces; f++) {
    const i0 = f * 3;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i0 + 1);
    c.fromBufferAttribute(pos, i0 + 2);
    const centroid = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    if (n.dot(centroid) < 0) n.negate();
    const up = new THREE.Vector3().subVectors(a, centroid);
    up.addScaledVector(n, -up.dot(n)).normalize();
    const right = new THREE.Vector3().copy(up).cross(n).normalize();
    normals.push(n.clone());
    ups.push(up.clone());

    const col = f % COLS;
    const row = Math.floor(f / COLS);
    const verts = [a, b, c];
    for (let k = 0; k < 3; k++) {
      const d = new THREE.Vector3().subVectors(verts[k]!, centroid);
      const cu = 0.5 + d.dot(right) * S;
      const cv = 0.5 + d.dot(up) * S;
      uv[(i0 + k) * 2] = (col + cu) / COLS;
      uv[(i0 + k) * 2 + 1] = 1 - (row + 1 - cv) / ROWS;
    }
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return { geometry, normals, ups };
}

/** Кубик в наборе: значение и признак «взятый» (при преимуществе/помехе). */
export interface DiceRollFace {
  value: number;
  kept: boolean;
}

interface DieState {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  face: DiceRollFace;
  baseScale: number;
  qFinal: THREE.Quaternion;
  qStart: THREE.Quaternion;
  spinAxis: THREE.Vector3;
  spinTurns: number;
  startX: number;
  endX: number;
  startHeight: number;
  bounceAmp: number;
  bounceCount: number;
  bouncePhase: number;
}

export default function ThreeD20({
  value = 20,
  variant = 'crit',
  rolls,
}: {
  value?: number;
  /** `crit` — золотой падает сверху (крит-оверлей), `roll` — серый катится по экрану. */
  variant?: 'crit' | 'roll';
  /** Набор кубиков (преимущество/помеха): отброшенные тускнеют, взятый подсвечен. */
  rolls?: DiceRollFace[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const faces: DiceRollFace[] =
      variant === 'roll' && rolls && rolls.length > 0 ? rolls : [{ value, kept: true }];
    const multi = faces.length > 1;

    const { geometry, normals, ups } = buildGeometry();
    const atlas = buildAtlas(variant === 'roll' ? ROLL_PALETTE : CRIT_PALETTE);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff0c8, 2.2);
    key.position.set(2.5, 3.5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffb040, 1.1);
    rim.position.set(-3, -1, 2);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const halfH = Math.tan(((40 / 2) * Math.PI) / 180) * camera.position.z;
    const halfW = halfH * camera.aspect;
    const baseY = 0.4;

    const materials: THREE.MeshStandardMaterial[] = [];
    const dice: DieState[] = faces.map((face, i) => {
      const material = new THREE.MeshStandardMaterial({
        map: atlas,
        metalness: 0.35,
        roughness: 0.32,
        flatShading: true,
        // Отброшенному прозрачность включаем заранее (opacity анимируем после приземления).
        ...(multi && !face.kept ? { transparent: true, opacity: 1 } : {}),
      });
      materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      const baseScale = variant === 'roll' ? 0.6 : 1;
      mesh.scale.setScalar(baseScale);
      scene.add(mesh);

      const idx = Math.min(normals.length - 1, Math.max(0, Math.round(face.value) - 1));
      const n = normals[idx]!;
      const up = ups[idx]!;
      const right = up.clone().cross(n).normalize();
      const basis = new THREE.Matrix4().set(
        right.x, right.y, right.z, 0,
        up.x, up.y, up.z, 0,
        n.x, n.y, n.z, 0,
        0, 0, 0, 1
      );

      const qStart =
        variant === 'roll'
          ? new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(),
              rand(0, Math.PI * 2)
            )
          : new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0.4, 0.2).normalize(), 0.5);

      // Преимущество/помеха: кубики летят с противоположных сторон и ложатся рядом.
      const dir = multi ? (i % 2 === 0 ? 1 : -1) : Math.random() < 0.5 ? -1 : 1;
      const spacing = halfH * 0.42;
      const endX = multi
        ? (i - (faces.length - 1) / 2) * spacing
        : dir * halfW * rand(0.32, 0.38);

      return {
        mesh,
        material,
        face,
        baseScale,
        qFinal: new THREE.Quaternion().setFromRotationMatrix(basis),
        qStart,
        spinAxis: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(),
        spinTurns: rand(3.6, 4.4),
        startX: -dir * (halfW + 1),
        endX,
        startHeight: halfH * rand(0.58, 0.72),
        bounceAmp: halfH * rand(0.28, 0.32),
        bounceCount: rand(2.7, 3.3),
        bouncePhase: rand(0, Math.PI),
      };
    });

    /** Доля времени на полёт по столу (лаборатория, №12 «Совсем поздний, плавный»). */
    const travel = rand(0.84, 0.88);
    /** Вращение гаснет поздно: доворот на грань длится до самого конца, без рывка. */
    const settle = rand(0.93, 0.96);

    /**
     * Кубики с преимуществом/помехой: после приземления взятый делает лёгкий «пульс»,
     * отброшенный постепенно растворяется. `em` — прогресс финальной фазы (0…1).
     */
    const emphasis = multi && dice.some((d) => !d.face.kept);

    const apply = (prog: number, em = 0) => {
      for (const die of dice) {
        const pulse = die.face.kept && em > 0 ? 1 + 0.16 * Math.sin(Math.PI * em) : 1;
        die.mesh.scale.setScalar(die.baseScale * pulse);
        if (!die.face.kept && em > 0) {
          die.material.opacity = 1 - em;
          die.mesh.visible = em < 1;
        }
        const spinLeft = Math.max(0, 1 - prog / settle);
        const spin =
          variant === 'roll'
            ? new THREE.Quaternion().setFromAxisAngle(
                die.spinAxis,
                Math.PI * 2 * die.spinTurns * Math.pow(spinLeft, 3.5)
              )
            : new THREE.Quaternion()
                .setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI * 2 * 2 * Math.pow(1 - prog, 3))
                .multiply(
                  new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(1, 0, 0),
                    Math.PI * 2 * 1.5 * Math.pow(1 - prog, 3)
                  )
                );
        const align = variant === 'roll' ? easeInOut(Math.min(1, prog / settle)) : easeInOut(prog);
        const qo = die.qStart.clone().slerp(die.qFinal, align);
        die.mesh.quaternion.copy(spin.multiply(qo));

        if (variant === 'roll') {
          // Торможение по постоянному трению (квадратичный закон), движение до `travel`.
          const fly = Math.min(1, prog / travel);
          const ease = 1 - Math.pow(1 - fly, 2);
          die.mesh.position.x = die.startX + (die.endX - die.startX) * ease;
          const fall = Math.min(1, prog / 0.5);
          const dropEase = 1 - Math.pow(1 - fall, 3);
          const bounceWindow = Math.pow(Math.max(0, 1 - prog / travel), 1.4);
          const bounce =
            Math.abs(Math.sin(prog * Math.PI * die.bounceCount + die.bouncePhase)) * bounceWindow * die.bounceAmp;
          die.mesh.position.y = baseY + die.startHeight * (1 - dropEase) + bounce;
        } else {
          const fall = Math.min(1, prog / 0.78);
          const dropEase = 1 - Math.pow(1 - fall, 3);
          let y = baseY + (halfH + 1.3 - baseY) * (1 - dropEase);
          if (prog > 0.78) y = baseY + (halfH + 1.3) * 0.04 * Math.sin(((prog - 0.78) / 0.22) * Math.PI);
          die.mesh.position.y = y;
        }
      }

      renderer.render(scene, camera);
    };

    /** Полёт 1500 мс; с преимуществом/помехой — пауза и финал «пульс + растворение». */
    const flightMs = 1500;
    const holdMs = 300;
    const emphasisMs = 650;
    const totalMs = flightMs + (emphasis ? holdMs + emphasisMs : 0);

    let raf = 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply(1, emphasis ? 1 : 0);
    } else {
      const start = performance.now();
      const frame = (now: number) => {
        const elapsed = now - start;
        const prog = Math.min(1, elapsed / flightMs);
        const em = emphasis ? Math.min(1, Math.max(0, (elapsed - flightMs - holdMs) / emphasisMs)) : 0;
        apply(prog, em);
        if (elapsed < totalMs) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      geometry.dispose();
      for (const material of materials) material.dispose();
      atlas.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [value, variant, rolls]);

  return <div ref={ref} className="crit-three" />;
}
