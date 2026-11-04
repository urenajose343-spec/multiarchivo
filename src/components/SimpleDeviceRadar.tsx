import React, { useState } from 'react';
import { PeerInfo, DeviceOS, DeviceType } from '../types';
import { DeviceIcon } from './DeviceIcons';
import { QrCode, Copy, Check, Smartphone, Bluetooth } from 'lucide-react';
import QRCode from 'qrcode';

interface SimpleDeviceRadarProps {
  peers: PeerInfo[];
  myDevice: {
    name: string;
    os: DeviceOS;
    deviceType: DeviceType;
    roomCode: string;
  };
  onDeviceClick: (peer: PeerInfo) => void;
  onDropOnDevice: (peer: PeerInfo, files: FileList) => void;
  onOpenQR: () => void;
  onScanBluetooth: () => void;
  shareUrl: string;
}

export function SimpleDeviceRadar({
  peers,
  myDevice,
  onDeviceClick,
  onDropOnDevice,
  onOpenQR,
  onScanBluetooth,
  shareUrl,
}: SimpleDeviceRadarProps) {
  const [dragOverPeerId, setDragOverPeerId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inlineQrUrl, setInlineQrUrl] = useState<string>('');

  React.useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 160,
        margin: 1,
        color: { dark: '#0a0a0a', light: '#ffffff' },
      }).then((url) => setInlineQrUrl(url));
    }
  }, [shareUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-8 sm:py-12 px-4">
      {/* If peers are available: Clean, Minimalist AirDrop Grid */}
      {peers.length > 0 ? (
        <div className="w-full max-w-2xl flex flex-col items-center">
          <p className="text-sm font-medium text-neutral-400 mb-8">
            Toca un dispositivo para enviarle un archivo
          </p>

          <div className="flex flex-wrap items-center justify-center gap-8">
            {peers.map((peer) => {
              const isOver = dragOverPeerId === peer.peerId;
              const isBt = peer.transportType === 'bluetooth';

              return (
                <div
                  key={peer.peerId}
                  onClick={() => onDeviceClick(peer)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverPeerId(peer.peerId);
                  }}
                  onDragLeave={() => setDragOverPeerId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverPeerId(null);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      onDropOnDevice(peer, e.dataTransfer.files);
                    }
                  }}
                  className="flex flex-col items-center cursor-pointer group transition-transform duration-200 hover:-translate-y-1"
                >
                  {/* AirDrop Device Circle */}
                  <div
                    className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-md ${
                      isOver
                        ? 'bg-cyan-500/20 border-2 border-cyan-400 scale-105 shadow-xl shadow-cyan-500/30'
                        : 'bg-neutral-900 border border-neutral-700/80 group-hover:border-cyan-400 group-hover:bg-neutral-850 shadow-lg shadow-black/40'
                    }`}
                  >
                    {isBt && (
                      <div
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/40"
                        title="Conectado por Bluetooth BLE"
                      >
                        <Bluetooth className="w-3 h-3" />
                      </div>
                    )}

                    <div
                      className={`transition-colors ${
                        isOver
                          ? 'text-cyan-300'
                          : isBt
                          ? 'text-blue-300 group-hover:text-blue-400'
                          : 'text-neutral-200 group-hover:text-cyan-400'
                      }`}
                    >
                      <DeviceIcon
                        os={peer.os}
                        deviceType={peer.deviceType}
                        className="w-10 h-10 sm:w-12 sm:h-12"
                      />
                    </div>
                  </div>

                  {/* Device Name */}
                  <p className="mt-3 text-xs sm:text-sm font-medium text-neutral-200 group-hover:text-cyan-300 truncate max-w-[130px] transition-colors text-center">
                    {peer.name}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 flex items-center gap-3">
            <button
              onClick={onScanBluetooth}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-blue-400 hover:bg-neutral-900 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
              <span>Buscar por Bluetooth</span>
            </button>
          </div>
        </div>
      ) : (
        /* If no peers: Pure, Minimalist AirDrop Radar */
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          {/* Radar Circles */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center my-3">
            <div className="absolute inset-0 rounded-full border border-neutral-800/80 pointer-events-none" />
            <div className="absolute inset-8 rounded-full border border-neutral-800/60 pointer-events-none" />

            {/* Radar waves */}
            <div className="absolute w-24 h-24 rounded-full border border-cyan-500/25 radar-wave-1 pointer-events-none" />
            <div className="absolute w-24 h-24 rounded-full border border-blue-500/15 radar-wave-2 pointer-events-none" />

            {/* Center Device Icon */}
            <div className="relative z-10 w-18 h-18 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center text-cyan-400 shadow-xl">
              <DeviceIcon os={myDevice.os} deviceType={myDevice.deviceType} className="w-8 h-8" />
            </div>
          </div>

          <p className="text-sm font-medium text-neutral-300 mt-2">
            Buscando dispositivos cercanos...
          </p>
          <p className="text-xs text-neutral-500 mt-1 max-w-xs">
            Abre este enlace en tu otro dispositivo o busca por Bluetooth:
          </p>

          {/* Quick Actions Row */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={onScanBluetooth}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-xs font-medium text-neutral-200 hover:text-blue-400 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
              <span>Buscar por Bluetooth</span>
            </button>

            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar enlace</span>
                </>
              )}
            </button>
          </div>

          {/* Clean QR code */}
          <div className="mt-4 p-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col items-center">
            {inlineQrUrl ? (
              <div
                className="p-2 bg-white rounded-xl shadow-inner cursor-pointer"
                onClick={onOpenQR}
                title="Ampliar QR"
              >
                <img src={inlineQrUrl} alt="QR de conexión" className="w-32 h-32" />
              </div>
            ) : (
              <div className="w-32 h-32 bg-neutral-950 flex items-center justify-center text-xs text-neutral-500 rounded-xl">
                Cargando...
              </div>
            )}
            <p className="text-[11px] text-neutral-400 mt-2 flex items-center gap-1.5">
              <Smartphone className="w-3 h-3 text-cyan-400" />
              <span>Escanea con la cámara de tu móvil</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
