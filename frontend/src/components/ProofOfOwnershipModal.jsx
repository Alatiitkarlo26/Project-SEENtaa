import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { itemService } from '../services/itemService';
import { X, ShieldCheck, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export default function ProofOfOwnershipModal({ isOpen, onClose, item, onClaimSubmitted }) {
  const { user } = useAuth();
  const [proofDescription, setProofDescription] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [agreedToHonesty, setAgreedToHonesty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!proofDescription.trim()) {
      setError('Please provide detailed identifying proof (identifying marks, lockscreen, wallpaper, or unique contents).');
      return;
    }

    if (!agreedToHonesty) {
      setError('You must affirm the academic honesty declaration to submit this claim.');
      return;
    }

    setLoading(true);
    try {
      const claim = await itemService.submitClaim({
        postId: item.id,
        claimantId: user?.id,
        proofDescription: proofDescription.trim(),
        serialNumber: serialNumber.trim()
      });

      setSuccess(true);
      setTimeout(() => {
        if (onClaimSubmitted) onClaimSubmitted(claim);
        onClose();
        setSuccess(false);
        setProofDescription('');
        setSerialNumber('');
        setAgreedToHonesty(false);
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit ownership claim.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[36px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 sm:px-8 sm:py-5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Proof of Ownership Claim
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Peer-to-Peer Verification (FR-SEEN-0004)
              </p>
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

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Target Item summary */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Item Under Claim</div>
            <div className="font-bold text-sm text-slate-900 dark:text-white">{item.item_name}</div>
            <div className="text-slate-600 dark:text-slate-400">
              Category: <strong>{item.category}</strong> • Found at: <strong>{item.location_found}</strong>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Claim submitted successfully! The Finder has been notified to review your answers.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Identifying Marks &amp; Proof Details <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={proofDescription}
                onChange={(e) => setProofDescription(e.target.value)}
                placeholder="Describe details only the rightful owner would know (e.g. phone lock screen wallpaper, specific scratches, unique keychain, case brand, stickers, or bag contents)."
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                The finder will review these answers against the physical item before approving.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Serial Number / ID Number (Optional)
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. Student Number on ID, IMEI, or device serial number"
                className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition"
              />
            </div>

            {/* Academic Honesty Affirmation */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={agreedToHonesty}
                  onChange={(e) => setAgreedToHonesty(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  <strong>Academic Integrity Statement:</strong> I affirm under penalty of university disciplinary action (PUP Student Handbook &amp; RA 10173) that I am the genuine rightful owner of this item. I acknowledge that all handovers are permanently logged in the Transaction History.
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-5 py-2.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || success}
                className="px-6 py-2.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold transition shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{loading ? 'Submitting...' : 'Submit Claim'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
