export interface AnalysisResult {
  overallMatch: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  keyAlignments: string[];
  missingSkills: string[];
  summary: string;
}

export interface GeminiRequest {
  contents: {
    parts: {
      text: string;
    }[];
  }[];
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

export interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
    finishReason: string;
  }[];
}

export interface ProcessedPDFContent {
  text: string;
  pageCount: number;
  metadata?: {
    info?: any;
    metadata?: any;
  };
}