import React from 'react';
import { TransferSession } from '../types';
import { formatBytes, formatSpeed, truncateFilename } from '../utils/formatters';
import { FileTypeIcon, DeviceIcon } from './DeviceIcons';
import { X, CheckCircle, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface SimpleTransferCardProps {
  session: TransferSession;
  onCancel: () => void;
  onClose: () => void;
}

export function SimpleTransferCard({
  session,
  onCancel,
  onClose,
}: SimpleTransferCardProps) {
  const percent = session.totalSize > 0
    ? Math.min(100, Math.round((session.transferredBytes / session.totalSize) * 100))
    : 0;

  const currentFile = session.files[session.currentFileIndex] || session.files[0];
  const isCompleted = session.status === 'completed';
  const isError = session.status === 'error';
  const isCancelled = session.status === 'cancelled';
  const isRejected = session.status === 'rejected';

  return (
    <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-96 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
        {/* Top row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            {session.direction === 'send' ? (
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
            )}
            <span className="text-xs font-semibold text-neutral-200">
              {session.direction === 'send'
                ? `Enviando a ${session.peerName}`
                : `Recibiendo de ${session.peerName}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono tabular-nums font-semibold text-cyan-400">
              {isCompleted ? '100%' : `${percent}%`}
            </span>
            {!isCompleted && !isError && !isCancelled && !isRejected ? (
              <button
                onClick={onCancel}
                title="Cancelar transferencia"
                className="text-neutral-500 hover:text-rose-400 transition-colors p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-white transition-colors p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* File name & size */}
        <div className="flex items-center gap-2 text-xs text-neutral-300 mb-2">
          <FileTypeIcon mimeType={currentFile?.type} name={currentFile?.name} className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="truncate font-medium flex-1" title={currentFile?.name}>
            {truncateFilename(currentFile?.name || 'Archivo', 28)}
          </span>
          <span className="text-neutral-400 font-mono tabular-nums text-[11px] shrink-0">
            {formatBytes(session.totalSize)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-neutral-950 overflow-hidden mb-2">
          <div
            className={`h-full transition-all duration-200 ${
              isCompleted
                ? 'bg-emerald-500'
                : isError || isCancelled || isRejected
                ? 'bg-rose-500'
                : 'bg-cyan-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Bottom stats / Status */}
        <div className="flex items-center justify-between text-[11px] text-neutral-400">
          <span>
            {isCompleted ? (
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> ¡Transferencia completada!
              </span>
            ) : isError ? (
              <span className="text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Conexión interrumpida
              </span>
            ) : isRejected ? (
              <span className="text-amber-400">Rechazado por el destinatario</span>
            ) : isCancelled ? (
              <span className="text-neutral-400">Transferencia cancelada</span>
            ) : (
              `${formatBytes(session.transferredBytes)} de ${formatBytes(session.totalSize)}`
            )}
          </span>

          {!isCompleted && !isError && !isCancelled && !isRejected && (
            <span className="font-mono tabular-nums text-neutral-300 font-medium">
              {formatSpeed(session.speedBps)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
