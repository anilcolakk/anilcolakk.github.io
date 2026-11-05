// Copies the two tools into docs/ so the site always serves the latest code.
// Run after changing either script:  node build-web.js
const fs = require("fs");
const path = require("path");

for (const file of ["x-unfollower.js", "x-engagement.js"]) {
  fs.copyFileSync(path.join(__dirname, file), path.join(__dirname, "docs", file));
  const version = /const VERSION = "([^"]+)"/.exec(fs.readFileSync(path.join(__dirname, file), "utf8"))?.[1];
  console.log(`docs/${file}  v${version}`);
}
