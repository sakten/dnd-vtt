import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from 'shared';
import { RoomManager, roomUploadUrls } from './rooms';
import type { Room } from './roomTypes';
import { registerSocket } from './socket';
import { HERE, UPLOADS_DIR, dirSize, ensureDirs, flatUploadSize, flushRoomSaves, roomUploadDir } from './store';
import { ROOM_QUOTA_BYTES, ROOM_QUOTA_MB } from './config';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_DIST = path.resolve(HERE, '../../client/dist');

await ensureDirs();

const app = express();
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  maxHttpBufferSize: 1e7,
});

const manager = new RoomManager();
await manager.init();
registerSocket(io, manager);

process.on('uncaughtException', (err) => console.error('uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));

const shutdown = async () => {
  await flushRoomSaves();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
server.on('error', (err) => console.error('server error:', err));

async function isValidImage(filePath: string): Promise<boolean> {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    await handle.read(buf, 0, 12, 0);
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
    const head6 = buf.toString('ascii', 0, 6);
    if (head6 === 'GIF87a' || head6 === 'GIF89a') return true;
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true;
    return false;
  } finally {
    await handle.close();
  }
}

app.use((_req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

function roomCodeOf(req: express.Request): string {
  return (req.header('x-room') ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

async function roomUploadsSize(code: string, room: Room): Promise<number> {
  let total = await dirSize(roomUploadDir(code));
  for (const url of new Set(roomUploadUrls(room))) total += await flatUploadSize(url);
  return total;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = roomUploadDir(roomCodeOf(req));
    fsp.mkdir(dir, { recursive: true }).then(
      () => cb(null, dir),
      (err) => cb(err as Error, dir)
    );
  },
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /\.(png|jpe?g|webp|gif)$/i.test(file.originalname));
  },
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post(
  '/api/upload',
  (req, res, next) => {
    const roomCode = roomCodeOf(req);
    const playerId = req.header('x-player') ?? '';
    const room = manager.get(roomCode);
    if (!room || !room.players.some((p) => p.id === playerId)) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }
    next();
  },
  upload.single('image'),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не получен или недопустимый формат' });
      return;
    }
    if (!(await isValidImage(req.file.path))) {
      await fsp.unlink(req.file.path).catch(() => void 0);
      res.status(400).json({ error: 'Файл не является изображением' });
      return;
    }
    const roomCode = roomCodeOf(req);
    const room = manager.get(roomCode);
    if (room && (await roomUploadsSize(roomCode, room)) > ROOM_QUOTA_BYTES) {
      await fsp.unlink(req.file.path).catch(() => void 0);
      res.status(413).json({ error: `Превышен лимит загрузок комнаты (${ROOM_QUOTA_MB} МБ)` });
      return;
    }
    res.json({ url: `/uploads/${roomCode}/${req.file.filename}` });
  }
);

app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    next();
  },
  express.static(UPLOADS_DIR)
);
app.use(express.static(CLIENT_DIST));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/socket.io/')) {
    next();
    return;
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status =
    (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode ??
    500;
  console.error('http error:', err);
  res.status(status).json({ error: 'Ошибка запроса' });
});

server.listen(PORT, () => {
  console.log(`VTT server listening on http://localhost:${PORT}`);
});
