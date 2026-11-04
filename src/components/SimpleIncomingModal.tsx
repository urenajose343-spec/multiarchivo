import React from 'react';
import { IncomingTransferRequest } from '../types';
import { formatBytes, truncateFilename } from '../utils/formatters';
import { DeviceIcon, FileTypeIcon } from './DeviceIcons';
import { Download, X } from 'lucide-react';

interface SimpleIncomingModalProps {
  request: IncomingTransferRequest;
  onAccept: () => void;
  onReject: () => void;
}

export function SimpleIncomingModal({
  request,
  onAccept,
  onReject,
}: SimpleIncomingModalProps) {
  const file = request.files[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700/90 rounded-3xl p-6 shadow-2xl text-center">
        {/* Sender Device Icon */}
        <div className="w-16 h-16 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center mx-auto text-cyan-400 shadow-xl mb-4">
          <DeviceIcon os={request.sender.os} deviceType={request.sender.deviceType} className="w-8 h-8" />
        </div>

        <h3 className="text-base font-bold text-white tracking-tight">
          {request.sender.name}
        </h3>
        <p className="text-xs text-neutral-400 mt-0.5">
          quiere enviarte un archivo
        </p>

        {/* File preview */}
        <div className="my-5 p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800/80 flex items-center gap-3 text-left">
          <div className="text-cyan-400 shrink-0">
            <FileTypeIcon mimeType={file?.type} name={file?.name} className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-neutral-100 truncate" title={file?.name}>
              {truncateFilename(file?.name || 'Archivo', 28)}
            </p>
            <p className="text-[11px] font-mono tabular-nums text-neutral-400 mt-0.5">
              {formatBytes(request.totalSize)}
              {request.files.length > 1 && ` · (${request.files.length} archivos)`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onReject}
            className="py-2.5 px-4 rounded-xl border border-neutral-800 bg-neutral-950 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/60 transition-colors cursor-pointer"
          >
            Rechazar
          </button>

          <button
            onClick={onAccept}
            className="py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Descargar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
