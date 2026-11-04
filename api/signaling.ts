// Vercel Serverless Function for WebRTC signaling (Fallback when WebSockets are unavailable)
import type { Request, Response } from 'express';

interface HttpPeer {
  peerId: string;
  name: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  os: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'other';
  roomCode: string;
  lastSeen: number;
}

// In-memory store on lambda container
const httpPeers = new Map<string, HttpPeer>();
const messageQueues = new Map<string, any[]>();

export default function handler(req: any, res: any) {
  // Enable CORS for Vercel deployments
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const now = Date.now();

  // Clean stale peers
  for (const [id, p] of httpPeers.entries()) {
    if (now - p.lastSeen > 35000) {
      httpPeers.delete(id);
      messageQueues.delete(id);
    }
  }

  if (url.includes('/heartbeat') && req.method === 'POST') {
    const { peerId, name, deviceType, os, roomCode } = req.body || {};
    if (!peerId) return res.status(400).json({ error: 'peerId required' });
    httpPeers.set(peerId, {
      peerId,
      name: name || 'Dispositivo',
      deviceType: deviceType || 'desktop',
      os: os || 'other',
      roomCode: roomCode || 'global',
      lastSeen: now,
    });
    return res.json({ ok: true });
  }

  if (url.includes('/peers') && req.method === 'GET') {
    const room = (req.query?.room as string) || 'global';
    const active: HttpPeer[] = [];
    for (const p of httpPeers.values()) {
      if (now - p.lastSeen < 15000 && p.roomCode === room) {
        active.push(p);
      }
    }
    return res.json({ peers: active });
  }

  if (url.includes('/send') && req.method === 'POST') {
    const { targetPeerId, message } = req.body || {};
    if (!targetPeerId || !message) {
      return res.status(400).json({ error: 'targetPeerId and message required' });
    }
    if (!messageQueues.has(targetPeerId)) {
      messageQueues.set(targetPeerId, []);
    }
    messageQueues.get(targetPeerId)!.push(message);
    return res.json({ deliveredVia: 'queue' });
  }

  if (url.includes('/poll') && req.method === 'GET') {
    const peerId = req.query?.peerId as string;
    if (!peerId) return res.status(400).json({ error: 'peerId required' });
    const peer = httpPeers.get(peerId);
    if (peer) peer.lastSeen = now;

    const queue = messageQueues.get(peerId) || [];
    messageQueues.set(peerId, []);
    return res.json({ messages: queue });
  }

  return res.json({ status: 'signaling_active', time: now });
}
