// Parser para os arquivos de log exportados pelo equipamento XRF.
// Formato: UTF-16LE com BOM, separado por TAB, celulas tipo Excel `="valor"`,
// numeros em formato BR (virgula decimal).

export interface ParsedElementValue {
  value: number | null;
  tol: number | null;
}

export interface ParsedReading {
  source_file: string;
  reading_date: string;
  reading_time: string;
  reading_number: number;
  averaging: number | null;
  duration: number | null;
  name: string;
  descricao: string | null;
  corrida: string | null;
  qtd: string | null;
  laudo: string | null;
  norma: string | null;
  pass_threshold: number | null;
  pass_fail: string | null;
  match: string | null;
  alloy_1: string | null;
  alloy_2: string | null;
  unit: string | null;
  elements: Record<string, ParsedElementValue>;
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedReading[];
  errors: ParseError[];
}

const FIRST_ELEMENT_COLUMN = 17;

function decodeUtf16(buffer: Buffer): string {
  let text: string;
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    text = new TextDecoder("utf-16le").decode(buffer.subarray(2));
  } else if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    text = new TextDecoder("utf-16be").decode(buffer.subarray(2));
  } else {
    text = new TextDecoder("utf-8").decode(buffer);
  }
  return text.replace(/^﻿/, "");
}

// Remove o encapsulamento `="valor"` usado pelo equipamento para forcar texto no Excel.
function unwrapExcelString(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^="(.*)"$/);
  return match ? match[1] : trimmed;
}

function cleanText(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const value = unwrapExcelString(raw);
  return value === "" ? null : value;
}

// Converte numeros em formato BR (virgula decimal) para number.
function parseNumberBR(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = unwrapExcelString(raw).trim();
  if (value === "") return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

// Converte "DD-MM-YYYY" para "YYYY-MM-DD".
function parseDateBR(raw: string): string | null {
  const value = unwrapExcelString(raw).trim();
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

export function parseXrfCsv(buffer: Buffer, sourceFile: string): ParseResult {
  const text = decodeUtf16(buffer);
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.length > 0);

  const rows: ParsedReading[] = [];
  const errors: ParseError[] = [];

  // Linha 0 = cabecalho, ignorada (estrutura de colunas e fixa).
  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const cols = lines[i].split("\t");

    if (cols.length < FIRST_ELEMENT_COLUMN) {
      errors.push({ line: lineNumber, message: `Linha com poucas colunas (${cols.length})` });
      continue;
    }

    const readingDate = parseDateBR(cols[0]);
    if (!readingDate) {
      errors.push({ line: lineNumber, message: `Data invalida: "${cols[0]}"` });
      continue;
    }

    const readingTime = unwrapExcelString(cols[1]).trim();
    if (!readingTime) {
      errors.push({ line: lineNumber, message: "Hora vazia" });
      continue;
    }

    const readingNumber = parseInt(unwrapExcelString(cols[2]).trim(), 10);
    if (Number.isNaN(readingNumber)) {
      errors.push({ line: lineNumber, message: `Numero de leitura invalido: "${cols[2]}"` });
      continue;
    }

    const elements: Record<string, ParsedElementValue> = {};
    for (let c = FIRST_ELEMENT_COLUMN; c < cols.length; c += 2) {
      const elementName = lines[0].split("\t")[c]?.trim();
      if (!elementName) continue;
      const value = parseNumberBR(cols[c]);
      const tol = parseNumberBR(cols[c + 1]);
      if (value !== null || tol !== null) {
        elements[elementName] = { value, tol };
      }
    }

    rows.push({
      source_file: sourceFile,
      reading_date: readingDate,
      reading_time: readingTime,
      reading_number: readingNumber,
      averaging: parseNumberBR(cols[3]),
      duration: parseNumberBR(cols[4]),
      name: cleanText(cols[5]) ?? "",
      descricao: cleanText(cols[6]),
      corrida: cleanText(cols[7]),
      qtd: cleanText(cols[8]),
      laudo: cleanText(cols[9]),
      norma: cleanText(cols[10]),
      pass_threshold: parseNumberBR(cols[11]),
      pass_fail: cleanText(cols[12]),
      match: cleanText(cols[13]),
      alloy_1: cleanText(cols[14]),
      alloy_2: cleanText(cols[15]),
      unit: cleanText(cols[16]),
      elements,
    });
  }

  return { rows, errors };
}
