const { GoogleGenAI } = require("@google/genai");
const sharp = require("sharp");
const envVariables = require("./envVariables");

// Initialize the Google Gen AI client
const ai = new GoogleGenAI({
  apiKey: envVariables.GEMINI_API_KEY,
});

/**
 * Analyzes a food image using the Gemini 2.5 Flash model.
 *
 * @param {Buffer} imageBuffer - Raw image file buffer in memory
 * @param {string} mimeType - The mime type of the uploaded file
 * @returns {Promise<string>} The text response from Gemini (JSON string)
 */
async function analyzeFood(
  imageBuffer,
  mimeType,
  retries = 2,
  initialDelayMs = 2000,
) {
  if (!imageBuffer) {
    throw new Error("No image buffer provided for analysis");
  }

  let processedBuffer = imageBuffer;
  let targetMimeType = mimeType;

  // Optimize and compress image using sharp to reduce payload size and speed up API response
  try {
    if (mimeType.startsWith("image/")) {
      processedBuffer = await sharp(imageBuffer)
        .resize({
          width: 768,
          height: 768,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 75 })
        .toBuffer();
      targetMimeType = "image/jpeg";
    }
  } catch (err) {
    console.error(
      "[Sharp Optimization Error] Failed to optimize image. Sending original buffer:",
      err,
    );
  }

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: targetMimeType,
                  data: processedBuffer.toString("base64"),
                },
              },
            ],
          },
        ],
        config: {
          systemInstruction: `You are a professional nutrition and food analysis AI with expertise in visual food recognition and packaged food label reading. Carefully analyze the provided image.

STEP 1 — DETECTION
Determine if the image contains food, a beverage, or food/beverage packaging.

- If NONE of these are present, return ONLY:
{
  "is_food": false,
  "message": "The uploaded image does not appear to contain any food or food package."
}

STEP 2 — ANALYSIS (only if food/drink/packaging is detected)

Look closely at the image before answering:
- If the item is PACKAGED and a nutrition label or ingredients list is visible and legible, extract values directly from the printed text rather than estimating.
- If the item is PACKAGED but no nutrition label/ingredients list is visible (e.g. only the front of the package is shown), rely on your general knowledge of that specific product, but this must NOT be treated as "High" confidence — use "Medium" confidence instead.
- If the item is UNPACKAGED (a plate, bowl, homemade dish, etc.), visually estimate based on portion size, visible ingredients, and cooking method (fried, grilled, sauced, etc.).
- If multiple distinct food items are visible, analyze the most prominent/largest item in the frame only.
- If the image is blurry, poorly lit, or partially obscured, still provide your best estimate but lower the "confidence" value accordingly.

CONFIDENCE RULE (STRICT):
- "High" confidence is ONLY allowed when nutrition/ingredient values are read directly from VISIBLE, LEGIBLE text on a label in the image itself.
- "Medium" confidence applies when values come from recognizing a known branded product WITHOUT a visible label, or from a clear but estimated homemade dish.
- "Low" confidence applies when the image is unclear, ambiguous, partially obscured, or the food/product cannot be confidently identified.

Return ONLY the following JSON structure:
{
  "is_food": true,
  "food_name": "Specific name of the food or product (be as specific as possible, e.g. 'Grilled chicken Caesar salad' not just 'Salad')",
  "is_packaged": true, // or false
  "confidence": "High / Medium / Low", // per the strict CONFIDENCE RULE above
  "estimated_portion": "Brief description of portion size, e.g. '1 bowl (~300g)' or '1 pack (35g)'",
  "ingredients": {
    "healthy": ["very brief list of healthy ingredients"],
    "unhealthy": ["very brief list of unhealthy ingredients (e.g. saturated fats, refined sugar, additives, sodium)"]
  },
  "nutrition": {
    "calories_kcal": 250, // estimated or label-based calories in kcal for the estimated portion
    "protein_g": 12, // estimated grams of protein, use null if not determinable
    "carbs_g": 30, // estimated grams of carbohydrates, use null if not determinable
    "fat_g": 8, // estimated grams of fat, use null if not determinable
    "sugar_g": 5 // estimated grams of sugar, use null if not determinable
  },
  "verdict": {
    "healthy_status": "Healthy", // must be exactly one of: "Healthy", "Moderately Healthy", "Unhealthy"
    "reasoning": "A concise 1-2 sentence explanation justifying the verdict based on specific ingredients, preparation method, or nutrition values observed."
  }
}

RULES:
- All numeric nutrition values must be realistic numbers (not ranges, not strings).
- Use null (not 0 or omission) for any nutrition value you cannot reasonably estimate.
- Do not invent ingredients you cannot see or infer from typical preparation of that dish.
- healthy_status must reflect the balance of the ingredients list and nutrition values, not just calories alone.
- Do not include any markdown wrappers, code fences, comments, or extra text.
- Return ONLY the raw, valid JSON string matching the specified schema — no explanation before or after.`,
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      return response.text;
    } catch (error) {
      const isRetryable =
        error.status === 429 ||
        error.status === 503 ||
        (error.message && (
          error.message.includes("429") ||
          error.message.includes("503") ||
          error.message.includes("UNAVAILABLE") ||
          error.message.includes("high demand")
        ));
      if (isRetryable && attempt <= retries) {
        let waitTime = initialDelayMs;
        try {
          const parsed = JSON.parse(error.message);
          const retryInfo = parsed?.error?.details?.find((d) =>
            d["@type"]?.includes("RetryInfo"),
          );
          if (retryInfo?.retryDelay) {
            const seconds = parseFloat(retryInfo.retryDelay);
            if (!isNaN(seconds)) {
              waitTime = Math.ceil(seconds * 1000) + 1000; // Wait requested delay + 1s buffer
            }
          }
        } catch (e) {
          const match = error.message.match(/retry in ([\d.]+)s/i);
          if (match && match[1]) {
            const seconds = parseFloat(match[1]);
            waitTime = Math.ceil(seconds * 1000) + 1000;
          }
        }
        console.warn(
          `[Gemini API Transient Error] Status ${error.status || 'unknown'}. Retrying attempt ${attempt}/${retries} after waiting ${waitTime}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
}

module.exports = {
  analyzeFood,
};
