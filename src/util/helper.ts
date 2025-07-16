import { eq } from "drizzle-orm";
import { db } from "../db";
import { attribute } from "../db/schema";

interface MatchCalculation {
  qualification: number;
  streamBranch: number;
  industry: number;
  department: number;
  experience: number;
  salary: number;
  location: number;
  noticePeriod: number;
}

export const formatSalaryRange = (min: number, max: number) => {
  const formatAmount = (amount: number) => {
    if (amount >= 10000000) {
      // 1 crore
      return `${(amount / 10000000).toFixed(1)} Cr`;
    } else if (amount >= 100000) {
      // 1 lakh
      return `${(amount / 100000).toFixed(1)} Lac`;
    } else if (amount >= 1000) {
      // 1 thousand
      return `${(amount / 1000).toFixed(1)} K`;
    }
    return amount.toString();
  };

  if (min && max) {
    return `${formatAmount(min)} - ${formatAmount(max)}`;
  } else if (min) {
    return `${formatAmount(min)}+`;
  } else if (max) {
    return `Up to ${formatAmount(max)}`;
  }
  return "Not specified";
};

export const formatExperience = (
  expMin: number,
  expMax: number,
  expFresher: number
): string => {
  if (expFresher === 1) return "Fresher";
  if (expMin === 0 && expMax === 0) return "Not Specified";
  return `${expMin} - ${expMax} years`;
};

// Format location using JavaScript
export const formatLocation = (
  city: string | null,
  state: string | null,
  country: string | null
): string => {
  const parts = [city, state, country].filter(Boolean);
  return parts.join(", ");
};

// Calculate time ago helper
export const getTimeAgo = (postDate: string | null, jobId?: number) => {
  if (!postDate || postDate === "NULL") return "Recently";

  // Parse custom date format: "31-01-2024 06:01:56 PM"
  const parseCustomDate = (dateStr: string): Date => {
    try {
      // Split date and time parts
      const [datePart, timePart, ampm] = dateStr.split(" ");
      const [day, month, year] = datePart.split("-");
      const [hours, minutes, seconds] = timePart.split(":");

      let hour24 = parseInt(hours);

      // Convert to 24-hour format
      if (ampm === "PM" && hour24 !== 12) {
        hour24 += 12;
      } else if (ampm === "AM" && hour24 === 12) {
        hour24 = 0;
      }

      // Create date object (month is 0-indexed in JavaScript)
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        hour24,
        parseInt(minutes),
        parseInt(seconds)
      );
    } catch (error) {
      // Fallback: try standard Date parsing
      return new Date(dateStr);
    }
  };

  const posted = parseCustomDate(postDate);

  // Check if date is valid
  if (isNaN(posted.getTime())) {
    return "Recently";
  }

  const now = new Date();
  const diffTime = now.getTime() - posted.getTime();

  // If the post date is in the future, return "Recently"
  if (diffTime < 0) {
    return "Recently";
  }

  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  // Return appropriate time format
  if (diffMinutes < 60) {
    if (diffMinutes <= 1) return "1m ago";
    return `${diffMinutes}m ago`;
  }

  if (diffHours < 24) {
    if (diffHours === 1) return "1h ago";
    return `${diffHours}h ago`;
  }

  if (diffDays < 7) {
    if (diffDays === 1) return "1d ago";
    return `${diffDays}d ago`;
  }

  if (diffDays < 30) {
    if (diffWeeks === 1) return "1w ago";
    return `${diffWeeks}w ago`;
  }

  if (diffDays < 365) {
    if (diffMonths === 1) return "1mo ago";
    return `${diffMonths}mo ago`;
  }

  if (diffYears === 1) return "1y ago";
  return `${diffYears}y ago`;
};

