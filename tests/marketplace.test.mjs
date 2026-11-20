import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";

async function freePort() {
  return await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}
async function launch(t, extra = {}, prepare) {
  const dir = await mkdtemp(path.join(tmpdir(), "nortov-tests-")),
    port = await freePort(),
    base = `http://localhost:${port}`;
  if (prepare) await prepare(dir);
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATA_DIR: dir,
        COOKIE_SECURE: "false",
        APP_URL: base,
        ...extra,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let logs = "";
  child.stdout.on("data", (d) => (logs += d));
  child.stderr.on("data", (d) => (logs += d));
  t.after(async () => {
    child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null) resolve();
      else child.once("exit", resolve);
      setTimeout(resolve, 2000).unref();
    });
    await rm(dir, { recursive: true, force: true });
  });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error("Server stopped: " + logs);
    try {
      if ((await fetch(base + "/api?view=config")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw Error("Server did not start: " + logs);
  }
  async function post(action, data = {}, cookie = "", origin = base) {
    const response = await fetch(base + "/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({ action, ...data }),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function get(view, cookie = "", query = {}) {
    const q = new URLSearchParams({ view, ...query });
    const response = await fetch(base + "/api?" + q, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    return { status: response.status, body: await response.json() };
  }
  return { base, dir, post, get };
}

test("marketplace transactions, permissions, images and moderation", async (t) => {
  const { base, dir, post, get } = await launch(t);
  const seller = await post("register", {
    name: "Salesman",
    email: "seller@example.test",
    password: "password-123",
  });
  const buyer = await post("register", {
    name: "Buyer",
    email: "buyer@example.test",
    password: "password-123",
  });
  const outsider = await post("register", {
    name: "Another",
    email: "other@example.test",
    password: "password-123",
  });
  assert.equal(seller.status, 200);
  assert.equal(buyer.status, 200);
  assert.equal(outsider.status, 200);
  assert.equal(
    (
      await post(
        "login",
        { email: "buyer@example.test", password: "incorrect" },
        "",
        base,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await post(
        "store",
        { name: "Stranger" },
        seller.cookie,
        "https://attacker.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        "store",
        { name: "Nice store", description: "Description" },
        seller.cookie,
      )
    ).status,
    200,
  );
  const product = {
    name: "Mug",
    description: "Ceramic mug",
    category: "House",
    price: 500,
    stock: 3,
  };
  assert.equal((await post("product", product, seller.cookie)).status, 200);
  let listing = await get("products");
  const p = listing.body.products[0];
  assert.equal(p.seller, "Nice store");
  const store = await get("store", "", { id: seller.body.user.id });
  assert.equal(store.body.store.name, "Nice store");
  assert.equal(store.body.products.length, 1);
  assert.equal(
    (await post("product", { ...product, id: p.id }, buyer.cookie)).status,
    404,
  );
  assert.equal(
    (await post("cartSet", { id: p.id, quantity: 2 }, buyer.cookie)).status,
    200,
  );
  assert.equal(
    (await post("favoriteSet", { id: p.id, enabled: true }, buyer.cookie))
      .status,
    200,
  );
  assert.equal((await get("personal", buyer.cookie)).body.cart[0].quantity, 2);
  const order = {
    name: "Buyer",
    phone: "+79990000000",
    address: "Moscow, street 1",
    comment: "Call",
    key: "order-test-key-0001",
    items: [{ id: p.id, quantity: 2, price: 500 }],
  };
  assert.equal(
    (
      await post(
        "order",
        { ...order, items: [{ id: p.id, quantity: 2, price: 499 }] },
        buyer.cookie,
      )
    ).status,
    409,
  );
  assert.equal((await post("order", order, seller.cookie)).status, 400);
  const first = await post("order", order, buyer.cookie);
  assert.equal(first.status, 200);
  const replay = await post("order", order, buyer.cookie);
  assert.equal(replay.body.orderId, first.body.orderId);
  assert.equal(
    (await post("order", { ...order, address: "Other address" }, buyer.cookie))
      .status,
    409,
  );
  assert.equal((await get("products")).body.products[0].stock, 1);
  assert.equal((await get("personal", buyer.cookie)).body.cart.length, 0);
  const item = (await get("orders", buyer.cookie)).body.items[0];
  assert.equal(
    (await get("messages", outsider.cookie, { id: item.id })).status,
    404,
  );
  assert.equal(
    (
      await post(
        "message",
        { id: item.id, message: "When will you send it?" },
        buyer.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await get("messages", seller.cookie, { id: item.id })).body.messages
      .length,
    1,
  );
  assert.equal(
    (
      await post(
        "review",
        { id: p.id, rating: 5, text: "Great mug" },
        buyer.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await post("status", { id: item.id, status: "completed" }, seller.cookie))
      .status,
    409,
  );
  assert.equal(
    (await post("status", { id: item.id, status: "accepted" }, seller.cookie))
      .status,
    200,
  );
  assert.equal(
    (await post("status", { id: item.id, status: "cancelled" }, buyer.cookie))
      .status,
    409,
  );
  assert.equal(
    (
      await post(
        "status",
        { id: item.id, status: "shipped", tracking: "TRACK123" },
        seller.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await post("status", { id: item.id, status: "completed" }, buyer.cookie))
      .status,
    200,
  );
  assert.equal(
    (
      await post(
        "review",
        { id: p.id, rating: 5, text: "Great mug" },
        buyer.cookie,
      )
    ).status,
    200,
  );
  assert.equal((await get("product", "", { id: p.id })).body.product.rating, 5);
  assert.equal(
    (await post("report", { id: p.id, reason: "Suspicious ad" }, buyer.cookie))
      .status,
    200,
  );
  const second = await post(
    "order",
    {
      ...order,
      key: "order-test-key-0002",
      items: [{ id: p.id, quantity: 1, price: 500 }],
    },
    buyer.cookie,
  );
  assert.equal(second.status, 200);
  const secondItem = (await get("orders", buyer.cookie)).body.items.find(
    (i) => i.order_id === second.body.orderId,
  );
  assert.equal(
    (
      await post(
        "status",
        { id: secondItem.id, status: "cancelled" },
        buyer.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await post(
        "status",
        { id: secondItem.id, status: "cancelled" },
        buyer.cookie,
      )
    ).status,
    409,
  );
  assert.equal((await get("products")).body.products[0].stock, 1);
  const competing = await Promise.all([
    post(
      "order",
      {
        ...order,
        key: "competing-buyer-0001",
        items: [{ id: p.id, quantity: 1, price: 500 }],
      },
      buyer.cookie,
    ),
    post(
      "order",
      {
        ...order,
        key: "competing-other-0001",
        items: [{ id: p.id, quantity: 1, price: 500 }],
      },
      outsider.cookie,
    ),
  ]);
  assert.deepEqual(competing.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await get("products")).body.products[0].stock, 0);
  const image = await sharp({
    create: { width: 12, height: 12, channels: 3, background: "#aabbcc" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append("file", new Blob([image], { type: "image/png" }), "test.png");
  const uploaded = await fetch(base + "/api/upload", {
    method: "POST",
    headers: { Origin: base, Cookie: seller.cookie },
    body: form,
  });
  assert.equal(uploaded.status, 200);
  const imageUrl = (await uploaded.json()).url;
  assert.match(imageUrl, /^\/media\/[a-f0-9]+\.webp$/);
  assert.equal(
    (await fetch(base + imageUrl)).headers.get("content-type"),
    "image/webp",
  );
  assert.equal((await get("admin", seller.cookie)).status, 403);
  assert.equal(
    (
      await post(
        "adminProduct",
        { id: p.id, moderation: "hidden" },
        buyer.cookie,
      )
    ).status,
    403,
  );
  const health = await fetch(base + "/api/health");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  const db = new DatabaseSync(path.join(dir, "marketplace.sqlite"));
  db.prepare("UPDATE users SET is_admin=1 WHERE id=?").run(seller.body.user.id);
  db.close();
  const overview = (await get("admin", seller.cookie)).body;
  assert.equal(overview.stats.users, 3);
  assert.equal(overview.stats.open_reports, 1);
  assert.ok(overview.stats.orders > 0);
  assert.ok(overview.orders.some((order) => order.buyer === "Buyer"));
  assert.equal(overview.audit.length, 0);
  const reports = overview.reports;
  assert.equal(reports.length, 1);
  assert.equal(
    (
      await post(
        "adminReport",
        { id: reports[0].id, status: "resolved" },
        seller.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await post(
        "adminProduct",
        { id: p.id, moderation: "hidden" },
        seller.cookie,
      )
    ).status,
    200,
  );
  assert.equal((await get("products")).body.products.length, 0);
  assert.equal(
    (
      await post(
        "adminProduct",
        { id: p.id, moderation: "approved" },
        seller.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await post(
        "adminUser",
        { id: buyer.body.user.id, suspended: true },
        seller.cookie,
      )
    ).status,
    200,
  );
  assert.equal((await get("orders", buyer.cookie)).status, 401);
  const moderated = (await get("admin", seller.cookie)).body;
  assert.equal(moderated.stats.open_reports, 0);
  assert.deepEqual(
    moderated.audit.map((entry) => entry.action),
    ["adminUser", "adminProduct", "adminProduct", "adminReport"],
  );
  assert.equal(moderated.audit[0].target_id, buyer.body.user.id);
  assert.equal(
    (
      await post(
        "adminProduct",
        { id: 999999, moderation: "hidden" },
        seller.cookie,
      )
    ).status,
    404,
  );
  assert.equal((await get("admin", seller.cookie)).body.audit.length, 4);
});

test("email verification and password recovery invalidate old sessions", async (t) => {
  const { SMTPServer } = await import("smtp-server");
  const messages = [];
  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, session, callback) {
      let body = "";
      stream.on("data", (chunk) => (body += chunk.toString()));
      stream.on("end", () => {
        messages.push(body);
        callback();
      });
    },
  });
  await new Promise((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => smtp.close(resolve)));
  const port = smtp.server.address().port;
  const { post, get } = await launch(t, {
    SMTP_URL: `smtp://127.0.0.1:${port}`,
    MAIL_FROM: "noreply@example.test",
    REQUIRE_EMAIL_VERIFICATION: "true",
  });
  let result = await post("register", {
    name: "Irina",
    email: "mail@example.test",
    password: "password-123",
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.verificationPending, true);
  assert.equal(
    (
      await post("login", {
        email: "mail@example.test",
        password: "password-123",
      })
    ).status,
    403,
  );
  const tokenFrom = (index, param) => {
    const mail = messages[index],
      parts = mail.split(/\r?\n\r?\n/);
    const text = /content-transfer-encoding: base64/i.test(parts[0])
      ? Buffer.from(parts.slice(1).join(""), "base64").toString("utf8")
      : parts
          .slice(1)
          .join("")
          .replace(/=\r?\n/g, "")
          .replace(/=3D/gi, "=");
    const match = text.match(new RegExp(param + "=([a-f0-9]{64})"));
    assert.ok(match, "token not found in mail");
    return match[1];
  };
  let token = tokenFrom(0, "verify");
  assert.equal((await post("verify", { token })).status, 200);
  assert.equal((await post("verify", { token })).status, 400);
  const login = await post("login", {
    email: "mail@example.test",
    password: "password-123",
  });
  assert.equal(login.status, 200);
  assert.equal(
    (await post("forgot", { email: "mail@example.test" })).status,
    200,
  );
  token = tokenFrom(1, "reset");
  assert.equal(
    (await post("reset", { token, password: "new-password-123" })).status,
    200,
  );
  assert.equal((await get("orders", login.cookie)).status, 401);
  assert.equal(
    (
      await post("login", {
        email: "mail@example.test",
        password: "password-123",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await post("login", {
        email: "mail@example.test",
        password: "new-password-123",
      })
    ).status,
    200,
  );
});

test("existing database is migrated without losing products", async (t) => {
  const { get } = await launch(t, {}, (dir) => {
    const db = new DatabaseSync(path.join(dir, "marketplace.sqlite"));
    db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE products(id INTEGER PRIMARY KEY,seller_id INTEGER NOT NULL REFERENCES users(id),name TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,price INTEGER NOT NULL,stock INTEGER NOT NULL,image TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL,product_id INTEGER NOT NULL,seller_id INTEGER NOT NULL,product_name TEXT NOT NULL,price INTEGER NOT NULL,quantity INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'new');`);
    db.prepare("INSERT INTO users(id,name,email,password) VALUES(1,?,?,?)").run(
      "Existing seller",
      "existing@example.test",
      "unused",
    );
    db.prepare(
      "INSERT INTO products(seller_id,name,description,category,price,stock) VALUES(1,?,?,?,?,?)",
    ).run("Existing item", "Description", "Home", 900, 4);
    db.close();
  });
  const result = await get("products");
  assert.equal(result.status, 200);
  assert.equal(result.body.products[0].name, "Existing item");
  assert.equal(result.body.products[0].stock, 4);
});

test("database backup is consistent and never overwrites a file", async (t) => {
  const { spawnSync } = await import("node:child_process");
  const dir = await mkdtemp(path.join(tmpdir(), "nortov-backup-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = new DatabaseSync(path.join(dir, "marketplace.sqlite"));
  source.exec(
    "CREATE TABLE example(value TEXT); INSERT INTO example VALUES ('saved');",
  );
  source.close();
  const target = path.join(dir, "backup.sqlite");
  const opts = { env: { ...process.env, DATA_DIR: dir }, encoding: "utf8" };
  assert.equal(
    spawnSync(process.execPath, ["scripts/backup.mjs", target], opts).status,
    0,
  );
  const backup = new DatabaseSync(target);
  assert.equal(
    backup.prepare("SELECT value FROM example").get().value,
    "saved",
  );
  backup.close();
  assert.equal(
    spawnSync(process.execPath, ["scripts/backup.mjs", target], opts).status,
    1,
  );
});
