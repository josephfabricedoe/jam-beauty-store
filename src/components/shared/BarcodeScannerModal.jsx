import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Zap, ZapOff, CheckCircle2, AlertCircle } from 'lucide-react';

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
}

export default function BarcodeScannerModal({ isOpen, onClose, onScan, title = 'Scan Product Barcode' }) {
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState('');

  const html5QrCodeRef = useRef(null);
  const containerId = 'jam-modal-barcode-reader';

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    } catch (e) {
      console.warn('Error stopping scanner:', e);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedCode('');
      setManualInput('');
      setTorchOn(false);
      setHasTorch(false);
      setError('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];

        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport,
          verbose: false,
        });
        html5QrCodeRef.current = scanner;

        const onScanSuccess = async (decodedText) => {
          if (!decodedText) return;
          const clean = decodedText.trim();
          // Stop immediately to prevent continuous duplicate multi-scans
          setScannedCode(clean);
          playBeep();
          if (navigator.vibrate) navigator.vibrate(100);

          await stopScanner();

          // Briefly show success checkmark then return value
          setTimeout(() => {
            onScan(clean);
            onClose();
          }, 350);
        };

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 280, height: 160 },
            aspectRatio: 1.777778,
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          },
          onScanSuccess,
          () => {}
        );

        // Check torch capability
        try {
          const videoElem = document.querySelector(`#${containerId} video`);
          if (videoElem && videoElem.srcObject) {
            const track = videoElem.srcObject.getVideoTracks()[0];
            const caps = track.getCapabilities ? track.getCapabilities() : {};
            if (caps.torch) setHasTorch(true);
          }
        } catch (e) {}
      } catch (err) {
        console.error('Barcode camera error:', err);
        setError('Camera unavailable. You can type the barcode manually below.');
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const toggleTorch = async () => {
    try {
      const videoElem = document.querySelector(`#${containerId} video`);
      if (videoElem && videoElem.srcObject) {
        const track = videoElem.srcObject.getVideoTracks()[0];
        const next = !torchOn;
        await track.applyConstraints({ advanced: [{ torch: next }] });
        setTorchOn(next);
      }
    } catch (e) {
      alert('Torch is not supported on this device camera.');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-3">
        {/* Scanner Viewport */}
        <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-[#efaa9b]/60 shadow-2xl">
          <div id={containerId} className="w-full h-64 bg-black relative" />

          {/* Animated Laser Overlay */}
          {!scannedCode && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-72 h-36 border-2 border-[#efaa9b] rounded-xl overflow-hidden shadow-[0_0_20px_rgba(239,170,155,0.4)]">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white" />
                <div className="scanner-line" />
              </div>
            </div>
          )}

          {/* Top Controls */}
          <div className="absolute top-2 inset-x-2 flex items-center justify-between pointer-events-auto px-2">
            <span className="text-[11px] font-semibold text-white bg-black/70 px-3 py-1 rounded-full border border-slate-700">
              {scannedCode ? `Scanned: ${scannedCode}` : 'Point at 1 product barcode'}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleTorch}
                title={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                className={`p-2 rounded-full transition-colors ${
                  torchOn
                    ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/50'
                    : 'bg-black/60 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Successful single scan confirmation overlay */}
          {scannedCode && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
              <p className="text-white font-bold text-sm">Barcode Scanned (1 Item Added)</p>
              <p className="font-mono text-[#efaa9b] text-base font-bold mt-1">{scannedCode}</p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-amber-400 flex items-center gap-1.5 bg-amber-950/40 border border-amber-800/40 p-2.5 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {/* Manual Barcode Input */}
        <form onSubmit={handleManualSubmit} className="flex gap-2 pt-1">
          <input
            type="text"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            placeholder="Or enter barcode numbers manually..."
            className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-sm font-bold transition-colors"
          >
            Apply
          </button>
        </form>
      </div>
    </Modal>
  );
}
