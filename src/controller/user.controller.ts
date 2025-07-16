import { NextFunction, Request, Response } from "express";
import { db } from "../db";

import {
  tblUsers,
  tblResume,
  tblJobPost,
  tblCatSector,
  cities,
  states,
  countries,
  tblJobApply,
  tblWishlist,
} from "../db/schema";
import { and, desc, eq, ne, or, SQL, sql } from "drizzle-orm";
import { STATUS_CODES } from "../constants/statusCodes";
import { ErrorHandler } from "../util/errorHandler";
import { ResponseHandler } from "../util/responseHandler";
import { phoneSchema } from "../validations/user.validations";
import { CohereOTPService } from "../util/sms_Service";
import { accessTokenGenerator } from "../util/accessTokenGenerator";
import {
  calculateMatchPercentages,
  extractYearsFromExperience,
  formatSalaryRange,
  getApplicationStatusLabel,
  getJobTypeLabel,
  getMatchStatus,
  getStatusColor,
  getTimeAgo,
} from "../util/helper";

interface RelatedJobsQuery {
  userId?: string;
  page?: string;
  limit?: string;
  jobTypeId?: string;
  salaryRange?: string;
}

export const getOtpForUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { phone } = req.body;

  console.log("Phone Number:", phone);

  // Validate phone number format using Zod
  const result = phoneSchema.safeParse(phone);
  console.log("Validation Result:", result);
  if (!result.success) {
    throw new ErrorHandler({
      message: "Validation failed",
      error: result.error.errors[0].message,
      status: STATUS_CODES.BAD_REQUEST,
      data: { phone },
    });
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Initialize SMS service (choose one based on your setup)
  const smsService = new CohereOTPService();

  // Use transaction to ensure atomicity
  const updatedUser = await db.transaction(async (tx) => {
    const [existingUser] = await tx
      .select()
      .from(tblUsers)
      .where(eq(tblUsers.phone, phone))
      .limit(1);

    // If User Not Exists Then Create
    if (!existingUser) {
      // Generate a unique ID since auto-increment is not used
      const newUserId = Math.floor(Math.random() * 1000000);

      const [insertResult] = await tx.insert(tblUsers).values({
        id: newUserId, // Explicitly provide ID
        username: "User_" + Math.floor(Math.random() * 10000),
        email: "dummy@email.com",
        psw: "dummyPassword",
        phone: phone,
        otp: otp,
        createdDate: new Date().toISOString(),
        state: 0,
        city: 0,
        pincode: 0,
        publicView: 1,
        type: "1",
        everify: "0",
        status: "1",
      });
    } else {
      // Update user OTP
      await tx.update(tblUsers).set({ otp }).where(eq(tblUsers.phone, phone));
    }

    const smsSent = await smsService.sendOTP(phone, otp);

    console.log("SMS sent:==>", smsSent);

    if (!smsSent) {
      throw new ErrorHandler({
        message: "Failed to send OTP",
        error: "SMS service unavailable",
        status: STATUS_CODES.SERVER_ERROR,
        data: { phone },
      });
    }

    return {
      otp,
    };
  });

  // Send success response
  res.status(STATUS_CODES.OK).json(
    new ResponseHandler({
      message: "OTP updated successfully",
      data: {
        otp: updatedUser.otp,
      },
    }).toJSON()
  );
};
export const verifiyOtpForUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { phone, otp } = req.body;

  // Validate phone number format using Zod
  const result = phoneSchema.safeParse(phone);

  if (!result.success) {
    throw new ErrorHandler({
      message: "Validation failed",
      error: result.error.errors[0].message,
      status: STATUS_CODES.BAD_REQUEST,
      data: { phone },
    });
  }

  let userAccessToken;
  // Check if OTP is valid
  await db.transaction(async (tx) => {
    const user = await tx
      .select()
      .from(tblUsers)
      .where(and(eq(tblUsers.phone, phone), eq(tblUsers.otp, otp)));

    if (user.length === 0) {
      throw new ErrorHandler({
        message: "Invalid OTP",
        error: "OTP is not valid",
        status: STATUS_CODES.BAD_REQUEST,
        data: { phone },
      });
    }

    await tx
      .update(tblUsers)
      .set({ otp: null })
      .where(eq(tblUsers.phone, phone));

    userAccessToken = accessTokenGenerator(user[0].id, user[0].email, "User");
  });

  // Send success response
  res.status(STATUS_CODES.OK).json(
    new ResponseHandler({
      data: {
        accessToken: userAccessToken,
      },
      message: "OTP verified successfully",
    }).toJSON()
  );
};

export const getUserRelatedProfileJobsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = "1",
      limit = "10",
      jobTypeId,
      salaryRange,
    }: RelatedJobsQuery = req.query;

    const userId = req.user?.id.toString();

    // Validate required parameters
    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required",
        error: "Missing userId parameter",
        status: STATUS_CODES.BAD_REQUEST,
        data: { userId },
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Get user profile information
    const [user] = await db
      .select({
        id: tblUsers.id,
        sectorId: tblUsers.sectorId,
        industryId: tblUsers.industryId,
        state: tblUsers.state,
        city: tblUsers.city,
        type: tblUsers.type,
      })
      .from(tblUsers)
      .where(eq(tblUsers.id, parseInt(userId)))
      .limit(1);

    if (!user) {
      throw new ErrorHandler({
        message: "User not found",
        error: "Invalid user ID",
        status: STATUS_CODES.NOT_FOUND,
        data: { userId },
      });
    }

    // Get jobs that user has already applied to (to exclude them)
    const appliedJobs = await db
      .select({ jobId: tblJobApply.jobId })
      .from(tblJobApply)
      .where(eq(tblJobApply.candId, parseInt(userId)));

    const appliedJobIds = appliedJobs.map((job) => job.jobId);

    // Build base conditions for the query
    const baseConditions = [
      eq(tblJobPost.status, 1), // Only active jobs
      ne(tblJobPost.eId, parseInt(userId)), // Don't show user's own jobs
    ];

    // Add applied jobs exclusion if any
    if (appliedJobIds.length > 0) {
      baseConditions.push(
        sql`${tblJobPost.id} NOT IN (${appliedJobIds.join(",")})`
      );
    }

    // Add filters based on user profile
    const profileConditions: SQL<unknown>[] = [];

    // Match by sector/industry
    if (user.sectorId) {
      profileConditions.push(eq(tblJobPost.jobSector, user.sectorId));
    }

    if (user.industryId) {
      profileConditions.push(
        eq(tblJobPost.industry, user.industryId.toString())
      );
    }

    // Match by location (prioritize same city, then same state)
    if (user.city) {
      profileConditions.push(eq(tblJobPost.city, user.city));
    } else if (user.state) {
      profileConditions.push(eq(tblJobPost.state, user.state));
    }

    // Add additional filters if provided
    if (jobTypeId) {
      profileConditions.push(eq(tblJobPost.jobType, parseInt(jobTypeId)));
    }

    if (salaryRange) {
      const [minSal, maxSal] = salaryRange.split("-").map((s) => parseInt(s));
      if (minSal && maxSal) {
        profileConditions.push(sql`${tblJobPost.minSalary} >= ${minSal}`);
        profileConditions.push(sql`${tblJobPost.maxSalary} <= ${maxSal}`);
      }
    }

    // Combine all conditions
    const allConditions = [...baseConditions];
    if (profileConditions.length > 0) {
      const orCondition = or(...profileConditions);
      if (orCondition) {
        allConditions.push(orCondition);
      }
    }

    // Build the main query - simplified to match image format
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
        // Join with location data
        cityName: cities.name,
        // Join with company data (employer)
        companyName: tblUsers.username,
        companyProfilePic: tblUsers.profilePic,
      })
      .from(tblJobPost)
      .leftJoin(cities, eq(tblJobPost.city, cities.id))
      .leftJoin(tblUsers, eq(tblJobPost.eId, tblUsers.id)) // Join with employer data
      .where(and(...allConditions));

    // Get total count for pagination
    const totalCountQuery = db
      .select({ count: sql`COUNT(*)` })
      .from(tblJobPost)
      .where(and(...allConditions));

    const [totalResult] = await totalCountQuery;
    const totalJobs = parseInt((totalResult.count as number).toString());

    // Execute the main query with pagination and sorting
    const relatedJobs = await jobQuery
      .orderBy(
        desc(tblJobPost.feature), // Featured jobs first
        desc(tblJobPost.postDate), // Then by post date
        desc(tblJobPost.view) // Then by popularity
      )
      .limit(limitNum)
      .offset(offset);

    // Get application counts for each job
    const jobIds = relatedJobs.map((job) => job.id);
    const applicationCounts = await db
      .select({
        jobId: tblJobApply.jobId,
        count: sql`COUNT(*)`.as("applicationCount"),
      })
      .from(tblJobApply)
      .where(sql`${tblJobApply.jobId} IN (${jobIds.join(",")})`)
      .groupBy(tblJobApply.jobId);

    const applicationCountMap = applicationCounts.reduce((acc, item) => {
      acc[item.jobId] = parseInt((item.count as number).toString());
      return acc;
    }, {} as Record<number, number>);

    // Format salary range helper

    // Format the response to match the image structure
    const formattedJobs = await Promise.all(
      relatedJobs.map(async (job) => {
        const {
          jobType: jobTypeLabel,
          locationType: locationTypeLabel,
          salaryType,
        } = await getJobTypeLabel(
          job.jobType!,
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
          salaryType,
          salary: formatSalaryRange(job.minSalary || 0, job.maxSalary || 0),
          applications: `${applicationCount}+ Application${
            applicationCount !== 1 ? "s" : ""
          }`,
          postedTime: getTimeAgo(job.postDate || ""),
          // eId: job.eId,
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
        message: "Related profile jobs retrieved successfully",
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
          userProfile: {
            sectorId: user.sectorId,
            industryId: user.industryId,
            location: {
              state: user.state,
              city: user.city,
            },
            type: user.type,
          },
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};
export const getJobRecommendationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { limit = "5" }: { limit?: string } = req.query;

    const userId = req.user.id;

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required",
        error: "Missing userId parameter",
        status: STATUS_CODES.BAD_REQUEST,
        data: { userId },
      });
    }

    const limitNum = parseInt(limit);

    // Get user's applied job sectors and industries
    const appliedJobsData = await db
      .select({
        jobSector: tblJobPost.jobSector,
        industry: tblJobPost.industry,
        jobType: tblJobPost.jobType,
      })
      .from(tblJobApply)
      .innerJoin(tblJobPost, eq(tblJobApply.jobId, tblJobPost.id))
      .where(eq(tblJobApply.candId, parseInt(userId.toString())))
      .limit(10); // Get last 10 applied jobs for analysis

    // Extract unique sectors and industries
    const sectors = [...new Set(appliedJobsData.map((job) => job.jobSector))];
    const industries = [...new Set(appliedJobsData.map((job) => job.industry))];
    const jobTypes = [...new Set(appliedJobsData.map((job) => job.jobType))];

    // Get already applied job IDs
    const appliedJobIds = await db
      .select({ jobId: tblJobApply.jobId })
      .from(tblJobApply)
      .where(eq(tblJobApply.candId, parseInt(userId.toString())));

    const appliedIds = appliedJobIds.map((job) => job.jobId);

    // Get recommended jobs based on user's application history
    const recommendedJobs = await db
      .select({
        id: tblJobPost.id,
        jobTitle: tblJobPost.jobTitle,
        jobSector: tblJobPost.jobSector,
        jobType: tblJobPost.jobType,
        minSalary: tblJobPost.minSalary,
        maxSalary: tblJobPost.maxSalary,
        postDate: tblJobPost.postDate,
        cityName: cities.name,
        stateName: states.name,
        sectorName: tblCatSector.name,
      })
      .from(tblJobPost)
      .leftJoin(cities, eq(tblJobPost.city, cities.id))
      .leftJoin(states, eq(tblJobPost.state, states.id))
      .leftJoin(tblCatSector, eq(tblJobPost.jobSector, tblCatSector.id))
      .where(
        and(
          eq(tblJobPost.status, 1),
          ne(tblJobPost.eId, parseInt(userId.toString())),
          appliedIds.length > 0
            ? sql`${tblJobPost.id} NOT IN (${appliedIds.join(",")})`
            : sql`1=1`,
          sql`(${tblJobPost.jobSector} IN (${sectors.join(",")}) OR ${
            tblJobPost.industry
          } IN (${industries.map((i) => `'${i}'`).join(",")}) OR ${
            tblJobPost.jobType
          } IN (${jobTypes.join(",")}))`
        )
      )
      .orderBy(desc(tblJobPost.postDate))
      .limit(limitNum);

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Job recommendations retrieved successfully",
        data: {
          recommendations: recommendedJobs,
          basedOn: {
            sectors,
            industries,
            jobTypes,
          },
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const getUserSavedJobsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { page = "1", limit = "10" } = req.query;
  const userId = req.user?.id; // Assuming userId is passed as a URL parameter

  if (!userId) {
    res.status(STATUS_CODES.BAD_REQUEST).json(
      new ResponseHandler({
        message: "User ID is required",
        data: null,
      }).toJSON()
    );
  }

  const userIdNumber =
    typeof userId === "string" ? parseInt(userId) : (userId as number);

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const offset = (pageNum - 1) * limitNum;

  // Build the main query to get saved jobs
  const savedJobsQuery = db
    .select({
      // Job details
      jobId: tblJobPost.id,
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
      // Location data
      cityName: cities.name,
      // Company data (employer with type = 1)
      companyName: tblUsers.username,
      companyProfilePic: tblUsers.profilePic,
      // Wishlist data
      savedDate: tblWishlist.id, // Using wishlist ID as a reference for saved date
    })
    .from(tblWishlist)
    .innerJoin(tblJobPost, eq(tblWishlist.jobId, tblJobPost.id))
    .leftJoin(cities, eq(tblJobPost.city, cities.id))
    .leftJoin(
      tblUsers,
      and(
        eq(tblJobPost.eId, tblUsers.id),
        eq(tblUsers.type, "2") // Only join users with type = 2
      )
    )
    .where(
      and(
        eq(tblWishlist.loginId, userIdNumber),
        eq(tblJobPost.status, 1) // Only active jobs
      )
    );

  // Get total count for pagination
  const totalCountQuery = db
    .select({ count: sql`COUNT(*)` })
    .from(tblWishlist)
    .innerJoin(tblJobPost, eq(tblWishlist.jobId, tblJobPost.id))
    .leftJoin(
      tblUsers,
      and(eq(tblJobPost.eId, tblUsers.id), eq(tblUsers.type, "2"))
    )
    .where(
      and(eq(tblWishlist.loginId, userIdNumber), eq(tblJobPost.status, 1))
    );

  const [totalResult] = await totalCountQuery;
  const totalSavedJobs = parseInt((totalResult.count as number).toString());

  // Execute the main query with pagination
  const savedJobs = await savedJobsQuery
    .orderBy(desc(tblWishlist.id)) // Most recently saved first
    .limit(limitNum)
    .offset(offset);

  // Get application counts for each job
  const jobIds = savedJobs.map((job) => job.jobId);
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

  // Check if user has applied to any of these jobs
  let userApplications: Array<{ jobId: number }> = [];
  if (jobIds.length > 0) {
    userApplications = await db
      .select({
        jobId: tblJobApply.jobId,
      })
      .from(tblJobApply)
      .where(
        and(
          eq(tblJobApply.candId, userIdNumber),
          sql`${tblJobApply.jobId} IN (${jobIds.join(",")})`
        )
      );
  }

  const userAppliedJobIds = new Set(userApplications.map((app) => app.jobId));

  // Format the response
  const formattedSavedJobs = await Promise.all(
    savedJobs.map(async (job) => {
      const {
        jobType: jobTypeLabel,
        locationType: locationTypeLabel,
        salaryType,
      } = await getJobTypeLabel(job.jobType, job.locationType, job.salaryType);
      const applicationCount = applicationCountMap[job.jobId] || 0;
      const hasApplied = userAppliedJobIds.has(job.jobId);

      return {
        jobId: job.jobId,
        jobTitle: job.jobTitle,
        company: {
          name: job.companyName,
          profilePic: job.companyProfilePic,
        },
        location: job.cityName,
        experience: `${job.expMin}-${job.expMax} Yrs`,
        jobType: jobTypeLabel,
        locationType: locationTypeLabel,
        salaryType,
        salary: formatSalaryRange(job.minSalary || 0, job.maxSalary || 0),
        applications: `${applicationCount}+ Application${
          applicationCount !== 1 ? "s" : ""
        }`,
        postedTime: getTimeAgo(job.postDate || null, job.jobId),
        eId: job.eId,
        isSaved: true, // Always true for saved jobs
        hasApplied: hasApplied,
      };
    })
  );

  // Calculate pagination info
  const totalPages = Math.ceil(totalSavedJobs / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  // Send success response
  res.status(STATUS_CODES.OK).json(
    new ResponseHandler({
      message:
        totalSavedJobs > 0
          ? "Saved jobs retrieved successfully"
          : "No saved jobs found",
      data: {
        savedJobs: formattedSavedJobs,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalJobs: totalSavedJobs,
          hasNextPage,
          hasPrevPage,
          limit: limitNum,
        },
      },
    }).toJSON()
  );
};

