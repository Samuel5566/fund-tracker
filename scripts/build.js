// 零依赖构建脚本：把可部署的静态文件复制到 dist/。
// 用法：node scripts/build.js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function copyFile(rel) {
  const src = path.join(root, rel);
  const dst = path.join(dist, rel);
  if (!fs.existsSync(src)) {
    console.warn("跳过（不存在）：", rel);
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log("✓", rel);
}

function copyDir(rel) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const p = path.join(rel, entry.name);
    if (entry.isDirectory()) copyDir(p);
    else copyFile(p);
  }
}

// 清空旧的 dist
fs.rmSync(dist, { recursive: true, force: true });

// 复制可部署资源
copyFile("index.html");
copyFile("README.md");
copyFile(".nojekyll");
copyDir("css");
copyDir("js");
copyDir("vendor");

console.log("\n构建完成，输出目录：", dist);
