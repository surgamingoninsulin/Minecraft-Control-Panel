import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import pidusage from 'pidusage';
import settingsService from './settingsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function splitCommandLine(input) {
  if (!input || !input.trim()) return [];
  const tokens = [];
  const regex = /[^\s"]+|"([^"]*)"/g;
  let match;
  while ((match = regex.exec(input)) !== null) {
    tokens.push(match[1] !== undefined ? match[1] : match[0]);
  }
  return tokens;
}

class ServerService extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.pid = null;
    this.status = 'offline';
    this.stats = {
      uptime: 0,
      cpu: 0,
      memory: 0,
      tps: 20.0,
      players: { online: 0, max: 20 },
      authFileExists: false
    };
    this.logs = [];
    this.MAX_LOGS = 1000;
    this.logFilePath = path.resolve('data/server-console.log');
    this.lifecycleLogPath = path.resolve(__dirname, '../../../logs/server.log');
    this.startTime = null;
    this.statsInterval = null;
    this.stopRequested = false;
    this.forceStopTimer = null;
    this.startAttempt = 0;
    this.lastOutputLine = '';
    this.loadLogsFromDisk();
    this.checkPidFile();
  }

  async writeLifecycleLog(message) {
    try {
      await fs.mkdir(path.dirname(this.lifecycleLogPath), { recursive: true });
      const now = new Date().toISOString();
      await fs.appendFile(this.lifecycleLogPath, `[${now}] ${message}\n`, 'utf8');
    } catch {
      // Never block runtime on diagnostics writes.
    }
  }

  clearForceStopTimer() {
    if (this.forceStopTimer) {
      clearTimeout(this.forceStopTimer);
      this.forceStopTimer = null;
    }
  }

  addLog(data) {
    const line = data.toString();
    this.logs.push(line);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
    this.persistLog(line);
    this.emit('console', line);
    return line.replace(/\x1B\[[0-9;]*[mK]/g, '');
  }

  async loadLogsFromDisk() {
    try {
      await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
      const raw = await fs.readFile(this.logFilePath, 'utf8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      this.logs = lines.slice(-this.MAX_LOGS).map((line) => `${line}\n`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[ServerService] Failed to load persisted logs:', error.message);
      }
    }
  }

  async persistLog(line) {
    try {
      await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
      await fs.appendFile(this.logFilePath, line, 'utf8');
    } catch (error) {
      // Persist errors should never impact runtime.
    }
  }

  async checkPidFile() {
    try {
      const pidPath = path.resolve('data/server.pid');
      const pid = await fs.readFile(pidPath, 'utf8');

      if (pid) {
        try {
          process.kill(parseInt(pid), 0);
          console.log(`[ServerService] Found running server process with PID ${pid}`);
          this.status = 'online';
          this.pid = parseInt(pid);
          this.startTime = Date.now();
          this.startStatsCollection();
          this.emit('statusChange', 'online');
          this.writeLifecycleLog(`Recovered running process from PID file (pid=${this.pid}).`);
        } catch (e) {
          console.log('[ServerService] PID file exists but process is dead. Cleaning up.');
          await fs.unlink(pidPath).catch(() => { });
          this.writeLifecycleLog('PID file existed but process was dead; cleaned stale PID file.');
        }
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error('[ServerService] Failed to read PID file:', e.message);
      }
      // No pid file or error reading it
    }
  }

  async start() {
    if (this.status === 'online' || this.process) {
      this.writeLifecycleLog(`Start rejected: already running (status=${this.status}, pid=${this.process?.pid || this.pid || 'n/a'}).`);
      throw new Error('Server is already running');
    }

    try {
      this.startAttempt += 1;
      const attemptId = this.startAttempt;

      // Safety: cancel any delayed stop timer from previous stop/restart cycles.
      this.clearForceStopTimer();
      await this.writeLifecycleLog(`Start requested (attempt=${attemptId}).`);

      const settings = await settingsService.get();
      await this.writeLifecycleLog(`Settings loaded (serverPath="${settings.serverPath || ''}", javaPathConfigured=${Boolean(settings.javaPath && settings.javaPath.trim())}).`);

      if (!settings.serverPath) {
        await this.writeLifecycleLog(`Start aborted (attempt=${attemptId}): serverPath missing.`);
        throw new Error('Server path is not configured. Please go to Settings.');
      }

      this.status = 'starting';
      this.stopRequested = false;
      this.emit('statusChange', 'starting');

      const startCommandTokens = splitCommandLine(settings.startCommand);
      if (startCommandTokens.length === 0) {
        await this.writeLifecycleLog(`Start aborted (attempt=${attemptId}): start command empty.`);
        throw new Error('Start command is empty. Please configure it in Settings.');
      }

      const configuredJavaPath = (settings.javaPath && settings.javaPath.trim()) ? settings.javaPath.trim().replace(/^"|"$/g, '') : '';

      // Use configured java path if available and valid, otherwise fallback to the command from startCommand.
      const command = configuredJavaPath || startCommandTokens[0];
      let args = startCommandTokens.slice(1);

      // If a full java path accidentally exists in startCommand without quotes, strip all launcher fragments
      // and keep only JVM/application arguments (from the first option token).
      if (configuredJavaPath) {
        const optionIdx = startCommandTokens.findIndex((token, idx) => idx > 0 && token.startsWith('-'));
        if (optionIdx > 0) {
          args = startCommandTokens.slice(optionIdx);
        }
      }

      // Running from panel means a non-interactive terminal; disable advanced JLine terminal probing.
      const isJavaCommand = /(^|\\|\/)java(?:\.exe)?$/i.test(command) || command.toLowerCase() === 'java';
      if (isJavaCommand) {
        if (!args.some((arg) => arg.startsWith('-Dterminal.jline='))) {
          args.unshift('-Dterminal.jline=false');
        }
        if (!args.some((arg) => arg.startsWith('-Dterminal.ansi='))) {
          args.unshift('-Dterminal.ansi=true');
        }
      }

      console.log(`[ServerService] Spawning: ${command} ${args.join(' ')}`);
      await this.writeLifecycleLog(`Spawning process (attempt=${attemptId}): command="${command}" args="${args.join(' ')}" cwd="${settings.serverPath}".`);

      this.process = spawn(command, args, {
        cwd: settings.serverPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.startTime = Date.now();

      if (this.process.pid) {
        this.pid = this.process.pid;
        try {
          await fs.writeFile(path.resolve('data/server.pid'), this.process.pid.toString());
          await this.writeLifecycleLog(`Process spawned (attempt=${attemptId}, pid=${this.process.pid}); PID file written.`);
        } catch (e) {
          console.error('[ServerService] CRITICAL: Failed to save PID file. Check permissions for data/ directory:', e.message);
          await this.writeLifecycleLog(`CRITICAL: failed to write PID file (attempt=${attemptId}, pid=${this.process.pid}): ${e.message}`);
        }
      } else {
        console.error('[ServerService] Process spawned but no PID generated. This usually means the executable was not found.');
        await this.writeLifecycleLog(`Spawn returned no PID (attempt=${attemptId}).`);
      }

      this.process.on('error', (err) => {
        console.error('[ServerService] Failed to start server process:', err.message);
        this.writeLifecycleLog(`Process error (attempt=${attemptId}, pid=${this.process?.pid || 'n/a'}): ${err.code || 'UNKNOWN'} ${err.message}`);
        let userMessage = 'Failed to start server: ' + err.message;

        if (err.code === 'ENOENT') {
          const msg = 'Could not find the "java" executable. Is Java installed and in your PATH?';
          this.addLog('[Error] ' + msg);
          userMessage = msg;
        }

        this.status = 'offline';
        this.emit('statusChange', 'offline');
        this.emit('startError', userMessage);
      });

      const handleOutput = (streamName, data) => {
        const output = this.addLog(data);
        const clean = output.toLowerCase();
        const lines = output.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
        if (lines.length > 0) {
          this.lastOutputLine = lines[lines.length - 1];
          for (const line of lines) {
            this.writeLifecycleLog(`${streamName}: ${line}`);
          }
        }

        // Parse server ready state
        if (
          clean.includes('done!') ||
          clean.includes('for help, type "help"') ||
          /done \([\d.,]+s\)!/i.test(output) ||
          clean.includes('minecraft server booted')
        ) {
          if (this.status !== 'online') {
            console.log(`[ServerService] Server detected as ONLINE via logs`);
            this.writeLifecycleLog(`Status change: starting -> online (attempt=${attemptId}, pid=${this.process?.pid || this.pid || 'n/a'}).`);
            this.status = 'online';
            this.emit('statusChange', 'online');
          }
        }

        // Player join detection - Minecraft/Paper/Purpur console format
        const joinMatch = output.match(/\]:\s*([A-Za-z0-9_]{3,16}) joined the game/i);
        if (joinMatch) {
          const playerName = joinMatch[1];
          this.stats.players.online++;
          console.log(`[ServerService] Player joined: ${playerName} (${this.stats.players.online}/${this.stats.players.max})`);
          this.emit('stats', { ...this.stats });
        }

        // Player leave detection - Minecraft/Paper/Purpur console format
        const leaveMatch = output.match(/\]:\s*([A-Za-z0-9_]{3,16}) left the game/i) ||
          output.match(/\]:\s*([A-Za-z0-9_]{3,16}) lost connection/i);

        if (leaveMatch) {
          const playerName = leaveMatch[1];
          this.stats.players.online = Math.max(0, this.stats.players.online - 1);
          console.log(`[ServerService] Player left: ${playerName} (${this.stats.players.online}/${this.stats.players.max})`);
          this.emit('stats', { ...this.stats });
        }

        if (clean.includes('no server tokens configured') && !this.stats.authFileExists) {
          console.log('[ServerService] Auth token check failed. Auto-sending "/auth login device"...');
          this.writeLifecycleLog('Auth token missing; scheduling "/auth login device".');
          setTimeout(() => {
            this.sendCommand('/auth login device');
          }, 1000);
        }

        // Detect Auth URL and Code
        const authUrlPattern = /(https?:\/\/(?:oauth\.)?accounts\.minecraft\.com\/(?:oauth2\/)?device(?:\/verify)?(?:\?user_code=[A-Za-z0-9]+)?)/i;
        const authCodePatterns = [
          /(?:Authorization code|Enter code|user_code):\s*([A-Za-z0-9]{4,})/i,
          /code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i,
          /user_code[=:]\s*([A-Za-z0-9]+)/i
        ];

        const urlMatch = output.match(authUrlPattern);
        let codeMatch = null;

        for (const pattern of authCodePatterns) {
          codeMatch = output.match(pattern);
          if (codeMatch) break;
        }

        if (urlMatch || codeMatch) {
          const deviceCode = codeMatch ? codeMatch[1] : null;
          const baseUrl = 'https://oauth.accounts.minecraft.com/oauth2/device/verify';

          const authData = {
            verificationUrl: deviceCode ? `${baseUrl}?user_code=${deviceCode}` : baseUrl,
            deviceCode: deviceCode
          };

          if (authData.deviceCode || authData.verificationUrl) {
            console.log('[ServerService] Detected Auth Request:', authData);
            this.emit('authRequest', authData);
          }
        }

        // Detect authentication success
        if (clean.includes('authentication successful') || clean.includes('authorized')) {
          console.log('[ServerService] Authentication successful!');
          this.writeLifecycleLog('Authentication detected as successful from server output.');
          this.emit('authRequest', { success: true });

          console.log('[ServerService] Setting encrypted auth persistence...');
          this.writeLifecycleLog('Scheduling command: auth persistence Encrypted');
          setTimeout(() => {
            this.sendCommand('auth persistence Encrypted');
          }, 1000);
        }

        // Detect persistence change confirmation
        if (clean.includes('swapped credential store to: encryptedauthcredentialstoreprovider')) {
          console.log('[ServerService] Auth persistence set to Encrypted successfully!');
          this.writeLifecycleLog('Authentication persistence switched to encrypted provider.');
          this.addLog('[Panel] Authentication configured with encrypted persistence. Server will remember credentials on restart.\n');
        }
      };

      this.process.stdout.on('data', (data) => handleOutput('STDOUT', data));
      this.process.stderr.on('data', (data) => handleOutput('STDERR', data));

      this.process.on('close', async (code, signal) => {
        const intentionalStop = this.stopRequested;
        this.stopRequested = false;
        this.clearForceStopTimer();
        await this.writeLifecycleLog(`Process close (attempt=${attemptId}, intentionalStop=${intentionalStop}, code=${code}, signal=${signal || 'none'}, lastLine="${this.lastOutputLine || ''}").`);
        this.status = 'offline';
        this.process = null;
        this.pid = null;
        this.startTime = null;

        try {
          await fs.unlink(path.resolve('data/server.pid')).catch(() => { });
        } catch (e) { }

        this.emit('statusChange', 'offline');
        if (intentionalStop) {
          this.addLog(`Server stopped with code ${code}\n`);
          await this.writeLifecycleLog(`Status change: stopping -> offline (attempt=${attemptId}).`);
        } else {
          this.addLog(`Server exited unexpectedly with code ${code}\n`);
          await this.writeLifecycleLog(`Unexpected exit recorded (attempt=${attemptId}, code=${code}, signal=${signal || 'none'}).`);
        }

        if (this.statsInterval) {
          clearInterval(this.statsInterval);
          this.statsInterval = null;
        }
      });

      this.startStatsCollection();
      await this.writeLifecycleLog(`Start flow completed (attempt=${attemptId}); waiting for server bootstrap output.`);

      return { success: true, message: 'Server starting' };
    } catch (error) {
      this.status = 'offline';
      this.emit('statusChange', 'offline');
      this.writeLifecycleLog(`Start failed: ${error.message}`);
      throw error;
    }
  }

  stop() {
    if (this.status !== 'online' && !this.process) {
      this.writeLifecycleLog(`Stop rejected: server not running (status=${this.status}).`);
      throw new Error('Server is not running');
    }

    this.writeLifecycleLog(`Stop requested (status=${this.status}, pid=${this.process?.pid || this.pid || 'n/a'}).`);
    this.stopRequested = true;
    this.status = 'stopping';
    this.emit('statusChange', 'stopping');

    if (this.process) {
      const stoppingPid = this.process.pid;
      this.sendCommand('stop');
      this.clearForceStopTimer();
      this.forceStopTimer = setTimeout(() => {
        // Only force-kill the same process we requested to stop.
        if (this.process && this.process.pid === stoppingPid && this.status === 'stopping') {
          this.writeLifecycleLog(`Force stop timer fired; sending SIGTERM to pid=${this.process.pid}.`);
          this.process.kill('SIGTERM');
        } else {
          this.writeLifecycleLog(`Force stop timer fired but skipped (currentPid=${this.process?.pid || 'n/a'}, expectedPid=${stoppingPid}, status=${this.status}).`);
        }
      }, 30000);
      this.writeLifecycleLog(`Graceful stop command sent; force stop timer scheduled for pid=${stoppingPid} in 30000ms.`);
    } else if (this.pid) {
      this.clearForceStopTimer();
      console.log(`[ServerService] Stopping orphaned process ${this.pid}`);
      try {
        this.writeLifecycleLog(`Stopping orphaned process via SIGTERM (pid=${this.pid}).`);
        process.kill(this.pid, 'SIGTERM');
      } catch (e) {
        console.error("Failed to kill PID:", e);
        this.writeLifecycleLog(`Failed to stop orphaned process (pid=${this.pid}): ${e.message}`);
      }

      this.status = 'offline';
      this.emit('statusChange', 'offline');
      fs.unlink(path.resolve('data/server.pid')).catch(() => { });
    }

    return { success: true, message: 'Server stopping' };
  }

  async restart() {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000));
    return this.start();
  }

  sendCommand(command) {
    if (!this.process) {
      this.writeLifecycleLog(`Command rejected while detached: "${command}"`);
      throw new Error('Cannot send command to detached process (logs only). Restart panel to regain control, or just wait.');
    }
    this.writeLifecycleLog(`Command sent: ${command}`);
    if (typeof command === 'string' && command.trim().toLowerCase() === 'stop') {
      this.stopRequested = true;
      this.status = 'stopping';
      this.emit('statusChange', 'stopping');
    }
    this.process.stdin.write(command + '\n');
    return { success: true };
  }

  getStatus() {
    return {
      status: this.status,
      stats: this.stats
    };
  }

  startStatsCollection() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.statsInterval = setInterval(async () => {
      let targetPid = this.process ? this.process.pid : this.pid;

      if (!targetPid) return;

      if (!this.startTime) {
        this.startTime = Date.now();
      }

      try {
        const settings = await settingsService.get();
        if (settings.serverPath) {
          try {
            await fs.access(path.join(settings.serverPath, 'auth.enc'));
            this.stats.authFileExists = true;
          } catch {
            this.stats.authFileExists = false;
          }
        }

        const usage = await pidusage(targetPid).catch(() => ({ cpu: 0, memory: 0 }));

        const uptimeMs = Date.now() - this.startTime;
        const totalSeconds = Math.floor(uptimeMs / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (n) => n.toString().padStart(2, '0');
        const uptimeStr = `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

        this.stats = {
          ...this.stats,
          uptime: uptimeStr,
          cpu: Math.round(usage.cpu),
          memory: Math.round(usage.memory / 1024 / 1024)
        };

        this.emit('stats', { ...this.stats });
      } catch (error) {
        // Silently handle errors
      }
    }, 2000);
  }
}

export default new ServerService();

