import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
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

    const selectedPath = String(stdout || '').trim();
    return selectedPath;
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
        // Return generic error to client to hide system paths
        // unless it's a specific auth error we want to show
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
