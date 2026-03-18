import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

async function addDir(zip, dirPath, baseInZip = "") {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dirPath, e.name);
    const inZip = baseInZip ? `${baseInZip}/${e.name}` : e.name;
    if (e.isDirectory()) {
      await addDir(zip, full, inZip);
    } else {
      const buf = await fs.readFile(full);
      zip.file(inZip, buf);
    }
  }
}

const root = process.cwd();
const dist = path.join(root, "dist");
const out = path.join(root, "release");
await fs.mkdir(out, { recursive: true });

const zip = new JSZip();
await addDir(zip, dist, "");
const blob = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 }});
const file = path.join(out, "site.zip");
await fs.writeFile(file, blob);
console.log("Created release/site.zip (upload this to GitHub Pages, etc.)");
