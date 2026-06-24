import { NextRequest, NextResponse } from "next/server";
import { generateReportDocx } from "@/lib/generateReport";
import type { ReportReading, ReportTemplateFields } from "@/lib/reportData";

export const runtime = "nodejs";

interface RequestBody {
  readings: ReportReading[];
  fields: ReportTemplateFields;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.readings?.length) {
      return NextResponse.json({ error: "Nenhuma leitura selecionada." }, { status: 400 });
    }
    if (!body.fields) {
      return NextResponse.json({ error: "Campos do relatório ausentes." }, { status: 400 });
    }

    const buffer = await generateReportDocx(body.readings, body.fields);

    const reportNumber = body.fields.report.number.replace(/\//g, "-") || "relatorio";
    const filename = `RPMI-${reportNumber}.docx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar relatório";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
