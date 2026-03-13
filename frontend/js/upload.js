/**
 * Upload page logic.
 *
 * Handles the intake form submission, file uploads to GCS via signed URLs,
 * and triggers the processing pipeline.
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('upload-form');
  const fileInput = document.getElementById('file-input');
  const fileDrop = document.getElementById('file-drop');
  const fileList = document.getElementById('file-list');
  const submitBtn = document.getElementById('submit-btn');
  const formSection = document.getElementById('upload-form-section');
  const progressSection = document.getElementById('progress-section');
  const uploadProgress = document.getElementById('upload-progress');
  const errorAlert = document.getElementById('error-alert');

  let selectedFiles = [];

  // --- File Selection ---

  fileDrop.addEventListener('click', () => fileInput.click());

  fileDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDrop.classList.add('dragover');
  });

  fileDrop.addEventListener('dragleave', () => {
    fileDrop.classList.remove('dragover');
  });

  fileDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDrop.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
  });

  function handleFiles(files) {
    selectedFiles = Array.from(files);
    renderFileList();
  }

  function renderFileList() {
    if (selectedFiles.length === 0) {
      fileList.innerHTML = '';
      return;
    }

    fileList.innerHTML = selectedFiles.map((file, i) => {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `
        <div class="file-list-item">
          <span class="name">${escapeHtml(file.name)}</span>
          <span class="size">${sizeMB} MB</span>
        </div>
      `;
    }).join('');
  }

  function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  // --- Form Submission ---

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    if (selectedFiles.length === 0) {
      showError('Please select at least one video file.');
      return;
    }

    const formData = {
      sermonTitle: form.sermonTitle.value.trim(),
      sermonDate: form.sermonDate.value,
      speaker: form.speaker.value.trim(),
      series: form.series.value.trim() || undefined,
      fileCount: selectedFiles.length,
      trimStart: form.trimStart.value || undefined,
      trimEnd: form.trimEnd.value || undefined,
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Requesting upload URLs...';

    try {
      // Step 1: Request upload URLs
      const { jobId, uploadUrls } = await apiPost('/api/upload-url', formData);

      // Switch to progress view
      formSection.setAttribute('hidden', '');
      progressSection.removeAttribute('hidden');

      // Step 2: Upload each file to its signed URL
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const { url } = uploadUrls[i];

        updateUploadProgress(i, selectedFiles.length, 0);

        await uploadFileToGCS(url, file, (percent) => {
          updateUploadProgress(i, selectedFiles.length, percent);
        });
      }

      updateUploadProgress(selectedFiles.length, selectedFiles.length, 100);

      // Step 3: Signal uploads complete → trigger processing
      document.getElementById('upload-status-text').textContent = 'Starting processing...';
      await apiPost(`/api/jobs/${jobId}/start`);

      // Step 4: Switch to status polling
      startStatusPolling(jobId);

    } catch (err) {
      showError(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload & Process';
      formSection.removeAttribute('hidden');
      progressSection.setAttribute('hidden', '');
    }
  });

  // --- Upload Progress UI ---

  function updateUploadProgress(completedFiles, totalFiles, currentPercent) {
    const overallPercent = Math.round(
      ((completedFiles * 100 + currentPercent) / (totalFiles * 100)) * 100
    );

    const bar = document.getElementById('upload-bar');
    const text = document.getElementById('upload-status-text');

    bar.style.width = `${overallPercent}%`;

    if (completedFiles >= totalFiles) {
      text.textContent = 'Upload complete!';
      bar.classList.add('complete');
    } else {
      text.textContent = `Uploading file ${completedFiles + 1} of ${totalFiles}... ${currentPercent}%`;
    }
  }

  // --- Error Display ---

  function showError(message) {
    errorAlert.textContent = message;
    errorAlert.removeAttribute('hidden');
  }

  function hideError() {
    errorAlert.setAttribute('hidden', '');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
