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
  sectionPt: string;
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

const SECTION_PT: Record<string, string> = {
  "2.1 Chemical Composition of Carbon Steels for General Use": "2.1 Composição Química de Aços Carbono para Uso Geral",
  "2.2 Chemical Composition of High Manganese Carbon Steels for General Use": "2.2 Composição Química de Aços Carbono de Alto Manganês para Uso Geral",
  "2.3.1 Chromium (Cr) Steels": "2.3.1 Aços ao Cromo (Cr)",
  "2.3.2 Chromium-Molybdenum (Cr-Mo) Steels": "2.3.2 Aços Cromo-Molibdênio (Cr-Mo)",
  "2.3.3 Chromium-Nickel (Cr-Ni) Steels": "2.3.3 Aços Cromo-Níquel (Cr-Ni)",
  "2.3.4 Nickel-Chromium-Molybdenum (Ni-Cr-Mo) Steels": "2.3.4 Aços Níquel-Cromo-Molibdênio (Ni-Cr-Mo)",
  "2.3.5 Chromium-Molybdenum-Aluminum (Cr-Mo-Al) Steels": "2.3.5 Aços Cromo-Molibdênio-Alumínio (Cr-Mo-Al)",
  "2.3.6 Boron (B) Steels": "2.3.6 Aços ao Boro (B)",
  "2.3.7 Chromium-Vanadium (Cr-V) Steels": "2.3.7 Aços Cromo-Vanádio (Cr-V)",
  "3.1B Chemical Composition of Carbon Steels for Structural Steel Plates": "3.1B Composição Química de Aços Carbono para Chapas Estruturais",
  "3.2.1B Chemical Composition of High-Strength Low-Alloy Structural Steel Plates": "3.2.1B Composição Química de Aços de Alta Resistência e Baixa Liga para Chapas Estruturais",
  "3.2.2B Chemical Composition of Alloy Steels for Structural Steel Plates": "3.2.2B Composição Química de Aços Ligados para Chapas Estruturais",
  "3.3B Chemical Composition of Structural Steels with Improved Atmospheric Corrosion-Resistance": "3.3B Composição Química de Aços Estruturais com Resistência Melhorada à Corrosão Atmosférica",
  "4.1B Chemical Composition of Carbon Steel Pressure Vessel Plates": "4.1B Composição Química de Aços Carbono para Chapas de Vasos de Pressão",
  "4.2B Chemical Composition of Carbon Steels for Pressure Vessel Plates - Impact Tested Below -20C": "4.2B Composição Química de Aços Carbono para Chapas de Vasos de Pressão – Ensaio de Impacto Abaixo de -20°C",
  "4.3A Chemical Composition of 1/2 Mo Alloy Steels for Pressure Vessel Plates": "4.3A Composição Química de Aços Ligados 1/2Mo para Chapas de Vasos de Pressão",
  "4.4.1A Chemical Composition of 1/2Cr-1/2Mo Alloy Steels for Pressure Vessel Plates": "4.4.1A Composição Química de Aços Ligados 1/2Cr-1/2Mo para Chapas de Vasos de Pressão",
  "4.4.2A Chemical Composition of 1Cr-1/2Mo Alloy Steels for Pressure Vessel Plates": "4.4.2A Composição Química de Aços Ligados 1Cr-1/2Mo para Chapas de Vasos de Pressão",
  "4.4.3A Chemical Composition of 1.25Cr-1/2Mo Alloy Steels for Pressure Vessel Plates": "4.4.3A Composição Química de Aços Ligados 1,25Cr-1/2Mo para Chapas de Vasos de Pressão",
  "4.4.4A Chemical Composition of 2.25Cr-1Mo Alloy Steels for Pressure Vessel Plates": "4.4.4A Composição Química de Aços Ligados 2,25Cr-1Mo para Chapas de Vasos de Pressão",
  "4.4.5A Chemical Composition of 3Cr-1Mo Alloy Steels for Pressure Vessel Plates": "4.4.5A Composição Química de Aços Ligados 3Cr-1Mo para Chapas de Vasos de Pressão",
  "4.4.6A Chemical Composition of 5Cr-1/2Mo Alloy Steels for Pressure Vessel Plates": "4.4.6A Composição Química de Aços Ligados 5Cr-1/2Mo para Chapas de Vasos de Pressão",
  "4.4.7A Chemical Composition of 9Cr-1Mo Alloy Steels for Pressure Vessel Plates": "4.4.7A Composição Química de Aços Ligados 9Cr-1Mo para Chapas de Vasos de Pressão",
  "4.5.1A Chemical Composition of 1/2Ni Alloy Steels for Pressure Vessel Plates": "4.5.1A Composição Química de Aços Ligados 1/2Ni para Chapas de Vasos de Pressão",
  "4.5.2A Chemical Composition of 1.25Ni Alloy Steels for Pressure Vessel Plates": "4.5.2A Composição Química de Aços Ligados 1,25Ni para Chapas de Vasos de Pressão",
  "4.5.3A Chemical Composition of 2.25Ni Alloy Steels for Pressure Vessel Plates": "4.5.3A Composição Química de Aços Ligados 2,25Ni para Chapas de Vasos de Pressão",
  "4.5.4A Chemical Composition of 3.5Ni Alloy Steels for Pressure Vessel Plates": "4.5.4A Composição Química de Aços Ligados 3,5Ni para Chapas de Vasos de Pressão",
  "4.5.5A Chemical Composition of 5Ni Alloy Steels for Pressure Vessel Plates": "4.5.5A Composição Química de Aços Ligados 5Ni para Chapas de Vasos de Pressão",
  "4.5.6A Chemical Composition of 9Ni Alloy Steels for Pressure Vessel Plates": "4.5.6A Composição Química de Aços Ligados 9Ni para Chapas de Vasos de Pressão",
  "4.6.1A Chemical Composition of 1/4Ni-1/8Mo Alloy Steels for Pressure Vessel Plates": "4.6.1A Composição Química de Aços Ligados 1/4Ni-1/8Mo para Chapas de Vasos de Pressão",
  "4.6.2A Chemical Composition of 3/4Ni-1/2Mo Alloy Steels for Pressure Vessel Plates": "4.6.2A Composição Química de Aços Ligados 3/4Ni-1/2Mo para Chapas de Vasos de Pressão",
  "4.7A Chemical Composition of Ferritic and Martensitic Stainless Steels for Pressure Vessel Plates": "4.7A Composição Química de Aços Inoxidáveis Ferríticos e Martensíticos para Chapas de Vasos de Pressão",
  "4.8A Chemical Composition of Austenitic Stainless Steels for Pressure Vessel Plates": "4.8A Composição Química de Aços Inoxidáveis Austeníticos para Chapas de Vasos de Pressão",
  "4.9A Chemical Composition of Duplex (Ferritic-Austenitic) Stainless Steels for Pressure Vessel Plates": "4.9A Composição Química de Aços Inoxidáveis Duplex (Ferrítico-Austenítico) para Chapas de Vasos de Pressão",
  "5.1B Chemical Composition of Carbon Steel Tubes for General and Structural Applications": "5.1B Composição Química de Tubos de Aço Carbono para Aplicações Gerais e Estruturais",
  "5.2A Chemical Composition of Alloy Steel Tubes for General and Structural Applications": "5.2A Composição Química de Tubos de Aço Ligado para Aplicações Gerais e Estruturais",
  "5.3.1A Chemical Composition of Ferritic and Martensitic Stainless Steel Tubes for General and Structural Applications": "5.3.1A Composição Química de Tubos de Aço Inoxidável Ferrítico e Martensítico para Aplicações Gerais e Estruturais",
  "5.3.2A Chemical Composition of Austenitic Stainless Steel Tubes for General and Structural Applications": "5.3.2A Composição Química de Tubos de Aço Inoxidável Austenítico para Aplicações Gerais e Estruturais",
  "5.4B Chemical Composition of Carbon Steel Tubes and Pipes - Impact Tested Below -20C": "5.4B Composição Química de Tubos e Canos de Aço Carbono – Ensaio de Impacto Abaixo de -20°C",
  "5.5A Chemical Composition of Alloy Steel Tubes and Pipes for Low-Temperature Service": "5.5A Composição Química de Tubos e Canos de Aço Ligado para Serviço em Baixa Temperatura",
  "5.6B Chemical Composition of Carbon Steel Tubes and Pipes for Pressure Purposes": "5.6B Composição Química de Tubos e Canos de Aço Carbono para Uso sob Pressão",
  "5.7B Chemical Composition of Carbon Steel Tubes and Pipes for Pressure Purposes at High Temperatures": "5.7B Composição Química de Tubos e Canos de Aço Carbono para Uso sob Pressão em Altas Temperaturas",
  "5.8.1A Chemical Composition of 1/2Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures": "5.8.1A Composição Química de Tubos e Canos de Aço Ligado 1/2Mo para Uso sob Pressão em Altas Temperaturas",
  "5.8.2A Chemical Composition of 3/4Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures": "5.8.2A Composição Química de Tubos e Canos de Aço Ligado 3/4Mo para Uso sob Pressão em Altas Temperaturas",
  "5.8.3A Chemical Composition of 1/2Cr-1/2Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures": "5.8.3A Composição Química de Tubos e Canos de Aço Ligado 1/2Cr-1/2Mo para Uso sob Pressão em Altas Temperaturas",
  "5.8.4A Chemical Composition of 1Cr-1/2Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures": "5.8.4A Composição Química de Tubos e Canos de Aço Ligado 1Cr-1/2Mo para Uso sob Pressão em Altas Temperaturas",
  "5.8.5A Chemical Composition of 1.25Cr-1/2Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures": "5.8.5A Composição Química de Tubos e Canos de Aço Ligado 1,25Cr-1/2Mo para Uso sob Pressão em Altas Temperaturas",
  "5.8.6A Chemical Composition of 2.25Cr-1Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures": "5.8.6A Composição Química de Tubos e Canos de Aço Ligado 2,25Cr-1Mo para Uso sob Pressão em Altas Temperaturas",
  "5.8.7A Chemical Composition of 5Cr-1/2Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures": "5.8.7A Composição Química de Tubos e Canos de Aço Ligado 5Cr-1/2Mo para Uso sob Pressão em Altas Temperaturas",
  "5.8.8A Chemical Composition of 9Cr-1Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures": "5.8.8A Composição Química de Tubos e Canos de Aço Ligado 9Cr-1Mo para Uso sob Pressão em Altas Temperaturas",
  "5.9.1A Chemical Composition of Ferritic and Martensitic Stainless Steel Tubes and Pipes for Pressure Purposes and High Temperatures": "5.9.1A Composição Química de Tubos e Canos de Aço Inoxidável Ferrítico e Martensítico para Uso sob Pressão em Altas Temperaturas",
  "5.9.2A Chemical Composition of Austenitic Stainless Steel Tubes and Pipes for Pressure Purposes and High Temperatures": "5.9.2A Composição Química de Tubos e Canos de Aço Inoxidável Austenítico para Uso sob Pressão em Altas Temperaturas",
  "5.10.1B Chemical Composition of Line Pipe Steels Without Notch Toughness Requirements": "5.10.1B Composição Química de Aços para Tubulação de Linha sem Requisitos de Tenacidade ao Entalhe",
  "5.10.2B Chemical Composition of Line Pipe Steels With Notch Toughness Requirements": "5.10.2B Composição Química de Aços para Tubulação de Linha com Requisitos de Tenacidade ao Entalhe",
  "6.1.1B Chemical Composition of Carbon Steel Forgings for General Use": "6.1.1B Composição Química de Forjados de Aço Carbono para Uso Geral",
  "6.1.2B Chemical Composition of Carbon Steel Forgings for Piping, Pressure Vessel and Components": "6.1.2B Composição Química de Forjados de Aço Carbono para Tubulações, Vasos de Pressão e Componentes",
  "6.2.1A Chemical Composition of 1.25Cr-0.5Mo Alloy Steel Forgings for General Use": "6.2.1A Composição Química de Forjados de Aço Ligado 1,25Cr-0,5Mo para Uso Geral",
  "6.2.2.1A Chemical Composition of Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.1A Composição Química de Forjados de Aço Ligado Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.2A Chemical Composition of 1/2Cr-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.2A Composição Química de Forjados de Aço Ligado 1/2Cr-1/2Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.3A Chemical Composition of 1Cr-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.3A Composição Química de Forjados de Aço Ligado 1Cr-1/2Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.4A Chemical Composition of 1.25Cr-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.4A Composição Química de Forjados de Aço Ligado 1,25Cr-1/2Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.5A Chemical Composition of 2.25Cr-1Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.5A Composição Química de Forjados de Aço Ligado 2,25Cr-1Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.6A Chemical Composition of 3Cr-1Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.6A Composição Química de Forjados de Aço Ligado 3Cr-1Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.7A Chemical Composition of 5Cr-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.7A Composição Química de Forjados de Aço Ligado 5Cr-1/2Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.8A Chemical Composition of 9Cr-1Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.8A Composição Química de Forjados de Aço Ligado 9Cr-1Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.9A Chemical Composition of 11Cr-1/2Ni-1Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.9A Composição Química de Forjados de Aço Ligado 11Cr-1/2Ni-1Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.10A Chemical Composition of Ni Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.10A Composição Química de Forjados de Aço Ligado Ni para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.11A Chemical Composition of Ni-Mn Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.11A Composição Química de Forjados de Aço Ligado Ni-Mn para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.12A Chemical Composition of 3/4Ni-1/2Cr-Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.12A Composição Química de Forjados de Aço Ligado 3/4Ni-1/2Cr-Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.13A Chemical Composition of 3/4Ni-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.13A Composição Química de Forjados de Aço Ligado 3/4Ni-1/2Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.2.2.14A Chemical Composition of 3.5Ni-1.75Cr-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components": "6.2.2.14A Composição Química de Forjados de Aço Ligado 3,5Ni-1,75Cr-1/2Mo para Tubulações, Vasos de Pressão e Componentes",
  "6.3.1A Chemical Composition of Martensitic Stainless Steel Forgings": "6.3.1A Composição Química de Forjados de Aço Inoxidável Martensítico",
  "6.3.2A Chemical Composition of Ferritic Stainless Steel Forgings": "6.3.2A Composição Química de Forjados de Aço Inoxidável Ferrítico",
  "6.3.3A Chemical Composition of Austenitic Stainless Steel Forgings": "6.3.3A Composição Química de Forjados de Aço Inoxidável Austenítico",
  "6.3.4A Chemical Composition of Precipitation-Hardening Stainless Steel Forgings": "6.3.4A Composição Química de Forjados de Aço Inoxidável com Endurecimento por Precipitação",
  "6.3.5A Chemical Composition of Duplex (Ferritic-Austenitic) Stainless Steel Forgings": "6.3.5A Composição Química de Forjados de Aço Inoxidável Duplex (Ferrítico-Austenítico)",
  "7.1.1B Chemical Composition of Cast Carbon Steel for General and Structural Applications": "7.1.1B Composição Química de Aço Carbono Fundido para Aplicações Gerais e Estruturais",
  "7.1.2B Chemical Composition of Cast Carbon Steel for Pressure Purposes at High Temperatures": "7.1.2B Composição Química de Aço Carbono Fundido para Uso sob Pressão em Altas Temperaturas",
  "7.1.3B Chemical Composition of Cast Carbon Steel for Pressure Purposes at Low Temperatures": "7.1.3B Composição Química de Aço Carbono Fundido para Uso sob Pressão em Baixas Temperaturas",
  "7.2A Chemical Composition of Cast Manganese Steels": "7.2A Composição Química de Aços ao Manganês Fundidos",
  "7.3.1A Chemical Composition of Cast Alloy Steels for General and Structural Purposes": "7.3.1A Composição Química de Aços Ligados Fundidos para Fins Gerais e Estruturais",
  "7.3.2A Chemical Composition of Cast Alloy Steels for Pressure Purposes at High Temperatures": "7.3.2A Composição Química de Aços Ligados Fundidos para Uso sob Pressão em Altas Temperaturas",
  "7.3.3A Chemical Composition of Cast Alloy Steels for Pressure Purposes at Low Temperatures": "7.3.3A Composição Química de Aços Ligados Fundidos para Uso sob Pressão em Baixas Temperaturas",
  "7.4.1.1A Chemical Composition of Martensitic and Ferritic Stainless Steels for General and Corrosion Resistant Applications": "7.4.1.1A Composição Química de Aços Inoxidáveis Martensíticos e Ferríticos Fundidos para Uso Geral e Resistência à Corrosão",
  "7.4.1.2A Chemical Composition of Austenitic Stainless Steels for General and Corrosion Resistant Applications": "7.4.1.2A Composição Química de Aços Inoxidáveis Austeníticos Fundidos para Uso Geral e Resistência à Corrosão",
  "7.4.2.1A Chemical Composition of Martensitic and Ferritic Stainless Steels for Pressure Purposes": "7.4.2.1A Composição Química de Aços Inoxidáveis Martensíticos e Ferríticos Fundidos para Uso sob Pressão",
  "7.4.2.2A Chemical Composition of Austenitic Stainless Steels for Pressure Purposes": "7.4.2.2A Composição Química de Aços Inoxidáveis Austeníticos Fundidos para Uso sob Pressão",
  "7.5A Chemical Composition of Cast Heat Resistant Steels": "7.5A Composição Química de Aços Fundidos Resistentes ao Calor",
  "8.1.1A Chemical Composition of Martensitic Stainless Steels (Plate/Sheet/Strip)": "8.1.1A Composição Química de Aços Inoxidáveis Martensíticos (Chapa/Folha/Tira)",
  "8.1.2A Chemical Composition of Ferritic Stainless Steels (Plate/Sheet/Strip)": "8.1.2A Composição Química de Aços Inoxidáveis Ferríticos (Chapa/Folha/Tira)",
  "8.1.3A Chemical Composition of Austenitic Stainless Steels (Plate/Sheet/Strip)": "8.1.3A Composição Química de Aços Inoxidáveis Austeníticos (Chapa/Folha/Tira)",
  "8.1.4A Chemical Composition of Precipitation-Hardening Stainless Steels (Plate/Sheet/Strip)": "8.1.4A Composição Química de Aços Inoxidáveis com Endurecimento por Precipitação (Chapa/Folha/Tira)",
  "8.1.5A Chemical Composition of Duplex (Ferritic-Austenitic) Stainless Steels (Plate/Sheet/Strip)": "8.1.5A Composição Química de Aços Inoxidáveis Duplex (Ferrítico-Austenítico) (Chapa/Folha/Tira)",
  "8.2.1A Chemical Composition of Martensitic Stainless Steels (Bar)": "8.2.1A Composição Química de Aços Inoxidáveis Martensíticos (Barra)",
  "8.2.2A Chemical Composition of Ferritic Stainless Steels (Bar)": "8.2.2A Composição Química de Aços Inoxidáveis Ferríticos (Barra)",
  "8.2.3A Chemical Composition of Austenitic Stainless Steels (Bar)": "8.2.3A Composição Química de Aços Inoxidáveis Austeníticos (Barra)",
  "8.2.4A Chemical Composition of Precipitation-Hardening Stainless Steels (Bar)": "8.2.4A Composição Química de Aços Inoxidáveis com Endurecimento por Precipitação (Barra)",
  "8.2.5A Chemical Composition of Duplex Stainless Steels (Bar)": "8.2.5A Composição Química de Aços Inoxidáveis Duplex (Barra)",
  "9.1.1 Chemical Composition of Resulfurized Carbon Steels for Free-Machining Applications": "9.1.1 Composição Química de Aços Carbono Ressulfurizados para Usinagem Fácil",
  "9.1.2 Chemical Composition of Rephosphorized and Resulfurized Carbon Steels for Free-Machining Applications": "9.1.2 Composição Química de Aços Carbono Refosforizados e Ressulfurizados para Usinagem Fácil",
  "9.1.3 Chemical Composition of Resulfurized and Leaded Carbon Steels for Free-Machining Applications": "9.1.3 Composição Química de Aços Carbono Ressulfurizados e ao Chumbo para Usinagem Fácil",
  "9.1.4-9.1.5 Chemical Composition of Rephosphorized/Resulfurized/Leaded Carbon Steels and Free-Machining Stainless Steels": "9.1.4–9.1.5 Composição Química de Aços Carbono Refosforiz./Ressulfuriz./ao Chumbo e Inoxidáveis de Usinagem Fácil",
  "9.2.1 Chemical Composition of Cold Rolled Carbon Spring Steels": "9.2.1 Composição Química de Aços Mola Carbono Laminados a Frio",
  "9.2.2.1-9.2.2.6 Chemical Composition of Hot Rolled Alloy Spring Steels (Si/Cr/Cr-Si/Cr-Mo/Cr-V/Cr-B)": "9.2.2.1–9.2.2.6 Composição Química de Aços Mola Ligados Laminados a Quente (Si/Cr/Cr-Si/Cr-Mo/Cr-V/Cr-B)",
  "9.2.3 Chemical Composition of Stainless Spring Steels": "9.2.3 Composição Química de Aços Mola Inoxidáveis",
  "9.3.1 Chemical Composition of Carbon Tool Steels": "9.3.1 Composição Química de Aços Ferramenta Carbono",
  "9.3.2.1-9.3.2.2 Chemical Composition of High Speed Tool Steels (Tungsten and Molybdenum Type)": "9.3.2.1–9.3.2.2 Composição Química de Aços Ferramenta Rápidos (Tipo Tungstênio e Molibdênio)",
  "9.3.3 Chemical Composition of Cold Work Tool Steels": "9.3.3 Composição Química de Aços Ferramenta para Trabalho a Frio",
  "9.3.4-9.3.5 Chemical Composition of Hot Work Tool Steels and Special Purpose Tool Steels": "9.3.4–9.3.5 Composição Química de Aços Ferramenta para Trabalho a Quente e Aços Ferramenta para Fins Especiais",
  "9.4.1 Chemical Composition of Bearing Steels": "9.4.1 Composição Química de Aços para Rolamentos",
};

function translateSection(section: string): string {
  return SECTION_PT[section] ?? section;
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
        sectionPt: translateSection(section),
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
