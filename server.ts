import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// In-memory + temp disk storage for Encrypted Cloud Vault
const VAULT_DIR = path.join('/tmp', 'droplink-vault');
if (!fs.existsSync(VAULT_DIR)) {
  fs.mkdirSync(VAULT_DIR, { recursive: true });
}

// Increase body parser limits for large cloud uploads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

interface CloudFileMeta {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  isEncrypted: boolean;
  sha256?: string;
  senderName: string;
  senderOs: string;
  roomCode: string;
  createdAt: number;
  expiresAt: number;
  downloadCount: number;
  filePath: string;
}

const cloudFiles = new Map<string, CloudFileMeta>();

// Clean up expired vault files every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, meta] of cloudFiles.entries()) {
    if (meta.expiresAt <= now) {
      try {
        if (fs.existsSync(meta.filePath)) {
          fs.unlinkSync(meta.filePath);
        }
      } catch (err) {
        console.error('Error deleting expired file:', err);
      }
      cloudFiles.delete(id);
    }
  }
}, 10 * 60 * 1000);

// Cloud Vault API Endpoints
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/vault/files', (req: Request, res: Response) => {
  const room = (req.query.room as string) || 'global';
  const now = Date.now();
  const files = Array.from(cloudFiles.values())
    .filter((f) => f.expiresAt > now && (f.roomCode === room || f.roomCode === 'global'))
    .map(({ filePath, ...rest }) => rest);
  res.json({ files });
});

app.post('/api/vault/upload', (req: Request, res: Response) => {
  try {
    const { name, size, mimeType, isEncrypted, sha256, senderName, senderOs, roomCode, base64Data, expiryHours } = req.body;

    if (!name || !base64Data) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (name, base64Data)' });
    }

    const id = crypto.randomUUID();
    const filePath = path.join(VAULT_DIR, `${id}.bin`);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const hours = Number(expiryHours) || 24;
    const meta: CloudFileMeta = {
      id,
      name: String(name),
      size: Number(size) || buffer.length,
      mimeType: String(mimeType || 'application/octet-stream'),
      isEncrypted: Boolean(isEncrypted),
      sha256: sha256 ? String(sha256) : undefined,
      senderName: String(senderName || 'Anónimo'),
      senderOs: String(senderOs || 'unknown'),
      roomCode: String(roomCode || 'global'),
      createdAt: Date.now(),
      expiresAt: Date.now() + hours * 3600 * 1000,
      downloadCount: 0,
      filePath,
    };

    cloudFiles.set(id, meta);

    // Notify peers in the room about the new cloud file
    broadcastToRoom(meta.roomCode, {
      type: 'cloud_file_available',
      file: {
        id: meta.id,
        name: meta.name,
        size: meta.size,
        mimeType: meta.mimeType,
        isEncrypted: meta.isEncrypted,
        sha256: meta.sha256,
        senderName: meta.senderName,
        senderOs: meta.senderOs,
        roomCode: meta.roomCode,
        createdAt: meta.createdAt,
        expiresAt: meta.expiresAt,
        downloadCount: meta.downloadCount,
      },
    });

    const { filePath: _, ...safeMeta } = meta;
    res.json({ success: true, file: safeMeta });
  } catch (err: any) {
    console.error('Vault upload error:', err);
    res.status(500).json({ error: err.message || 'Error al guardar archivo en la nube' });
  }
});

app.get('/api/vault/download/:id', (req: Request, res: Response) => {
  const meta = cloudFiles.get(req.params.id);
  if (!meta || meta.expiresAt <= Date.now()) {
    return res.status(404).send('Archivo no encontrado o expirado');
  }

  if (!fs.existsSync(meta.filePath)) {
    cloudFiles.delete(req.params.id);
    return res.status(404).send('Archivo físico no encontrado');
  }

  meta.downloadCount += 1;
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.name)}"`);
  res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', meta.size);

  const stream = fs.createReadStream(meta.filePath);
  stream.pipe(res);
});

app.delete('/api/vault/files/:id', (req: Request, res: Response) => {
  const meta = cloudFiles.get(req.params.id);
  if (meta) {
    try {
      if (fs.existsSync(meta.filePath)) {
        fs.unlinkSync(meta.filePath);
      }
    } catch (err) {
      console.error(err);
    }
    cloudFiles.delete(req.params.id);
  }
  res.json({ success: true });
});

// WebSocket Signaling Server for WebRTC P2P AirDrop
interface Peer {
  ws: WebSocket;
  peerId: string;
  name: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  os: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'other';
  roomCode: string;
  joinedAt: number;
}

const peers = new Map<string, Peer>();

const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastToRoom(roomCode: string, message: any, excludePeerId?: string) {
  const payload = JSON.stringify(message);
  for (const [peerId, peer] of peers.entries()) {
    if (peer.roomCode === roomCode && peerId !== excludePeerId && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(payload);
    }
  }
}

