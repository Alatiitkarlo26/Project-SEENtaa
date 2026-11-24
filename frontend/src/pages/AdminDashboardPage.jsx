import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSystemDialog } from '../context/SystemDialogContext';
import { itemService } from '../services/itemService';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  History,
  FileText,
  Package,
  AlertTriangle,
  Mail,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle,
  XCircle,
  Eye,
  Send,
  X,
  Lock,
  Download,
  UserCheck
} from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';

export default function AdminDashboardPage() {
  const { user, role } = useAuth();
  const { showToast, showAlert, showConfirm } = useSystemDialog();

  const [activeTab, setActiveTab] = useState('disputes'); // 'disputes' | 'items' | 'reports' | 'ledger'
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingDisputeId, setUpdatingDisputeId] = useState(null);

  // Formal Notice Modal State
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [referenceItem, setReferenceItem] = useState(null);
  const [noticeType, setNoticeType] = useState('Summon to Campus Security Office');
  const [noticeSubject, setNoticeSubject] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [sendingNotice, setSendingNotice] = useState(false);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await itemService.adminGetOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
      showAlert({
        title: 'Overview Fetch Failed',
        message: err.message || 'Could not connect to the backend server. Please verify the backend is running.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    if (role === 'admin') {
      fetchOverview();
    }
  }, [role, fetchOverview]);

  // If user is not admin, enforce RBAC protection
  if (role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-fadeIn">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-900 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Access Denied (RBAC Protected)</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          The Admin Dashboard and Inventory Audit Trail are restricted exclusively to authorized <strong>PUP Biñan Campus Security Personnel</strong>.
        </p>
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 max-w-sm mx-auto text-left">
          <strong>Authorized Personnel Notice:</strong> Sign in using the official campus security account (<em>security.binan@pup.edu.ph</em> / <em>admin123</em>) to access administrative controls.
        </div>
      </div>
    );
  }

  const foundPosts = overview?.foundPosts || [];
  const lostReports = overview?.lostReports || [];
  const transactions = overview?.transactions || [];
  const disputes = overview?.disputes || [];
  const summary = overview?.summary || {};

  const stats = [
    { label: 'Campus Found Items', count: summary.totalFound ?? foundPosts.length, color: 'text-amber-600', icon: Package },
    { label: 'Student Lost Reports', count: summary.totalLost ?? lostReports.length, color: 'text-rose-600', icon: FileText },
    { label: 'Disputes & Arbitrations', count: summary.totalDisputes ?? disputes.length, color: 'text-blue-600', icon: AlertTriangle },
    { label: 'Reunited at Safe Zones', count: summary.reunitedCount ?? transactions.filter(t => t.completed_at || t.ledger_hash).length, color: 'text-emerald-600', icon: CheckCircle }
  ];

  // Dispute actions
  const handleUpdateDispute = (disputeId, newStatus, unlockPost = false) => {
    const actionLabel = newStatus === 'Resolved' ? 'Resolve & Reunited' : (newStatus === 'UnderReview' ? 'Mark Under Review' : 'Dismiss Dispute');
    showConfirm({
      title: `${actionLabel}?`,
      message: `Are you sure you want to change this dispute's status to "${newStatus}"? ${unlockPost ? 'The contested post status will also be updated accordingly.' : ''}`,
      confirmText: actionLabel,
      type: newStatus === 'Resolved' ? 'success' : (newStatus === 'Dismissed' ? 'danger' : 'primary'),
      onConfirm: async () => {
        setUpdatingDisputeId(disputeId);
        try {
          await itemService.adminUpdateDisputeStatus(disputeId, newStatus, `Arbitrated by Campus Security (${user.fullName})`, unlockPost);
          showToast(`Dispute updated to "${newStatus}". Student has been notified.`, 'success', 'Dispute Arbitrated');
          fetchOverview();
        } catch (err) {
          showAlert({ title: 'Arbitration Error', message: err.message || 'Failed to update dispute status.', type: 'error' });
        } finally {
          setUpdatingDisputeId(null);
        }
      }
    });
  };

  // Open Contact User Modal
  const openContactModal = (target, item = null, defaultNotice = 'Administrative Inquiry') => {
    setTargetUser(target);
    setReferenceItem(item);
    setNoticeType(defaultNotice);
    setNoticeSubject(`[PUP Biñan Campus Security] ${defaultNotice}${item?.item_name ? ` - Item: ${item.item_name}` : ''}`);
    setNoticeMessage(`Greetings,\n\nThis is an official administrative notice from the PUP Biñan Campus Security Office regarding ${item ? `"${item.item_name}"` : 'a campus lost-and-found inquiry'}.\n\nPlease coordinate with the Campus Security Desk on the Ground Floor at your earliest convenience.`);
    setContactModalOpen(true);
  };

  const handleSendNotice = async (e) => {
    e.preventDefault();
    if (!targetUser?.id || !noticeMessage.trim()) return;

    setSendingNotice(true);
    try {
      await itemService.adminContactUser({
        userId: targetUser.id,
        subject: noticeSubject.trim(),
        message: noticeMessage.trim(),
        formalNoticeType: noticeType,
        referenceItemId: referenceItem?.id || ''
      });
      showToast(`Formal notice dispatched to ${targetUser.full_name || targetUser.email}.`, 'success', 'Notice Dispatched');
      setContactModalOpen(false);
    } catch (err) {
      showAlert({ title: 'Dispatch Failed', message: err.message || 'Failed to deliver notice.', type: 'error' });
    } finally {
      setSendingNotice(false);
    }
  };

  // Export ledger
  const exportLedgerCSV = () => {
    if (!transactions.length) {
      showAlert({ title: 'No Records', message: 'No turnover transaction ledger records found.', type: 'info' });
      return;
    }
    const headers = ['Transaction ID', 'Item Name', 'Campus Location', 'Finder Name', 'Claimant Name', 'Completed At', 'SHA-256 Signature'];
    const rows = transactions.map((t) => [
      `"${t.id}"`,
      `"${t.post?.item_name || 'N/A'}"`,
      `"${t.campus_location || 'Safe Zone'}"`,
      `"${t.finder?.full_name || 'Finder'}"`,
      `"${t.claimant?.full_name || 'Claimant'}"`,
      `"${t.completed_at || t.created_at || 'N/A'}"`,
      `"${t.ledger_hash || 'Pending'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `PUP_Biñan_Campus_Security_Audit_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Cryptographic ledger CSV exported.', 'success', 'Export Complete');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      {/* Admin Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-black rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-bold mb-3">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              <span>Campus Security Administration • Official Portal (/admin)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Security Inventory, Disputes &amp; Oversight
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Logged in as <strong className="text-white">{user.fullName || 'Security Officer'}</strong> ({user.studentId || 'Officer ID'}). Read-only student post oversight, active dispute arbitration, and official summons dispatch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchOverview}
              disabled={loading}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold backdrop-blur-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
            <button
              type="button"
              onClick={exportLedgerCSV}
              className="px-4 py-2.5 bg-theme hover:bg-theme-hover text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <ScrollReveal threshold={0.05} yOffset={16}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    {s.label}
                  </div>
                  <div className={`text-3xl font-extrabold ${s.color}`}>
                    {loading ? '...' : s.count}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollReveal>

      {/* Notice Banner: Admin Read-Only Philosophy */}
      <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
        <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Administrative Safeguard Notice:</span> All item posts and lost reports are strictly student-owned and peer-to-peer managed. Campus Security has complete transparency to oversee all campus records and arbitrate disputed claims, but cannot alter or delete student listings. Use the official <strong>&quot;Contact User&quot;</strong> feature to formally summon students or verify physical custody.
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { key: 'disputes', label: 'Disputes & Arbitration Desk', count: disputes.length, badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
          { key: 'items', label: 'All Found Items (Oversight)', count: foundPosts.length, badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
          { key: 'reports', label: 'All Lost Reports (Oversight)', count: lostReports.length, badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
          { key: 'ledger', label: 'Cryptographic Ledger', count: transactions.length, badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setSearchQuery('');
            }}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? 'border-theme text-theme bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tab.badgeColor}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search across ${activeTab}...`}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-theme/30"
          />
        </div>
      </div>

      {/* ================= TAB 1: DISPUTES & ARBITRATION ================= */}
      {activeTab === 'disputes' && (
        <div className="space-y-4">
          {disputes.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-bold text-slate-800 dark:text-slate-200">No active disputes reported</p>
              <p className="text-[11px] mt-1">All campus ownership handovers are proceeding without contest.</p>
            </div>
          ) : (
            disputes
              .filter((d) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  d.post?.item_name?.toLowerCase().includes(q) ||
                  d.reason?.toLowerCase().includes(q) ||
                  d.reporter?.full_name?.toLowerCase().includes(q) ||
                  d.reporter?.student_id?.toLowerCase().includes(q)
                );
              })
              .map((d) => (
                <div
                  key={d.id}
                  className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0">
                        ⚖️
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Disputed Item: {d.post?.item_name || 'Contested Post'}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Filed on {new Date(d.created_at).toLocaleString()} • Case ID: <span className="font-mono">{d.id}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          d.status === 'Resolved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : d.status === 'Dismissed'
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : d.status === 'UnderReview'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Contesting Reporter (Student):</span>
                      <p className="text-slate-900 dark:text-white font-medium">
                        {d.reporter?.full_name || 'Student Reporter'} ({d.reporter?.student_id || 'ID N/A'})
                      </p>
                      <p className="text-[11px] text-slate-500">{d.reporter?.email}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Item Location / Custody:</span>
                      <p className="text-slate-900 dark:text-white font-medium">
                        {d.post?.location_found || 'Campus Grounds'}
                      </p>
                      <p className="text-[11px] text-slate-500">Post Status: <strong>{d.post?.status || 'Unknown'}</strong></p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">Dispute Reason:</span>
                      <p className="mt-1 p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 text-rose-950 dark:text-rose-200 border border-rose-100 dark:border-rose-900/40">
                        {d.reason}
                      </p>
                    </div>

                    {d.evidence_description && (
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">Evidence &amp; Ownership Verification Proof:</span>
                        <p className="mt-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                          {d.evidence_description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Admin Actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openContactModal(d.reporter, d.post, 'Dispute Arbitration Notice')}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Contact / Summon Student</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {d.status !== 'UnderReview' && (
                        <button
                          type="button"
                          disabled={updatingDisputeId === d.id}
                          onClick={() => handleUpdateDispute(d.id, 'UnderReview', false)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                        >
                          Mark Under Review
                        </button>
                      )}

                      {d.status !== 'Resolved' && (
                        <button
                          type="button"
                          disabled={updatingDisputeId === d.id}
                          onClick={() => handleUpdateDispute(d.id, 'Resolved', true)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                        >
                          Resolve &amp; Reunited
                        </button>
                      )}

                      {d.status !== 'Dismissed' && (
                        <button
                          type="button"
                          disabled={updatingDisputeId === d.id}
                          onClick={() => handleUpdateDispute(d.id, 'Dismissed', false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                        >
                          Dismiss Dispute
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* ================= TAB 2: ALL FOUND ITEMS ================= */}
      {activeTab === 'items' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-500 mb-2">
            Showing all student-reported found posts across campus ({foundPosts.length} total).
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {foundPosts
              .filter((p) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  p.item_name?.toLowerCase().includes(q) ||
                  p.category?.toLowerCase().includes(q) ||
                  p.location_found?.toLowerCase().includes(q) ||
                  p.finder?.full_name?.toLowerCase().includes(q)
                );
              })
              .map((p) => (
                <div
                  key={p.id}
                  className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                        {p.item_name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.status === 'Reunited'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : p.status === 'UnderReview'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2">
                      {p.description || 'No description provided.'}
                    </p>

                    <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
                      <div>Category: <strong>{p.category}</strong></div>
                      <div>Found at: <strong>{p.location_found}</strong></div>
                      <div>Finder: <strong>{p.finder?.full_name || 'Student Finder'}</strong></div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => openContactModal(p.finder, p, 'Safe-Exchange Custody Verification')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-theme hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Mail className="w-3 h-3" />
                      <span>Contact Finder</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: ALL LOST REPORTS ================= */}
      {activeTab === 'reports' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-500 mb-2">
            Showing all student lost item reports ({lostReports.length} total).
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lostReports
              .filter((r) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  r.item_name?.toLowerCase().includes(q) ||
                  r.category?.toLowerCase().includes(q) ||
                  r.last_seen_location?.toLowerCase().includes(q) ||
                  r.user?.full_name?.toLowerCase().includes(q)
                );
              })
              .map((r) => (
                <div
                  key={r.id}
                  className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                        {r.item_name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          r.status === 'Resolved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {r.status || 'Active'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2">
                      {r.description || 'No description provided.'}
                    </p>

                    <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
                      <div>Category: <strong>{r.category}</strong></div>
                      <div>Last seen: <strong>{r.last_seen_location}</strong></div>
                      <div>Reporter: <strong>{r.user?.full_name || 'Student Reporter'}</strong></div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => openContactModal(r.user, r, 'Official Campus Security Inquiry')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-theme hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Mail className="w-3 h-3" />
                      <span>Contact Reporter</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ================= TAB 4: CRYPTOGRAPHIC LEDGER ================= */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Immutable record of peer-to-peer handovers finalized at campus safe zones ({transactions.length} total).
            </span>
            <button
              type="button"
              onClick={exportLedgerCSV}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Safe Zone Location</th>
                    <th className="px-4 py-3">Finder</th>
                    <th className="px-4 py-3">Claimant</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date Completed</th>
                    <th className="px-4 py-3">SHA-256 Ledger Signature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {t.post?.item_name || 'Campus Item'}
                      </td>
                      <td className="px-4 py-3">{t.campus_location || 'Campus Safe Zone'}</td>
                      <td className="px-4 py-3">{t.finder?.full_name || 'Finder'}</td>
                      <td className="px-4 py-3">{t.claimant?.full_name || 'Claimant'}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Reunited
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {t.completed_at ? new Date(t.completed_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                        {t.ledger_hash ? `${t.ledger_hash.substring(0, 16)}...` : 'Pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONTACT USER FORMAL NOTICE ================= */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-theme/10 text-theme flex items-center justify-center font-bold text-xs">
                  🏛️
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Issue Formal Campus Security Notice
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Recipient: <strong>{targetUser?.full_name || 'Student'}</strong> ({targetUser?.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendNotice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notice Type
                </label>
                <select
                  value={noticeType}
                  onChange={(e) => setNoticeType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-theme/30"
                >
                  <option value="Summon to Campus Security Office">Summon to Campus Security Office</option>
                  <option value="Dispute Arbitration Notice">Dispute Arbitration Notice</option>
                  <option value="Safe-Exchange Custody Verification">Safe-Exchange Custody Verification</option>
                  <option value="Administrative Inquiry">Administrative Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={noticeSubject}
                  onChange={(e) => setNoticeSubject(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-theme/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notice Message
                </label>
                <textarea
                  rows={5}
                  value={noticeMessage}
                  onChange={(e) => setNoticeMessage(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-theme/30 leading-relaxed font-sans"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  This notice will be recorded in the student&apos;s in-app notification inbox and dispatched to their registered PUP Webmail.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setContactModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingNotice}
                  className="px-5 py-2 rounded-xl bg-theme hover:bg-theme-hover text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingNotice ? 'Dispatching...' : 'Dispatch Formal Notice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
