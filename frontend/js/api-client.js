/**
 * ASP API Client
 *
 * Shared fetch wrapper used by both the upload page and admin page.
 * Automatically prefixes the API base URL and handles errors.
 */

const API_BASE = (() => {
  // Local development
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return 'http://localhost:8080';
  }
  // Production — set this to your Cloud Run service URL after deployment
  // Example: 'https://asp-api-abc123-uc.a.run.app'
  return 'https://asp-api-843103771738.us-central1.run.app';
})();

/**
 * Make a POST request to the API.
 * @param {string} path - API path (e.g., '/api/upload-url')
 * @param {object} body - JSON request body
 * @param {object} [headers] - Additional headers
 * @returns {Promise<object>} Parsed JSON response
 */
async function apiPost(path, body, headers = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

/**
 * Make a GET request to the API.
 * @param {string} path - API path
 * @param {object} [headers] - Additional headers
 * @returns {Promise<object>} Parsed JSON response
 */
async function apiGet(path, headers = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...headers },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

/**
 * Upload a file to a signed GCS URL using XMLHttpRequest (for progress tracking).
 *
 * @param {string} url - Signed upload URL
 * @param {File} file - File to upload
 * @param {function} onProgress - Progress callback (percent 0-100)
 * @returns {Promise<void>}
 */
function uploadFileToGCS(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed: Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'video/mp4');
    xhr.send(file);
  });
}

/**
 * Upload a file via multipart form data to the API (for admin asset uploads).
 *
 * @param {string} path - API path
 * @param {FormData} formData - Form data with file
 * @param {string} adminToken - Admin auth token
 * @param {function} [onProgress] - Progress callback
 * @returns {Promise<object>} Parsed JSON response
 */
function apiPostMultipart(path, formData, adminToken, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || `API error: ${xhr.status}`));
        }
      } catch {
        reject(new Error(`API error: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed: Network error')));
    xhr.open('POST', `${API_BASE}${path}`);
    xhr.setRequestHeader('X-Admin-Token', adminToken);
    xhr.send(formData);
  });
}
