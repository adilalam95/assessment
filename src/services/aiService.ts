import axios from 'axios';
import type { GeminiRequest, GeminiResponse, AnalysisResult } from '../types/index.js';
import { rateLimiter } from '../utils/rateLimiter';
import 'dotenv/config';

const { 
  GEMINI_WOLF_ENDPOINT, 
  GEMINI_WOLF_AUTH_TOKEN, 
  USE_WOLF_ENDPOINT, 
  GEMINI_ENDPOINT, 
  GEMINI_API_KEY 
} = process.env;

export class AIService {
  private readonly wolfEndpoint = 'https://intertest.woolf.engineering/invoke';
  private readonly geminiEndpoint: string;
  private readonly authToken: string;
  private readonly apiKey: string;
  private readonly useWolfEndpoint: boolean;

  constructor(authToken?: string) {
    this.useWolfEndpoint = USE_WOLF_ENDPOINT === 'true' || USE_WOLF_ENDPOINT === '1';
    
    if (this.useWolfEndpoint) {
      this.authToken = authToken || GEMINI_WOLF_AUTH_TOKEN || '';
      this.geminiEndpoint = GEMINI_WOLF_ENDPOINT || this.wolfEndpoint;
      this.apiKey = '';
    } else {
      this.authToken = '';
      this.geminiEndpoint = GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
      this.apiKey = GEMINI_API_KEY || '';
    }
  }

  async analyzeCandidate(cvText: string, jobDescriptionText: string): Promise<AnalysisResult> {
    // Check rate limits
    const rateLimitCheck = rateLimiter.canMakeRequest();
    if (!rateLimitCheck.allowed) {
      throw new Error(rateLimitCheck.error);
    }

    const prompt = this.buildAnalysisPrompt(cvText, jobDescriptionText);
    
    const request: GeminiRequest = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 2048
      }
    };

    try {
      console.log(`Using ${this.useWolfEndpoint ? 'Wolf' : 'Gemini'} endpoint`);
      
      let url: string;
      let headers: Record<string, string>;

      if (this.useWolfEndpoint) {
        // Wolf endpoint configuration
        url = this.geminiEndpoint;
        headers = {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        };
      } else {
        // Google Gemini endpoint configuration
        url = `${this.geminiEndpoint}?key=${this.apiKey}`;
        headers = {
          'Content-Type': 'application/json'
        };
      }

      const response = await axios.post<GeminiResponse>(
        url,
        request,
        {
          headers,
          timeout: 30000
        }
      );

      const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiResponse) {
        throw new Error('Invalid response from AI service');
      }

      return this.parseAIResponse(aiResponse);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded on AI service');
        }
        throw new Error(`AI service error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  private buildAnalysisPrompt(cvText: string, jobDescriptionText: string): string {
    return `
Analyze the following CV against the job description and provide a comprehensive evaluation.

JOB DESCRIPTION:
${jobDescriptionText}

CANDIDATE CV:
${cvText}

Please provide your analysis in the following JSON format (ensure valid JSON):

{
  "overallMatch": <number between 0-100>,
  "strengths": [<array of candidate's key strengths relevant to the role>],
  "weaknesses": [<array of areas where candidate may be lacking>],
  "recommendations": [<array of suggestions for improving the match>],
  "keyAlignments": [<array of specific ways the candidate aligns with job requirements>],
  "missingSkills": [<array of required skills the candidate appears to lack>],
  "summary": "<brief overall assessment paragraph>"
}

Focus on:
- Technical skills alignment
- Experience relevance
- Cultural fit indicators
- Education/certification match
- Soft skills assessment
- Growth potential

Provide specific, actionable insights rather than generic statements.
`;
  }

  private parseAIResponse(response: string): AnalysisResult {
    try {
      // Extract JSON from response (in case there's additional text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;
      
      const parsed = JSON.parse(jsonString);
      
      // Validate required properties
      const result: AnalysisResult = {
        overallMatch: Math.max(0, Math.min(100, parsed.overallMatch || 0)),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        keyAlignments: Array.isArray(parsed.keyAlignments) ? parsed.keyAlignments : [],
        missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
        summary: parsed.summary || 'Analysis completed'
      };

      return result;
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  getRemainingRequests(): { minute: number; hour: number } {
    return rateLimiter.getRemainingRequests();
  }

  // Utility method to check current configuration
  getCurrentConfig(): { useWolfEndpoint: boolean; endpoint: string } {
    return {
      useWolfEndpoint: this.useWolfEndpoint,
      endpoint: this.geminiEndpoint
    };
  }
}