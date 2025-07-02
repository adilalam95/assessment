import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { analysisRouter } from './routers/analysisRouter.js';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 2 // Max 2 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});

// File upload endpoint that transforms to tRPC format
app.post('/api/analyze', upload.fields([
  { name: 'jobDescription', maxCount: 1 },
  { name: 'cv', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files.jobDescription?.[0] || !files.cv?.[0]) {
      return res.status(400).json({
        error: 'Both jobDescription and cv PDF files are required'
      });
    }

    const jobDescFile = files.jobDescription[0];
    const cvFile = files.cv[0];

    // Create tRPC context and call the procedure
    const result = await analysisRouter
      .createCaller({})
      .analyzeCandidateMatch({
        jobDescription: {
          buffer: jobDescFile.buffer,
          originalname: jobDescFile.originalname,
          mimetype: jobDescFile.mimetype
        },
        cv: {
          buffer: cvFile.buffer,
          originalname: cvFile.originalname,
          mimetype: cvFile.mimetype
        }
      });

    res.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    
    const statusCode = error instanceof Error && 'code' in error 
      ? (error as any).code === 'BAD_REQUEST' ? 400 : 500
      : 500;
    
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Analysis failed'
    });
  }
});

// tRPC endpoint (for typed clients)
app.use('/trpc', createExpressMiddleware({
  router: analysisRouter,
  createContext: () => ({})
}));

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 10MB)' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files (max 2)' });
    }
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`API endpoint: http://localhost:${port}/api/analyze`);
  console.log(`tRPC endpoint: http://localhost:${port}/trpc`);
  console.log(`Health check: http://localhost:${port}/health`);
  
//   console.log('🔑 Auth Token:', process.env.GEMINI_AUTH_TOKEN);
});