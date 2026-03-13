/**
 * Job status polling and pipeline progress display.
 */

const PIPELINE_STEPS = [
  { key: 'download',    label: 'Downloading files' },
  { key: 'concat',      label: 'Concatenating parts' },
  { key: 'probe',       label: 'Analyzing media' },
  { key: 'deinterlace', label: 'Deinterlacing' },
  { key: 'trim',        label: 'Trimming video' },
  { key: 'loudnorm',    label: 'Normalizing audio' },
  { key: 'downmix',     label: 'Downmixing audio' },
  { key: 'stitch',      label: 'Stitching intro/outro' },
  { key: 'encode',      label: 'Encoding final video' },
  { key: 'youtube',     label: 'Uploading to YouTube' },
  { key: 'drive',       label: 'Archiving to Google Drive' },
];

let pollingInterval = null;

/**
 * Start polling the job status endpoint.
 * @param {string} jobId
 */
function startStatusPolling(jobId) {
  const pipelineSection = document.getElementById('pipeline-section');
  const resultSection = document.getElementById('result-section');

  if (pipelineSection) pipelineSection.removeAttribute('hidden');

  // Render initial step list
  renderPipelineSteps(null);

  pollingInterval = setInterval(async () => {
    try {
      const status = await apiGet(`/api/jobs/${jobId}/status`);
      updatePipelineUI(status);

      if (status.status === 'completed') {
        clearInterval(pollingInterval);
        showResult(status);
      } else if (status.status === 'failed') {
        clearInterval(pollingInterval);
        showFailure(status);
      }
    } catch (err) {
      // Don't stop polling on transient errors
      console.warn('Status poll error:', err.message);
    }
  }, 5000);
}

/**
 * Render the pipeline step list.
 * @param {object|null} progress - { step, percent }
 */
function renderPipelineSteps(progress) {
  const list = document.getElementById('pipeline-steps');
  if (!list) return;

  const currentStep = progress ? progress.step : null;
  let foundCurrent = false;

  list.innerHTML = PIPELINE_STEPS.map(step => {
    let className = 'pipeline-step';
    let icon = '&#9675;'; // empty circle

    if (step.key === currentStep) {
      className += ' active';
      icon = '<span class="spinner"></span>';
      foundCurrent = true;
    } else if (!foundCurrent && currentStep) {
      className += ' done';
      icon = '&#10003;'; // checkmark
    }

    const percentText = (step.key === currentStep && progress && progress.percent > 0)
      ? ` (${progress.percent}%)`
      : '';

    return `
      <li class="${className}">
        <span class="step-icon">${icon}</span>
        <span>${step.label}${percentText}</span>
      </li>
    `;
  }).join('');
}

/**
 * Update the pipeline UI based on current job status.
 */
function updatePipelineUI(status) {
  const statusText = document.getElementById('pipeline-status-text');

  if (status.status === 'processing' || status.status === 'publishing') {
    renderPipelineSteps(status.progress);
    if (statusText) {
      statusText.textContent = status.progress
        ? `Processing: ${status.progress.step}`
        : 'Processing...';
    }
  }
}

/**
 * Show the final result with YouTube and Drive links.
 */
function showResult(status) {
  const pipelineSection = document.getElementById('pipeline-section');
  const resultSection = document.getElementById('result-section');

  // Mark all steps as done
  const list = document.getElementById('pipeline-steps');
  if (list) {
    list.innerHTML = PIPELINE_STEPS.map(step => `
      <li class="pipeline-step done">
        <span class="step-icon">&#10003;</span>
        <span>${step.label}</span>
      </li>
    `).join('');
  }

  if (resultSection) {
    resultSection.removeAttribute('hidden');

    const linksHtml = [];

    if (status.youtubeUrl) {
      linksHtml.push(`
        <a href="${status.youtubeUrl}" target="_blank" rel="noopener" class="result-link">
          <div>
            <div class="label">YouTube</div>
            <div class="url">${status.youtubeUrl}</div>
          </div>
        </a>
      `);
    }

    if (status.driveUrl) {
      linksHtml.push(`
        <a href="${status.driveUrl}" target="_blank" rel="noopener" class="result-link">
          <div>
            <div class="label">Google Drive</div>
            <div class="url">${status.driveUrl}</div>
          </div>
        </a>
      `);
    }

    document.getElementById('result-links').innerHTML = linksHtml.join('');
  }
}

/**
 * Show a failure message.
 */
function showFailure(status) {
  const statusText = document.getElementById('pipeline-status-text');
  if (statusText) {
    statusText.innerHTML = `<span class="alert alert-error">Processing failed: ${status.error || 'Unknown error'}</span>`;
  }

  // Mark current step as failed
  const list = document.getElementById('pipeline-steps');
  if (list && status.progress) {
    const items = list.querySelectorAll('.pipeline-step');
    items.forEach(item => {
      if (item.classList.contains('active')) {
        item.classList.remove('active');
        item.classList.add('failed');
        item.querySelector('.step-icon').innerHTML = '&#10007;'; // X mark
      }
    });
  }
}