function getRoomPeers(roomCode: string) {
  const list: any[] = [];
  for (const [peerId, peer] of peers.entries()) {
    if (peer.roomCode === roomCode && peer.ws.readyState === WebSocket.OPEN) {
      list.push({
        peerId,
        name: peer.name,
        deviceType: peer.deviceType,
        os: peer.os,
        roomCode: peer.roomCode,
        joinedAt: peer.joinedAt,
      });
    }
  }
  return list;
}

wss.on('connection', (ws: WebSocket) => {
  let currentPeerId = '';
  let currentRoom = 'global';

  ws.on('message', (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'join': {
          currentPeerId = msg.peerId;
          currentRoom = msg.roomCode || 'global';

          peers.set(currentPeerId, {
            ws,
            peerId: currentPeerId,
            name: msg.name || 'Dispositivo Desconocido',
            deviceType: msg.deviceType || 'desktop',
            os: msg.os || 'other',
            roomCode: currentRoom,
            joinedAt: Date.now(),
          });

          // Send current peers list to the newly connected peer
          ws.send(
            JSON.stringify({
              type: 'room_state',
              peers: getRoomPeers(currentRoom).filter((p) => p.peerId !== currentPeerId),
              roomCode: currentRoom,
            })
          );

          // Notify other peers in this room
          broadcastToRoom(
            currentRoom,
            {
              type: 'peer_joined',
              peer: {
                peerId: currentPeerId,
                name: msg.name,
                deviceType: msg.deviceType,
                os: msg.os,
                roomCode: currentRoom,
              },
            },
            currentPeerId
          );
          break;
        }

        case 'update_profile': {
          const peer = peers.get(currentPeerId);
          if (peer) {
            peer.name = msg.name || peer.name;
            peer.deviceType = msg.deviceType || peer.deviceType;
            broadcastToRoom(
              currentRoom,
              {
                type: 'peer_updated',
                peer: {
                  peerId: currentPeerId,
                  name: peer.name,
                  deviceType: peer.deviceType,
                  os: peer.os,
                  roomCode: currentRoom,
                },
              },
              currentPeerId
            );
          }
          break;
        }

        // WebRTC Signaling: offer, answer, ice-candidate
        case 'signal': {
          const targetPeer = peers.get(msg.targetPeerId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            targetPeer.ws.send(
              JSON.stringify({
                type: 'signal',
                fromPeerId: currentPeerId,
                signalData: msg.signalData,
              })
            );
          }
          break;
        }

        // Transfer Request (AirDrop accept/decline dialogue)
        case 'transfer_request': {
          const targetPeer = peers.get(msg.targetPeerId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            targetPeer.ws.send(
              JSON.stringify({
                type: 'transfer_request',
                fromPeerId: currentPeerId,
                sender: {
                  name: msg.senderName,
                  os: msg.senderOs,
                  deviceType: msg.senderDeviceType,
                },
                transferId: msg.transferId,
                files: msg.files, // array of { name, size, type, sha256 }
                totalSize: msg.totalSize,
                isEncrypted: msg.isEncrypted,
                authFingerprint: msg.authFingerprint,
              })
            );
          }
          break;
        }

        // Transfer Response (accepted or declined by recipient)
        case 'transfer_response': {
          const targetPeer = peers.get(msg.targetPeerId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            targetPeer.ws.send(
              JSON.stringify({
                type: 'transfer_response',
                fromPeerId: currentPeerId,
                transferId: msg.transferId,
                accepted: msg.accepted,
                reason: msg.reason,
              })
            );
          }
          break;
        }

        // Fallback relay data (if WebRTC direct fails or peer requests relay)
        case 'relay_chunk': {
          const targetPeer = peers.get(msg.targetPeerId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            targetPeer.ws.send(
              JSON.stringify({
                type: 'relay_chunk',
                fromPeerId: currentPeerId,
                transferId: msg.transferId,
                fileIndex: msg.fileIndex,
                chunkIndex: msg.chunkIndex,
                totalChunks: msg.totalChunks,
                data: msg.data,
              })
            );
          }
          break;
        }

        case 'transfer_cancel': {
          const targetPeer = peers.get(msg.targetPeerId);
          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            targetPeer.ws.send(
              JSON.stringify({
                type: 'transfer_cancel',
                fromPeerId: currentPeerId,
                transferId: msg.transferId,
              })
            );
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', () => {
    if (currentPeerId) {
      peers.delete(currentPeerId);
      broadcastToRoom(currentRoom, {
        type: 'peer_left',
        peerId: currentPeerId,
      });
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
  });
});

// Vite dev server mounting in development, or static hosting in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`DropLink P2P Server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
