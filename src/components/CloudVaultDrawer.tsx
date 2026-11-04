import React, { useState } from 'react';
import { CloudVaultFile } from '../types';
import { formatBytes, formatTimeRemaining, formatRelativeTime, truncateFilename } from '../utils/formatters';
import { FileTypeIcon, DeviceIcon } from './DeviceIcons';
import {
  Cloud,
  Download,
  Copy,
  Check,
  Trash2,
  QrCode,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Clock,
  UploadCloud,
} from 'lucide-react';
import QRCode from 'qrcode';

interface CloudVaultDrawerProps {
  files: CloudVaultFile[];
  onRefresh: () => void;
  onDeleteFile: (id: string) => void;
  onDirectUpload: (file: File) => void;
  isUploading: boolean;
  roomCode: string;
}

export function CloudVaultDrawer({
  files,
  onRefresh,
  onDeleteFile,
  onDirectUpload,
  isUploading,
  roomCode,
}: CloudVaultDrawerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const handleCopyLink = async (id: string) => {
    const url = `${window.location.origin}/api/vault/download/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShowQr = async (id: string) => {
    const url = `${window.location.origin}/api/vault/download/${id}`;
    setQrModalUrl(url);
    try {
      const dataUri = await QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUri);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-6 sm:py-8 px-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Bóveda de Sincronización en la Nube
              </h2>
              <p className="text-xs text-neutral-400">
                Archivos sincronizados temporalmente con cifrado AES-256 para descarga asíncrona entre dispositivos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="px-3.5 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-xs font-medium text-neutral-300 hover:text-white hover:border-neutral-700 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Cloud Direct Upload Banner */}
      <div className="my-6 p-4 rounded-2xl bg-gradient-to-r from-blue-950/20 via-cyan-950/20 to-neutral-900/40 border border-neutral-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-cyan-400 flex items-center justify-center shrink-0">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-200">
              Subir directamente a la Bóveda Nube
            </span>
            <p className="text-[11px] text-neutral-400">
              Si tu otro dispositivo está apagado o en otra red, súbelo aquí para sincronizarlo al instante.
            </p>
          </div>
        </div>

        <label className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0">
          <input
            type="file"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onDirectUpload(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
          <Cloud className="w-4 h-4" />
          <span>{isUploading ? 'Subiendo archivo...' : 'Seleccionar archivo'}</span>
        </label>
      </div>

      {/* Cloud Files List */}
      {files.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-neutral-800 rounded-3xl bg-neutral-950/40">
          <Cloud className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="mt-3 text-sm font-semibold text-neutral-300">
            No hay archivos sincronizados en la nube
          </h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            Al enviar un archivo con la opción "Sincronización en la nube" activada, aparecerá aquí disponible para todos tus dispositivos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* File Info */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-cyan-400 shrink-0">
                  <FileTypeIcon mimeType={file.mimeType} name={file.name} className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-neutral-100 truncate" title={file.name}>
                      {truncateFilename(file.name, 40)}
                    </h4>
                    {file.isEncrypted && (
                      <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.5 rounded">
                        E2EE Cifrado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
                    <span className="font-mono tabular-nums text-neutral-300">
                      {formatBytes(file.size)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Subido por {file.senderName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeRemaining(file.expiresAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                {/* QR Code */}
                <button
                  onClick={() => handleShowQr(file.id)}
                  title="Mostrar Código QR para escanear en móvil"
                  className="p-2 rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                </button>

                {/* Copy Link */}
                <button
                  onClick={() => handleCopyLink(file.id)}
                  title="Copiar enlace seguro de descarga"
                  className="p-2 rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                >
                  {copiedId === file.id ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span className="hidden sm:inline">Copiar enlace</span>
                    </>
                  )}
                </button>

                {/* Direct Download */}
                <a
                  href={`/api/vault/download/${file.id}`}
                  download={file.name}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-cyan-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar</span>
                </a>

                {/* Delete File */}
                <button
                  onClick={() => onDeleteFile(file.id)}
                  title="Eliminar de la nube"
                  className="p-2 rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-rose-400 hover:border-rose-900/40 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Modal */}
      {qrModalUrl && qrDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl text-center">
            <h3 className="text-sm font-bold text-white">Escanear para Descargar en Móvil</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Apunta con la cámara de tu iPhone o Android para descargar el archivo directamente.
            </p>

            <div className="my-5 p-4 bg-white rounded-2xl w-fit mx-auto shadow-inner">
              <img src={qrDataUrl} alt="QR Descarga" className="w-56 h-56" />
            </div>

            <button
              onClick={() => {
                setQrModalUrl(null);
                setQrDataUrl(null);
              }}
              className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
