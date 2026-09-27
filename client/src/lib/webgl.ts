import * as THREE from 'three';

/**
 * Создание WebGL-рендерера с деградацией: в части окружений (Firefox без аппаратного
 * ускорения, RDP-сессия, драйверы) контекст не создаётся вовсе. Тогда 3D-слой
 * (эффекты заклинаний, d20) молча отключается, а интерфейс продолжает работать.
 */
let unavailable = false;

export function webglUnavailable(): boolean {
  return unavailable;
}

export function createWebGLRenderer(params: THREE.WebGLRendererParameters): THREE.WebGLRenderer | null {
  if (unavailable) return null;
  try {
    return new THREE.WebGLRenderer(params);
  } catch (error) {
    unavailable = true;
    console.warn('WebGL недоступен — 3D-эффекты отключены', error);
    return null;
  }
}
