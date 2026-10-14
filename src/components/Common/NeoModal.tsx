import React from 'react';

interface NeoModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  inputPlaceholder?: string;
  withInput?: boolean;
  inputValue?: string;
  onInputChange?: (val: string) => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export const NeoModal: React.FC<NeoModalProps> = ({
  isOpen,
  title,
  description,
  inputPlaceholder = 'Ketik di sini...',
  withInput = false,
  inputValue = '',
  onInputChange,
  confirmText = 'OK',
  cancelText = 'Batal',
  confirmColor = '#1C1917',
  onConfirm,
  onCancel,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="editorial-card w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 sm:p-7 text-center shadow-xl">
        <h2 className="text-xl font-bold font-serif-literary text-stone-900 dark:text-stone-100 mb-2">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-stone-600 dark:text-stone-400 font-medium mb-5 leading-relaxed">
            {description}
          </p>
        )}

        {children}

        {withInput && (
          <input
            type="text"
            className="editorial-input w-full p-3 mb-5 text-sm font-medium bg-stone-50 dark:bg-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700"
            placeholder={inputPlaceholder}
            value={inputValue}
            autoFocus
            onChange={(e) => onInputChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm();
            }}
          />
        )}

        <div className="flex gap-3 justify-center">
          {cancelText && (
            <button
              onClick={onCancel}
              className="editorial-btn flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 dark:border dark:border-stone-700 py-2.5 px-4 cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            style={{ backgroundColor: confirmColor }}
            className="editorial-btn flex-1 text-white py-2.5 px-4 hover:opacity-90 shadow-sm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
