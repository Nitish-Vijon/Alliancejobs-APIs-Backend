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
  attribute,
} from "../db/schema";
import { and, count, desc, eq, inArray, ne, or, SQL, sql } from "drizzle-orm";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  STATUS_CODES,
} from "../constants/statusCodes";
import { ErrorHandler } from "../util/errorHandler";
import { ResponseHandler } from "../util/responseHandler";
import { phoneSchema } from "../validations/user.validations";
import { sendOTP } from "../util/sms_Service";
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
import path from "path";
import fs from "fs";
import { promisify } from "util";
import { validateFileType } from "../middleware/multer.middleware";
import { getImageUrl } from "../util/getimageurl";
import { generateUniqueId } from "../util/generateTableId";

const unlinkAsync = promisify(fs.unlink);

interface RelatedJobsQuery {
  userId?: string;
  page?: string;
  limit?: string;
  jobTypeId?: string;
  salaryRange?: string;
}

interface UserStats {
  profileCompletion: {
    percentage: number;
    completedFields: number;
    totalFields: number;
    missingFields: string[];
  };
  resumeStatus: {
    uploaded: boolean;
    completeness: number;
    sections: {
      coverLetter: boolean;
      skills: boolean;
      education: boolean;
      experience: boolean;
      portfolio: boolean;
      language: boolean;
      award: boolean;
    };
  };
  accountInfo: {
    accountAge: number; // in days
    lastLogin: string | null;
    emailVerified: boolean;
    profileViews: number;
    accountType: string;
  };
  completionTasks: {
    profilePicture: boolean;
    phoneNumber: boolean;
    location: boolean;
    socialLinks: boolean;
    aboutDescription: boolean;
  };
}

interface AttributeData {
  id: number;
  name: string | null;
  parentId: string | null;
  icon: string | null;
}

// Education entry interface
interface EducationEntry {
  Education?: string;
  EducationInfo?: AttributeData | null;
  Stream?: string;
  StreamInfo?: AttributeData | null;
  Start_Date?: string;
  End_Date?: string;
  Institute?: string;
  [key: string]: any; // For any additional fields
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  phone?: string;
  phone2?: string;
  profilePic?: string;
  coverImage?: string;
  website?: string;
  foundedDate?: string;
  organization?: string;
  canDesc?: string;
  gender?: string;
  genderInfo?: AttributeData | null; // Add gender attribute data
  dob?: string;
  age?: number;
  socialMedia: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    dribbble?: string;
  };
  location: {
    state: number;
    city: number;
    pincode: number;
    fullAddress?: string;
    stateInfo?: any;
    cityInfo?: any;
    countryInfo?: any;
  };
  settings: {
    publicView: number;
    everify: string;
    status: string;
    totalView: string;
  };
  utm: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
  };
  sectorInfo?: any;
  createdDate: string;
}

interface ResumeData {
  id?: number;
  coverLetter?: string;
  skills?: string;
  skillsInfo?: AttributeData[]; // Add skills attribute data array
  location?: string;
  locationInfo?: AttributeData[]; // Add location attribute data array
  hobbies?: string;
  cv?: string;
  education?: EducationEntry[] | string; // Can be parsed array or original string
  experience?: any[] | string; // Can be parsed array or original string
  portfolio?: any[] | string; // Can be parsed array or original string
  language?: any[] | string; // Can be parsed array or original string
  noticePeriod?: string;
  award?: string;
}

interface CompleteUserData {
  profile: UserProfile;
  resume: ResumeData | null;
}

