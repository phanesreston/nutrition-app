import "server-only";
import { connection } from "next/server";
import { resolveDay, todayIso } from "@/lib/dates";

/**
 * Today's date, read at request time. Reading the clock is request-time work,
 * so wait for the connection first — otherwise Next.js would try to bake the
 * date into a prerendered shell.
 */
export async function getToday(): Promise<string> {
  await connection();
  return todayIso();
}

/** The day selected by `?date=` (defaulting to today), plus today itself. */
export async function getSelectedDay(
  searchParams: Promise<{ date?: string | string[] }>,
): Promise<{ date: string; today: string }> {
  const { date } = await searchParams;
  const today = await getToday();
  return { date: resolveDay(date, today), today };
}
