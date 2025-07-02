import request from 'supertest';
import { PDFService } from '../src/services/pdfService.ts';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { analysisRouter } from '../src/routers/analysisRouter.ts';

const SERVER_URL = 'http://localhost:3000';

// Create test app
const createTestApp = () => {
  const app = express();
  const storage = multer.memoryStorage();
  const upload = multer({ 
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 2
    },
    // Relaxed fileFilter - let PDFService do the real validation
    fileFilter: (req, file, cb) => {
      // Accept all files, validate content later
      cb(null, true);
    }
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      nodeVersion: process.version
    });
  });

  // Fixed endpoint with proper error handling and multer usage
  app.post('/api/analyze', (req, res) => {
    const uploadMiddleware = upload.fields([
      { name: 'jobDescription', maxCount: 1 },
      { name: 'cv', maxCount: 1 }
    ]);

    uploadMiddleware(req, res, async (uploadError) => {
      try {
        // Handle multer errors first
        if (uploadError) {
          console.error('Upload error:', uploadError);
          return res.status(400).json({
            error: uploadError.message || 'File upload failed'
          });
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        
        // Check if files were uploaded
        if (!files || !files.jobDescription?.[0] || !files.cv?.[0]) {
          return res.status(400).json({
            error: 'Both jobDescription and cv PDF files are required'
          });
        }

        const jobDescFile = files.jobDescription[0];
        const cvFile = files.cv[0];

        // Validate PDF files before processing
        const jobDescValidation = PDFService.validatePDF(jobDescFile.buffer);
        if (!jobDescValidation.isValid) {
          return res.status(400).json({
            error: `Job description PDF error: ${jobDescValidation.error}`
          });
        }

        const cvValidation = PDFService.validatePDF(cvFile.buffer);
        if (!cvValidation.isValid) {
          return res.status(400).json({
            error: `CV PDF error: ${cvValidation.error}`
          });
        }

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
  });

  app.use('/trpc', createExpressMiddleware({
    router: analysisRouter,
    createContext: () => ({})
  }));

  return app;
};

describe('CV Job Matcher API', () => {
  let app: express.Express;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('PDF Service', () => {
    it('should validate PDF format correctly', () => {
      const validPDFBuffer = Buffer.from('%PDF-1.4\n');
      const invalidBuffer = Buffer.from('not a pdf');

      const validResult = PDFService.validatePDF(validPDFBuffer);
      const invalidResult = PDFService.validatePDF(invalidBuffer);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toContain('Invalid PDF format');
    });

    it('should reject oversized files', () => {
      const largePDFBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      largePDFBuffer.write('%PDF-1.4');

      const result = PDFService.validatePDF(largePDFBuffer);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should clean text properly', () => {
      const messyText = '  Multiple\n\n\r\n  spaces   and\r\nline breaks  ';
      const cleaned = PDFService.cleanText(messyText);
      expect(cleaned).toBe('Multiple spaces and line breaks');
    });
  });

  describe('API Endpoints', () => {
    it('should reject requests without files', async () => {
      const response = await request(app)
        .post('/api/analyze')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should reject non-PDF files', async () => {
      const response = await request(app)
        .post('/api/analyze')
        .attach('jobDescription', Buffer.from('fake pdf'), 'test.pdf') // Changed to .pdf
        .attach('cv', Buffer.from('fake pdf'), 'test.pdf') // Changed to .pdf
        .expect(400);

      expect(response.body).toHaveProperty('error');
      // Updated expectation since we removed strict fileFilter
      expect(response.body.error).toContain('Invalid PDF format');
    });

    it('should reject invalid PDF files', async () => {
      const fakePDFBuffer = Buffer.from('fake pdf content');
      
      const response = await request(app)
        .post('/api/analyze')
        .attach('jobDescription', fakePDFBuffer, 'job.pdf')
        .attach('cv', fakePDFBuffer, 'cv.pdf')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid PDF format');
    });

    // Note: This test requires actual PDF files and valid auth token
    it.skip('should analyze valid PDF files', async () => {
      // This test would require real PDF files and auth token
      // Implementation would be similar to the above but with actual PDF content
      const mockPDFBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj 4 0 obj<</Length 44>>stream BT /F1 12 Tf 100 700 Td (Test content) Tj ET endstream endobj xref 0 5 0000000000 65535 f 0000000009 00000 n 0000000058 00000 n 0000000115 00000 n 0000000207 00000 n trailer<</Size 5/Root 1 0 R>> startxref 251 %%EOF');
      
      const response = await request(app)
        .post('/api/analyze')
        .attach('jobDescription', mockPDFBuffer, 'job.pdf')
        .attach('cv', mockPDFBuffer, 'cv.pdf')
        .timeout(60000);

      if (process.env.GEMINI_AUTH_TOKEN) {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('overallMatch');
        expect(response.body).toHaveProperty('strengths');
        expect(response.body).toHaveProperty('weaknesses');
        expect(response.body).toHaveProperty('recommendations');
        expect(response.body.overallMatch).toBeGreaterThanOrEqual(0);
        expect(response.body.overallMatch).toBeLessThanOrEqual(100);
      } else {
        expect(response.status).toBe(500);
      }
    });
  });
});