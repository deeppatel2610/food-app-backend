const https = require("https");
const envVariables = require("./envVariables");

/**
 * Helper to fetch token info from Google using standard node https module.
 */
const fetchTokenInfoWithHttps = (idToken) => {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error_description || parsed.error || `HTTP Status ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error("Failed to parse JSON response from Google"));
        }
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
};

/**
 * Verifies a Google ID Token using Google's public tokeninfo API endpoint.
 * 
 * @param {string} idToken The JWT token received from the frontend
 * @returns {Promise<Object>} The verified user profile details
 */
const verifyGoogleIdToken = async (idToken) => {
  if (!idToken) {
    throw new Error("Google ID token is required.");
  }
  
  try {
    let data;
    // Use native fetch if available (Node 18+), else fallback to https request
    if (typeof fetch === "function") {
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      const response = await fetch(verifyUrl);
      data = await response.json();
      if (!response.ok || data.error || data.error_description) {
        throw new Error(data.error_description || data.error || `HTTP Status ${response.status}`);
      }
    } else {
      data = await fetchTokenInfoWithHttps(idToken);
    }

    if (data.email_verified !== "true" && data.email_verified !== true) {
      throw new Error("Google email is not verified.");
    }

    return {
      googleId: data.sub,
      email: data.email,
      firstName: data.given_name || data.name || "",
      lastName: data.family_name || "",
      picture: data.picture || null,
    };
  } catch (error) {
    console.error("Google Token Verification Error:", error.message);
    throw new Error(`Google token validation failed: ${error.message}`);
  }
};

module.exports = {
  verifyGoogleIdToken,
};
