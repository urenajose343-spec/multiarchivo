import React, { useState } from 'react';
import { X, ShieldCheck, HardDrive, Smartphone, Volume2, Key, Info, Check } from 'lucide-react';
import { DeviceOS, DeviceType } from '../types';

interface SettingsModalProps {
  deviceName: string;
  onUpdateDeviceName: (name: string) => void;
  encryptionPassphrase: string;
  onUpdatePassphrase: (pass: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  deviceOs: DeviceOS;
  deviceType: DeviceType;
  onClose: () => void;
}

export function SettingsModal({
  deviceName,
  onUpdateDeviceName,
  encryptionPassphrase,
  onUpdatePassphrase,
  isMuted,
  onToggleMute,
  deviceOs,
  deviceType,
  onClose,
}: SettingsModalProps) {
  const [name, setName] = useState(deviceName);
  const [pass, setPass] = useState(encryptionPassphrase);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateDeviceName(name);
    onUpdatePassphrase(pass);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Configuración y Seguridad
              </h3>
              <p className="text-[11px] text-neutral-400">
                Ajustes de dispositivo y cifrado P2P
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="my-5 space-y-4">
          {/* Device Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Nombre de este dispositivo (visible en el Radar):
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-600 outline-none transition-colors"
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              Detectado como {deviceOs.toUpperCase()} ({deviceType}).
            </p>
          </div>

          {/* Custom E2EE Passphrase */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Contraseña opcional de cifrado E2EE (AES-256):</span>
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Dejar en blanco para usar la clave de sala automática"
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-600 outline-none transition-colors font-mono"
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              Si defines una contraseña, el dispositivo receptor deberá tener la misma para descifrar los paquetes.
            </p>
          </div>

          {/* Sounds Toggle */}
          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-neutral-400" />
              <div>
                <span className="text-xs font-medium text-neutral-200">
                  Sonidos táctiles de transferencia
                </span>
                <p className="text-[11px] text-neutral-500">
                  Notificaciones auditivas suaves al detectar o finalizar envíos
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={!isMuted}
              onChange={onToggleMute}
              className="w-4 h-4 rounded text-cyan-500 bg-neutral-900 border-neutral-700 focus:ring-cyan-500 cursor-pointer"
            />
          </div>

          {/* Architecture info */}
          <div className="p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 text-[11px] text-neutral-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Arquitectura Punto a Punto (P2P)</span>
            </div>
            <p>
              • <strong>WebRTC DataChannel</strong> con control de contrapresión (chunks de 64 KB).
            </p>
            <p>
              • <strong>Web Crypto API</strong>: AES-GCM 256 bits y SHA-256 para validación de hash íntegra.
            </p>
            <p>
              • <strong>Multiplataforma universal</strong>: funciona en Safari (iOS/macOS), Chrome, Edge, Firefox y Android sin instalar drivers.
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-3">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <span>Guardar Cambios</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
