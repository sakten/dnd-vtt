import { useGameStore } from '../store/useGameStore';

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  const { roomCode, selfId } = useGameStore.getState();
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: form,
    headers: roomCode ? { 'X-Room': roomCode, 'X-Player': selfId ?? '' } : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? 'Не удалось загрузить изображение');
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export function readImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = url;
  });
}
