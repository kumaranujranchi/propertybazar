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
  saveSession(result.token, { name: result.name, email: result.email, isAdmin: result.isAdmin });
  return result;
}

export async function login(email, password) {
  const result = await convex.mutation('auth:login', { email, password });
  saveSession(result.token, { name: result.name, email: result.email, isAdmin: result.isAdmin });
  return result;
}

export async function googleLogin(uid, email, name) {
  const result = await convex.mutation('auth:googleLogin', { uid, email, name });
  saveSession(result.token, { name: result.name, email: result.email, isAdmin: result.isAdmin, provider: 'google' });
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
  
  // Update desktop nav buttons
  const loginBtns = document.querySelectorAll('.nav-btn-login');
  loginBtns.forEach(btn => {
    if (user) {
      const firstName = user.name.split(' ')[0];
      const initial = firstName.charAt(0).toUpperCase();
      btn.innerHTML = `
        <span style="
          display:inline-flex; align-items:center; gap:8px;
          background:#fff; border:1px solid #e0e3e9;
          border-radius:99px; padding:5px 14px 5px 6px;
          font-size:14px; font-weight:600; color:#1a2230;
          box-shadow:0 1px 3px rgba(0,0,0,0.06); cursor:pointer;
          transition:box-shadow 0.2s;
        " onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.12)'"
           onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)'">
          <span style="
            width:26px; height:26px; border-radius:50%;
            background:#e84118; color:#fff;
            display:flex; align-items:center; justify-content:center;
            font-size:12px; font-weight:800; flex-shrink:0;
          ">${initial}</span>
          ${firstName}
        </span>`;
      btn.style.cssText = 'border:none; background:none; padding:0;';
      btn.href = user.isAdmin ? 'admin.html' : 'dashboard.html';
    } else {
      btn.textContent = 'Login / Register';
      btn.href = 'login.html';
    }
  });

  // Update mobile menu
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenu) {
    const mobileLoginLink = mobileMenu.querySelector('a[href="login.html"]');
    if (mobileLoginLink && user) {
      const firstName = user.name.split(' ')[0];
      mobileLoginLink.innerHTML = `<i class="fa-solid fa-user"></i> ${firstName}'s Dashboard`;
      mobileLoginLink.href = user.isAdmin ? 'admin.html' : 'dashboard.html';
    } else if (mobileLoginLink) {
      mobileLoginLink.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login`;
      mobileLoginLink.href = 'login.html';
    }
  }
}
