import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import { db, digest, newToken, rateLimit, transaction } from "./db";
import { assert, requiredText, requireUser } from "./validation";

const scrypt = promisify(scryptCallback);
const dummyPassword =
  "eac7a22fb8238e0b0299b7594c1e4893:5c0f67870de072b1790d4d1ec5c39b199e03c78fc67c0257155c14b7664639d411a3c6200587da0e1517a5ee89a40347b9e773f6544d16c343ad854d5b99af31";
export async function createPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await scrypt(password, salt, 64)).toString("hex");
}
export async function verifyPassword(password, stored) {
  const [salt, hex] = stored.split(":");
  const expected = Buffer.from(hex, "hex");
  const actual = await scrypt(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const mailConfigured = () =>
  Boolean(process.env.SMTP_URL && process.env.MAIL_FROM && process.env.APP_URL);
const verifiedRequired = () =>
  process.env.REQUIRE_EMAIL_VERIFICATION === "true";
function passwordValue(value) {
  assert(
    typeof value === "string" && value.length >= 8 && value.length <= 128,
    "The password must contain from 8 to 128 characters",
  );
  return value;
}
function emailValue(value) {
  const email = requiredText(value, "Email", 3, 254).toLowerCase();
  assert(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    "Please indicate correct email",
  );
  return email;
}
function throttle(key, limit, minutes) {
  assert(
    rateLimit(key, limit, minutes * 60_000),
    "Too many tries. Try again later.",
    429,
  );
}
async function sendToken(account, purpose) {
  assert(mailConfigured(), "Sending emails is not configured", 503);
  const token = newToken();
  db.prepare("DELETE FROM email_tokens WHERE user_id=? AND purpose=?").run(
    account.id,
    purpose,
  );
  db.prepare("INSERT INTO email_tokens VALUES(?,?,?,?)").run(
    digest(token),
    account.id,
    purpose,
    Date.now() + 60 * 60_000,
  );
  const link = new URL("/", process.env.APP_URL);
  link.searchParams.set(purpose === "verify" ? "verify" : "reset", token);
  const subject =
    purpose === "verify"
      ? "Confirm your email at Nortov"
      : "Password recovery Nortov";
  const transport = nodemailer.createTransport(process.env.SMTP_URL);
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to: account.email,
      subject,
      text: `${subject}\n\nOpen the link within an hour: ${link.href}\n\nIf you did not make this request, please ignore this email.`,
    });
  } catch (error) {
    db.prepare("DELETE FROM email_tokens WHERE token_hash=?").run(
      digest(token),
    );
    console.error("Email delivery failed:", error.message);
    throw new Error("Email delivery failed");
  }
}
export async function authAction(action, body, user, ipKey) {
  if (action === "register") {
    if (verifiedRequired())
      assert(
        mailConfigured(),
        "Registration is temporarily unavailable: email is not configured",
        503,
      );
    const email = emailValue(body.email),
      password = passwordValue(body.password),
      name = requiredText(body.name, "Name", 2, 80);
    throttle("register:" + digest(email), 5, 60);
    throttle("register-ip:" + digest(ipKey), ipKey === "local" ? 60 : 20, 60);
    assert(
      !db.prepare("SELECT id FROM users WHERE email=?").get(email),
      "This email already registered",
      409,
    );
    const hash = await createPassword(password);
    let result;
    try {
      result = db
        .prepare("INSERT INTO users(name,email,password) VALUES(?,?,?)")
        .run(name, email, hash);
    } catch (error) {
      if (String(error.message).includes("UNIQUE"))
        assert(false, "This email already registered", 409);
      throw error;
    }
    const account = { id: Number(result.lastInsertRowid), email, name };
    if (verifiedRequired()) {
      await sendToken(account, "verify");
      return { verificationPending: true };
    }
    return { signIn: account.id };
  }
  if (action === "login") {
    const email = emailValue(body.email),
      password = passwordValue(body.password);
    throttle("login:" + digest(email), 10, 15);
    throttle("login-ip:" + digest(ipKey), ipKey === "local" ? 200 : 80, 15);
    const account = db.prepare("SELECT * FROM users WHERE email=?").get(email);
    const valid = await verifyPassword(
      password,
      account?.password || dummyPassword,
    );
    assert(
      account && valid && !account.suspended,
      "Incorrect email or password",
      401,
    );
    assert(
      !verifiedRequired() || account.email_verified,
      "Confirm your email address",
      403,
    );
    db.prepare("DELETE FROM rate_limits WHERE key=?").run(
      "login:" + digest(email),
    );
    return { signIn: account.id };
  }
  if (action === "forgot" || action === "resendVerification") {
    assert(mailConfigured(), "Sending emails is not configured", 503);
    const email = emailValue(body.email);
    throttle(action + ":" + digest(email), 3, 30);
    throttle(action + "-ip:" + digest(ipKey), ipKey === "local" ? 100 : 30, 30);
    const account = db
      .prepare(
        "SELECT id,email,email_verified FROM users WHERE email=? AND suspended=0",
      )
      .get(email);
    if (account && (action === "forgot" || !account.email_verified))
      await sendToken(account, action === "forgot" ? "reset" : "verify");
    return { ok: true };
  }
  if (action === "verify" || action === "reset") {
    const token = requiredText(body.token, "Link", 64, 64);
    assert(/^[a-f0-9]{64}$/.test(token), "Link is invalid");
    throttle(action + ":" + digest(ipKey), 30, 15);
    const purpose = action === "verify" ? "verify" : "reset";
    const record = db
      .prepare(
        "SELECT * FROM email_tokens WHERE token_hash=? AND purpose=? AND expires>?",
      )
      .get(digest(token), purpose, Date.now());
    assert(record, "Link is invalid or outdated");
    const passwordHash =
      action === "reset"
        ? await createPassword(passwordValue(body.password))
        : null;
    transaction(() => {
      const current = db
        .prepare(
          "SELECT * FROM email_tokens WHERE token_hash=? AND purpose=? AND expires>?",
        )
        .get(digest(token), purpose, Date.now());
      assert(current, "Link is invalid or outdated");
      if (action === "verify")
        db.prepare("UPDATE users SET email_verified=1 WHERE id=?").run(
          current.user_id,
        );
      else {
        db.prepare("UPDATE users SET password=? WHERE id=?").run(
          passwordHash,
          current.user_id,
        );
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(current.user_id);
      }
      db.prepare("DELETE FROM email_tokens WHERE user_id=? AND purpose=?").run(
        current.user_id,
        purpose,
      );
    });
    return { ok: true };
  }
  if (action === "profile") {
    requireUser(user);
    const name = requiredText(body.name, "Name", 2, 80);
    db.prepare("UPDATE users SET name=? WHERE id=?").run(name, user.id);
    return { ok: true };
  }
  if (action === "password") {
    requireUser(user);
    throttle("password:" + user.id, 10, 15);
    const account = db
      .prepare("SELECT password FROM users WHERE id=?")
      .get(user.id);
    assert(
      typeof body.currentPassword === "string" &&
        (await verifyPassword(body.currentPassword, account.password)),
      "Current password is incorrect",
      403,
    );
    const password = await createPassword(passwordValue(body.password));
    transaction(() => {
      db.prepare("UPDATE users SET password=? WHERE id=?").run(
        password,
        user.id,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
    });
    return { signOut: true };
  }
  return null;
}
