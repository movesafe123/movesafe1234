#!/usr/bin/env node
/**
 * Đồng bộ mã nguồn tĩnh từ thư mục gốc sang public/ (phục vụ Firebase Hosting / GitHub Pages).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const ROOT_FILES = ['index.html', 'pipeline-log.html'];
const SYNC_DIRS = ['css', 'js', 'data'];

function countCopied(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    let total = 0;
    for (const entry of fs.readdirSync(src)) {
      total += countCopied(path.join(src, entry), path.join(dest, entry));
    }
    return total;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return 1;
}

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
let copiedFiles = 0;

for (const file of ROOT_FILES) {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(PUBLIC_DIR, file));
    copiedFiles += 1;
  }
}

for (const dir of SYNC_DIRS) {
  const srcDir = path.join(ROOT, dir);
  if (fs.existsSync(srcDir)) {
    copiedFiles += countCopied(srcDir, path.join(PUBLIC_DIR, dir));
  }
}

console.log(`[sync:public] Đã đồng bộ ${copiedFiles} tệp từ thư mục gốc sang public/.`);