export const getOtpForUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { phone } = req.body;
  let { servertype } = req.query;

  if (!phone) {
    throw new ErrorHandler({
      message: "Phone number is required.",
      status: STATUS_CODES.BAD_REQUEST,
    });
  }
  if (!["PROD", "DEV"].includes(servertype.toString())) {
    throw new ErrorHandler({
      message: "Invalid server type.Supported types: PROD, DEV",
      status: STATUS_CODES.BAD_REQUEST,
    });
  } else if (!servertype) {
    servertype = "PROD";
  }

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

  // Generate OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  // Initialize SMS service (choose one based on your setup)

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
      const nextId = await generateUniqueId(tblUsers);

      await tx.insert(tblUsers).values({
        id: nextId, // Explicitly provide ID
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

    if (servertype === "PROD") {
      const smsSent = await sendOTP(phone, otp);

      if (!smsSent) {
        throw new ErrorHandler({
          message: "Failed to send OTP",
          error: "SMS service unavailable",
          status: STATUS_CODES.SERVER_ERROR,
          data: { phone },
        });
      }
    }

    return {
      otp,
    };
  });

  // Send success response
  res.status(STATUS_CODES.OK).json(
    new ResponseHandler({
      message:
        servertype === "DEV"
          ? updatedUser.otp
          : "OTP sent successfully to " + phone,
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
        eq(tblUsers.type, "1") // Only join users with type = 2
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
      and(eq(tblJobPost.eId, tblUsers.id), eq(tblUsers.type, ""))
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
  const userId = req.user?.id;

  if (!userId) {
    res.status(STATUS_CODES.BAD_REQUEST).json(
      new ResponseHandler({
        message: "User ID is required",
        data: null,
      }).toJSON()
    );
    return; // Add return to prevent further execution
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

  try {
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
        // Company data (employer with type = 1) - Fixed the type check
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
          eq(tblUsers.type, "1") // This should match your database - type is '1' as string
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
        and(
          eq(tblJobPost.eId, tblUsers.id),
          eq(tblUsers.type, "1") // Fixed: should be string "1"
        )
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

    // Format the response
    const formattedAppliedJobs = await Promise.all(
      appliedJobs.map(async (job) => {
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
  } catch (error) {
    console.error("Error in getUserAppliedJobsHandler:", error);
    res.status(STATUS_CODES.SERVER_ERROR).json(
      new ResponseHandler({
        message: "An error occurred while fetching applied jobs",
        data: null,
      }).toJSON()
    );
  }
};

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
        data: {
          basicInfo: basicInfo,
        },
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
          eq(tblUsers.type, "1") // Only join users with type = "2" (employers)
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
        and(eq(tblJobPost.eId, tblUsers.id), eq(tblUsers.type, "1"))
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
          eq(tblUsers.type, "1") // Employer
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
        // data: { applicationId: existingApplication[0], userId },
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

    // const nextId = userData.id + Math.random() * 100;

    const nextId = await generateUniqueId(tblJobApply);

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

export const uploadResumeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = Number(req.user?.id);
    const file = req.file;

    // Validate user authentication
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User authentication required",
      });
      return;
    }

    // Validate file upload
    if (!file) {
      res.status(400).json({
        success: false,
        message: "No resume file uploaded",
      });
      return;
    }

    // Validate file type (extension and MIME type)
    if (!validateFileType(file)) {
      // Delete the uploaded file if invalid
      await unlinkAsync(file.path);
      res.status(400).json({
        success: false,
        message: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(
          ", "
        )}`,
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      // Delete the uploaded file if too large
      await unlinkAsync(file.path);
      res.status(400).json({
        success: false,
        message: `File too large. Maximum size: ${
          MAX_FILE_SIZE / (1024 * 1024)
        }MB`,
      });
      return;
    }

    // Verify user exists
    const user = await db
      .select({ id: tblUsers.id, username: tblUsers.username })
      .from(tblUsers)
      .where(eq(tblUsers.id, userId))
      .limit(1);

    if (!user || user.length === 0) {
      // Delete the uploaded file if user doesn't exist
      await unlinkAsync(file.path);
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Check if user already has a resume record
    const existingResume = await db
      .select()
      .from(tblResume)
      .where(eq(tblResume.candId, userId.toString()))
      .limit(1);

    // Generate file path relative to your uploads directory
    const relativePath = file.path.replace(/\\/g, "/"); // Convert backslashes to forward slashes
    const fileName = file.filename;
    const originalName = file.originalname;

    if (existingResume && existingResume.length > 0) {
      // Update existing resume record
      const oldResume = existingResume[0];

      // Delete old resume file if it exists
      if (oldResume.cv && oldResume.cv !== "NULL") {
        try {
          const oldFilePath = path.join(process.cwd(), "uploads", oldResume.cv);
          if (fs.existsSync(oldFilePath)) {
            await unlinkAsync(oldFilePath);
          }
        } catch (error) {
          console.warn("Could not delete old resume file:", error);
        }
      }

      // Update the resume record
      await db
        .update(tblResume)
        .set({
          cv: fileName, // Store only filename, not full path
          // You can add other fields here if needed from req.body
        })
        .where(eq(tblResume.candId, userId.toString()));

      res.status(200).json({
        success: true,
        message: "Resume updated successfully",
        data: {
          fileName: fileName,
          originalName: originalName,
          filePath: relativePath,
          fileSize: file.size,
          uploadDate: new Date().toISOString(),
        },
      });
    } else {
      // Create new resume record
      const nextId = await generateUniqueId(tblResume);
      const resumeData = {
        id: nextId,
        candId: userId.toString(),
        cv: fileName,
        coverLetter: null,
        skills: null,
        location: null,
        hobbies: null,
        education: null,
        experience: null,
        portfolio: null,
        language: null,
        noticePeriod: null,
        award: null,
      };

      await db.insert(tblResume).values(resumeData);

      res.status(201).json({
        success: true,
        message: "Resume uploaded successfully",
        data: {
          fileName: fileName,
          originalName: originalName,
          filePath: relativePath,
          fileSize: file.size,
          uploadDate: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    console.error("Error in uploadResumeHandler:", error);

    // Clean up uploaded file on error
    if (req.file) {
      try {
        await unlinkAsync(req.file.path);
      } catch (unlinkError) {
        console.warn("Could not delete uploaded file on error:", unlinkError);
      }
    }

    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes("foreign key constraint")) {
        res.status(400).json({
          success: false,
          message: "Invalid user reference",
        });
        return;
      }
    }

    next(error);
  }
};

export const getUserResumeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User authentication required",
      });
      return;
    }

    const resume = await db
      .select()
      .from(tblResume)
      .where(eq(tblResume.candId, userId.toString()))
      .limit(1);

    if (!resume || resume.length === 0) {
      res.status(404).json({
        success: false,
        message: "Resume not found",
      });
      return;
    }

    const resumeData = resume[0];

    // Check if resume file exists
    let fileExists = false;
    let filePath = "";

    if (resumeData.cv && resumeData.cv !== "NULL") {
      filePath = path.join(process.cwd(), "uploads", resumeData.cv);
      fileExists = fs.existsSync(filePath);
    }

    res.status(200).json({
      success: true,
      message: "Resume retrieved successfully",
      data: {
        ...resumeData,
        fileExists,
        imageUrl: getImageUrl(resumeData.cv) || "",
      },
    });
  } catch (error) {
    console.error("Error in getUserResumeHandler:", error);
    next(error);
  }
};

// Helper function to download resume
export const downloadResumeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { filename } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User authentication required",
      });
      return;
    }

    // Verify the file belongs to the user
    const resume = await db
      .select()
      .from(tblResume)
      .where(eq(tblResume.candId, userId.toString()))
      .limit(1);

    if (!resume || resume.length === 0 || resume[0].cv !== filename) {
      res.status(404).json({
        success: false,
        message: "Resume not found or access denied",
      });
      return;
    }

    const filePath = path.join(process.cwd(), "uploads", filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        message: "Resume file not found",
      });
      return;
    }

    // Set appropriate headers for download
    const fileExtension = path.extname(filename).toLowerCase();
    let contentType = "application/octet-stream";

    switch (fileExtension) {
      case ".pdf":
        contentType = "application/pdf";
        break;
      case ".doc":
        contentType = "application/msword";
        break;
      case ".docx":
        contentType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        break;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error in downloadResumeHandler:", error);
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
        data: {
          education: education,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};
// Handler to get user education
export const getUserEducationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get user's resume data
    const [resume] = await db
      .select({ education: tblResume.education })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let educationData = [];

    if (resume && resume.education) {
      try {
        educationData = JSON.parse(resume.education);
      } catch (error) {
        console.error("Error parsing education JSON:", error);
        educationData = [];
      }
    }

    // Get all unique IDs from education data that need to be converted
    const allIds = new Set<number>();
    educationData.forEach((edu: any) => {
      // Check Education field
      if (edu.Education && !isNaN(parseInt(edu.Education))) {
        allIds.add(parseInt(edu.Education));
      }
      // Check Stream field
      if (edu.Stream && !isNaN(parseInt(edu.Stream))) {
        allIds.add(parseInt(edu.Stream));
      }
      // Check Institute field (in case it's also an ID)
      if (edu.Institute && !isNaN(parseInt(edu.Institute))) {
        allIds.add(parseInt(edu.Institute));
      }
      // Check Institute_Name field (in case it's also an ID)
      if (edu.Institute_Name && !isNaN(parseInt(edu.Institute_Name))) {
        allIds.add(parseInt(edu.Institute_Name));
      }
    });

    // Get ALL attributes from the table for comprehensive mapping
    let attributeMap: Record<number, string> = {};
    if (allIds.size > 0) {
      const attributes = await db
        .select({
          id: attribute.id,
          name: attribute.name,
        })
        .from(attribute);

      attributeMap = attributes.reduce((acc, attr) => {
        acc[attr.id] = attr.name || "Unknown";
        return acc;
      }, {} as Record<number, string>);
    }

    // Helper function to convert ID to name with better fallback
    const getAttributeName = (value: string | number): string => {
      if (!value) return "";

      // If it's already a string and not a number, return as is
      if (typeof value === "string" && isNaN(parseInt(value))) {
        return value;
      }

      const numId = typeof value === "string" ? parseInt(value) : value;
      if (isNaN(numId)) return value.toString();

      // Return the mapped name or the original value if no mapping found
      return attributeMap[numId] || value.toString();
    };

    // Format the education data for response - keeping only existing fields
    const formattedEducation = educationData.map((edu: any, index: number) => ({
      id: index, // Using index as ID for frontend reference
      isCompleted: edu.isCompleted !== undefined ? edu.isCompleted : true,
      originalData: {
        // Convert IDs to names in originalData
        Education: getAttributeName(edu.Education),
        Stream: getAttributeName(edu.Stream),
        Start_Date: edu.Start_Date,
        End_Date: edu.End_Date,
        Institute: getAttributeName(edu.Institute),
        Institute_Name: getAttributeName(edu.Institute_Name),
        // Keep any other fields as they are
        ...Object.keys(edu).reduce((acc, key) => {
          if (
            ![
              "Education",
              "Stream",
              "Start_Date",
              "End_Date",
              "Institute",
              "Institute_Name",
            ].includes(key)
          ) {
            acc[key] = getAttributeName(edu[key]);
          }
          return acc;
        }, {} as any),
      },
    }));

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message:
          educationData.length > 0
            ? "Education details retrieved successfully."
            : "No education details found.",
        data: {
          education: formattedEducation,
          totalRecords: formattedEducation.length,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler to delete user education by index
export const deleteUserEducationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { educationData } = req.body; // Send the complete education object to delete

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    if (!educationData) {
      throw new ErrorHandler({
        message: "Education data is required to identify the entry to delete.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get current education data
    const [resume] = await db
      .select({ education: tblResume.education })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let currentEducation = [];

    if (resume && resume.education) {
      try {
        currentEducation = JSON.parse(resume.education);
      } catch (error) {
        throw new ErrorHandler({
          message: "Error parsing existing education data.",
          status: STATUS_CODES.SERVER_ERROR,
        });
      }
    }

    if (currentEducation.length === 0) {
      throw new ErrorHandler({
        message: "No education entries found to delete.",
        status: STATUS_CODES.NOT_FOUND,
      });
    }

    // Find and remove the education entry based on multiple criteria
    const initialLength = currentEducation.length;

    // Method 1: Find by exact match of key fields (updated field names)
    currentEducation = currentEducation.filter((edu: any) => {
      const matches =
        edu.Education === educationData.Education &&
        edu.Institute === educationData.Institute &&
        edu.Start_Date === educationData.Start_Date &&
        edu.End_Date === educationData.End_Date;

      return !matches; // Keep entries that don't match
    });

    // If no exact match found, try partial matching with Education and Institute
    if (currentEducation.length === initialLength) {
      currentEducation = currentEducation.filter((edu: any) => {
        const partialMatch =
          edu.Education === educationData.Education &&
          edu.Institute === educationData.Institute;

        return !partialMatch; // Keep entries that don't match
      });
    }

    // If still no match, try matching with Education and Stream (fallback)
    if (currentEducation.length === initialLength) {
      currentEducation = currentEducation.filter((edu: any) => {
        const streamMatch =
          edu.Education === educationData.Education &&
          edu.Stream === educationData.Stream;

        return !streamMatch; // Keep entries that don't match
      });
    }

    // Check if any entry was actually deleted
    if (currentEducation.length === initialLength) {
      throw new ErrorHandler({
        message:
          "Education entry not found or could not be identified for deletion. Please ensure the education data matches exactly.",
        status: STATUS_CODES.NOT_FOUND,
        data: {
          searchedFor: educationData,
          availableEducations: currentEducation.map((edu: any) => ({
            Education: edu.Education,
            Institute: edu.Institute,
            Start_Date: edu.Start_Date,
            End_Date: edu.End_Date,
          })),
        },
      });
    }

    // Update in database
    await upsertResumeData(parsedUserId, {
      education: JSON.stringify(currentEducation),
    });

    const deletedCount = initialLength - currentEducation.length;

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: `Education entry deleted successfully. ${deletedCount} entry(ies) removed.`,
        data: {
          deletedCount,
          remainingEducationCount: currentEducation.length,
          deletedEducationData: educationData,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler to add new education entry
export const addUserEducationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { educationData } = req.body;

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    if (!educationData) {
      throw new ErrorHandler({
        message: "Education data is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get current education data
    const [resume] = await db
      .select({ education: tblResume.education })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let currentEducation = [];

    if (resume && resume.education) {
      try {
        currentEducation = JSON.parse(resume.education);
      } catch (error) {
        currentEducation = [];
      }
    }

    // Add new education entry
    const newEducation = {
      ...educationData,
    };

    currentEducation.push(newEducation);

    // Update in database
    await upsertResumeData(parsedUserId, {
      education: JSON.stringify(currentEducation),
    });

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Education entry added successfully.",
        data: {
          newEducation,
          educationIndex: currentEducation.length - 1,
          totalEducationCount: currentEducation.length,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
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
        data: {
          experience: experience,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler to get user experience
export const getUserExperienceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get user's resume data
    const [resume] = await db
      .select({ experience: tblResume.experience })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let experienceData = [];

    if (resume && resume.experience) {
      try {
        experienceData = JSON.parse(resume.experience);
        // Handle nested array structure if it exists
        if (
          Array.isArray(experienceData) &&
          experienceData.length > 0 &&
          Array.isArray(experienceData[0])
        ) {
          experienceData = experienceData[0]; // Extract from nested array
        }
      } catch (error) {
        console.error("Error parsing experience JSON:", error);
        experienceData = [];
      }
    }

    // Get all unique IDs from experience data that need to be converted
    const allIds = new Set<number>();
    experienceData.forEach((exp: any) => {
      // Check industry field
      if (exp.industry && !isNaN(parseInt(exp.industry))) {
        allIds.add(parseInt(exp.industry));
      }
      // Check sector field
      if (exp.sector && !isNaN(parseInt(exp.sector))) {
        allIds.add(parseInt(exp.sector));
      }
      // Check job_type field
      if (exp.job_type && !isNaN(parseInt(exp.job_type))) {
        allIds.add(parseInt(exp.job_type));
      }
      // Check Career_Level field
      if (exp.Career_Level && !isNaN(parseInt(exp.Career_Level))) {
        allIds.add(parseInt(exp.Career_Level));
      }
      // Check Salary_Type field
      if (exp.Salary_Type && !isNaN(parseInt(exp.Salary_Type))) {
        allIds.add(parseInt(exp.Salary_Type));
      }
    });

    // Get ALL attributes from the table for comprehensive mapping
    let attributeMap: Record<number, string> = {};
    if (allIds.size > 0) {
      const attributes = await db
        .select({
          id: attribute.id,
          name: attribute.name,
        })
        .from(attribute);

      attributeMap = attributes.reduce((acc, attr) => {
        acc[attr.id] = attr.name || "Unknown";
        return acc;
      }, {} as Record<number, string>);
    }

    // Helper function to convert ID to name with better fallback
    const getAttributeName = (value: string | number): string => {
      if (!value) return "";

      // If it's already a string and not a number, return as is
      if (typeof value === "string" && isNaN(parseInt(value))) {
        return value;
      }

      const numId = typeof value === "string" ? parseInt(value) : value;
      if (isNaN(numId)) return value.toString();

      // Return the mapped name or the original value if no mapping found
      return attributeMap[numId] || value.toString();
    };

    // Format the experience data for response - keeping only existing fields
    const formattedExperience = experienceData.map(
      (exp: any, index: number) => ({
        id: index, // Using index as ID for frontend reference
        originalData: {
          // Convert IDs to names in originalData
          industry: getAttributeName(exp.industry),
          sector: getAttributeName(exp.sector),
          Company: exp.Company || "Not specified",
          Designation: exp.Designation || "Not specified",
          job_type: getAttributeName(exp.job_type),
          Career_Level: getAttributeName(exp.Career_Level),
          Start_Date: exp.Start_Date || "Not specified",
          End_Date: exp.End_Date || "Not specified",
          Experience: exp.Experience || "Not specified",
          Salary_Type: getAttributeName(exp.Salary_Type),
          Salary: exp.Salary || "Not specified",
          Role: exp.Role || "Not specified",
          // Keep any other fields as they are
          ...Object.keys(exp).reduce((acc, key) => {
            if (
              ![
                "industry",
                "sector",
                "Company",
                "Designation",
                "job_type",
                "Career_Level",
                "Start_Date",
                "End_Date",
                "Experience",
                "Salary_Type",
                "Salary",
                "Role",
              ].includes(key)
            ) {
              acc[key] = getAttributeName(exp[key]);
            }
            return acc;
          }, {} as any),
        },
      })
    );

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message:
          experienceData.length > 0
            ? "Experience details retrieved successfully."
            : "No experience details found.",
        data: {
          experience: formattedExperience,
          totalRecords: formattedExperience.length,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler to add new experience entry
export const addUserExperienceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { experienceData } = req.body;

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    if (!experienceData) {
      throw new ErrorHandler({
        message: "Experience data is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get current experience data
    const [resume] = await db
      .select({ experience: tblResume.experience })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let currentExperience = [];

    if (resume && resume.experience) {
      try {
        currentExperience = JSON.parse(resume.experience);
        // Handle nested array structure if it exists
        if (
          Array.isArray(currentExperience) &&
          currentExperience.length > 0 &&
          Array.isArray(currentExperience[0])
        ) {
          currentExperience = currentExperience[0]; // Extract from nested array
        }
      } catch (error) {
        currentExperience = [];
      }
    }

    // Add new experience entry
    const newExperience = {
      ...experienceData,
    };

    currentExperience.push(newExperience);

    // Update in database (wrap in array to maintain structure)
    await upsertResumeData(parsedUserId, {
      experience: JSON.stringify([currentExperience]),
    });

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Experience entry added successfully.",
        data: {
          newExperience,
          experienceIndex: currentExperience.length - 1,
          totalExperienceCount: currentExperience.length,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler to delete user experience entry
export const deleteUserExperienceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { experienceData } = req.body; // Send the complete experience object to delete

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    if (!experienceData) {
      throw new ErrorHandler({
        message: "Experience data is required to identify the entry to delete.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get current experience data
    const [resume] = await db
      .select({ experience: tblResume.experience })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let currentExperience = [];

    if (resume && resume.experience) {
      try {
        currentExperience = JSON.parse(resume.experience);
        // Handle nested array structure if it exists
        if (
          Array.isArray(currentExperience) &&
          currentExperience.length > 0 &&
          Array.isArray(currentExperience[0])
        ) {
          currentExperience = currentExperience[0]; // Extract from nested array
        }
      } catch (error) {
        throw new ErrorHandler({
          message: "Error parsing existing experience data.",
          status: STATUS_CODES.SERVER_ERROR,
        });
      }
    }

    if (currentExperience.length === 0) {
      throw new ErrorHandler({
        message: "No experience entries found to delete.",
        status: STATUS_CODES.NOT_FOUND,
      });
    }

    // Find and remove the experience entry based on multiple criteria
    const initialLength = currentExperience.length;

    // Method 1: Find by exact match of key fields
    currentExperience = currentExperience.filter((exp: any) => {
      const matches =
        exp.Company === experienceData.Company &&
        exp.Designation === experienceData.Designation &&
        exp.Start_Date === experienceData.Start_Date &&
        exp.End_Date === experienceData.End_Date;

      return !matches; // Keep entries that don't match
    });

    // If no exact match found, try partial matching with Company and Designation
    if (currentExperience.length === initialLength) {
      currentExperience = currentExperience.filter((exp: any) => {
        const partialMatch =
          exp.Company === experienceData.Company &&
          exp.Designation === experienceData.Designation;

        return !partialMatch; // Keep entries that don't match
      });
    }

    // If still no match, try matching with Company and Start_Date (fallback)
    if (currentExperience.length === initialLength) {
      currentExperience = currentExperience.filter((exp: any) => {
        const fallbackMatch =
          exp.Company === experienceData.Company &&
          exp.Start_Date === experienceData.Start_Date;

        return !fallbackMatch; // Keep entries that don't match
      });
    }

    // Check if any entry was actually deleted
    if (currentExperience.length === initialLength) {
      throw new ErrorHandler({
        message:
          "Experience entry not found or could not be identified for deletion. Please ensure the experience data matches exactly.",
        status: STATUS_CODES.NOT_FOUND,
        data: {
          searchedFor: experienceData,
          availableExperience: currentExperience.map((exp: any) => ({
            Company: exp.Company,
            Designation: exp.Designation,
            Start_Date: exp.Start_Date,
            End_Date: exp.End_Date,
          })),
        },
      });
    }

    // Update in database (wrap in array to maintain structure)
    await upsertResumeData(parsedUserId, {
      experience: JSON.stringify([currentExperience]),
    });

    const deletedCount = initialLength - currentExperience.length;

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: `Experience entry deleted successfully. ${deletedCount} entry(ies) removed.`,
        data: {
          deletedCount,
          remainingExperienceCount: currentExperience.length,
          deletedExperienceData: experienceData,
        },
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
        data: {
          portfolio: portfolio,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const getUserPortfolioHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get user's resume data
    const [resume] = await db
      .select({ portfolio: tblResume.portfolio })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let portfolioData = [];

    if (resume && resume.portfolio) {
      try {
        portfolioData = JSON.parse(resume.portfolio);
      } catch (error) {
        console.error("Error parsing portfolio JSON:", error);
        portfolioData = [];
      }
    }

    // Format the portfolio data for response - keeping only existing fields
    const formattedPortfolio = portfolioData.map(
      (portfolio: any, index: number) => ({
        id: index, // Using index as ID for frontend reference
        originalData: {
          Title: portfolio.Title || "Not specified",
          Url: portfolio.Url || "Not specified",
          Image: portfolio.Image || "Not specified",
          Description: portfolio.Description || "Not specified",
          // Keep any other fields as they are
          ...Object.keys(portfolio).reduce((acc, key) => {
            if (!["Title", "Url", "Image", "Description"].includes(key)) {
              acc[key] = portfolio[key];
            }
            return acc;
          }, {} as any),
        },
      })
    );

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message:
          portfolioData.length > 0
            ? "Portfolio details retrieved successfully."
            : "No portfolio details found.",
        data: {
          portfolio: formattedPortfolio,
          totalRecords: formattedPortfolio.length,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler to add new portfolio entry
export const addUserPortfolioHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { portfolioData } = req.body;

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    if (!portfolioData) {
      throw new ErrorHandler({
        message: "Portfolio data is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get current portfolio data
    const [resume] = await db
      .select({ portfolio: tblResume.portfolio })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let currentPortfolio = [];

    if (resume && resume.portfolio) {
      try {
        currentPortfolio = JSON.parse(resume.portfolio);
      } catch (error) {
        currentPortfolio = [];
      }
    }

    // Add new portfolio entry
    const newPortfolio = {
      ...portfolioData,
    };

    currentPortfolio.push(newPortfolio);

    // Update in database
    await upsertResumeData(parsedUserId, {
      portfolio: JSON.stringify(currentPortfolio),
    });

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Portfolio entry added successfully.",
        data: {
          newPortfolio,
          portfolioIndex: currentPortfolio.length - 1,
          totalPortfolioCount: currentPortfolio.length,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler to delete user portfolio entry
export const deleteUserPortfolioHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { portfolioData } = req.body; // Send the complete portfolio object to delete

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    if (!portfolioData) {
      throw new ErrorHandler({
        message: "Portfolio data is required to identify the entry to delete.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get current portfolio data
    const [resume] = await db
      .select({ portfolio: tblResume.portfolio })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let currentPortfolio = [];

    if (resume && resume.portfolio) {
      try {
        currentPortfolio = JSON.parse(resume.portfolio);
      } catch (error) {
        throw new ErrorHandler({
          message: "Error parsing existing portfolio data.",
          status: STATUS_CODES.SERVER_ERROR,
        });
      }
    }

    if (currentPortfolio.length === 0) {
      throw new ErrorHandler({
        message: "No portfolio entries found to delete.",
        status: STATUS_CODES.NOT_FOUND,
      });
    }

    // Find and remove the portfolio entry based on multiple criteria
    const initialLength = currentPortfolio.length;

    // Method 1: Find by exact match of key fields
    currentPortfolio = currentPortfolio.filter((portfolio: any) => {
      const matches =
        portfolio.Title === portfolioData.Title &&
        portfolio.Url === portfolioData.Url &&
        portfolio.Image === portfolioData.Image &&
        portfolio.Description === portfolioData.Description;

      return !matches; // Keep entries that don't match
    });

    // If no exact match found, try partial matching with Title and Url
    if (currentPortfolio.length === initialLength) {
      currentPortfolio = currentPortfolio.filter((portfolio: any) => {
        const partialMatch =
          portfolio.Title === portfolioData.Title &&
          portfolio.Url === portfolioData.Url;

        return !partialMatch; // Keep entries that don't match
      });
    }

    // If still no match, try matching with Title and Image (fallback)
    if (currentPortfolio.length === initialLength) {
      currentPortfolio = currentPortfolio.filter((portfolio: any) => {
        const fallbackMatch =
          portfolio.Title === portfolioData.Title &&
          portfolio.Image === portfolioData.Image;

        return !fallbackMatch; // Keep entries that don't match
      });
    }

    // Check if any entry was actually deleted
    if (currentPortfolio.length === initialLength) {
      throw new ErrorHandler({
        message:
          "Portfolio entry not found or could not be identified for deletion. Please ensure the portfolio data matches exactly.",
        status: STATUS_CODES.NOT_FOUND,
        data: {
          searchedFor: portfolioData,
          availablePortfolio: currentPortfolio.map((portfolio: any) => ({
            Title: portfolio.Title,
            Url: portfolio.Url,
            Image: portfolio.Image,
            Description: portfolio.Description,
          })),
        },
      });
    }

    // Update in database
    await upsertResumeData(parsedUserId, {
      portfolio: JSON.stringify(currentPortfolio),
    });

    const deletedCount = initialLength - currentPortfolio.length;

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: `Portfolio entry deleted successfully. ${deletedCount} entry(ies) removed.`,
        data: {
          deletedCount,
          remainingPortfolioCount: currentPortfolio.length,
          deletedPortfolioData: portfolioData,
        },
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
        data: {
          awards: awards,
        },
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
        data: {
          skills: skillsData,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const getUserAwardsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get user's resume data
    const [resume] = await db
      .select({ award: tblResume.award })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let awardsData = [];

    if (resume && resume.award) {
      try {
        awardsData = JSON.parse(resume.award);
      } catch (error) {
        console.error("Error parsing awards JSON:", error);
        awardsData = [];
      }
    }

    // Format the awards data for response - keeping only existing fields
    const formattedAwards = awardsData.map((award: any, index: number) => ({
      id: index, // Using index as ID for frontend reference
      originalData: {
        Award: award.Award || "Not specified",
        Award_image: award.Award_image || "Not specified",
        Date: award.Date || "Not specified",
        Award_Description: award.Award_Description || "Not specified",
        // Keep any other fields as they are
        ...Object.keys(award).reduce((acc, key) => {
          if (
            !["Award", "Award_image", "Date", "Award_Description"].includes(key)
          ) {
            acc[key] = award[key];
          }
          return acc;
        }, {} as any),
      },
    }));

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message:
          awardsData.length > 0
            ? "Awards details retrieved successfully."
            : "No awards details found.",
        data: {
          awards: formattedAwards,
          totalRecords: formattedAwards.length,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler to add new award entry
export const addUserAwardHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { awardData } = req.body;

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    if (!awardData) {
      throw new ErrorHandler({
        message: "Award data is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get current awards data
    const [resume] = await db
      .select({ award: tblResume.award })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let currentAwards = [];

    if (resume && resume.award) {
      try {
        currentAwards = JSON.parse(resume.award);
      } catch (error) {
        currentAwards = [];
      }
    }

    // Add new award entry
    const newAward = {
      ...awardData,
    };

    currentAwards.push(newAward);

    // Update in database
    await upsertResumeData(parsedUserId, {
      award: JSON.stringify(currentAwards),
    });

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Award entry added successfully.",
        data: {
          newAward,
          awardIndex: currentAwards.length - 1,
          totalAwardCount: currentAwards.length,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Handler to delete user award entry
export const deleteUserAwardHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.user?.id;
    const userId = typeof id === "string" ? parseInt(id) : (id as number);
    const { awardData } = req.body; // Send the complete award object to delete

    if (!userId) {
      throw new ErrorHandler({
        message: "User ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    if (!awardData) {
      throw new ErrorHandler({
        message: "Award data is required to identify the entry to delete.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const parsedUserId = parseInt(userId.toString());

    // Get current awards data
    const [resume] = await db
      .select({ award: tblResume.award })
      .from(tblResume)
      .where(eq(tblResume.candId, parsedUserId.toString()));

    let currentAwards = [];

    if (resume && resume.award) {
      try {
        currentAwards = JSON.parse(resume.award);
      } catch (error) {
        throw new ErrorHandler({
          message: "Error parsing existing awards data.",
          status: STATUS_CODES.SERVER_ERROR,
        });
      }
    }

    if (currentAwards.length === 0) {
      throw new ErrorHandler({
        message: "No award entries found to delete.",
        status: STATUS_CODES.NOT_FOUND,
      });
    }

    // Find and remove the award entry based on multiple criteria
    const initialLength = currentAwards.length;

    // Method 1: Find by exact match of key fields
    currentAwards = currentAwards.filter((award: any) => {
      const matches =
        award.Award === awardData.Award &&
        award.Date === awardData.Date &&
        award.Award_image === awardData.Award_image &&
        award.Award_Description === awardData.Award_Description;

      return !matches; // Keep entries that don't match
    });

    // If no exact match found, try partial matching with Award and Date
    if (currentAwards.length === initialLength) {
      currentAwards = currentAwards.filter((award: any) => {
        const partialMatch =
          award.Award === awardData.Award && award.Date === awardData.Date;

        return !partialMatch; // Keep entries that don't match
      });
    }

    // If still no match, try matching with Award and Award_image (fallback)
    if (currentAwards.length === initialLength) {
      currentAwards = currentAwards.filter((award: any) => {
        const fallbackMatch =
          award.Award === awardData.Award &&
          award.Award_image === awardData.Award_image;

        return !fallbackMatch; // Keep entries that don't match
      });
    }

    // Check if any entry was actually deleted
    if (currentAwards.length === initialLength) {
      throw new ErrorHandler({
        message:
          "Award entry not found or could not be identified for deletion. Please ensure the award data matches exactly.",
        status: STATUS_CODES.NOT_FOUND,
        data: {
          searchedFor: awardData,
          availableAwards: currentAwards.map((award: any) => ({
            Award: award.Award,
            Date: award.Date,
            Award_image: award.Award_image,
            Award_Description: award.Award_Description,
          })),
        },
      });
    }

    // Update in database
    await upsertResumeData(parsedUserId, {
      award: JSON.stringify(currentAwards),
    });

    const deletedCount = initialLength - currentAwards.length;

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: `Award entry deleted successfully. ${deletedCount} entry(ies) removed.`,
        data: {
          deletedCount,
          remainingAwardCount: currentAwards.length,
          deletedAwardData: awardData,
        },
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

export const userProfileLoaderHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = Number(req.user?.id);

  if (!userId) {
    return next(new ErrorHandler({ message: "User ID is required." }));
  }

  // Get user data
  const userData = await db
    .select()
    .from(tblUsers)
    .where(eq(tblUsers.id, userId))
    .limit(1);

  if (!userData || userData.length === 0) {
    return next(new ErrorHandler({ message: "User not found." }));
  }

  const user = userData[0];

  // Get resume data
  const resumeData = await db
    .select()
    .from(tblResume)
    .where(eq(tblResume.candId, userId.toString()))
    .limit(1);

  const resume = resumeData[0] || null;

  // Calculate profile completion
  const profileFields = [
    { field: "username", value: user.username },
    { field: "email", value: user.email },
    { field: "phone", value: user.phone },
    { field: "profilePic", value: user.profilePic },
    { field: "gender", value: user.gender },
    { field: "dob", value: user.dob },
    { field: "canDesc", value: user.canDesc },
    {
      field: "state",
      value: user.state && user.state !== 0 ? user.state : null,
    },
    { field: "city", value: user.city && user.city !== 0 ? user.city : null },
    { field: "fullAddress", value: user.fullAddress },
    { field: "organization", value: user.organization },
    { field: "sectorId", value: user.sectorId },
    {
      field: "industryId",
      value: user.industryId && user.industryId !== 0 ? user.industryId : null,
    },
  ];

  const completedFields = profileFields.filter(
    (field) =>
      field.value &&
      field.value !== "NULL" &&
      field.value !== null &&
      field.value !== ""
  );

  const missingFields = profileFields
    .filter(
      (field) =>
        !field.value ||
        field.value === "NULL" ||
        field.value === null ||
        field.value === ""
    )
    .map((field) => field.field);

  const profileCompletionPercentage = Math.round(
    (completedFields.length / profileFields.length) * 100
  );

  // Calculate resume completeness
  const resumeSections = {
    coverLetter: !!(resume?.coverLetter && resume.coverLetter !== "NULL"),
    skills: !!(resume?.skills && resume.skills !== "NULL"),
    education: !!(resume?.education && resume.education !== "NULL"),
    experience: !!(resume?.experience && resume.experience !== "NULL"),
    portfolio: !!(resume?.portfolio && resume.portfolio !== "NULL"),
    language: !!(resume?.language && resume.language !== "NULL"),
    award: !!(resume?.award && resume.award !== "NULL"),
  };

  const completedResumeSections =
    Object.values(resumeSections).filter(Boolean).length;
  const resumeCompletenessPercentage = Math.round(
    (completedResumeSections / Object.keys(resumeSections).length) * 100
  );

  // Calculate account age
  const createdDate = new Date(user.createdDate);
  const now = new Date();
  const accountAge = Math.floor(
    (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Build response
  const userStats: UserStats = {
    profileCompletion: {
      percentage: profileCompletionPercentage,
      completedFields: completedFields.length,
      totalFields: profileFields.length,
      missingFields: missingFields,
    },
    resumeStatus: {
      uploaded: !!(resume?.cv && resume.cv !== "NULL"),
      completeness: resumeCompletenessPercentage,
      sections: resumeSections,
    },
    accountInfo: {
      accountAge,
      lastLogin: null, // You might want to implement last login tracking
      emailVerified: user.everify === "1",
      profileViews: parseInt(user.totalView || "0"),
      accountType: user.type || "candidate",
    },
    completionTasks: {
      profilePicture: !!(user.profilePic && user.profilePic !== "NULL"),
      phoneNumber: !!(user.phone && user.phone !== "NULL"),
      location: !!(
        user.state &&
        user.state !== 0 &&
        user.city &&
        user.city !== 0
      ),
      socialLinks: !!(
        user.facebook ||
        user.twitter ||
        user.linkedin ||
        user.dribbble
      ),
      aboutDescription: !!(user.canDesc && user.canDesc !== "NULL"),
    },
  };

  // Calculate overall completion percentage
  const overallTasks = [
    userStats.profileCompletion.percentage > 80,
    userStats.resumeStatus.uploaded,
    userStats.resumeStatus.completeness > 60,
    userStats.completionTasks.profilePicture,
    userStats.completionTasks.phoneNumber,
    userStats.completionTasks.location,
    userStats.accountInfo.emailVerified,
  ];

  const overallCompletion = Math.round(
    (overallTasks.filter(Boolean).length / overallTasks.length) * 100
  );

  res.status(200).json(
    new ResponseHandler({
      message: "User profile fetched successfully",
      data: {
        // ...userStats,
        overallCompletion,
      },
    })
  );
};

export const getCurrentUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = Number(req.user.id);

    if (!userId || isNaN(userId)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    // Get user profile data
    const userProfile = await db
      .select()
      .from(tblUsers)
      .where(eq(tblUsers.id, userId))
      .limit(1);

    if (!userProfile.length) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const user = userProfile[0];

    // Get user resume data
    const userResume = await db
      .select()
      .from(tblResume)
      .where(eq(tblResume.candId, userId.toString()))
      .limit(1);

    // Helper function to get attribute data by IDs
    const getAttributesByIds = async (
      ids: string[] | number[]
    ): Promise<any[]> => {
      if (!ids || ids.length === 0) return [];

      const numericIds = ids
        .map((id) => (typeof id === "string" ? parseInt(id) : id))
        .filter((id) => !isNaN(id));
      if (numericIds.length === 0) return [];

      const attributes = await db
        .select()
        .from(attribute)
        .where(inArray(attribute.id, numericIds));

      return attributes;
    };

    // Get location information
    let stateInfo = null;
    let cityInfo = null;
    let countryInfo = null;

    if (user.state && user.state > 0) {
      const stateData = await db
        .select()
        .from(states)
        .where(eq(states.id, user.state))
        .limit(1);

      if (stateData.length) {
        stateInfo = stateData[0];

        // Get country info from state
        if (stateInfo.countryId) {
          const countryData = await db
            .select()
            .from(countries)
            .where(eq(countries.id, stateInfo.countryId))
            .limit(1);

          if (countryData.length) {
            countryInfo = countryData[0];
          }
        }
      }
    }

    if (user.city && user.city > 0) {
      const cityData = await db
        .select()
        .from(cities)
        .where(eq(cities.id, user.city))
        .limit(1);

      if (cityData.length) {
        cityInfo = cityData[0];
      }
    }

    // Get sector information
    let sectorInfo = null;
    if (user.sectorId) {
      const sectorData = await db
        .select()
        .from(tblCatSector)
        .where(eq(tblCatSector.id, parseInt(user.sectorId)))
        .limit(1);

      if (sectorData.length) {
        sectorInfo = sectorData[0];
      }
    }

    // Get gender information from attribute table
    let genderInfo = null;
    if (user.gender) {
      const genderData = await db
        .select()
        .from(attribute)
        .where(eq(attribute.id, parseInt(user.gender)))
        .limit(1);

      if (genderData.length) {
        genderInfo = genderData[0];
      }
    }

    // Structure the profile data
    const profileData: UserProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone || undefined,
      phone2: user.phone2 || undefined,
      profilePic: getImageUrl(user.profilePic) || undefined,
      coverImage: getImageUrl(user.coverImage) || undefined,
      website: user.website || undefined,
      foundedDate: user.foundedDate || undefined,
      organization: user.organization || undefined,
      canDesc: user.canDesc || undefined,
      gender: user.gender || undefined,
      genderInfo, // Add gender attribute info
      dob: user.dob || undefined,
      age: user.age || undefined,
      socialMedia: {
        facebook: user.facebook || undefined,
        twitter: user.twitter || undefined,
        linkedin: user.linkedin || undefined,
        dribbble: user.dribbble || undefined,
      },
      location: {
        state: user.state,
        city: user.city,
        pincode: user.pincode,
        fullAddress: user.fullAddress || undefined,
        stateInfo,
        cityInfo,
        countryInfo,
      },
      settings: {
        publicView: user.publicView,
        everify: user.everify,
        status: user.status,
        totalView: user.totalView,
      },
      utm: {
        utmSource: user.utmSource || undefined,
        utmMedium: user.utmMedium || undefined,
        utmCampaign: user.utmCampaign || undefined,
        utmContent: user.utmContent || undefined,
      },
      sectorInfo,
      createdDate: user.createdDate,
    };

    // Structure the resume data
    let resumeData: ResumeData | null = null;

    if (userResume.length) {
      const resume = userResume[0];

      // Parse JSON strings and get attribute data
      let educationData = null;
      let experienceData = null;
      let portfolioData = null;
      let languageData = null;
      let skillsInfo = [];
      let locationInfo = [];

      // Parse education and get attribute data for Education and Stream
      try {
        if (resume.education) {
          educationData = JSON.parse(resume.education);
          if (Array.isArray(educationData)) {
            for (let edu of educationData) {
              if (edu.Education) {
                const eduAttributes = await getAttributesByIds([edu.Education]);
                edu.EducationInfo = eduAttributes[0] || null;
              }
              if (edu.Stream) {
                const streamAttributes = await getAttributesByIds([edu.Stream]);
                edu.StreamInfo = streamAttributes[0] || null;
              }
            }
          }
        }
      } catch (e) {
        educationData = resume.education;
      }

      // Parse experience
      try {
        if (resume.experience) {
          experienceData = JSON.parse(resume.experience);
        }
      } catch (e) {
        experienceData = resume.experience;
      }

      // Parse portfolio
      try {
        if (resume.portfolio) {
          portfolioData = JSON.parse(resume.portfolio);
        }
      } catch (e) {
        portfolioData = resume.portfolio;
      }

      // Parse language
      try {
        if (resume.language) {
          languageData = JSON.parse(resume.language);
        }
      } catch (e) {
        languageData = resume.language;
      }

      // Get skills attribute data
      if (resume.skills && typeof resume.skills === "string") {
        const skillIds = resume.skills.split(",").map((id) => id.trim());
        skillsInfo = await getAttributesByIds(skillIds);
      }

      // Get location attribute data
      if (resume.location && typeof resume.location === "string") {
        const locationIds = resume.location.split(",").map((id) => id.trim());
        locationInfo = await getAttributesByIds(locationIds);
      }

      resumeData = {
        id: resume.id,
        coverLetter: resume.coverLetter || undefined,
        skills: resume.skills || undefined,
        skillsInfo, // Add skills attribute info
        location: resume.location || undefined,
        locationInfo, // Add location attribute info
        hobbies: resume.hobbies || undefined,
        cv: resume.cv || undefined,
        education: educationData,
        experience: experienceData,
        portfolio: portfolioData,
        language: languageData,
        noticePeriod: resume.noticePeriod || undefined,
        award: resume.award || undefined,
      };
    }

    // Prepare the complete response
    const completeUserData: CompleteUserData = {
      profile: profileData,
      resume: resumeData,
    };

    res.status(200).json({
      success: true,
      message: "User data retrieved successfully",
      data: completeUserData,
    });
  } catch (error) {
    console.error("Error fetching current user data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
