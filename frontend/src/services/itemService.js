/**
 * Item & Notification Service for SEENta
 * Connects to the Express backend and Supabase Cloud database
 * Manages Found Item Posts (FR-SEEN-0003), Lost Item Reports (FR-SEEN-0002),
 * and Automated Matching Notifications (SYS-SEEN-0002).
 */

const rawApiUrl = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

function getAuthHeaders() {
  try {
    const raw = localStorage.getItem('seenta_session');
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.token) {
        return {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        };
      }
    }
  } catch {}
  return { 'Content-Type': 'application/json' };
}

async function safeJson(res, defaultVal = {}) {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : defaultVal;
  } catch {
    return defaultVal;
  }
}

export const itemService = {
  // =========================================================================
  // FOUND ITEM POSTS (FR-SEEN-0003, UC-003)
  // =========================================================================
  async getFoundPosts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category && filters.category !== 'All') params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.finderId) params.append('finderId', filters.finderId);

    const res = await fetch(`${API_URL}/items/found?${params.toString()}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to fetch found item posts');
    return data.items || [];
  },

  async getFoundPostById(id) {
    const res = await fetch(`${API_URL}/items/found/${id}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to fetch post details');
    return data.item;
  },

  async createFoundPost(postData, photoUrls = []) {
    const res = await fetch(`${API_URL}/items/found`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...postData, photoUrls })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to create found item post');
    return data.item;
  },

  // =========================================================================
  // LOST ITEM REPORTS (FR-SEEN-0002, UC-002)
  // =========================================================================
  async getLostReports(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category && filters.category !== 'All') params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.userId) params.append('userId', filters.userId);

    const res = await fetch(`${API_URL}/items/lost?${params.toString()}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to fetch lost reports');
    return data.items || [];
  },

  async getLostReportById(id) {
    const res = await fetch(`${API_URL}/items/lost/${id}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to fetch lost report details');
    return data.item;
  },

  async createLostReport(reportData) {
    const res = await fetch(`${API_URL}/items/lost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to file lost item report');
    return data.item;
  },

  // =========================================================================
  // NOTIFICATIONS (SYS-SEEN-0002)
  // =========================================================================
  async getNotifications(userId) {
    if (!userId) return [];
    const res = await fetch(`${API_URL}/notifications?userId=${encodeURIComponent(userId)}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to fetch notifications');
    return data.notifications || [];
  },

  async markNotificationRead(id) {
    const res = await fetch(`${API_URL}/notifications/${id}/read`, {
      method: 'PUT'
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to update notification status');
    return data.notification;
  },

  async markAllNotificationsRead(userId) {
    const res = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to update notifications');
    return data;
  },

  // =========================================================================
  // PROOF OF OWNERSHIP CLAIMS (FR-SEEN-0004, UC-004)
  // =========================================================================
  async getClaims(filters = {}) {
    const params = new URLSearchParams();
    if (filters.postId) params.append('postId', filters.postId);
    if (filters.claimantId) params.append('claimantId', filters.claimantId);
    if (filters.finderId) params.append('finderId', filters.finderId);
    if (filters.status) params.append('status', filters.status);

    const res = await fetch(`${API_URL}/claims?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to fetch claims');
    return data.claims || [];
  },

  async getClaimById(id) {
    const res = await fetch(`${API_URL}/claims/${id}`, {
      headers: getAuthHeaders()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to fetch claim');
    return data.claim;
  },

  async submitClaim(claimData) {
    const res = await fetch(`${API_URL}/claims`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(claimData)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to submit ownership claim');
    return data.claim;
  },

  async updateClaimStatus(claimId, status, rejectionReason = '') {
    const res = await fetch(`${API_URL}/claims/${claimId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, rejectionReason })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to update claim status');
    return data.claim;
  },

  // =========================================================================
  // IN-APP MEETUP COORDINATION CHAT (FR-SEEN-0004)
  // =========================================================================
  async getMessages(claimId) {
    const res = await fetch(`${API_URL}/messages/${claimId}`, {
      headers: getAuthHeaders()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to fetch messages');
    return data.messages || [];
  },

  async sendMessage(claimId, senderId, messageText) {
    const res = await fetch(`${API_URL}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ claimId, senderId, messageText })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to send message');
    return data.message;
  },

  // =========================================================================
  // TRANSACTION RECORDS & TURNOVER CONFIRMATION (FR-SEEN-0005)
  // =========================================================================
  async getTransactions(userId) {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    const res = await fetch(`${API_URL}/transactions?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to fetch transactions');
    return data.transactions || [];
  },

  async confirmTurnover({ postId, claimId, userId, campusLocation }) {
    const res = await fetch(`${API_URL}/transactions/confirm`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ postId, claimId, userId, campusLocation })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to confirm turnover');
    return data.transaction;
  },

  // =========================================================================
  // DISPUTES & FALSE CLAIM REPORTING (FR-SEEN-0006)
  // =========================================================================
  async getDisputes() {
    const res = await fetch(`${API_URL}/disputes`, {
      headers: getAuthHeaders()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to fetch disputes');
    return data.disputes || [];
  },

  async createDispute(disputeData) {
    const res = await fetch(`${API_URL}/disputes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(disputeData)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to file dispute');
    return data.dispute;
  },

  // =========================================================================
  // FEEDBACK & RATINGS (FR-SEEN-0007)
  // =========================================================================
  async getFeedback(filters = {}) {
    const params = new URLSearchParams();
    if (filters.transactionId) params.append('transactionId', filters.transactionId);
    if (filters.raterId) params.append('raterId', filters.raterId);
    if (filters.ratedUserId) params.append('ratedUserId', filters.ratedUserId);
    const res = await fetch(`${API_URL}/feedback?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to fetch feedback');
    return data.feedback || [];
  },

  async submitFeedback(feedbackData) {
    const res = await fetch(`${API_URL}/feedback`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(feedbackData)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to submit feedback');
    return data.feedback;
  }
};
