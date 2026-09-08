import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Zap, ZapOff, CheckCircle2, AlertCircle, X, RotateCw } from 'lucide-react';

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Scan 1 Item (Camera will close automatically)',
}) {
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(true);
  const [zoomCapability, setZoomCapability] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [focusIndicator, setFocusIndicator] = useState({ x: 0, y: 0, active: false });
  const [scannedCode, setScannedCode] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [errorInfo, setErrorInfo] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  const html5QrCodeRef = useRef(null);
  const activeTrackRef = useRef(null);
  const isStoppingRef = useRef(false);
  const containerId = 'jam-modal-barcode-reader';

  const stopScanner = async () => {
    isStoppingRef.current = true;

    // 1. Turn off torch if running
    if (activeTrackRef.current) {
      try {
        await activeTrackRef.current.applyConstraints({ advanced: [{ torch: false }] });
      } catch (e) {}
      activeTrackRef.current = null;
    }

    // 2. Stop HTML5 barcode scanner
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
    } finally {
      isStoppingRef.current = false;
    }
  };

  const startScanner = async () => {
    if (isStarting || isStoppingRef.current) return;
    setIsStarting(true);
    setErrorInfo(null);

    try {
      // Clean up any lingering instance before starting
      await stopScanner();

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.CODE_93,
      ];

      const scanner = new Html5Qrcode(containerId, {
        formatsToSupport,
        verbose: false,
      });
      html5QrCodeRef.current = scanner;

      const onScanSuccess = async (decodedText) => {
        if (!decodedText || isStoppingRef.current) return;
        const clean = decodedText.trim();
        if (!clean) return;

        setScannedCode(clean);
        playBeep();
        if (navigator.vibrate) {
          navigator.vibrate([70, 40, 70]);
        }

        await stopScanner();

        setTimeout(() => {
          onScan(clean);
          onClose();
        }, 380);
      };

      // Determine camera to use (back camera prefered)
      let cameraIdOrConfig = { facingMode: 'environment' };
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const backCam = devices.find(d =>
            /back|rear|environment|macro|0/i.test(d.label)
          );
          if (backCam) {
            cameraIdOrConfig = backCam.id;
          } else {
            // Pick last camera (usually back camera on Android phones)
            cameraIdOrConfig = devices[devices.length - 1].id;
          }
        }
      } catch (camListErr) {
        // Fallback to environment facingMode string
        cameraIdOrConfig = { facingMode: 'environment' };
      }

      const scanConfig = {
        fps: 20,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      try {
        await scanner.start(cameraIdOrConfig, scanConfig, onScanSuccess, () => {});
      } catch (firstErr) {
        console.warn('Initial camera start failed, retrying with standard environment facingMode:', firstErr);
        // Fallback retry with simple { facingMode: 'environment' }
        await scanner.start({ facingMode: 'environment' }, scanConfig, onScanSuccess, () => {});
      }

      // Hardware camera track optimization (autofocus, auto-exposure, torch, zoom)
      try {
        const videoElem = document.querySelector(`#${containerId} video`);
        if (videoElem && videoElem.srcObject) {
          const stream = videoElem.srcObject;
          const track = stream.getVideoTracks()[0];
          if (track) {
            activeTrackRef.current = track;
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};

            if ('torch' in capabilities) {
              setHasTorch(true);
            }

            if (capabilities.zoom) {
              setZoomCapability({
                min: capabilities.zoom.min || 1,
                max: capabilities.zoom.max || 3,
                step: capabilities.zoom.step || 0.1,
              });
            }

            // Continuous autofocus, auto-exposure, auto-white balance
            const advanced = [];
            if (capabilities.focusMode?.includes('continuous')) {
              advanced.push({ focusMode: 'continuous' });
            }
            if (capabilities.exposureMode?.includes('continuous')) {
              advanced.push({ exposureMode: 'continuous' });
            }
            if (capabilities.whiteBalanceMode?.includes('continuous')) {
              advanced.push({ whiteBalanceMode: 'continuous' });
            }

            if (advanced.length > 0) {
              await track.applyConstraints({ advanced }).catch(() => {});
            }
          }
        }
      } catch (camOptErr) {
        console.warn('Advanced camera constraints not supported on this track:', camOptErr);
      }
    } catch (err) {
      console.error('Barcode camera error:', err);
      const isPermissionDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        /permission|allowed|denied/i.test(String(err));

      if (isPermissionDenied) {
        setErrorInfo({
          title: 'Camera Permission Denied',
          message: 'Please allow camera access in your browser settings (tap the lock/settings icon in your address bar).',
        });
      } else {
        setErrorInfo({
          title: 'Camera Initializing Notice',
          message: 'Could not access the rear camera. Tap "Retry Camera" or enter the barcode numbers manually below.',
        });
      }
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedCode('');
      setManualInput('');
      setTorchOn(false);
      setErrorInfo(null);
      setFocusIndicator({ x: 0, y: 0, active: false });
      return;
    }

    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => {
      startScanner();
    }, 120);

    return () => {
      document.body.style.overflow = '';
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const toggleTorch = async () => {
    if (!activeTrackRef.current) {
      alert('Camera is still loading. Please wait a moment.');
      return;
    }
    try {
      const next = !torchOn;
      await activeTrackRef.current.applyConstraints({
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
      alert('Flashlight is not supported by your mobile browser or device camera.');
    }
  };

  const cycleZoom = async () => {
    if (!activeTrackRef.current || !zoomCapability) return;
    try {
      const nextZoom = currentZoom >= 2 ? 1 : currentZoom === 1 ? 1.5 : 2;
      await activeTrackRef.current.applyConstraints({
        advanced: [{ zoom: nextZoom }],
      });
      setCurrentZoom(nextZoom);
    } catch (e) {
      console.warn('Zoom failed:', e);
    }
  };

  const handleTapToFocus = async (e) => {
    if (!activeTrackRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setFocusIndicator({ x, y, active: true });
    setTimeout(() => setFocusIndicator(prev => ({ ...prev, active: false })), 800);

    try {
      const caps = activeTrackRef.current.getCapabilities ? activeTrackRef.current.getCapabilities() : {};
      const advanced = [];
      if (caps.focusMode?.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }
      if (caps.exposureMode?.includes('continuous')) {
        advanced.push({ exposureMode: 'continuous' });
      }
      if (advanced.length > 0) {
        await activeTrackRef.current.applyConstraints({ advanced }).catch(() => {});
      }
    } catch (err) {
      console.warn('Refocus constraint failed:', err);
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-[#182234] border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-700/60">
          <h3 className="text-base sm:text-lg font-bold text-white leading-snug pr-3">
            Scan 1 Item (Camera will
            <br />
            close automatically)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mr-1 -mt-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            aria-label="Close scanner"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Camera Viewport */}
          <div
            onClick={handleTapToFocus}
            className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden bg-black border border-[#efaa9b]/70 shadow-2xl cursor-crosshair select-none"
          >
            {/* HTML5 QR Code Destination */}
            <div id={containerId} className="w-full h-full" />

            {/* Top-left Floating Pill */}
            <div className="absolute top-3 left-3 z-20 pointer-events-none">
              <span className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md text-white text-xs font-semibold border border-white/10 shadow-md">
                Point at 1 product barcode
              </span>
            </div>

            {/* Top-right Controls (Torch + Zoom) */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
              {zoomCapability && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleZoom();
                  }}
                  className="w-10 h-10 rounded-full bg-black/65 backdrop-blur-md text-white font-bold text-xs border border-white/20 flex items-center justify-center active:scale-90 transition-transform shadow-md"
                  title="Toggle Zoom"
                >
                  {currentZoom}x
                </button>
              )}

              {hasTorch && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTorch();
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 border shadow-md ${
                    torchOn
                      ? 'bg-amber-400 border-amber-300 text-slate-950 shadow-amber-400/50'
                      : 'bg-black/65 backdrop-blur-md text-white border-white/20 hover:border-white/40'
                  }`}
                  title={torchOn ? 'Turn off flash' : 'Turn on flash'}
                >
                  {torchOn ? (
                    <Zap className="w-5 h-5 fill-current" />
                  ) : (
                    <ZapOff className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>

            {/* Viewfinder Bounding Box */}
            {!scannedCode && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-[86%] h-[58%] rounded-2xl border-2 border-[#efaa9b] shadow-[0_0_20px_rgba(239,170,155,0.35)]">
                  {/* 4 White Corner Brackets */}
                  <div className="absolute -top-[3px] -left-[3px] w-6 h-6 border-t-[3.5px] border-l-[3.5px] border-white rounded-tl-xl" />
                  <div className="absolute -top-[3px] -right-[3px] w-6 h-6 border-t-[3.5px] border-r-[3.5px] border-white rounded-tr-xl" />
                  <div className="absolute -bottom-[3px] -left-[3px] w-6 h-6 border-b-[3.5px] border-l-[3.5px] border-white rounded-bl-xl" />
                  <div className="absolute -bottom-[3px] -right-[3px] w-6 h-6 border-b-[3.5px] border-r-[3.5px] border-white rounded-br-xl" />

                  {/* Left & Right Middle Crosshair Markers */}
                  <div className="absolute top-1/2 -left-[2px] -translate-y-1/2 w-7 h-[3.5px] bg-white rounded-r-full shadow-sm" />
                  <div className="absolute top-1/2 -right-[2px] -translate-y-1/2 w-7 h-[3.5px] bg-white rounded-l-full shadow-sm" />

                  {/* Animated Rose Gold Laser Beam */}
                  <div className="scanner-line" />
                </div>
              </div>
            )}

            {/* Tap-to-focus Ring */}
            {focusIndicator.active && (
              <div
                className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border-2 border-amber-300 animate-ping opacity-80 z-30"
                style={{ left: focusIndicator.x, top: focusIndicator.y }}
              />
            )}

            {/* Decode Success Overlay */}
            {scannedCode && (
              <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
                </div>
                <p className="text-white font-bold text-base">Barcode Scanned!</p>
                <p className="font-mono text-[#efaa9b] text-lg font-bold mt-1 bg-slate-900/90 px-4 py-1.5 rounded-lg border border-[#efaa9b]/40">
                  {scannedCode}
                </p>
                <p className="text-slate-400 text-xs mt-2">Closing camera...</p>
              </div>
            )}
          </div>

          {/* Error / Permission Banner with Retry Button */}
          {errorInfo && (
            <div className="space-y-2.5 bg-amber-950/40 border border-amber-800/50 p-3.5 rounded-xl">
              <div className="text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-200">{errorInfo.title}</p>
                  <p className="text-[11px] text-amber-300/90 mt-0.5 leading-relaxed">{errorInfo.message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={startScanner}
                disabled={isStarting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-200 border border-amber-500/30 rounded-lg text-xs font-semibold transition-all"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isStarting ? 'animate-spin' : ''}`} />
                <span>{isStarting ? 'Starting Camera...' : 'Retry Camera'}</span>
              </button>
            </div>
          )}

          {/* Manual Input Form */}
          <form onSubmit={handleManualSubmit} className="flex items-center gap-2.5 pt-0.5">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Or enter barcode numbers manually"
              className="flex-1 bg-slate-700/60 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-[#efaa9b] focus:ring-1 focus:ring-[#efaa9b] transition-colors"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-6 py-3 bg-[#efaa9b] hover:bg-[#e89887] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-[#45150b] rounded-xl text-sm font-bold transition-all shadow-md flex-shrink-0"
            >
              Apply
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
