import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSystemDialog } from '../context/SystemDialogContext';
import campusBg from '../assets/pup-binan-campus.jpg';
import OutlookSimulationModal from '../components/OutlookSimulationModal';
import PostFoundItemModal from '../components/PostFoundItemModal';
import ReportLostItemModal from '../components/ReportLostItemModal';
import ItemDetailModal from '../components/ItemDetailModal';
import NotificationsModal from '../components/NotificationsModal';
import ProofOfOwnershipModal from '../components/ProofOfOwnershipModal';
import MeetupChatModal from '../components/MeetupChatModal';
import DisputeModal from '../components/DisputeModal';
import FeedbackRatingModal from '../components/FeedbackRatingModal';
import { itemService } from '../services/itemService';
import { otpService } from '../services/otpService';
import {
  Search,
  SearchCheck,
  Package,
  MapPin,
  Calendar,
  Camera,
  FileText,
  Tag,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  X,
  HelpCircle,
  ChevronRight,
  MessageSquare,
  History,
  Star,
  Download,
  CheckCircle2,
  XCircle,
  Filter,
  ChevronDown,
  Check
} from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import { ItemCardSkeleton } from '../components/Skeleton';
import { getUserRoleTag } from '../utils/userUtils';

function getItemStatusKey(status) {
  if (!status || status === 'AvailableForClaim' || status === 'Available') return 'available';
  if (status === 'CoordinatingHandover' || status === 'ClaimUnderReview' || status === 'Handover') return 'handover';
  if (status === 'Reunited' || status === 'Completed' || status === 'Finalized') return 'reunited';
  if (status === 'Disputed') return 'disputed';
  return 'available';
}

function getStatusBadge(status) {
  const key = getItemStatusKey(status);
  switch (key) {
    case 'reunited':
      return {
        label: 'Reunited',
        className: 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80',
        dotClass: 'bg-sky-500'
      };
    case 'handover':
      return {
        label: 'Hand over',
        className: 'bg-orange-50 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/80',
        dotClass: 'bg-orange-500'
      };
    case 'disputed':
      return {
        label: 'Disputed',
        className: 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80',
        dotClass: 'bg-amber-500'
      };
    case 'available':
    default:
      return {
        label: 'Available for claim',
        className: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80',
        dotClass: 'bg-emerald-500'
      };
  }
}

const QUICK_FILTER_OPTIONS = [
  { label: 'All Items', query: '' },
  { label: 'Student ID', query: 'ID' },
  { label: 'Calculator', query: 'Calculator' },
  { label: 'Tumbler', query: 'Tumbler' },
  { label: 'Keys', query: 'Keys' },
  { label: 'Umbrella', query: 'Umbrella' },
  { label: 'Earphones', query: 'Earphones' }
];

function matchesItemFilters(fields, searchQuery, quickFilter) {
  const q = searchQuery.toLowerCase().trim();
  const f = quickFilter.toLowerCase().trim();
  const matchesQuery = !q || fields.some((val) => val?.toLowerCase().includes(q));
  const matchesFilter = !f || fields.some((val) => val?.toLowerCase().includes(f));
  return matchesQuery && matchesFilter;
}

