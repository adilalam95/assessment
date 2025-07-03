# CV Job Matcher

A Node.js server with tRPC that analyzes CV and job description alignment using AI. Upload two PDFs (job description and CV) and get detailed analysis of candidate fit, strengths, weaknesses, and recommendations.

## Features

- 🔒 **Type-safe API** with tRPC
- 📄 **PDF Processing** with text extraction
- 🤖 **AI Analysis** using Gemini 1.5 Flash
- ⚡ **Rate Limiting** (20/min, 300/hour)
- 🛡️ **Input Validation** and error handling
- 📊 **Detailed Analysis** with scoring and recommendations
- 🔧 **Easy Testing** with REST API and curl support

## Quick Start

### Prerequisites

- Node.js 22.17+ LTS
- Gemini AI authorization token

### Installation

# Clone the repository
git clone https://github.com/adilalam95/assessment
cd assessment

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your GEMINI_WOLF_AUTH_TOKEN


### Environment Setup
<!-- at toot level -->
Create a `.env` file with:


GEMINI_WOLF_AUTH_TOKEN=your_auth_token_here
GEMINI_WOLF_ENDPOINT=https://intertest.woolf.engineering/invoke
PORT=3000
USE_WOLF_ENDPOINT=true
GEMINI_ENDPOINT=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
GEMINI_API_KEY=your_api_key_here


### Running the Server


# Development mode with hot reload
npm run dev

# Production build and start
npm run build
npm start

# Run tests
npm test


## API Usage

### REST API (Recommended)

Upload two PDF files to analyze candidate-job fit:


curl -X POST http://localhost:3000/api/analyze \
  -F "jobDescription=@path/to/job-description.pdf" \
  -F "cv=@path/to/cv.pdf"


### Response Format


{
  "overallMatch": 85,
  "strengths": [
    "Strong technical background in required technologies",
    "Relevant industry experience",
    "Leadership experience demonstrated"
  ],
  "weaknesses": [
    "Limited experience with specific framework mentioned",
    "No certification in required area"
  ],
  "recommendations": [
    "Consider training in Framework X",
    "Highlight transferable skills more prominently"
  ],
  "keyAlignments": [
    "5+ years experience matches requirement",
    "Previous role closely related to job function"
  ],
  "missingSkills": [
    "Framework X",
    "Certification Y"
  ],
  "summary": "Strong candidate with good technical fit...",
  "metadata": {
    "jobDescriptionPages": 2,
    "cvPages": 3,
    "analysisTimestamp": "2024-01-15T10:30:00.000Z",
    "remainingRequests": {
      "minute": 19,
      "hour": 299
    }
  }
}
## API Endpoints

- `POST /api/analyze` - Analyze CV against job description
- `GET /health` - Server health check
- `POST /trpc/analyzeCandidateMatch` - tRPC endpoint
- `GET /trpc/healthCheck` - tRPC health check

## File Requirements

- **Format**: PDF only
- **Size**: Maximum 10MB per file
- **Content**: Text-based PDFs (images will not be processed)
- **Required**: Both job description and CV files

## Development

### Project Structure

```
src/
├── routers/          # tRPC routers
├── services/         # Business logic
│   ├── aiService.ts  # Gemini AI integration
│   └── pdfService.ts # PDF processing
├── types/            # TypeScript definitions
├── utils/            # Utilities (rate limiter)
├── client/           # Example client code
└── server.ts         # Express server setup

tests/                # Test files
sample-files/         # Test PDF files (add your own)
```

### Adding Test Files

Create a `sample-files` directory and add sample PDFs for testing:


mkdir sample-files
# Add your test PDFs:
# - job-description.pdf
# - cv.pdf


### Running Tests


# Run all tests
npm test

# Watch mode
npm run test:watch

# Type checking
npm run type-check


### Rate Limiting

The service respects Gemini API rate limits:
- 20 requests per minute
- 300 requests per hour

Rate limit status is included in all responses.

## Error Handling

The API handles various error scenarios:

- Invalid PDF format
- File too large (>10MB)
- Missing files
- AI service errors
- Rate limit exceeded
- Network timeouts

## Troubleshooting

### Common Issues

1. **"GEMINI_AUTH_TOKEN not set"**
   - Add the token to your `.env` file
   - Ensure `.env` is in the project root

2. **"Rate limit exceeded"**
   - Wait for the rate limit window to reset
   - Check remaining requests in response metadata

3. **"PDF contains no readable text"**
   - Ensure PDFs contain selectable text, not just images
   - Try with different PDF files

4. **"File too large"**
   - Reduce PDF file size (max 10MB)
   - Compress PDFs if necessary

# curl command to test wolf end point
curl -v -X POST https://intertest.woolf.engineering/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: [auth_token]" \
  -d '{
    "contents": [
      {
        "role" : "user",
        "parts": [
          {
            "text": "Hello!"
          }
        ]
      }
    ]
  }'