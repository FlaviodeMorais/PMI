"use client";

import { useEffect, useMemo, useState } from "react";
import { REPORT_ELEMENTS, type ReportReading, type ReportTemplateFields } from "@/lib/reportData";
import styles from "./page.module.css";

const STORAGE_KEY = "rpmi-template-defaults";

function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function resultStatus(reading: ReportReading) {
  const value = (reading.pass_fail || reading.laudo || "").trim().toUpperCase();
  return value === "A" || value === "APROVADO" || value === "APPROVED" ? "A" : value || "—";
}

const DEFAULT_FIELDS: ReportTemplateFields = {
  report: { number: "", revision: "00" },
  client: { company: "", zipCode: "", city: "", country: "" },
  material: {
    specification: "",
    equipmentDescription: "",
    invoice: "",
    heat: "",
    itemId: "",
    supplyAuthorization: "",
    itemTag: "",
  },
  test: { startDate: "", conclusionDate: "" },
};

function loadSavedFields(): ReportTemplateFields {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FIELDS;
    return { ...DEFAULT_FIELDS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FIELDS;
  }
}

export default function ReportBuilderPanel() {
  // step 1 — query and selection
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [readings, setReadings] = useState<ReportReading[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // step 2 — template fields
  const [step, setStep] = useState<1 | 2>(1);
  const [fields, setFields] = useState<ReportTemplateFields>(DEFAULT_FIELDS);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  // load saved defaults on mount
  useEffect(() => {
    setFields(loadSavedFields());
  }, []);

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
    () => readings.filter((r) => selectedIds.has(r.id)),
    [readings, selectedIds],
  );

  const metrics = useMemo(() => {
    const equipment = new Set(selected.map((r) => r.name).filter(Boolean)).size;
    const reports = new Set(selected.map((r) => r.n_s).filter(Boolean)).size;
    const heats = new Set(selected.map((r) => r.esp_mat).filter(Boolean)).size;
    const approved = selected.filter((r) => resultStatus(r) === "A").length;
    const requiredFields = selected.flatMap((r) => [r.name, r.descricao, r.esp_mat, r.item_id, r.n_s]);
    const completeness = requiredFields.length
      ? Math.round((requiredFields.filter(Boolean).length / requiredFields.length) * 100)
      : 0;
    return { equipment, reports, heats, approved, completeness };
  }, [selected]);

  function toggleReading(id: number) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(selectedIds.size === readings.length ? new Set() : new Set(readings.map((r) => r.id)));
  }

  function setField<S extends keyof ReportTemplateFields>(
    section: S,
    key: keyof ReportTemplateFields[S],
    value: string,
  ) {
    setFields((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  }

  function saveDefaults() {
    // save everything except report number and dates (those change per report)
    const toSave: ReportTemplateFields = {
      ...fields,
      report: { ...fields.report, number: "" },
      test: { startDate: "", conclusionDate: "" },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  }

  function resetDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    setFields(DEFAULT_FIELDS);
  }

  async function generateReport() {
    setGenerating(true);
    setGenError(null);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readings: selected, fields }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Erro ao gerar relatório");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const num = fields.report.number.replace(/\//g, "-") || "relatorio";
      a.download = `RPMI-${num}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (genErr) {
      setGenError(genErr instanceof Error ? genErr.message : "Erro desconhecido");
    } finally {
      setGenerating(false);
    }
  }

  // ── Step 2 ─────────────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <section className={styles.reportWorkspace}>
        <div className={styles.reportIntro}>
          <span className={styles.eyebrow}>Etapa 2 de 2 — Template RPMI</span>
          <h1>Dados do relatório</h1>
          <p>
            Preencha os campos abaixo para as <strong>{selected.length}</strong> análises selecionadas.
            Use <strong>Salvar como padrão</strong> para reutilizar cliente e material nos próximos relatórios.
          </p>
          <div className={styles.tableActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setStep(1)}>
              ← Voltar à seleção
            </button>
            <button type="button" className={styles.secondaryButton} onClick={saveDefaults}>
              {savedMsg ? "✓ Salvo!" : "Salvar como padrão"}
            </button>
            <button type="button" className={styles.ghostButton} onClick={resetDefaults}>
              Limpar padrão
            </button>
          </div>
        </div>

        <div className={styles.reportForm}>

          <fieldset className={styles.formSection}>
            <legend>Identificação do Relatório</legend>
            <label>
              N° do Relatório
              <input value={fields.report.number} onChange={(e) => setField("report", "number", e.target.value)} placeholder="0077/0423" />
            </label>
            <label>
              Revisão
              <input value={fields.report.revision} onChange={(e) => setField("report", "revision", e.target.value)} placeholder="00" />
            </label>
          </fieldset>

          <fieldset className={styles.formSection}>
            <legend>Empresa Solicitante (Cliente)</legend>
            <label className={styles.fullWidth}>
              Empresa
              <input value={fields.client.company} onChange={(e) => setField("client", "company", e.target.value)} placeholder="Nome da empresa" />
            </label>
            <label>
              CEP
              <input value={fields.client.zipCode} onChange={(e) => setField("client", "zipCode", e.target.value)} placeholder="00000-000" />
            </label>
            <label>
              Cidade
              <input value={fields.client.city} onChange={(e) => setField("client", "city", e.target.value)} />
            </label>
            <label>
              País
              <input value={fields.client.country} onChange={(e) => setField("client", "country", e.target.value)} placeholder="Brasil" />
            </label>
          </fieldset>

          <fieldset className={styles.formSection}>
            <legend>Material</legend>
            <label>
              Material (Especificação)
              <input value={fields.material.specification} onChange={(e) => setField("material", "specification", e.target.value)} placeholder="ASTM A216 Gr. WCB" />
            </label>
            <label className={styles.fullWidth}>
              Descrição do Equipamento
              <input value={fields.material.equipmentDescription} onChange={(e) => setField("material", "equipmentDescription", e.target.value)} placeholder="Válvula de gaveta DN 150" />
            </label>
            <label>
              Pedido (Invoice)
              <input value={fields.material.invoice} onChange={(e) => setField("material", "invoice", e.target.value)} placeholder="—" />
            </label>
            <label>
              Corrida (Rate)
              <input value={fields.material.heat} onChange={(e) => setField("material", "heat", e.target.value)} placeholder="—" />
            </label>
            <label>
              ID
              <input value={fields.material.itemId} onChange={(e) => setField("material", "itemId", e.target.value)} placeholder="—" />
            </label>
            <label>
              AF (Supply Authorization)
              <input value={fields.material.supplyAuthorization} onChange={(e) => setField("material", "supplyAuthorization", e.target.value)} placeholder="—" />
            </label>
            <label>
              Item/TAG
              <input value={fields.material.itemTag} onChange={(e) => setField("material", "itemTag", e.target.value)} placeholder="—" />
            </label>
          </fieldset>

          <fieldset className={styles.formSection}>
            <legend>Datas do Ensaio</legend>
            <label>
              Data de Início
              <input type="date" value={fields.test.startDate} onChange={(e) => setField("test", "startDate", e.target.value)} />
            </label>
            <label>
              Data de Conclusão
              <input type="date" value={fields.test.conclusionDate} onChange={(e) => setField("test", "conclusionDate", e.target.value)} />
            </label>
          </fieldset>

        </div>

        {genError && <div className={styles.errorMessage}>{genError}</div>}

        <div className={styles.reportActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={generateReport}
            disabled={generating || selected.length === 0}
          >
            {generating ? "Gerando..." : `Gerar relatório Word (${selected.length} pontos)`}
          </button>
        </div>
      </section>
    );
  }

  // ── Step 1 ─────────────────────────────────────────────────────────────────
  return (
    <section className={styles.reportWorkspace}>
      <div className={styles.reportIntro}>
        <span className={styles.eyebrow}>Etapa 1 de 2 — Template RPMI</span>
        <h1>Construção do relatório PMI</h1>
        <p>
          Selecione as análises que formarão a matriz química do relatório Word.
        </p>
      </div>

      <section className={styles.reportFilters}>
        <label>Data inicial<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label>Data final<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        <label>Equipamento, N/S ou ESP.MAT<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="PMI-HFT 001, A216..." /></label>
        <button type="button" className={styles.primaryButton} onClick={loadReadings} disabled={loading}>
          {loading ? "Consultando..." : "Consultar análises"}
        </button>
      </section>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <section className={styles.reportMetrics}>
        <div><strong>{readings.length}</strong><span>análises encontradas</span></div>
        <div><strong>{selected.length}</strong><span>selecionadas</span></div>
        <div><strong>{metrics.equipment}</strong><span>equipamentos</span></div>
        <div><strong>{metrics.reports}</strong><span>N/S distintos</span></div>
        <div><strong>{metrics.heats}</strong><span>materiais (ESP.MAT)</span></div>
        <div><strong>{metrics.approved}</strong><span>aprovados</span></div>
        <div><strong>{metrics.completeness}%</strong><span>completude</span></div>
      </section>

      <section className={styles.reportSelection}>
        <div className={styles.tableHeader}>
          <h2>Análises para o relatório</h2>
          <div className={styles.tableActions}>
            <button type="button" className={styles.secondaryButton} onClick={toggleAll} disabled={!readings.length}>
              {selectedIds.size === readings.length && readings.length ? "Limpar seleção" : "Selecionar todas"}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={selected.length === 0}
              onClick={() => setStep(2)}
            >
              Prosseguir com {selected.length} pontos →
            </button>
          </div>
        </div>
        <div className={styles.reportTableWrap}>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>Sel.</th>
                <th>Date</th><th>Time</th><th>Reading</th><th>Name</th>
                <th>DESCRICAO</th><th>ESP.MAT</th><th>ID</th><th>N/S</th>
                <th>LAUDO</th><th>Liga Detectada</th>
                {REPORT_ELEMENTS.map((el) => <th key={el}>{el}</th>)}
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => (
                <tr key={reading.id} className={selectedIds.has(reading.id) ? styles.selectedReportRow : ""}>
                  <td><input type="checkbox" checked={selectedIds.has(reading.id)} onChange={() => toggleReading(reading.id)} /></td>
                  <td>{formatDate(reading.reading_date)}</td>
                  <td>{reading.reading_time}</td>
                  <td>{reading.reading_number}</td>
                  <td>{reading.name}</td>
                  <td>{reading.descricao || "—"}</td>
                  <td>{reading.esp_mat || "—"}</td>
                  <td>{reading.item_id || "—"}</td>
                  <td>{reading.n_s || "—"}</td>
                  <td>{reading.laudo || "—"}</td>
                  <td>{reading.alloy_1 || reading.alloy_2 || "—"}</td>
                  {REPORT_ELEMENTS.map((el) => (
                    <td key={el}>{reading.elements[el]?.value?.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) ?? "—"}</td>
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
