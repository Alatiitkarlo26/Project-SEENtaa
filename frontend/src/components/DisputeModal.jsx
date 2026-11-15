import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { itemService } from '../services/itemService';
import { X, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function DisputeModal({ isOpen, onClose, post, onDisputeFiled }) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen || !post) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide the reason for this false claim dispute.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const dispute = await itemService.createDispute({
        postId: post.id,
        reportedByUserId: user?.id,
        reason: reason.trim(),
        evidenceDescription: evidenceDescription.trim()
      });

      setSuccess(true);
      setTimeout(() => {
        if (onDisputeFiled) onDisputeFiled(dispute);
        onClose();
        setSuccess(false);
        setReason('');
        setEvidenceDescription('');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to file dispute report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[36px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 transition-all"
        role="dialog"
      >
        <div className="px-6 py-4 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="text-sm font-extrabold">Report Falsely Claimed Item</h3>
              <p className="text-[11px] text-red-600/80">Campus Arbitration &amp; Security Escalation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-4">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400">Contested Item</div>
            <div className="font-bold text-sm text-slate-900 dark:text-white">{post.item_name}</div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Dispute submitted. Status updated to DISPUTED. Campus authorities alerted.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Reason for Dispute <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this item belongs to you and was fraudulently or mistakenly claimed by another student..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Evidence &amp; Ownership Verification Proof
              </label>
              <textarea
                rows={3}
                value={evidenceDescription}
                onChange={(e) => setEvidenceDescription(e.target.value)}
                placeholder="List purchase receipts, serial numbers, police/affidavit reports, or identifying features..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || success}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {loading ? 'Filing...' : 'Submit Dispute'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
