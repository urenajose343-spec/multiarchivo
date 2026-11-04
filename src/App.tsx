import React, { useState, useEffect, useRef } from 'react';
import {
  DeviceOS,
  DeviceType,
  PeerInfo,
  TransferSession,
  IncomingTransferRequest,
} from './types';
import {
  detectDevice,
  getOrCreatePeerId,
  getStoredDeviceName,
  setStoredDeviceName,
} from './utils/device';
import {
  playRadarPing,
  playRequestChime,
  playSuccessChime,
  playCancelTone,
  getMuted,
  setMuted,
} from './utils/audio';
import { WebRTCConnection, CHUNK_SIZE } from './utils/webrtcClient';
import { SimpleHeader } from './components/SimpleHeader';
import { SimpleDeviceRadar } from './components/SimpleDeviceRadar';
import { SimpleTransferCard } from './components/SimpleTransferCard';
import { SimpleIncomingModal } from './components/SimpleIncomingModal';
import { SimpleQRModal } from './components/SimpleQRModal';
import { UploadCloud } from 'lucide-react';

export default function App() {
  // Device Detection & Stored Name
  const [deviceInfo] = useState(() => detectDevice());
  const [peerId] = useState(() => getOrCreatePeerId());
  const [deviceName, setDeviceName] = useState(() =>
    getStoredDeviceName(deviceInfo.defaultName)
  );

  // Room code: default to 'global' so any two devices opening the link connect immediately!
  const [roomCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam && roomParam.trim()) {
        return roomParam.trim().toUpperCase();
      }
    }
    return 'global';
  });

  // State
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [isMutedState, setIsMutedState] = useState(() => getMuted());
  const [isQROpen, setIsQROpen] = useState(false);
  const [isDraggingOverScreen, setIsDraggingOverScreen] = useState(false);

  // Transfers
  const [transferSession, setTransferSession] = useState<TransferSession | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<IncomingTransferRequest | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const webrtcRef = useRef<WebRTCConnection | null>(null);
  const pendingFilesRef = useRef<File[]>([]);
  const targetPeerRef = useRef<PeerInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSessionRef = useRef<TransferSession | null>(null);
  activeSessionRef.current = transferSession;

  // Share URL for mobile QR pairing
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}${roomCode !== 'global' ? `?room=${encodeURIComponent(roomCode)}` : ''}`
    : '';

  // Sound toggle
  const handleToggleMute = () => {
    const next = !isMutedState;
    setIsMutedState(next);
    setMuted(next);
  };

  // Device name update
  const handleUpdateDeviceName = (newName: string) => {
    setDeviceName(newName);
    setStoredDeviceName(newName);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'update_profile',
          name: newName,
          deviceType: deviceInfo.deviceType,
        })
      );
    }
  };

  // WebSocket signaling
  useEffect(() => {
    let reconnectTimeout: any;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'join',
            peerId,
            name: deviceName,
            deviceType: deviceInfo.deviceType,
            os: deviceInfo.os,
            roomCode,
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'room_state': {
              setPeers(msg.peers || []);
              break;
            }

            case 'peer_joined': {
              if (msg.peer.peerId !== peerId) {
                setPeers((prev) => {
                  const filtered = prev.filter((p) => p.peerId !== msg.peer.peerId);
                  return [...filtered, msg.peer];
                });
                playRadarPing();
              }
              break;
            }

            case 'peer_updated': {
              setPeers((prev) =>
                prev.map((p) => (p.peerId === msg.peer.peerId ? { ...p, ...msg.peer } : p))
              );
              break;
            }

            case 'peer_left': {
              setPeers((prev) => prev.filter((p) => p.peerId !== msg.peerId));
              break;
            }

            case 'signal': {
              if (webrtcRef.current) {
                await webrtcRef.current.handleSignal(msg.signalData);
              }
              break;
            }

            case 'transfer_request': {
              setIncomingRequest({
                transferId: msg.transferId,
                fromPeerId: msg.fromPeerId,
                sender: msg.sender,
                files: msg.files,
                totalSize: msg.totalSize,
                isEncrypted: false,
                authFingerprint: '',
              });
              playRequestChime();
              break;
            }

            case 'transfer_response': {
              const current = activeSessionRef.current;
              if (current && current.id === msg.transferId) {
                if (msg.accepted) {
                  setTransferSession((prev) =>
                    prev ? { ...prev, status: 'connecting' } : null
                  );
                  startSendingFiles(current);
                } else {
                  setTransferSession((prev) =>
                    prev
                      ? {
                          ...prev,
                          status: 'rejected',
                          errorMessage: msg.reason || 'Rechazado',
                        }
                      : null
                  );
                  playCancelTone();
                }
              }
              break;
            }

            case 'relay_chunk': {
              // Fallback relay chunk receiver if WebRTC is bypassed
              handleRelayChunkReceived(msg);
              break;
            }

            case 'transfer_cancel': {
              const current = activeSessionRef.current;
              if (current && current.id === msg.transferId) {
                setTransferSession((prev) =>
                  prev ? { ...prev, status: 'cancelled' } : null
                );
                playCancelTone();
                if (webrtcRef.current) {
                  webrtcRef.current.close();
                  webrtcRef.current = null;
                }
              }
              if (incomingRequest && incomingRequest.transferId === msg.transferId) {
                setIncomingRequest(null);
                playCancelTone();
              }
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.error(err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [peerId, deviceName, deviceInfo, roomCode]);

  // Handle clicking a device to send files
  const handleDeviceClick = (peer: PeerInfo) => {
    targetPeerRef.current = peer;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle file picker selection
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && targetPeerRef.current) {
      initiateTransferWithFiles(targetPeerRef.current, Array.from(e.target.files));
    }
  };

  // Handle drag-and-drop directly onto a device
  const handleDropOnDevice = (peer: PeerInfo, fileList: FileList) => {
    if (fileList.length > 0) {
      initiateTransferWithFiles(peer, Array.from(fileList));
    }
  };

  // Initiate transfer request
  const initiateTransferWithFiles = (peer: PeerInfo, files: File[]) => {
    pendingFilesRef.current = files;
    const transferId = 'drop-' + Math.random().toString(36).substring(2, 9);
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);

    const filesMeta = files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream',
    }));

    const session: TransferSession = {
      id: transferId,
      direction: 'send',
      peerId: peer.peerId,
      peerName: peer.name,
      peerOs: peer.os,
      peerDeviceType: peer.deviceType,
      files: filesMeta,
      currentFileIndex: 0,
      totalSize,
      transferredBytes: 0,
      speedBps: 0,
      etaSeconds: 0,
      startTime: Date.now(),
      status: 'waiting_accept',
      isEncrypted: false,
      authFingerprint: '',
      transport: 'webrtc',
    };

    setTransferSession(session);

    // Send transfer request via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'transfer_request',
          targetPeerId: peer.peerId,
          transferId,
          senderName: deviceName,
          senderOs: deviceInfo.os,
          senderDeviceType: deviceInfo.deviceType,
          files: filesMeta,
          totalSize,
          isEncrypted: false,
        })
      );
    }
  };

  // Start sending files over WebRTC (with automatic relay fallback)
  const startSendingFiles = async (session: TransferSession) => {
    const files = pendingFilesRef.current;
    if (files.length === 0) return;

    let webrtcConnected = false;

    const webrtc = new WebRTCConnection(session.peerId, true, {
      onSignal: (signalData) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'signal',
              targetPeerId: session.peerId,
              signalData,
            })
          );
        }
      },
      onChannelOpen: async () => {
        webrtcConnected = true;
        setTransferSession((prev) =>
          prev ? { ...prev, status: 'transferring', startTime: Date.now() } : null
        );
        await streamFilesWebRTC(session, webrtc, files);
      },
      onChannelClose: () => {},
      onData: () => {},
      onError: (err) => {
        console.warn('WebRTC fallback to relay:', err);
      },
    });

    webrtcRef.current = webrtc;
    await webrtc.createOffer();

    // Fallback: If WebRTC DataChannel doesn't open within 3.2s, stream via WebSocket relay!
    setTimeout(async () => {
      if (!webrtcConnected && activeSessionRef.current?.status === 'connecting') {
        console.log('Using WebSocket Relay fallback for guaranteed transfer');
        setTransferSession((prev) =>
          prev
            ? { ...prev, status: 'transferring', transport: 'relay', startTime: Date.now() }
            : null
        );
        await streamFilesRelay(session, files);
      }
    }, 3200);
  };

  // WebRTC Streamer
  const streamFilesWebRTC = async (
    session: TransferSession,
    webrtc: WebRTCConnection,
    files: File[]
  ) => {
    let totalBytesSent = 0;
    let lastTime = Date.now();
    let bytesSinceLastTime = 0;

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const file = files[fIdx];
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      webrtc.send(
        JSON.stringify({
          type: 'file_start',
          fileIndex: fIdx,
          totalFiles: files.length,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          totalChunks,
        })
      );

      let offset = 0;
      while (offset < file.size) {
        if (activeSessionRef.current?.status === 'cancelled') return;

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        webrtc.send(buffer);

        offset += CHUNK_SIZE;
        totalBytesSent += slice.size;
        bytesSinceLastTime += slice.size;

        const now = Date.now();
        const delta = (now - lastTime) / 1000;
        if (delta >= 0.25) {
          const speedBps = bytesSinceLastTime / delta;
          const remainingBytes = Math.max(0, session.totalSize - totalBytesSent);
          const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;

          setTransferSession((prev) =>
            prev
              ? {
                  ...prev,
                  currentFileIndex: fIdx,
                  transferredBytes: totalBytesSent,
                  speedBps,
                  etaSeconds,
                }
              : null
          );

          lastTime = now;
          bytesSinceLastTime = 0;
        }

        await webrtc.waitForDrain();
      }

      webrtc.send(
        JSON.stringify({
          type: 'file_end',
          fileIndex: fIdx,
        })
      );
    }

    setTransferSession((prev) =>
      prev
        ? {
            ...prev,
            status: 'completed',
            transferredBytes: session.totalSize,
            speedBps: 0,
            etaSeconds: 0,
          }
        : null
    );
    playSuccessChime();
  };

  // WebSocket Relay Streamer (Fallback)
  const streamFilesRelay = async (session: TransferSession, files: File[]) => {
    let totalBytesSent = 0;
    let lastTime = Date.now();
    let bytesSinceLastTime = 0;

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const file = files[fIdx];
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'relay_chunk',
            targetPeerId: session.peerId,
            transferId: session.id,
            fileIndex: fIdx,
            data: JSON.stringify({
              meta: true,
              name: file.name,
              size: file.size,
              mimeType: file.type || 'application/octet-stream',
              totalChunks,
            }),
          })
        );
      }

      let offset = 0;
      let chunkIdx = 0;

      while (offset < file.size) {
        if (activeSessionRef.current?.status === 'cancelled') return;

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        // Convert buffer to binary string
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'relay_chunk',
              targetPeerId: session.peerId,
              transferId: session.id,
              fileIndex: fIdx,
              chunkIndex: chunkIdx,
              totalChunks,
              data: base64,
            })
          );
        }

        offset += CHUNK_SIZE;
        chunkIdx++;
        totalBytesSent += slice.size;
        bytesSinceLastTime += slice.size;

        const now = Date.now();
        const delta = (now - lastTime) / 1000;
        if (delta >= 0.25) {
          const speedBps = bytesSinceLastTime / delta;
          const remainingBytes = Math.max(0, session.totalSize - totalBytesSent);
          const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;

          setTransferSession((prev) =>
            prev
              ? {
                  ...prev,
                  currentFileIndex: fIdx,
                  transferredBytes: totalBytesSent,
                  speedBps,
                  etaSeconds,
                }
              : null
          );

          lastTime = now;
          bytesSinceLastTime = 0;
        }

        await new Promise((r) => setTimeout(r, 12));
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'relay_chunk',
            targetPeerId: session.peerId,
            transferId: session.id,
            fileIndex: fIdx,
            data: JSON.stringify({ end: true }),
          })
        );
      }
    }

    setTransferSession((prev) =>
      prev
        ? {
            ...prev,
            status: 'completed',
            transferredBytes: session.totalSize,
            speedBps: 0,
            etaSeconds: 0,
          }
        : null
    );
    playSuccessChime();
  };

  // Receiver State Buffers
  const receiverBufferRef = useRef<{
    chunks: ArrayBuffer[];
    currentMeta: any;
    totalReceived: number;
    lastTime: number;
    bytesSinceLast: number;
  }>({
    chunks: [],
    currentMeta: null,
    totalReceived: 0,
    lastTime: Date.now(),
    bytesSinceLast: 0,
  });

  // Handle Accept Incoming Transfer
  const handleAcceptIncoming = () => {
    if (!incomingRequest) return;
    const req = incomingRequest;
    setIncomingRequest(null);

    receiverBufferRef.current = {
      chunks: [],
      currentMeta: null,
      totalReceived: 0,
      lastTime: Date.now(),
      bytesSinceLast: 0,
    };

    const newSession: TransferSession = {
      id: req.transferId,
      direction: 'receive',
      peerId: req.fromPeerId,
      peerName: req.sender.name,
      peerOs: req.sender.os,
      peerDeviceType: req.sender.deviceType,
      files: req.files,
      currentFileIndex: 0,
      totalSize: req.totalSize,
      transferredBytes: 0,
      speedBps: 0,
      etaSeconds: 0,
      startTime: Date.now(),
      status: 'connecting',
      isEncrypted: false,
      authFingerprint: '',
      transport: 'webrtc',
    };

    setTransferSession(newSession);

    // Setup receiver WebRTC
    const webrtc = new WebRTCConnection(req.fromPeerId, false, {
      onSignal: (signalData) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'signal',
              targetPeerId: req.fromPeerId,
              signalData,
            })
          );
        }
      },
      onChannelOpen: () => {
        setTransferSession((prev) =>
          prev ? { ...prev, status: 'transferring', startTime: Date.now() } : null
        );
      },
      onChannelClose: () => {},
      onData: (data) => {
        handleReceiverData(data, req);
      },
      onError: (err) => {
        console.warn('Receiver WebRTC error:', err);
      },
    });

    webrtcRef.current = webrtc;

    // Send accept response
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'transfer_response',
          targetPeerId: req.fromPeerId,
          transferId: req.transferId,
          accepted: true,
        })
      );
    }
  };

  // Handle data received on receiver channel
  const handleReceiverData = (data: string | ArrayBuffer, req: IncomingTransferRequest) => {
    const buf = receiverBufferRef.current;

    if (typeof data === 'string') {
      try {
        const meta = JSON.parse(data);
        if (meta.type === 'file_start') {
          buf.currentMeta = meta;
          buf.chunks = [];
          setTransferSession((prev) =>
            prev ? { ...prev, currentFileIndex: meta.fileIndex } : null
          );
        } else if (meta.type === 'file_end') {
          if (buf.currentMeta && buf.chunks.length > 0) {
            triggerFileDownload(buf.chunks, buf.currentMeta.name, buf.currentMeta.mimeType);
            buf.chunks = [];
          }

          if (buf.currentMeta && buf.currentMeta.fileIndex === req.files.length - 1) {
            setTransferSession((prev) =>
              prev
                ? {
                    ...prev,
                    status: 'completed',
                    transferredBytes: req.totalSize,
                    speedBps: 0,
                    etaSeconds: 0,
                  }
                : null
            );
            playSuccessChime();
          }
        }
      } catch (e) {
        console.error(e);
      }
    } else if (data instanceof ArrayBuffer) {
      buf.chunks.push(data);
      buf.totalReceived += data.byteLength;
      buf.bytesSinceLast += data.byteLength;

      updateReceiverProgress(buf, req.totalSize);
    }
  };

  // Relay chunk handler (Fallback)
  const handleRelayChunkReceived = (msg: any) => {
    const buf = receiverBufferRef.current;
    const session = activeSessionRef.current;
    if (!session || session.id !== msg.transferId) return;

    if (session.status === 'connecting') {
      setTransferSession((prev) =>
        prev ? { ...prev, status: 'transferring', transport: 'relay' } : null
      );
    }

    try {
      if (typeof msg.data === 'string') {
        if (msg.data.startsWith('{')) {
          const parsed = JSON.parse(msg.data);
          if (parsed.meta) {
            buf.currentMeta = parsed;
            buf.chunks = [];
          } else if (parsed.end) {
            if (buf.currentMeta && buf.chunks.length > 0) {
              triggerFileDownload(buf.chunks, buf.currentMeta.name, buf.currentMeta.mimeType);
              buf.chunks = [];
            }
            if (msg.fileIndex === session.files.length - 1) {
              setTransferSession((prev) =>
                prev
                  ? {
                      ...prev,
                      status: 'completed',
                      transferredBytes: session.totalSize,
                      speedBps: 0,
                      etaSeconds: 0,
                    }
                  : null
              );
              playSuccessChime();
            }
          }
          return;
        }

        // Decode base64
        const binary = atob(msg.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        buf.chunks.push(bytes.buffer);
        buf.totalReceived += bytes.byteLength;
        buf.bytesSinceLast += bytes.byteLength;

        updateReceiverProgress(buf, session.totalSize);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateReceiverProgress = (buf: any, totalSize: number) => {
    const now = Date.now();
    const delta = (now - buf.lastTime) / 1000;
    if (delta >= 0.25) {
      const speedBps = buf.bytesSinceLast / delta;
      const remainingBytes = Math.max(0, totalSize - buf.totalReceived);
      const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;

      setTransferSession((prev) =>
        prev
          ? {
              ...prev,
              transferredBytes: buf.totalReceived,
              speedBps,
              etaSeconds,
            }
          : null
      );

      buf.lastTime = now;
      buf.bytesSinceLast = 0;
    }
  };

  const triggerFileDownload = (chunks: ArrayBuffer[], filename: string, mimeType: string) => {
    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // Reject Incoming
  const handleRejectIncoming = () => {
    if (!incomingRequest) return;
    const req = incomingRequest;
    setIncomingRequest(null);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'transfer_response',
          targetPeerId: req.fromPeerId,
          transferId: req.transferId,
          accepted: false,
          reason: 'Rechazado',
        })
      );
    }
  };

  // Cancel Transfer
  const handleCancelTransfer = () => {
    if (transferSession && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'transfer_cancel',
          targetPeerId: transferSession.peerId,
          transferId: transferSession.id,
        })
      );
    }
    if (webrtcRef.current) {
      webrtcRef.current.close();
      webrtcRef.current = null;
    }
    setTransferSession(null);
  };

  // Drag and drop anywhere on the screen
  const handleScreenDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverScreen(true);
  };

  const handleScreenDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.relatedTarget === null) {
      setIsDraggingOverScreen(false);
    }
  };

  const handleScreenDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverScreen(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // If there is exactly 1 peer, drop sends directly to that peer!
      if (peers.length === 1) {
        initiateTransferWithFiles(peers[0], Array.from(e.dataTransfer.files));
      }
    }
  };

  return (
    <div
      onDragOver={handleScreenDragOver}
      onDragLeave={handleScreenDragLeave}
      onDrop={handleScreenDrop}
      className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 selection:bg-cyan-500/30 selection:text-cyan-200"
    >
      {/* Hidden File Picker Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Screen Drag Overlay */}
      {isDraggingOverScreen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-cyan-400 p-8 pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center animate-bounce">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-white tracking-tight">
            {peers.length === 1
              ? `Suelta para enviar a ${peers[0].name}`
              : 'Suelta el archivo sobre el dispositivo deseado'}
          </h3>
        </div>
      )}

      {/* Simple Header */}
      <SimpleHeader
        deviceName={deviceName}
        onUpdateDeviceName={handleUpdateDeviceName}
        deviceOs={deviceInfo.os}
        deviceType={deviceInfo.deviceType}
        isMuted={isMutedState}
        onToggleMute={handleToggleMute}
        onOpenQR={() => setIsQROpen(true)}
        peersCount={peers.length}
      />

      {/* Center Stage: Simple Radar & Device Bubbles */}
      <main className="flex-1 max-w-4xl w-full mx-auto flex items-center justify-center px-4">
        <SimpleDeviceRadar
          peers={peers}
          myDevice={{
            name: deviceName,
            os: deviceInfo.os,
            deviceType: deviceInfo.deviceType,
            roomCode,
          }}
          onDeviceClick={handleDeviceClick}
          onDropOnDevice={handleDropOnDevice}
          onOpenQR={() => setIsQROpen(true)}
          shareUrl={shareUrl}
        />
      </main>

      {/* Real-time Transfer Card */}
      {transferSession && (
        <SimpleTransferCard
          session={transferSession}
          onCancel={handleCancelTransfer}
          onClose={() => setTransferSession(null)}
        />
      )}

      {/* Incoming AirDrop Modal */}
      {incomingRequest && (
        <SimpleIncomingModal
          request={incomingRequest}
          onAccept={handleAcceptIncoming}
          onReject={handleRejectIncoming}
        />
      )}

      {/* Mobile QR Pairing Modal */}
      {isQROpen && (
        <SimpleQRModal
          shareUrl={shareUrl}
          onClose={() => setIsQROpen(false)}
        />
      )}

      {/* Simple Footer */}
      <footer className="w-full border-t border-neutral-900 bg-neutral-950/70 py-3 text-center text-xs text-neutral-500">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <span>DropLink · Transferencia directa entre dispositivos</span>
          <span className="text-neutral-400 font-mono text-[11px]">
            {peers.length} {peers.length === 1 ? 'dispositivo cerca' : 'dispositivos cerca'}
          </span>
        </div>
      </footer>
    </div>
  );
}
