import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { monthPublications } from "@/lib/db/schema";

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

export function isValidMonthKey(value: string): boolean {
  return MONTH_KEY_PATTERN.test(value);
}

export async function getMonthPublication(month: string) {
  const record = await db
    .select({
      month: monthPublications.month,
      isPublished: monthPublications.isPublished,
      publishedAt: monthPublications.publishedAt,
      publishedByUserId: monthPublications.publishedByUserId,
      updatedAt: monthPublications.updatedAt,
    })
    .from(monthPublications)
    .where(eq(monthPublications.month, month))
    .get();

  return {
    month,
    isPublished: record?.isPublished ?? true,
    publishedAt: record?.publishedAt ?? null,
    publishedByUserId: record?.publishedByUserId ?? null,
    updatedAt: record?.updatedAt ?? null,
  };
}

export async function listUnpublishedMonths(): Promise<Set<string>> {
  const rows = await db
    .select({ month: monthPublications.month })
    .from(monthPublications)
    .where(eq(monthPublications.isPublished, false));

  return new Set(rows.map((row) => row.month));
}
