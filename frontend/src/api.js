const API_BASE = 'http://localhost:3001';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
}

export function getAuthToken() {
  if (!authToken) {
    authToken = localStorage.getItem('authToken');
  }
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem('authToken');
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    headers,
    ...options,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('Token inv')) {
      clearAuthToken();
      window.location.hash = '#/login';
    }
    throw error;
  }
}

export const api = {
  auth: {
    login: (email, password, churchSlug) =>
      request('/auth/login', { method: 'POST', body: { email, password, churchSlug } }),
    register: (data) =>
      request('/auth/register', { method: 'POST', body: data }),
    me: () =>
      request('/auth/me'),
  },

  members: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/members${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/members/${id}`),
    create: (data) => request('/members', { method: 'POST', body: data }),
    update: (id, data) => request(`/members/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/members/${id}`, { method: 'DELETE' }),
  },

  tithes: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/tithes${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/tithes/${id}`),
    create: (data) => request('/tithes', { method: 'POST', body: data }),
    update: (id, data) => request(`/tithes/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/tithes/${id}`, { method: 'DELETE' }),
  },

  events: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/events${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/events/${id}`),
    create: (data) => request('/events', { method: 'POST', body: data }),
    update: (id, data) => request(`/events/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/events/${id}`, { method: 'DELETE' }),
  },

  songs: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/songs${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/songs/${id}`),
    create: (data) => request('/songs', { method: 'POST', body: data }),
    update: (id, data) => request(`/songs/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/songs/${id}`, { method: 'DELETE' }),
  },

  announcements: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/announcements${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/announcements/${id}`),
    create: (data) => request('/announcements', { method: 'POST', body: data }),
    update: (id, data) => request(`/announcements/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/announcements/${id}`, { method: 'DELETE' }),
  },

  liturgies: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/liturgies${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/liturgies/${id}`),
    create: (data) => request('/liturgies', { method: 'POST', body: data }),
    update: (id, data) => request(`/liturgies/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/liturgies/${id}`, { method: 'DELETE' }),
  },

  users: {
    list: () => request('/users'),
    create: (data) => request('/users', { method: 'POST', body: data }),
    update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  },

  health: () => request('/health'),
};