export const getUserAppliedJobsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { page = "1", limit = "10", status } = req.query;
  const id = req.user?.id; // Assuming userId is passed as a URL parameter
  const userId = typeof id === "string" ? parseInt(id) : (id as number);
  // Alternative: Get userId from authenticated user
  // const userId = req.user?.id; // If using authentication middleware

  if (!userId) {
    res.status(STATUS_CODES.BAD_REQUEST).json(
      new ResponseHandler({
        message: "User ID is required",
        data: null,
      }).toJSON()
    );
  }

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const offset = (pageNum - 1) * limitNum;

  // Build base conditions for the query
  const baseConditions = [
    eq(tblJobApply.candId, parseInt(userId.toString())),
    eq(tblJobPost.status, 1), // Only active jobs
  ];

  // Add status filter if provided
  if (status) {
    baseConditions.push(
      eq(tblJobApply.applyStatus, parseInt(status as string))
    );
  }

  // Build the main query to get applied jobs
  const appliedJobsQuery = db
    .select({
      // Job details
      jobId: tblJobPost.id,
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
      // Location data
      cityName: cities.name,
      // Company data (employer with type = 2)
      companyName: tblUsers.username,
      companyProfilePic: tblUsers.profilePic,
      // Application data
      applicationId: tblJobApply.id,
      applicationDate: tblJobApply.date,
      applyStatus: tblJobApply.applyStatus,
      jobRole: tblJobApply.jobRole,
      applicationLocation: tblJobApply.location,
    })
    .from(tblJobApply)
    .innerJoin(tblJobPost, eq(tblJobApply.jobId, tblJobPost.id))
    .leftJoin(cities, eq(tblJobPost.city, cities.id))
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
    .from(tblJobApply)
    .innerJoin(tblJobPost, eq(tblJobApply.jobId, tblJobPost.id))
    .leftJoin(
      tblUsers,
      and(eq(tblJobPost.eId, tblUsers.id), eq(tblUsers.type, "2"))
    )
    .where(and(...baseConditions));

  const [totalResult] = await totalCountQuery;
  const totalAppliedJobs = parseInt((totalResult.count as number).toString());

  // Execute the main query with pagination
  const appliedJobs = await appliedJobsQuery
    .orderBy(desc(tblJobApply.id)) // Most recently applied first
    .limit(limitNum)
    .offset(offset);

  // Get application counts for each job
  const jobIds = appliedJobs.map((job) => job.jobId);
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

  // Check if user has saved any of these jobs
  let userSavedJobs: Array<{ jobId: number }> = [];
  if (jobIds.length > 0) {
    userSavedJobs = await db
      .select({
        jobId: tblWishlist.jobId,
      })
      .from(tblWishlist)
      .where(
        and(
          eq(tblWishlist.loginId, parseInt(userId.toString())),
          sql`${tblWishlist.jobId} IN (${jobIds.join(",")})`
        )
      );
  }

  const userSavedJobIds = new Set(userSavedJobs.map((saved) => saved.jobId));

  // Helper function to get application status label

  // Format the response
  const formattedAppliedJobs = await Promise.all(
    appliedJobs.map(async (job) => {
      const {
        jobType: jobTypeLabel,
        locationType: locationTypeLabel,
        salaryType,
      } = await getJobTypeLabel(job.jobType, job.locationType, job.salaryType);
      const applicationCount = applicationCountMap[job.jobId] || 0;
      const isSaved = userSavedJobIds.has(job.jobId);

      return {
        jobId: job.jobId,
        jobTitle: job.jobTitle,
        company: {
          name: job.companyName,
          profilePic: job.companyProfilePic,
        },
        location: job.cityName,
        experience: `${job.expMin}-${job.expMax} Yrs`,
        jobType: jobTypeLabel,
        locationType: locationTypeLabel,
        salaryType,
        salary: formatSalaryRange(job.minSalary || 0, job.maxSalary || 0),
        applications: `${applicationCount}+ Application${
          applicationCount !== 1 ? "s" : ""
        }`,
        postedTime: getTimeAgo(job.postDate || null, job.jobId),
        eId: job.eId,
        isSaved: isSaved,
        hasApplied: true, // Always true for applied jobs
        // Application specific data
        application: {
          id: job.applicationId,
          appliedDate: job.applicationDate,
          statusLabel: getApplicationStatusLabel(job.applyStatus || 0),
          statusColor: getStatusColor(job.applyStatus || 0),
          jobRole: job.jobRole,
          applicationLocation: job.applicationLocation,
        },
      };
    })
  );

  // Get status summary
  const statusSummary = await db
    .select({
      status: tblJobApply.applyStatus,
      count: sql`COUNT(*)`.as("count"),
    })
    .from(tblJobApply)
    .innerJoin(tblJobPost, eq(tblJobApply.jobId, tblJobPost.id))
    .where(
      and(
        eq(tblJobApply.candId, parseInt(userId.toString())),
        eq(tblJobPost.status, 1)
      )
    )
    .groupBy(tblJobApply.applyStatus);

  const statusSummaryFormatted = statusSummary.map((item) => ({
    status: item.status,
    statusLabel: getApplicationStatusLabel(item.status || 0),
    count: parseInt((item.count as number).toString()),
  }));

  // Calculate pagination info
  const totalPages = Math.ceil(totalAppliedJobs / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  // Send success response
  res.status(STATUS_CODES.OK).json(
    new ResponseHandler({
      message:
        totalAppliedJobs > 0
          ? "Applied jobs retrieved successfully"
          : "No applied jobs found",
      data: {
        appliedJobs: formattedAppliedJobs,
        statusSummary: statusSummaryFormatted,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalJobs: totalAppliedJobs,
          hasNextPage,
          hasPrevPage,
          limit: limitNum,
        },
      },
    }).toJSON()
  );
};

