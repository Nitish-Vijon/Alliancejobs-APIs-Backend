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

interface GeminiInput {
  type: string;
  prompt: string;
  role?: string;
  company?: string;
  experienceYears?: number;
  department?: string;
  industry?: string;
  jobType?: string;
  salary?: number;
}

export async function runGemini(input: GeminiInput): Promise<string> {
  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let contextualPrompt = "";

    if (input.type === "Experience") {
      contextualPrompt = `
Write a professional and concise description (100-150 words) for the role "${
        input.role
      }" at "${input.company}"${
        input.department ? ` in the ${input.department} department` : ""
      }${input.industry ? ` (${input.industry} industry)` : ""}.
${input.jobType ? `Position type: ${input.jobType}.` : ""}
${
  input.experienceYears
    ? `Experience level: ${input.experienceYears} years.`
    : ""
}
${input.salary ? `Salary range: ${input.salary}.` : ""}

Create a compelling professional description that highlights key responsibilities, achievements, and impact in this role.
Write in natural, flowing sentences without using bullets or lists. 
Focus on measurable results, leadership, technical skills, and business impact.
Keep it simple, clear, and professional for a CV/resume format.
`;
    } else {
      // Other types use simple prompt
      switch (input.type) {
        case "Address":
          contextualPrompt = `Write a professional address description for: ${input.prompt}. Keep it concise and professional.`;
          break;
        case "Education":
          contextualPrompt = `Write a professional education description for: ${input.prompt}. Include relevant achievements and skills gained.`;
          break;
        case "Portfolio":
          contextualPrompt = `Write an engaging portfolio project description for: ${input.prompt}. Highlight key features, technologies used, and impact.`;
          break;
        case "Awards":
          contextualPrompt = `Write a professional award or honor description for: ${input.prompt}. Include significance and achievement details.`;
          break;
        case "Skills":
          contextualPrompt = `Write a professional skills description or summary for: ${input.prompt}. Focus on proficiency levels and practical applications.`;
          break;
        default:
          contextualPrompt = `Write a professional description for: ${input.prompt}`;
      }
    }

    const result = await model.generateContent(contextualPrompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("An error occurred in runGemini:", error);
    throw new Error("Failed to generate AI content");
  }
}
