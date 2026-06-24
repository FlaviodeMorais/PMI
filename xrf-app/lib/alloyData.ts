import fs from "node:fs";
import path from "node:path";

export interface AlloyElementRange {
  raw: string;
  min: number | null;
  max: number | null;
}

export interface AlloyRecord {
  id: string;
  sourceFile: string;
  section: string;
  chapter: string;
  family: string;
  standard: string;
  grade: string;
  steelNumber: string;
  unsNumber: string;
  thicknessMm: string;
  thicknessIn: string;
  elements: Record<string, AlloyElementRange>;
  others: string;
  searchText: string;
}

export interface AlloyDatabase {
  alloys: AlloyRecord[];
  elements: string[];
  families: string[];
  chapters: string[];
  standards: string[];
  totalFiles: number;
}

const ELEMENT_COLUMNS = ["C", "Mn", "Si", "P", "S", "Cr", "Ni", "Mo"];
const EXTRACTED_DIR = path.resolve(process.cwd(), "..", "extracted");

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/).filter(Boolean);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()]));
  });
}

function firstValue(row: Record<string, string>, prefixes: string[]): string {
  for (const prefix of prefixes) {
    const key = Object.keys(row).find((candidate) => candidate === prefix || candidate.startsWith(prefix));
    const value = key ? row[key] : "";
    if (value && value !== "---") return value;
  }
  return "";
}

function normalizeLimit(value: string): number | null {
  const cleaned = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
  if (!cleaned || cleaned === "---") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseElementRange(rawValue: string): AlloyElementRange {
  const raw = rawValue.trim();
  if (!raw || raw === "---") return { raw: "", min: null, max: null };

  const normalized = raw.replace(/[–—]/g, "-").replace(/\s+/g, "");
  const rangeMatch = normalized.match(/^([<>≤≥]?\d+(?:[.,]\d+)?)-([<>≤≥]?\d+(?:[.,]\d+)?)$/);
  if (rangeMatch) {
    return { raw, min: normalizeLimit(rangeMatch[1]), max: normalizeLimit(rangeMatch[2]) };
  }

  const single = normalizeLimit(normalized);
  if (/^(?:>|≥)/.test(normalized)) return { raw, min: single, max: null };
  return { raw, min: null, max: single };
}

function chapterFromSection(section: string): string {
  const match = section.match(/^(\d+(?:\.\d+)?[A-Z]?)/);
  return match?.[1] ?? "Sem capítulo";
}

function familyFromSection(section: string): string {
  const text = section.toLowerCase();
  if (text.includes("stainless")) return "Aços inoxidáveis";
  if (text.includes("carbon")) return "Aços carbono";
  if (text.includes("alloy")) return "Aços ligados";
  if (text.includes("tool")) return "Aços ferramenta";
  if (text.includes("bearing")) return "Aços para rolamentos";
  if (text.includes("spring")) return "Aços mola";
  if (text.includes("cast")) return "Aços fundidos";
  if (text.includes("forging")) return "Forjados";
  return "Outras ligas";
}

export function getAlloyDatabase(): AlloyDatabase {
  const files = fs.readdirSync(EXTRACTED_DIR).filter((file) => file.endsWith(".csv")).sort();
  const alloys: AlloyRecord[] = [];

  for (const file of files) {
    const rows = parseCsv(fs.readFileSync(path.join(EXTRACTED_DIR, file), "utf8"));

    rows.forEach((row, rowIndex) => {
      const section = row.Section || "Sem seção";
      const elements = Object.fromEntries(
        ELEMENT_COLUMNS.map((element) => [element, parseElementRange(row[element] ?? "")]),
      );
      const standard = firstValue(row, ["Standard Designation"]);
      const grade = firstValue(row, ["Grade, Class, Type, Symbol or Name", "Grade, Class, Type, Symbol, or Name"]);
      const steelNumber = firstValue(row, ["Steel Number"]);
      const unsNumber = firstValue(row, ["UNS Number"]);
      const thicknessMm = row["Section Thickness t, mm"] ?? "";
      const thicknessIn = row["t, in."] ?? "";
      const others = row.Others ?? "";

      const searchable = [section, standard, grade, steelNumber, unsNumber, thicknessMm, thicknessIn, others, file]
        .join(" ")
        .toLowerCase();

      alloys.push({
        id: `${file}-${rowIndex}`,
        sourceFile: file,
        section,
        chapter: chapterFromSection(section),
        family: familyFromSection(section),
        standard,
        grade,
        steelNumber,
        unsNumber,
        thicknessMm,
        thicknessIn,
        elements,
        others,
        searchText: searchable,
      });
    });
  }

  const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return {
    alloys,
    elements: ELEMENT_COLUMNS,
    families: unique(alloys.map((alloy) => alloy.family)),
    chapters: unique(alloys.map((alloy) => alloy.chapter)),
    standards: unique(alloys.map((alloy) => alloy.standard.split(" ")[0])),
    totalFiles: files.length,
  };
}
