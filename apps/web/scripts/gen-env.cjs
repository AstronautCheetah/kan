// Generates out/__ENV.js with NEXT_PUBLIC_* env vars for next-runtime-env
const fs = require("fs");
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => k.startsWith("NEXT_PUBLIC_"))
);
fs.writeFileSync("out/__ENV.js", "window.__ENV = " + JSON.stringify(env) + ";");
console.log("Generated out/__ENV.js with keys:", Object.keys(env).join(", "));
