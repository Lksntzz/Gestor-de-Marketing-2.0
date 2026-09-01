export type EditorialSqlBinding = string | number | null;

function firstDefined(record: Record<string, unknown>, snakeCase: string, camelCase: string): unknown {
  return record[snakeCase] ?? record[camelCase];
}

function requiredText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function nullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/**
 * node:sqlite does not accept JavaScript `undefined` as a bind parameter.
 * This function is the single boundary between the editorial domain object and
 * SQLite, so every optional field is normalized to SQL NULL before stmt.run().
 */
export function editorialItemSqlBindings(item: Record<string, unknown>): EditorialSqlBinding[] {
  return [
    requiredText(item.id),
    requiredText(item.title),
    nullableText(firstDefined(item, "content_type", "contentType")),
    nullableText(item.platform),
    nullableText(item.objective),
    nullableText(firstDefined(item, "scheduled_date", "scheduledDate")),
    nullableText(firstDefined(item, "scheduled_time", "scheduledTime")),
    nullableText(item.status),
    nullableText(item.priority),
    nullableText(firstDefined(item, "idea_id", "ideaId")),
    nullableText(firstDefined(item, "script_id", "scriptId")),
    nullableText(firstDefined(item, "campaign_id", "campaignId")),
    nullableText(firstDefined(item, "obsidian_path", "obsidianPath")),
    nullableText(item.notes),
    nullableNumber(firstDefined(item, "created_at", "createdAt")),
    nullableNumber(firstDefined(item, "updated_at", "updatedAt")),
  ];
}
