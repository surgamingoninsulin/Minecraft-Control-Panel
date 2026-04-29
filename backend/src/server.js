import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import serverRoutes from './routes/serverRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import pluginRoutes from './routes/pluginRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import installerRoutes from './routes/installerRoutes.js';
import playitRoutes from './routes/playitRoutes.js';
import worldRoutes from './routes/worldRoutes.js';
import playerRoutes from './routes/playerRoutes.js';
import { validateToken } from './middleware/authMiddleware.js';
import { setupSocketHandlers } from './services/socketService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/installer', installerRoutes);

// Protected Routes
app.use('/api/server', validateToken, serverRoutes);
app.use('/api/files', validateToken, fileRoutes);
app.use('/api/plugins', validateToken, pluginRoutes);
app.use('/api/settings', validateToken, settingsRoutes);
app.use('/api/playit', validateToken, playitRoutes);
app.use('/api/worlds', validateToken, worldRoutes);
app.use('/api/universes', validateToken, worldRoutes);
app.use('/api/players', validateToken, playerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve shared static assets directly from frontend/public/static.
const frontendPublicStaticPath = path.resolve(__dirname, '../../frontend/public/static');
if (fs.existsSync(frontendPublicStaticPath)) {
  app.use('/static', express.static(frontendPublicStaticPath));
}

// Serve built frontend if available (single merged deploy).
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Socket.IO setup
setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
