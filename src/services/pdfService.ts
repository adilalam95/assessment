import pdf from 'pdf-parse';
import type { ProcessedPDFContent } from '../types/index.js';

export class PDFService {
  static async extractText(buffer: Buffer): Promise<ProcessedPDFContent> {
    try {
      const data = await pdf(buffer);
      
      return {
        text: data.text,
        pageCount: data.numpages,
        metadata: {
          info: data.info,
          metadata: data.metadata
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static validatePDF(buffer: Buffer): { isValid: boolean; error?: string } {
    // Check if buffer starts with PDF header
    const pdfHeader = buffer.slice(0, 4).toString();
    if (pdfHeader !== '%PDF') {
      return {
        isValid: false,
        error: 'Invalid PDF format'
      };
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      return {
        isValid: false,
        error: 'PDF file too large (max 10MB)'
      };
    }

    return { isValid: true };
  }

  static cleanText(text: string): string {
    return text
      .replace(/\r\n|\r|\n/g, ' ') // Replace line breaks with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }
}