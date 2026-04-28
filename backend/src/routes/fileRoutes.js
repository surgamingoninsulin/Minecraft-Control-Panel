import express from 'express';
import multer from 'multer';
import fileService from '../services/fileService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function sendFileError(res, error) {
  if (error?.code === 'ESERVERPATH') {
    return res.status(400).json({ error: error.message });
  }
  if (error?.code === 'ESECURITY') {
    return res.status(403).json({ error: error.message });
  }
  return res.status(500).json({ error: error.message });
}

// List files in directory
router.get('/list', async (req, res) => {
  try {
    const { directory = '' } = req.query;
    const files = await fileService.listFiles(directory);
    res.json(files);
  } catch (error) {
    sendFileError(res, error);
  }
});

// Read file content
router.get('/read', async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }
    const result = await fileService.readFile(path);
    res.json(result);
  } catch (error) {
    sendFileError(res, error);
  }
});

// Write file content
router.post('/write', async (req, res) => {
  try {
    const { path, content } = req.body;
    if (!path || content === undefined) {
      return res.status(400).json({ error: 'Path and content are required' });
    }
    const result = await fileService.writeFile(path, content);
    res.json(result);
  } catch (error) {
    sendFileError(res, error);
  }
});

// Delete file or directory
router.delete('/delete', async (req, res) => {
  try {
    const { path } = req.body;
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }
    const result = await fileService.deleteFile(path);
    res.json(result);
  } catch (error) {
    sendFileError(res, error);
  }
});

// Create directory
router.post('/mkdir', async (req, res) => {
  try {
    const { path } = req.body;
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }
    const result = await fileService.createDirectory(path);
    res.json(result);
  } catch (error) {
    sendFileError(res, error);
  }
});

// Upload file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { path: filePath } = req.body;
    if (!filePath || !req.file) {
      return res.status(400).json({ error: 'Path and file are required' });
    }
    const result = await fileService.uploadFile(filePath, req.file.buffer);
    res.json(result);
  } catch (error) {
    sendFileError(res, error);
  }
});

export default router;
