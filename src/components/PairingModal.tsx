import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, Camera, Share2, X, RefreshCw } from 'lucide-react';

interface PairingModalProps {
  roomCode: string;
  onChangeRoom: (newRoom: string) => void;
  onClose: () => void;
}

export function PairingModal({ roomCode, onChangeRoom, onClose }: PairingModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [customCode, setCustomCode] = useState(roomCode);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fullShareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`
    : '';

  useEffect(() => {
    if (fullShareUrl) {
      QRCode.toDataURL(fullShareUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#030712',
          light: '#ffffff',
        },
      }).then((url) => setQrDataUrl(url));
    }
  }, [fullShareUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'DropLink P2P - AirDrop Multiplataforma',
          text: `Conéctate a mi sala ${roomCode} para enviarme archivos rápidamente:`,
          url: fullShareUrl,
        });
      } catch (e) {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  const handleStartScanner = async () => {
    try {
      setIsScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert('No se pudo acceder a la cámara. Comprueba los permisos.');
      setIsScanning(false);
    }
  };

  const handleStopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Emparejar Dispositivos
              </h3>
              <p className="text-[11px] text-neutral-400">
                Multiplataforma iOS · Android · Mac · Windows · Linux
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              handleStopScanner();
              onClose();
            }}
            className="w-8 h-8 rounded-lg text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Scanner View */}
        {isScanning ? (
          <div className="my-5 text-center">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-w-[280px] mx-auto border border-neutral-700">
              <video ref={videoRef} className="w-full h-full object-cover" />
              <div className="absolute inset-8 border-2 border-cyan-400/80 rounded-xl pointer-events-none" />
              <p className="absolute bottom-3 inset-x-0 text-center text-[11px] text-white/90 bg-black/50 py-1">
                Apunta al código QR de la otra pantalla
              </p>
            </div>
            <button
              onClick={handleStopScanner}
              className="mt-3 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar escaneo
            </button>
          </div>
        ) : (
          <div className="my-5 text-center">
            {/* QR Code Container */}
            <div className="p-4 bg-white rounded-2xl w-fit mx-auto shadow-xl">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Pairing" className="w-52 h-52 sm:w-60 sm:h-60" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-neutral-400 text-xs">
                  Generando QR...
                </div>
              )}
            </div>

            <p className="text-xs text-neutral-300 mt-4">
              Escanea este código con la cámara de tu móvil para entrar a la misma sala AirDrop.
            </p>

            {/* Room Code Display */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-xs text-neutral-500">Código de Sala:</span>
              <span className="text-sm font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800">
                {roomCode}
              </span>
            </div>
          </div>
        )}

        {/* Room Code Manual Entry / Change */}
        <div className="pt-4 border-t border-neutral-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customCode.trim()) {
                onChangeRoom(customCode.trim().toUpperCase());
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder="Unirse a sala (ej. OFICINA)"
              className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-neutral-600 outline-none transition-colors"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Cambiar
            </button>
          </form>
        </div>

        {/* Actions Row */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={handleCopy}
            className="py-2.5 px-3 rounded-xl border border-neutral-800 bg-neutral-950 text-xs font-medium text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Enlace</span>
              </>
            )}
          </button>

          <button
            onClick={handleNativeShare}
            className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartir</span>
          </button>
        </div>

        {/* Camera Scanner Button */}
        {!isScanning && (
          <button
            onClick={handleStartScanner}
            className="w-full mt-2 py-2 rounded-xl border border-neutral-800/80 bg-neutral-950/60 text-xs font-medium text-neutral-400 hover:text-cyan-400 hover:border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Escanear QR de otro dispositivo con la cámara</span>
          </button>
        )}
      </div>
    </div>
  );
}
