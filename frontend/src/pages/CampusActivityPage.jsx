import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSystemDialog } from '../context/SystemDialogContext';
import { itemService } from '../services/itemService';
import { authService } from '../services/authService';
import ScrollReveal from '../components/ScrollReveal';
import ItemDetailModal from '../components/ItemDetailModal';
import ProofOfOwnershipModal from '../components/ProofOfOwnershipModal';
import MeetupChatModal from '../components/MeetupChatModal';
import DisputeModal from '../components/DisputeModal';
import FeedbackRatingModal from '../components/FeedbackRatingModal';
import ReportLostItemModal from '../components/ReportLostItemModal';
import PostFoundItemModal from '../components/PostFoundItemModal';
import { ItemCardSkeleton } from '../components/Skeleton';
import {
  FileText,
  CheckCircle2,
  MapPin,
  Calendar,
  ArrowRight,
  Tag,
  MessageSquare,
  History,
  Download,
  XCircle,
  Package,
  RefreshCw,
  Search,
  Plus
} from 'lucide-react';

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

export default function CampusActivityPage({
  initialTab = 'claims-meetups',
  targetClaimId = null,
  targetPostId = null,
  onNavigateToTab
}) {
  const { user } = useAuth();
  const { showConfirm, showToast, showAlert } = useSystemDialog();

  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync activeTab when initialTab prop updates
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [foundItems, setFoundItems] = useState([]);
  const [lostReports, setLostReports] = useState([]);
  const [claimsOnMyPosts, setClaimsOnMyPosts] = useState([]);
  const [mySubmittedClaims, setMySubmittedClaims] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedItemForDetail, setSelectedItemForDetail] = useState(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [itemForClaim, setItemForClaim] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [activeChatClaim, setActiveChatClaim] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [itemForDispute, setItemForDispute] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedTxForFeedback, setSelectedTxForFeedback] = useState(null);
  const [showReportLostModal, setShowReportLostModal] = useState(false);
  const [showPostFoundModal, setShowPostFoundModal] = useState(false);

  // Background Data Fetching
  const loadData = useCallback(async (isRefresh = false, isSilent = false) => {
    if (!isSilent) {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
    }

    try {
      const [foundData, lostData, incomingClaims, myClaims, txData] = await Promise.all([
        itemService.getFoundPosts(),
        user?.id ? itemService.getLostReports({ userId: user.id }) : [],
        user?.id ? itemService.getClaims({ finderId: user.id }) : [],
        user?.id ? itemService.getClaims({ claimantId: user.id }) : [],
        user?.id ? itemService.getTransactions(user.id) : []
      ]);

      setFoundItems(foundData || []);
      setLostReports(lostData || []);
      setClaimsOnMyPosts(incomingClaims || []);
      setMySubmittedClaims(myClaims || []);
      setTransactions(txData || []);
    } catch (err) {
      if (!isSilent) console.error('Failed to load campus activity data:', err);
    } finally {
      if (!isSilent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user]);

  // Initial load + periodic silent AJAX synchronization
  useEffect(() => {
    loadData();

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

  // If a target claim ID was specified (e.g. from notification click), open it in Meetup Chat
  useEffect(() => {
    if (targetClaimId && (claimsOnMyPosts.length > 0 || mySubmittedClaims.length > 0)) {
      const all = [...claimsOnMyPosts, ...mySubmittedClaims];
      const match = all.find((c) => c.id === targetClaimId || c.post_id === targetClaimId);
      if (match) {
        setActiveChatClaim(match);
        setShowChatModal(true);
        setActiveTab('claims-meetups');
      }
    }
  }, [targetClaimId, claimsOnMyPosts, mySubmittedClaims]);

  // If a target post ID was specified, open its item detail
  useEffect(() => {
    if (targetPostId && foundItems.length > 0) {
      const match = foundItems.find((f) => f.id === targetPostId);
      if (match) {
        setSelectedItemForDetail(match);
      }
    }
  }, [targetPostId, foundItems]);

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

  const myPostedItems = useMemo(() => {
    return foundItems.filter((i) => i.finder_id === user?.id);
  }, [foundItems, user?.id]);

  const activityTabs = [
    { key: 'claims-meetups', label: 'Claims & Meetups', count: totalActiveClaimsCount },
    { key: 'my-lost', label: 'My Lost Reports', count: lostReports.length },
    { key: 'my-found', label: 'Items You Found', count: myPostedItems.length }
  ];

  const handleApproveClaim = (claimId) => {
    showConfirm({
      title: 'Approve Ownership Claim',
      message: 'Are you sure you want to approve this ownership claim? This will open direct in-app chat to coordinate physical return at an official safe zone.',
      confirmText: 'Approve & Open Meetup',
      cancelText: 'Cancel',
      type: 'primary',
      onConfirm: async () => {
        setClaimsOnMyPosts((prev) =>
          prev.map((c) => (c.id === claimId ? { ...c, status: 'Approved' } : c))
        );
        try {
          await itemService.updateClaimStatus(claimId, 'Approved');
          showToast('Claim approved! Meetup chat is now accessible.', 'success', 'Claim Approved');
          loadData(true);
        } catch (err) {
          showAlert({ title: 'Error', message: err.message || 'Failed to approve claim.', type: 'error' });
          loadData(true);
        }
      }
    });
  };

  const handleRejectClaim = (claimId) => {
    showConfirm({
      title: 'Decline Ownership Claim',
      message: 'Decline this ownership claim? The claimant will be notified that identifying details did not match the item.',
      confirmText: 'Decline Claim',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setClaimsOnMyPosts((prev) =>
          prev.map((c) => (c.id === claimId ? { ...c, status: 'Rejected' } : c))
        );
        try {
          await itemService.updateClaimStatus(claimId, 'Rejected', 'Proof details did not match physical item features.');
          showToast('Claim has been declined.', 'info', 'Claim Declined');
          loadData(true);
        } catch (err) {
          showAlert({ title: 'Error', message: err.message || 'Failed to decline claim.', type: 'error' });
          loadData(true);
        }
      }
    });
  };

  const exportAuditLogCSV = () => {
    if (finalizedTransactions.length === 0) return;
    const headers = ['Transaction ID', 'Item Name', 'Campus Safe Zone', 'Finder', 'Claimant', 'Cryptographic Ledger Hash', 'Completion Timestamp'];
    const rows = finalizedTransactions.map((tx) => [
      tx.id,
      `"${tx.post?.item_name || 'Item'}"`,
      `"${tx.campus_location || 'Campus Safe Zone'}"`,
      `"${tx.finder?.full_name || 'Finder'}"`,
      `"${tx.claimant?.full_name || 'Claimant'}"`,
      tx.ledger_hash || 'Verified',
      tx.completed_at || tx.created_at
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SEENta_Handover_Audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Cryptographic audit log exported.', 'success', 'Audit Export');
  };

  const exportAuditLogJSON = () => {
    if (finalizedTransactions.length === 0) return;
    const blob = new Blob([JSON.stringify(finalizedTransactions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SEENta_Handover_Ledger_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Full JSON audit ledger downloaded.', 'success', 'Ledger Export');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme/10 text-theme text-xs font-semibold mb-3">
              <History className="w-3.5 h-3.5" />
              <span>Personal Tracking &amp; Custody Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Your Campus Activity
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              Manage your filed lost reports, review submitted ownership claims, coordinate safe-exchange meetups, and inspect finalized cryptographic audit receipts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowPostFoundModal(true)}
              className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-xs font-semibold hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post Found Item</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReportLostModal(true)}
              className="px-4 py-2 bg-theme hover:bg-theme-hover text-white rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Report Lost Item</span>
            </button>
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              title="Refresh Activity"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-8 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
          {activityTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative pb-3 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums font-bold ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'bg-slate-100/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-theme rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Claims & Meetups */}
      {activeTab === 'claims-meetups' && (
        <div className="space-y-8 animate-fadeIn">
          {/* 1. Active Incoming Claims on Items You Found */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Active Claims on Items You Found</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                    {activeIncomingClaims.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Review submitted proofs of ownership and coordinate in-person return.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ItemCardSkeleton />
                <ItemCardSkeleton />
              </div>
            ) : activeIncomingClaims.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeIncomingClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4 shadow-2xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-500">
                          Claim for: <strong className="text-slate-900 dark:text-white">{claim.post?.item_name || 'Found Item'}</strong>
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            claim.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {claim.status === 'UnderReview' ? 'Pending Your Review' : claim.status}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                        <div>Claimant: <strong>{claim.claimant?.full_name}</strong> ({claim.claimant?.student_id})</div>
                        {claim.serial_number && <div>Serial / ID: <code className="font-mono bg-white dark:bg-slate-900 px-1 rounded">{claim.serial_number}</code></div>}
                        <div className="pt-1">
                          <span className="font-semibold text-slate-900 dark:text-white">Submitted Proof:</span>
                          <p className="italic text-slate-600 dark:text-slate-400 mt-0.5">&quot;{claim.proof_description}&quot;</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {new Date(claim.created_at).toLocaleDateString()}
                      </span>

                      {claim.status === 'UnderReview' ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRejectClaim(claim.id)}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveClaim(claim.id)}
                            className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer"
                          >
                            Approve Claim
                          </button>
                        </div>
                      ) : claim.status === 'Approved' && !isClaimFinalized(claim) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChatClaim(claim);
                            setShowChatModal(true);
                          }}
                          className="px-4 py-1.5 rounded-full bg-theme hover:bg-theme-hover text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Meetup Chat &amp; Handover</span>
                        </button>
                      ) : isClaimFinalized(claim) ? (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/40">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Handover Finalized</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-500">
                No active claims currently waiting on items you found.
              </div>
            )}
          </div>

          {/* 2. Your Active Claims on Found Belongings */}
          <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Your Active Claims on Found Belongings</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold">
                  {activeMySubmittedClaims.length}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Track ongoing claims awaiting finder review or safe-zone meetup.
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ItemCardSkeleton />
                <ItemCardSkeleton />
              </div>
            ) : activeMySubmittedClaims.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeMySubmittedClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4 shadow-2xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {claim.post?.item_name || 'Item Claim'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            claim.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {claim.status === 'UnderReview' ? 'Under Finder Review' : claim.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl italic">
                        &quot;{claim.proof_description}&quot;
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {new Date(claim.created_at).toLocaleDateString()}
                      </span>

                      {claim.status === 'Approved' && !isClaimFinalized(claim) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChatClaim(claim);
                            setShowChatModal(true);
                          }}
                          className="px-4 py-1.5 rounded-full bg-theme hover:bg-theme-hover text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Meetup Chat &amp; Handover</span>
                        </button>
                      ) : isClaimFinalized(claim) ? (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/40">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Handover Finalized</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-500">
                You have no pending or active claims in progress.
              </div>
            )}
          </div>

          {/* 3. Declined & Rejected Claims (Dedicated Separate Section) */}
          {rejectedClaims.length > 0 && (
            <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span>Declined &amp; Rejected Claims</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-semibold">
                    {rejectedClaims.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Claims where identifying features did not match the physical item.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rejectedClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="p-5 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/20 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {claim.post?.item_name || 'Claimed Item'}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {claim.direction === 'incoming' ? 'Submitted by student on your found item' : 'Claim you submitted'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 uppercase">
                          Declined
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/40 text-xs space-y-1">
                        <span className="font-semibold text-rose-700 dark:text-rose-400">Reason for Declining:</span>
                        <p className="italic text-slate-700 dark:text-slate-300">
                          &quot;{claim.rejection_reason || 'Details did not match physical item features.'}&quot;
                        </p>
                      </div>

                      {claim.proof_description && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Submitted Proof: <span className="italic">&quot;{claim.proof_description}&quot;</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-rose-100 dark:border-rose-900/30 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{new Date(claim.reviewed_at || claim.created_at).toLocaleDateString()}</span>
                      <span className="font-medium text-slate-500">Handover Closed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Finalized Handover History & Audit Log */}
          {finalizedTransactions.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-600" />
                    <span>Finalized Handover History &amp; Audit Log</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                      {finalizedTransactions.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Completed physical handovers finalized at campus safe zones. Handover chats are permanently completed and closed.
                  </p>
                </div>

                {/* Export Audit Log Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportAuditLogCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    title="Download cryptographic audit records in CSV format"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportAuditLogJSON}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    title="Download full JSON audit ledger"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {finalizedTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 text-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {tx.post?.item_name || 'Returned Item'}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                        Reunited
                      </span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 space-y-1">
                      <div>
                        Exchange Safe Zone: <strong>{tx.campus_location}</strong>
                      </div>
                      <div>
                        Participants: <strong>{tx.finder?.full_name || 'Finder'}</strong> &amp; <strong>{tx.claimant?.full_name || 'Claimant'}</strong>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono bg-white/70 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      Ledger Signature: {tx.ledger_hash ? `${tx.ledger_hash.slice(0, 20)}...` : 'Verified'}
                    </div>
                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/30 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {new Date(tx.completed_at || tx.created_at).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTxForFeedback(tx);
                          setShowFeedbackModal(true);
                        }}
                        className="text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                      >
                        ⭐ Rate Experience
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Lost Reports */}
      {activeTab === 'my-lost' && (
        <div className="animate-fadeIn">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ItemCardSkeleton />
              <ItemCardSkeleton />
            </div>
          ) : lostReports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lostReports.map((report, idx) => (
                <ScrollReveal
                  key={report.id}
                  delay={(idx % 4) * 45}
                  threshold={0.04}
                  className="h-full"
                >
                  <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 flex flex-col justify-between h-full">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {report.category}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            report.status === 'Matched'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300'
                          }`}
                        >
                          {report.status === 'Matched' ? 'Match Found' : report.status || 'Active'}
                        </span>
                      </div>

                      <div className="flex items-start gap-3.5">
                        {report.photo_url ? (
                          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                            <img src={report.photo_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center shrink-0">
                            <Tag className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug truncate">
                            {report.item_name}
                          </h4>
                          {report.color && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {report.color}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{report.last_known_location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>{report.date_lost}</span>
                        </div>
                      </div>

                      {report.description && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 italic">
                          &quot;{report.description}&quot;
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-mono">
                        #{report.id?.slice(0, 8)}
                      </span>
                      {report.status === 'Matched' ? (
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                          Match Available
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Scanning for matches...</span>
                      )}
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
              <FileText className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No reports filed yet</h4>
              <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                Lost something on campus? File a report and our system will notify you the moment a match appears.
              </p>
              <button
                type="button"
                onClick={() => setShowReportLostModal(true)}
                className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-theme hover:bg-theme-hover rounded-full transition cursor-pointer"
              >
                File a Lost Report
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Items You Found */}
      {activeTab === 'my-found' && (
        <div className="animate-fadeIn">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ItemCardSkeleton />
              <ItemCardSkeleton />
              <ItemCardSkeleton />
            </div>
          ) : myPostedItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myPostedItems.map((item, idx) => {
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
                        <div className="absolute top-2.5 right-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-tight bg-white/95 dark:bg-slate-900/95 border ${badge.className}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                            <span>{badge.label}</span>
                          </span>
                        </div>
                      </div>

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
                          <span className="text-[11px] text-slate-400 font-mono">
                            #{item.id?.slice(0, 8)}
                          </span>
                          <span className="text-xs font-medium text-theme flex items-center gap-0.5 group-hover:gap-1.5 transition-all duration-200">
                            Manage Post
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
            <div className="py-20 text-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
              <Package className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">You haven&apos;t posted any found items</h4>
              <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                Found someone&apos;s lost belongings on campus? Post it here so the owner can securely claim it.
              </p>
              <button
                type="button"
                onClick={() => setShowPostFoundModal(true)}
                className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-full hover:opacity-90 transition cursor-pointer"
              >
                Post a Found Item
              </button>
            </div>
          )}
        </div>
      )}

      {/* Item Detail Modal */}
      <ItemDetailModal
        item={selectedItemForDetail}
        isOpen={!!selectedItemForDetail}
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

      {/* Rating & Community Feedback Modal */}
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

      {/* Quick Report Lost Item Modal */}
      <ReportLostItemModal
        isOpen={showReportLostModal}
        onClose={() => setShowReportLostModal(false)}
        onReportCreated={() => {
          setShowReportLostModal(false);
          loadData(true);
        }}
      />

      {/* Quick Post Found Item Modal */}
      <PostFoundItemModal
        isOpen={showPostFoundModal}
        onClose={() => setShowPostFoundModal(false)}
        onItemPosted={() => {
          setShowPostFoundModal(false);
          loadData(true);
        }}
      />
    </div>
  );
}
