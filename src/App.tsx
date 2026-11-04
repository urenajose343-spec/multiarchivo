import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DeviceOS,
  DeviceType,
  PeerInfo,
  StagedFile,
  TransferSession,
  IncomingTransferRequest,
  CloudVaultFile,
} from './types';
import {
  detectDevice,
  getOrCreatePeerId,
  getStoredDeviceName,
  setStoredDeviceName,
} from './utils/device';
import {
  computeFileHash,
  generateSecurityFingerprint,
  deriveKey,
  encryptChunk,
  decryptChunk,
} from './utils/crypto';
import {
  playRadarPing,
  playRequestChime,
  playSuccessChime,
  playCancelTone,
  getMuted,
  setMuted,
} from './utils/audio';
import { WebRTCConnection, CHUNK_SIZE } from './utils/webrtcClient';
import { Header } from './components/Header';
import { RadarView } from './components/RadarView';
import { FileStaging } from './components/FileStaging';
import { TransferModal } from './components/TransferModal';
import { IncomingModal } from './components/IncomingModal';
import { CloudVaultDrawer } from './components/CloudVaultDrawer';
import { PairingModal } from './components/PairingModal';
import { SettingsModal } from './components/SettingsModal';
import { Radio, Cloud, ShieldCheck, Zap, DownloadCloud } from 'lucide-react';

