(function () {
  const config = window.PBS_CONFIG || {};
  const SUPABASE_URL = config.SUPABASE_URL;
  const SUPABASE_KEY = config.SUPABASE_ANON_KEY;

  const form = document.getElementById('reset-form');
  const message = document.getElementById('reset-message');
  const button = document.getElementById('reset-button');

  if (!form) return;

  const params = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = params.get('access_token');
  const tokenType = params.get('token_type');
  const recoveryType = params.get('type');

  const validSession =
    accessToken &&
    tokenType === 'bearer' &&
    recoveryType === 'recovery';

  if (!validSession) {
    form.hidden = true;
    message.textContent =
      'Invalid or expired recovery link. Please request a new password reset email.';
    return;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password.length < 8) {
      message.textContent = 'Password must be at least 8 characters.';
      return;
    }

    if (password !== confirmPassword) {
      message.textContent = 'Passwords do not match.';
      return;
    }

    button.disabled = true;
    button.textContent = 'Updating...';
    message.textContent = '';

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ password })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || result.msg || 'Password update failed.'
        );
      }

      message.textContent = 'Password updated successfully!';
      form.reset();

      setTimeout(function () {
        window.location.href = 'index.html';
      }, 2000);

    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Update Password';
    }
  });
})();