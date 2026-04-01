// Generates out/__ENV.js with NEXT_PUBLIC_* env vars baked in at build time.
// The build script loads ../../.env via dotenv (`pnpm with-env`), so all
// NEXT_PUBLIC_* vars from .env are available in process.env here.
const fs = require("fs");

const envVars = {};
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_")) {
    envVars[key] = value;
  }
}

fs.writeFileSync(
  "out/__ENV.js",
  `window.__ENV = ${JSON.stringify(envVars)};`,
);
console.log("Generated out/__ENV.js with keys:", Object.keys(envVars).join(", ") || "(none)");
