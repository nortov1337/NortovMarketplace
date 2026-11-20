export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function assert(condition, message, status = 400) {
  if (!condition) throw new HttpError(message, status);
}
export function requiredText(value, label, min, max) {
  assert(typeof value === "string", `Укажите ${label}`);
  const result = value.trim();
  assert(
    result.length >= min && result.length <= max,
    `${label}: от ${min} до ${max} символов`,
  );
  return result;
}
export function optionalText(value, label, max) {
  assert(
    value === undefined || typeof value === "string",
    `Проверьте ${label}`,
  );
  const result = (value || "").trim();
  assert(result.length <= max, `${label}: не более ${max} символов`);
  return result;
}
export function int(value, label, min, max) {
  assert(
    (typeof value === "number" ||
      (typeof value === "string" && /^\d+$/.test(value))) &&
      Number.isSafeInteger(Number(value)),
    `Проверьте ${label}`,
  );
  const n = Number(value);
  assert(n >= min && n <= max, `Проверьте ${label}`);
  return n;
}
export function requireUser(user) {
  assert(user, "Войдите в аккаунт", 401);
  return user;
}
export function requireAdmin(user) {
  requireUser(user);
  assert(user.is_admin, "Недостаточно прав", 403);
}
export function checkOrigin(req) {
  const origin = req.headers.get("origin");
  assert(origin, "Недопустимый источник запроса", 403);
  let expected = process.env.APP_URL;
  if (!expected)
    expected = `${req.headers.get("x-forwarded-proto") === "https" && process.env.TRUST_PROXY === "true" ? "https" : new URL(req.url).protocol.replace(":", "")}://${req.headers.get("host")}`;
  try {
    assert(
      new URL(origin).origin === new URL(expected).origin,
      "Недопустимый источник запроса",
      403,
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError("Недопустимый источник запроса", 403);
  }
}
export function clientKey(req) {
  if (process.env.TRUST_PROXY === "true") {
    const address =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim();
    if (address && address.length <= 100) return address;
  }
  return "local";
}
export async function readJson(req, limit = 65536) {
  assert(
    (req.headers.get("content-type") || "")
      .toLowerCase()
      .startsWith("application/json"),
    "Ожидается JSON",
    415,
  );
  assert(
    Number(req.headers.get("content-length") || 0) <= limit,
    "Запрос слишком большой",
    413,
  );
  const reader = req.body?.getReader();
  assert(reader, "Пустой запрос");
  let total = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new HttpError("Запрос слишком большой", 413);
    }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert(
      body && typeof body === "object" && !Array.isArray(body),
      "Некорректные данные",
    );
    return body;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError("Некорректные данные");
  }
}
