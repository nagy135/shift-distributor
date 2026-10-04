import { db } from "@/lib/db";
import { monthPublications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export { isValidMonthKey } from "./dates";

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
