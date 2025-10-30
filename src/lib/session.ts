import { cookies } from "next/headers";

const SESSION_KEY = "amigo_secreto_user";

export async function getSessionUser() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_KEY)?.value || null;
}

export async function setSessionUser(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_KEY, userId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionUser() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_KEY);
}
