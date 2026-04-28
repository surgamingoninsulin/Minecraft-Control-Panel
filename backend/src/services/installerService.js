import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOADER_SCRIPT = path.resolve(__dirname, '../../scripts/server_downloader.py');

class InstallerService {
    constructor() {
        this.currentProcess = null;
        this.status = {
            state: 'idle',
            deviceCode: null,
            verificationUrl: null,
            progress: 0,
            error: null,
            logs: []
        };
    }

    getStatus() {
        return this.status;
    }

    appendLog(message) {
        if (!message) return;
        this.status.logs.push(message);
        if (this.status.logs.length > 500) {
            this.status.logs = this.status.logs.slice(-300);
        }
    }

    async commandExists(command) {
        return new Promise((resolve) => {
            const proc = spawn(command, ['--version'], { stdio: 'ignore' });

            proc.on('error', () => resolve(false));
            proc.on('close', (code) => resolve(code === 0));
        });
    }

    async resolvePythonCommand() {
        const candidates = process.platform === 'win32'
            ? ['py', 'python', 'python3']
            : ['python3', 'python'];

        for (const candidate of candidates) {
            const exists = await this.commandExists(candidate);
            if (!exists) {
                continue;
            }

            if (process.platform === 'win32' && candidate === 'py') {
                const py3 = await new Promise((resolve) => {
                    const proc = spawn('py', ['-3', '--version'], { stdio: 'ignore' });
                    proc.on('error', () => resolve(false));
                    proc.on('close', (code) => resolve(code === 0));
                });
                if (py3) {
                    return { command: 'py', argsPrefix: ['-3'] };
                }
                continue;
            }

            return { command: candidate, argsPrefix: [] };
        }

        return null;
    }

    async checkDownloaderAvailable() {
        const platform = process.platform;

        try {
            await fs.access(DOWNLOADER_SCRIPT);
        } catch {
            return {
                available: false,
                platform,
                error: `Downloader script is missing at ${DOWNLOADER_SCRIPT}`
            };
        }

        const python = await this.resolvePythonCommand();
        if (!python) {
            return {
                available: false,
                platform,
                error: 'Python 3 was not found. Install Python 3 and ensure it is on PATH.'
            };
        }

        return {
            available: true,
            platform,
            pythonCommand: python.command,
            scriptPath: DOWNLOADER_SCRIPT
        };
    }

    async startDownload(options = {}) {
        if (this.currentProcess) {
            throw new Error('An installation process is already running');
        }

        const targetPath = String(options.targetPath || '').trim();
        if (!targetPath) {
            throw new Error('Target path is required');
        }

        const prerequisite = await this.checkDownloaderAvailable();
        if (!prerequisite.available) {
            throw new Error(prerequisite.error || 'Installer prerequisites are not met');
        }

        const python = await this.resolvePythonCommand();
        if (!python) {
            throw new Error('Python 3 was not found. Install Python 3 and try again.');
        }

        await fs.mkdir(targetPath, { recursive: true });

        this.status = {
            state: 'starting',
            deviceCode: null,
            verificationUrl: null,
            progress: 0,
            error: null,
            logs: []
        };

        const args = [
            ...python.argsPrefix,
            DOWNLOADER_SCRIPT,
            '--target-path', targetPath,
            '--server-type', String(options.serverType || 'vanilla'),
            '--server-version', String(options.serverVersion || ''),
            '--jar-file', String(options.jarFile || 'server.jar'),
            '--server-name', String(options.serverName || 'Minecraft Server')
        ];

        const child = spawn(python.command, args, {
            cwd: targetPath,
            env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });
        this.currentProcess = child;

        let stdoutBuffer = '';
        let stderrBuffer = '';

        const handleStdoutLine = (rawLine) => {
            const line = rawLine.trim();
            if (!line) {
                return;
            }

            const progressMatch = line.match(/^PROGRESS:(\d+):(.*)$/);
            if (progressMatch) {
                const pct = Number.parseInt(progressMatch[1], 10);
                const msg = progressMatch[2]?.trim() || 'Downloading server files';
                this.status.state = 'downloading_game';
                this.status.progress = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : this.status.progress;
                this.appendLog(msg);
                return;
            }

            const doneMatch = line.match(/^DONE:(.*)$/);
            if (doneMatch) {
                this.status.progress = 100;
                this.appendLog(`Saved: ${doneMatch[1].trim()}`);
                return;
            }

            this.appendLog(line);
        };

        const handleStderrLine = (rawLine) => {
            const line = rawLine.trim();
            if (!line) {
                return;
            }

            const errMatch = line.match(/^ERROR:(.*)$/);
            if (errMatch) {
                this.status.error = errMatch[1].trim() || 'Unknown download error';
                this.appendLog(`ERROR: ${this.status.error}`);
                return;
            }

            this.appendLog(`STDERR: ${line}`);
        };

        child.stdout.on('data', (chunk) => {
            stdoutBuffer += chunk.toString();
            const lines = stdoutBuffer.split(/\r?\n/);
            stdoutBuffer = lines.pop() || '';
            lines.forEach(handleStdoutLine);
        });

        child.stderr.on('data', (chunk) => {
            stderrBuffer += chunk.toString();
            const lines = stderrBuffer.split(/\r?\n/);
            stderrBuffer = lines.pop() || '';
            lines.forEach(handleStderrLine);
        });

        child.on('error', (err) => {
            this.currentProcess = null;
            this.status.state = 'error';
            this.status.error = `Failed to start downloader: ${err.message}`;
            this.appendLog(this.status.error);
        });

        child.on('close', (code) => {
            if (stdoutBuffer.trim()) {
                handleStdoutLine(stdoutBuffer);
                stdoutBuffer = '';
            }
            if (stderrBuffer.trim()) {
                handleStderrLine(stderrBuffer);
                stderrBuffer = '';
            }

            this.currentProcess = null;
            if (code === 0 && !this.status.error) {
                this.status.state = 'finished';
                this.status.progress = 100;
                this.appendLog('Installation finished successfully.');
                return;
            }

            this.status.state = 'error';
            if (!this.status.error) {
                this.status.error = `Downloader exited with code ${code}`;
            }
            this.appendLog(this.status.error);
        });
    }

    async cancelDownload() {
        if (!this.currentProcess) {
            return;
        }

        this.currentProcess.kill('SIGTERM');
        this.currentProcess = null;
        this.status.state = 'idle';
        this.appendLog('Download cancelled by user.');
    }
}

export default new InstallerService();
