const app = require("./app");
const envVariables = require("./src/utils/envVariables");
const { createUserTable } = require("./src/models/userModel");
const { createFoodAnalysisTable } = require("./src/models/foodModel");

app.listen(envVariables.PORT, async () => {
  await createUserTable();
  await createFoodAnalysisTable();
  console.log(`Server is running on ${envVariables.HOST}:${envVariables.PORT}`);
  console.log(`http://${envVariables.HOST}:${envVariables.PORT}/api-docs`);
});
