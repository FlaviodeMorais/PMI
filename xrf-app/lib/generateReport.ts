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
  ShadingType,
  convertInchesToTwip,
} from "docx";
import type { ReportReading, ReportTemplateFields } from "./reportData";
import { REPORT_ELEMENTS } from "./reportData";

// ─── helpers ────────────────────────────────────────────────────────────────

const FONT = "Arial";
const SZ_NORMAL = 18; // 9pt
const SZ_SMALL = 16; // 8pt
const SZ_LARGE = 24; // 12pt
const SZ_TITLE = 22; // 11pt

const BORDER_SINGLE = { style: BorderStyle.SINGLE, size: 4, color: "000000" } as const;
const BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;

function borders(opts: "all" | "none" | "outer") {
  if (opts === "all") return { top: BORDER_SINGLE, bottom: BORDER_SINGLE, left: BORDER_SINGLE, right: BORDER_SINGLE, insideH: BORDER_SINGLE, insideV: BORDER_SINGLE };
  if (opts === "none") return { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE };
  return { top: BORDER_SINGLE, bottom: BORDER_SINGLE, left: BORDER_SINGLE, right: BORDER_SINGLE };
}

function run(text: string, opts: { bold?: boolean; italic?: boolean; size?: number } = {}): TextRun {
  return new TextRun({ text, bold: opts.bold, italics: opts.italic, size: opts.size ?? SZ_NORMAL, font: FONT });
}

function para(
  children: TextRun[],
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  spacing?: { before?: number; after?: number },
): Paragraph {
  return new Paragraph({ alignment: align, children, spacing: { before: spacing?.before ?? 0, after: spacing?.after ?? 0 } });
}

function cell(
  paragraphs: Paragraph[],
  opts: {
    colspan?: number;
    rowspan?: number;
    shade?: boolean;
    width?: number;
    vAlign?: (typeof VerticalAlign)[keyof typeof VerticalAlign];
    borders?: "all" | "none" | "outer";
    margins?: { top?: number; bottom?: number; left?: number; right?: number };
  } = {},
): TableCell {
  return new TableCell({
    columnSpan: opts.colspan,
    rowSpan: opts.rowspan,
    shading: opts.shade ? { type: ShadingType.SOLID, color: "E8E8E8" } : undefined,
    verticalAlign: (opts.vAlign ?? VerticalAlign.CENTER) as "top" | "center" | "bottom",
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    borders: opts.borders ? borders(opts.borders) : undefined,
    margins: opts.margins ? { top: opts.margins.top, bottom: opts.margins.bottom, left: opts.margins.left ?? 80, right: opts.margins.right ?? 80 } : { left: 80, right: 80 },
    children: paragraphs,
  });
}

function lbl(ptText: string, enText: string): Paragraph {
  return para([
    run(ptText, { bold: true, size: SZ_NORMAL }),
    run(enText ? `\n(${enText}):` : "", { italic: true, size: SZ_SMALL }),
  ]);
}

function val(text: string, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT): Paragraph {
  return para([run(text || "")], align);
}

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 4 });
}

function fmtDate(value: string): string {
  if (!value) return "DD/MM/AAAA";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function spacer(pts = 60): Paragraph {
  return new Paragraph({ children: [], spacing: { before: pts, after: 0 } });
}

// ─── 1. HEADER ───────────────────────────────────────────────────────────────

function headerTable(f: ReportTemplateFields): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borders("all"),
    rows: [
      new TableRow({
        children: [
          // Logo cell
          cell(
            [para([run("", { size: SZ_NORMAL })], AlignmentType.CENTER)],
            { width: 1800, vAlign: VerticalAlign.CENTER },
          ),
          // Title cell
          cell(
            [
              para([run("RELATÓRIO DE ENSAIO PMI", { bold: true, size: SZ_TITLE })], AlignmentType.CENTER, { before: 60 }),
              para([run("(Test / Analysis Report)", { italic: true, size: SZ_SMALL })], AlignmentType.CENTER),
              para([run(`Nº ${f.report.number || "XXXX/MMAA"}`, { bold: true, size: SZ_LARGE })], AlignmentType.CENTER, { before: 40 }),
              para([run("VIA ORIGINAL", { bold: true, size: SZ_NORMAL })], AlignmentType.CENTER),
              para([run("(Original Report)", { italic: true, size: SZ_SMALL })], AlignmentType.CENTER, { after: 60 }),
            ],
            { vAlign: VerticalAlign.CENTER },
          ),
          // RPMI info cell
          cell(
            [
              para([run("RPMI", { bold: true, size: SZ_NORMAL })]),
              para([run(`Revisão: ${f.report.revision || "00"}`, { size: SZ_NORMAL })]),
              para([run("Página: 1/2", { size: SZ_NORMAL })]),
            ],
            { width: 1600, vAlign: VerticalAlign.CENTER },
          ),
        ],
      }),
    ],
  });
}

