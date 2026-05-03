import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import AdmZip from 'adm-zip';
import authService from '../services/authService.js';
import userService from '../services/userService.js';
import settingsService from '../services/settingsService.js';
import { validateToken } from '../middleware/authMiddleware.js';

const router = express.Router();
const execFileAsync = promisify(execFile);

async function browseFolderDialog() {
    if (process.platform !== 'win32') {
        throw new Error('Native folder picker is currently supported on Windows only');
    }

    const psScript = `
Add-Type -AssemblyName System.Windows.Forms | Out-Null
Add-Type -AssemblyName System.Drawing | Out-Null

$owner = New-Object System.Windows.Forms.Form
$owner.Text = "Select Folder"
$owner.StartPosition = "CenterScreen"
$owner.Size = New-Object System.Drawing.Size(1,1)
$owner.ShowInTaskbar = $false
$owner.TopMost = $true
$owner.Opacity = 0
$owner.Show()
$owner.Activate()

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select your Minecraft server folder"
$dialog.ShowNewFolderButton = $true
$result = $dialog.ShowDialog($owner)
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.SelectedPath
}
$owner.Close()
`;

    const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-STA', '-Command', psScript],
        {
            windowsHide: false,
            timeout: 120000,
            maxBuffer: 1024 * 1024
        }
    );

    return String(stdout || '').trim();
}

async function browseZipFileDialog() {
    if (process.platform !== 'win32') {
        throw new Error('ZIP picker is currently supported on Windows only');
    }

    const psScript = `
Add-Type -AssemblyName System.Windows.Forms | Out-Null
Add-Type -AssemblyName System.Drawing | Out-Null

$owner = New-Object System.Windows.Forms.Form
$owner.Text = "Select ZIP File"
$owner.StartPosition = "CenterScreen"
$owner.Size = New-Object System.Drawing.Size(1,1)
$owner.ShowInTaskbar = $false
$owner.TopMost = $true
$owner.Opacity = 0
$owner.Show()
$owner.Activate()

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = "Select Minecraft Server ZIP"
$dialog.Filter = "ZIP files (*.zip)|*.zip|All files (*.*)|*.*"
$dialog.Multiselect = $false
$result = $dialog.ShowDialog($owner)
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.FileName
}
$owner.Close()
`;

    const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-STA', '-Command', psScript],
        {
            windowsHide: false,
            timeout: 120000,
            maxBuffer: 1024 * 1024
        }
    );

    return String(stdout || '').trim();
}

function ensureWithin(basePath, targetPath) {
    const base = path.resolve(basePath);
    const target = path.resolve(targetPath);
    const rel = path.relative(base, target);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function copyFolderContents(sourceDir, destinationRoot) {
    await fs.mkdir(destinationRoot, { recursive: true });
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        const src = path.join(sourceDir, entry.name);
        const dest = path.join(destinationRoot, entry.name);
        if (entry.isDirectory()) {
            await fs.mkdir(dest, { recursive: true });
            await copyFolderContents(src, dest);
        } else {
            await fs.copyFile(src, dest);
        }
    }
}

router.get('/detect-system', async (req, res) => {
    try {
        const info = await settingsService.detectSystem();
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/setup-needed', async (req, res) => {
    try {
        const needed = await userService.needsSetup();
        res.json({ needed });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/browse-folder', async (req, res) => {
    try {
        const selectedPath = await browseFolderDialog();
        if (!selectedPath) {
            return res.json({ cancelled: true, path: '' });
        }
        res.json({ cancelled: false, path: selectedPath });
    } catch (error) {
        if (error?.killed || error?.code === 'ETIMEDOUT') {
            return res.status(408).json({ error: 'Folder picker timed out. Please try again.' });
        }
        res.status(500).json({ error: error.message });
    }
});

router.get('/browse-zip', async (req, res) => {
    try {
        const selectedPath = await browseZipFileDialog();
        if (!selectedPath) {
            return res.json({ cancelled: true, path: '' });
        }
        res.json({ cancelled: false, path: selectedPath });
    } catch (error) {
        if (error?.killed || error?.code === 'ETIMEDOUT') {
            return res.status(408).json({ error: 'ZIP picker timed out. Please try again.' });
        }
        res.status(500).json({ error: error.message });
    }
});

router.post('/import-server-source', async (req, res) => {
    try {
        const sourceType = String(req.body?.sourceType || '').trim().toLowerCase();
        const sourcePath = String(req.body?.sourcePath || '').trim();
        const destinationPath = String(req.body?.destinationPath || '').trim();

        if (!sourceType || !sourcePath || !destinationPath) {
            return res.status(400).json({ error: 'sourceType, sourcePath, and destinationPath are required.' });
        }
        if (!['folder', 'zip'].includes(sourceType)) {
            return res.status(400).json({ error: 'sourceType must be "folder" or "zip".' });
        }

        const src = path.resolve(sourcePath);
        const dst = path.resolve(destinationPath);

        const srcStat = await fs.stat(src);
        await fs.mkdir(dst, { recursive: true });

        if (sourceType === 'folder') {
            if (!srcStat.isDirectory()) {
                return res.status(400).json({ error: 'Selected source is not a folder.' });
            }
            if (src.toLowerCase() === dst.toLowerCase()) {
                return res.status(400).json({ error: 'Source and destination cannot be the same folder.' });
            }
            await copyFolderContents(src, dst);
            return res.json({ success: true, message: 'Server folder imported to destination root.' });
        }

        if (!srcStat.isFile() || path.extname(src).toLowerCase() !== '.zip') {
            return res.status(400).json({ error: 'Selected source is not a ZIP file.' });
        }

        const zipName = path.basename(src);
        const copiedZipPath = path.join(dst, zipName);
        await fs.copyFile(src, copiedZipPath);

        const zip = new AdmZip(copiedZipPath);
        const zipEntries = zip.getEntries();
        for (const entry of zipEntries) {
            const target = path.resolve(dst, entry.entryName);
            if (!ensureWithin(dst, target)) {
                await fs.unlink(copiedZipPath).catch(() => { });
                return res.status(400).json({ error: `Unsafe ZIP entry blocked: ${entry.entryName}` });
            }
        }

        zip.extractAllTo(dst, true);
        await fs.unlink(copiedZipPath).catch(() => { });
        return res.json({ success: true, message: 'Server ZIP imported and extracted to destination root.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/setup', async (req, res) => {
    try {
        const user = await authService.setup(req.body);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { user, password } = req.body;
        const result = await authService.login(user, password);
        res.json(result);
    } catch (error) {
        console.error('Login Error:', error);
        if (error.message.includes('Invalid') || error.message.includes('required')) {
            res.status(401).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'An internal error occurred. Please check server console.' });
        }
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { user, secretKey } = req.body || {};
        const result = await userService.resetPasswordWithSecret(user, secretKey);
        res.json({
            success: true,
            user: result.username,
            temporaryPassword: result.temporaryPassword
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/change-password', validateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
