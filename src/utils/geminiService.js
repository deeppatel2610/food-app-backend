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
    if (!mimeType || mimeType.startsWith("image/") || mimeType === "application/octet-stream") {
      processedBuffer = await sharp(imageBuffer)
        .resize({
          width: 512,
          height: 512,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 70 })
        .toBuffer();
      targetMimeType = "image/jpeg";
    }
  } catch (err) {
    console.error(
      "[Sharp Optimization Error] Failed to optimize image. Sending original buffer:",
      err,
    );
  }

  // Model fallback chain: try ultra-fast gemini-3.5-flash-lite first, then gemini-3.6-flash, then gemini-2.5-flash
  const modelsToTry = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
  ];

  let lastError;

  for (const modelName of modelsToTry) {
    try {
      const generatePromise = ai.models.generateContent({
        model: modelName,
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

      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Gemini API request timed out after 25 seconds")),
          25000,
        );
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      clearTimeout(timeoutId);

      return response.text;
    } catch (error) {
      lastError = error;
      console.warn(
        `[Gemini Model Error] Model ${modelName} failed: ${error.message}. Attempting fallback to next model...`,
      );
    }
  }

  throw lastError || new Error("All Gemini models failed to process the image");
}

/**
 * Generates an AI-powered personalized BMI Health and Nutrition Report using Gemini.
 *
 * @param {Object} userDetails - User profile details (weight, height, age, blood_group, health_problem, bmi, etc.)
 * @returns {Promise<Object>} The structured BMI analysis JSON
 */
async function generateAIBmiReport(userDetails) {
  const {
    first_name = "User",
    age,
    weight,
    height,
    bmi,
    bmi_category,
    blood_group,
    health_problem,
  } = userDetails;

  const modelsToTry = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
  ];

  const systemInstruction = `You are a certified clinical nutritionist, preventive health specialist, and fitness advisor.
Your task is to generate a comprehensive, highly personalized, encouraging, and scientifically sound BMI Health Report for the user.

Analyze the user's metrics:
- Height and Weight to evaluate body composition status
- Age to consider metabolic rate, bone density, and life-stage nutrition
- Blood Group (if provided) for general dietary synergy
- Health Problems/Pre-existing conditions (if provided) to ensure ALL recommendations are safe, tailored, and considerate of medical limitations.

Return ONLY a valid JSON object matching the following structure exactly:
{
  "bmi": 24.2,
  "bmi_category": "Normal weight / Underweight / Overweight / Obese",
  "ideal_weight_range": {
    "min_kg": 58.0,
    "max_kg": 74.0
  },
  "health_status_summary": "A 2-3 sentence personalized summary explaining the user's current weight status and metabolic context.",
  "risk_assessment": [
    "Specific health risk or protective factor 1 based on their BMI and reported health history",
    "Specific health risk or protective factor 2"
  ],
  "personalized_diet_plan": {
    "daily_calories": 2100,
    "macronutrient_split": {
      "protein_percentage": 25,
      "carbs_percentage": 50,
      "fat_percentage": 25
    },
    "key_foods_to_include": [
      "Nutrient-dense food item 1 with explanation",
      "Nutrient-dense food item 2 with explanation",
      "Nutrient-dense food item 3 with explanation"
    ],
    "foods_to_limit": [
      "Specific food/ingredient to reduce or avoid",
      "Specific food/ingredient to reduce or avoid"
    ]
  },
  "workout_recommendations": {
    "weekly_goal_summary": "E.g. 150 minutes of moderate aerobic activity + 2 strength sessions",
    "suggested_exercises": [
      "Activity 1 (e.g. Brisk walking or Cycling - 30 mins, 4x/week)",
      "Activity 2 (e.g. Bodyweight resistance training - 20 mins, 3x/week)"
    ],
    "safety_precautions": "Precautionary note based on user's weight or reported health problems"
  },
  "lifestyle_and_hydration_tips": [
    "Hydration recommendation (e.g. 2.5 - 3.0 L/day)",
    "Sleep and stress tip"
  ],
  "motivational_verdict": "An empowering, supportive concluding statement inspiring the user to achieve their optimal vitality."
}

RULES:
- All numbers must be realistic based on user's data (e.g., standard formula for ideal BMI 18.5 - 24.9).
- If health problems are listed, adapt the diet and workout recommendations strictly around them.
- Do NOT output markdown code fences, comments, or extra text. Output ONLY the raw JSON string.`;

  const userPrompt = `
User Profile for BMI Analysis:
- Name: ${first_name}
- Age: ${age ? `${age} years old` : "Not provided"}
- Weight: ${weight} kg
- Height: ${height} cm
- Calculated BMI: ${bmi}
- Current BMI Category: ${bmi_category || "Standard calculation"}
- Blood Group: ${blood_group || "Not provided"}
- Health Conditions/Medical Notes: ${health_problem && health_problem !== "None" ? health_problem : "None reported"}
`;

  let lastError;

  for (const modelName of modelsToTry) {
    try {
      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              {
                text: userPrompt,
              },
            ],
          },
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Gemini API request timed out after 25 seconds")),
          25000,
        );
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      clearTimeout(timeoutId);

      const parsed = JSON.parse(response.text);
      parsed.generated_at = new Date().toISOString();
      parsed.model_used = modelName;
      return parsed;
    } catch (error) {
      lastError = error;
      console.warn(
        `[Gemini BMI Report Error] Model ${modelName} failed: ${error.message}. Trying next fallback model...`,
      );
    }
  }

  // Robust fallback in case of network or API outage
  console.error(
    "[Gemini Service Error] All models failed to generate AI BMI report. Using intelligent fallback generator.",
    lastError,
  );
  return getFallbackAIBmiReport(userDetails);
}

