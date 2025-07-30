import { NextFunction, Request, Response } from "express";
import { db } from "../db";
import { attribute, cities, tblAIResponse, tblCatSector } from "../db/schema";
import { and, count, eq, like } from "drizzle-orm";
import { ErrorHandler } from "../util/errorHandler";
import { STATUS_CODES, StatusCodes } from "../constants/statusCodes";
import { ResponseHandler } from "../util/responseHandler";
import { generateUniqueId } from "../util/generateTableId";
import { runGemini } from "../util/writte_with_ai";
import { findSimilarResponse } from "../util/matching";

export const getAttributeOptionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // This line expects a route parameter named "parentId"
    const { parentId } = req.params;

    if (!parentId || isNaN(parseInt(parentId))) {
      throw new ErrorHandler({
        message: "A numeric parent ID is required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    // Find all children attributes directly using the parent's ID
    const options = await db
      .select({
        id: attribute.id,
        name: attribute.name,
        icon: attribute.icon,
      })
      .from(attribute)
      .where(eq(attribute.parentId, parentId));

    if (options.length === 0) {
      // This is not an error, just a warning for the console.
      console.warn(`No attributes found with parentId: ${parentId}`);
    }

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: `Options for parent ID ${parentId} retrieved successfully.`,
        data: options,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const getGenderOptionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Gender has parent ID 19 based on your attribute table
    const genderParentId = "19";

    // Find all gender options (Male, Female, Both)
    const genderOptions = await db
      .select({
        id: attribute.id,
        name: attribute.name,
        icon: attribute.icon,
      })
      .from(attribute)
      .where(eq(attribute.parentId, genderParentId));

    if (genderOptions.length === 0) {
      console.warn("No gender options found in the attribute table");
    }

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Gender options retrieved successfully.",
        data: genderOptions,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const getCitiesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, limit = "1000", page = "1" } = req.query;

    const parsedLimit = parseInt(limit as string);
    const parsedPage = parseInt(page as string);
    const offset = (parsedPage - 1) * parsedLimit;

    const searchTerm = typeof search === "string" ? search.trim() : "";

    const whereClause =
      searchTerm === "" ? undefined : like(cities.name, `%${searchTerm}%`);

    // Fetch paginated cities
    const citiesList = await db
      .select({
        id: cities.id,
        name: cities.name,
        stateId: cities.stateId,
      })
      .from(cities)
      .where(whereClause)
      .orderBy(cities.name)
      .limit(parsedLimit)
      .offset(offset);

    // Fetch total count
    const totalCountResult = await db
      .select({ count: count() })
      .from(cities)
      .where(whereClause);

    const total = Number(totalCountResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / parsedLimit);
    const hasNextPage = parsedPage * parsedLimit < total;

    const response: any = {
      cities: citiesList,
      searchTerm,
      showCustomOption: !!searchTerm,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasNextPage,
      },
    };

    if (searchTerm) {
      response.customCity = {
        id: -1,
        name: searchTerm,
        stateId: null,
        isCustom: true,
      };
    }

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message:
          citiesList.length > 0
            ? `Found ${citiesList.length} cities matching "${searchTerm}"`
            : `No cities found matching "${searchTerm}". You can enter it as a custom city.`,
        data: response,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const getJobTypeDetailsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Gender has parent ID 0 based on your attribute table
    const jobTypeParentId = "1";

    // Find all jobType options ()
    const jobTypeOptions = await db
      .select({
        id: attribute.id,
        name: attribute.name,
        icon: attribute.icon,
      })
      .from(attribute)
      .where(eq(attribute.parentId, jobTypeParentId));

    if (jobTypeOptions.length === 0) {
      console.warn("No jobType options found in the attribute table");
    }

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "JobType options retrieved successfully.",
        data: jobTypeOptions,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const getCareerLevelDetailsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const careerLevelParentId = "17";

    const careerLevelOptions = await db
      .select({
        id: attribute.id,
        name: attribute.name,
        icon: attribute.icon,
      })
      .from(attribute)
      .where(eq(attribute.parentId, careerLevelParentId));

    if (careerLevelOptions.length === 0) {
      console.warn("No careerLevel options found in the attribute table");
    }

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Career Level options retrieved successfully.",
        data: careerLevelOptions,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Education/Qualifications Handler (Parent ID: 21)
export const getEducationOptionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, limit = "20" } = req.query;
    const educationParentId = "21";

    if (!search || typeof search !== "string" || search.trim() === "") {
      const popularEducations = await db
        .select({
          id: attribute.id,
          name: attribute.name,
          icon: attribute.icon,
        })
        .from(attribute)
        .where(eq(attribute.parentId, educationParentId))
        .limit(parseInt(limit as string));

      res.status(STATUS_CODES.OK).json(
        new ResponseHandler({
          message: "Popular education options retrieved successfully.",
          data: popularEducations,
        }).toJSON()
      );
    }

    const searchTerm = typeof search === "string" ? search.trim() : "";
    const matchingEducations = await db
      .select({
        id: attribute.id,
        name: attribute.name,
        icon: attribute.icon,
      })
      .from(attribute)
      .where(
        and(
          eq(attribute.parentId, educationParentId),
          like(attribute.name, `%${searchTerm}%`)
        )
      )
      .limit(parseInt(limit as string));

    const response = {
      searchTerm: searchTerm,
      matches: matchingEducations,
      allowCustom: true,
      customEducation: {
        id: -1,
        name: searchTerm,
        parentId: educationParentId,
        isCustom: true,
      },
    };

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message:
          matchingEducations.length > 0
            ? `Found ${matchingEducations.length} education options matching "${searchTerm}"`
            : `No education options found matching "${searchTerm}". You can add it as custom.`,
        data: response,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Industry Handler (Based on sector selection)
