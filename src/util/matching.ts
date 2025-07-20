import { eq } from "drizzle-orm";
import { db } from "../db";
import { tblAIResponse } from "../db/schema";

function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i += 1) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j += 1) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

function calculateSimilarity(str1: string, str2: string): number {
  const distance = calculateLevenshteinDistance(
    str1.toLowerCase(),
    str2.toLowerCase()
  );
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}

function normalizeEducationPrompt(prompt: string): string {
  const educationMappings: { [key: string]: string } = {
    // Bachelor degrees
    bca: "bachelor of computer applications",
    "b.ca": "bachelor of computer applications",
    "bachelor in computer applications": "bachelor of computer applications",
    "bachelor of computer applications": "bachelor of computer applications",
    btech: "bachelor of technology",
    "b.tech": "bachelor of technology",
    "bachelor of technology": "bachelor of technology",
    be: "bachelor of engineering",
    "b.e": "bachelor of engineering",
    "bachelor of engineering": "bachelor of engineering",
    bsc: "bachelor of science",
    "b.sc": "bachelor of science",
    "bachelor of science": "bachelor of science",
    ba: "bachelor of arts",
    "b.a": "bachelor of arts",
    "bachelor of arts": "bachelor of arts",
    bcom: "bachelor of commerce",
    "b.com": "bachelor of commerce",
    "bachelor of commerce": "bachelor of commerce",

    // Master degrees
    mca: "master of computer applications",
    "m.ca": "master of computer applications",
    "master in computer applications": "master of computer applications",
    "master of computer applications": "master of computer applications",
    mtech: "master of technology",
    "m.tech": "master of technology",
    "master of technology": "master of technology",
    me: "master of engineering",
    "m.e": "master of engineering",
    "master of engineering": "master of engineering",
    msc: "master of science",
    "m.sc": "master of science",
    "master of science": "master of science",
    ma: "master of arts",
    "m.a": "master of arts",
    "master of arts": "master of arts",
    mba: "master of business administration",
    "m.b.a": "master of business administration",
    "master of business administration": "master of business administration",

    // PhD
    phd: "doctor of philosophy",
    "ph.d": "doctor of philosophy",
    doctorate: "doctor of philosophy",
    "doctor of philosophy": "doctor of philosophy",

    // Diplomas
    diploma: "diploma",
    polytechnic: "diploma",

    // 12th/10th
    "12th": "higher secondary",
    "class 12": "higher secondary",
    intermediate: "higher secondary",
    "higher secondary": "higher secondary",
    "10th": "secondary",
    "class 10": "secondary",
    matriculation: "secondary",
    secondary: "secondary",
  };

  const normalized = prompt.toLowerCase().trim();
  return educationMappings[normalized] || normalized;
}

function normalizeExperiencePrompt(prompt: string, role?: string): string {
  let normalized = prompt.toLowerCase().trim();

  // Add role context if provided
  if (role) {
    normalized = `${role.toLowerCase()} ${normalized}`;
  }

  // Normalize common job titles and terms
  const jobMappings: { [key: string]: string } = {
    "frontend developer": "frontend developer",
    "front-end developer": "frontend developer",
    "front end developer": "frontend developer",
    "backend developer": "backend developer",
    "back-end developer": "backend developer",
    "back end developer": "backend developer",
    "fullstack developer": "fullstack developer",
    "full-stack developer": "fullstack developer",
    "full stack developer": "fullstack developer",
    "software engineer": "software engineer",
    "software developer": "software developer",
    "web developer": "web developer",
    "mobile developer": "mobile developer",
    "devops engineer": "devops engineer",
    "data scientist": "data scientist",
    "ui/ux designer": "ui ux designer",
    "product manager": "product manager",
  };

  // Replace common variations
  for (const [key, value] of Object.entries(jobMappings)) {
    if (normalized.includes(key)) {
      normalized = normalized.replace(key, value);
    }
  }

  return normalized;
}

function normalizePrompt(prompt: string, type: string, role?: string): string {
  switch (type) {
    case "Education":
      return normalizeEducationPrompt(prompt);
    case "Experience":
      return normalizeExperiencePrompt(prompt, role);
    case "Skills":
      return prompt
        .toLowerCase()
        .trim()
        .replace(/[,;]/g, " ")
        .replace(/\s+/g, " ");
    case "Portfolio":
      return prompt.toLowerCase().trim();
    case "Awards":
      return prompt.toLowerCase().trim();
    case "Address":
      return prompt.toLowerCase().trim();
    default:
      return prompt.toLowerCase().trim();
  }
}

