const { sendSuccess, sendError } = require("../utils/responseHandler");
const { analyzeFood } = require("../utils/geminiService");
const {
  saveFoodAnalysis,
  getFoodAnalysisHistoryByUserId,
  updateFoodAnalysisIsEat,
  getFoodAnalysisById,
} = require("../models/foodModel");

/**
 * Controller to upload a food image and analyze it using Gemini AI.
 */
const analyzeFoodImage = async (req, res, next) => {
  if (!req.file) {
    return sendError(
      res,
      "Please upload an image file under the form field name 'image'.",
      null,
      400,
    );
  }

  try {
    const result = await analyzeFood(req.file.buffer, req.file.mimetype);

    // Attempt to extract JSON from potential markdown blocks (e.g. ```json ... ```)
    let parsedResult;
    const cleanJson = result
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    try {
      parsedResult = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", result);
      return sendError(
        res,
        "The model failed to return a valid JSON response. Please try again.",
        { rawResponse: result },
        500,
      );
    }

    // Parse is_eat flag (default to false if not specified)
    let isEat = false;
    if (req.body.is_eat !== undefined) {
      isEat = req.body.is_eat === "true" || req.body.is_eat === true;
    } else if (req.body.isEat !== undefined) {
      isEat = req.body.isEat === "true" || req.body.isEat === true;
    }

    // Force isEat to false if the analyzed image does not contain food
    if (parsedResult.is_food === false) {
      isEat = false;
    }

    // Save food analysis record to the database for the authenticated user
    const savedRecord = await saveFoodAnalysis(
      req.user.userId,
      parsedResult,
      isEat,
    );

    return sendSuccess(
      res,
      "Food image analyzed and saved successfully.",
      {
        analysis: parsedResult,
        recordId: savedRecord.id,
        isEat: savedRecord.is_eat,
      },
      200,
    );
  } catch (error) {
    console.error("Error during food analysis:", error);

    // Graceful handling of Gemini API Quota/Rate Limit (429) and Service Unavailable (503) errors
    const isRateLimit =
      error.status === 429 || (error.message && error.message.includes("429"));
    const isServiceUnavailable =
      error.status === 503 ||
      (error.message &&
        (error.message.includes("503") ||
          error.message.includes("UNAVAILABLE") ||
          error.message.includes("high demand")));

    if (isRateLimit) {
      let friendlyMessage =
        "Gemini API rate limit or daily quota exceeded. Please wait a moment and try again.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.error?.message) {
          friendlyMessage = `API Quota Exceeded: ${parsed.error.message}`;
        }
      } catch (e) {
        if (error.message) {
          friendlyMessage = `API Quota Exceeded: ${error.message}`;
        }
      }
      return sendError(res, friendlyMessage, null, 429);
    }

    if (isServiceUnavailable) {
      let friendlyMessage =
        "Gemini AI service is currently experiencing high demand. Please try again in a moment.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.error?.message) {
          friendlyMessage = `Gemini Service Unavailable: ${parsed.error.message}`;
        }
      } catch (e) {
        if (error.message) {
          friendlyMessage = `Gemini Service Unavailable: ${error.message}`;
        }
      }
      return sendError(res, friendlyMessage, null, 503);
    }

    next(error);
  }
};

/**
 * Controller to fetch food analysis history for the authenticated user.
 */
const getFoodAnalysisHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { isEat, date } = req.query;
    const history = await getFoodAnalysisHistoryByUserId(userId, {
      isEat,
      date,
    });
    return sendSuccess(
      res,
      "Food analysis history retrieved successfully.",
      history,
      200,
    );
  } catch (error) {
    console.error("Error fetching food analysis history:", error);
    next(error);
  }
};

/**
 * Controller to update the is_eat status of an existing food analysis record.
 */
const updateFoodIsEatStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const isEatValue =
      req.body.is_eat !== undefined ? req.body.is_eat : req.body.isEat;

    if (isEatValue === undefined) {
      return sendError(res, "is_eat is a required field.", null, 400);
    }

    if (
      isEatValue !== true &&
      isEatValue !== false &&
      isEatValue !== "true" &&
      isEatValue !== "false"
    ) {
      return sendError(res, "is_eat must be a boolean value.", null, 400);
    }

    const isEat = isEatValue === true || isEatValue === "true";

    if (!id || isNaN(id)) {
      return sendError(res, "Valid food analysis ID is required.", null, 400);
    }

    const record = await getFoodAnalysisById(parseInt(id, 10), userId);
    if (!record) {
      return sendError(
        res,
        "Food analysis record not found or access denied.",
        null,
        404,
      );
    }

    if (record.is_food === false) {
      return sendError(
        res,
        "Cannot update eat status for non-food analysis records.",
        null,
        400,
      );
    }

    const updatedRecord = await updateFoodAnalysisIsEat(
      parseInt(id, 10),
      userId,
      isEat,
    );
    if (!updatedRecord) {
      return sendError(
        res,
        "Food analysis record not found or access denied.",
        null,
        404,
      );
    }

    return sendSuccess(
      res,
      "Food analysis eat status updated successfully.",
      updatedRecord,
      200,
    );
  } catch (error) {
    console.error("Error updating food eat status:", error);
    next(error);
  }
};

module.exports = {
  analyzeFoodImage,
  getFoodAnalysisHistory,
  updateFoodIsEatStatus,
};
