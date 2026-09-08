import { validateRiderFields, type ParsedRider } from "@/lib/riderValidation";

export type RowError = { line: number; reason: string };

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_]+/g, "");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Browser-safe CSV parse for rider bulk import → Node API `{ riders: [...] }`. */
export function parseRiderCsvClient(csvText: string): {
  valid: ParsedRider[];
  errors: RowError[];
} {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { valid: [], errors: [{ line: 0, reason: "Could not parse this file as CSV." }] };
  }

  const headers = splitCsvLine(lines[0]!).map(normalizeHeader);
  const valid: ParsedRider[] = [];
  const errors: RowError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    const line = i + 1;
    const result = validateRiderFields({
      name: row.name,
      phone: row.phone,
      license_plate: row.licenseplate,
      login_pin: row.loginpin,
    });
    if (!result.ok) {
      errors.push({ line, reason: result.reason });
      continue;
    }
    valid.push(result.rider);
  }

  return { valid, errors };
}
