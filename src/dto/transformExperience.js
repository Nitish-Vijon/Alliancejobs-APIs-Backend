// Example lookup tables for IDs to names
const industryMap = {
  18: "Job Type",
  // Add more industry IDs
};

const sectorMap = {
  102: "Project management",
  // Add more sector IDs
};

const jobTypeMap = {
  5: "Full time",
  // Add more job type IDs
};

const careerLevelMap = {
  25: "Mid Level",
  // Add more levels
};

const salaryTypeMap = {
  15: "Monthly",
  // Add more salary type IDs
};

export function transformExperience(data) {
  return {
    company: data.Company || "",
    designation: data.Designation || "",
    industry: industryMap[data.industry] || data.industry,
    sector: sectorMap[data.sector] || data.sector,
    jobType: jobTypeMap[data.job_type] || data.job_type,
    careerLevel: careerLevelMap[data.Career_Level] || data.Career_Level,
    salaryType: salaryTypeMap[data.Salary_Type] || data.Salary_Type,
    salary: data.Salary || "",
    role: data.Role || "",
    startDate: data.Start_Date || "",
    endDate:
      data.End_Date === "Present" ? "Not specified" : data.End_Date || "",
    isPresent: data.End_Date === "Present",
  };
}

export function normalizeExperience(exp) {
  return {
    company: exp.Company || exp.company || "",
    designation: exp.Designation || exp.designation || "",
    startDate: exp.Start_Date || exp.startDate || "",
    endDate:
      exp.End_Date === "Present"
        ? "Not specified"
        : exp.End_Date || exp.endDate || "",
  };
}
