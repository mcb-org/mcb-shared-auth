import fs from "fs";
import path from "path";

const file = process.argv[2] || path.join(".git", "COMMIT_EDITMSG");
let content = "";
try {
  content = fs.readFileSync(file, "utf8");
} catch (e) {
  console.error("Cannot read commit message file");
  process.exit(1);
}

const cleaned = content
  .split(/\r?\n/)
  .filter((l) => !l.trim().startsWith("#"))
  .join(" ")
  .trim();

const words = cleaned ? cleaned.split(/\s+/) : [];
if (words.length > 100) {
  console.error(
    `Commit message has ${words.length} words, which exceeds the 100-word limit`,
  );
  process.exit(1);
}
process.exit(0);
