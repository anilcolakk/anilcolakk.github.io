// Builds the site files in docs/:
//  - copies the two tools so the site always serves the latest code
//  - writes x-araclari.user.js, one userscript with both tools for phones
//    (Userscripts on iPhone, Tampermonkey / Violentmonkey on Android Firefox)
// Run after changing either script:  node build-web.js
const fs = require("fs");
const path = require("path");

const SITE = "https://anilcolakk.github.io";
const read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8").replace(/\r\n/g, "\n");
const versionOf = (text) => /const VERSION = "([^"]+)"/.exec(text)?.[1] || "0";

const tools = {};
for (const file of ["x-unfollower.js", "x-engagement.js"]) {
  const text = read(file);
  fs.writeFileSync(path.join(__dirname, "docs", file), text);
  tools[file] = text;
  console.log(`docs/${file}  v${versionOf(text)}`);
}

// Userscript managers update when this number grows, so it is the build time.
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const version = `${now.getFullYear()}.${pad(now.getMonth() + 1)}${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`;

const launcher = read("dev/launcher.js");

// Metadata block, shared by the script and the small .meta.js file that
// userscript managers download to check for a newer version.
const meta = `// ==UserScript==
// @name         X araçları
// @namespace    ${SITE}
// @version      ${version}
// @description  Etkileşim çemberi ve takip etmeyenler. x.com'da sol alttaki düğmeden açılır. / Engagement circle and unfollowers for X.
// @author       anilcolakk
// @homepageURL  ${SITE}
// @downloadURL  ${SITE}/x-araclari.user.js
// @updateURL    ${SITE}/x-araclari.meta.js
// @match        https://x.com/*
// @match        https://mobile.x.com/*
// @match        https://twitter.com/*
// @match        https://mobile.twitter.com/*
// @grant        none
// @inject-into  auto
// @run-at       document-idle
// @noframes
// ==/UserScript==
`;

// "auto": run inside the page where allowed; where x.com's security rules block that
// (Safari), the manager runs it in its own context instead. Both tools work in either.
const userscript = `${meta}
// This file holds the two tools from ${SITE} unchanged
// (x-unfollower.js v${versionOf(tools["x-unfollower.js"])}, x-engagement.js v${versionOf(tools["x-engagement.js"])}),
// plus a small button that starts them. Nothing runs until you tap the button.

(() => {
  const TOOLS = {
    unfollower: function () {
${tools["x-unfollower.js"]}
    },
    engagement: function () {
${tools["x-engagement.js"]}
    }
  };
  const BUILD = "${version}";

${launcher.split("\n").map((line) => (line ? "  " + line : line)).join("\n")}
})();
`;
fs.writeFileSync(path.join(__dirname, "docs", "x-araclari.user.js"), userscript);
fs.writeFileSync(path.join(__dirname, "docs", "x-araclari.meta.js"), meta);
console.log(`docs/x-araclari.user.js  ${version}  ${Math.round(userscript.length / 1024)} KB`);
