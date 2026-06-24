"use client";

import { useMemo, useState } from "react";
import { REPORT_ELEMENTS, type ReportReading, type ReportTemplateFields } from "@/lib/reportData";
import styles from "./page.module.css";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function resultStatus(reading: ReportReading) {
  const value = (reading.pass_fail || reading.norma || "").trim().toUpperCase();
  return value === "A" || value === "APROVADO" || value === "APPROVED" ? "A" : value || "—";
}

const EMPTY_FIELDS: ReportTemplateFields = {
  report: { number: "", revision: "00", issueType: "Original" },
  client: { company: "", address: "", zipCode: "", city: "", country: "" },
  material: {
    specification: "",
    equipmentDescription: "",
    invoice: "",
    heat: "",
    nem: "",
    supplyAuthorization: "",
    itemCode: "",
    supplier: "",
    project: "",
  },
  test: {
    interpretation: "",
    procedure: "",
    equipmentType: "Espectrômetro Portátil - Ótico",
    brand: "BELEC",
    model: "COMPACT PORT HLC",
    serialNumber: "13L0054",
    calibration: "",
    surfaceTemperature: "—",
    expositionTime: "15s por ponto",
    surfaceConditions: "—",
    surfaceCleaning: "OK",
    installationName: "",
    customerSite: "",
    observations: "",
    startDate: "",
    conclusionDate: "",
  },
};

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
  const [fields, setFields] = useState<ReportTemplateFields>(EMPTY_FIELDS);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

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
    const equipment = new Set(selected.map((r) => r.name).filter(Boolean)).size;
    const reports = new Set(selected.map((r) => r.laudo).filter(Boolean)).size;
    const heats = new Set(selected.map((r) => r.corrida).filter(Boolean)).size;
    const approved = selected.filter((r) => resultStatus(r) === "A").length;
    const requiredFields = selected.flatMap((r) => [r.name, r.descricao, r.corrida, r.qtd, r.laudo]);
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
      const reportNumber = fields.report.number.replace(/\//g, "-") || "relatorio";
      a.download = `RPMI-${reportNumber}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (genErr) {
      setGenError(genErr instanceof Error ? genErr.message : "Erro desconhecido");
    } finally {
      setGenerating(false);
    }
  }

  // ── Step 2 render ──────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <section className={styles.reportWorkspace}>
        <div className={styles.reportIntro}>
          <span className={styles.eyebrow}>Etapa 2 de 2 — Template RPMI</span>
          <h1>Dados corporativos e do ensaio</h1>
          <p>
            Preencha os campos abaixo. As <strong>{selected.length}</strong> análises selecionadas formarão
            a matriz química do relatório Word.
          </p>
          <button type="button" className={styles.secondaryButton} onClick={() => setStep(1)}>
            ← Voltar à seleção
          </button>
        </div>

        <div className={styles.reportForm}>

          <fieldset className={styles.formSection}>
            <legend>Identificação do Relatório</legend>
            <label>N° do Relatório<input value={fields.report.number} onChange={(e) => setField("report", "number", e.target.value)} placeholder="0077/0423" /></label>
            <label>Revisão<input value={fields.report.revision} onChange={(e) => setField("report", "revision", e.target.value)} placeholder="00" /></label>
            <label>Tipo de Emissão<input value={fields.report.issueType} onChange={(e) => setField("report", "issueType", e.target.value)} placeholder="Original" /></label>
          </fieldset>

          <fieldset className={styles.formSection}>
            <legend>Empresa Solicitante (Cliente)</legend>
            <label className={styles.fullWidth}>Empresa<input value={fields.client.company} onChange={(e) => setField("client", "company", e.target.value)} placeholder="Nome da empresa" /></label>
            <label className={styles.fullWidth}>Endereço<input value={fields.client.address} onChange={(e) => setField("client", "address", e.target.value)} placeholder="Rua, número, bairro" /></label>
            <label>CEP<input value={fields.client.zipCode} onChange={(e) => setField("client", "zipCode", e.target.value)} placeholder="00000-000" /></label>
            <label>Cidade<input value={fields.client.city} onChange={(e) => setField("client", "city", e.target.value)} /></label>
            <label>País<input value={fields.client.country} onChange={(e) => setField("client", "country", e.target.value)} placeholder="Brasil" /></label>
          </fieldset>

          <fieldset className={styles.formSection}>
            <legend>Material e Equipamento</legend>
            <label>Especificação do Material<input value={fields.material.specification} onChange={(e) => setField("material", "specification", e.target.value)} placeholder="ASTM A333 Gr. 6" /></label>
            <label className={styles.fullWidth}>Descrição do Equipamento<input value={fields.material.equipmentDescription} onChange={(e) => setField("material", "equipmentDescription", e.target.value)} placeholder="Tubo de 3/4 in." /></label>
            <label>Pedido<input value={fields.material.invoice} onChange={(e) => setField("material", "invoice", e.target.value)} placeholder="—" /></label>
            <label>Corrida (Heat)<input value={fields.material.heat} onChange={(e) => setField("material", "heat", e.target.value)} placeholder="—" /></label>
            <label>NEM<input value={fields.material.nem} onChange={(e) => setField("material", "nem", e.target.value)} placeholder="—" /></label>
            <label>AF<input value={fields.material.supplyAuthorization} onChange={(e) => setField("material", "supplyAuthorization", e.target.value)} placeholder="—" /></label>
            <label>Item/Código<input value={fields.material.itemCode} onChange={(e) => setField("material", "itemCode", e.target.value)} placeholder="—" /></label>
            <label>Fornecedor<input value={fields.material.supplier} onChange={(e) => setField("material", "supplier", e.target.value)} /></label>
            <label>Projeto<input value={fields.material.project} onChange={(e) => setField("material", "project", e.target.value)} placeholder="TOBD" /></label>
          </fieldset>

          <fieldset className={styles.formSection}>
            <legend>Datas e Local</legend>
            <label>Data de Início<input type="date" value={fields.test.startDate} onChange={(e) => setField("test", "startDate", e.target.value)} /></label>
            <label>Data de Conclusão<input type="date" value={fields.test.conclusionDate} onChange={(e) => setField("test", "conclusionDate", e.target.value)} /></label>
            <label>Nome da Instalação<input value={fields.test.installationName} onChange={(e) => setField("test", "installationName", e.target.value)} placeholder="OECI S.A. - TOBD" /></label>
            <label className={styles.fullWidth}>Local do Ensaio (Customer Site)<input value={fields.test.customerSite} onChange={(e) => setField("test", "customerSite", e.target.value)} placeholder="Terminal Oceânico Barra do Dande / Angola" /></label>
          </fieldset>

          <fieldset className={styles.formSection}>
            <legend>Equipamento e Procedimento</legend>
            <label>Tipo de Equipamento<input value={fields.test.equipmentType} onChange={(e) => setField("test", "equipmentType", e.target.value)} /></label>
            <label>Marca<input value={fields.test.brand} onChange={(e) => setField("test", "brand", e.target.value)} /></label>
            <label>Modelo<input value={fields.test.model} onChange={(e) => setField("test", "model", e.target.value)} /></label>
            <label>N° de Série<input value={fields.test.serialNumber} onChange={(e) => setField("test", "serialNumber", e.target.value)} /></label>
            <label className={styles.fullWidth}>Calibração<input value={fields.test.calibration} onChange={(e) => setField("test", "calibration", e.target.value)} /></label>
            <label className={styles.fullWidth}>Procedimento de Ensaio<input value={fields.test.procedure} onChange={(e) => setField("test", "procedure", e.target.value)} placeholder="TOBD-OECI-PO-PR-076 / PRD-002-PMI/OES-C" /></label>
            <label>Temperatura da Superfície<input value={fields.test.surfaceTemperature} onChange={(e) => setField("test", "surfaceTemperature", e.target.value)} placeholder="—" /></label>
            <label>Tempo de Exposição<input value={fields.test.expositionTime} onChange={(e) => setField("test", "expositionTime", e.target.value)} placeholder="15s por ponto" /></label>
            <label>Condições Superficiais<input value={fields.test.surfaceConditions} onChange={(e) => setField("test", "surfaceConditions", e.target.value)} placeholder="—" /></label>
            <label>Limpeza da Superfície<input value={fields.test.surfaceCleaning} onChange={(e) => setField("test", "surfaceCleaning", e.target.value)} placeholder="OK" /></label>
          </fieldset>

          <fieldset className={styles.formSection}>
            <legend>Interpretação e Observações</legend>
            <label className={styles.fullWidth}>
              Interpretação
              <textarea
                rows={3}
                value={fields.test.interpretation}
                onChange={(e) => setField("test", "interpretation", e.target.value)}
                placeholder="Os elementos analisados atendem a norma ASTM A333..."
              />
            </label>
            <label className={styles.fullWidth}>
              Observações
              <textarea
                rows={2}
                value={fields.test.observations}
                onChange={(e) => setField("test", "observations", e.target.value)}
                placeholder="—"
              />
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

  // ── Step 1 render ──────────────────────────────────────────────────────────
  return (
    <section className={styles.reportWorkspace}>
      <div className={styles.reportIntro}>
        <span className={styles.eyebrow}>Etapa 1 de 2 — Template RPMI</span>
        <h1>Construção do relatório PMI</h1>
        <p>
          Selecione as análises que formarão a matriz química do relatório Word. Os campos corporativos,
          dados do cliente, equipamento, procedimento e assinaturas serão preenchidos na próxima etapa.
        </p>
      </div>

      <section className={styles.reportFilters}>
        <label>Data inicial<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label>Data final<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        <label>Equipamento, laudo ou corrida<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="PMI-HFT 41, KRCN..., A216..." /></label>
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
                <th>Sel.</th><th>Data</th><th>Ponto</th><th>Equipamento</th><th>Descrição</th>
                <th>Material/Corrida</th><th>Laudo</th><th>Liga detectada</th><th>Resultado</th>
                {REPORT_ELEMENTS.map((el) => <th key={el}>{el}</th>)}
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
