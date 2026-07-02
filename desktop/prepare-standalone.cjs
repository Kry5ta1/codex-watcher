const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

copyIntoStandalone(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
copyIntoStandalone(path.join(root, "public"), path.join(standalone, "public"));

function copyIntoStandalone(from, to) {
  if (!fs.existsSync(standalone)) {
    throw new Error("Next standalone 输出不存在。请确认 next.config.js 已启用 output: \"standalone\"。");
  }
  if (!fs.existsSync(from)) {
    return;
  }
  fs.rmSync(to, { force: true, recursive: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}