// Handler for Step 1: Basic Information
export const updateUserBasicInfoHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id; // Assuming userId is passed as a URL parameter
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { basicInfo } = req.body;

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }
    if (!basicInfo) {
      throw new ErrorHandler({
        message: "Basic info data is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Verify user exists
    const [user] = await db
      .select({ id: tblUsers.id })
      .from(tblUsers)
      .where(eq(tblUsers.id, parsedUserId));
    if (!user) {
      throw new ErrorHandler({
        message: "User not found.",
        status: STATUS_CODES.NOT_FOUND,
      });
    }

    const userProfileData = {
      username: basicInfo.username,
      email: basicInfo.email,
      phone: basicInfo.phone,
      phone2: basicInfo.whatsappNo,
      dob: basicInfo.dob,
      gender: basicInfo.genderId,
    };

    const [updateResult] = await db
      .update(tblUsers)
      .set(userProfileData)
      .where(eq(tblUsers.id, parsedUserId));

    if (updateResult.affectedRows === 0) {
      throw new ErrorHandler({
        message: "Update failed. No data was changed.",
        status: STATUS_CODES.SERVER_ERROR,
      });
    }

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Basic info updated successfully.",
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler for Step 2: Address (Updated to handle custom cities)
export const updateUserAddressHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id; // Assuming userId is passed as a URL parameter
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { address } = req.body;

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }
    if (!address) {
      throw new ErrorHandler({
        message: "Address data is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Verify user exists
    const [user] = await db
      .select({ id: tblUsers.id })
      .from(tblUsers)
      .where(eq(tblUsers.id, parsedUserId));
    if (!user) {
      throw new ErrorHandler({
        message: "User not found.",
        status: STATUS_CODES.NOT_FOUND,
      });
    }

    let userProfileData: any = {
      fullAddress: address.fullAddress,
    };

    // Handle city selection logic
    if (address.cityId && address.cityId !== -1) {
      // Case 1: User selected a city from the database
      userProfileData.city = parseInt(address.cityId);
    } else if (address.customCityName && address.customCityName.trim() !== "") {
      // Case 2: User entered a custom city name
      // First, try to add the city to the database for future use
      try {
        const customCityName = address.customCityName.trim();

        // Check if city already exists (case-insensitive)
        const [existingCity] = await db
          .select({ id: cities.id })
          .from(cities)
          .where(sql`LOWER(${cities.name}) = LOWER(${customCityName})`)
          .limit(1);

        if (existingCity) {
          // City exists, use its ID
          userProfileData.city = existingCity.id;
        } else {
          // Add new city to database
          const newCityId = Math.floor(Math.random() * 1000000);
          const [newCityResult] = await db.insert(cities).values({
            id: newCityId,
            name: customCityName,
            stateId: address.stateId || 0, // Use provided state or default to 0
          });

          userProfileData.city = newCityId;
        }
      } catch (error) {
        // If adding city fails, we could store it as text (but you wanted to avoid this)
        // For now, we'll throw an error
        throw new ErrorHandler({
          message: "Failed to process custom city. Please try again.",
          status: STATUS_CODES.SERVER_ERROR,
        });
      }
    } else {
      throw new ErrorHandler({
        message: "Please select a city or enter a custom city name.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const [updateResult] = await db
      .update(tblUsers)
      .set(userProfileData)
      .where(eq(tblUsers.id, parsedUserId));

    if (updateResult.affectedRows === 0) {
      throw new ErrorHandler({
        message: "Update failed. No data was changed.",
        status: STATUS_CODES.SERVER_ERROR,
      });
    }

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Address updated successfully.",
        data: {
          cityId: userProfileData.city,
          cityType:
            address.cityId && address.cityId !== -1 ? "database" : "custom",
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler for Step 3: Education
export const updateUserEducationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id; // Assuming userId is passed as a URL parameter
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { education } = req.body; // Expecting an array of education objects

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }
    if (!education || !Array.isArray(education)) {
      throw new ErrorHandler({
        message: "Education data must be an array.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // 1. Verify the user exists in the main users table
    const [user] = await db
      .select({ id: tblUsers.id })
      .from(tblUsers)
      .where(eq(tblUsers.id, parsedUserId));
    if (!user) {
      throw new ErrorHandler({
        message: "User not found.",
        status: STATUS_CODES.NOT_FOUND,
      });
    }

    // 2. Convert the education array to a JSON string
    // NOTE: This assumes your database column can store a long text string.
    const educationJsonString = JSON.stringify(education);

    // 3. Check if a resume record already exists for this user
    const [existingResume] = await db
      .select({ candId: tblResume.candId })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    if (existingResume) {
      // 4a. If resume exists, UPDATE it with the new education JSON
      await db
        .update(tblResume)
        .set({ education: educationJsonString }) // Assuming the column is named 'education'
        .where(eq(tblResume.candId, parsedUserId.toString()));
    } else {
      // 4b. If resume does not exist, INSERT a new record
      await db.insert(tblResume).values({
        id: Math.floor(Math.random() * 1000000),
        candId: parsedUserId.toString(),
        education: educationJsonString,
      });
    }

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Education details updated successfully.",
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// A helper function to reduce repetition
const upsertResumeData = async (userId: number, data: Record<string, any>) => {
  const [existingResume] = await db
    .select({ candId: tblResume.candId })
    .from(tblResume)
    .where(eq(tblResume.candId, userId.toString()));

  if (existingResume) {
    await db
      .update(tblResume)
      .set(data)
      .where(eq(tblResume.candId, userId.toString()));
  } else {
    await db.insert(tblResume).values({
      id: Math.floor(Math.random() * 1000000),
      candId: userId.toString(),
      ...data,
    });
  }
};

// Handler for Step 4: Experience
export const updateUserExperienceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id; // Assuming userId is passed as a URL parameter
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { experience } = req.body;

    if (!userId || !experience || !Array.isArray(experience)) {
      throw new ErrorHandler({
        message: "User ID and experience array are required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }
    const parsedUserId = parseInt(userId.toString());

    await upsertResumeData(parsedUserId, {
      experience: JSON.stringify(experience),
    });

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Experience details updated successfully.",
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler for Step 5: Portfolio
export const updateUserPortfolioHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id; // Assuming userId is passed as a URL parameter
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { portfolio } = req.body;

    if (!userId || !portfolio || !Array.isArray(portfolio)) {
      throw new ErrorHandler({
        message: "User ID and portfolio array are required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }
    const parsedUserId = parseInt(userId.toString());

    await upsertResumeData(parsedUserId, {
      portfolio: JSON.stringify(portfolio),
    });

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Portfolio updated successfully.",
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler for Step 5: Honors or Awards
export const updateUserAwardsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id; // Assuming userId is passed as a URL parameter
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { awards } = req.body;

    if (!userId || !awards || !Array.isArray(awards)) {
      throw new ErrorHandler({
        message: "User ID and awards array are required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }
    const parsedUserId = parseInt(userId.toString());

    await upsertResumeData(parsedUserId, { award: JSON.stringify(awards) }); // Note: schema column is 'award'

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Awards updated successfully.",
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler for Step 6: Skills
export const updateUserSkillsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id; // Assuming userId is passed as a URL parameter
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { skills } = req.body;

    if (!userId || !skills) {
      throw new ErrorHandler({
        message: "User ID and skills object are required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }
    const parsedUserId = parseInt(userId.toString());

    // Convert arrays to comma-separated strings for skills that come from API
    // Keep manual fields as simple text
    const skillsData = {
      skills: Array.isArray(skills.jobSkills)
        ? skills.jobSkills.join(",")
        : skills.jobSkills,
      language: Array.isArray(skills.language)
        ? skills.language.join(",")
        : skills.language, // Manual input
      location: Array.isArray(skills.preferredJobLocation)
        ? skills.preferredJobLocation.join(",")
        : skills.preferredJobLocation,
      hobbies: Array.isArray(skills.hobbies)
        ? skills.hobbies.join(",")
        : skills.hobbies, // Manual input
      noticePeriod: skills.noticePeriod, // Manual input
    };

    await upsertResumeData(parsedUserId, skillsData);

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Skills updated successfully.",
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const getUserFavoriteJobsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = "1", limit = "10" } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      res.status(STATUS_CODES.BAD_REQUEST).json(
        new ResponseHandler({
          message: "User ID is required",
          data: null,
        }).toJSON()
      );
      return;
    }

    const userIdNumber =
      typeof userId === "string" ? parseInt(userId) : (userId as number);
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Validate pagination parameters
    if (isNaN(pageNum) || pageNum < 1) {
      res.status(STATUS_CODES.BAD_REQUEST).json(
        new ResponseHandler({
          message: "Invalid page number",
          data: null,
        }).toJSON()
      );
      return;
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(STATUS_CODES.BAD_REQUEST).json(
        new ResponseHandler({
          message: "Invalid limit. Must be between 1 and 100",
          data: null,
        }).toJSON()
      );
      return;
    }

    // Build the main query to get favorite jobs
    const favoriteJobsQuery = db
      .select({
        // Job details
        jobId: tblJobPost.id,
        jobTitle: tblJobPost.jobTitle,
        jobDesc: tblJobPost.jobDesc,
        eId: tblJobPost.eId,
        jobType: tblJobPost.jobType,
        locationType: tblJobPost.locationType,
        salaryType: tblJobPost.salaryType,
        minSalary: tblJobPost.minSalary,
        maxSalary: tblJobPost.maxSalary,
        negotiableSalary: tblJobPost.negotiableSalary,
        expMin: tblJobPost.expMin,
        expMax: tblJobPost.expMax,
        postDate: tblJobPost.postDate,
        applicationDeadline: tblJobPost.applicationDeadline,
        totalVacancies: tblJobPost.totalVacancies,
        jobSector: tblJobPost.jobSector,
        requiredSkills: tblJobPost.requiredSkills,
        feature: tblJobPost.feature,
        // Location data
        cityName: cities.name,
        // Company data (employer with type = "2")
        companyName: tblUsers.username,
        companyProfilePic: tblUsers.profilePic,
        companyOrganization: tblUsers.organization,
        // Wishlist data
        favoriteId: tblWishlist.id,
      })
      .from(tblWishlist)
      .innerJoin(tblJobPost, eq(tblWishlist.jobId, tblJobPost.id))
      .leftJoin(cities, eq(tblJobPost.city, cities.id))
      .leftJoin(
        tblUsers,
        and(
          eq(tblJobPost.eId, tblUsers.id),
          eq(tblUsers.type, "2") // Only join users with type = "2" (employers)
        )
      )
      .where(
        and(
          eq(tblWishlist.loginId, userIdNumber),
          eq(tblJobPost.status, 1) // Only active jobs
        )
      );

    // Get total count for pagination
    const totalCountQuery = db
      .select({ count: sql`COUNT(*)` })
      .from(tblWishlist)
      .innerJoin(tblJobPost, eq(tblWishlist.jobId, tblJobPost.id))
      .leftJoin(
        tblUsers,
        and(eq(tblJobPost.eId, tblUsers.id), eq(tblUsers.type, "2"))
      )
      .where(
        and(eq(tblWishlist.loginId, userIdNumber), eq(tblJobPost.status, 1))
      );

    const [totalResult] = await totalCountQuery;
    const totalFavoriteJobs = parseInt(
      (totalResult.count as number).toString()
    );

    // Execute the main query with pagination
    const favoriteJobs = await favoriteJobsQuery
      .orderBy(desc(tblWishlist.id)) // Most recently added to favorites first
      .limit(limitNum)
      .offset(offset);

    // Get application counts for each job
    const jobIds = favoriteJobs.map((job) => job.jobId);
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

    // Check if user has applied to any of these jobs
    let userApplications: Array<{ jobId: number }> = [];
    if (jobIds.length > 0) {
      userApplications = await db
        .select({
          jobId: tblJobApply.jobId,
        })
        .from(tblJobApply)
        .where(
          and(
            eq(tblJobApply.candId, userIdNumber),
            sql`${tblJobApply.jobId} IN (${jobIds.join(",")})`
          )
        );
    }

    const userAppliedJobIds = new Set(userApplications.map((app) => app.jobId));

    // Format the response
    const formattedFavoriteJobs = await Promise.all(
      favoriteJobs.map(async (job) => {
        const {
          jobType: jobTypeLabel,
          locationType: locationTypeLabel,
          salaryType,
        } = await getJobTypeLabel(
          job.jobType,
          job.locationType,
          job.salaryType
        );

        const applicationCount = applicationCountMap[job.jobId] || 0;
        const hasApplied = userAppliedJobIds.has(job.jobId);

        return {
          jobId: job.jobId,
          favoriteId: job.favoriteId,
          jobTitle: job.jobTitle,
          jobDescription: job.jobDesc,
          company: {
            name: job.companyName,
            profilePic: job.companyProfilePic,
            organization: job.companyOrganization,
          },
          location: job.cityName,
          experience: `${job.expMin}-${job.expMax} Yrs`,
          jobType: jobTypeLabel,
          locationType: locationTypeLabel,
          salaryType,
          salary: formatSalaryRange(job.minSalary || 0, job.maxSalary || 0),
          negotiableSalary: job.negotiableSalary === 1,
          totalVacancies: job.totalVacancies,
          jobSector: job.jobSector,
          requiredSkills: job.requiredSkills,
          applications: `${applicationCount}+ Application${
            applicationCount !== 1 ? "s" : ""
          }`,
          postedTime: getTimeAgo(job.postDate || null, job.jobId),
          applicationDeadline: job.applicationDeadline,
          isFeatured: job.feature === 1,
          eId: job.eId,
          isFavorite: true, // Always true for favorite jobs
          hasApplied: hasApplied,
        };
      })
    );

    // Calculate pagination info
    const totalPages = Math.ceil(totalFavoriteJobs / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Send success response
    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message:
          totalFavoriteJobs > 0
            ? "Favorite jobs retrieved successfully"
            : "No favorite jobs found",
        data: {
          favoriteJobs: formattedFavoriteJobs,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalJobs: totalFavoriteJobs,
            hasNextPage,
            hasPrevPage,
            limit: limitNum,
          },
        },
      }).toJSON()
    );
  } catch (error) {
    console.error("Error in getUserFavoriteJobsHandler:", error);
    res.status(STATUS_CODES.SERVER_ERROR).json(
      new ResponseHandler({
        message: "Internal server error",
        data: null,
      }).toJSON()
    );
  }
};

// Additional controller to add job to favorites
// export const addJobToFavoritesHandler = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { jobId } = req.body;
//     const userId = req.user?.id;

//     if (!userId) {
//       res.status(STATUS_CODES.BAD_REQUEST).json(
//         new ResponseHandler({
//           message: "User ID is required",
//           data: null,
//         }).toJSON()
//       );
//       return;
//     }

//     if (!jobId) {
//       res.status(STATUS_CODES.BAD_REQUEST).json(
//         new ResponseHandler({
//           message: "Job ID is required",
//           data: null,
//         }).toJSON()
//       );
//       return;
//     }

//     const userIdNumber =
//       typeof userId === "string" ? parseInt(userId) : (userId as number);
//     const jobIdNumber =
//       typeof jobId === "string" ? parseInt(jobId) : (jobId as number);

//     // Check if job exists and is active
//     const jobExists = await db
//       .select({ id: tblJobPost.id })
//       .from(tblJobPost)
//       .where(and(eq(tblJobPost.id, jobIdNumber), eq(tblJobPost.status, 1)))
//       .limit(1);

//     if (jobExists.length === 0) {
//       res.status(STATUS_CODES.NOT_FOUND).json(
//         new ResponseHandler({
//           message: "Job not found or inactive",
//           data: null,
//         }).toJSON()
//       );
//       return;
//     }

//     // Check if already in favorites
//     const existingFavorite = await db
//       .select({ id: tblWishlist.id })
//       .from(tblWishlist)
//       .where(
//         and(
//           eq(tblWishlist.loginId, userIdNumber),
//           eq(tblWishlist.jobId, jobIdNumber)
//         )
//       )
//       .limit(1);

//     if (existingFavorite.length > 0) {
//       res.status(STATUS_CODES.CONFLICT).json(
//         new ResponseHandler({
//           message: "Job already in favorites",
//           data: null,
//         }).toJSON()
//       );
//       return;
//     }

//     // Add to favorites
//     await db.insert(tblWishlist).values({
//       id: Math.floor(Math.random() * 1000000),
//       loginId: userIdNumber,
//       jobId: jobIdNumber,
//     });

//     res.status(STATUS_CODES.CREATED).json(
//       new ResponseHandler({
//         message: "Job added to favorites successfully",
//         data: { jobId: jobIdNumber },
//       }).toJSON()
//     );
//   } catch (error) {
//     console.error("Error in addJobToFavoritesHandler:", error);
//     res.status(STATUS_CODES.SERVER_ERROR).json(
//       new ResponseHandler({
//         message: "Internal server error",
//         data: null,
//       }).toJSON()
//     );
//   }
// };

// // Additional controller to remove job from favorites
// export const removeJobFromFavoritesHandler = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { jobId } = req.params;
//     const userId = req.user?.id;

//     if (!userId) {
//       res.status(STATUS_CODES.BAD_REQUEST).json(
//         new ResponseHandler({
//           message: "User ID is required",
//           data: null,
//         }).toJSON()
//       );
//       return;
//     }

//     if (!jobId) {
//       res.status(STATUS_CODES.BAD_REQUEST).json(
//         new ResponseHandler({
//           message: "Job ID is required",
//           data: null,
//         }).toJSON()
//       );
//       return;
//     }

//     const userIdNumber =
//       typeof userId === "string" ? parseInt(userId) : (userId as number);
//     const jobIdNumber =
//       typeof jobId === "string" ? parseInt(jobId) : (jobId as number);

//     // Remove from favorites
//     const result = await db
//       .delete(tblWishlist)
//       .where(
//         and(
//           eq(tblWishlist.loginId, userIdNumber),
//           eq(tblWishlist.jobId, jobIdNumber)
//         )
//       );

//     res.status(STATUS_CODES.OK).json(
//       new ResponseHandler({
//         message: "Job removed from favorites successfully",
//         data: { jobId: jobIdNumber },
//       }).toJSON()
//     );
//   } catch (error) {
//     console.error("Error in removeJobFromFavoritesHandler:", error);
//     res.status(STATUS_CODES.SERVER_ERROR).json(
//       new ResponseHandler({
//         message: "Internal server error",
//         data: null,
//       }).toJSON()
//     );
//   }
// };

export const get_Data_For_Apply_JobHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(STATUS_CODES.BAD_REQUEST).json(
        new ResponseHandler({
          message: "User ID is required",
          data: null,
        }).toJSON()
      );
      return;
    }

    if (!jobId) {
      res.status(STATUS_CODES.BAD_REQUEST).json(
        new ResponseHandler({
          message: "Job ID is required",
          data: null,
        }).toJSON()
      );
      return;
    }

    const userIdNumber =
      typeof userId === "string" ? parseInt(userId) : (userId as number);
    const jobIdNumber =
      typeof jobId === "string" ? parseInt(jobId) : (jobId as number);

    // Check if user has already applied for this job
    const existingApplication = await db
      .select({ id: tblJobApply.id })
      .from(tblJobApply)
      .where(
        and(
          eq(tblJobApply.candId, userIdNumber),
          eq(tblJobApply.jobId, jobIdNumber)
        )
      )
      .limit(1);

    if (existingApplication.length > 0) {
      res.status(STATUS_CODES.CONFLICT).json(
        new ResponseHandler({
          message: "You have already applied for this job",
          data: null,
        }).toJSON()
      );
      return;
    }

    // Get job details with company information
    const jobDetails = await db
      .select({
        // Job details
        jobId: tblJobPost.id,
        jobTitle: tblJobPost.jobTitle,
        jobDesc: tblJobPost.jobDesc,
        eId: tblJobPost.eId,
        jobType: tblJobPost.jobType,
        locationType: tblJobPost.locationType,
        salaryType: tblJobPost.salaryType,
        minSalary: tblJobPost.minSalary,
        maxSalary: tblJobPost.maxSalary,
        negotiableSalary: tblJobPost.negotiableSalary,
        expMin: tblJobPost.expMin,
        expMax: tblJobPost.expMax,
        postDate: tblJobPost.postDate,
        applicationDeadline: tblJobPost.applicationDeadline,
        totalVacancies: tblJobPost.totalVacancies,
        jobSector: tblJobPost.jobSector,
        requiredSkills: tblJobPost.requiredSkills,
        qualifications: tblJobPost.qualifications,
        streamBranch: tblJobPost.streamBranch,
        industry: tblJobPost.industry,
        careerLevel: tblJobPost.careerLevel,
        gender: tblJobPost.gender,
        country: tblJobPost.country,
        state: tblJobPost.state,
        city: tblJobPost.city,
        fullAddress: tblJobPost.fullAddress,
        feature: tblJobPost.feature,
        // Company details
        companyName: tblUsers.username,
        companyProfilePic: tblUsers.profilePic,
        companyOrganization: tblUsers.organization,
        // Location details
        cityName: cities.name,
        stateName: states.name,
        countryName: countries.name,
      })
      .from(tblJobPost)
      .leftJoin(
        tblUsers,
        and(
          eq(tblJobPost.eId, tblUsers.id),
          eq(tblUsers.type, "2") // Employer
        )
      )
      .leftJoin(cities, eq(tblJobPost.city, cities.id))
      .leftJoin(states, eq(tblJobPost.state, states.id))
      .leftJoin(countries, eq(tblJobPost.country, countries.id))
      .where(
        and(
          eq(tblJobPost.id, jobIdNumber),
          eq(tblJobPost.status, 1) // Active job
        )
      )
      .limit(1);

    if (jobDetails.length === 0) {
      res.status(STATUS_CODES.NOT_FOUND).json(
        new ResponseHandler({
          message: "Job not found or inactive",
          data: null,
        }).toJSON()
      );
      return;
    }

    const job = jobDetails[0];

    // Get user profile details
    const userProfile = await db
      .select({
        // User basic info
        username: tblUsers.username,
        email: tblUsers.email,
        phone: tblUsers.phone,
        profilePic: tblUsers.profilePic,
        gender: tblUsers.gender,
        age: tblUsers.age,
        state: tblUsers.state,
        city: tblUsers.city,
        fullAddress: tblUsers.fullAddress,
        industryId: tblUsers.industryId,
        sectorId: tblUsers.sectorId,
        // Location details
        cityName: cities.name,
        stateName: states.name,
        // Resume details
        skills: tblResume.skills,
        location: tblResume.location,
        education: tblResume.education,
        experience: tblResume.experience,
        noticePeriod: tblResume.noticePeriod,
        cv: tblResume.cv,
        coverLetter: tblResume.coverLetter,
      })
      .from(tblUsers)
      .leftJoin(cities, eq(tblUsers.city, cities.id))
      .leftJoin(states, eq(tblUsers.state, states.id))
      .leftJoin(
        tblResume,
        eq(tblUsers.id, sql`CAST(${tblResume.candId} AS UNSIGNED)`)
      )
      .where(eq(tblUsers.id, userIdNumber))
      .limit(1);

    if (userProfile.length === 0) {
      res.status(STATUS_CODES.NOT_FOUND).json(
        new ResponseHandler({
          message: "User profile not found",
          data: null,
        }).toJSON()
      );
      return;
    }

    const user = userProfile[0];

    // Calculate match percentages
    const matchPercentages = calculateMatchPercentages(job, user);

    // Calculate overall match percentage
    const overallMatch = Math.round(
      (matchPercentages.qualification +
        matchPercentages.streamBranch +
        matchPercentages.industry +
        matchPercentages.department +
        matchPercentages.experience +
        matchPercentages.salary +
        matchPercentages.location +
        matchPercentages.noticePeriod) /
        8
    );

    // Format job details for response
    const formattedJobData = {
      jobId: job.jobId,
      jobTitle: job.jobTitle,
      jobDescription: job.jobDesc,
      company: {
        id: job.eId,
        name: job.companyName,
        profilePic: job.companyProfilePic,
        organization: job.companyOrganization,
      },
      location: {
        city: job.cityName,
        state: job.stateName,
        country: job.countryName,
        fullAddress: job.fullAddress,
      },
      requirements: {
        experience: `${job.expMin}-${job.expMax} years`,
        qualifications: job.qualifications,
        streamBranch: job.streamBranch,
        industry: job.industry,
        skills: job.requiredSkills,
        gender: job.gender,
        careerLevel: job.careerLevel,
      },
      salary: {
        min: job.minSalary,
        max: job.maxSalary,
        negotiable: job.negotiableSalary === 1,
        type: job.salaryType,
      },
      details: {
        totalVacancies: job.totalVacancies,
        jobType: job.jobType,
        locationType: job.locationType,
        applicationDeadline: job.applicationDeadline,
        postedDate: job.postDate,
        isFeatured: job.feature === 1,
      },
    };

    // Format user profile for response
    const formattedUserProfile = {
      username: user.username,
      email: user.email,
      phone: user.phone,
      profilePic: user.profilePic,
      gender: user.gender,
      age: user.age,
      location: {
        city: user.cityName,
        state: user.stateName,
        fullAddress: user.fullAddress,
      },
      resume: {
        skills: user.skills,
        education: user.education,
        experience: user.experience,
        noticePeriod: user.noticePeriod,
        cvFile: user.cv,
        coverLetter: user.coverLetter,
      },
      industryId: user.industryId,
      sectorId: user.sectorId,
    };

    // Format matching criteria
    const matchingCriteria = [
      {
        name: "Qualification",
        percentage: matchPercentages.qualification,
        status: getMatchStatus(matchPercentages.qualification),
      },
      {
        name: "Stream Branch",
        percentage: matchPercentages.streamBranch,
        status: getMatchStatus(matchPercentages.streamBranch),
      },
      {
        name: "Industry",
        percentage: matchPercentages.industry,
        status: getMatchStatus(matchPercentages.industry),
      },
      {
        name: "Department",
        percentage: matchPercentages.department,
        status: getMatchStatus(matchPercentages.department),
      },
      {
        name: "Experience",
        percentage: matchPercentages.experience,
        status: getMatchStatus(matchPercentages.experience),
      },
      {
        name: "Salary",
        percentage: matchPercentages.salary,
        status: getMatchStatus(matchPercentages.salary),
      },
      {
        name: "Location",
        percentage: matchPercentages.location,
        status: getMatchStatus(matchPercentages.location),
      },
      {
        name: "Notice Period",
        percentage: matchPercentages.noticePeriod,
        status: getMatchStatus(matchPercentages.noticePeriod),
      },
    ];

    // Send success response
    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Job application data retrieved successfully",
        data: {
          job: formattedJobData,
          userProfile: formattedUserProfile,
          matchingCriteria,
          overallMatch,
          canApply: true,
          hasResume: !!user.cv,
        },
      }).toJSON()
    );
  } catch (error) {
    console.error("Error in get_Data_For_Apply_JobHandler:", error);
    res.status(STATUS_CODES.SERVER_ERROR).json(
      new ResponseHandler({
        message: "Internal server error",
        data: null,
      }).toJSON()
    );
  }
};

export const Apply_JobHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jobId = req.params.jobId;
    const userId = Number(req.user?.id);

    // Validate required parameters
    if (!jobId || !userId) {
      res.status(400).json({
        success: false,
        message: "Job ID and user authentication required",
      });
      return;
    }

    // Convert jobId to number for database operations
    const jobIdNum = parseInt(jobId, 10);
    if (isNaN(jobIdNum)) {
      res.status(400).json({
        success: false,
        message: "Invalid job ID format",
      });
      return;
    }

    // Check if job exists and is active
    const job = await db
      .select({
        id: tblJobPost.id,
        jobTitle: tblJobPost.jobTitle,
        eId: tblJobPost.eId,
        status: tblJobPost.status,
        applicationDeadline: tblJobPost.applicationDeadline,
      })
      .from(tblJobPost)
      .where(eq(tblJobPost.id, jobIdNum))
      .limit(1);

    if (!job || job.length === 0) {
      res.status(404).json({
        success: false,
        message: "Job not found",
      });
      return;
    }

    const jobData = job[0];

    // Check if job is active (status should be 1 based on schema)
    if (jobData.status !== 1) {
      res.status(400).json({
        success: false,
        message: "Job is not available for applications",
      });
      return;
    }

    // Check application deadline if set
    if (jobData.applicationDeadline && jobData.applicationDeadline !== "NULL") {
      const deadlineDate = new Date(jobData.applicationDeadline);
      const currentDate = new Date();

      if (currentDate > deadlineDate) {
        res.status(400).json({
          success: false,
          message: "Application deadline has passed",
        });
        return;
      }
    }

    // Check if user has already applied to this job
    const existingApplication = await db
      .select()
      .from(tblJobApply)
      .where(
        and(eq(tblJobApply.candId, userId), eq(tblJobApply.jobId, jobIdNum))
      )
      .limit(1);

    if (existingApplication && existingApplication.length > 0) {
      res.status(409).json({
        success: false,
        message: "You have already applied to this job",
      });
      return;
    }

    // Get user information for the application
    const user = await db
      .select({
        id: tblUsers.id,
        username: tblUsers.username,
        email: tblUsers.email,
        city: tblUsers.city,
        state: tblUsers.state,
      })
      .from(tblUsers)
      .where(eq(tblUsers.id, userId))
      .limit(1);

    if (!user || user.length === 0) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const userData = user[0];

    // Create the job application
    const currentDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    const lastApplication = await db
      .select({ id: tblJobApply.id })
      .from(tblJobApply)
      .orderBy(tblJobApply.id)
      .limit(1);

    const nextId = lastApplication.length > 0 ? lastApplication[0].id + 1 : 1;

    const applicationData = {
      id: nextId,
      candId: userId,
      jobId: jobIdNum,
      eId: jobData.eId?.toString() || "0",
      jobRole: jobData.jobTitle || null,
      location: `${userData.city},${userData.state}` || null,
      status: "0", // Default status for new applications
      applyStatus: 0, // Default apply status
      date: currentDate,
    };

    // Insert the application
    const result = await db.insert(tblJobApply).values(applicationData);

    if (!result) {
      res.status(500).json({
        success: false,
        message: "Failed to create job application",
      });
      return;
    }

    // Send success response
    res.status(201).json({
      success: true,
      message: "Job application submitted successfully",
    });
  } catch (error) {
    console.error("Error in Apply_JobHandler:", error);

    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes("Duplicate entry")) {
        res.status(409).json({
          success: false,
          message: "Application already exists",
        });
        return;
      }

      if (error.message.includes("foreign key constraint")) {
        res.status(400).json({
          success: false,
          message: "Invalid job or user reference",
        });
        return;
      }
    }

    // Pass to error handling middleware
    next(error);
  }
};
