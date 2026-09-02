export const ANALYTICS_PAGE_SIZE = 1_000

export async function collectPaginated<T>(
  loadPage: (from: number, to: number) => Promise<T[]>,
  pageSize = ANALYTICS_PAGE_SIZE
) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error("A lapméretnek pozitív egész számnak kell lennie.")
  }

  const rows: T[] = []

  while (true) {
    const batch = await loadPage(rows.length, rows.length + pageSize - 1)
    rows.push(...batch)

    if (batch.length < pageSize) return rows
  }
}
