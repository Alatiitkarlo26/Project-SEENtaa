import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Sun,
  Moon,
  Laptop,
  Contrast,
  Type,
  RotateCcw
} from 'lucide-react';

export default function AccessibilityModal({ isOpen, onClose, anchorRef }) {
  const {
    mode,
    highContrast,
    fontSize,
    setMode,
    setHighContrast,
    setFontSize,
    resetDefaults
  } = useTheme();

  const [coords, setCoords] = useState(null);
  const popoverRef = useRef(null);

  // Position popover directly beneath the Accessibility trigger button
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (anchorRef?.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        const cardWidth = Math.min(340, window.innerWidth - 24);
        const maxAllowedRight = Math.max(12, window.innerWidth - cardWidth - 12);
        const naturalRight = window.innerWidth - rect.right;
        const clampedRight = Math.max(12, Math.min(naturalRight, maxAllowedRight));

        setCoords({
          top: Math.round(rect.bottom + 8),
          right: Math.round(clampedRight)
        });
      } else {
        setCoords({
          top: 68,
          right: 16
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, anchorRef]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Invisible Click-Outside Dismiss: NO darkened overlay, NO background blur */}
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover Card anchored beneath Accessibility button */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="a11y-popover-title"
        style={
          coords
            ? {
                top: `${coords.top}px`,
                right: `${coords.right}px`,
                maxHeight: 'calc(100vh - 84px)'
              }
            : {
                top: '68px',
                right: '16px',
                maxHeight: 'calc(100vh - 84px)'
              }
        }
        className="fixed z-50 w-[calc(100vw-24px)] sm:w-[340px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl shadow-slate-900/15 dark:shadow-black/70 overflow-hidden animate-popoverEnter flex flex-col transition-colors duration-200"
      >
        {/* Minimal Header */}
        <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div>
            <h3
              id="a11y-popover-title"
              className="text-sm font-bold text-slate-900 dark:text-white tracking-tight"
            >
              Appearance &amp; Accessibility
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Display mode, contrast, and text size
            </p>
          </div>

          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95 shrink-0"
            title="Reset defaults"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Theme Mode */}
          <div className="space-y-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Theme
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
              {[
                { key: 'light', label: 'Light', icon: Sun },
                { key: 'dark', label: 'Dark', icon: Moon },
                { key: 'system', label: 'System', icon: Laptop }
              ].map((opt) => {
                const Icon = opt.icon;
                const isActive = mode === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={(e) => setMode(opt.key, e)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-95 ${
                      isActive
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs border border-slate-200/70 dark:border-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* High Contrast Row */}
          <div className="flex items-center justify-between py-2.5 border-y border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <Contrast className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  High Contrast
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Sharper borders &amp; legibility
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={highContrast}
              onClick={() => setHighContrast(!highContrast)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none active:scale-95 ${
                highContrast ? 'bg-theme' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              aria-label="Toggle High-Contrast Mode"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${
                  highContrast ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Text Scaling Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Type className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Text Size
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Interface scale
                </div>
              </div>
            </div>

            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl gap-0.5">
              {[
                { key: 'compact', label: '85%' },
                { key: 'normal', label: '100%' },
                { key: 'large', label: '115%' }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFontSize(item.key)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all duration-150 cursor-pointer active:scale-95 ${
                    fontSize === item.key
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
