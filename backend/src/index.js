import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

// Force backend working directory to "<project>/backend" no matter where node was launched from.
process.chdir(backendRoot);

await import('./server.js');
