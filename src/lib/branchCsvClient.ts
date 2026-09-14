export type ParsedBranchClient = {
  name: string;
  code: string;
  external_branch_id: string | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  active: boolean;
};

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

function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

function parseOptionalNumber(raw: string): number | null | "invalid" {
  if (!raw.trim()) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : "invalid";
}

function validateBranchRow(row: Record<string, string>): {
  ok: true;
  branch: ParsedBranchClient;
} | { ok: false; reason: string } {
  const name = (row.name ?? "").trim();
  if (!name) return { ok: false, reason: "Missing name" };

  const codeSource = (row.code ?? row.branchcode ?? name).trim();
  const code = normalizeCode(codeSource);
  if (!code) return { ok: false, reason: "Missing or invalid code" };
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(code)) {
    return { ok: false, reason: "Invalid code format" };
  }

  const external =
    (row.externalbranchid ?? row.externalid ?? "").trim() || null;
  const pickupAddress = (row.pickupaddress ?? "").trim() || null;
  const lat = parseOptionalNumber(row.pickuplat ?? "");
  const lng = parseOptionalNumber(row.pickuplng ?? "");
  if (lat === "invalid") return { ok: false, reason: "Invalid pickup_lat" };
  if (lng === "invalid") return { ok: false, reason: "Invalid pickup_lng" };
  if ((lat == null) !== (lng == null)) {
    return { ok: false, reason: "pickup_lat and pickup_lng must both be set or both empty" };
  }

  const activeRaw = (row.active ?? "true").trim().toLowerCase();
  const active =
    activeRaw === "" || activeRaw === "true" || activeRaw === "1" || activeRaw === "yes";

  return {
    ok: true,
    branch: {
      name,
      code,
      external_branch_id: external,
      pickup_address: pickupAddress,
      pickup_lat: lat,
      pickup_lng: lng,
      active,
    },
  };
}

/** Browser CSV parse → `{ branches: [...] }` for POST /branches/bulk. */
export function parseBranchCsvClient(csvText: string): {
  valid: ParsedBranchClient[];
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
  const valid: ParsedBranchClient[] = [];
  const errors: RowError[] = [];
  const seenCodes = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    const line = i + 1;
    const result = validateBranchRow(row);
    if (!result.ok) {
      errors.push({ line, reason: result.reason });
      continue;
    }
    if (seenCodes.has(result.branch.code)) {
      errors.push({ line, reason: `Duplicate code in file: ${result.branch.code}` });
      continue;
    }
    seenCodes.add(result.branch.code);
    valid.push(result.branch);
  }

  return { valid, errors };
}

export const BRANCH_CSV_TEMPLATE = `name,code,external_branch_id,pickup_address,pickup_lat,pickup_lng
DHA Phase 5,dha-5,GL-OUT-101,"DHA Phase 5, Karachi",24.81,67.06
Clifton,clifton,GL-OUT-102,"Clifton, Karachi",24.81,67.03
`;
