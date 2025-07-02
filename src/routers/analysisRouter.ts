import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import { PDFService } from '../services/pdfService';
import { AIService } from '../services/aiService';
import 'dotenv/config';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Environment variables
const { 
  GEMINI_WOLF_ENDPOINT, 
  GEMINI_WOLF_AUTH_TOKEN, 
  USE_WOLF_ENDPOINT, 
  GEMINI_ENDPOINT, 
  GEMINI_API_KEY 
} = process.env;

const FileSchema = z.object({
  buffer: z.instanceof(Buffer),
  originalname: z.string(),
  mimetype: z.string()
});

// Helper function to validate AI service configuration
function validateAIConfiguration() {
  const useWolfEndpoint = USE_WOLF_ENDPOINT === 'true' || USE_WOLF_ENDPOINT === '1';
  
  if (useWolfEndpoint) {
    if (!GEMINI_WOLF_AUTH_TOKEN) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wolf endpoint auth token not configured'
      });
    }
    return { useWolf: true, token: GEMINI_WOLF_AUTH_TOKEN };
  } else {
    if (!GEMINI_API_KEY) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Google Gemini API key not configured'
      });
    }
    return { useWolf: false, token: null };
  }
}

export const analysisRouter = router({
  analyzeCandidateMatch: publicProcedure
    .input(z.object({
      jobDescription: FileSchema,
      cv: FileSchema
    }))
    .mutation(async ({ input }) => {
      const { jobDescription, cv } = input;

      try {
        // Validate PDF files
        const jobDescValidation = PDFService.validatePDF(jobDescription.buffer);
        if (!jobDescValidation.isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Job description PDF error: ${jobDescValidation.error}`
          });
        }

        const cvValidation = PDFService.validatePDF(cv.buffer);
        if (!cvValidation.isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `CV PDF error: ${cvValidation.error}`
          });
        }

        // Extract text from PDFs
        const [jobDescContent, cvContent] = await Promise.all([
          PDFService.extractText(jobDescription.buffer),
          PDFService.extractText(cv.buffer)
        ]);

        // Clean and validate extracted text
        const jobDescText = PDFService.cleanText(jobDescContent.text);
        const cvText = PDFService.cleanText(cvContent.text);

        if (!jobDescText.trim()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Job description PDF contains no readable text'
          });
        }

        if (!cvText.trim()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'CV PDF contains no readable text'
          });
        }

        // Validate AI service configuration
        const config = validateAIConfiguration();
        
        // Create AI service instance
        const aiService = new AIService(config.token || undefined);

        console.log(`Using ${config.useWolf ? 'Wolf' : 'Google Gemini'} endpoint for analysis`);

        const analysis = await aiService.analyzeCandidate(cvText, jobDescText);

        return {
          ...analysis,
          metadata: {
            jobDescriptionPages: jobDescContent.pageCount,
            cvPages: cvContent.pageCount,
            analysisTimestamp: new Date().toISOString(),
            remainingRequests: aiService.getRemainingRequests(),
            endpointUsed: config.useWolf ? 'Wolf' : 'Google Gemini'
          }
        };

      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error('Analysis error:', error);
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Analysis failed'
        });
      }
    }),

  healthCheck: publicProcedure
    .query(async () => {
      try {
        const useWolfEndpoint = USE_WOLF_ENDPOINT === 'true' || USE_WOLF_ENDPOINT === '1';
        
        // Validate configuration without throwing
        let configValid = false;
        let configError = '';
        
        if (useWolfEndpoint) {
          configValid = !!GEMINI_WOLF_AUTH_TOKEN;
          configError = configValid ? '' : 'Wolf auth token missing';
        } else {
          configValid = !!GEMINI_API_KEY;
          configError = configValid ? '' : 'Gemini API key missing';
        }

        let aiService: AIService | null = null;
        let remainingRequests = { minute: 0, hour: 0 };

        if (configValid) {
          aiService = new AIService(useWolfEndpoint ? GEMINI_WOLF_AUTH_TOKEN : undefined);
          remainingRequests = aiService.getRemainingRequests();
        }

        return {
          status: configValid ? 'healthy' : 'configuration_error',
          timestamp: new Date().toISOString(),
          configuration: {
            useWolfEndpoint,
            endpoint: useWolfEndpoint 
              ? (GEMINI_WOLF_ENDPOINT || 'https://intertest.woolf.engineering/invoke')
              : (GEMINI_ENDPOINT || 'Google Gemini API'),
            authConfigured: configValid,
            configError: configError || undefined
          },
          remainingRequests,
          aiServiceConfig: aiService?.getCurrentConfig()
        };
      } catch (error) {
        return {
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Health check failed'
        };
      }
    }),

  getConfiguration: publicProcedure
    .query(async () => {
      const useWolfEndpoint = USE_WOLF_ENDPOINT === 'true' || USE_WOLF_ENDPOINT === '1';
      
      return {
        useWolfEndpoint,
        wolfEndpoint: GEMINI_WOLF_ENDPOINT || 'https://intertest.woolf.engineering/invoke',
        geminiEndpoint: GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        wolfAuthConfigured: !!GEMINI_WOLF_AUTH_TOKEN,
        geminiApiKeyConfigured: !!GEMINI_API_KEY,
        currentEndpoint: useWolfEndpoint ? 'Wolf' : 'Google Gemini'
      };
    })
});

export type AnalysisRouter = typeof analysisRouter;