import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";

export const dataDir = path.resolve(
  /*turbopackIgnore: true*/ process.env.DATA_DIR ||
    path.join(process.cwd(), "data"),
);
mkdirSync(dataDir, { recursive: true });
export const db = new DatabaseSync(path.join(dataDir, "marketplace.sqlite"));
db.exec(`PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL CHECK(price > 0), stock INTEGER NOT NULL CHECK(stock >= 0), image TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, buyer_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, comment TEXT NOT NULL DEFAULT '', total INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), seller_id INTEGER NOT NULL REFERENCES users(id), product_name TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new');
CREATE TABLE IF NOT EXISTS seller_profiles (user_id INTEGER PRIMARY KEY REFERENCES users(id), store_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS favorites (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), PRIMARY KEY(user_id,product_id));
CREATE TABLE IF NOT EXISTS cart_items (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100), PRIMARY KEY(user_id,product_id));
CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), buyer_id INTEGER NOT NULL REFERENCES users(id), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(product_id,buyer_id));
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES order_items(id), sender_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), reporter_id INTEGER NOT NULL REFERENCES users(id), reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS email_tokens (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS checkout_keys (buyer_id INTEGER NOT NULL REFERENCES users(id), key TEXT NOT NULL, fingerprint TEXT NOT NULL, order_id INTEGER NOT NULL REFERENCES orders(id), PRIMARY KEY(buyer_id,key));
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active, category);
CREATE INDEX IF NOT EXISTS idx_items_seller ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_messages_item ON messages(item_id,id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(id DESC);
`);
function addColumn(table, column, definition) {
  if (
    !db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .some((row) => row.name === column)
  ) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (error) {
      // Another process may have applied the same migration while this process was starting.
      if (
        !db
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .some((row) => row.name === column)
      )
        throw error;
    }
  }
}
addColumn("users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "suspended", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "email_verified", "INTEGER NOT NULL DEFAULT 0");
addColumn("products", "moderation", "TEXT NOT NULL DEFAULT 'approved'");
addColumn("order_items", "tracking", "TEXT NOT NULL DEFAULT ''");

const defaultCategories = [
  "Electronics",
  "Clothing & Accessories",
  "House",
  "Beauty & Health",
  "Sports & Outdoors",
  "Books & Media",
  "Toys & Games",
  "Handmade",
  "Other",
];

if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='categories'").get()) {
  transaction(() => {
    if (db.prepare("SELECT 1 FROM sqlite_schema WHERE name='categories'").get())
      return;
    db.exec(`CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1))
    )`);
    const insert = db.prepare("INSERT INTO categories(name) VALUES(?)");
    for (const name of defaultCategories) insert.run(name);
    db.exec(
      "INSERT OR IGNORE INTO categories(name) SELECT DISTINCT category FROM products",
    );
  });
}

export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export function sessionUser(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    db
      .prepare(
        `SELECT u.id,u.name,u.email,u.is_admin,u.email_verified FROM users u
    JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>? AND u.suspended=0`,
      )
      .get(digest(token), Date.now()) || null
  );
}
export function createSession(id) {
  const token = newToken();
  db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
    digest(token),
    id,
    Date.now() + 30 * 86400_000,
  );
  return token;
}
export function deleteSession(token) {
  if (token)
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(token));
}
export function transaction(callback) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function rateLimit(key, limit, duration) {
  const now = Date.now();
  if (Math.random() < 0.01)
    db.prepare("DELETE FROM rate_limits WHERE expires<?").run(now);
  db.prepare(
    `INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,
    expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END`,
  ).run(key, now + duration, now, now);
  return (
    db.prepare("SELECT count FROM rate_limits WHERE key=?").get(key).count <=
    limit
  );
}