// Enhanced similarity function for different types
function calculateTypedSimilarity(
  prompt1: string,
  prompt2: string,
  type: string,
  role1?: string,
  role2?: string
): number {
  const normalized1 = normalizePrompt(prompt1, type, role1);
  const normalized2 = normalizePrompt(prompt2, type, role2);

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Calculate base similarity
  let similarity = calculateSimilarity(normalized1, normalized2);

  // Type-specific similarity boosters
  switch (type) {
    case "Education":
      // Check for degree level compatibility first
      const degreeLevel1 = getDegreeLevel(normalized1);
      const degreeLevel2 = getDegreeLevel(normalized2);

      // If degree levels are different, heavily penalize similarity
      if (
        degreeLevel1 !== degreeLevel2 &&
        degreeLevel1 !== "unknown" &&
        degreeLevel2 !== "unknown"
      ) {
        similarity = similarity * 0.3; // Heavily reduce similarity for different degree levels
      }

      // Check for common education keywords
      const eduKeywords = [
        "bachelor",
        "master",
        "phd",
        "diploma",
        "computer",
        "science",
        "engineering",
        "technology",
        "applications",
      ];
      let commonKeywords = 0;
      let totalKeywords = 0;

      eduKeywords.forEach((keyword) => {
        const inFirst = normalized1.includes(keyword);
        const inSecond = normalized2.includes(keyword);

        if (inFirst || inSecond) {
          totalKeywords++;
          if (inFirst && inSecond) {
            commonKeywords++;
          }
        }
      });

      if (totalKeywords > 0) {
        const keywordSimilarity = commonKeywords / totalKeywords;
        // Only boost if there's reasonable keyword overlap
        if (keywordSimilarity > 0.5) {
          similarity += keywordSimilarity * 0.2;
        }
      }
      break;

    case "Experience":
      // Check for common experience keywords
      const expKeywords = [
        "developer",
        "engineer",
        "manager",
        "senior",
        "junior",
        "lead",
        "years",
        "experience",
      ];
      let commonExpKeywords = 0;

      expKeywords.forEach((keyword) => {
        if (normalized1.includes(keyword) && normalized2.includes(keyword)) {
          commonExpKeywords++;
        }
      });

      if (commonExpKeywords > 0) {
        similarity += (commonExpKeywords / expKeywords.length) * 0.15;
      }
      break;

    case "Skills":
      // For skills, split and compare individual skills
      const skills1 = normalized1.split(/[\s,;]+/).filter((s) => s.length > 2);
      const skills2 = normalized2.split(/[\s,;]+/).filter((s) => s.length > 2);

      let matchingSkills = 0;
      skills1.forEach((skill1) => {
        skills2.forEach((skill2) => {
          if (calculateSimilarity(skill1, skill2) > 0.8) {
            matchingSkills++;
          }
        });
      });

      const skillSimilarity =
        matchingSkills / Math.max(skills1.length, skills2.length);
      similarity = Math.max(similarity, skillSimilarity);
      break;
  }

  return Math.min(similarity, 1.0);
}

// Helper function to determine degree level
function getDegreeLevel(normalizedEducation: string): string {
  if (
    normalizedEducation.includes("bachelor") ||
    normalizedEducation.includes("diploma")
  ) {
    return "undergraduate";
  }
  if (normalizedEducation.includes("master")) {
    return "postgraduate";
  }
  if (
    normalizedEducation.includes("doctor") ||
    normalizedEducation.includes("phd")
  ) {
    return "doctorate";
  }
  if (normalizedEducation.includes("secondary")) {
    return "secondary";
  }
  return "unknown";
}

export async function findSimilarResponse(
  prompt: string,
  type: string,
  role?: string
) {
  try {
    // Get all responses of the same type
    const responses = await db
      .select()
      .from(tblAIResponse)
      .where(eq(tblAIResponse.type, type as any));

    let bestMatch = null;
    let bestSimilarity = 0;
    const SIMILARITY_THRESHOLD = 0.75; // Adjust this threshold as needed

    for (const response of responses) {
      const similarity = calculateTypedSimilarity(
        prompt,
        response.prompt,
        type,
        role,
        response.role
      );

      if (similarity > bestSimilarity && similarity >= SIMILARITY_THRESHOLD) {
        bestSimilarity = similarity;
        bestMatch = {
          ...response,
          similarity: Math.round(similarity * 100),
        };
      }
    }

    return bestMatch;
  } catch (error) {
    console.error("Error finding similar response:", error);
    return null;
  }
}
