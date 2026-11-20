import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionUser, createSession, deleteSession, db } from "@/lib/db";
import { authAction, mailConfigured } from "@/lib/auth";
import { readView, marketAction } from "@/lib/market";
import { HttpError, checkOrigin, readJson, clientKey } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function response(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function setSession(res, token) {
  res.cookies.set("session", token, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: "/",
    maxAge: token ? 30 * 86400 : 0,
  });
  return res;
}
function failure(error) {
  if (error instanceof HttpError)
    return response({ error: error.message }, error.status);
  console.error("API error:", error);
  return response({ error: "The request failed. Try again later." }, 500);
}
async function current() {
  const jar = await cookies();
  return sessionUser(jar.get("session")?.value);
}
export async function GET(req) {
  try {
    const params = new URL(req.url).searchParams,
      view = params.get("view");
    if (view === "config")
      return response({
        mailConfigured: mailConfigured(),
        verificationRequired: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
      });
    return response(readView(view, params, await current()));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req) {
  try {
    checkOrigin(req);
    const body = await readJson(req);
    const user = await current();
    if (body.action === "logout") {
      const jar = await cookies();
      deleteSession(jar.get("session")?.value);
      return setSession(response({ ok: true }), "");
    }
    const auth = await authAction(body.action, body, user, clientKey(req));
    if (auth) {
      if (auth.signIn) {
        const token = createSession(auth.signIn);
        const account = db
          .prepare(
            "SELECT id,name,email,is_admin,email_verified FROM users WHERE id=?",
          )
          .get(auth.signIn);
        return setSession(response({ user: account }), token);
      }
      if (auth.signOut) return setSession(response({ ok: true }), "");
      return response(auth);
    }
    return response(marketAction(body.action, body, user));
  } catch (error) {
    return failure(error);
  }
}