export const getIndustryOptionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, limit = "50" } = req.query;

    // Since industry data might be in tblCatSector table, let's fetch from there
    // Build the base select query
    let baseQuery = db
      .select({
        id: tblCatSector.id,
        name: tblCatSector.name,
        slug: tblCatSector.slug,
      })
      .from(tblCatSector);

    let query;
    if (search && typeof search === "string" && search.trim() !== "") {
      query = baseQuery.where(like(tblCatSector.name, `%${search.trim()}%`));
    } else {
      query = baseQuery;
    }

    const industries = await query.limit(parseInt(limit as string));

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Industry options retrieved successfully.",
        data: industries,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Salary Type Handler (Parent ID: 12)
export const getSalaryTypeOptionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const salaryParentId = "12";

    const salaryTypes = await db
      .select({
        id: attribute.id,
        name: attribute.name,
        icon: attribute.icon,
      })
      .from(attribute)
      .where(eq(attribute.parentId, salaryParentId));

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Salary type options retrieved successfully.",
        data: salaryTypes,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Skills Handler (Parent ID: 61)
export const getSkillsOptionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, limit = "50" } = req.query;
    const skillsParentId = "61";

    if (!search || typeof search !== "string" || search.trim() === "") {
      const popularSkills = await db
        .select({
          id: attribute.id,
          name: attribute.name,
          icon: attribute.icon,
        })
        .from(attribute)
        .where(eq(attribute.parentId, skillsParentId));

      res.status(STATUS_CODES.OK).json(
        new ResponseHandler({
          message: "Popular skills retrieved successfully.",
          data: popularSkills,
        }).toJSON()
      );
    }

    const searchTerm = typeof search === "string" ? search.trim() : "";
    const matchingSkills = await db
      .select({
        id: attribute.id,
        name: attribute.name,
        icon: attribute.icon,
      })
      .from(attribute)
      .where(
        and(
          eq(attribute.parentId, skillsParentId),
          like(attribute.name, `%${searchTerm}%`)
        )
      );

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message:
          matchingSkills.length > 0
            ? `Found ${matchingSkills.length} skills matching "${searchTerm}"`
            : `No skills found matching "${searchTerm}". You can add it manually.`,
        data: matchingSkills,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Location Type Handler (Parent ID: 56) - For preferred job locations
