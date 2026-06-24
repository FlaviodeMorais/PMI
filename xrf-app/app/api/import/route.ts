import { NextRequest, NextResponse } from "next/server";
import { parseXrfCsv } from "@/lib/parseXrfCsv";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BATCH_SIZE = 200;
const CONFLICT_TARGET = "reading_date,reading_time,reading_number,name";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, errors } = parseXrfCsv(buffer, file.name);

    if (rows.length === 0) {
      return NextResponse.json({
        file: file.name,
        totalLines: rows.length + errors.length,
        parsed: 0,
        inserted: 0,
        duplicates: 0,
        failed: 0,
        parseErrors: errors,
        dbErrors: [],
      });
    }

    const supabase = getSupabaseAdmin();

    let inserted = 0;
    let failed = 0;
    const dbErrors: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from("readings")
        .upsert(batch, { onConflict: CONFLICT_TARGET, ignoreDuplicates: true })
        .select("id");

      if (error) {
        failed += batch.length;
        dbErrors.push(error.message);
        continue;
      }

      inserted += data?.length ?? 0;
    }

    return NextResponse.json({
      file: file.name,
      totalLines: rows.length + errors.length,
      parsed: rows.length,
      inserted,
      duplicates: rows.length - inserted - failed,
      failed,
      parseErrors: errors,
      dbErrors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao importar arquivo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
