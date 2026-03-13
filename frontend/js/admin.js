/**
 * Admin page logic.
 *
 * Handles admin authentication, asset management, dry-run toggle, and config display.
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('login-section');
  const adminContent = document.getElementById('admin-content');
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');

  let adminToken = sessionStorage.getItem('asp-admin-token') || '';

  // Auto-login if token exists
  if (adminToken) {
    showAdmin();
  }

  // --- Login ---

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    adminToken = document.getElementById('admin-token').value.trim();
    if (!adminToken) return;

    sessionStorage.setItem('asp-admin-token', adminToken);
    showAdmin();
  });

  logoutBtn.addEventListener('click', () => {
    adminToken = '';
    sessionStorage.removeItem('asp-admin-token');
    loginSection.removeAttribute('hidden');
    adminContent.setAttribute('hidden', '');
  });

  async function showAdmin() {
    loginSection.setAttribute('hidden', '');
    adminContent.removeAttribute('hidden');
    await Promise.all([loadAssets(), loadConfig()]);
  }

  // --- Assets ---

  async function loadAssets() {
    try {
      const assets = await apiGet('/api/admin/assets', { 'X-Admin-Token': adminToken });

      document.getElementById('intro-info').innerHTML = assets.intro
        ? `<strong>${escapeHtml(assets.intro.name)}</strong> (${formatSize(assets.intro.size)})`
        : '<em>No intro uploaded</em>';

      document.getElementById('outro-info').innerHTML = assets.outro
        ? `<strong>${escapeHtml(assets.outro.name)}</strong> (${formatSize(assets.outro.size)})`
        : '<em>No outro uploaded</em>';
    } catch (err) {
      if (err.message.includes('403') || err.message.includes('401')) {
        sessionStorage.removeItem('asp-admin-token');
        loginSection.removeAttribute('hidden');
        adminContent.setAttribute('hidden', '');
        alert('Invalid admin token. Please log in again.');
        return;
      }
      console.error('Failed to load assets:', err);
    }
  }

  // Asset upload forms
  document.getElementById('intro-upload-form').addEventListener('submit', (e) => {
    e.preventDefault();
    uploadAsset('intro', document.getElementById('intro-file'));
  });

  document.getElementById('outro-upload-form').addEventListener('submit', (e) => {
    e.preventDefault();
    uploadAsset('outro', document.getElementById('outro-file'));
  });

  async function uploadAsset(type, fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const btn = fileInput.closest('form').querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('file', file);

      await apiPostMultipart('/api/admin/upload-asset', formData, adminToken, (percent) => {
        btn.textContent = `Uploading... ${percent}%`;
      });

      btn.textContent = 'Uploaded!';
      fileInput.value = '';
      await loadAssets();

      setTimeout(() => {
        btn.textContent = 'Upload';
        btn.disabled = false;
      }, 2000);
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
      btn.textContent = 'Upload';
      btn.disabled = false;
    }
  }

  // --- Dry Run Toggle ---

  const dryRunToggle = document.getElementById('dry-run-toggle');

  dryRunToggle.addEventListener('change', async () => {
    try {
      await apiPost('/api/admin/dry-run', { enabled: dryRunToggle.checked }, {
        'X-Admin-Token': adminToken,
      });
    } catch (err) {
      alert(`Failed to toggle dry-run: ${err.message}`);
      dryRunToggle.checked = !dryRunToggle.checked;
    }
  });

  // --- Config ---

  async function loadConfig() {
    try {
      const config = await apiGet('/api/admin/config', { 'X-Admin-Token': adminToken });

      dryRunToggle.checked = config.dryRun;

      const configDisplay = document.getElementById('config-display');
      configDisplay.innerHTML = `
        <tr><td>GCS Bucket</td><td>${escapeHtml(config.gcsBucket)}</td></tr>
        <tr><td>Region</td><td>${escapeHtml(config.gcsRegion || 'us-central1')}</td></tr>
        <tr><td>Target LUFS</td><td>${config.processing.targetLufs}</td></tr>
        <tr><td>Crossfade Duration</td><td>${config.processing.crossfadeDuration}s</td></tr>
        <tr><td>Video CRF</td><td>${config.processing.videoCrf}</td></tr>
        <tr><td>Audio Bitrate</td><td>${config.processing.audioBitrate}</td></tr>
        <tr><td>Output Resolution</td><td>${config.processing.outputResolution}</td></tr>
        <tr><td>YouTube Privacy</td><td>${config.youtube.defaultPrivacy}</td></tr>
      `;
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }

  // --- Helpers ---

  function formatSize(bytes) {
    if (!bytes) return 'unknown size';
    const mb = bytes / (1024 * 1024);
    return mb > 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
});