// Format job type helper
export const getJobTypeLabel = async (
  jobType: number | null,
  locationType: string | null,
  salaryType: number | null
) => {
  console.log(
    `Job Type is ===> ${jobType}, Location Type is ===> ${locationType}, Salary Type is ===> ${salaryType}`
  );

  if (!jobType || !locationType || !salaryType) {
    return {
      jobType: "Not Specified",
      locationType: "Not Specified",
      salaryType: "Not Specified",
    };
  }

  try {
    // Convert locationType to number if it's a string
    const locationTypeId =
      typeof locationType === "string" ? parseInt(locationType) : locationType;

    // Execute all three queries in parallel
    const [jobTypeResult, locationTypeResult, salaryTypeResult] =
      await Promise.all([
        db
          .select({
            name: attribute.name,
          })
          .from(attribute)
          .where(eq(attribute.id, jobType)),

        db
          .select({
            name: attribute.name,
          })
          .from(attribute)
          .where(eq(attribute.id, locationTypeId)),

        db
          .select({
            name: attribute.name,
          })
          .from(attribute)
          .where(eq(attribute.id, salaryType)),
      ]);

    console.log("Job Type Result:", jobTypeResult);
    console.log("Location Type Result:", locationTypeResult);
    console.log("Salary Type Result:", salaryTypeResult);

    return {
      jobType: jobTypeResult[0]?.name || "Not Specified",
      locationType: locationTypeResult[0]?.name || "Not Specified",
      salaryType: salaryTypeResult[0]?.name || "Not Specified",
    };
  } catch (error) {
    console.error("Error fetching job type labels:", error);
    return {
      jobType: "Not Specified",
      locationType: "Not Specified",
      salaryType: "Not Specified",
    };
  }
};

export const getApplicationStatusLabel = (status: number): string => {
  switch (status) {
    case 0:
      return "Pending";
    case 1:
      return "Reviewed";
    case 2:
      return "Shortlisted";
    case 3:
      return "Interview Scheduled";
    case 4:
      return "Hired";
    case 5:
      return "Rejected";
    default:
      return "Unknown";
  }
};

// Helper function to get status color
export const getStatusColor = (status: number): string => {
  switch (status) {
    case 0:
      return "warning"; // Pending - yellow
    case 1:
      return "info"; // Reviewed - blue
    case 2:
      return "primary"; // Shortlisted - blue
    case 3:
      return "info"; // Interview - blue
    case 4:
      return "success"; // Hired - green
    case 5:
      return "danger"; // Rejected - red
    default:
      return "secondary";
  }
};

export function getMatchStatus(percentage: number): string {
  if (percentage >= 80) return "Excellent";
  if (percentage >= 60) return "Good";
  if (percentage >= 40) return "Fair";
  return "Poor";
}

// Helper function to extract years from experience text
export function extractYearsFromExperience(experience: string): number {
  const match = experience.match(/(\d+)\s*(?:years?|yrs?)/i);
  return match ? parseInt(match[1]) : 0;
}

// Helper function to calculate match percentages
export function calculateMatchPercentages(
  job: any,
  user: any
): MatchCalculation {
  const matches: MatchCalculation = {
    qualification: 0,
    streamBranch: 0,
    industry: 0,
    department: 0,
    experience: 0,
    salary: 0,
    location: 0,
    noticePeriod: 0,
  };

  // Qualification match (simplified - you may need to implement proper logic)
  if (job.qualifications && user.education) {
    matches.qualification = 30; // Default partial match
  }

  // Stream/Branch match
  if (job.streamBranch && user.education) {
    const userEducation = user.education?.toLowerCase() || "";
    const jobStreamBranch = job.streamBranch?.toLowerCase() || "";
    if (
      userEducation.includes(jobStreamBranch) ||
      jobStreamBranch.includes(userEducation)
    ) {
      matches.streamBranch = 65;
    } else {
      matches.streamBranch = 30;
    }
  }

  // Industry match
  if (job.industry && user.industryId) {
    if (job.industry === user.industryId) {
      matches.industry = 100;
    } else {
      matches.industry = 30;
    }
  }

  // Department match (using sector)
  if (job.jobSector && user.sectorId) {
    if (job.jobSector === user.sectorId) {
      matches.department = 100;
    } else {
      matches.department = 30;
    }
  }

  // Experience match
  if (job.expMin !== undefined && job.expMax !== undefined && user.experience) {
    const userExp = extractYearsFromExperience(user.experience);
    if (userExp >= job.expMin && userExp <= job.expMax) {
      matches.experience = 100;
    } else if (userExp >= job.expMin - 1 && userExp <= job.expMax + 1) {
      matches.experience = 65;
    } else {
      matches.experience = 30;
    }
  }

  // Salary match (simplified)
  matches.salary = 30; // Default partial match

  // Location match
  if (job.city && user.city) {
    if (job.city === user.city) {
      matches.location = 90;
    } else if (job.state && user.state && job.state === user.state) {
      matches.location = 60;
    } else {
      matches.location = 30;
    }
  }

  // Notice period match
  if (job.immediteJoin === 1) {
    if (
      user.noticePeriod &&
      user.noticePeriod.toLowerCase().includes("immediate")
    ) {
      matches.noticePeriod = 100;
    } else {
      matches.noticePeriod = 50;
    }
  } else {
    matches.noticePeriod = 100; // Default good match if no immediate joining required
  }

  return matches;
}
