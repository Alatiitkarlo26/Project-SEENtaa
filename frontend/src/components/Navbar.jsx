import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SeentaLogo from './SeentaLogo';
import pupLogoImg from '../assets/PUP-Logo.png';
import AccessibilityModal from './AccessibilityModal';
import NotificationsModal from './NotificationsModal';
import ReportLostItemModal from './ReportLostItemModal';
import PostFoundItemModal from './PostFoundItemModal';
import { itemService } from '../services/itemService';
import {
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  PersonStanding,
  Bell
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, role, logout } = useAuth();
  const { isDark, toggleMode } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isA11yModalOpen, setIsA11yModalOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPostFoundModalOpen, setIsPostFoundModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertsTrigger, setAlertsTrigger] = useState('desktop');
  const [a11yTrigger, setA11yTrigger] = useState('desktop');
  const desktopAlertsBtnRef = useRef(null);
  const mobileAlertsBtnRef = useRef(null);
  const desktopA11yBtnRef = useRef(null);
  const mobileA11yBtnRef = useRef(null);

  // Active section for navigation: 'home' | 'inventory' | 'campus-activity' | 'about-us'
  const [activeNav, setActiveNav] = useState(() => (activeTab === 'about-us' ? 'about-us' : 'home'));

  // Refs for tracking button geometries for the sliding indicator
  const navRef = useRef(null);
  const homeBtnRef = useRef(null);
  const inventoryBtnRef = useRef(null);
  const activityBtnRef = useRef(null);
  const aboutBtnRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await itemService.getNotifications(user.id);
      const unread = (data || []).filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Synchronize indicator position with activeNav
  const updateIndicator = useCallback(() => {
    let targetRef = null;
    if (activeNav === 'home') targetRef = homeBtnRef.current;
    else if (activeNav === 'inventory') targetRef = inventoryBtnRef.current;
    else if (activeNav === 'campus-activity') targetRef = activityBtnRef.current;
    else if (activeNav === 'about-us') targetRef = aboutBtnRef.current;

    if (targetRef && navRef.current) {
      const navRect = navRef.current.getBoundingClientRect();
      const btnRect = targetRef.getBoundingClientRect();
      setIndicator({
        left: btnRect.left - navRect.left,
        width: btnRect.width,
        opacity: 1
      });
    } else {
      setIndicator((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [activeNav]);

  useEffect(() => {
    updateIndicator();
    const timer = setTimeout(updateIndicator, 60);
    window.addEventListener('resize', updateIndicator);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [updateIndicator, role]);

  // Sync activeNav with activeTab when routed externally
  useEffect(() => {
    if (activeTab === 'inventory') {
      setActiveNav('inventory');
    } else if (activeTab === 'campus-activity') {
      setActiveNav('campus-activity');
    } else if (activeTab === 'about-us') {
      setActiveNav('about-us');
    } else if (activeTab === 'privacy-terms') {
      setActiveNav('privacy-terms');
    } else {
      setActiveNav('home');
    }
  }, [activeTab]);

  const handleHomeClick = () => {
    setActiveNav('home');
    setActiveTab(role === 'admin' ? 'admin-dashboard' : 'student-dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBrowseInventory = () => {
    setActiveNav('inventory');
    setActiveTab('inventory');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleActivityClick = () => {
    setActiveNav('campus-activity');
    setActiveTab('campus-activity');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAboutUsClick = () => {
    setActiveNav('about-us');
    setActiveTab('about-us');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewNotificationItem = (notif) => {
    setIsNotifModalOpen(false);
    fetchUnreadCount();
    if (!notif) return;

    const refId = notif.reference_id || notif.referenceId;
    const type = notif.type;

    if (type === 'MATCH') {
      if (refId && typeof refId === 'string' && refId.startsWith('lost_')) {
        setActiveNav('campus-activity');
        setActiveTab('campus-activity', { subTab: 'my-lost', targetReportId: refId, action: 'report' });
      } else {
        setActiveNav('inventory');
        setActiveTab('inventory', { targetItemId: refId });
      }
    } else if (type === 'CLAIM_APPROVED') {
      setActiveNav('campus-activity');
      setActiveTab('campus-activity', { subTab: 'claims-meetups', targetClaimId: refId, action: 'chat' });
    } else if (type === 'CLAIM_SUBMITTED') {
      setActiveNav('campus-activity');
      setActiveTab('campus-activity', { subTab: 'claims-meetups', targetClaimId: refId, action: 'review' });
    } else if (type === 'CLAIM_REJECTED') {
      setActiveNav('campus-activity');
      setActiveTab('campus-activity', { subTab: 'claims-meetups', targetClaimId: refId, action: 'rejected' });
    } else if (type === 'HANDOVER_CONFIRMED') {
      setActiveNav('campus-activity');
      setActiveTab('campus-activity', { subTab: 'claims-meetups', targetTxId: refId, action: 'finalized' });
    } else if (type === 'DISPUTE_UPDATE') {
      if (role === 'admin') {
        setActiveNav('admin-dashboard');
        setActiveTab('admin-dashboard');
      } else {
        setActiveNav('campus-activity');
        setActiveTab('campus-activity', { subTab: 'claims-meetups' });
      }
    } else {
      setActiveNav('campus-activity');
      setActiveTab('campus-activity', { subTab: 'claims-meetups' });
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors duration-200">
        {/* Main Header Bar */}
        <div className="w-full flex items-center justify-between h-18 pl-6 sm:pl-10 lg:pl-16 pr-4 sm:pr-6 lg:pr-8">
          {/* Left Section: SEENta Brand + Nav Links */}
          <div className="flex items-center gap-6 lg:gap-8">
            {/* SEENta Brand */}
            <div
              onClick={handleHomeClick}
              className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none group shrink-0"
            >
              <img
                src={pupLogoImg}
                alt="PUP Logo"
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0 transition-transform duration-200 group-hover:scale-105"
              />
              <div className="flex flex-col">
                <SeentaLogo size="md" showSubtitle={true} />
              </div>
            </div>

            {/* Frameless Navigation with Smoothly Transferring Red Shade */}
            <nav
              ref={navRef}
              className="relative hidden md:flex items-center gap-1 sm:gap-1.5"
              aria-label="Main Navigation"
            >
              {/* Animated Sliding Red Shade Pill */}
              <span
                className="absolute top-0 bottom-0 rounded-full bg-red-500/[0.08] dark:bg-red-500/[0.14] border border-red-500/20 dark:border-red-500/30 shadow-2xs pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  transform: `translateX(${indicator.left}px)`,
                  width: `${indicator.width}px`,
                  opacity: indicator.opacity
                }}
                aria-hidden="true"
              />

              {/* Home */}
              <button
                ref={homeBtnRef}
                type="button"
                onClick={handleHomeClick}
                className={`relative z-10 px-4 py-1.5 rounded-full text-xs transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center active:scale-95 ${
                  activeNav === 'home'
                    ? 'text-red-800 dark:text-red-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <span>Home</span>
              </button>

              {/* Browse Inventory */}
              <button
                ref={inventoryBtnRef}
                type="button"
                onClick={handleBrowseInventory}
                className={`relative z-10 px-3.5 py-1.5 rounded-full text-xs transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center active:scale-95 ${
                  activeNav === 'inventory'
                    ? 'text-red-800 dark:text-red-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <span>Inventory</span>
              </button>

              {/* Campus Activity (Student only) */}
              {role !== 'admin' && (
                <button
                  ref={activityBtnRef}
                  type="button"
                  onClick={handleActivityClick}
                  className={`relative z-10 px-3.5 py-1.5 rounded-full text-xs transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center active:scale-95 whitespace-nowrap ${
                    activeNav === 'campus-activity'
                      ? 'text-red-800 dark:text-red-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                  }`}
                >
                  <span>Campus Activity</span>
                </button>
              )}

              {/* Report Lost Item (hidden for admin) */}
              {role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="relative z-10 px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all duration-200 cursor-pointer select-none text-center flex items-center justify-center active:scale-95 whitespace-nowrap"
                >
                  <span>Report Lost</span>
                </button>
              )}

              {/* Post Found Item (hidden for admin) */}
              {role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => setIsPostFoundModalOpen(true)}
                  className="relative z-10 px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all duration-200 cursor-pointer select-none text-center flex items-center justify-center active:scale-95 whitespace-nowrap"
                >
                  <span>Post Found</span>
                </button>
              )}

              {/* About Us */}
              <button
                ref={aboutBtnRef}
                type="button"
                onClick={handleAboutUsClick}
                className={`relative z-10 px-4 py-1.5 rounded-full text-xs transition-colors duration-200 cursor-pointer select-none text-center flex items-center justify-center active:scale-95 ${
                  activeNav === 'about-us'
                    ? 'text-red-800 dark:text-red-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <span>About Us</span>
              </button>
            </nav>
          </div>

            {/* Right Controls: Theme Buttons + User Card & Logout */}
            <div className="hidden sm:flex items-center gap-3 -mr-1 sm:-mr-2">
              {/* Quick Dark/Light Toggle */}
              <button
                type="button"
                onClick={(e) => toggleMode(e)}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white transition cursor-pointer shadow-2xs active:scale-95"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label="Toggle dark mode"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400 transition" />
                ) : (
                  <Moon className="w-4 h-4 transition" />
                )}
              </button>

              {/* Accessibility Popover Opener */}
              <button
                ref={desktopA11yBtnRef}
                type="button"
                onClick={() => {
                  setA11yTrigger('desktop');
                  setIsNotifModalOpen(false);
                  setIsA11yModalOpen((prev) => !prev);
                }}
                className={`h-9 flex items-center gap-2 px-3.5 text-xs font-semibold rounded-full border transition cursor-pointer shadow-2xs active:scale-95 ${
                  isA11yModalOpen && a11yTrigger === 'desktop'
                    ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
                title="Accessibility & Appearance"
                aria-label="Open appearance and accessibility settings"
                aria-expanded={isA11yModalOpen && a11yTrigger === 'desktop'}
              >
                <PersonStanding className="w-4 h-4 text-theme" />
                <span className="hidden lg:inline">Accessibility</span>
              </button>

              {/* Notifications Trigger (next to profile beside accessibility) */}
              <button
                ref={desktopAlertsBtnRef}
                type="button"
                onClick={() => {
                  setAlertsTrigger('desktop');
                  setIsA11yModalOpen(false);
                  setIsNotifModalOpen((prev) => !prev);
                }}
                className={`relative h-9 flex items-center gap-2 px-3.5 text-xs font-semibold rounded-full border transition-all cursor-pointer shadow-2xs group active:scale-95 ${
                  isNotifModalOpen && alertsTrigger === 'desktop'
                    ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : unreadCount > 0
                    ? 'border-red-500/30 dark:border-red-500/40 bg-red-500/[0.035] dark:bg-red-950/20 text-slate-700 dark:text-slate-200 shadow-[0_0_12px_-2px_rgba(239,68,68,0.22)] hover:border-red-500/50'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
                title="Notifications"
                aria-label="Open notifications"
                aria-expanded={isNotifModalOpen && alertsTrigger === 'desktop'}
              >
                <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                )}
              </button>

              {/* User Identity Pill */}
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800">
                <div className="w-9 h-9 rounded-full bg-theme text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                  {(user?.role === 'admin' ? 'Campus Administrator' : user?.fullName)?.charAt(0) || 'U'}
                </div>
                <div className="text-left min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {user?.role === 'admin' ? 'Campus Administrator' : user?.fullName}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                    {user?.studentId} • {user?.roleTitle || 'Iskolar'}
                  </div>
                </div>
              </div>

              {/* Sign Out with Cloud Reminder Tooltip */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={logout}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200/90 dark:border-slate-700/80 bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 cursor-pointer shadow-2xs active:scale-95"
                  aria-label="Sign out of your account"
                >
                  <LogOut className="w-3.5 h-3.5 transition-transform group-hover:scale-105" />
                </button>

                {/* Cloud Text Bubble (Quiet hover reminder, adapts to light/dark mode) */}
                <div
                  role="tooltip"
                  className="absolute top-full right-0 mt-2.5 z-50 pointer-events-none opacity-0 invisible translate-y-1 scale-95 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:scale-100 transition-all duration-200 ease-out delay-75"
                >
                  <div className="relative px-3.5 py-1.5 bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 backdrop-blur-md rounded-2xl shadow-lg shadow-slate-900/10 dark:shadow-black/50 border border-slate-200/90 dark:border-slate-700/80 text-[11px] font-medium whitespace-nowrap tracking-tight">
                    {/* Cloud Bubble Arrow Notch */}
                    <div className="absolute -top-1 right-3.5 w-2 h-2 rotate-45 bg-white/95 dark:bg-slate-800/95 border-t border-l border-slate-200/90 dark:border-slate-700/80" />
                    <span>Sign out of your account?</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Actions: Dark Mode + Theme + Alerts + Hamburger */}
            <div className="flex sm:hidden items-center gap-1 -mr-1 sm:-mr-2">
              <button
                type="button"
                onClick={(e) => toggleMode(e)}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer shadow-2xs active:scale-95"
                title="Toggle Mode"
                aria-label="Toggle dark mode"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                ref={mobileA11yBtnRef}
                type="button"
                onClick={() => {
                  setA11yTrigger('mobile');
                  setIsNotifModalOpen(false);
                  setIsA11yModalOpen((prev) => !prev);
                }}
                className={`p-2 rounded-lg cursor-pointer transition-colors ${
                  isA11yModalOpen && a11yTrigger === 'mobile'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Accessibility & Appearance"
                aria-label="Open appearance and accessibility settings"
                aria-expanded={isA11yModalOpen && a11yTrigger === 'mobile'}
              >
                <PersonStanding className="w-5 h-5 text-theme" />
              </button>

              <button
                ref={mobileAlertsBtnRef}
                type="button"
                onClick={() => {
                  setAlertsTrigger('mobile');
                  setIsA11yModalOpen(false);
                  setIsNotifModalOpen((prev) => !prev);
                }}
                className={`relative p-2 rounded-lg cursor-pointer transition-all active:scale-95 ${
                  isNotifModalOpen && alertsTrigger === 'mobile'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : unreadCount > 0
                    ? 'bg-red-500/[0.04] dark:bg-red-950/20 border border-red-500/30 dark:border-red-500/40 text-slate-700 dark:text-slate-200 shadow-[0_0_10px_-2px_rgba(239,68,68,0.25)]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Notifications"
                aria-label="Open notifications"
                aria-expanded={isNotifModalOpen && alertsTrigger === 'mobile'}
              >
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300 transition-colors" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 animate-fadeIn">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700">
              <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {user?.role === 'admin' ? 'Campus Administrator' : user?.fullName}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{user?.studentId}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</div>
            </div>

            {/* Mobile Nav Links */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleHomeClick();
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-xs text-left transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-95 ${
                  activeNav === 'home'
                    ? 'bg-red-500/[0.08] dark:bg-red-500/[0.14] text-red-800 dark:text-red-300 font-semibold border border-red-500/20 dark:border-red-500/30 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent font-medium'
                }`}
              >
                <span>Home</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleBrowseInventory();
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-xs text-left transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-95 ${
                  activeNav === 'inventory'
                    ? 'bg-red-500/[0.08] dark:bg-red-500/[0.14] text-red-800 dark:text-red-300 font-semibold border border-red-500/20 dark:border-red-500/30 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent font-medium'
                }`}
              >
                <span>Inventory</span>
              </button>

              {role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleActivityClick();
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs text-left transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-95 ${
                    activeNav === 'campus-activity'
                      ? 'bg-red-500/[0.08] dark:bg-red-500/[0.14] text-red-800 dark:text-red-300 font-semibold border border-red-500/20 dark:border-red-500/30 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent font-medium'
                  }`}
                >
                  <span>Campus Activity</span>
                </button>
              )}

              {role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsReportModalOpen(true);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 text-left transition-all duration-200 ease-out cursor-pointer active:scale-95 border border-transparent"
                >
                  <span>Report Lost Item</span>
                </button>
              )}

              {role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsPostFoundModalOpen(true);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 text-left transition-all duration-200 ease-out cursor-pointer active:scale-95 border border-transparent"
                >
                  <span>Post Found Item</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleAboutUsClick();
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-xs text-left transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-95 ${
                  activeNav === 'about-us'
                    ? 'bg-red-500/[0.08] dark:bg-red-500/[0.14] text-red-800 dark:text-red-300 font-semibold border border-red-500/20 dark:border-red-500/30 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent font-medium'
                }`}
              >
                <span>About Us</span>
              </button>
            </div>

            {/* Notifications Trigger */}
            <button
              onClick={() => {
                setAlertsTrigger('mobile');
                setIsNotifModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className={`w-full py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                unreadCount > 0
                  ? 'border-red-500/30 dark:border-red-500/40 bg-red-500/[0.035] dark:bg-red-950/20 text-slate-800 dark:text-slate-200 shadow-[0_0_12px_-2px_rgba(239,68,68,0.2)]'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span>Notifications</span>
              </span>
              {unreadCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              )}
            </button>

            {/* Appearance & Themes Trigger */}
            <button
              onClick={() => {
                setIsA11yModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <PersonStanding className="w-4 h-4 text-theme" />
                <span>Accessibility &amp; Appearance</span>
              </span>
            </button>

            {/* Sign Out */}
            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
              className="w-full py-2.5 px-4 bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white font-semibold rounded-full text-xs text-center flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </header>

      {/* Accessibility & Theme Customization Popover */}
      <AccessibilityModal
        isOpen={isA11yModalOpen}
        anchorRef={a11yTrigger === 'mobile' ? mobileA11yBtnRef : desktopA11yBtnRef}
        onClose={() => setIsA11yModalOpen(false)}
      />

      {/* Notifications & Match Alerts Dropdown Popover */}
      <NotificationsModal
        isOpen={isNotifModalOpen}
        anchorRef={alertsTrigger === 'mobile' ? mobileAlertsBtnRef : desktopAlertsBtnRef}
        onClose={() => {
          setIsNotifModalOpen(false);
          fetchUnreadCount();
        }}
        onViewItem={handleViewNotificationItem}
      />

      {/* Quick Report Lost Item Modal (disabled for admin) */}
      {role !== 'admin' && (
        <>
          <ReportLostItemModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            onReportCreated={() => {
              setIsReportModalOpen(false);
            }}
          />
          <PostFoundItemModal
            isOpen={isPostFoundModalOpen}
            onClose={() => setIsPostFoundModalOpen(false)}
            onPostCreated={() => {
              setIsPostFoundModalOpen(false);
            }}
          />
        </>
      )}
    </>
  );
}
