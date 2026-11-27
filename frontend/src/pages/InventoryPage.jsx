import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { itemService } from '../services/itemService';
import { ITEM_CATEGORIES } from '../constants/itemPresets';
import ItemDetailModal from '../components/ItemDetailModal';
import ProofOfOwnershipModal from '../components/ProofOfOwnershipModal';
import DisputeModal from '../components/DisputeModal';
import { ItemCardSkeleton } from '../components/Skeleton';
import { getUserRoleTag } from '../utils/userUtils';
import {
  Search,
  X,
  RefreshCw,
  MapPin,
  Calendar,
  Package,
  ArrowRight,
  Filter
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

export default function InventoryPage({ onNavigateToTab }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'available' | 'reunited' | 'handover' | 'disputed'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const tabsContainerRef = useRef(null);
  const tabBtnRefs = useRef({});
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  // Modals
  const [selectedItemForDetail, setSelectedItemForDetail] = useState(null);
  const [itemForClaim, setItemForClaim] = useState(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [itemForDispute, setItemForDispute] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  const loadItems = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await itemService.getFoundPosts();
      setItems(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load campus inventory.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Counts per status category
  const statusCounts = useMemo(() => {
    const counts = {
      all: items.length,
      available: 0,
      handover: 0,
      reunited: 0,
      disputed: 0
    };
    items.forEach((item) => {
      const key = getItemStatusKey(item.status);
      if (counts[key] !== undefined) {
        counts[key] += 1;
      }
    });
    return counts;
  }, [items]);

  const updateTabIndicator = useCallback(() => {
    const container = tabsContainerRef.current;
    const activeBtn = tabBtnRefs.current[statusFilter];
    if (container && activeBtn) {
      const left = activeBtn.offsetLeft + 8;
      const width = Math.max(0, activeBtn.offsetWidth - 16);
      setTabIndicator({ left, width, opacity: 1 });
    }
  }, [statusFilter]);

  useEffect(() => {
    updateTabIndicator();
    const timer = setTimeout(updateTabIndicator, 60);
    window.addEventListener('resize', updateTabIndicator);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTabIndicator);
    };
  }, [updateTabIndicator, statusCounts]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status filter
      if (statusFilter !== 'all') {
        const itemKey = getItemStatusKey(item.status);
        if (itemKey !== statusFilter) return false;
      }

      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.item_name?.toLowerCase().includes(q);
        const matchesCat = item.category?.toLowerCase().includes(q);
        const matchesLoc = item.location_found?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesLoc && !matchesDesc) {
          return false;
        }
      }

      return true;
    });
  }, [items, statusFilter, selectedCategory, searchQuery]);

  const categories = ['All', ...ITEM_CATEGORIES];

  const statusTabs = [
    { key: 'all', label: 'All Items', count: statusCounts.all },
    { key: 'available', label: 'Available for claim', count: statusCounts.available },
    { key: 'handover', label: 'Hand over', count: statusCounts.handover },
    { key: 'reunited', label: 'Reunited', count: statusCounts.reunited },
    { key: 'disputed', label: 'Disputed', count: statusCounts.disputed }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-20 transition-colors duration-200">
      {/* Top Header */}
      <section className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Inventory
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Explore all verified postings across campus with categorical separation.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadItems(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer active:scale-95 disabled:opacity-50"
                title="Refresh inventory"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToTab?.('student-dashboard')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer active:scale-95"
              >
                <span>Back to Home</span>
              </button>
            </div>
          </div>

          {/* Categorical Separation Tabs (Available for claim, Reunited, Hand over, Disputed) */}
          <div
            ref={tabsContainerRef}
            className="relative mt-8 border-b border-slate-200 dark:border-slate-800 flex items-center overflow-x-auto no-scrollbar"
          >
            {/* Smooth Sliding Active Underline */}
            <span
              className="absolute bottom-0 left-0 h-0.5 bg-theme rounded-full pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                transform: `translateX(${tabIndicator.left}px)`,
                width: `${tabIndicator.width}px`,
                opacity: tabIndicator.opacity
              }}
              aria-hidden="true"
            />
            {statusTabs.map((tab, idx) => {
              const isActive = statusFilter === tab.key;
              return (
                <div key={tab.key} className="flex items-center shrink-0">
                  {idx > 0 && (
                    <span
                      className="w-px h-4 bg-slate-200 dark:bg-slate-800 mb-3 mx-1 sm:mx-1.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <button
                    ref={(el) => {
                      tabBtnRefs.current[tab.key] = el;
                    }}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center gap-2 select-none active:scale-95 ${
                      isActive
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums transition-colors duration-200 ${
                        isActive
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                          : 'bg-slate-100/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-medium'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 mt-6">
        {/* Search Bar & Category Filter */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3.5">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by item name, color, location, or details..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <span className="text-[11px] font-medium text-slate-400 shrink-0 mr-1 flex items-center gap-1 select-none">
              <Filter className="w-3 h-3" />
              Category:
            </span>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                    isSelected
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Count & Active Filter Pills */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong>{filteredItems.length}</strong> {filteredItems.length === 1 ? 'item' : 'items'}
            {statusFilter !== 'all' && ` • ${statusTabs.find((t) => t.key === statusFilter)?.label}`}
            {selectedCategory !== 'All' && ` • ${selectedCategory}`}
          </span>

          {(statusFilter !== 'all' || selectedCategory !== 'All' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="text-theme hover:underline font-semibold cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* Inventory Items Grid */}
        {error && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs text-center">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <ItemCardSkeleton key={idx} delay={idx * 50} />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div
            key={`empty-${statusFilter}-${selectedCategory}`}
            className="mt-8 py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-fadeIn"
          >
            <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No items found
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || selectedCategory !== 'All' || statusFilter !== 'all'
                ? 'No items match your active filters. Try adjusting your search or category selection.'
                : 'No items are currently registered in this category.'}
            </p>
          </div>
        ) : (
          <div
            key={`grid-${statusFilter}-${selectedCategory}`}
            className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn"
          >
            {filteredItems.map((item) => {
              const coverPhoto = item.photos?.[0]?.photo_url;
              const badge = getStatusBadge(item.status);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemForDetail(item)}
                  className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col overflow-hidden cursor-pointer"
                >
                  {/* Photo with status badge */}
                  <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {coverPhoto ? (
                      <img
                        src={coverPhoto}
                        alt={item.item_name}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200 ease-out"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                        <Package className="w-8 h-8 stroke-[1.5]" />
                        <span className="text-[11px] mt-1.5 font-medium">No photo</span>
                      </div>
                    )}

                    {/* Status badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-tight ${badge.className}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dotClass}`} />
                        <span>{badge.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1 group-hover:text-theme transition-colors">
                        {item.item_name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.category}
                      </p>

                      <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{item.location_found}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span>{item.date_found}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                        {getUserRoleTag(item.finder)}
                      </span>
                      <span className="font-semibold text-theme inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        <span>View</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Item Detail Modal */}
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
          loadItems(true);
        }}
      />

      {/* Report Dispute Modal */}
      <DisputeModal
        isOpen={showDisputeModal}
        post={itemForDispute}
        onClose={() => {
          setShowDisputeModal(false);
          setItemForDispute(null);
        }}
        onDisputeFiled={() => {
          loadItems(true);
        }}
      />
    </div>
  );
}
