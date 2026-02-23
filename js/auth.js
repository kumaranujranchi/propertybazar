import { convex } from './convex.js';

const SESSION_KEY = 'pb_session';
const USER_KEY = 'pb_user';

// ============== Save / Load session ==============
export function saveSession(token, user) {
  localStorage.setItem(SESSION_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(SESSION_KEY) || '';
}

export function getCachedUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}

// ============== API calls ==============
export async function register(name, email, password) {
  const result = await convex.mutation('auth:register', { name, email, password });
  saveSession(result.token, { name: result.name, email: result.email });
  return result;
}

export async function login(email, password) {
  const result = await convex.mutation('auth:login', { email, password });
  saveSession(result.token, { name: result.name, email: result.email });
  return result;
}

export async function googleLogin(uid, email, name) {
  const result = await convex.mutation('auth:googleLogin', { uid, email, name });
  saveSession(result.token, { name: result.name, email: result.email, provider: 'google' });
  return result;
}

export async function logout() {
  const token = getToken();
  if (token) {
    try { await convex.mutation('auth:logout', { token }); } catch {}
  }
  clearSession();
}

export async function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  return await convex.query('auth:getMe', { token });
}

// ============== requireAuth guard ==============
export async function requireAuth(redirectTo = 'login.html') {
  const token = getToken();
  if (!token) {
    window.location.href = redirectTo;
    return null;
  }
  const user = await getCurrentUser();
  if (!user) {
    clearSession();
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

// ============== Update nav header based on login state ==============
export async function initNavAuth() {
  const user = getCachedUser();
  const loginBtn = document.querySelector('.nav-btn-login');
  if (!loginBtn) return;

  if (user) {
    // Show user's first name — clicking takes them to dashboard
    loginBtn.innerHTML = `<i class="fa-solid fa-user" style="margin-right: 6px;"></i>${user.name.split(' ')[0]}`;
    loginBtn.style.display = 'inline-flex';
    loginBtn.style.alignItems = 'center';
    loginBtn.style.whiteSpace = 'nowrap';
    loginBtn.href = 'dashboard.html';
    // No logout button in nav — user logs out from inside the dashboard
  } else {
    loginBtn.textContent = 'Login / Register';
    loginBtn.href = 'login.html';
  }
}
