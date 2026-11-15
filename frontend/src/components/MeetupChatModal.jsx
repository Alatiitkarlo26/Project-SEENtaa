import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { itemService } from '../services/itemService';
import { X, Send, MapPin, Shield, CheckCircle2 } from 'lucide-react';

export default function MeetupChatModal({ isOpen, onClose, claim, onTurnoverConfirmed }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState('Main Campus Lobby');
  const [confirming, setConfirming] = useState(false);
  const [turnoverSuccess, setTurnoverSuccess] = useState(false);
  const messagesEndRef = useRef(null);

  const safeZones = [
    'Main Campus Lobby & Plaza',
    'University Library Entrance',
    'Campus Security Guard Post',
    'Student Activity Center / Gazebo'
  ];

  const fetchMessages = async () => {
    if (!claim?.id) return;
    try {
      const msgs = await itemService.getMessages(claim.id);
      setMessages(msgs || []);
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    }
  };

  useEffect(() => {
    if (isOpen && claim?.id) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000); // Polling every 3s
      return () => clearInterval(interval);
    }
  }, [isOpen, claim?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen || !claim) return null;

  const isFinder = user?.id === claim.post?.finder_id;
  const otherPartyName = isFinder
    ? claim.claimant?.full_name || 'Claimant'
    : claim.post?.finder?.full_name || 'Finder';

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');
    try {
      const sent = await itemService.sendMessage(claim.id, user.id, text);
      setMessages((prev) => [...prev, { ...sent, sender: user }]);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleConfirmTurnover = async () => {
    if (!window.confirm(`Are you currently meeting with ${otherPartyName} at ${selectedZone} and ready to confirm the physical return of this item?`)) {
      return;
    }

    setConfirming(true);
    try {
      const tx = await itemService.confirmTurnover({
        postId: claim.post_id,
        claimId: claim.id,
        userId: user.id,
        campusLocation: selectedZone
      });
      setTurnoverSuccess(true);
      if (onTurnoverConfirmed) onTurnoverConfirmed(tx);
      setTimeout(() => {
        setTurnoverSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      alert(err.message || 'Failed to confirm turnover.');
    } finally {
      setConfirming(false);
    }
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
                Item: <strong>{claim.post?.item_name}</strong>
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
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/30 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Meet at official Safe Zone:</span>
          </div>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="text-[11px] bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 rounded-lg px-2 py-1 text-slate-900 dark:text-white"
          >
            {safeZones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>

        {/* Message Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs p-6 space-y-2">
              <MapPin className="w-8 h-8 opacity-40 text-theme" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                Private In-App Coordination Opened
              </p>
              <p className="text-[11px] max-w-xs">
                Coordinate a convenient time to meet on campus at {selectedZone}. Verify each other&apos;s student ID card in person before handing over the item.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                    {isMe ? 'You' : m.sender?.full_name || otherPartyName} • {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
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
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Physical handoff completed?
          </div>
          <button
            type="button"
            onClick={handleConfirmTurnover}
            disabled={confirming || turnoverSuccess}
            className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{turnoverSuccess ? 'Turnover Confirmed!' : (confirming ? 'Recording...' : 'Confirm Mutual Turnover')}</span>
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
