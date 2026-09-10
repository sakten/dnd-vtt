import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from 'shared';
import { RoomManager } from './rooms';
import { registerSocket } from './socket';
import { HERE, UPLOADS_DIR, ensureDirs } from './store';

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

app.use((_req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
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
    const roomCode = req.header('x-room') ?? '';
    const playerId = req.header('x-player') ?? '';
    const room = manager.get(roomCode);
    if (!room || !room.players.some((p) => p.id === playerId)) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }
    next();
  },
  upload.single('image'),
  (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не получен или недопустимый формат' });
      return;
    }
    res.json({ url: `/uploads/${req.file.filename}` });
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

server.listen(PORT, () => {
  console.log(`VTT server listening on http://localhost:${PORT}`);
});
