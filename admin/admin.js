
(function () {
  'use strict';

  const CONFIG = window.PBS_CONFIG || {};
  const SUPABASE_URL = (CONFIG.SUPABASE_URL || '').replace(/\/$/, '');
  const SUPABASE_KEY = CONFIG.SUPABASE_ANON_KEY || '';
  const SESSION_KEY = 'pbs_admin_session';

  let session = null;
  let currentProfile = null;

  function showMessage(message, isError = true) {
    const el = document.getElementById('login-error');

    if (!el) {
      alert(message);
      return;
    }

    el.textContent = message;
    el.style.color = isError ? '#b42318' : '#16803c';
    el.hidden = false;
  }

  function clearMessage() {
    const el = document.getElementById('login-error');

    if (el) {
      el.textContent = '';
      el.hidden = true;
    }
  }

  function saveSession(data) {
    session = data;

    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify(data)
    );
  }

  function clearSession() {
    session = null;
    currentProfile = null;
    sessionStorage.removeItem(SESSION_KEY);
  }

  async function authRequest(endpoint, body) {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY
        },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.msg ||
        data.message ||
        data.error_description ||
        'Authentication failed.'
      );
    }

    return data;
  }

  async function verifyAdmin(userId, accessToken) {
    const url = new URL(
      `${SUPABASE_URL}/rest/v1/admin_profiles`
    );

    url.searchParams.set(
      'select',
      'user_id,full_name,role,is_active'
    );

    url.searchParams.set(
      'user_id',
      `eq.${userId}`
    );

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(
        'Admin profile verify nahi ho paya.'
      );
    }

    const profiles = await response.json();
    const profile = profiles[0];

    if (
      !profile ||
      profile.is_active !== true ||
      !['owner', 'admin'].includes(profile.role)
    ) {
      throw new Error(
        'Aapke account ko admin dashboard ki permission nahi hai.'
      );
    }

    currentProfile = profile;
    return profile;
  }

  async function login(email, password) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error(
        'Supabase configuration nahi mili. config.js check karein.'
      );
    }

    const data = await authRequest(
      'token?grant_type=password',
      {
        email: email,
        password: password
      }
    );

    if (
      !data.access_token ||
      !data.refresh_token ||
      !data.user ||
      !data.user.id
    ) {
      throw new Error('Invalid login response.');
    }

    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at:
        Math.floor(Date.now() / 1000) +
        (data.expires_in || 3600),
      user_id: data.user.id
    });

    try {
      await verifyAdmin(
        data.user.id,
        data.access_token
      );
    } catch (error) {
      clearSession();
      throw error;
    }

    return currentProfile;
  }

  async function restoreSession() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      clearSession();
      return false;
    }

    const saved = sessionStorage.getItem(SESSION_KEY);

    if (!saved) {
      return false;
    }

    try {
      session = JSON.parse(saved);

      if (
        !session.refresh_token ||
        !session.user_id
      ) {
        clearSession();
        return false;
      }

      if (
        !session.expires_at ||
        session.expires_at <=
          Math.floor(Date.now() / 1000) + 30
      ) {
        const data = await authRequest(
          'token?grant_type=refresh_token',
          {
            refresh_token: session.refresh_token
          }
        );

        if (!data.access_token || !data.user) {
          throw new Error('Session refresh failed.');
        }

        saveSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at:
            Math.floor(Date.now() / 1000) +
            (data.expires_in || 3600),
          user_id: data.user.id
        });
      }

      const response = await fetch(
        `${SUPABASE_URL}/auth/v1/user`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Session expired.');
      }

      const user = await response.json();

      if (
        !user.id ||
        user.id !== session.user_id
      ) {
        throw new Error('Invalid user session.');
      }

      await verifyAdmin(
        user.id,
        session.access_token
      );

      return true;

    } catch (error) {
      clearSession();
      return false;
    }
  }

  async function logout() {
    const accessToken = session
      ? session.access_token
      : null;

    clearSession();

    if (accessToken && SUPABASE_URL) {
      try {
        await fetch(
          `${SUPABASE_URL}/auth/v1/logout`,
          {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
      } catch (error) {
        // Local session is already cleared.
      }
    }

    window.location.replace('index.html');
  }

  function isDashboardPage() {
    return window.location.pathname
      .toLowerCase()
      .endsWith('/dashboard.html');
  }

  function isLoginPage() {
    return window.location.pathname
      .toLowerCase()
      .endsWith('/admin/') ||
      window.location.pathname
      .toLowerCase()
      .endsWith('/admin/index.html');
  }

  function initializePage() {
    const form = document.getElementById('login-form');
    const button = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');

    if (form) {
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        clearMessage();

        const email = document
          .getElementById('admin-email')
          .value.trim();

        const password = document
          .getElementById('admin-password')
          .value;

        if (!email || !password) {
          showMessage('Email aur password enter karein.');
          return;
        }

        if (button) {
          button.disabled = true;
          button.textContent = 'Please wait...';
        }

        try {
          const profile = await login(email, password);

          showMessage(
            'Welcome, ' + profile.full_name,
            false
          );

          window.location.replace('dashboard.html');

        } catch (error) {
          showMessage(
            error.message || 'Login failed.'
          );

        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = 'Login';
          }
        }
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener(
        'click',
        logout
      );
    }
  }

  window.PBSAdmin = {
    login: login,
    logout: logout,
    restoreSession: restoreSession,

    getProfile: function () {
      return currentProfile;
    },

    getAccessToken: function () {
      return session
        ? session.access_token
        : null;
    }
  };

  initializePage();

  window.PBSAdmin.ready = (async function () {
    const authenticated = await restoreSession();

    if (isDashboardPage()) {
      if (!authenticated) {
        window.location.replace('index.html');
        return false;
      }

      const welcome = document.getElementById(
        'welcome-message'
      );

      if (welcome && currentProfile) {
        welcome.textContent =
          'Welcome, ' + currentProfile.full_name;
      }
    }

    if (isLoginPage() && authenticated) {
      window.location.replace('dashboard.html');
      return false;
    }

    return authenticated;
  })();

})();