// ─── 2. CLIENT TABLE ─────────────────────────────────────────────────────────

function clientTable(f: ReportTemplateFields): Table {
  const c = f.client;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borders("all"),
    rows: [
      new TableRow({
        children: [
          cell([lbl("EMPRESA SOLICITANTE:", "Client")], { shade: true, width: 2400 }),
          cell([val(c.company)], { colspan: 5 }),
        ],
      }),
      new TableRow({
        children: [
          cell([para([run("", { size: SZ_SMALL })])], { shade: true }),
          cell([lbl("CEP:", "Zip Code")], { shade: true, width: 800 }),
          cell([val(c.zipCode)], { width: 1400 }),
          cell([lbl("CIDADE:", "City")], { shade: true, width: 800 }),
          cell([val(c.city)], { width: 2200 }),
          cell([lbl("Pais:", "Country")], { shade: true, width: 800 }),
          cell([val(c.country)], { width: 1400 }),
        ],
      }),
    ],
  });
}

// ─── 3. MATERIAL TABLE ───────────────────────────────────────────────────────

function materialTable(f: ReportTemplateFields): Table {
  const m = f.material;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borders("all"),
    rows: [
      new TableRow({
        children: [
          cell([lbl("Material:", "Material")], { shade: true, width: 2400 }),
          cell([val(m.specification)], { colspan: 5 }),
        ],
      }),
      new TableRow({
        children: [
          cell([lbl("Descrição do Equipamento:", "Description of Equipment")], { shade: true }),
          cell([val(m.equipmentDescription)], { colspan: 5 }),
        ],
      }),
      new TableRow({
        children: [
          cell([lbl("Pedido:", "Invoice")], { shade: true }),
          cell([val(m.invoice)]),
          cell([lbl("Corrida:", "Rate")], { shade: true }),
          cell([val(m.heat)]),
          cell([lbl("ID:", "")], { shade: true }),
          cell([val(m.itemId)]),
        ],
      }),
      new TableRow({
        children: [
          cell([lbl("AF:", "Supply Authorization")], { shade: true }),
          cell([val(m.supplyAuthorization)]),
          cell([lbl("Item/TAG:", "Item/Code")], { shade: true }),
          cell([val(m.itemTag)]),
          cell([val("--")], { colspan: 2 }),
        ],
      }),
    ],
  });
}

// ─── 4. CHEMICAL SECTION TITLE ───────────────────────────────────────────────

function chemicalSectionTitle(): Paragraph[] {
  return [
    spacer(80),
    para(
      [
        run("RELATÓRIO DE ENSAIOS QUÍMICOS ", { bold: true, size: SZ_NORMAL }),
        run("(Chemical Test Report)", { italic: true, size: SZ_NORMAL }),
      ],
      AlignmentType.CENTER,
    ),
    para(
      [
        run("Análise Química (%) ", { bold: true, size: SZ_NORMAL }),
        run("(Chemical Analysis)", { italic: true, size: SZ_NORMAL }),
      ],
      AlignmentType.CENTER,
    ),
    para(
      [
        run("RESULTADOS OBTIDOS ", { bold: true, size: SZ_NORMAL }),
        run("(Results)", { italic: true, size: SZ_NORMAL }),
      ],
      AlignmentType.CENTER,
    ),
    spacer(40),
  ];
}

// ─── 5. CHEMICAL TABLE ───────────────────────────────────────────────────────

function chemicalTable(readings: ReportReading[]): Table {
  const elCols = [...REPORT_ELEMENTS];

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell([para([run("PONTO", { bold: true, size: SZ_SMALL })], AlignmentType.CENTER)], { shade: true }),
      cell([para([run("LIGA DETECTADA", { bold: true, size: SZ_SMALL })], AlignmentType.CENTER)], { shade: true }),
      ...elCols.map((el) =>
        cell([para([run(el, { bold: true, size: SZ_SMALL })], AlignmentType.CENTER)], { shade: true }),
      ),
      cell([para([run("LAUDO", { bold: true, size: SZ_SMALL })], AlignmentType.CENTER)], { shade: true }),
    ],
  });

  const MAX_ROWS = 25;
  const dataRows: TableRow[] = [];

  for (let i = 0; i < MAX_ROWS; i++) {
    const r = readings[i];
    dataRows.push(
      new TableRow({
        children: [
          cell([val(r ? String(r.reading_number) : "", AlignmentType.CENTER)]),
          cell([val(r ? (r.alloy_1 || r.alloy_2 || "") : "")]),
          ...elCols.map((el) =>
            cell([val(r ? fmt(r.elements[el]?.value) : "", AlignmentType.CENTER)]),
          ),
          cell([val(r ? (r.laudo || "") : "", AlignmentType.CENTER)]),
        ],
      }),
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borders("all"),
    rows: [headerRow, ...dataRows],
  });
}

