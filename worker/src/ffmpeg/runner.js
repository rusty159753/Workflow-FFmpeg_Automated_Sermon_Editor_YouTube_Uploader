const { spawn } = require('child_process');
const pino = require('pino');

const logger = pino({ name: 'ffmpeg-runner' });

/**
 * Run an FFmpeg command and return a promise.
 *
 * @param {string[]} args - FFmpeg command arguments
 * @param {object} options
 * @param {function} [options.onStderr] - Callback for each stderr line
 * @param {number} [options.timeout] - Timeout in milliseconds
 * @returns {Promise<{ stderr: string }>} Resolves with collected stderr
 */
function runFfmpeg(args, { onStderr, timeout } = {}) {
  return new Promise((resolve, reject) => {
    logger.info({ cmd: ['ffmpeg', ...args].join(' ') }, 'Running FFmpeg');

    const proc = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let stdout = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;

      if (onStderr) {
        const lines = text.split('\n').filter(l => l.trim());
        lines.forEach(line => onStderr(line));
      }
    });

    let timer;
    if (timeout) {
      timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`FFmpeg timed out after ${timeout}ms`));
      }, timeout);
    }

    proc.on('close', (code) => {
      if (timer) clearTimeout(timer);

      if (code === 0) {
        resolve({ stderr, stdout });
      } else {
        const errorLines = stderr.split('\n').slice(-10).join('\n');
        reject(new Error(`FFmpeg exited with code ${code}:\n${errorLines}`));
      }
    });

    proc.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });
  });
}

/**
 * Run ffprobe and return parsed JSON output.
 *
 * @param {string[]} args - Additional ffprobe arguments (file path should be last)
 * @returns {Promise<object>} Parsed JSON probe data
 */
async function runFfprobe(args) {
  return new Promise((resolve, reject) => {
    const fullArgs = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', ...args];
    logger.info({ cmd: ['ffprobe', ...fullArgs].join(' ') }, 'Running FFprobe');

    const proc = spawn('ffprobe', fullArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout));
        } catch (err) {
          reject(new Error(`Failed to parse ffprobe output: ${err.message}`));
        }
      } else {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start ffprobe: ${err.message}`));
    });
  });
}

module.exports = { runFfmpeg, runFfprobe };
