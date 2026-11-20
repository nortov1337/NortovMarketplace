import { DatabaseSync } from "node:sqlite";
import path from "node:path";
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run admin -- email@example.com");
  process.exit(1);
}
const db = new DatabaseSync(
  path.resolve(process.env.DATA_DIR || "data", "marketplace.sqlite"),
);
const account = db
  .prepare("SELECT id,name FROM users WHERE email=?")
  .get(email);
if (!account) {
  console.error("Account not found. Register it first.");
  process.exit(1);
}
db.prepare("UPDATE users SET is_admin=1 WHERE id=?").run(account.id);
console.log(`Administrator enabled: ${account.name} (ID ${account.id})`);
db.close();
