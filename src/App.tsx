import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import {
  scanBluetoothDevice,
  streamFileOverBluetooth,
  BluetoothDeviceInfo,
} from './utils/bluetooth';
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
  const bluetoothDevicesRef = useRef<Map<string, BluetoothDeviceInfo>>(new Map());
  const activeBlobUrlsRef = useRef<string[]>([]);
  activeSessionRef.current = transferSession;

  // Bluetooth Scanner
  const handleScanBluetooth = async () => {
    try {
      const dev = await scanBluetoothDevice();
      if (dev) {
        const newPeer: PeerInfo = {
          peerId: 'bt-' + dev.id,
          name: dev.name || 'Dispositivo Bluetooth',
          deviceType: 'mobile',
          os: 'other',
          roomCode,
          transportType: 'bluetooth',
          joinedAt: Date.now(),
        };
        bluetoothDevicesRef.current.set(newPeer.peerId, dev);
        setPeers((prev) => {
          const exists = prev.some((p) => p.peerId === newPeer.peerId);
          return exists ? prev : [newPeer, ...prev];
        });
        playRadarPing();
      }
    } catch (err: any) {
      alert(err.message || 'No se pudo conectar al dispositivo Bluetooth');
    }
  };

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
    // Also send to HTTP signaling heartbeat
    fetch('/api/signaling/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peerId,
        name: newName,
        deviceType: deviceInfo.deviceType,
        os: deviceInfo.os,
        roomCode,
      }),
    }).catch(() => {});
  };

  // Unified Signaling Sender: tries WebSocket first, falls back to HTTP Serverless Signaling (for Vercel)
  const sendSignaling = useCallback((targetPeerId: string, message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ...message, targetPeerId }));
      return;
    }
    // Fallback to HTTP signaling (critical for Vercel where WebSockets are not persistent)
    fetch('/api/signaling/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPeerId, message }),
    }).catch((err) => console.warn('HTTP signaling send error:', err));
  }, []);

  // Dispatcher for incoming signaling messages (both from WebSocket and HTTP polling)
  const handleIncomingMessage = useCallback(
    async (msg: any) => {
      try {
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
        console.error('Error handling message:', err);
      }
    },
    [peerId, incomingRequest]
  );

  // Dual Signaling Lifecycle: WebSocket with HTTP Serverless Polling Fallback
  useEffect(() => {
    let reconnectTimeout: any;
    let pollInterval: any;
    let peersInterval: any;
    let heartbeatInterval: any;
    let wsFailed = false;

    // Optional external signaling server from env
    const customSignaling =
      (typeof import.meta !== 'undefined' &&
        import.meta.env &&
        (import.meta.env.VITE_SIGNALING_SERVER || import.meta.env.REACT_APP_SIGNALING_SERVER)) ||
      '';

    const startHttpPolling = () => {
      // 1. Heartbeat
      const sendHeartbeat = () => {
        fetch('/api/signaling/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            peerId,
            name: deviceName,
            deviceType: deviceInfo.deviceType,
            os: deviceInfo.os,
            roomCode,
          }),
        }).catch(() => {});
      };

      // 2. Poll peer list
      const fetchPeers = async () => {
        try {
          const res = await fetch(`/api/signaling/peers?room=${encodeURIComponent(roomCode)}`);
          if (res.ok) {
            const data = await res.json();
            const filtered = (data.peers || []).filter((p: any) => p.peerId !== peerId);
            setPeers((prev) => {
              if (filtered.length > prev.length) {
                playRadarPing();
              }
              return filtered;
            });
          }
        } catch (e) {
          // ignore
        }
      };

      // 3. Poll queued messages
      const pollMessages = async () => {
        try {
          const res = await fetch(`/api/signaling/poll?peerId=${encodeURIComponent(peerId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.messages && data.messages.length > 0) {
              for (const m of data.messages) {
                handleIncomingMessage(m);
              }
            }
          }
        } catch (e) {
          // ignore
        }
      };

      sendHeartbeat();
      fetchPeers();
      pollMessages();

      heartbeatInterval = setInterval(sendHeartbeat, 5000);
      peersInterval = setInterval(fetchPeers, 3000);
      pollInterval = setInterval(pollMessages, 1200);
    };

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = customSignaling || `${protocol}//${window.location.host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          wsFailed = false;
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

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            handleIncomingMessage(msg);
          } catch (e) {
            console.error(e);
          }
        };

        ws.onerror = () => {
          if (!wsFailed) {
            wsFailed = true;
            // Activate HTTP polling fallback immediately
            startHttpPolling();
          }
        };

        ws.onclose = () => {
          if (!wsFailed) {
            wsFailed = true;
            startHttpPolling();
          }
          reconnectTimeout = setTimeout(connectWebSocket, 4000);
        };
      } catch (err) {
        startHttpPolling();
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollInterval) clearInterval(pollInterval);
      if (peersInterval) clearInterval(peersInterval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [peerId, deviceName, deviceInfo, roomCode, handleIncomingMessage]);

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

  // Bluetooth Streamer
  const startSendingBluetoothFiles = async (
    session: TransferSession,
    btDevice: BluetoothDeviceInfo,
    files: File[]
  ) => {
    let totalBytesSent = 0;
    let lastTime = Date.now();

    try {
      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        if (activeSessionRef.current?.status === 'cancelled') return;
        const file = files[fIdx];
        const prevOffset = totalBytesSent;

        await streamFileOverBluetooth(
          btDevice,
          file,
          (fileBytesSent, _fileTotal) => {
            const currentTotalSent = prevOffset + fileBytesSent;
            const now = Date.now();
            const delta = (now - lastTime) / 1000;
            if (delta >= 0.25) {
              const speedBps = (currentTotalSent - totalBytesSent) / (delta || 1);
              const remainingBytes = Math.max(0, session.totalSize - currentTotalSent);
              const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;

              setTransferSession((prev) =>
                prev
                  ? {
                      ...prev,
                      currentFileIndex: fIdx,
                      transferredBytes: currentTotalSent,
                      speedBps,
                      etaSeconds,
                    }
                  : null
              );
              lastTime = now;
              totalBytesSent = currentTotalSent;
            }
          }
        );
        totalBytesSent = prevOffset + file.size;
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
    } catch (err: any) {
      console.error('Bluetooth transfer error:', err);
      setTransferSession((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              errorMessage: err?.message || 'Error en la transferencia Bluetooth',
            }
          : null
      );
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

    const isBt =
      peer.transportType === 'bluetooth' ||
      bluetoothDevicesRef.current.has(peer.peerId);

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
      status: isBt ? 'transferring' : 'waiting_accept',
      isEncrypted: false,
      authFingerprint: '',
      transport: isBt ? 'bluetooth' : 'webrtc',
    };

    setTransferSession(session);

    if (isBt) {
      const btDevice = bluetoothDevicesRef.current.get(peer.peerId);
      if (btDevice) {
        startSendingBluetoothFiles(session, btDevice, files);
      }
      return;
    }

    // Send transfer request via unified signaling
    sendSignaling(peer.peerId, {
      type: 'transfer_request',
      transferId,
      senderName: deviceName,
      senderOs: deviceInfo.os,
      senderDeviceType: deviceInfo.deviceType,
      files: filesMeta,
      totalSize,
      isEncrypted: false,
    });
  };

  // Start sending files over WebRTC (with automatic relay fallback)
  const startSendingFiles = async (session: TransferSession) => {
    const files = pendingFilesRef.current;
    if (files.length === 0) return;

    let webrtcConnected = false;

    const webrtc = new WebRTCConnection(session.peerId, true, {
      onSignal: (signalData) => {
        sendSignaling(session.peerId, {
          type: 'signal',
          signalData,
        });
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

    // Fallback: If WebRTC DataChannel doesn't open within 3.5s, stream via relay!
    setTimeout(async () => {
      if (!webrtcConnected && activeSessionRef.current?.status === 'connecting') {
        console.log('Using Relay fallback for guaranteed transfer');
        setTransferSession((prev) =>
          prev
            ? { ...prev, status: 'transferring', transport: 'relay', startTime: Date.now() }
            : null
        );
        await streamFilesRelay(session, files);
      }
    }, 3500);
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

  // Relay Streamer (Fallback)
  const streamFilesRelay = async (session: TransferSession, files: File[]) => {
    let totalBytesSent = 0;
    let lastTime = Date.now();
    let bytesSinceLastTime = 0;

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const file = files[fIdx];
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      sendSignaling(session.peerId, {
        type: 'relay_chunk',
        transferId: session.id,
        fileIndex: fIdx,
        data: JSON.stringify({
          meta: true,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          totalChunks,
        }),
      });

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

        sendSignaling(session.peerId, {
          type: 'relay_chunk',
          transferId: session.id,
          fileIndex: fIdx,
          chunkIndex: chunkIdx,
          totalChunks,
          data: base64,
        });

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

        await new Promise((r) => setTimeout(r, 15));
      }

      sendSignaling(session.peerId, {
        type: 'relay_chunk',
        transferId: session.id,
        fileIndex: fIdx,
        data: JSON.stringify({ end: true }),
      });
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
        sendSignaling(req.fromPeerId, {
          type: 'signal',
          signalData,
        });
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
    sendSignaling(req.fromPeerId, {
      type: 'transfer_response',
      transferId: req.transferId,
      accepted: true,
    });
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
          const isLastFile =
            buf.currentMeta && buf.currentMeta.fileIndex === req.files.length - 1;

          if (buf.currentMeta && buf.chunks.length > 0) {
            const chunksCopy = buf.chunks;
            buf.chunks = [];
            finishReceivingFile(
              chunksCopy,
              buf.currentMeta.name,
              buf.currentMeta.mimeType,
              isLastFile,
              req.totalSize
            );
          } else if (isLastFile) {
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
            const isLastFile = msg.fileIndex === session.files.length - 1;
            if (buf.currentMeta && buf.chunks.length > 0) {
              const chunksCopy = buf.chunks;
              buf.chunks = [];
              finishReceivingFile(
                chunksCopy,
                buf.currentMeta.name,
                buf.currentMeta.mimeType,
                isLastFile,
                session.totalSize
              );
            } else if (isLastFile) {
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
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
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

  // Asynchronous non-blocking file assembly & download to prevent tab freeze
  const finishReceivingFile = (
    chunks: ArrayBuffer[],
    filename: string,
    mimeType: string,
    isLastFile: boolean,
    totalExpectedSize: number
  ) => {
    // 1. Immediately reflect 100% completed status in UI to prevent freezing
    if (isLastFile) {
      setTransferSession((prev) =>
        prev
          ? {
              ...prev,
              status: 'completed',
              transferredBytes: totalExpectedSize,
              speedBps: 0,
              etaSeconds: 0,
            }
          : null
      );
      playSuccessChime();
    }

    // 2. Yield to the event loop so the UI renders smoothly before allocating the Blob
    setTimeout(() => {
      try {
        if (!chunks || chunks.length === 0) return;
        const blob = new Blob(chunks, { type: mimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        activeBlobUrlsRef.current.push(url);

        // Store direct download URL on the session so the receiver card allows immediate 1-tap download
        setTransferSession((prev) =>
          prev
            ? {
                ...prev,
                downloadUrl: url,
                downloadName: filename,
              }
            : null
        );

        // 3. Initiate non-blocking background auto-download
        setTimeout(() => {
          try {
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              if (document.body.contains(a)) {
                document.body.removeChild(a);
              }
            }, 3000);
          } catch (autoErr) {
            console.warn('Auto download blocked by browser policy:', autoErr);
          }
        }, 120);
      } catch (err) {
        console.error('Error assembling received file chunks:', err);
      }
    }, 40);
  };

  // Reject Incoming
  const handleRejectIncoming = () => {
    if (!incomingRequest) return;
    const req = incomingRequest;
    setIncomingRequest(null);

    sendSignaling(req.fromPeerId, {
      type: 'transfer_response',
      transferId: req.transferId,
      accepted: false,
      reason: 'Rechazado',
    });
  };

  // Cancel Transfer
  const handleCancelTransfer = () => {
    if (transferSession) {
      sendSignaling(transferSession.peerId, {
        type: 'transfer_cancel',
        transferId: transferSession.id,
      });
    }
    if (webrtcRef.current) {
      webrtcRef.current.close();
      webrtcRef.current = null;
    }
    handleCloseTransfer();
  };

  // Close / Dismiss Transfer Card & Clean up Object URLs safely
  const handleCloseTransfer = () => {
    activeBlobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    });
    activeBlobUrlsRef.current = [];
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
        onScanBluetooth={handleScanBluetooth}
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
          onScanBluetooth={handleScanBluetooth}
          shareUrl={shareUrl}
        />
      </main>

      {/* Real-time Transfer Card */}
      {transferSession && (
        <SimpleTransferCard
          session={transferSession}
          onCancel={handleCancelTransfer}
          onClose={handleCloseTransfer}
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
