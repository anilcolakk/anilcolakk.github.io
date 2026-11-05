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

const userscript = `// ==UserScript==
// @name         X araçları
// @namespace    ${SITE}
// @version      ${version}
// @description  Takip etmeyenler ve etkileşim raporu. x.com'da sol alttaki düğmeden açılır. / Unfollowers and engagement report for X.
// @author       anilcolakk
// @homepageURL  ${SITE}
// @downloadURL  ${SITE}/x-araclari.user.js
// @updateURL    ${SITE}/x-araclari.user.js
// @match        https://x.com/*
// @match        https://mobile.x.com/*
// @match        https://twitter.com/*
// @match        https://mobile.twitter.com/*
// @grant        none
// @inject-into  page
// @run-at       document-idle
// @noframes
// ==/UserScript==

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

${launcher.split("\n").map((line) => (line ? "  " + line : line)).join("\n")}
})();
`;
fs.writeFileSync(path.join(__dirname, "docs", "x-araclari.user.js"), userscript);
console.log(`docs/x-araclari.user.js  ${version}  ${Math.round(userscript.length / 1024)} KB`);
