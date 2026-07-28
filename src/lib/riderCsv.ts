import "server-only";
import { parse } from "csv-parse/sync";
import { cleanPhoneInput, isValidPakistaniMobile, PK_MOBILE_HINT } from "@/lib/phone";

export type ParsedRider = { name: string; phone: string; license_plate: string };
export type RowError = { line: number; reason: string };

// Same three fields the manual "Add Rider" form requires, matching column
// order but tolerant of it -- header names are matched case/spacing-
// insensitively so "License Plate", "license_plate", and "LicensePlate"
// all resolve to the same field.
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_]+/g, "");
}

// Never throws over a few bad rows -- returns every valid row for
// insertion alongside a line-numbered reason for every row that failed,
// so a ~400-row import doesn't get discarded wholesale over a handful of
// typos. `line` counts the header as line 1, matching what a merchant
// would see if they opened the file in a spreadsheet editor.
export function parseRiderCsv(csvText: string): { valid: ParsedRider[]; errors: RowError[] } {
  let records: Record<string, string>[];
  try {
    records = parse(csvText, {
      columns: (header: string[]) => header.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    return { valid: [], errors: [{ line: 0, reason: "Could not parse this file as CSV." }] };
  }

  const valid: ParsedRider[] = [];
  const errors: RowError[] = [];

  records.forEach((row, index) => {
    const line = index + 2;
    const name = row.name?.trim();
    const phone = row.phone?.trim();
    const licensePlate = row.licenseplate?.trim();

    if (!name) {
      errors.push({ line, reason: "Missing name" });
      return;
    }
    if (!phone || !isValidPakistaniMobile(phone)) {
      errors.push({ line, reason: `Missing or invalid phone -- ${PK_MOBILE_HINT}` });
      return;
    }
    if (!licensePlate) {
      errors.push({ line, reason: "Missing license plate" });
      return;
    }
    valid.push({ name, phone: cleanPhoneInput(phone), license_plate: licensePlate });
  });

  return { valid, errors };
}