/**
 * Deterministic fallback generator when Gemini API is temporarily unavailable
 */
function getFallbackAIBmiReport(userDetails) {
  const {
    first_name = "User",
    age = 25,
    weight = 70,
    height = 175,
    bmi = 22.86,
    bmi_category = "Normal",
    health_problem = "None",
  } = userDetails;

  const heightM = height > 3 ? height / 100 : height;
  const minIdealWeight = Math.round(18.5 * heightM * heightM * 10) / 10;
  const maxIdealWeight = Math.round(24.9 * heightM * heightM * 10) / 10;

  return {
    bmi: parseFloat(bmi),
    bmi_category: bmi_category,
    ideal_weight_range: {
      min_kg: minIdealWeight,
      max_kg: maxIdealWeight,
    },
    health_status_summary: `Hello ${first_name}, your calculated BMI is ${bmi}, classifying you in the ${bmi_category} weight range for a height of ${height} cm.`,
    risk_assessment: [
      bmi_category === "Normal"
        ? "Your current weight supports healthy cardiovascular and metabolic markers."
        : "Maintaining balance through sustainable nutrition helps regulate blood pressure and energy.",
      health_problem && health_problem !== "None"
        ? `Monitored consideration: ${health_problem}.`
        : "No adverse pre-existing conditions reported.",
    ],
    personalized_diet_plan: {
      daily_calories: Math.round((10 * weight) + (6.25 * height) - (5 * age) + 500),
      macronutrient_split: {
        protein_percentage: 25,
        carbs_percentage: 50,
        fat_percentage: 25,
      },
      key_foods_to_include: [
        "Lean proteins such as poultry, fish, tofu, or legumes for cellular repair",
        "High-fiber complex carbohydrates (oats, quinoa, brown rice) for sustained satiety",
        "Leafy greens and colorful vegetables rich in antioxidants and micronutrients",
      ],
      foods_to_limit: [
        "Ultra-processed snacks high in trans-fats and refined corn syrups",
        "High-sugar carbonated beverages",
      ],
    },
    workout_recommendations: {
      weekly_goal_summary: "150 minutes of moderate aerobic activity accompanied by 2 strength-building sessions.",
      suggested_exercises: [
        "Brisk walking, jogging, or cycling 30 minutes, 4-5 times per week",
        "Full-body bodyweight or resistance training 2 times per week",
      ],
      safety_precautions: "Always stay well-hydrated and maintain proper form to avoid joint strain.",
    },
    lifestyle_and_hydration_tips: [
      `Drink at least ${(weight * 0.035).toFixed(1)} liters of water daily.`,
      "Aim for 7 to 8 hours of quality restorative sleep every night.",
    ],
    motivational_verdict: "Consistency is key to lifelong health. Small daily choices lead to extraordinary longevity and vitality!",
    generated_at: new Date().toISOString(),
    model_used: "fallback-health-engine",
  };
}

module.exports = {
  analyzeFood,
  generateAIBmiReport,
};

