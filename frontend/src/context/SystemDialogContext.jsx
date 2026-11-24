import { createContext, useContext, useState, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  HelpCircle,
  X
} from 'lucide-react';

const SystemDialogContext = createContext(null);

export function SystemDialogProvider({ children }) {
  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Modal dialog (Confirm / Alert / Prompt)
  const [dialog, setDialog] = useState(null); // { isOpen, type, title, message, inputPlaceholder, defaultValue, confirmText, cancelText, onConfirm, onCancel }
  const [inputValue, setInputValue] = useState('');

  const showToast = useCallback((message, type = 'info', title = '') => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showConfirm = useCallback(({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning', onConfirm, onCancel }) => {
    setDialog({
      isOpen: true,
      type: 'confirm',
      dialogType: type,
      title: title || 'Confirmation Required',
      message: message || '',
      confirmText,
      cancelText,
      onConfirm: () => {
        setDialog(null);
        if (onConfirm) onConfirm();
      },
      onCancel: () => {
        setDialog(null);
        if (onCancel) onCancel();
      }
    });
  }, []);

  const showPrompt = useCallback(({ title, message, placeholder = 'Type here...', defaultValue = '', confirmText = 'Submit', cancelText = 'Cancel', onConfirm, onCancel }) => {
    setInputValue(defaultValue);
    setDialog({
      isOpen: true,
      type: 'prompt',
      dialogType: 'info',
      title: title || 'Input Required',
      message: message || '',
      inputPlaceholder: placeholder,
      confirmText,
      cancelText,
      onConfirm: (val) => {
        setDialog(null);
        if (onConfirm) onConfirm(val);
      },
      onCancel: () => {
        setDialog(null);
        if (onCancel) onCancel();
      }
    });
  }, []);

  const showAlert = useCallback(({ title, message, type = 'info', confirmText = 'OK', onConfirm }) => {
    setDialog({
      isOpen: true,
      type: 'alert',
      dialogType: type,
      title: title || 'Notification',
      message: message || '',
      confirmText,
      onConfirm: () => {
        setDialog(null);
        if (onConfirm) onConfirm();
      }
    });
  }, []);

  return (
    <SystemDialogContext.Provider value={{ showToast, showConfirm, showPrompt, showAlert }}>
      {children}

      {/* Floating System Toasts (Top Right) */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-2xl p-4 shadow-xl border backdrop-blur-md flex items-start gap-3 transition-all animate-fadeIn ${
                isSuccess
                  ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                  : isError
                  ? 'bg-rose-50/95 dark:bg-rose-950/90 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                  : isWarning
                  ? 'bg-amber-50/95 dark:bg-amber-950/90 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
                  : 'bg-white/95 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                {isError && <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-theme" />}
              </div>
              <div className="flex-1 text-xs">
                {t.title && <div className="font-bold mb-0.5">{t.title}</div>}
                <div className="leading-relaxed">{t.message}</div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* In-System Pop-up Dialog Modal (Confirm / Alert / Prompt) */}
      {dialog && dialog.isOpen && (
        <div className="fixed inset-0 z-[10000] overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[30px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4"
            role="dialog"
          >
            {/* Header with Icon */}
            <div className="p-6 text-center space-y-3">
              <div
                className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center font-bold shadow-xs ${
                  dialog.dialogType === 'success'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : dialog.dialogType === 'error'
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    : dialog.dialogType === 'warning'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                    : 'bg-theme/10 text-theme border border-red-200 dark:border-red-900/40'
                }`}
              >
                {dialog.dialogType === 'success' && <CheckCircle2 className="w-7 h-7" />}
                {dialog.dialogType === 'error' && <XCircle className="w-7 h-7" />}
                {dialog.dialogType === 'warning' && <AlertTriangle className="w-7 h-7" />}
                {dialog.dialogType === 'info' && <HelpCircle className="w-7 h-7" />}
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {dialog.title}
              </h3>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {dialog.message}
              </p>

              {/* Prompt Input Field */}
              {dialog.type === 'prompt' && (
                <div className="pt-2 text-left">
                  <textarea
                    rows={3}
                    autoFocus
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={dialog.inputPlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-theme/30"
                  />
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              {dialog.type !== 'alert' && (
                <button
                  type="button"
                  onClick={dialog.onCancel}
                  className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {dialog.cancelText}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (dialog.type === 'prompt') {
                    dialog.onConfirm(inputValue);
                  } else {
                    dialog.onConfirm();
                  }
                }}
                className="px-5 py-2 rounded-full bg-theme hover:bg-theme-hover text-white text-xs font-bold shadow-md transition cursor-pointer active:scale-95"
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </SystemDialogContext.Provider>
  );
}

export function useSystemDialog() {
  const context = useContext(SystemDialogContext);
  if (!context) {
    throw new Error('useSystemDialog must be used within a SystemDialogProvider');
  }
  return context;
}
