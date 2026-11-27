import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSystemDialog } from '../context/SystemDialogContext';
import { itemService } from '../services/itemService';
import {
  CAMPUS_LOCATION_GROUPS,
  CAMPUS_LOCATIONS,
  isCustomLocationPreset,
  getCustomLocationPlaceholder,
  resolveLocationValue
} from '../constants/itemPresets';
import { X, Send, MapPin, Shield, CheckCircle2, Lock } from 'lucide-react';

export default function MeetupChatModal({ isOpen, onClose, claim, isAlreadyCompleted, onTurnoverConfirmed }) {
  const { user } = useAuth();
  const { showConfirm, showToast, showAlert } = useSystemDialog();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLocationPreset, setSelectedLocationPreset] = useState(() => {
    const postLoc = claim?.post?.location_found;
    const match = CAMPUS_LOCATIONS.find((loc) => loc === postLoc);
    return match || CAMPUS_LOCATIONS[0] || 'CITE — Campus Canteen';
  });
  const [customLocationText, setCustomLocationText] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Sync default location preset if claim changes
  useEffect(() => {
    if (claim?.post?.location_found) {
      const match = CAMPUS_LOCATIONS.find((loc) => loc === claim.post.location_found);
      if (match) setSelectedLocationPreset(match);
    }
  }, [claim?.post?.location_found]);

  // Resolved safe zone location string
  const currentSafeZone = resolveLocationValue(selectedLocationPreset, customLocationText) || selectedLocationPreset;

  // Check whether this claim or item has already completed turnover
  const isFinished = useCallback(() => {
    if (!claim) return false;
    if (isAlreadyCompleted) return true;
    const postId = claim.post_id || claim.post?.id;
    if (claim.post?.status === 'Reunited' || claim.status === 'Completed' || claim.status === 'Finalized') {
      return true;
    }
    try {
      if (postId && localStorage.getItem(`seenta_turnover_done_${postId}`) === 'true') {
        return true;
      }
      if (claim.id && localStorage.getItem(`seenta_turnover_done_${claim.id}`) === 'true') {
        return true;
      }
    } catch {
      // ignore localStorage security errors
    }
    return false;
  }, [claim, isAlreadyCompleted]);

  const [isTurnoverCompleted, setIsTurnoverCompleted] = useState(isFinished);
  const messagesEndRef = useRef(null);

  // Synchronize completed state whenever claim or isAlreadyCompleted changes
  useEffect(() => {
    if (isFinished()) {
      setIsTurnoverCompleted(true);
    }
  }, [claim, isAlreadyCompleted, isFinished]);



  const fetchMessages = async () => {
    if (!claim?.id) return;
    try {
      const msgs = await itemService.getMessages(claim.id);
      setMessages(msgs || []);
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    }
  };

  const checkTurnoverStatus = useCallback(async () => {
    if (!claim) return;
    if (isFinished()) {
      setIsTurnoverCompleted(true);
      return;
    }
    const postId = claim.post_id || claim.post?.id;

    try {
      const txs = await itemService.getTransactions(user?.id);
      const match = (txs || []).find(
        (t) => (claim.id && t.claim_id === claim.id) || (postId && t.post_id === postId)
      );
      if (match && (match.completed_at || match.ledger_hash)) {
        setIsTurnoverCompleted(true);
        try {
          if (postId) localStorage.setItem(`seenta_turnover_done_${postId}`, 'true');
          if (claim.id) localStorage.setItem(`seenta_turnover_done_${claim.id}`, 'true');
        } catch {}
        return;
      }
    } catch {
      // ignore
    }

    if (postId) {
      try {
        const p = await itemService.getFoundPostById(postId);
        if (p && p.status === 'Reunited') {
          setIsTurnoverCompleted(true);
          try {
            localStorage.setItem(`seenta_turnover_done_${postId}`, 'true');
            if (claim.id) localStorage.setItem(`seenta_turnover_done_${claim.id}`, 'true');
          } catch {}
        }
      } catch {
        // ignore
      }
    }
  }, [claim, user?.id, isFinished]);

  useEffect(() => {
    if (isOpen && claim?.id) {
      if (isFinished()) {
        setIsTurnoverCompleted(true);
      }
      fetchMessages();
      checkTurnoverStatus();
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchMessages();
          checkTurnoverStatus();
        }
      }, 3000); // Polling every 3s
      return () => clearInterval(interval);
    }
  }, [isOpen, claim?.id, checkTurnoverStatus, isFinished]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen || !claim) return null;

  const isFinder = user?.id === claim?.post?.finder_id;
  const otherPartyName = isFinder
    ? claim?.claimant?.full_name || 'Claimant'
    : claim?.post?.finder?.full_name || 'Finder';

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');
    try {
      const sent = await itemService.sendMessage(claim.id, user?.id, text);
      if (sent) {
        setMessages((prev) => [...prev, { ...sent, sender: user }]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      showAlert({ title: 'Message Error', message: 'Failed to deliver message. Please retry.', type: 'error' });
    }
  };

  const handleConfirmTurnover = () => {
    const finalLocation = resolveLocationValue(selectedLocationPreset, customLocationText) || selectedLocationPreset;
    showConfirm({
      title: 'Finalize Mutual Turnover',
      message: `Are you currently meeting with ${otherPartyName} at "${finalLocation}" and ready to confirm the physical handover of "${claim?.post?.item_name || 'this item'}"?\n\nThis single click will permanently mark the item as Reunited and issue an official cryptographic ledger record.`,
      confirmText: 'Yes, Finalize Turnover',
      cancelText: 'Cancel',
      type: 'success',
      onConfirm: async () => {
        setConfirming(true);
        const postId = claim?.post_id || claim?.post?.id;
        try {
          const tx = await itemService.confirmTurnover({
            postId,
            claimId: claim.id,
            userId: user?.id,
            campusLocation: finalLocation
          });
          setIsTurnoverCompleted(true);
          try {
            if (postId) localStorage.setItem(`seenta_turnover_done_${postId}`, 'true');
            if (claim.id) localStorage.setItem(`seenta_turnover_done_${claim.id}`, 'true');
          } catch {}
          if (claim.post) claim.post.status = 'Reunited';
          claim.status = 'Completed';
          showToast('Turnover confirmed! Item is now officially Reunited.', 'success', 'Turnover Finalized');
          if (onTurnoverConfirmed) onTurnoverConfirmed(tx);
        } catch (err) {
          showAlert({ title: 'Turnover Failed', message: err.message || 'Failed to confirm turnover.', type: 'error' });
        } finally {
          setConfirming(false);
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[36px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4 flex flex-col h-[600px] max-h-[90vh]"
        role="dialog"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-theme/10 text-theme flex items-center justify-center font-bold text-sm">
              💬
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Meetup with {otherPartyName}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Approved
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Item: <strong>{claim?.post?.item_name || 'Found Item'}</strong>
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

        {/* Safe-Zone Meeting Banner */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/30 text-xs text-amber-900 dark:text-amber-200 shrink-0 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold whitespace-nowrap">Meet at official Safe Zone:</span>
            </div>
            <select
              value={selectedLocationPreset}
              onChange={(e) => setSelectedLocationPreset(e.target.value)}
              className="text-xs bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white max-w-full sm:max-w-xs focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer truncate"
            >
              {CAMPUS_LOCATION_GROUPS.map((group) => (
                <optgroup key={group.branch} label={group.branch}>
                  {group.locations.map((loc) => (
                    <option key={loc.value} value={loc.value}>
                      {loc.label}
                    </option>
                  ))}
                  <option value={group.customValue}>{group.customLabel}</option>
                </optgroup>
              ))}
            </select>
          </div>

          {isCustomLocationPreset(selectedLocationPreset) && (
            <div className="pt-0.5">
              <input
                type="text"
                required
                value={customLocationText}
                onChange={(e) => setCustomLocationText(e.target.value)}
                placeholder={getCustomLocationPlaceholder(selectedLocationPreset)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          )}
        </div>

        {/* Message Log */}
        <div className="flex-1 p-4 overflow-y-auto overflow-x-hidden space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs p-6 space-y-2">
              <MapPin className="w-8 h-8 opacity-40 text-theme" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                Private In-App Coordination Opened
              </p>
              <p className="text-[11px] max-w-xs">
                Coordinate a convenient time to meet on campus at {currentSafeZone}. Verify each other&apos;s student ID card in person before handing over the item.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                    {isMe ? 'You' : m.sender?.full_name || otherPartyName} {m.created_at ? `• ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words break-all overflow-hidden ${
                      isMe
                        ? 'bg-theme text-white rounded-br-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-xs'
                    }`}
                  >
                    {m.message_text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Turnover Confirmation Banner */}
        <div className={`p-3 border-t flex items-center justify-between shrink-0 transition-colors ${
          isTurnoverCompleted
            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}>
          <div className="text-[11px]">
            {isTurnoverCompleted ? (
              <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Physical turnover finalized &amp; secured on ledger
              </span>
            ) : (
              <span className="text-slate-500">Physical handoff completed?</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleConfirmTurnover}
            disabled={confirming || isTurnoverCompleted}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition select-none ${
              isTurnoverCompleted
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none border border-slate-300 dark:border-slate-700 pointer-events-none'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm hover:shadow'
            }`}
          >
            {isTurnoverCompleted ? (
              <>
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Turnover Completed &amp; Reunited 🤝</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{confirming ? 'Recording...' : 'Confirm Mutual Turnover'}</span>
              </>
            )}
          </button>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 bg-slate-100/70 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message to schedule meetup..."
            className="flex-1 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-theme/30"
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="w-9 h-9 rounded-full bg-theme hover:bg-theme-hover text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
