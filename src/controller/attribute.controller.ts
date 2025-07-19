import { NextFunction, Request, Response } from "express";
import { db } from "../db";
import { attribute, cities, tblCatSector } from "../db/schema";
import { and, eq, like } from "drizzle-orm";
import { ErrorHandler } from "../util/errorHandler";
import { STATUS_CODES } from "../constants/statusCodes";
import { ResponseHandler } from "../util/responseHandler";
import { generateUniqueId } from "../util/generateTableId";

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
    const { search, limit = "20" } = req.query;

    // Case 1: No search term - return popular cities (initial dropdown)
    if (!search || typeof search !== "string" || search.trim() === "") {
      const popularCities = await db
        .select({
          id: cities.id,
          name: cities.name,
          stateId: cities.stateId,
        })
        .from(cities)
        .limit(parseInt(limit as string));

      res.status(STATUS_CODES.OK).json(
        new ResponseHandler({
          message: "Popular cities retrieved successfully.",
          data: {
            cities: popularCities,
            showCustomOption: false, // Don't show custom option initially
            searchTerm: "",
          },
        }).toJSON()
      );
    }

    // Case 2: User is searching - find matching cities
    const searchTerm = typeof search === "string" ? search.trim() : "";
    const matchingCities = await db
      .select({
        id: cities.id,
        name: cities.name,
        stateId: cities.stateId,
      })
      .from(cities)
      .where(like(cities.name, `%${searchTerm}%`))
      .limit(parseInt(limit as string))
      .orderBy(cities.name);

    // Prepare response with custom option
    const response = {
      cities: matchingCities,
      searchTerm: searchTerm,
      showCustomOption: true,
      customCity: {
        id: -1, // Special ID for custom entry
        name: searchTerm,
        stateId: null,
        isCustom: true,
      },
    };

    res.status(STATUS_CODES.OK).json(
      new ResponseHandler({
        message:
          matchingCities.length > 0
            ? `Found ${matchingCities.length} cities matching "${searchTerm}"`
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
        .where(eq(attribute.parentId, skillsParentId))
        .limit(parseInt(limit as string));

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
      )
      .limit(parseInt(limit as string));

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
