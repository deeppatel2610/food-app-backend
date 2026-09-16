const app = require("./app");
const envVariables = require("./src/utils/envVariables");
const { createUserTable } = require("./src/models/userModel");
const { createFoodAnalysisTable } = require("./src/models/foodModel");
const { createWorkoutTables } = require("./src/models/workoutModel");
const { initScheduledTasks } = require("./src/utils/cronScheduler");

app.listen(envVariables.PORT, async () => {
  await createUserTable();
  await createFoodAnalysisTable();
  await createWorkoutTables();
  initScheduledTasks();
  console.log(`Server is running on ${envVariables.HOST}:${envVariables.PORT}`);
  console.log(`http://${envVariables.HOST}:${envVariables.PORT}/api-docs`);
});
