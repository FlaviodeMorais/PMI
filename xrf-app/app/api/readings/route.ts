import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
    const requestedLimit = Number(searchParams.get("limit") ?? 500);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : 500;

    let query = getSupabaseAdmin()
      .from("readings")
      .select("id,reading_date,reading_time,reading_number,name,descricao,esp_mat,item_id,n_s,laudo,pass_fail,match,alloy_1,alloy_2,unit,elements")
      .order("reading_date", { ascending: false })
      .order("reading_time", { ascending: false })
      .limit(limit);

    if (dateFrom) query = query.gte("reading_date", dateFrom);
    if (dateTo) query = query.lte("reading_date", dateTo);

    const { data, error } = await query;
    if (error) throw error;

    const readings = search
      ? (data ?? []).filter((reading) =>
          [
            reading.name,
            reading.descricao,
            reading.esp_mat,
            reading.item_id,
            reading.n_s,
            reading.laudo,
            reading.alloy_1,
            reading.alloy_2,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search),
        )
      : data ?? [];

    return NextResponse.json({ readings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar análises";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
