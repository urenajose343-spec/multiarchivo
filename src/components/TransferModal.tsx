import React from 'react';
import {
  ShieldCheck,
  Pause,
  Play,
  XCircle,
  CheckCircle,
  AlertCircle,
  Zap,
  ArrowRight,
  HardDrive,
} from 'lucide-react';
import { TransferSession } from '../types';
import { formatBytes, formatSpeed, formatDuration, truncateFilename } from '../utils/formatters';
import { DeviceIcon } from './DeviceIcons';

interface TransferModalProps {
  session: TransferSession;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export function TransferModal({
  session,
  onPause,
  onResume,
  onCancel,
  onClose,
}: TransferModalProps) {
  const progressPercent = Math.min(
    100,
    session.totalSize > 0
      ? Math.round((session.transferredBytes / session.totalSize) * 100)
      : 0
  );

  const currentFile = session.files[session.currentFileIndex] || session.files[0];
  const isCompleted = session.status === 'completed';
  const isError = session.status === 'error';
  const isCancelled = session.status === 'cancelled';
  const isRejected = session.status === 'rejected';
  const isWaiting = session.status === 'requesting' || session.status === 'waiting_accept';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Title & Encryption Badge */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {session.direction === 'send' ? 'Enviando Archivos' : 'Recibiendo Archivos'}
              </h3>
              <p className="text-[11px] text-neutral-400">
                {session.transport === 'webrtc' ? 'Conexión Directa WebRTC P2P' : 'Canal Relay Cifrado'}
              </p>
            </div>
          </div>

          {session.isEncrypted && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-cyan-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>E2EE {session.authFingerprint}</span>
            </div>
          )}
        </div>

        {/* Sender -> Recipient Visualizer */}
        <div className="my-6 p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 flex items-center justify-between">
          {/* Node 1 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-cyan-400">
              <DeviceIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-neutral-200">
                {session.direction === 'send' ? 'Este Dispositivo' : session.peerName}
              </span>
              <p className="text-[10px] text-neutral-500">
                {session.direction === 'send' ? 'Emisor' : 'Remitente'}
              </p>
            </div>
          </div>

          {/* Animated Connecting Channel */}
          <div className="flex-1 mx-4 flex flex-col items-center">
            <div className="w-full flex items-center justify-center relative">
              <div className="w-full h-0.5 bg-neutral-800 relative overflow-hidden">
                {!isCompleted && !isError && !isCancelled && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
                )}
              </div>
              <div className="absolute bg-neutral-950 px-1 text-cyan-400">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-[10px] font-mono tabular-nums text-neutral-400 mt-1">
              {formatSpeed(session.speedBps)}
            </span>
          </div>

          {/* Node 2 */}
          <div className="flex items-center gap-3 text-right">
            <div>
              <span className="text-xs font-semibold text-neutral-200">
                {session.direction === 'send' ? session.peerName : 'Este Dispositivo'}
              </span>
              <p className="text-[10px] text-neutral-500">
                {session.direction === 'send' ? 'Destinatario' : 'Receptor'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-blue-400">
              <DeviceIcon os={session.peerOs} deviceType={session.peerDeviceType} className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Current File Information */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-neutral-200 truncate max-w-[280px]">
              {truncateFilename(currentFile?.name || 'Archivo', 36)}
            </span>
            <span className="font-mono tabular-nums text-neutral-400 text-[11px]">
              Archivo {session.currentFileIndex + 1} de {session.files.length}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 rounded-full bg-neutral-950 border border-neutral-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isCompleted
                  ? 'bg-emerald-500'
                  : isError || isCancelled || isRejected
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Live Metrics Grid (Tabular Numerals) */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 mb-5">
          <div>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
              Progreso
            </span>
            <span className="text-xs font-mono tabular-nums font-semibold text-neutral-200">
              {progressPercent}%
            </span>
            <span className="text-[10px] font-mono tabular-nums text-neutral-400 block truncate">
              {formatBytes(session.transferredBytes)} / {formatBytes(session.totalSize)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
              Velocidad
            </span>
            <span className="text-xs font-mono tabular-nums font-semibold text-cyan-400">
              {isCompleted ? 'Finalizado' : formatSpeed(session.speedBps)}
            </span>
            <span className="text-[10px] text-neutral-400 block">
              {session.transport === 'webrtc' ? 'Canal P2P' : 'Relay'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
              Tiempo Restante
            </span>
            <span className="text-xs font-mono tabular-nums font-semibold text-neutral-200">
              {isCompleted ? '0s' : formatDuration(session.etaSeconds)}
            </span>
            <span className="text-[10px] font-mono tabular-nums text-neutral-400 block">
              Transcurrido: {formatDuration((Date.now() - session.startTime) / 1000)}
            </span>
          </div>
        </div>

        {/* Status Message / Notification */}
        {isWaiting && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-300 mb-5">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Esperando a que {session.peerName} acepte la transferencia...</span>
          </div>
        )}

        {isCompleted && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300 mb-5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>¡Transferencia completada con éxito! Integridad SHA-256 verificada.</span>
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 mb-5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Error en la transferencia: {session.errorMessage || 'Conexión interrumpida'}</span>
          </div>
        )}

        {isRejected && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 mb-5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>La transferencia fue rechazada por el destinatario.</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {session.status === 'transferring' && (
            <button
              onClick={onPause}
              className="px-3.5 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-xs font-medium text-neutral-300 hover:text-white hover:border-neutral-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pausar</span>
            </button>
          )}

          {session.status === 'paused' && (
            <button
              onClick={onResume}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Reanudar</span>
            </button>
          )}

          {!isCompleted && !isError && !isCancelled && !isRejected && (
            <button
              onClick={onCancel}
              className="px-3.5 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-xs font-medium text-rose-400 hover:bg-rose-950/20 hover:border-rose-900/50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>
          )}

          {(isCompleted || isError || isCancelled || isRejected) && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