export default function App() {
  // Device & Identity
  const [deviceInfo] = useState(() => detectDevice());
  const [peerId] = useState(() => getOrCreatePeerId());
  const [deviceName, setDeviceName] = useState(() =>
    getStoredDeviceName(deviceInfo.defaultName)
  );

  // Room code from URL param or default
  const [roomCode, setRoomCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam && roomParam.trim()) {
        return roomParam.trim().toUpperCase();
      }
    }
    return 'DROP-' + Math.floor(100 + Math.random() * 900);
  });

  // UI Navigation & View State
  const [activeTab, setActiveTab] = useState<'radar' | 'vault'>('radar');
  const [isMutedState, setIsMutedState] = useState(() => getMuted());
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDraggingOverScreen, setIsDraggingOverScreen] = useState(false);

  // Peers & Staged Files
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<PeerInfo | null>(null);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [autoCloudSync, setAutoCloudSync] = useState(true);
  const [encryptionPassphrase, setEncryptionPassphrase] = useState('');

  // Active Transfer & Incoming Requests
  const [transferSession, setTransferSession] = useState<TransferSession | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<IncomingTransferRequest | null>(null);

  // Cloud Vault Files
  const [cloudFiles, setCloudFiles] = useState<CloudVaultFile[]>([]);
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const webrtcRef = useRef<WebRTCConnection | null>(null);
  const isPausedRef = useRef(false);
  const activeSessionRef = useRef<TransferSession | null>(null);
  activeSessionRef.current = transferSession;

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

  // Change room code
  const handleChangeRoom = (newRoom: string) => {
    setRoomCode(newRoom);
    // update URL query param without reload
    const url = new URL(window.location.href);
    url.searchParams.set('room', newRoom);
    window.history.replaceState({}, '', url.toString());

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'join',
          peerId,
          name: deviceName,
          deviceType: deviceInfo.deviceType,
          os: deviceInfo.os,
          roomCode: newRoom,
        })
      );
    }
  };

  // Fetch Cloud Vault Files
  const fetchCloudFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/vault/files?room=${encodeURIComponent(roomCode)}`);
      if (res.ok) {
        const data = await res.json();
        setCloudFiles(data.files || []);
      }
    } catch (err) {
      console.error('Error fetching vault files:', err);
    }
  }, [roomCode]);

  useEffect(() => {
    fetchCloudFiles();
  }, [fetchCloudFiles]);

  // WebSocket Connection Management
  useEffect(() => {
    let reconnectTimeout: any;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Register current peer in room
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
              if (selectedPeer?.peerId === msg.peerId) {
                setSelectedPeer(null);
              }
              break;
            }

            case 'signal': {
              if (webrtcRef.current) {
                await webrtcRef.current.handleSignal(msg.signalData);
              }
              break;
            }

            case 'transfer_request': {
              // Incoming AirDrop Request
              setIncomingRequest({
                transferId: msg.transferId,
                fromPeerId: msg.fromPeerId,
                sender: msg.sender,
                files: msg.files,
                totalSize: msg.totalSize,
                isEncrypted: msg.isEncrypted,
                authFingerprint: msg.authFingerprint,
              });
              playRequestChime();
              break;
            }

            case 'transfer_response': {
              const current = activeSessionRef.current;
              if (current && current.id === msg.transferId) {
                if (msg.accepted) {
                  // Recipient accepted! Start WebRTC connection as initiator
                  setTransferSession((prev) =>
                    prev ? { ...prev, status: 'connecting' } : null
                  );
                  initiateSenderWebRTC(current);
                } else {
                  setTransferSession((prev) =>
                    prev
                      ? {
                          ...prev,
                          status: 'rejected',
                          errorMessage: msg.reason || 'Rechazado por el destinatario',
                        }
                      : null
                  );
                  playCancelTone();
                }
              }
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

            case 'cloud_file_available': {
              fetchCloudFiles();
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.error('Error handling WS message:', err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = (err) => {
        console.warn('WS error:', err);
      };
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [peerId, deviceName, deviceInfo, roomCode, fetchCloudFiles]);

  // Stage Files handler
  const handleAddFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const newStaged: StagedFile[] = list.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      isHashing: true,
    }));

    setStagedFiles((prev) => [...prev, ...newStaged]);

    // Compute SHA-256 for integrity verification
    for (const item of newStaged) {
      computeFileHash(item.file).then((hash) => {
        setStagedFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, sha256: hash, isHashing: false } : f))
        );
      });
    }
  };

  const handleRemoveFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearFiles = () => {
    setStagedFiles([]);
  };

  // Initiate Sender WebRTC Transfer
  const initiateSenderWebRTC = async (session: TransferSession) => {
    const cryptoSecret = encryptionPassphrase || session.authFingerprint || roomCode;
    const cryptoKey = session.isEncrypted ? await deriveKey(cryptoSecret) : null;

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
        setTransferSession((prev) =>
          prev ? { ...prev, status: 'transferring', startTime: Date.now() } : null
        );

        // Start Streaming Files chunk-by-chunk!
        await streamFilesToPeer(session, webrtc, cryptoKey);
      },
      onChannelClose: () => {
        console.log('Sender DataChannel closed');
      },
      onData: (data) => {
        // Control messages from receiver if any
      },
      onError: (err) => {
        console.error('Sender WebRTC error:', err);
        setTransferSession((prev) =>
          prev ? { ...prev, status: 'error', errorMessage: 'Error de conexión WebRTC' } : null
        );
      },
    });

    webrtcRef.current = webrtc;
    await webrtc.createOffer();
  };

  // Sender File Streaming Loop with Flow Control
  const streamFilesToPeer = async (
    session: TransferSession,
    webrtc: WebRTCConnection,
    cryptoKey: CryptoKey | null
  ) => {
    let totalBytesSent = 0;
    let lastTime = Date.now();
    let bytesSinceLastTime = 0;

    for (let fIdx = 0; fIdx < stagedFiles.length; fIdx++) {
      const staged = stagedFiles[fIdx];
      const file = staged.file;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // Send File Meta Header
      webrtc.send(
        JSON.stringify({
          type: 'file_start',
          fileIndex: fIdx,
          totalFiles: stagedFiles.length,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          sha256: staged.sha256,
          isEncrypted: session.isEncrypted,
          totalChunks,
        })
      );

      // Read & Send Chunks with Backpressure
      let offset = 0;
      let chunkIndex = 0;

      while (offset < file.size) {
        // Check pause state
        while (isPausedRef.current) {
          await new Promise((r) => setTimeout(r, 200));
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        let buffer = await slice.arrayBuffer();

        // Encrypt if AES-GCM enabled
        if (cryptoKey) {
          buffer = await encryptChunk(buffer, cryptoKey);
        }

        // Send binary buffer
        webrtc.send(buffer);

        offset += CHUNK_SIZE;
        chunkIndex++;
        totalBytesSent += slice.size;
        bytesSinceLastTime += slice.size;

        // Measure speed & ETA every 250ms
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

        // Backpressure flow control: wait for buffer to drain if needed
        await webrtc.waitForDrain();
      }

      // Send File Complete Footer
      webrtc.send(
        JSON.stringify({
          type: 'file_end',
          fileIndex: fIdx,
          sha256: staged.sha256,
        })
      );
    }

    // All files sent!
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

    // If auto cloud sync is checked, also save to cloud vault
    if (autoCloudSync) {
      for (const staged of stagedFiles) {
        uploadFileToVault(staged.file, staged.sha256);
      }
    }
  };

  // Start Transfer Request to Selected Peer
  const handleStartP2PTransfer = () => {
    if (!selectedPeer || stagedFiles.length === 0) return;

    const transferId = 'xfer-' + Math.random().toString(36).substring(2, 9);
    const totalSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);
    const authFingerprint = generateSecurityFingerprint(peerId, selectedPeer.peerId, transferId);

    const filesMeta = stagedFiles.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      sha256: f.sha256,
    }));

    // Create session in 'waiting_accept'
    const newSession: TransferSession = {
      id: transferId,
      direction: 'send',
      peerId: selectedPeer.peerId,
      peerName: selectedPeer.name,
      peerOs: selectedPeer.os,
      peerDeviceType: selectedPeer.deviceType,
      files: filesMeta,
      currentFileIndex: 0,
      totalSize,
      transferredBytes: 0,
      speedBps: 0,
      etaSeconds: 0,
      startTime: Date.now(),
      status: 'waiting_accept',
      isEncrypted,
      authFingerprint,
      transport: 'webrtc',
    };

    setTransferSession(newSession);

    // Send transfer request message to recipient via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'transfer_request',
          targetPeerId: selectedPeer.peerId,
          transferId,
          senderName: deviceName,
          senderOs: deviceInfo.os,
          senderDeviceType: deviceInfo.deviceType,
          files: filesMeta,
          totalSize,
          isEncrypted,
          authFingerprint,
        })
      );
    }
  };

  // Recipient Accepts Transfer
  const handleAcceptIncoming = async () => {
    if (!incomingRequest) return;
    const req = incomingRequest;
    setIncomingRequest(null);

    const cryptoSecret = encryptionPassphrase || req.authFingerprint || roomCode;
    const cryptoKey = req.isEncrypted ? await deriveKey(cryptoSecret) : null;

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
      isEncrypted: req.isEncrypted,
      authFingerprint: req.authFingerprint,
      transport: 'webrtc',
    };

    setTransferSession(newSession);

    // Receiver WebRTC connection
    let receivedChunks: ArrayBuffer[] = [];
    let currentMeta: any = null;
    let totalBytesReceived = 0;
    let lastTime = Date.now();
    let bytesSinceLastTime = 0;

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
      onChannelClose: () => {
        console.log('Receiver DataChannel closed');
      },
      onData: async (data) => {
        if (typeof data === 'string') {
          try {
            const meta = JSON.parse(data);
            if (meta.type === 'file_start') {
              currentMeta = meta;
              receivedChunks = [];
              setTransferSession((prev) =>
                prev ? { ...prev, currentFileIndex: meta.fileIndex } : null
              );
            } else if (meta.type === 'file_end') {
              // Assemble file and trigger browser download
              if (currentMeta && receivedChunks.length > 0) {
                const blob = new Blob(receivedChunks, { type: currentMeta.mimeType });
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = currentMeta.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);

                receivedChunks = [];
              }

              // Check if last file
              if (currentMeta && currentMeta.fileIndex === req.files.length - 1) {
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
            console.error('Error parsing channel JSON:', e);
          }
        } else if (data instanceof ArrayBuffer) {
          // Binary chunk received!
          let chunk = data;
          if (cryptoKey) {
            try {
              chunk = await decryptChunk(data, cryptoKey);
            } catch (err) {
              console.error('Decryption error on chunk:', err);
            }
          }

          receivedChunks.push(chunk);
          totalBytesReceived += chunk.byteLength;
          bytesSinceLastTime += chunk.byteLength;

          const now = Date.now();
          const delta = (now - lastTime) / 1000;
          if (delta >= 0.25) {
            const speedBps = bytesSinceLastTime / delta;
            const remainingBytes = Math.max(0, req.totalSize - totalBytesReceived);
            const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;

            setTransferSession((prev) =>
              prev
                ? {
                    ...prev,
                    transferredBytes: totalBytesReceived,
                    speedBps,
                    etaSeconds,
                  }
                : null
            );

            lastTime = now;
            bytesSinceLastTime = 0;
          }
        }
      },
      onError: (err) => {
        console.error('Receiver WebRTC error:', err);
      },
    });

    webrtcRef.current = webrtc;

    // Send transfer_response acceptance back to sender
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

  // Recipient Rejects Transfer
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
          reason: 'Transferencia rechazada por el usuario',
        })
      );
    }
  };

  // Transfer Modal Controls
  const handlePauseTransfer = () => {
    isPausedRef.current = true;
    setTransferSession((prev) => (prev ? { ...prev, status: 'paused', speedBps: 0 } : null));
  };

  const handleResumeTransfer = () => {
    isPausedRef.current = false;
    setTransferSession((prev) => (prev ? { ...prev, status: 'transferring' } : null));
  };

  const handleCancelTransfer = () => {
    if (transferSession) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'transfer_cancel',
            targetPeerId: transferSession.peerId,
            transferId: transferSession.id,
          })
        );
      }
    }
    if (webrtcRef.current) {
      webrtcRef.current.close();
      webrtcRef.current = null;
    }
    setTransferSession(null);
  };

  // Cloud Vault Upload helper
  const uploadFileToVault = async (file: File, sha256?: string) => {
    setIsUploadingCloud(true);
    try {
      const buffer = await file.arrayBuffer();
      // Base64 encode for simple JSON payload
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      const res = await fetch('/api/vault/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          isEncrypted,
          sha256,
          senderName: deviceName,
          senderOs: deviceInfo.os,
          roomCode,
          base64Data,
          expiryHours: 24,
        }),
      });

      if (res.ok) {
        fetchCloudFiles();
      }
    } catch (err) {
      console.error('Error uploading to cloud vault:', err);
    } finally {
      setIsUploadingCloud(false);
    }
  };

  const handleDirectCloudUpload = (file: File) => {
    uploadFileToVault(file);
  };

  const handleDeleteVaultFile = async (id: string) => {
    try {
      const res = await fetch(`/api/vault/files/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCloudFiles((prev) => prev.filter((f) => f.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Full-Screen Drag and Drop Handlers
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
      handleAddFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      onDragOver={handleScreenDragOver}
      onDragLeave={handleScreenDragLeave}
      onDrop={handleScreenDrop}
      className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 selection:bg-cyan-500/30 selection:text-cyan-200"
    >
      {/* Full-Screen Drag-and-Drop Overlay */}
      {isDraggingOverScreen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-cyan-400 p-8 pointer-events-none">
          <div className="w-20 h-20 rounded-3xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center animate-bounce">
            <DownloadCloud className="w-10 h-10" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-white tracking-tight">
            Suelta los archivos aquí
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Se añadirán automáticamente a la lista de envío AirDrop P2P
          </p>
        </div>
      )}

      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPairing={() => setIsPairingOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        deviceName={deviceName}
        deviceOs={deviceInfo.os}
        deviceType={deviceInfo.deviceType}
        roomCode={roomCode}
        isMuted={isMutedState}
        onToggleMute={handleToggleMute}
        connectedPeersCount={peers.length}
      />

      {/* Main Viewport */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'radar' ? (
          <div className="space-y-8">
            {/* AirDrop Radar */}
            <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-6 relative overflow-hidden backdrop-blur-sm">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800/60">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Radar de Proximidad y Red Local
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className="font-mono text-cyan-400">{peers.length}</span>
                  <span>{peers.length === 1 ? 'dispositivo activo' : 'dispositivos activos'}</span>
                </div>
              </div>

              <RadarView
                peers={peers}
                myDevice={{
                  name: deviceName,
                  os: deviceInfo.os,
                  deviceType: deviceInfo.deviceType,
                  roomCode,
                }}
                onSelectPeer={(peer) => setSelectedPeer(peer)}
                onDropFilesOnPeer={(peer, files) => {
                  setSelectedPeer(peer);
                  handleAddFiles(files);
                }}
                onOpenPairing={() => setIsPairingOpen(true)}
              />
            </div>

            {/* File Staging & Sending Hub */}
            <FileStaging
              stagedFiles={stagedFiles}
              onAddFiles={handleAddFiles}
              onRemoveFile={handleRemoveFile}
              onClearFiles={handleClearFiles}
              peers={peers}
              selectedPeer={selectedPeer}
              onSelectPeer={setSelectedPeer}
              onSendP2P={handleStartP2PTransfer}
              onUploadToCloud={() => {
                if (stagedFiles.length > 0) {
                  for (const f of stagedFiles) {
                    uploadFileToVault(f.file, f.sha256);
                  }
                  setActiveTab('vault');
                }
              }}
              isEncrypted={isEncrypted}
              setIsEncrypted={setIsEncrypted}
              autoCloudSync={autoCloudSync}
              setAutoCloudSync={setAutoCloudSync}
              isUploadingCloud={isUploadingCloud}
            />
          </div>
        ) : (
          /* Cloud Vault View */
          <CloudVaultDrawer
            files={cloudFiles}
            onRefresh={fetchCloudFiles}
            onDeleteFile={handleDeleteVaultFile}
            onDirectUpload={handleDirectCloudUpload}
            isUploading={isUploadingCloud}
            roomCode={roomCode}
          />
        )}
      </main>

      {/* Active Transfer Modal */}
      {transferSession && (
        <TransferModal
          session={transferSession}
          onPause={handlePauseTransfer}
          onResume={handleResumeTransfer}
          onCancel={handleCancelTransfer}
          onClose={() => setTransferSession(null)}
        />
      )}

      {/* Incoming Request Prompt */}
      {incomingRequest && (
        <IncomingModal
          request={incomingRequest}
          onAccept={handleAcceptIncoming}
          onReject={handleRejectIncoming}
        />
      )}

      {/* Pairing & QR Code Modal */}
      {isPairingOpen && (
        <PairingModal
          roomCode={roomCode}
          onChangeRoom={handleChangeRoom}
          onClose={() => setIsPairingOpen(false)}
        />
      )}

      {/* Settings & E2EE Key Modal */}
      {isSettingsOpen && (
        <SettingsModal
          deviceName={deviceName}
          onUpdateDeviceName={handleUpdateDeviceName}
          encryptionPassphrase={encryptionPassphrase}
          onUpdatePassphrase={setEncryptionPassphrase}
          isMuted={isMutedState}
          onToggleMute={handleToggleMute}
          deviceOs={deviceInfo.os}
          deviceType={deviceInfo.deviceType}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 bg-neutral-950/60 py-4 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>DropLink P2P · Transferencia Cifrada Punto a Punto</span>
          <div className="flex items-center gap-4 text-neutral-400">
            <span>WebRTC DataChannel 64KB</span>
            <span aria-hidden="true">·</span>
            <span>AES-GCM 256 bits</span>
            <span aria-hidden="true">·</span>
            <span>Multiplataforma</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
