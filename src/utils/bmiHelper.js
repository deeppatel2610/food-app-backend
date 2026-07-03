/**
 * BMI Calculation and Report Generation Helper
 */

const calculateBMI = (weight, height) => {
  if (!weight || !height) return null;
  let heightInMeters = parseFloat(height);
  if (heightInMeters > 3) {
    heightInMeters = heightInMeters / 100;
  }
  const weightInKg = parseFloat(weight);
  if (heightInMeters <= 0 || weightInKg <= 0) return null;
  const bmi = weightInKg / (heightInMeters * heightInMeters);
  return parseFloat(bmi.toFixed(2));
};

const getBMICategory = (bmi) => {
  if (!bmi) return "Unknown";
  if (bmi < 18.5) return "Underweight";
  if (bmi >= 18.5 && bmi < 25.0) return "Normal";
  if (bmi >= 25.0 && bmi < 30.0) return "Overweight";
  return "Obese";
};

const getBMIReport = (bmi, age) => {
  if (!bmi) return "BMI status unavailable.";
  const category = getBMICategory(bmi);
  const userAge = age || 25;
  if (category === "Underweight") {
    return `Your BMI is ${bmi}, indicating you are underweight for your height. Since you are ${userAge} years old, it is essential to focus on high-quality proteins and nutrient-dense, calorie-rich foods to build strength and lean body mass safely.`;
  } else if (category === "Normal") {
    return `Excellent work! Your BMI is ${bmi}, which is in the optimal healthy range. At your age of ${userAge}, maintaining this weight with a diet rich in fruits, vegetables, clean protein, and fiber will support long-term metabolic health.`;
  } else if (category === "Overweight") {
    return `Your BMI is ${bmi}, placing you in the overweight category. For a healthy ${userAge}-year-old, we recommend starting a moderate caloric deficit, focusing on portion control, and increasing daily cardio and strength training activities.`;
  } else {
    return `Your BMI is ${bmi}, indicating obesity. At ${userAge}, it is highly recommended to consult with a medical professional or certified nutritionist. Focus on cardiovascular health, low-glycemic foods, and gradual sustainable habit changes.`;
  }
};

const calculateDailyCalorieBudget = (weight, height, age) => {
  const weightKg = parseFloat(weight) || 70;
  let heightCm = parseFloat(height) || 175;
  if (heightCm <= 3) heightCm = heightCm * 100;
  const userAge = parseInt(age, 10) || 25;
  const bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * userAge) + 5;
  return Math.round(bmr * 1.375);
};

const enrichUserWithBMI = (user) => {
  if (!user) return user;
  if (!user.bmi && user.weight && user.height) {
    user.bmi = calculateBMI(user.weight, user.height);
  }
  if (user.bmi) {
    const bmiNum = parseFloat(user.bmi);
    user.bmi = bmiNum.toFixed(2);
    user.bmi_category = getBMICategory(bmiNum);
    user.bmi_report = getBMIReport(bmiNum, user.age);
  } else {
    user.bmi_category = "Unknown";
    user.bmi_report = "BMI report is unavailable.";
  }
  user.calorie_budget = calculateDailyCalorieBudget(user.weight, user.height, user.age);
  return user;
};

module.exports = {
  calculateBMI,
  getBMICategory,
  getBMIReport,
  calculateDailyCalorieBudget,
  enrichUserWithBMI,
};
