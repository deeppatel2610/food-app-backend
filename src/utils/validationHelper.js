/**
 * Helper to validate user fields for registration (add) and profile edits (update).
 * 
 * @param {Object} data Request body data
 * @param {Boolean} isUpdate Flag indicating if it is an update (PUT) operation
 * @returns {Object} { isValid: Boolean, error: String|Null }
 */
const validateUserFields = (data, isUpdate = false) => {
  const {
    first_name,
    last_name,
    username,
    email,
    password,
    age,
    weight,
    height,
    blood_group,
    health_problem,
  } = data;

  // 1. Check for unexpected fields on update
  if (isUpdate && password !== undefined) {
    return {
      isValid: false,
      error: "Password updates are not allowed via this endpoint.",
    };
  }

  // 2. Required Fields check for Add (Registration)
  if (!isUpdate) {
    if (!first_name || typeof first_name !== "string" || first_name.trim() === "") {
      return { isValid: false, error: "First name is required." };
    }
    if (!last_name || typeof last_name !== "string" || last_name.trim() === "") {
      return { isValid: false, error: "Last name is required." };
    }
    if (!username || typeof username !== "string" || username.trim() === "") {
      return { isValid: false, error: "Username is required." };
    }
    if (!email || typeof email !== "string" || email.trim() === "") {
      return { isValid: false, error: "Email is required." };
    }
    if (!password || typeof password !== "string" || password.trim() === "") {
      return { isValid: false, error: "Password is required." };
    }
  }

  // 3. Username Validation
  if (username !== undefined) {
    if (typeof username !== "string") {
      return { isValid: false, error: "Username must be a string." };
    }
    const usernameTrimmed = username.trim();
    if (usernameTrimmed.length < 3 || usernameTrimmed.length > 100) {
      return {
        isValid: false,
        error: "Username must be between 3 and 100 characters.",
      };
    }
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(usernameTrimmed)) {
      return {
        isValid: false,
        error: "Username can only contain alphanumeric characters, underscores, and hyphens.",
      };
    }
  }

  // 4. Email Validation
  if (email !== undefined) {
    if (typeof email !== "string") {
      return { isValid: false, error: "Email must be a string." };
    }
    const emailTrimmed = email.trim();
    if (emailTrimmed.length > 255) {
      return { isValid: false, error: "Email must be 255 characters or less." };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return { isValid: false, error: "Please provide a valid email address." };
    }
  }

  // 5. Password Validation (Add only)
  if (!isUpdate && password !== undefined) {
    if (password.length < 6) {
      return {
        isValid: false,
        error: "Password must be at least 6 characters long.",
      };
    }
  }

  // 6. First Name Validation
  if (first_name !== undefined) {
    if (first_name === null || typeof first_name !== "string" || first_name.trim() === "") {
      return { isValid: false, error: "First name is required and cannot be empty." };
    }
    const nameTrimmed = first_name.trim();
    if (nameTrimmed.length > 100) {
      return {
        isValid: false,
        error: "First name must be 100 characters or less.",
      };
    }
    const nameRegex = /^[a-zA-Z\s-]+$/;
    if (!nameRegex.test(nameTrimmed)) {
      return {
        isValid: false,
        error: "First name can only contain letters, spaces, and hyphens.",
      };
    }
  }

  // 7. Last Name Validation
  if (last_name !== undefined) {
    if (last_name === null || typeof last_name !== "string" || last_name.trim() === "") {
      return { isValid: false, error: "Last name is required and cannot be empty." };
    }
    const nameTrimmed = last_name.trim();
    if (nameTrimmed.length > 100) {
      return {
        isValid: false,
        error: "Last name must be 100 characters or less.",
      };
    }
    const nameRegex = /^[a-zA-Z\s-]+$/;
    if (!nameRegex.test(nameTrimmed)) {
      return {
        isValid: false,
        error: "Last name can only contain letters, spaces, and hyphens.",
      };
    }
  }

  // 8. Age Validation
  if (age !== undefined && age !== null && age !== "") {
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 120) {
      return {
        isValid: false,
        error: "Age must be a valid positive number between 1 and 120.",
      };
    }
  }

  // 9. Weight Validation
  if (weight !== undefined && weight !== null && weight !== "") {
    const parsedWeight = parseFloat(weight);
    if (isNaN(parsedWeight) || parsedWeight < 2.0 || parsedWeight > 500.0) {
      return {
        isValid: false,
        error: "Weight must be a valid number between 2.0 kg and 500.0 kg.",
      };
    }
  }

  // 10. Height Validation
  if (height !== undefined && height !== null && height !== "") {
    const parsedHeight = parseFloat(height);
    if (isNaN(parsedHeight)) {
      return { isValid: false, error: "Height must be a valid number." };
    }
    // Accept either meters (0.3 to 3.0) or centimeters (30 to 300)
    const isValidMeters = parsedHeight >= 0.3 && parsedHeight <= 3.0;
    const isValidCm = parsedHeight >= 30.0 && parsedHeight <= 300.0;
    if (!isValidMeters && !isValidCm) {
      return {
        isValid: false,
        error: "Height must be between 30 cm and 300 cm (or 0.3 m and 3.0 m).",
      };
    }
  }

  // 11. Blood Group Validation
  if (blood_group !== undefined && blood_group !== null && blood_group !== "") {
    if (typeof blood_group !== "string") {
      return { isValid: false, error: "Blood group must be a string." };
    }
    const validBloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
    const normalizedBG = blood_group.trim().toUpperCase();
    if (!validBloodGroups.includes(normalizedBG)) {
      return {
        isValid: false,
        error: `Blood group must be one of: ${validBloodGroups.join(", ")}`,
      };
    }
  }

  // 12. Health Problem Validation
  if (health_problem !== undefined && health_problem !== null && health_problem !== "") {
    if (typeof health_problem !== "string") {
      return { isValid: false, error: "Health problem must be a string." };
    }
  }

  return { isValid: true, error: null };
};

module.exports = {
  validateUserFields,
};
