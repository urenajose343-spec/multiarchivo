import React, { useState } from 'react';
import { PeerInfo, DeviceOS, DeviceType } from '../types';
import { DeviceIcon } from './DeviceIcons';
import { QrCode, Smartphone, Laptop, ShieldCheck, ArrowUpRight } from 'lucide-react';

interface RadarViewProps {
  peers: PeerInfo[];
  myDevice: {
    name: string;
    os: DeviceOS;
    deviceType: DeviceType;
    roomCode: string;
  };
  onSelectPeer: (peer: PeerInfo) => void;
  onDropFilesOnPeer: (peer: PeerInfo, files: FileList) => void;
  onOpenPairing: () => void;
}

export function RadarView({
  peers,
  myDevice,
  onSelectPeer,
  onDropFilesOnPeer,
  onOpenPairing,
}: RadarViewProps) {
  const [draggedOverPeerId, setDraggedOverPeerId] = useState<string | null>(null);

  // Position peers evenly in an orbit circle around the center
  const getPeerCoordinates = (index: number, total: number) => {
    // If only 1 peer, place at top center
    if (total === 1) return { x: 0, y: -130 };
    if (total === 2) return index === 0 ? { x: -140, y: -40 } : { x: 140, y: -40 };

    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radius = total > 4 ? 165 : 145;
    return {
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
    };
  };

  return (
    <div className="relative w-full flex flex-col items-center justify-center py-6 sm:py-10">
      {/* Radar Container */}
      <div className="relative w-[340px] h-[340px] sm:w-[440px] sm:h-[440px] flex items-center justify-center">
        {/* Concentric Radar Rings */}
        <div className="absolute inset-0 rounded-full border border-neutral-800/80 pointer-events-none" />
        <div className="absolute inset-8 sm:inset-12 rounded-full border border-neutral-800/60 pointer-events-none" />
        <div className="absolute inset-20 sm:inset-28 rounded-full border border-cyan-900/30 pointer-events-none" />

        {/* Animated Expanding Radar Waves */}
        <div className="absolute w-32 h-32 rounded-full border border-cyan-500/20 radar-wave-1 pointer-events-none" />
        <div className="absolute w-32 h-32 rounded-full border border-blue-500/15 radar-wave-2 pointer-events-none" />
        <div className="absolute w-32 h-32 rounded-full border border-cyan-400/10 radar-wave-3 pointer-events-none" />

        {/* Radar Sweeping Beam */}
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none opacity-40">
          <div
            className="w-full h-full origin-center radar-sweep"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, transparent 310deg, rgba(6, 182, 212, 0.15) 360deg)',
            }}
          />
        </div>

        {/* Center: My Device */}
        <div className="relative z-10 flex flex-col items-center justify-center group cursor-default">
          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-neutral-900/90 border border-neutral-700/80 shadow-2xl shadow-cyan-950/40 flex items-center justify-center text-cyan-400 backdrop-blur-md transition-transform duration-200 group-hover:scale-105">
            <DeviceIcon os={myDevice.os} deviceType={myDevice.deviceType} className="w-8 h-8 sm:w-9 sm:h-9" />
          </div>
          <div className="mt-2.5 text-center flex flex-col items-center">
            <span className="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
              <span>{myDevice.name}</span>
              <span className="text-[10px] text-cyan-400 font-mono">(Tú)</span>
            </span>
            <div className="flex items-center gap-1 text-[11px] text-neutral-400 mt-0.5">
              <span>Sala {myDevice.roomCode}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 font-medium">Visible</span>
            </div>
          </div>
        </div>

        {/* Orbiting Discovered Peers */}
        {peers.map((peer, idx) => {
          const { x, y } = getPeerCoordinates(idx, peers.length);
          const isOver = draggedOverPeerId === peer.peerId;

          return (
            <div
              key={peer.peerId}
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDraggedOverPeerId(peer.peerId);
              }}
              onDragLeave={() => {
                setDraggedOverPeerId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDraggedOverPeerId(null);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  onDropFilesOnPeer(peer, e.dataTransfer.files);
                }
              }}
              onClick={() => onSelectPeer(peer)}
              className="absolute z-20 flex flex-col items-center cursor-pointer transition-all duration-200 group"
            >
              <div
                className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center transition-all duration-200 backdrop-blur-md ${
                  isOver
                    ? 'bg-cyan-500/20 border-2 border-cyan-400 scale-110 shadow-lg shadow-cyan-500/40'
                    : 'bg-neutral-900/90 border border-neutral-700 hover:border-cyan-500/80 hover:scale-105 shadow-xl shadow-black/50'
                }`}
              >
                <div className={`${isOver ? 'text-cyan-300' : 'text-neutral-200 group-hover:text-cyan-400'} transition-colors`}>
                  <DeviceIcon os={peer.os} deviceType={peer.deviceType} className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
              </div>

              {/* Peer Label & Quick Send */}
              <div className="mt-2 text-center max-w-[110px] flex flex-col items-center">
                <span className="text-xs font-semibold text-neutral-100 group-hover:text-cyan-300 truncate w-full transition-colors">
                  {peer.name}
                </span>
                <span className="text-[10px] text-neutral-400 capitalize">
                  {peer.os} · {peer.deviceType}
                </span>
                <span className="text-[10px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 mt-0.5 font-medium">
                  Enviar <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State / Discovery Guide */}
      {peers.length === 0 && (
        <div className="mt-4 sm:mt-6 text-center max-w-md px-4">
          <p className="text-sm text-neutral-300 font-medium">
            Buscando dispositivos cercanos...
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            Abre este sitio en cualquier iPhone, Android, Mac o PC conectado a la misma red para transferir archivos al instante.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={onOpenPairing}
              className="px-3.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-xs font-medium text-neutral-200 hover:text-white hover:border-neutral-700 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>Escanear con teléfono</span>
            </button>
          </div>
        </div>
      )}

      {/* Discovered Devices Count / Hint */}
      {peers.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-neutral-400">
            {peers.length === 1
              ? '1 dispositivo detectado en el radar. Haz clic o arrastra un archivo hacia él.'
              : `${peers.length} dispositivos detectados en el radar. Haz clic sobre uno para transferir.`}
          </p>
        </div>
      )}
    </div>
  );
}
