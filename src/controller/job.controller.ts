import { NextFunction, Request, Response } from "express";
import { db } from "../db";
import {
  tblUsers,
  tblJobPost,
  cities,
  tblJobApply,
  states,
  countries,
  attribute,
} from "../db/schema";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  SQL,
  sql,
} from "drizzle-orm";
import { STATUS_CODES } from "../constants/statusCodes";
import { ResponseHandler } from "../util/responseHandler";
import {
  formatExperience,
  formatLocation,
  formatSalaryRange,
  getJobTypeLabel,
  getTimeAgo,
} from "../util/helper";
import { ErrorHandler } from "../util/errorHandler";
export const getRecentJobsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = "1", limit = "10" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build base conditions for the query
    const baseConditions = [
      eq(tblJobPost.status, 1), // Only active jobs
    ];

    // if (location) {
    //   baseConditions.push(eq(tblJobPost.city, parseInt(location as string)));
    // }

    // if (experience) {
    //   const [minExp, maxExp] = (experience as string)
    //     .split("-")
    //     .map((s) => parseInt(s));
    //   if (minExp && maxExp) {
    //     baseConditions.push(sql`${tblJobPost.expMin} >= ${minExp}`);
    //     baseConditions.push(sql`${tblJobPost.expMax} <= ${maxExp}`);
    //   }
    // }

    // Build the main query
    const jobQuery = db
      .select({
        id: tblJobPost.id,
        jobTitle: tblJobPost.jobTitle,
        eId: tblJobPost.eId,
        jobType: tblJobPost.jobType,
        locationType: tblJobPost.locationType,
        salaryType: tblJobPost.salaryType,
        minSalary: tblJobPost.minSalary,
        maxSalary: tblJobPost.maxSalary,
        expMin: tblJobPost.expMin,
        expMax: tblJobPost.expMax,
        postDate: tblJobPost.postDate,
        feature: tblJobPost.feature,
        // Join with location data
        cityName: cities.name,
        // Join with company data (employer)
        companyName: tblUsers.username,
        companyProfilePic: tblUsers.profilePic,
      })
      .from(tblJobPost)
      .leftJoin(cities, eq(tblJobPost.city, cities.id))
      .leftJoin(
        tblUsers,
        and(
          eq(tblJobPost.eId, tblUsers.id),
          eq(tblUsers.type, "2") // Only join users with type = 2
        )
      ) // Join with employer data
      .where(and(...baseConditions));

    // Get total count for pagination
    const totalCountQuery = db
      .select({ count: sql`COUNT(*)` })
      .from(tblJobPost)
      .where(and(...baseConditions));

    const [totalResult] = await totalCountQuery;
    const totalJobs = parseInt((totalResult.count as number).toString());

    // Execute the main query with pagination and sorting by recent posts
    const recentJobs = await jobQuery
      .orderBy(
        sql`STR_TO_DATE(${tblJobPost.postDate}, '%d-%m-%Y %h:%i:%s %p') DESC` // Most recent first
        // desc(tblJobPost.feature), // Then featured jobs
        // desc(tblJobPost.view) // Then by popularity
      )
      .limit(limitNum)
      .offset(offset);

    // Get application counts for each job
    const jobIds = recentJobs.map((job) => job.id);
    let applicationCounts: Array<{ jobId: number; count: unknown }> = [];

    if (jobIds.length > 0) {
      applicationCounts = await db
        .select({
          jobId: tblJobApply.jobId,
          count: sql`COUNT(*)`.as("applicationCount"),
        })
        .from(tblJobApply)
        .where(sql`${tblJobApply.jobId} IN (${jobIds.join(",")})`)
        .groupBy(tblJobApply.jobId);
    }

    const applicationCountMap = applicationCounts.reduce((acc, item) => {
      acc[item.jobId] = parseInt((item.count as number).toString());
      return acc;
    }, {} as Record<number, number>);

    // Format the response to match the required structure
    const formattedJobs = await Promise.all(
      recentJobs.map(async (job) => {
        const {
          jobType: jobTypeLabel,
          locationType: locationTypeLabel,
          salaryType: salaryTypeLabel,
        } = await getJobTypeLabel(
          job.jobType || 0,
          job.locationType,
          job.salaryType
        );
        const applicationCount = applicationCountMap[job.id] || 0;

        return {
          jobId: job.id,
          jobTitle: job.jobTitle,
          company: {
            name: job.companyName,
            profilePic: job.companyProfilePic,
          },
          location: job.cityName,
          experience: `${job.expMin}-${job.expMax} Yrs`,
          jobType: jobTypeLabel,
          locationType: locationTypeLabel,
          salaryType: salaryTypeLabel,
          salary: formatSalaryRange(job.minSalary || 0, job.maxSalary || 0),
          applications: `${applicationCount}+ Application${
            applicationCount !== 1 ? "s" : ""
          }`,
          postedTime: getTimeAgo(job.postDate || null, job.id),
          eId: job.eId,
        };
      })
    );
    // Calculate pagination info
    const totalPages = Math.ceil(totalJobs / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Send success response
    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Recent jobs retrieved successfully",
        data: {
          jobs: formattedJobs,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalJobs,
            hasNextPage,
            hasPrevPage,
            limit: limitNum,
          },
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};
export const getJobsBySearchHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = "1",
      limit = "10",
      keyword = "",
      location = "",
      experience = "",
      jobType = "",
      salaryMin = "",
      salaryMax = "",
      sector = "",
      industry = "",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build base conditions for the query
    const baseConditions = [
      eq(tblJobPost.status, 1), // Only active jobs
    ];

    // Keyword search - search in job title and description
    if (keyword && keyword.toString().trim()) {
      const searchKeyword = keyword.toString().trim();
      if (searchKeyword) {
        // Build an array of conditions and filter out any undefined ones
        const keywordConditions = [
          like(tblJobPost.jobTitle, `%${searchKeyword}%`),
          tblJobPost.jobDesc
            ? like(tblJobPost.jobDesc, `%${searchKeyword}%`)
            : undefined,
          tblJobPost.requiredSkills
            ? like(tblJobPost.requiredSkills, `%${searchKeyword}%`)
            : undefined,
        ].filter(Boolean) as SQL[];

        // Only add the OR condition if we have valid conditions
        if (keywordConditions.length > 0) {
          baseConditions.push(or(...keywordConditions)!);
        }
      }
    }

    // Location filter
    if (location && location.toString().trim()) {
      const locationId = parseInt(location as string);
      if (!isNaN(locationId)) {
        baseConditions.push(eq(tblJobPost.city, locationId));
      }
    }

    // Experience filter
    if (experience && experience.toString().trim()) {
      const expValue = experience.toString();

      // Handle different experience formats
      if (expValue === "fresher" || expValue === "0") {
        baseConditions.push(eq(tblJobPost.expFresher, 1));
      } else if (expValue.includes("-")) {
        const [minExp, maxExp] = expValue
          .split("-")
          .map((s) => parseInt(s.trim()));
        if (!isNaN(minExp) && !isNaN(maxExp)) {
          const minExpCondition = lte(tblJobPost.expMin, maxExp);
          const maxExpCondition = gte(tblJobPost.expMax, minExp);

          // Then combine them with and()
          const combinedCondition = and(minExpCondition, maxExpCondition);
          if (combinedCondition) {
            baseConditions.push(combinedCondition);
          }
        }
      } else {
        // Single experience value
        const expNum = parseInt(expValue);
        if (!isNaN(expNum)) {
          const minExpCondition = lte(tblJobPost.expMin, expNum);
          const maxExpCondition = gte(tblJobPost.expMax, expNum);

          // Then combine them with and()
          const combinedCondition = and(minExpCondition, maxExpCondition);
          if (combinedCondition) {
            baseConditions.push(combinedCondition);
          }
        }
      }
    }

    // Job type filter
    if (jobType && jobType.toString().trim()) {
      const jobTypeId = parseInt(jobType as string);
      if (!isNaN(jobTypeId)) {
        baseConditions.push(eq(tblJobPost.jobType, jobTypeId));
      }
    }

    // Salary range filter
    if (salaryMin && salaryMin.toString().trim()) {
      const minSalary = parseInt(salaryMin as string);
      if (!isNaN(minSalary)) {
        baseConditions.push(sql`${tblJobPost.maxSalary} >= ${minSalary}`);
      }
    }

    if (salaryMax && salaryMax.toString().trim()) {
      const maxSalary = parseInt(salaryMax as string);
      if (!isNaN(maxSalary)) {
        baseConditions.push(sql`${tblJobPost.minSalary} <= ${maxSalary}`);
      }
    }

    // Sector filter
    if (sector && sector.toString().trim()) {
      baseConditions.push(eq(tblJobPost.jobSector, sector as string));
    }

    // Industry filter
    if (industry && industry.toString().trim()) {
      baseConditions.push(eq(tblJobPost.industry, industry as string));
    }

    // Build the main query
    const jobQuery = db
      .select({
        id: tblJobPost.id,
        jobTitle: tblJobPost.jobTitle,
        jobDesc: tblJobPost.jobDesc,
        eId: tblJobPost.eId,
        jobType: tblJobPost.jobType,
        locationType: tblJobPost.locationType,
        salaryType: tblJobPost.salaryType,
        minSalary: tblJobPost.minSalary,
        maxSalary: tblJobPost.maxSalary,
        expMin: tblJobPost.expMin,
        expMax: tblJobPost.expMax,
        expFresher: tblJobPost.expFresher,
        postDate: tblJobPost.postDate,
        feature: tblJobPost.feature,
        view: tblJobPost.view,
        jobSector: tblJobPost.jobSector,
        industry: tblJobPost.industry,
        requiredSkills: tblJobPost.requiredSkills,
        applicationDeadline: tblJobPost.applicationDeadline,
        // Join with location data
        cityName: cities.name,
        stateName: states.name,
        // Join with company data (employer)
        companyName: tblUsers.username,
        companyProfilePic: tblUsers.profilePic,
        companyOrganization: tblUsers.organization,
      })
      .from(tblJobPost)
      .leftJoin(cities, eq(tblJobPost.city, cities.id))
      .leftJoin(states, eq(tblJobPost.state, states.id))
      .leftJoin(
        tblUsers,
        and(
          eq(tblJobPost.eId, tblUsers.id),
          eq(tblUsers.type, "2") // Only join users with type = 2
        )
      )
      .where(and(...baseConditions));

    // Get total count for pagination
    const totalCountQuery = db
      .select({ count: sql`COUNT(*)` })
      .from(tblJobPost)
      .leftJoin(cities, eq(tblJobPost.city, cities.id))
      .leftJoin(states, eq(tblJobPost.state, states.id))
      .leftJoin(tblUsers, eq(tblJobPost.eId, tblUsers.id))
      .where(and(...baseConditions));

    const [totalResult] = await totalCountQuery;
    const totalJobs = parseInt((totalResult.count as number).toString());

    // Execute the main query with pagination and sorting
    const searchResults = await jobQuery
      .orderBy(
        desc(tblJobPost.feature), // Featured jobs first
        sql`STR_TO_DATE(${tblJobPost.postDate}, '%d-%m-%Y %h:%i:%s %p') DESC`, // Most recent first
        desc(tblJobPost.view) // Then by popularity
      )
      .limit(limitNum)
      .offset(offset);

    // Get application counts for each job
    const jobIds = searchResults.map((job) => job.id);
    let applicationCounts: Array<{ jobId: number; count: unknown }> = [];

    if (jobIds.length > 0) {
      applicationCounts = await db
        .select({
          jobId: tblJobApply.jobId,
          count: sql`COUNT(*)`.as("applicationCount"),
        })
        .from(tblJobApply)
        .where(inArray(tblJobApply.jobId, jobIds))
        .groupBy(tblJobApply.jobId);
    }

    const applicationCountMap = applicationCounts.reduce((acc, item) => {
      acc[item.jobId] = parseInt((item.count as number).toString());
      return acc;
    }, {} as Record<number, number>);

    // Format the response to match the required structure
    const formattedJobs = await Promise.all(
      searchResults.map(async (job) => {
        const {
          jobType: jobTypeLabel,
          locationType: locationTypeLabel,
          salaryType,
        } = await getJobTypeLabel(
          job.jobType || 0,
          job.locationType,
          job.salaryType
        );
        const applicationCount = applicationCountMap[job.id] || 0;

        return {
          jobId: job.id,
          jobTitle: job.jobTitle,
          jobDescription: job.jobDesc
            ? job.jobDesc.substring(0, 200) + "..."
            : "",
          company: {
            name: job.companyName || job.companyOrganization,
            profilePic: job.companyProfilePic,
          },
          location:
            job.cityName && job.stateName
              ? `${job.cityName}, ${job.stateName}`
              : job.cityName || job.stateName,

          experience:
            job.expFresher === 1
              ? "Fresher"
              : `${job.expMin}-${job.expMax} Yrs`,
          jobType: jobTypeLabel,
          locationType: locationTypeLabel,
          salaryType: job.salaryType,
          salary: formatSalaryRange(job.minSalary || 0, job.maxSalary || 0),
          sector: job.jobSector,
          industry: job.industry,
          skills: job.requiredSkills,
          applications: `${applicationCount}+ Application${
            applicationCount !== 1 ? "s" : ""
          }`,
          postedTime: getTimeAgo(job.postDate || null, job.id),
          applicationDeadline: job.applicationDeadline,
          views: job.view || 0,
        };
      })
    );

    // Calculate pagination info
    const totalPages = Math.ceil(totalJobs / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Prepare search summary
    const searchSummary = {
      keyword: keyword || null,
      location: location || null,
      experience: experience || null,
      jobType: jobType || null,
      salaryRange:
        salaryMin || salaryMax
          ? {
              min: salaryMin || null,
              max: salaryMax || null,
            }
          : null,
      sector: sector || null,
      industry: industry || null,
      totalResults: totalJobs,
    };

    // Send success response
    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message:
          totalJobs > 0
            ? `Found ${totalJobs} job${
                totalJobs !== 1 ? "s" : ""
              } matching your search criteria`
            : "No jobs found matching your search criteria",
        data: {
          jobs: formattedJobs,
          searchSummary,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalJobs,
            hasNextPage,
            hasPrevPage,
            limit: limitNum,
          },
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const getJobDetailsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      throw new ErrorHandler({
        message: "Job ID is required",
        error: "Missing jobId parameter",
        status: STATUS_CODES.BAD_REQUEST,
        data: { jobId },
      });
    }

    // Get job details with company info and location data
    const jobDetails = await db
      .select({
        // Job basic info
        jobId: tblJobPost.id,
        postDate: tblJobPost.postDate,
        jobName: tblJobPost.jobTitle,
        jobDetails: tblJobPost.jobDesc,

        // Salary info
        minSalary: tblJobPost.minSalary,
        maxSalary: tblJobPost.maxSalary,
        salaryType: tblJobPost.salaryType,
        negotiableSalary: tblJobPost.negotiableSalary,

        // Job type and location
        jobType: tblJobPost.jobType,
        locationType: tblJobPost.locationType,

        // Experience and openings
        expMin: tblJobPost.expMin,
        expMax: tblJobPost.expMax,
        expFresher: tblJobPost.expFresher,
        openings: tblJobPost.totalVacancies,

        // Location details
        cityName: cities.name,
        stateName: states.name,
        countryName: countries.name,

        // Skills
        skills: tblJobPost.requiredSkills,

        // Company details
        companyName: tblUsers.username,
        aboutCompany: tblUsers.canDesc,
        image: tblUsers.profilePic,

        // Additional useful info
        applicationDeadline: tblJobPost.applicationDeadline,
        fullAddress: tblJobPost.fullAddress,
        industry: tblJobPost.industry,
        careerLevel: tblJobPost.careerLevel,
        qualifications: tblJobPost.qualifications,
        otherBenefits: tblJobPost.otherBenfits,
        interviewMode: tblJobPost.interviewMode,
        immediateJoin: tblJobPost.immediteJoin,
      })
      .from(tblJobPost)
      .leftJoin(
        tblUsers,
        and(
          eq(tblJobPost.eId, tblUsers.id),
          eq(tblUsers.type, "2") // Only join users with type = 2
        )
      )
      .leftJoin(cities, eq(tblJobPost.city, cities.id))
      .leftJoin(states, eq(tblJobPost.state, states.id))
      .leftJoin(countries, eq(tblJobPost.country, countries.id))
      .where(eq(tblJobPost.id, parseInt(jobId)));

    if (jobDetails.length === 0) {
      throw new ErrorHandler({
        message: "Job not found",
        error: "Job not found",
        status: STATUS_CODES.NOT_FOUND,
        data: { jobId },
      });
    }

    const job = jobDetails[0];

    // Format experience using JavaScript

    const jobType = await db.query.attribute.findFirst({
      where: eq(attribute.id, job.jobType),
      columns: {
        name: true,
      },
    });
    const locationType = await db.query.attribute.findFirst({
      where: eq(attribute.id, Number(job.locationType)),
      columns: {
        name: true,
      },
    });

    console.log("Job Type: ", jobType);

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Job details retrieved successfully",
        data: {
          image: job.image,
          postDate: job.postDate,
          jobName: job.jobName,
          companyName: job.companyName,
          salary: formatSalaryRange(job.minSalary || 0, job.maxSalary || 0),
          jobType: jobType.name,
          locationType: locationType.name,
          jobDetails: job.jobDetails,
          aboutCompany: job.aboutCompany,
          exp: formatExperience(job.expMin, job.expMax, job.expFresher),
          openings: job.openings,
          locations: formatLocation(
            job.cityName,
            job.stateName,
            job.countryName
          ),
          skills: job.skills,
          // Additional fields that might be useful
          applicationDeadline: job.applicationDeadline,
          fullAddress: job.fullAddress,
          industry: job.industry,
          careerLevel: job.careerLevel,
          qualifications: job.qualifications,
          otherBenefits: job.otherBenefits,
          interviewMode: job.interviewMode,
          immediateJoin: job.immediateJoin,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const getJobsByFiltersHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = "1",
      limit = "10",
      locationId = "",
      experience = "",
      jobTitle = "",
      jobType = "",
      salaryMin = "",
      salaryMax = "",
      salaryType = "",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build base conditions for the query
    const baseConditions = [
      eq(tblJobPost.status, 1), // Only active jobs
    ];

    // Location filter
    if (locationId && locationId.toString().trim()) {
      const location_Id = parseInt(locationId as string);
      if (!isNaN(location_Id)) {
        baseConditions.push(eq(tblJobPost.city, location_Id));
      }
    }

    // Experience filter
    if (experience && experience.toString().trim()) {
      const expValue = experience.toString();

      // Handle different experience formats
      if (expValue === "fresher" || expValue === "0") {
        baseConditions.push(eq(tblJobPost.expFresher, 1));
      } else if (expValue.includes("-")) {
        const [minExp, maxExp] = expValue
          .split("-")
          .map((s) => parseInt(s.trim()));
        if (!isNaN(minExp) && !isNaN(maxExp)) {
          const minExpCondition = lte(tblJobPost.expMin, maxExp);
          const maxExpCondition = gte(tblJobPost.expMax, minExp);

          // Then combine them with and()
          const combinedCondition = and(minExpCondition, maxExpCondition);
          if (combinedCondition) {
            baseConditions.push(combinedCondition);
          }
        }
      } else {
        // Single experience value
        const expNum = parseInt(expValue);
        if (!isNaN(expNum)) {
          const minExpCondition = lte(tblJobPost.expMin, expNum);
          const maxExpCondition = gte(tblJobPost.expMax, expNum);

          // Then combine them with and()
          const combinedCondition = and(minExpCondition, maxExpCondition);
          if (combinedCondition) {
            baseConditions.push(combinedCondition);
          }
        }
      }
    }

    // Job type filter
    if (jobType && jobType.toString().trim()) {
      const jobTypeId = parseInt(jobType as string);
      if (!isNaN(jobTypeId)) {
        baseConditions.push(eq(tblJobPost.jobType, jobTypeId));
      }
    }

    // Salary range filter
    if (salaryMin && salaryMin.toString().trim()) {
      const minSalary = parseInt(salaryMin as string);
      if (!isNaN(minSalary)) {
        baseConditions.push(sql`${tblJobPost.maxSalary} >= ${minSalary}`);
      }
    }

    if (salaryMax && salaryMax.toString().trim()) {
      const maxSalary = parseInt(salaryMax as string);
      if (!isNaN(maxSalary)) {
        baseConditions.push(sql`${tblJobPost.minSalary} <= ${maxSalary}`);
      }
    }

    //Salary type filter
    if (salaryType && salaryType.toString().trim()) {
      const salaryTypeId = parseInt(salaryType as string);
      if (!isNaN(salaryTypeId)) {
        baseConditions.push(eq(tblJobPost.salaryType, salaryTypeId));
      }
    }

    // Job title filter
    if (jobTitle && jobTitle.toString().trim()) {
      baseConditions.push(
        sql`${tblJobPost.jobTitle} LIKE ${`%${jobTitle}%` as any}`
      );
    }

    // Build the main query
    const jobQuery = db
      .select({
        id: tblJobPost.id,
        jobTitle: tblJobPost.jobTitle,
        jobDesc: tblJobPost.jobDesc,
        eId: tblJobPost.eId,
        jobType: tblJobPost.jobType,
        locationType: tblJobPost.locationType,
        salaryType: tblJobPost.salaryType,
        minSalary: tblJobPost.minSalary,
        maxSalary: tblJobPost.maxSalary,
        expMin: tblJobPost.expMin,
        expMax: tblJobPost.expMax,
        expFresher: tblJobPost.expFresher,
        postDate: tblJobPost.postDate,
        feature: tblJobPost.feature,
        view: tblJobPost.view,
        jobSector: tblJobPost.jobSector,
        industry: tblJobPost.industry,
        requiredSkills: tblJobPost.requiredSkills,
        applicationDeadline: tblJobPost.applicationDeadline,
        // Join with location data
        cityName: cities.name,
        stateName: states.name,
        // Join with company data (employer)
        companyName: tblUsers.username,
        companyProfilePic: tblUsers.profilePic,
        companyOrganization: tblUsers.organization,
      })
      .from(tblJobPost)
      .leftJoin(cities, eq(tblJobPost.city, cities.id))
      .leftJoin(states, eq(tblJobPost.state, states.id))
      .leftJoin(
        tblUsers,
        and(
          eq(tblJobPost.eId, tblUsers.id),
          eq(tblUsers.type, "2") // Only join users with type = 2
        )
      )
      .where(and(...baseConditions));

    // Get total count for pagination
    const totalCountQuery = db
      .select({ count: sql`COUNT(*)` })
      .from(tblJobPost)
      .leftJoin(cities, eq(tblJobPost.city, cities.id))
      .leftJoin(states, eq(tblJobPost.state, states.id))
      .leftJoin(tblUsers, eq(tblJobPost.eId, tblUsers.id))
      .where(and(...baseConditions));

    const [totalResult] = await totalCountQuery;
    const totalJobs = parseInt((totalResult.count as number).toString());

    // Execute the main query with pagination and sorting
    const searchResults = await jobQuery
      .orderBy(
        desc(tblJobPost.feature), // Featured jobs first
        sql`STR_TO_DATE(${tblJobPost.postDate}, '%d-%m-%Y %h:%i:%s %p') DESC`, // Most recent first
        desc(tblJobPost.view) // Then by popularity
      )
      .limit(limitNum)
      .offset(offset);

    // Get application counts for each job
    const jobIds = searchResults.map((job) => job.id);
    let applicationCounts: Array<{ jobId: number; count: unknown }> = [];

    if (jobIds.length > 0) {
      applicationCounts = await db
        .select({
          jobId: tblJobApply.jobId,
          count: sql`COUNT(*)`.as("applicationCount"),
        })
        .from(tblJobApply)
        .where(inArray(tblJobApply.jobId, jobIds))
        .groupBy(tblJobApply.jobId);
    }

    const applicationCountMap = applicationCounts.reduce((acc, item) => {
      acc[item.jobId] = parseInt((item.count as number).toString());
      return acc;
    }, {} as Record<number, number>);

    // Format the response to match the required structure
    const formattedJobs = await Promise.all(
      searchResults.map(async (job) => {
        const {
          jobType: jobTypeLabel,
          locationType: locationTypeLabel,
          salaryType,
        } = await getJobTypeLabel(
          job.jobType || 0,
          job.locationType,
          job.salaryType
        );
        const applicationCount = applicationCountMap[job.id] || 0;

        return {
          jobId: job.id,
          jobTitle: job.jobTitle,
          jobDescription: job.jobDesc
            ? job.jobDesc.substring(0, 200) + "..."
            : "",
          company: {
            name: job.companyName || job.companyOrganization,
            profilePic: job.companyProfilePic,
          },
          location:
            job.cityName && job.stateName
              ? `${job.cityName}, ${job.stateName}`
              : job.cityName || job.stateName,

          experience:
            job.expFresher === 1
              ? "Fresher"
              : `${job.expMin}-${job.expMax} Yrs`,
          jobType: jobTypeLabel,
          locationType: locationTypeLabel,
          salaryType: job.salaryType,
          salary: formatSalaryRange(job.minSalary || 0, job.maxSalary || 0),
          sector: job.jobSector,
          industry: job.industry,
          skills: job.requiredSkills,
          applications: `${applicationCount}+ Application${
            applicationCount !== 1 ? "s" : ""
          }`,
          postedTime: getTimeAgo(job.postDate || null, job.id),
          applicationDeadline: job.applicationDeadline,
          views: job.view || 0,
        };
      })
    );

    // Calculate pagination info
    const totalPages = Math.ceil(totalJobs / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Prepare search summary
    const searchSummary = {
      locationId: locationId || null,
      experience: experience || null,
      jobType: jobType || null,
      salaryRange:
        salaryMin || salaryMax
          ? {
              min: salaryMin || null,
              max: salaryMax || null,
            }
          : null,
      totalResults: totalJobs,
    };

    // Send success response
    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message:
          totalJobs > 0
            ? `Found ${totalJobs} job${
                totalJobs !== 1 ? "s" : ""
              } matching your search criteria`
            : "No jobs found matching your search criteria",
        data: {
          jobs: formattedJobs,
          searchSummary,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalJobs,
            hasNextPage,
            hasPrevPage,
            limit: limitNum,
          },
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};
