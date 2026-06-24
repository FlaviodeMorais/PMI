"use client";

import { useMemo, useState } from "react";
import { REPORT_ELEMENTS, type ReportReading } from "@/lib/reportData";
import styles from "./page.module.css";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function resultStatus(reading: ReportReading) {
  const value = (reading.pass_fail || reading.norma || "").trim().toUpperCase();
  return value === "A" || value === "APROVADO" || value === "APPROVED" ? "A" : value || "—";
}

export default function ReportBuilderPanel() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [readings, setReadings] = useState<ReportReading[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReadings() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "1000" });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (search) params.set("search", search);
      const response = await fetch(`/api/readings?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Erro ao consultar análises");
      setReadings(data.readings);
      setSelectedIds(new Set());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  const selected = useMemo(
    () => readings.filter((reading) => selectedIds.has(reading.id)),
    [readings, selectedIds],
  );

  const metrics = useMemo(() => {
    const equipment = new Set(selected.map((reading) => reading.name).filter(Boolean)).size;
    const reports = new Set(selected.map((reading) => reading.laudo).filter(Boolean)).size;
    const heats = new Set(selected.map((reading) => reading.corrida).filter(Boolean)).size;
    const approved = selected.filter((reading) => resultStatus(reading) === "A").length;
    const requiredFields = selected.flatMap((reading) => [
      reading.name,
      reading.descricao,
      reading.corrida,
      reading.qtd,
      reading.laudo,
    ]);
    const completeness = requiredFields.length
      ? Math.round((requiredFields.filter(Boolean).length / requiredFields.length) * 100)
      : 0;
    return { equipment, reports, heats, approved, completeness };
  }, [selected]);

  function toggleReading(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(selectedIds.size === readings.length ? new Set() : new Set(readings.map((reading) => reading.id)));
  }

  return (
    <section className={styles.reportWorkspace}>
      <div className={styles.reportIntro}>
        <span className={styles.eyebrow}>Template RPMI</span>
        <h1>Construção do relatório PMI</h1>
        <p>
          Selecione as análises que formarão a matriz química do relatório Word. Os campos corporativos,
          dados do cliente, equipamento, procedimento e assinaturas serão preenchidos na próxima etapa.
        </p>
      </div>

      <section className={styles.reportFilters}>
        <label>Data inicial<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label>Data final<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <label>Equipamento, laudo ou corrida<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="PMI-HFT 41, KRCN..., A216..." /></label>
        <button type="button" className={styles.primaryButton} onClick={loadReadings} disabled={loading}>
          {loading ? "Consultando..." : "Consultar análises"}
        </button>
      </section>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <section className={styles.reportMetrics}>
        <div><strong>{readings.length}</strong><span>análises encontradas</span></div>
        <div><strong>{selected.length}</strong><span>pontos selecionados</span></div>
        <div><strong>{metrics.equipment}</strong><span>equipamentos</span></div>
        <div><strong>{metrics.reports}</strong><span>laudos</span></div>
        <div><strong>{metrics.heats}</strong><span>corridas/materiais</span></div>
        <div><strong>{metrics.approved}</strong><span>aprovados</span></div>
        <div><strong>{metrics.completeness}%</strong><span>completude cadastral</span></div>
      </section>

      <section className={styles.reportSelection}>
        <div className={styles.tableHeader}>
          <h2>Análises para o relatório</h2>
          <button type="button" className={styles.secondaryButton} onClick={toggleAll} disabled={!readings.length}>
            {selectedIds.size === readings.length && readings.length ? "Limpar seleção" : "Selecionar todas"}
          </button>
        </div>
        <div className={styles.reportTableWrap}>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>Sel.</th><th>Data</th><th>Ponto</th><th>Equipamento</th><th>Descrição</th>
                <th>Material/Corrida</th><th>Laudo</th><th>Liga detectada</th><th>Resultado</th>
                {REPORT_ELEMENTS.map((element) => <th key={element}>{element}</th>)}
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => (
                <tr key={reading.id} className={selectedIds.has(reading.id) ? styles.selectedReportRow : ""}>
                  <td><input type="checkbox" checked={selectedIds.has(reading.id)} onChange={() => toggleReading(reading.id)} /></td>
                  <td>{formatDate(reading.reading_date)}</td>
                  <td>{reading.reading_number}</td>
                  <td>{reading.name}</td>
                  <td>{reading.descricao || "—"}</td>
                  <td>{reading.corrida || "—"}</td>
                  <td>{reading.laudo || "—"}</td>
                  <td>{reading.alloy_1 || reading.alloy_2 || "—"}</td>
                  <td>{resultStatus(reading)}</td>
                  {REPORT_ELEMENTS.map((element) => (
                    <td key={element}>{reading.elements[element]?.value?.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