export default function StudentDashboardPage({ onNavigateToTab }) {
  const { user, isNewUser } = useAuth();
  const { showConfirm, showPrompt, showAlert, showToast } = useSystemDialog();
  const searchInputRef = useRef(null);
  const filterDropdownRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuickFilter, setSelectedQuickFilter] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeActivityTab, setActiveActivityTab] = useState('my-lost'); // 'my-lost' | 'claims-meetups' | 'my-found'

  // Data states
  const [foundItems, setFoundItems] = useState([]);
  const [lostReports, setLostReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [claimsOnMyPosts, setClaimsOnMyPosts] = useState([]);
  const [mySubmittedClaims, setMySubmittedClaims] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showOutlookModal, setShowOutlookModal] = useState(false);
  const [showPostFoundModal, setShowPostFoundModal] = useState(false);
  const [showReportLostModal, setShowReportLostModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [itemForClaim, setItemForClaim] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [activeChatClaim, setActiveChatClaim] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [itemForDispute, setItemForDispute] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedTxForFeedback, setSelectedTxForFeedback] = useState(null);

  const latestEmail = otpService.getLatestEmail(user?.email);

  const loadData = useCallback(async (isRefresh = false, isSilent = false) => {
    if (!isSilent) {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
    }

    try {
      const [foundData, lostData, notifsData, incomingClaims, myClaims, txData] = await Promise.all([
        itemService.getFoundPosts(),
        user?.id ? itemService.getLostReports({ userId: user.id }) : [],
        user?.id ? itemService.getNotifications(user.id) : [],
        user?.id ? itemService.getClaims({ finderId: user.id }) : [],
        user?.id ? itemService.getClaims({ claimantId: user.id }) : [],
        user?.id ? itemService.getTransactions(user.id) : []
      ]);

      setFoundItems(foundData || []);
      setLostReports(lostData || []);
      setNotifications(notifsData || []);
      setClaimsOnMyPosts(incomingClaims || []);
      setMySubmittedClaims(myClaims || []);
      setTransactions(txData || []);
    } catch (err) {
      if (!isSilent) console.error('Failed to load dashboard data:', err);
    } finally {
      if (!isSilent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user]);

  // Initial load and continuous asynchronous background sync (AJAX)
  useEffect(() => {
    loadData(); // initial load with skeleton

    // Periodic silent background sync every 4s so users never have to refresh manually
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(true, true);
      }
    }, 4000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData(true, true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData]);

  // Keyboard shortcut '/' or 'Cmd/Ctrl+K' to quickly focus the search bar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close custom filter dropdown on outside click or Escape
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleOutsideClick = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setIsFilterOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isFilterOpen]);

  // Handle post/report creation callbacks
  const handleItemPosted = (newPost) => {
    setFoundItems((prev) => [newPost, ...prev]);
    loadData(true);
  };

  const handleReportCreated = (newReport) => {
    setLostReports((prev) => [newReport, ...prev]);
    loadData(true);
  };

  // Inspect item from notification
  const handleViewNotificationItem = async (notif) => {
    setShowNotifModal(false);
    if (!notif) return;
    const refId = notif.reference_id || notif.referenceId || (typeof notif === 'string' ? notif : null);
    const type = notif.type || 'MATCH';

    if (type === 'MATCH') {
      if (refId && typeof refId === 'string' && refId.startsWith('lost_')) {
        onNavigateToTab?.('campus-activity', { subTab: 'my-lost', targetReportId: refId, action: 'report' });
      } else {
        onNavigateToTab?.('inventory', { targetItemId: refId });
      }
    } else if (type === 'CLAIM_APPROVED') {
      onNavigateToTab?.('campus-activity', { subTab: 'claims-meetups', targetClaimId: refId, action: 'chat' });
    } else if (type === 'CLAIM_SUBMITTED') {
      onNavigateToTab?.('campus-activity', { subTab: 'claims-meetups', targetClaimId: refId, action: 'review' });
    } else if (type === 'CLAIM_REJECTED') {
      onNavigateToTab?.('campus-activity', { subTab: 'claims-meetups', targetClaimId: refId, action: 'rejected' });
    } else if (type === 'HANDOVER_CONFIRMED') {
      onNavigateToTab?.('campus-activity', { subTab: 'claims-meetups', targetTxId: refId, action: 'finalized' });
    } else {
      onNavigateToTab?.('campus-activity', { subTab: 'claims-meetups' });
    }
  };

  // Active match alerts count
  const unreadMatches = notifications.filter((n) => !n.is_read && n.type === 'MATCH');

  const myPostedItems = useMemo(() => {
    return foundItems.filter((i) => i.finder_id === user?.id);
  }, [foundItems, user?.id]);

  const myFoundCount = myPostedItems.length;

  const displayedLostReports = useMemo(() => {
    if (!searchQuery.trim() && !selectedQuickFilter) return lostReports;
    return lostReports.filter((report) =>
      matchesItemFilters(
        [report.item_name, report.last_known_location, report.description, report.category, report.color],
        searchQuery,
        selectedQuickFilter
      )
    );
  }, [lostReports, searchQuery, selectedQuickFilter]);

  const filteredFoundItems = useMemo(() => {
    if (!searchQuery.trim() && !selectedQuickFilter) return foundItems;
    return foundItems.filter((item) =>
      matchesItemFilters(
        [item.item_name, item.location_found, item.description, item.category, item.color],
        searchQuery,
        selectedQuickFilter
      )
    );
  }, [foundItems, searchQuery, selectedQuickFilter]);

  const recentPostings = useMemo(() => {
    return filteredFoundItems.slice(0, 6);
  }, [filteredFoundItems]);

  const activeFilterLabel =
    QUICK_FILTER_OPTIONS.find((opt) => opt.query === selectedQuickFilter)?.label || 'All Items';

  const firstName =
    user?.firstName ||
    user?.first_name ||
    (user?.fullName?.includes(',') ? user.fullName.split(',')[1]?.trim() : user?.fullName?.split(' ')[0]) ||
    (user?.full_name?.includes(',') ? user.full_name.split(',')[1]?.trim() : user?.full_name?.split(' ')[0]) ||
    'Iskolar';

  // Helper to determine if a claim's item has completed turnover
  const isClaimFinalized = useCallback(
    (claim) => {
      if (!claim) return false;
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
      } catch {}
      const matchingFoundItem = foundItems.find((f) => f.id === postId);
      if (matchingFoundItem && matchingFoundItem.status === 'Reunited') {
        return true;
      }
      return transactions.some(
        (tx) =>
          (tx.claim_id === claim.id || (postId && tx.post_id === postId)) &&
          (tx.completed_at || tx.ledger_hash)
      );
    },
    [transactions, foundItems]
  );

  // Active incoming claims on items user found (excluding finalized & rejected)
  const activeIncomingClaims = claimsOnMyPosts.filter(
    (c) => c.status !== 'Rejected' && !isClaimFinalized(c)
  );

  // Active outgoing claims user submitted (excluding finalized & rejected)
  const activeMySubmittedClaims = mySubmittedClaims.filter(
    (c) => c.status !== 'Rejected' && !isClaimFinalized(c)
  );

  // Separate list for all declined / rejected claims
  const rejectedClaims = [
    ...claimsOnMyPosts.filter((c) => c.status === 'Rejected').map((c) => ({ ...c, direction: 'incoming' })),
    ...mySubmittedClaims.filter((c) => c.status === 'Rejected').map((c) => ({ ...c, direction: 'outgoing' }))
  ];

  // Finalized transactions list
  const finalizedTransactions = transactions.filter(
    (t) => t.completed_at || t.ledger_hash || t.post?.status === 'Reunited'
  );

  const totalActiveClaimsCount = activeIncomingClaims.length + activeMySubmittedClaims.length;

  const activityTabs = [
    { key: 'my-lost', label: 'My Lost Reports', count: lostReports.length },
    { key: 'claims-meetups', label: 'Claims & Meetups', count: totalActiveClaimsCount },
    { key: 'my-found', label: 'Items I Posted', count: myFoundCount }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-20 transition-colors duration-200">
      {/* ================= HERO ================= */}
      <section className="relative w-full overflow-hidden bg-neutral-900 text-white">
        {/* Background with Soft White/Grayish Mist Overlay */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            src={campusBg}
            alt="PUP Biñan Campus"
            className="w-full h-full object-cover object-center brightness-[0.38] grayscale-[35%] scale-[1.01]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/45 via-neutral-900/65 to-neutral-950/90" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.14),transparent_65%)] pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 pt-12 pb-16 sm:pt-14 sm:pb-20">
          <div className="max-w-2xl">
            {/* Headline */}
            <h1 className="animate-fadeInUp text-3xl sm:text-[2.85rem] font-bold tracking-tight text-white leading-[1.15]">
              {isNewUser ? 'Welcome,' : 'Welcome back,'}<br />
              <span className="text-white font-extrabold">{firstName}.</span>
            </h1>

            {/* Student-Centered Subtext */}
            <p className="animate-fadeInUp [animation-delay:100ms] text-sm sm:text-base text-neutral-200/90 leading-relaxed max-w-xl mt-3.5">
              Lost an item between lectures or found unattended property? Connect directly with fellow Iskolars and safely coordinate campus returns.
            </p>

            {/* Quick Action Buttons */}
            <div className="animate-fadeInUp [animation-delay:180ms] mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowReportLostModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-theme hover:bg-theme-hover text-white text-sm font-semibold rounded-full border border-red-500/30 shadow-md shadow-black/25 transition-all duration-200 cursor-pointer active:scale-95"
              >
                <HelpCircle className="w-4 h-4 text-red-200" />
                <span>Report Lost Item</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPostFoundModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-100 hover:text-white text-sm font-semibold rounded-full border border-neutral-600/70 hover:border-neutral-500 transition-all duration-200 cursor-pointer active:scale-95 shadow-xs"
              >
                <Camera className="w-4 h-4 text-neutral-300" />
                <span>Post Found Item</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SEARCH & INTEGRATED FILTER DROPDOWN ================= */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 -mt-7 relative z-20">
        <ScrollReveal threshold={0.05} yOffset={16}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg shadow-slate-900/5 dark:shadow-none border border-slate-200/90 dark:border-slate-800/90 focus-within:border-slate-300 dark:focus-within:border-slate-700 focus-within:ring-2 focus-within:ring-slate-900/5 dark:focus-within:ring-white/5 transition-all duration-200">
            {/* Search Input Bar with Integrated Filter Dropdown */}
            <div className="relative flex items-center px-3.5 sm:px-4 py-2 sm:py-2.5 gap-1.5">
              <div className="text-slate-400 dark:text-slate-500 pl-1 shrink-0">
                <Search className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by item name, category, color, or location..."
                className="w-full min-w-0 px-2 sm:px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none bg-transparent"
              />
              {(searchQuery || selectedQuickFilter) ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedQuickFilter('');
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                  title="Clear search & filter"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd
                  className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded mr-1 pointer-events-none select-none shrink-0"
                  title="Press '/' or Cmd+K to search"
                >
                  /
                </kbd>
              )}

              <span className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-0.5 shrink-0" />

              {/* Integrated Custom Filter Dropdown */}
              <div ref={filterDropdownRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isFilterOpen}
                  aria-label="Filter items by type"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                    selectedQuickFilter
                      ? 'bg-red-500/[0.08] dark:bg-red-500/[0.14] text-red-800 dark:text-red-300 border-red-500/25 dark:border-red-500/35 font-semibold'
                      : isFilterOpen
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                      : 'bg-slate-50/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Filter
                    className={`w-3.5 h-3.5 shrink-0 ${
                      selectedQuickFilter ? 'text-theme' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span>{activeFilterLabel}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${
                      isFilterOpen ? 'rotate-180 text-slate-600 dark:text-slate-300' : ''
                    }`}
                  />
                </button>

                {isFilterOpen && (
                  <div
                    role="listbox"
                    aria-label="Item filter options"
                    className="absolute right-0 top-full mt-2 w-48 z-50 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 shadow-xl shadow-slate-900/10 dark:shadow-black/50 p-1.5 animate-popoverEnter"
                  >
                    {QUICK_FILTER_OPTIONS.map((opt, idx) => {
                      const isSelected = selectedQuickFilter === opt.query;
                      return (
                        <div key={opt.label}>
                          {idx === 1 && (
                            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                          )}
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setSelectedQuickFilter(opt.query);
                              setIsFilterOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-red-500/[0.08] dark:bg-red-500/[0.14] text-red-800 dark:text-red-300 font-semibold'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-medium'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-theme shrink-0" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <span className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-0.5 shrink-0" />

              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="p-2 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                title="Refresh inventory"
                aria-label="Refresh inventory data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ================= MATCH ALERT ================= */}
      {unreadMatches.length > 0 && (
        <section className="max-w-5xl mx-auto px-5 sm:px-8 mt-5">
          <ScrollReveal threshold={0.05} yOffset={14} delay={30}>
            <button
              type="button"
              onClick={() => setShowNotifModal(true)}
              className="w-full p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 flex items-center justify-between gap-4 cursor-pointer hover:bg-emerald-100/70 dark:hover:bg-emerald-950/35 hover:border-emerald-300/80 dark:hover:border-emerald-700/60 transition-all duration-200 group text-left shadow-2xs"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 dark:bg-emerald-500/20 text-white dark:text-emerald-400 border border-emerald-600/20 dark:border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform duration-200">
                  <SearchCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {unreadMatches.length} potential match{unreadMatches.length > 1 ? 'es' : ''} found
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                    An item matching your report has been logged.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 shrink-0 group-hover:translate-x-0.5 transition-transform duration-200">
                <span className="hidden sm:inline">View Match</span>
                <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </button>
          </ScrollReveal>
        </section>
      )}

      {/* ================= RECENT POSTINGS (3-6 ITEMS) ================= */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 mt-10">
        <ScrollReveal threshold={0.05} yOffset={14}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Recent Postings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {searchQuery || selectedQuickFilter
                  ? `Showing results matching "${[
                      QUICK_FILTER_OPTIONS.find((o) => o.query === selectedQuickFilter && o.query !== '')?.label,
                      searchQuery.trim()
                    ]
                      .filter(Boolean)
                      .join(' · ')}"`
                  : '3 to 6 of the most recent postings on campus'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab?.('inventory')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-theme hover:underline transition-colors cursor-pointer self-start sm:self-auto group"
            >
              <span>Browse Full Inventory</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </ScrollReveal>

        {/* Shimmer indicator when refreshing */}
        {refreshing && (
          <div className="w-full h-1 rounded-full shimmer-bg my-2 animate-fadeIn" />
        )}

        {/* Postings Grid */}
        {loading ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <ItemCardSkeleton key={idx} delay={idx * 50} />
            ))}
          </div>
        ) : recentPostings.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentPostings.map((item, idx) => {
              const coverPhoto = item.photos?.[0]?.photo_url;
              const badge = getStatusBadge(item.status);
              return (
                <ScrollReveal
                  key={item.id}
                  delay={(idx % 6) * 40}
                  threshold={0.04}
                  className="h-full"
                >
                  <div
                    onClick={() => setSelectedItemForDetail(item)}
                    className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs transition-all duration-200 flex flex-col overflow-hidden cursor-pointer h-full"
                  >
                    {/* Photo */}
                    <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      {coverPhoto ? (
                        <img
                          src={coverPhoto}
                          alt={item.item_name}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300 ease-out"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                          <Package className="w-8 h-8 stroke-[1.5]" />
                          <span className="text-[11px] mt-1.5">No photo</span>
                        </div>
                      )}
                      {/* Minimal status badge */}
                      <div className="absolute top-2.5 right-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-tight bg-white/95 dark:bg-slate-900/95 border ${badge.className}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                          <span>{badge.label}</span>
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                          {item.item_name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.category}
                        </p>

                        <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{item.location_found}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{item.date_found}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                          {getUserRoleTag(item.finder)}
                        </span>
                        <span className="text-xs font-medium text-theme flex items-center gap-0.5 group-hover:gap-1.5 transition-all duration-200">
                          View Details
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50">
            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No items found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {searchQuery || selectedQuickFilter
                ? 'No items matched your current search or filter.'
                : 'No items have been logged yet.'}
            </p>
            {(searchQuery || selectedQuickFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedQuickFilter('');
                }}
                className="mt-3 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Clear Search &amp; Filter
              </button>
            )}
          </div>
        )}

        {/* View all in inventory footer button */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => onNavigateToTab?.('inventory')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <span>View all {foundItems.length} items in Campus Inventory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* ================= YOUR CAMPUS ACTIVITY HUB ================= */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 mt-14">
        <ScrollReveal threshold={0.05} yOffset={14}>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
            {/* Background decoration elements */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-16 w-48 h-48 rounded-full bg-blue-600/10 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-red-300 text-xs font-semibold mb-3">
                  <History className="w-3.5 h-3.5" />
                  <span>Personal Recovery Center</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Your Campus Activity Hub
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                  Track your reported lost belongings, review incoming ownership proofs, coordinate safe-zone handovers, and view your verified audit receipts in a dedicated, distraction-free space.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToTab?.('campus-activity')}
                className="shrink-0 px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
              >
                <span>Open Campus Activity</span>
                <ArrowRight className="w-4 h-4 text-theme" />
              </button>
            </div>

            {/* Quick interactive status cards */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
              {/* Claims & Meetups Card */}
              <div
                onClick={() => onNavigateToTab?.('campus-activity', { subTab: 'claims-meetups' })}
                className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">Claims &amp; Meetups</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    totalActiveClaimsCount > 0 ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-white/10 text-slate-400'
                  }`}>
                    {totalActiveClaimsCount} active
                  </span>
                </div>
                <div className="mt-2 text-2xl font-extrabold text-white group-hover:text-amber-300 transition-colors">
                  {totalActiveClaimsCount}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1 group-hover:text-white transition-colors">
                  <span>Manage meetup &amp; verifications</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* My Lost Reports Card */}
              <div
                onClick={() => onNavigateToTab?.('campus-activity', { subTab: 'my-lost' })}
                className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">My Lost Reports</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-slate-300">
                    {lostReports.length} filed
                  </span>
                </div>
                <div className="mt-2 text-2xl font-extrabold text-white group-hover:text-red-300 transition-colors">
                  {lostReports.length}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1 group-hover:text-white transition-colors">
                  <span>View status &amp; match alerts</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Items I Found Card */}
              <div
                onClick={() => onNavigateToTab?.('campus-activity', { subTab: 'my-found' })}
                className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">Items You Found</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-slate-300">
                    {myFoundCount} posted
                  </span>
                </div>
                <div className="mt-2 text-2xl font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                  {myFoundCount}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1 group-hover:text-white transition-colors">
                  <span>Track handover progress</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ================= RECOVERY PROTOCOL ================= */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 mt-12 mb-8">
        <ScrollReveal threshold={0.05} yOffset={22}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-theme" />
                  Peer Property Recovery Protocol
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Three steps to recover your belongings directly via Campus Safe-Exchange Zones.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                <MapPin className="w-3.5 h-3.5 text-theme" />
                Campus Safe Zones · Mon–Sat, 8 AM – 5 PM
              </span>
            </div>

            {/* Steps Progress Flow */}
            <div className="relative">
              {/* Desktop connecting progress track */}
              <div
                className="hidden md:block absolute top-5 left-[16.6%] right-[16.6%] h-[2px] bg-slate-200/90 dark:bg-slate-800 -translate-y-1/2"
                aria-hidden="true"
              >
                <div className="h-full w-full bg-gradient-to-r from-red-500/70 via-red-500/45 to-red-500/25 rounded-full" />
              </div>

              {/* Mobile connecting vertical line */}
              <div
                className="md:hidden absolute top-5 bottom-8 left-5 w-[2px] bg-slate-200/90 dark:bg-slate-800 -translate-x-1/2"
                aria-hidden="true"
              >
                <div className="h-full w-full bg-gradient-to-b from-red-500/70 via-red-500/45 to-red-500/25 rounded-full" />
              </div>

              {/* Steps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 lg:gap-10">
                {[
                  {
                    step: '1',
                    stage: 'STEP 01',
                    title: 'Submit Ownership Proof',
                    desc: 'Supply distinctive proof (serial numbers, hidden marks, receipts, or lock screen details) in the claim form directly to the finder.'
                  },
                  {
                    step: '2',
                    stage: 'STEP 02',
                    title: 'Finder Review & Chat',
                    desc: 'Once the finder approves your claim, coordinate a safe in-person handover schedule via direct in-app messaging.'
                  },
                  {
                    step: '3',
                    stage: 'STEP 03',
                    title: 'Safe-Zone Turnover',
                    desc: 'Meet at a campus Safe-Exchange Zone (Main Lobby, Library, Guard Post), inspect the item, verify PUP IDs, and confirm mutual return.'
                  }
                ].map((s, i) => (
                  <ScrollReveal key={s.step} threshold={0.05} delay={i * 80} yOffset={12}>
                    <div className="group relative flex md:flex-col items-start md:items-center gap-4 md:gap-0 cursor-default transition-transform duration-300 md:hover:-translate-y-1">
                      {/* Step Indicator Node with Red Shade */}
                      <div className="relative z-10 w-10 h-10 rounded-full bg-white dark:bg-slate-900 p-0.5 shrink-0 flex items-center justify-center">
                        <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-red-500/[0.08] dark:bg-red-500/[0.14] text-xs sm:text-sm font-mono font-bold text-red-700 dark:text-red-400 flex items-center justify-center border border-red-500/25 dark:border-red-500/35 shadow-2xs group-hover:scale-110 group-hover:bg-red-500/[0.18] group-hover:border-red-500/50 group-hover:ring-4 group-hover:ring-red-500/10 dark:group-hover:ring-red-500/20 transition-all duration-300">
                          {s.step}
                        </span>
                      </div>

                      {/* Step Content */}
                      <div className="pt-0.5 md:pt-3.5 md:text-center w-full px-2.5 py-2 rounded-xl transition-colors duration-300 group-hover:bg-slate-50/70 dark:group-hover:bg-slate-800/30">
                        <span className="inline-block text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-0.5 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors">
                          {s.stage}
                        </span>
                        <h5 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-theme transition-colors">
                          {s.title}
                        </h5>
                        <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1 md:max-w-xs md:mx-auto">
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ================= MODALS ================= */}

      {/* Post Found Item Modal */}
      <PostFoundItemModal
        isOpen={showPostFoundModal}
        onClose={() => setShowPostFoundModal(false)}
        onItemPosted={handleItemPosted}
      />

      {/* Report Lost Item Modal */}
      <ReportLostItemModal
        isOpen={showReportLostModal}
        onClose={() => setShowReportLostModal(false)}
        onReportCreated={handleReportCreated}
      />

      {/* Item Detail & Inquire Modal */}
      <ItemDetailModal
        isOpen={!!selectedItemForDetail}
        item={selectedItemForDetail}
        onClose={() => setSelectedItemForDetail(null)}
        onInitiateClaim={(item) => {
          setSelectedItemForDetail(null);
          setItemForClaim(item);
          setShowClaimModal(true);
        }}
        onReportDispute={(item) => {
          setSelectedItemForDetail(null);
          setItemForDispute(item);
          setShowDisputeModal(true);
        }}
      />

      {/* Proof of Ownership Claim Modal */}
      <ProofOfOwnershipModal
        isOpen={showClaimModal}
        item={itemForClaim}
        onClose={() => {
          setShowClaimModal(false);
          setItemForClaim(null);
        }}
        onClaimSubmitted={() => {
          loadData(true);
        }}
      />

      {/* Meetup Coordination Chat Modal */}
      <MeetupChatModal
        isOpen={showChatModal}
        claim={activeChatClaim}
        isAlreadyCompleted={isClaimFinalized(activeChatClaim)}
        onClose={() => {
          setShowChatModal(false);
          setActiveChatClaim(null);
        }}
        onTurnoverConfirmed={(tx) => {
          const postId = activeChatClaim?.post_id || activeChatClaim?.post?.id;
          try {
            if (postId) localStorage.setItem(`seenta_turnover_done_${postId}`, 'true');
            if (activeChatClaim?.id) localStorage.setItem(`seenta_turnover_done_${activeChatClaim.id}`, 'true');
          } catch {}

          if (postId) {
            setFoundItems((prev) =>
              prev.map((f) => (f.id === postId ? { ...f, status: 'Reunited' } : f))
            );
            setClaimsOnMyPosts((prev) =>
              prev.map((c) =>
                c.post_id === postId || c.id === activeChatClaim?.id
                  ? { ...c, status: 'Completed', post: { ...c.post, status: 'Reunited' } }
                  : c
              )
            );
            setMySubmittedClaims((prev) =>
              prev.map((c) =>
                c.post_id === postId || c.id === activeChatClaim?.id
                  ? { ...c, status: 'Completed', post: { ...c.post, status: 'Reunited' } }
                  : c
              )
            );
          }
          if (tx) {
            setTransactions((prev) => {
              const exists = prev.some((t) => t.id === tx.id);
              return exists ? prev : [tx, ...prev];
            });
            setSelectedTxForFeedback(tx);
            setShowFeedbackModal(true);
          }
          loadData(true);
        }}
      />

      {/* Report False Claim Dispute Modal */}
      <DisputeModal
        isOpen={showDisputeModal}
        post={itemForDispute}
        onClose={() => {
          setShowDisputeModal(false);
          setItemForDispute(null);
        }}
        onDisputeFiled={() => {
          loadData(true);
        }}
      />

      {/* Notifications & Match Alerts Modal */}
      <NotificationsModal
        isOpen={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        onViewItem={handleViewNotificationItem}
      />

      {/* Outlook Simulation Modal */}
      <OutlookSimulationModal
        emailData={latestEmail}
        isOpen={showOutlookModal}
        onClose={() => setShowOutlookModal(false)}
      />

      {/* Peer Feedback & Community Rating Modal */}
      <FeedbackRatingModal
        isOpen={showFeedbackModal}
        transaction={selectedTxForFeedback}
        onClose={() => {
          setShowFeedbackModal(false);
          setSelectedTxForFeedback(null);
        }}
        onFeedbackSubmitted={() => {
          loadData(true);
        }}
      />
    </div>
  );
}
