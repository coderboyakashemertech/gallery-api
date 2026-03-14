const config = require("./config");
const { createApp } = require("./app");

const app = createApp();

app.listen(config.port, () => {
  console.log(`Gallery API listening on port ${config.port}`);
  console.log(`Authentication enabled: ${config.authEnabled}`);
});
