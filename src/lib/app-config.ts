export const IS_TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === "true";
export const APP_YEAR = process.env.NEXT_PUBLIC_APP_YEAR || "2026";

// Keep every Firebase mutation behind this guard, including future write flows.
export async function runFirebaseWrite(write: () => Promise<unknown>) {
  if (IS_TEST_MODE) return;
  await write();
}
