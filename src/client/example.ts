import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AnalysisRouter } from '../routers/analysisRouter.js';
import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';

// Example 1: Using tRPC client (requires additional setup)
const trpcClient = createTRPCProxyClient<AnalysisRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
});

// Example 2: Using REST API with axios (recommended for file uploads)
async function analyzeWithREST(jobDescriptionPath: string, cvPath: string) {
  try {
    const formData = new FormData();
    formData.append('jobDescription', fs.createReadStream(jobDescriptionPath));
    formData.append('cv', fs.createReadStream(cvPath));

    const response = await axios.post('http://localhost:3000/api/analyze', formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: 60000 // 60 second timeout
    });

    console.log('Analysis Result:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data || error.message);
    } else {
      console.error('Error:', error);
    }
    throw error;
  }
}

// Example 3: Using curl (for testing)
export const curlExample = `
curl -X POST http://localhost:3000/api/analyze \\
  -F "jobDescription=@path/to/job-description.pdf" \\
  -F "cv=@path/to/cv.pdf" \\
  -H "Content-Type: multipart/form-data"
`;

// Example 4: Health check
async function checkHealth() {
  try {
    const response = await axios.get('http://localhost:3000/health');
    console.log('Server Health:', response.data);
    
    // Check tRPC health
    const trpcHealth = await trpcClient.healthCheck.query();
    console.log('tRPC Health:', trpcHealth);
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

// Usage example
async function main() {
  const jobDescPath = './sample-files/job-description.pdf';
  const cvPath = './sample-files/cv.pdf';
  
  console.log('🔍 Starting CV analysis...');
  
  try {
    await checkHealth();
    
    // Use REST API for file upload
    const result = await analyzeWithREST(jobDescPath, cvPath);
    
    console.log('\n📊 Analysis Results:');
    console.log(`Overall Match: ${result.overallMatch}%`);
    console.log(`Strengths: ${result.strengths?.join(', ')}`);
    console.log(`Missing Skills: ${result.missingSkills?.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

// Uncomment to run the example
// main();

export { analyzeWithREST, checkHealth };