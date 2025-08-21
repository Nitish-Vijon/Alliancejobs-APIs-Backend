import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { config } from "../lib/config";

dotenv.config(); // Load environment variables from .env

const API_KEY = config.gemini_api_key;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY is not set in your .env file.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function runGemini(
  prompt: string,
  type: string,
  role?: string
): Promise<string> {
  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // For text-only input, use the gemini-1.5-flash model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Create context-aware prompts based on type
    let contextualPrompt = "";

    switch (type) {
      case "Address":
        contextualPrompt = `Write a professional address description or cover note for: ${prompt}. Keep it concise and professional`;
        break;
      case "Education":
        contextualPrompt = `Write a professional education description for: ${prompt}. Include relevant achievements and skills gained.Don't give me Answer in Option just write the 1 to 3 lines of Paragraph.`;
        break;
      case "Experience":
        contextualPrompt = `Write a professional work experience description for the role "${role}" with focus on: ${prompt}. Highlight responsibilities, achievements, and skills used.`;
        break;
        break;
      case "Portfolio":
        contextualPrompt = `Write an engaging portfolio project description for: ${prompt}. Highlight key features, technologies used, and impact.`;
        break;
      case "Awards":
        contextualPrompt = `Write a professional award or honor description for: ${prompt}. Include the significance and achievement details.`;
        break;
      case "Skills":
        contextualPrompt = `Write a professional skills description or summary for: ${prompt}. Focus on proficiency levels and practical applications.`;
        break;
      default:
        contextualPrompt = `Write a professional description for: ${prompt}`;
    }

    const result = await model.generateContent(contextualPrompt);
    const response = await result.response;
    const text = response.text();

    console.log(
      `Generated ${type} content for prompt: "${prompt.substring(0, 50)}..."`
    );

    return text;
  } catch (error) {
    console.error("An error occurred in runGemini:", error);
    throw new Error("Failed to generate AI content");
  }
}
