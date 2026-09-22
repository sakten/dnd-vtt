import { t } from '../i18n';
import { useGameStore } from '../store/useGameStore';

export async function uploadImage(file: File, kind?: 'map'): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  const { roomCode, selfId } = useGameStore.getState();
  const res = await fetch(kind === 'map' ? '/api/upload?kind=map' : '/api/upload', {
    method: 'POST',
    body: form,
    headers: roomCode ? { 'X-Room': roomCode, 'X-Player': selfId ?? '' } : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? t('ui.api.loadImageError'));
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export function readImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error(t('ui.api.readImageError')));
    img.src = url;
  });
}
