import { api, setAuthToken, getAuthToken, clearAuthToken } from './api.js';

let currentUser = null;
let authListeners = [];

export function onAuthChange(listener) {
  authListeners.push(listener);
  return () => {
    authListeners = authListeners.filter(l => l !== listener);
  };
}

function notifyAuthChange() {
  authListeners.forEach(l => l(currentUser));
}

export function getCurrentUser() {
  return currentUser;
}

export function isAuthenticated() {
  return !!currentUser && !!getAuthToken();
}

export async function login(email, password, churchSlug) {
  const data = await api.auth.login(email, password, churchSlug);
  setAuthToken(data.token);
  currentUser = data.user;
  notifyAuthChange();
  return data;
}

export async function register(data) {
  const result = await api.auth.register(data);
  setAuthToken(result.token);
  currentUser = result.user;
  notifyAuthChange();
  return result;
}

export async function loadSession() {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const data = await api.auth.me();
    currentUser = data.user;
    notifyAuthChange();
    return true;
  } catch (error) {
    clearAuthToken();
    currentUser = null;
    notifyAuthChange();
    return false;
  }
}

export function logout() {
  clearAuthToken();
  currentUser = null;
  notifyAuthChange();
  window.location.hash = '#/login';
}

export function hasRole(...roles) {
  return currentUser && roles.includes(currentUser.role);
}

export function canAccess(...roles) {
  return hasRole(...roles);
}