export const getLocationTypeOptionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const locationTypeParentId = "56";

    const locationTypes = await db
      .select({
        id: attribute.id,
        name: attribute.name,
        icon: attribute.icon,
      })
      .from(attribute)
      .where(eq(attribute.parentId, locationTypeParentId));

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Location type options retrieved successfully.",
        data: locationTypes,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const getJobRoleTypesOptionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jobrole = await db
      .select({
        id: attribute.id,
        name: attribute.name,
        icon: attribute.icon,
      })
      .from(attribute)
      .where(eq(attribute.name, "Job-Role"));

    if (jobrole.length === 0) {
      next(
        new ErrorHandler({
          message: "Job-Role not found",
          status: STATUS_CODES.BAD_REQUEST,
        })
      );
    }

    const jobroleTypes = await db
      .select({
        id: attribute.id,
        name: attribute.name,
        icon: attribute.icon,
      })
      .from(attribute)
      .where(eq(attribute.parentId, jobrole[0].id.toString()));

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message: "Location type options retrieved successfully.",
        data: jobroleTypes,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

// Add Custom Entry to Attribute Table
export const addCustomAttributeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, parentId } = req.body;

    if (!name || !parentId) {
      throw new ErrorHandler({
        message: "Name and parent ID are required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    // Check if attribute already exists
    const [existingAttribute] = await db
      .select({ id: attribute.id, name: attribute.name })
      .from(attribute)
      .where(
        and(eq(attribute.name, name.trim()), eq(attribute.parentId, parentId))
      )
      .limit(1);

    if (existingAttribute) {
      res.status(STATUS_CODES.OK).json(
        new ResponseHandler({
          message: "Attribute already exists.",
          data: existingAttribute,
        }).toJSON()
      );
    }

    // Add new attribute
    const nextId = await generateUniqueId(attribute);
    await db.insert(attribute).values({
      id: nextId,
      name: name.trim(),
      parentId: parentId,
      icon: null,
    });

    const [newAttribute] = await db
      .select({
        id: attribute.id,
        name: attribute.name,
        icon: attribute.icon,
      })
      .from(attribute)
      .where(eq(attribute.id, nextId));

    res.status(STATUS_CODES.CREATED).json(
      new ResponseHandler({
        message: "Custom attribute added successfully.",
        data: newAttribute,
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const addCustomAttributesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { names } = req.body;
    const { parentId } = req.params;

    // Validate input - must be array of names
    if (!names || !Array.isArray(names) || !parentId) {
      throw new ErrorHandler({
        message: "Names (array) and parent ID are required.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    if (names.length === 0) {
      throw new ErrorHandler({
        message: "Names array cannot be empty.",
        status: STATUS_CODES.BAD_REQUEST,
      });
    }

    const results = {
      created: [] as any[],
      existing: [] as any[],
      failed: [] as any[],
    };

    // Get all existing attributes for this parent to avoid duplicate checks
    const existingAttributes = await db
      .select({ id: attribute.id, name: attribute.name })
      .from(attribute)
      .where(eq(attribute.parentId, parentId));

    const existingNames = new Set(
      existingAttributes.map((attr) => attr.name.toLowerCase())
    );

    for (const name of names) {
      try {
        const trimmedName = name.trim();

        if (!trimmedName) {
          results.failed.push({
            name: name,
            reason: "Empty name",
          });
          continue;
        }

        // Check if already exists
        if (existingNames.has(trimmedName.toLowerCase())) {
          const existingAttr = existingAttributes.find(
            (attr) => attr.name.toLowerCase() === trimmedName.toLowerCase()
          );
          results.existing.push(existingAttr);
          continue;
        }

        // Add new attribute
        const nextId = await generateUniqueId(attribute);
        await db.insert(attribute).values({
          id: nextId,
          name: trimmedName,
          parentId: parentId,
          icon: null,
        });

        const [newAttribute] = await db
          .select({
            id: attribute.id,
            name: attribute.name,
            icon: attribute.icon,
          })
          .from(attribute)
          .where(eq(attribute.id, nextId));

        results.created.push(newAttribute);
        // Add to existing names to prevent duplicates within the same request
        existingNames.add(trimmedName.toLowerCase());
      } catch (error) {
        results.failed.push({
          name: name,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Determine response status and message
    let status: StatusCodes = STATUS_CODES.CREATED;
    let message = "";

    if (
      results.created.length > 0 &&
      results.existing.length === 0 &&
      results.failed.length === 0
    ) {
      message = `${results.created.length} attribute(s) added successfully.`;
    } else if (
      results.created.length === 0 &&
      results.existing.length > 0 &&
      results.failed.length === 0
    ) {
      status = STATUS_CODES.OK;
      message = "All attributes already exist.";
    } else if (
      results.created.length === 0 &&
      results.existing.length === 0 &&
      results.failed.length > 0
    ) {
      status = STATUS_CODES.BAD_REQUEST;
      message = "Failed to add any attributes.";
    } else {
      status = STATUS_CODES.PARTIAL_CONTENT; // 206 for partial success
      message = `Processed ${names.length} attribute(s): ${results.created.length} created, ${results.existing.length} already existed, ${results.failed.length} failed.`;
    }

    res.status(status).json(
      new ResponseHandler({
        message,
        data: {
          summary: {
            total: names.length,
            created: results.created.length,
            existing: results.existing.length,
            failed: results.failed.length,
          },
          created: results.created,
          existing: results.existing,
          failed: results.failed,
        },
      }).toJSON()
    );
  } catch (error) {
    next(error);
  }
};

export const writeWithAiHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type, role, prompt } = req.body;

    // Validate input
    if (!type || !prompt) {
      res.status(400).json({
        success: false,
        message: "Type and prompt are required fields",
      });
      return;
    }

    // Validate type enum
    const validTypes = [
      "Address",
      "Education",
      "Experience",
      "Portfolio",
      "Awards",
      "Skills",
    ];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        success: false,
        message: "Invalid type. Must be one of: " + validTypes.join(", "),
      });
      return;
    }

    // Check if similar prompt exists in database
    let existingResponse: any;
    if (type === "Experience") {
      existingResponse = await findSimilarResponse(prompt, type, role);
    } else {
      existingResponse = await findSimilarResponse(prompt, type);
    }

    let aiResponse: string;

    if (existingResponse) {
      // Return cached response
      aiResponse = existingResponse.answer;

      res.status(200).json({
        success: true,
        message: "Response retrieved from similar cache",
        data: {
          answer: aiResponse,
        },
      });
      return;
    }

    // Generate new AI response
    const generatedText = await runGemini(prompt, type);

    if (!generatedText) {
      next(
        new ErrorHandler({
          message: "Failed to generate AI response",
          status: STATUS_CODES.BAD_REQUEST,
        })
      );
    }

    const nextID = await generateUniqueId(tblAIResponse);

    const dbrole = type === "Experience" ? role : null;
    // Store new response in database
    const insertResult = await db.insert(tblAIResponse).values({
      id: nextID,
      role: dbrole, // Using type as role
      prompt: prompt,
      answer: generatedText,
      type: type as any,
    });

    res.status(201).json({
      success: true,
      message: "AI response generated and saved successfully",
      data: {
        answer: generatedText,
      },
    });
  } catch (error) {
    console.error("Error in writeWithAiHandler:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
