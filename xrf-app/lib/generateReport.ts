import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
  HeadingLevel,
  ShadingType,
  convertInchesToTwip,
} from "docx";
import type { ReportReading, ReportTemplateFields } from "./reportData";
import { REPORT_ELEMENTS } from "./reportData";

// ─── helpers ────────────────────────────────────────────────────────────────

function cell(
  text: string,
  opts: {
    bold?: boolean;
    shade?: boolean;
    colspan?: number;
    rowspan?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
    width?: number;
  } = {},
): TableCell {
  return new TableCell({
    columnSpan: opts.colspan,
    rowSpan: opts.rowspan,
    shading: opts.shade ? { type: ShadingType.SOLID, color: "D0D0D0" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts.bold,
            size: opts.size ?? 18, // 9pt
            font: "Arial",
          }),
        ],
      }),
    ],
  });
}

function labelCell(text: string, colspan?: number): TableCell {
  return cell(text, { bold: true, shade: true, colspan, align: AlignmentType.LEFT });
}

function valueCell(text: string, colspan?: number): TableCell {
  return cell(text ?? "—", { colspan });
}

function row(...cells: TableCell[]): TableRow {
  return new TableRow({ children: cells });
}

function bordered() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: "000000" } as const;
  return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
}

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 4 });
}

function fmtDate(value: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

// ─── section: header ────────────────────────────────────────────────────────

function headerTable(fields: ReportTemplateFields): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordered(),
    rows: [
      row(
        cell("", { width: 1800 }),
        cell(
          `RELATÓRIO DE ENSAIO PMI (Test / Analysis Report)\nN° ${fields.report.number}  —  VIA ORIGINAL`,
          { bold: true, align: AlignmentType.CENTER, colspan: 1 },
        ),
        cell(`RPMI\nRevisão: ${fields.report.revision}\nPágina: 1/2`, {
          align: AlignmentType.CENTER,
          width: 2000,
        }),
      ),
    ],
  });
}

// ─── section: company identity ──────────────────────────────────────────────

function companyParagraphs(): Paragraph[] {
  const lines = [
    "J. OMETTO & CIA PROTEÇÃO RADIOLÓGICA E ENGENHARIA DE MATERIAIS LTDA.",
    "Rua Cristiano Cleopath, 2084 - Alemães, Piracicaba/SP, 13419-310",
    "Tel.: (19) 3927-0881  |  www.jometto.com.br",
  ];
  return lines.map(
    (line) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: line, size: 18, font: "Arial" })],
      }),
  );
}

// ─── section: client info ────────────────────────────────────────────────────

function clientTable(fields: ReportTemplateFields): Table {
  const c = fields.client;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordered(),
    rows: [
      row(labelCell("EMPRESA SOLICITANTE (Client):", 1), valueCell(c.company, 5)),
      row(labelCell("Endereço:", 1), valueCell(c.address, 5)),
      row(
        labelCell("CEP:"),
        valueCell(c.zipCode),
        labelCell("CIDADE:"),
        valueCell(c.city),
        labelCell("País:"),
        valueCell(c.country),
      ),
    ],
  });
}

// ─── section: material info ──────────────────────────────────────────────────

function materialTable(fields: ReportTemplateFields): Table {
  const m = fields.material;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordered(),
    rows: [
      row(cell("Informações fornecidas pelo cliente: (Information supplied)", { bold: true, colspan: 6 })),
      row(labelCell("Material:", 1), valueCell(m.specification, 5)),
      row(labelCell("Descrição do Equipamento:", 1), valueCell(m.equipmentDescription, 5)),
      row(
        labelCell("Pedido:"),
        valueCell(m.invoice),
        labelCell("Corrida:"),
        valueCell(m.heat),
        labelCell("NEM:"),
        valueCell(m.nem),
      ),
      row(
        labelCell("AF:"),
        valueCell(m.supplyAuthorization),
        labelCell("Item/Código:"),
        valueCell(m.itemCode),
        labelCell("Fornecedor:"),
        valueCell(m.supplier),
      ),
      row(labelCell("Projeto:", 1), valueCell(m.project, 5)),
    ],
  });
}

// ─── section: chemical analysis table ───────────────────────────────────────

