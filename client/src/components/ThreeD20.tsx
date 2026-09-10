import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const COLS = 5;
const ROWS = 4;

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

function buildAtlas(): THREE.CanvasTexture {
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
      g.addColorStop(0, '#ffefb8');
      g.addColorStop(0.65, '#f0c04a');
      g.addColorStop(1, '#c8912a');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cell, cell);
      ctx.fillStyle = '#3a2504';
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
      const d = new THREE.Vector3().subVectors(verts[k], centroid);
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

export default function ThreeD20() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const { geometry, normals, ups } = buildGeometry();
    const atlas = buildAtlas();
    const material = new THREE.MeshStandardMaterial({
      map: atlas,
      metalness: 0.35,
      roughness: 0.32,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const scene = new THREE.Scene();
    scene.add(mesh);
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

    const idx = normals.length - 1;
    const n = normals[idx];
    const up = ups[idx];
    const right = up.clone().cross(n).normalize();
    const basis = new THREE.Matrix4().set(
      right.x, right.y, right.z, 0,
      up.x, up.y, up.z, 0,
      n.x, n.y, n.z, 0,
      0, 0, 0, 1
    );
    const qFinal = new THREE.Quaternion().setFromRotationMatrix(basis);
    const qStart = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0.4, 0.2).normalize(), 0.5);
    const halfH = Math.tan(((40 / 2) * Math.PI) / 180) * camera.position.z;
    const baseY = 0.4;

    const apply = (prog: number) => {
      const decay = Math.pow(1 - prog, 3);
      const spin = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI * 2 * 2 * decay)
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * 2 * 1.5 * decay)
        );
      const qo = qStart.clone().slerp(qFinal, easeInOut(prog));
      mesh.quaternion.copy(spin.multiply(qo));

      const fall = Math.min(1, prog / 0.78);
      const dropEase = 1 - Math.pow(1 - fall, 3);
      let y = baseY + (halfH + 1.3 - baseY) * (1 - dropEase);
      if (prog > 0.78) y = baseY + (halfH + 1.3) * 0.04 * Math.sin(((prog - 0.78) / 0.22) * Math.PI);
      mesh.position.y = y;

      renderer.render(scene, camera);
    };

    let raf = 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply(1);
    } else {
      const start = performance.now();
      const duration = 1500;
      const frame = (now: number) => {
        const prog = Math.min(1, (now - start) / duration);
        apply(prog);
        if (prog < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      geometry.dispose();
      material.dispose();
      atlas.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={ref} className="crit-three" />;
}
