import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { existsSync } from "node:fs";
const destination = process.argv[2];
if (!destination) {
  console.error("Usage: npm run backup -- /path/to/new-backup.sqlite");
  process.exit(1);
}
const target = path.resolve(destination);
if (existsSync(target)) {
  console.error("The destination already exists. Choose a new file.");
  process.exit(1);
}
const source = path.resolve(
  process.env.DATA_DIR || "data",
  "marketplace.sqlite",
);
if (!existsSync(source)) {
  console.error("Database not found:", source);
  process.exit(1);
}
const db = new DatabaseSync(source);
try {
  db.prepare("VACUUM INTO ?").run(target);
  console.log("Database backup created:", target);
} finally {
  db.close();
}
