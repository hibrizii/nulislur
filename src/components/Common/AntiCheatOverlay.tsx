import React, { useEffect, useState, useRef } from 'react';
import { EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';

interface AntiCheatOverlayProps {
  active: boolean;
  onViolation: (alasan: string) => void;
  onDismiss?: () => void;
}

export const AntiCheatOverlay: React.FC<AntiCheatOverlayProps> = ({
  active,
  onViolation,
  onDismiss,
}) => {
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [alasan, setAlasan] = useState<string>('Kehilangan Fokus Layar');
  const lastTriggerRef = useRef<number>(0);
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  useEffect(() => {
    if (!active) {
      setShowWarning(false);
      return;
    }

    const triggerSensor = (reason: string) => {
      const now = Date.now();
      // Debounce sensor 2 detik agar tidak spamming
      if (now - lastTriggerRef.current < 2000) return;
      lastTriggerRef.current = now;

      setAlasan(reason);
      setShowWarning(true);
      onViolationRef.current(reason);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerSensor('Membuka Tab / Aplikasi Lain');
      }
    };

    const handleBlur = () => {
      triggerSensor('Kehilangan Fokus Layar');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [active]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="editorial-card w-full max-w-md bg-white p-8 text-center flex flex-col items-center shadow-2xl">
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
          <EyeOff size={28} />
        </div>

        <h2 className="text-xl font-bold font-serif-literary text-stone-900 mb-2">
          Peringatan: Fokus Terputus
        </h2>

        <div className="bg-amber-50 text-amber-800 text-xs font-semibold py-1.5 px-3 rounded-lg border border-amber-200 mb-4 inline-flex items-center gap-1.5">
          <AlertCircle size={14} className="text-amber-700" />
          <span>{alasan}</span>
        </div>

        <p className="text-sm font-medium text-stone-600 leading-relaxed mb-6">
          Anda terdeteksi berpindah tab atau aplikasi. Pelanggaran ini tercatat di sistem. Harap tetap berada di aplikasi.
        </p>

        <button
          onClick={() => {
            setShowWarning(false);
            onDismiss?.();
          }}
          className="editorial-btn w-full bg-stone-900 hover:bg-stone-800 text-white py-3 text-sm"
        >
          <ArrowLeft size={16} /> Kembali
        </button>
      </div>
    </div>
  );
};
