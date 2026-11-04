import React from 'react';
import { Radio, Volume2, VolumeX, QrCode, Cloud, ShieldCheck } from 'lucide-react';
import { DeviceOS, DeviceType } from '../types';
import { DeviceIcon } from './DeviceIcons';

interface HeaderProps {
  activeTab: 'radar' | 'vault';
  setActiveTab: (tab: 'radar' | 'vault') => void;
  onOpenPairing: () => void;
  onOpenSettings: () => void;
  deviceName: string;
  deviceOs: DeviceOS;
  deviceType: DeviceType;
  roomCode: string;
  isMuted: boolean;
  onToggleMute: () => void;
  connectedPeersCount: number;
}

export function Header({
  activeTab,
  setActiveTab,
  onOpenPairing,
  onOpenSettings,
  deviceName,
  deviceOs,
  deviceType,
  roomCode,
  isMuted,
  onToggleMute,
  connectedPeersCount,
}: HeaderProps) {
  return (
    <header className="w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
              DropLink <span className="text-cyan-400 font-semibold">P2P</span>
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-400">
          <button
            onClick={() => setActiveTab('radar')}
            className={`transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'radar'
                ? 'text-cyan-400 font-semibold'
                : 'hover:text-neutral-200'
            }`}
          >
            Radar AirDrop
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'vault'
                ? 'text-cyan-400 font-semibold'
                : 'hover:text-neutral-200'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Sincronización en Nube</span>
          </button>

          <button
            onClick={onOpenPairing}
            className="transition-colors whitespace-nowrap hover:text-neutral-200 cursor-pointer flex items-center gap-1.5"
          >
            <QrCode className="w-4 h-4" />
            <span>Emparejar Dispositivo</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="transition-colors whitespace-nowrap hover:text-neutral-200 cursor-pointer flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Cifrado E2EE</span>
          </button>
        </nav>

        {/* Zone 3: Device Indicator & Quick Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Sound Mute Toggle */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Activar sonidos' : 'Silenciar sonidos'}
            className="w-9 h-9 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Current Device Profile Pill */}
          <button
            onClick={onOpenSettings}
            className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/90 text-xs text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors cursor-pointer"
          >
            <div className="text-cyan-400">
              <DeviceIcon os={deviceOs} deviceType={deviceType} className="w-4 h-4" />
            </div>
            <span className="font-medium max-w-[130px] truncate">{deviceName}</span>
            <span className="text-neutral-500">·</span>
            <span className="font-mono text-neutral-400 text-[11px]">{roomCode}</span>
          </button>

          {/* Primary Quick Pairing / Connect CTA */}
          <button
            onClick={onOpenPairing}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm shadow-cyan-600/30 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Código QR</span>
          </button>
        </div>
      </div>
    </header>
  );
}
