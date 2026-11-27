import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { itemService } from '../services/itemService';
import {
  X,
  CheckCheck,
  CheckCircle2,
  Clock,
  SearchCheck,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  Trash2
} from 'lucide-react';

function stripEmojis(str) {
  if (!str) return '';
  return str
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, '')
    .replace(/\bHANDOVER_CONFIRMED\b/g, 'Handover')
    .replace(/\bHANDOVER_SCHEDULED\b/g, 'Handover')
    .replace(/\bCLAIM_SUBMITTED\b/g, 'Claim')
    .replace(/\bCLAIM_APPROVED\b/g, 'Claim')
    .replace(/\bCLAIM_REJECTED\b/g, 'Claim')
    .replace(/\bDISPUTE_FILED\b/g, 'Dispute')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatNotificationType(type) {
  if (!type) return 'Notice';
  const upper = String(type).toUpperCase();
  if (upper.includes('HANDOVER')) return 'Handover';
  if (upper.includes('CLAIM')) return 'Claim';
  if (upper.includes('MATCH')) return 'Match';
  if (upper.includes('DISPUTE')) return 'Dispute';
  return 'Notice';
}

function getNotificationBadgeStyle(type) {
  const upper = String(type || '').toUpperCase();
  if (upper.includes('MATCH')) {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  }
  if (upper.includes('HANDOVER')) {
    return 'bg-teal-500/10 text-teal-600 dark:text-teal-400';
  }
  if (upper.includes('CLAIM')) {
    return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
  }
  if (upper.includes('DISPUTE')) {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  }
  return 'bg-slate-500/10 text-slate-500 dark:text-slate-400';
}

function formatRelativeTime(dateString) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function NotificationsModal({ isOpen, onClose, onViewItem, anchorRef }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [coords, setCoords] = useState(null);
  const popoverRef = useRef(null);

  // Position popover directly beneath the trigger button
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (anchorRef?.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        const cardWidth = Math.min(450, window.innerWidth - 24);
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

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const data = await itemService.getNotifications(user.id);
      setNotifications(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  // Escape key listener to close
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

  const handleMarkAsRead = async (notif, e) => {
    e?.stopPropagation();
    try {
      await itemService.markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try {
      await itemService.markAllNotificationsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  const handleDeleteNotification = async (notifId, e) => {
    e?.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    try {
      await itemService.deleteNotification(notifId);
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filteredNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <>
      {/* Invisible Click-Outside Dismiss: NO page darkening, NO background blur */}
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover Card anchored beneath the alerts button */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-popover-title"
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
        className="fixed z-50 w-[calc(100vw-24px)] sm:w-[450px] max-w-[460px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl shadow-slate-900/15 dark:shadow-black/70 overflow-hidden animate-popoverEnter flex flex-col transition-colors duration-200"
      >
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40 shrink-0 gap-3">
          <div className="min-w-0">
            <h3
              id="notif-popover-title"
              className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight"
            >
              Notifications
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug truncate">
              Real-time matches, claim updates, and alerts
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0 whitespace-nowrap"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Mark all</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-90 shrink-0"
              title="Close"
              aria-label="Close notifications"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Segmented Control (All / Unread) */}
        {notifications.length > 0 && (
          <div className="px-5 pt-3 pb-1 flex items-center justify-between shrink-0">
            <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl gap-0.5">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer active:scale-95 ${
                  filter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer active:scale-95 ${
                  filter === 'unread'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {filter === 'unread' && unreadCount > 0 && (
              <span className="text-[10px] text-slate-400 font-medium">
                Filtering unread
              </span>
            )}
          </div>
        )}

        {/* Scrollable Notification List */}
        <div className="overflow-y-auto custom-scrollbar flex-1 p-3 space-y-2.5 max-h-[390px]">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-5 h-5 border-2 border-theme border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-medium">Checking notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/70 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-5 h-5 stroke-[1.5]" />
              </div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {filter === 'unread' ? 'No unread notifications' : 'All caught up'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[260px] mx-auto leading-relaxed">
                {filter === 'unread'
                  ? 'You have viewed all incoming notifications.'
                  : "You will be notified here when an item matching your lost report is found or logged on campus."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.is_read) handleMarkAsRead(notif);
                    if (onViewItem) {
                      onViewItem(notif);
                    }
                  }}
                  className="relative group cursor-pointer"
                >
                  {/* Subtle red glow strictly behind the unread box */}
                  {!notif.is_read && (
                    <div
                      aria-hidden="true"
                      className="absolute -inset-0.5 rounded-2xl bg-red-500/20 dark:bg-red-500/25 blur-sm pointer-events-none group-hover:bg-red-500/30 transition-all duration-200"
                    />
                  )}

                  {/* Clean notification box on top/in front of the glow */}
                  <div
                    className={`relative p-3.5 rounded-2xl border transition-all duration-200 flex flex-col gap-1.5 active:scale-[0.99] ${
                      notif.is_read
                        ? 'bg-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-slate-200/50 dark:border-slate-800/50 text-slate-600 dark:text-slate-400'
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50/90 dark:hover:bg-slate-850/90 border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white'
                    }`}
                  >
                    {/* Top Row: Type Tag, Relative Time & Delete Button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full leading-none tracking-normal ${getNotificationBadgeStyle(
                            notif.type
                          )}`}
                        >
                          {formatNotificationType(notif.type)}
                        </span>
                        {!notif.is_read && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
                            title="Unread"
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(notif.created_at)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNotification(notif.id, e)}
                          title="Delete notification"
                          aria-label="Delete notification"
                          className="w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Notification Content without emojis */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-theme transition-colors leading-snug">
                        {stripEmojis(notif.title)}
                      </h4>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {stripEmojis(notif.message)}
                      </p>
                    </div>

                    {notif.reference_id && (
                      <div className="pt-0.5 text-[11px] font-semibold text-theme inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>{notif.type === 'MATCH' ? 'View match' : 'View details'}</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
          <span className="font-medium">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full font-semibold transition-all cursor-pointer active:scale-95"
          >
            Dismiss
          </button>
        </div>
      </div>
    </>
  );
}
