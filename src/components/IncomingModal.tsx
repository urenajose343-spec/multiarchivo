import React from 'react';
import { IncomingTransferRequest } from '../types';
import { formatBytes, truncateFilename } from '../utils/formatters';
import { DeviceIcon, FileTypeIcon } from './DeviceIcons';
import { ShieldCheck, Download, X } from 'lucide-react';

interface IncomingModalProps {
  request: IncomingTransferRequest;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingModal({ request, onAccept, onReject }: IncomingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />

        {/* Sender Header */}
        <div className="text-center my-3">
          <div className="w-16 h-16 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center mx-auto text-cyan-400 shadow-xl shadow-cyan-950/40">
            <DeviceIcon os={request.sender.os} deviceType={request.sender.deviceType} className="w-8 h-8" />
          </div>

          <h3 className="mt-4 text-base font-bold text-white tracking-tight">
            {request.sender.name}
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            quiere compartir{' '}
            <span className="font-semibold text-neutral-200">
              {request.files.length} {request.files.length === 1 ? 'archivo' : 'archivos'}
            </span>{' '}
            contigo ({formatBytes(request.totalSize)})
          </p>
        </div>

        {/* Files Preview Box */}
        <div className="my-5 p-3 rounded-2xl bg-neutral-950/80 border border-neutral-800/80 max-h-48 overflow-y-auto space-y-2">
          {request.files.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="text-cyan-400 shrink-0">
                  <FileTypeIcon mimeType={file.type} name={file.name} className="w-4 h-4" />
                </div>
                <span className="text-neutral-200 truncate font-medium" title={file.name}>
                  {truncateFilename(file.name, 32)}
                </span>
              </div>
              <span className="font-mono tabular-nums text-neutral-400 text-[11px] shrink-0">
                {formatBytes(file.size)}
              </span>
            </div>
          ))}
        </div>

        {/* Security Fingerprint */}
        {request.isEncrypted && (
          <div className="mb-6 flex items-center justify-between px-3.5 py-2 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-xs">
            <div className="flex items-center gap-2 text-cyan-300">
              <ShieldCheck className="w-4 h-4" />
              <span>Cifrado E2EE Verificado</span>
            </div>
            <span className="font-mono font-semibold text-cyan-300">
              {request.authFingerprint}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onReject}
            className="py-3 px-4 rounded-xl border border-neutral-800 bg-neutral-950 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Rechazar</span>
          </button>

          <button
            onClick={onAccept}
            className="py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-bold transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Aceptar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