function chemicalTable(readings: ReportReading[], fields: ReportTemplateFields): Table {
  const elements = REPORT_ELEMENTS;

  // header row 1 — element group headers
  const headerRow1 = new TableRow({
    children: [
      cell("PONTO", { bold: true, shade: true, rowspan: 2, align: AlignmentType.CENTER }),
      cell("LIGA DETECTADA", { bold: true, shade: true, rowspan: 2, align: AlignmentType.CENTER }),
      ...elements.map((el) =>
        cell(el, { bold: true, shade: true, align: AlignmentType.CENTER }),
      ),
      cell("LAUDO", { bold: true, shade: true, rowspan: 2, align: AlignmentType.CENTER }),
    ],
  });

  // spec/limits row (row 1 in the original — empty limits since we don't have them here)
  const specRow = new TableRow({
    children: [
      cell("Especificação", { shade: true, align: AlignmentType.CENTER }),
      cell(fields.material.specification || "—", { shade: true, align: AlignmentType.CENTER }),
      ...elements.map(() => cell("—", { shade: true, align: AlignmentType.CENTER })),
      cell("—", { shade: true, align: AlignmentType.CENTER }),
    ],
  });

  // data rows — up to 25 slots
  const MAX_ROWS = 25;
  const dataRows: TableRow[] = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const reading = readings[i];
    if (reading) {
      dataRows.push(
        new TableRow({
          children: [
            cell(String(reading.reading_number), { align: AlignmentType.CENTER }),
            cell(reading.alloy_1 || reading.alloy_2 || "—", { align: AlignmentType.CENTER }),
            ...elements.map((el) =>
              cell(fmt(reading.elements[el]?.value), { align: AlignmentType.CENTER }),
            ),
            cell(
              reading.pass_fail?.trim().toUpperCase() === "A" ||
              reading.pass_fail?.trim().toUpperCase() === "APROVADO"
                ? "A"
                : reading.pass_fail || "—",
              { align: AlignmentType.CENTER },
            ),
          ],
        }),
      );
    } else {
      dataRows.push(
        new TableRow({
          children: [
            cell("—", { align: AlignmentType.CENTER }),
            cell("—", { align: AlignmentType.CENTER }),
            ...elements.map(() => cell("—", { align: AlignmentType.CENTER })),
            cell("—", { align: AlignmentType.CENTER }),
          ],
        }),
      );
    }
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordered(),
    rows: [headerRow1, specRow, ...dataRows],
  });
}

// ─── section: dates and signatures ──────────────────────────────────────────

function signatureTable(fields: ReportTemplateFields): Table {
  const t = fields.test;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordered(),
    rows: [
      row(
        cell(`Data de Início do Ensaio: ${fmtDate(t.startDate)}`, { bold: true }),
        cell(`Data de Conclusão do Ensaio: ${fmtDate(t.conclusionDate)}`, { bold: true }),
      ),
      row(
        cell("Flavio de Morais\nInspetor Responsável / Responsabile Inspector", {
          align: AlignmentType.CENTER,
        }),
        cell("Responsável Técnico / Technical Manager", { align: AlignmentType.CENTER }),
      ),
      row(
        cell(
          "Os resultados constantes neste relatório são de exclusiva responsabilidade da J. Ometto & Cia e referem-se apenas às amostras ensaiadas. " +
            "É proibida a reprodução parcial deste documento sem autorização da empresa emissora.",
          { colspan: 2, size: 16 },
        ),
      ),
    ],
  });
}

// ─── section: equipment and conditions ──────────────────────────────────────

function equipmentTable(fields: ReportTemplateFields): Table {
  const t = fields.test;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordered(),
    rows: [
      row(
        labelCell("Interpretação:", 1),
        valueCell(t.interpretation, 3),
        labelCell("TP.:"),
        valueCell("N/A"),
      ),
      row(cell("Notas: A = Aprovado  |  NA = Não Aprovado  |  ND = Não Detectado", { colspan: 6, size: 16 })),
      row(
        labelCell("Equipamentos — Tipo:"),
        valueCell(t.equipmentType),
        labelCell("Marca:"),
        valueCell(t.brand),
        labelCell("Modelo:"),
        valueCell(t.model),
      ),
      row(
        labelCell("N° de Série:", 1),
        valueCell(t.serialNumber, 1),
        labelCell("Calibração:", 1),
        valueCell(t.calibration, 3),
      ),
      row(labelCell("Procedimento de Ensaio:", 1), valueCell(t.procedure, 5)),
      row(
        labelCell("Temperatura da Superfície:"),
        valueCell(t.surfaceTemperature),
        labelCell("Tempo de Exposição:"),
        valueCell(t.expositionTime),
        labelCell("Cond. Superficiais:"),
        valueCell(t.surfaceConditions),
      ),
      row(
        labelCell("Limpeza da Superfície:"),
        valueCell(t.surfaceCleaning),
        labelCell("Nome da Instalação:"),
        valueCell(t.installationName, 3),
      ),
      row(labelCell("Local do Ensaio (Customer Site):", 1), valueCell(t.customerSite, 5)),
      row(labelCell("Observações:", 1), valueCell(t.observations || "—", 5)),
    ],
  });
}

// ─── section title paragraph ─────────────────────────────────────────────────

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, size: 20, font: "Arial" })],
    spacing: { before: 120, after: 60 },
  });
}

function spacer(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "" })] });
}

// ─── main export ─────────────────────────────────────────────────────────────

export async function generateReportDocx(
  readings: ReportReading[],
  fields: ReportTemplateFields,
): Promise<Buffer> {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 18 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.6),
              right: convertInchesToTwip(0.6),
              bottom: convertInchesToTwip(0.6),
              left: convertInchesToTwip(0.6),
            },
          },
        },
        children: [
          headerTable(fields),
          spacer(),
          ...companyParagraphs(),
          spacer(),
          clientTable(fields),
          spacer(),
          materialTable(fields),
          spacer(),
          sectionTitle(
            "RELATÓRIO DE ENSAIOS QUÍMICOS (Chemical Test Report)\nAnálise Química (%) – Chemical Analysis (%)",
          ),
          chemicalTable(readings, fields),
          spacer(),
          signatureTable(fields),
          spacer(),
          equipmentTable(fields),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
