import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, X, Smartphone } from 'lucide-react';

interface SimpleQRModalProps {
  shareUrl: string;
  onClose: () => void;
}

export function SimpleQRModal({ shareUrl, onClose }: SimpleQRModalProps) {
  const [qrUrl, setQrUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#0a0a0a', light: '#ffffff' },
      }).then(setQrUrl);
    }
  }, [shareUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700/80 rounded-3xl p-6 shadow-2xl text-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-3">
          <Smartphone className="w-5 h-5" />
        </div>

        <h3 className="text-base font-bold text-white tracking-tight">
          Conectar otro Dispositivo
        </h3>
        <p className="text-xs text-neutral-400 mt-1">
          Apunta con la cámara de tu móvil para abrir la app y enviar archivos directamente:
        </p>

        {/* QR Image */}
        <div className="my-5 p-4 bg-white rounded-2xl w-fit mx-auto shadow-inner">
          {qrUrl ? (
            <img src={qrUrl} alt="Código QR de conexión" className="w-56 h-56" />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-xs text-neutral-500">
              Generando QR...
            </div>
          )}
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-xs font-semibold text-neutral-200 hover:text-white border border-neutral-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">¡Enlace copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-cyan-400" />
              <span>Copiar enlace directo</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