// ─── 6. SIGNATURES & LEGAL ───────────────────────────────────────────────────

const LEGAL_1 =
  "Todos os resultados obtidos e apresentados neste relatório aplicam-se apenas as amostras analisadas, tendo significação restrita às mesmas.\n" +
  "Os materiais analisados são preparados pelo próprio cliente, cabendo a ele a responsabilidade de apresenta-los nas condições ideais solicitadas pelo inspetor.\n" +
  "O presente relatório só deve ser reproduzido por completo. Caso haja a necessidade de reprodução de partes do documento é necessária uma autorização por escrito do emitente.";

const LEGAL_2 =
  "Todas as Informações contidas no presente relatório são obtidas à partir dos resultados de procedimentos de inspeção/teste/calibração ou ensaios realizados em conformidade com as instruções do cliente e/ou a nossa avalição de tais resultados com base em quaisquer normas técnicas, práticas comerciais ou aduaneiras, ou outras circunstâncias que deveriam, em nossa opinião profissional, serem consideradas. Todos os resultados apresentados acima fazem referência àquilo que foi encontrado no local e data da inspeção/teste/calibração. Este relatório não libera os compradores e fornecedores das suas responsabilidades contratuais, nem prejudica o direito de reclamação do comprador contra o fornecedor ou vendedor para compensação de qualquer defeito não detectado durante nossa verificação ou que tenha ocorrido depois, seja aparente ou oculto.";

function signaturesTable(f: ReportTemplateFields): Table {
  const startDate = fmtDate(f.test.startDate);
  const endDate = fmtDate(f.test.conclusionDate);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borders("all"),
    rows: [
      // Dates row
      new TableRow({
        children: [
          cell(
            [
              para([run("Data de Início do Ensaio:", { bold: true, size: SZ_NORMAL })], AlignmentType.CENTER),
              para([run("(Starting date of the test):", { italic: true, size: SZ_SMALL })], AlignmentType.CENTER),
              para([run(startDate, { bold: true, size: SZ_LARGE })], AlignmentType.CENTER),
            ],
            { vAlign: VerticalAlign.CENTER },
          ),
          cell(
            [
              para([run("Data de Conclusão do Ensaio:", { bold: true, size: SZ_NORMAL })], AlignmentType.CENTER),
              para([run("(Conclusion date of the test)", { italic: true, size: SZ_SMALL })], AlignmentType.CENTER),
              para([run(endDate, { bold: true, size: SZ_LARGE })], AlignmentType.CENTER),
            ],
            { vAlign: VerticalAlign.CENTER },
          ),
        ],
      }),
      // Signature blank space
      new TableRow({
        height: { value: 1200, rule: "exact" as const },
        children: [
          cell([para([run("")])]),
          cell([para([run("")])]),
        ],
      }),
      // Signature labels
      new TableRow({
        children: [
          cell(
            [
              para([run("____________________________________", { size: SZ_NORMAL })], AlignmentType.CENTER),
              para([run("Inspetor Responsável", { bold: true, size: SZ_NORMAL })], AlignmentType.CENTER),
              para([run("Responsabile Inspector", { italic: true, size: SZ_SMALL })], AlignmentType.CENTER),
            ],
            { vAlign: VerticalAlign.CENTER },
          ),
          cell(
            [
              para([run("____________________________________", { size: SZ_NORMAL })], AlignmentType.CENTER),
              para([run("Responsável Técnico", { bold: true, size: SZ_NORMAL })], AlignmentType.CENTER),
              para([run("Technical Manager", { italic: true, size: SZ_SMALL })], AlignmentType.CENTER),
            ],
            { vAlign: VerticalAlign.CENTER },
          ),
        ],
      }),
      // Legal text 1
      new TableRow({
        children: [
          cell(
            [para([run(LEGAL_1, { size: SZ_SMALL })], AlignmentType.JUSTIFIED)],
            { colspan: 2 },
          ),
        ],
      }),
      // Legal text 2
      new TableRow({
        children: [
          cell(
            [para([run(LEGAL_2, { size: SZ_SMALL })], AlignmentType.JUSTIFIED)],
            { colspan: 2 },
          ),
        ],
      }),
      // FIM DO RELATÓRIO
      new TableRow({
        children: [
          cell(
            [para([run("________________________________________FIM DO RELATÓRIO_______________________________________", { bold: true, size: SZ_NORMAL })], AlignmentType.CENTER)],
            { colspan: 2 },
          ),
        ],
      }),
    ],
  });
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function generateReportDocx(
  readings: ReportReading[],
  fields: ReportTemplateFields,
): Promise<Buffer> {
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: SZ_NORMAL } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5),
            },
          },
        },
        children: [
          headerTable(fields),
          spacer(80),
          clientTable(fields),
          spacer(80),
          materialTable(fields),
          ...chemicalSectionTitle(),
          chemicalTable(readings),
          spacer(80),
          signaturesTable(fields),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
