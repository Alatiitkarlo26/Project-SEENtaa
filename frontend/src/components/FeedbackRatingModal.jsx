import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { itemService } from '../services/itemService';
import { X, Star, Heart, CheckCircle2, ShieldCheck, MessageSquare } from 'lucide-react';

export default function FeedbackRatingModal({ isOpen, onClose, transaction, onFeedbackSubmitted }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comments, setComments] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !transaction) return null;

  const isFinder = user?.id === transaction.finder_id;
  const targetUser = isFinder ? transaction.claimant : transaction.finder;
  const targetRole = isFinder ? 'Claimant' : 'Finder';
  const targetName = targetUser?.full_name || targetRole;
  const targetId = isFinder ? transaction.claimant_id : transaction.finder_id;

  const compliments = [
    'Prompt & On-Time Meetup',
    'Polite & Respectful Iskolar',
    'Accurate Item Verification',
    'Followed Safe-Zone Rules',
    'Fast & Smooth Turnover',
    'Honest & Trustworthy'
  ];

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetId) {
      setError('Unable to identify recipient.');
      return;
    }

    setSubmitting(true);
    setError('');

    const combinedComments = [
      selectedTags.length > 0 ? `Highlights: ${selectedTags.join(', ')}` : '',
      comments.trim()
    ].filter(Boolean).join('\n\n');

    try {
      await itemService.submitFeedback({
        transactionId: transaction.id,
        raterId: user.id,
        ratedUserId: targetId,
        rating,
        comments: combinedComments
      });

      setSubmitted(true);
      if (onFeedbackSubmitted) onFeedbackSubmitted();
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[36px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4"
        role="dialog"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500/10 via-theme/5 to-transparent border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
              ⭐
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Peer Community Feedback
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rate your exchange experience with {targetName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Thank You, Iskolar!
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Your feedback helps keep PUP Biñan Campus a trustworthy and transparent peer-to-peer lost and found community.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Target Item summary */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">Returned Item:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 ml-1.5">
                  {transaction.post?.item_name || 'Property'}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Turnover Verified
              </span>
            </div>

            {/* Interactive Star Rating */}
            <div className="text-center py-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                Overall Experience Rating
              </label>
              <div className="inline-flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-110 cursor-pointer"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          active
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300 dark:text-slate-700'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2">
                {rating === 5 && '🌟 Exceptional & Exemplary Iskolar!'}
                {rating === 4 && '✨ Great & Smooth Handover'}
                {rating === 3 && '👍 Satisfactory Exchange'}
                {rating === 2 && '⚠️ Needs Better Punctuality or Communication'}
                {rating === 1 && '❌ Problematic / Disappointing Interaction'}
              </p>
            </div>

            {/* Praise Tag Pills */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-theme" />
                <span>What went well? (Select all that apply)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {compliments.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer border ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 font-semibold'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note / Comment */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Message of Gratitude or Comments (Optional)</span>
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Thank you so much for keeping my wallet safe! Handover was quick at the Main Lobby."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            {/* Safe Zone Reminder */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-theme shrink-0" />
              <span>Feedback is permanently linked to the verified cryptographic transaction hash.</span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 rounded-full bg-theme hover:bg-theme-hover text-white text-xs font-semibold shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
