import React, { useRef } from 'react';
import { UploadCloud, X, Send, Lock, Cloud, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { StagedFile, PeerInfo } from '../types';
import { formatBytes } from '../utils/formatters';
import { FileTypeIcon, DeviceIcon } from './DeviceIcons';

interface FileStagingProps {
  stagedFiles: StagedFile[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (id: string) => void;
  onClearFiles: () => void;
  peers: PeerInfo[];
  selectedPeer: PeerInfo | null;
  onSelectPeer: (peer: PeerInfo | null) => void;
  onSendP2P: () => void;
  onUploadToCloud: () => void;
  isEncrypted: boolean;
  setIsEncrypted: (enc: boolean) => void;
  autoCloudSync: boolean;
  setAutoCloudSync: (sync: boolean) => void;
  isUploadingCloud: boolean;
}

export function FileStaging({
  stagedFiles,
  onAddFiles,
  onRemoveFile,
  onClearFiles,
  peers,
  selectedPeer,
  onSelectPeer,
  onSendP2P,
  onUploadToCloud,
  isEncrypted,
  setIsEncrypted,
  autoCloudSync,
  setAutoCloudSync,
  isUploadingCloud,
}: FileStagingProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="w-full bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 sm:p-6 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Archivos para Enviar
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Soporta cualquier tamaño (vídeos 4K, imágenes RAW, carpetas ZIP o ISOs sin límite).
          </p>
        </div>

        {stagedFiles.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400">
              <span className="font-semibold text-neutral-200">{stagedFiles.length}</span> {stagedFiles.length === 1 ? 'archivo' : 'archivos'}
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-neutral-200">{formatBytes(totalSize)}</span>
            </span>
            <button
              onClick={onClearFiles}
              className="text-xs text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Vaciar
            </button>
          </div>
        )}
      </div>

      {/* Dropzone Area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="mt-4 border-2 border-dashed border-neutral-800 hover:border-cyan-500/50 rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-colors bg-neutral-950/40 hover:bg-neutral-900/40 group"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onAddFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 group-hover:border-cyan-500/40 flex items-center justify-center mx-auto text-neutral-400 group-hover:text-cyan-400 transition-colors">
          <UploadCloud className="w-6 h-6" />
        </div>
        <p className="mt-3 text-sm font-semibold text-neutral-200 group-hover:text-white">
          Arrastra tus archivos aquí o haz clic para explorar
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Transferencia directa P2P WebRTC cifrada sin pasar por servidores de terceros
        </p>
      </div>

      {/* Staged File List */}
      {stagedFiles.length > 0 && (
        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-1">
          {stagedFiles.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-xl bg-neutral-950/70 border border-neutral-800/90 hover:border-neutral-700/80 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-cyan-400 shrink-0">
                  <FileTypeIcon mimeType={item.type} name={item.name} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-200 truncate" title={item.name}>
                    {item.name}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                    <span className="font-mono tabular-nums">{formatBytes(item.size)}</span>
                    {item.sha256 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[10px] text-cyan-400" title={`SHA256: ${item.sha256}`}>
                          SHA-256 verificado
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(item.id);
                }}
                className="w-7 h-7 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-800/50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Target Peer Selector */}
      {stagedFiles.length > 0 && (
        <div className="mt-5 pt-4 border-t border-neutral-800/80">
          <label className="block text-xs font-semibold text-neutral-300 mb-2">
            Dispositivo de destino en el Radar:
          </label>

          {peers.length === 0 ? (
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-400">
              No hay dispositivos cercanos en línea ahora. Puedes subirlo a la <strong className="text-cyan-400">Bóveda Nube</strong> para sincronizarlo cuando se conecte o compartir un enlace.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {peers.map((peer) => {
                const isSelected = selectedPeer?.peerId === peer.peerId;
                return (
                  <button
                    key={peer.peerId}
                    onClick={() => onSelectPeer(isSelected ? null : peer)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500 text-white shadow-sm shadow-cyan-900/30'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-neutral-900 text-neutral-400'}`}>
                      <DeviceIcon os={peer.os} deviceType={peer.deviceType} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{peer.name}</p>
                      <p className="text-[10px] text-neutral-400 capitalize">
                        {peer.os} · {peer.deviceType}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Security & Cloud Sync Options */}
      {stagedFiles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-xs font-medium text-neutral-200">
                  Cifrado de Extremo a Extremo (E2EE)
                </span>
                <p className="text-[11px] text-neutral-400">
                  Cifrado militar AES-GCM 256 bits punto a punto
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isEncrypted}
              onChange={(e) => setIsEncrypted(e.target.checked)}
              className="w-4 h-4 rounded text-cyan-500 bg-neutral-900 border-neutral-700 focus:ring-cyan-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-xs font-medium text-neutral-200">
                  Sincronización automática en la nube
                </span>
                <p className="text-[11px] text-neutral-400">
                  Guarda una copia segura cifrada temporal para descargar desde cualquier lugar
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoCloudSync}
              onChange={(e) => setAutoCloudSync(e.target.checked)}
              className="w-4 h-4 rounded text-blue-500 bg-neutral-900 border-neutral-700 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {stagedFiles.length > 0 && (
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onSendP2P}
            disabled={!selectedPeer}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              selectedPeer
                ? 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 shadow-md shadow-cyan-500/20'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>
              {selectedPeer ? `Enviar a ${selectedPeer.name}` : 'Selecciona un dispositivo del Radar'}
            </span>
          </button>

          <button
            onClick={onUploadToCloud}
            disabled={isUploadingCloud}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Cloud className="w-4 h-4 text-cyan-400" />
            <span>
              {isUploadingCloud ? 'Subiendo a la nube...' : 'Subir a Bóveda Nube'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
