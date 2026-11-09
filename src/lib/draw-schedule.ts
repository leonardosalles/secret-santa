import { APP_YEAR } from "./app-config";

// Midnight in Brasília (UTC-03:00), independent of the browser's timezone.
export const DRAW_UNLOCK_AT = `${APP_YEAR}-12-05T00:00:00-03:00`;
export const DRAW_UNLOCK_LABEL = `05/12/${APP_YEAR}, às 00h (horário de Brasília)`;

export function areDrawsOpen(now = Date.now()) {
  return now >= Date.parse(DRAW_UNLOCK_AT);
}
