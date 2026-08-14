import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

const envContent = fs.readFileSync(path.resolve('.env'), 'utf-8');
const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : '';

async function testSDK() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      systemInstruction: 'You are C2 Control Tower AI. Be concise.',
    });

    const result = await model.generateContent('Explain in one line how C2 Control Tower optimizes supply chain operations.');
    const response = await result.response;
    console.log('--- SDK GENERATION SUCCESS ---');
    console.log('Gemini Output:', response.text().trim());
  } catch (err: any) {
    console.error('SDK Generation Error:', err);
  }
}

testSDK();
