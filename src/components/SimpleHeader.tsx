import React, { useState } from 'react';
import { Radio, Volume2, VolumeX, QrCode, Edit2, Check } from 'lucide-react';
import { DeviceOS, DeviceType } from '../types';
import { DeviceIcon } from './DeviceIcons';

interface SimpleHeaderProps {
  deviceName: string;
  onUpdateDeviceName: (name: string) => void;
  deviceOs: DeviceOS;
  deviceType: DeviceType;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenQR: () => void;
  peersCount: number;
}

export function SimpleHeader({
  deviceName,
  onUpdateDeviceName,
  deviceOs,
  deviceType,
  isMuted,
  onToggleMute,
  onOpenQR,
}: SimpleHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(deviceName);

  const handleSave = () => {
    if (tempName.trim()) {
      onUpdateDeviceName(tempName.trim());
    }
    setIsEditing(false);
  };

  return (
    <header className="w-full border-b border-neutral-800/60 bg-neutral-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">
            DropLink
          </span>
        </div>

        {/* Current Device Name */}
        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-0.5">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                autoFocus
                className="bg-transparent text-xs text-white outline-none w-28 sm:w-36"
              />
              <button
                onClick={handleSave}
                className="text-cyan-400 hover:text-cyan-300 p-0.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setTempName(deviceName);
                setIsEditing(true);
              }}
              title="Cambiar nombre de dispositivo"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 transition-colors cursor-pointer"
            >
              <DeviceIcon os={deviceOs} deviceType={deviceType} className="w-3.5 h-3.5 text-cyan-400" />
              <span className="truncate max-w-[130px] font-medium">{deviceName}</span>
              <Edit2 className="w-2.5 h-2.5 text-neutral-500" />
            </button>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Activar sonido' : 'Silenciar'}
            className="w-7 h-7 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onOpenQR}
            className="px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-xs font-medium text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>Conectar</span>
          </button>
        </div>
      </div>
    </header>
  );
}
