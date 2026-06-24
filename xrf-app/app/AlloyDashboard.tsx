"use client";

import { useMemo, useState } from "react";
import type { AlloyDatabase, AlloyRecord } from "@/lib/alloyData";
import ImportXrfPanel from "./ImportXrfPanel";
import ReportBuilderPanel from "./ReportBuilderPanel";
import styles from "./page.module.css";

interface Props {
  database: AlloyDatabase;
}

function formatLimit(value: number | null) {
  return value === null ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function rangeMatches(alloy: AlloyRecord, element: string, min: string, max: string) {
  const range = alloy.elements[element];
  if (!range || (!range.raw && range.min === null && range.max === null)) return false;
  const minNumber = min === "" ? null : Number(min);
  const maxNumber = max === "" ? null : Number(max);
  const rangeMin = range.min ?? 0;
  const rangeMax = range.max ?? range.min ?? 0;

  if (minNumber !== null && rangeMax < minNumber) return false;
  if (maxNumber !== null && rangeMin > maxNumber) return false;
  return true;
}

export default function AlloyDashboard({ database }: Props) {
  const [activeView, setActiveView] = useState<"alloys" | "import" | "reports">("alloys");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("Todos");
  const [chapter, setChapter] = useState("Todos");
  const [element, setElement] = useState("Cr");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [selectedId, setSelectedId] = useState(database.alloys[0]?.id ?? "");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return database.alloys.filter((alloy) => {
      const matchesQuery = !normalizedQuery || alloy.searchText.includes(normalizedQuery);
      const matchesFamily = family === "Todos" || alloy.family === family;
      const matchesChapter = chapter === "Todos" || alloy.chapter === chapter;
      const matchesElement = !min && !max ? true : rangeMatches(alloy, element, min, max);
      return matchesQuery && matchesFamily && matchesChapter && matchesElement;
    });
  }, [chapter, database.alloys, element, family, max, min, query]);

  const topFamilies = useMemo(() => {
    return database.families
      .map((name) => ({ name, count: database.alloys.filter((alloy) => alloy.family === name).length }))
      .sort((a, b) => b.count - a.count);
  }, [database.alloys, database.families]);

  const visible = filtered.slice(0, 250);
  const selected = filtered.find((alloy) => alloy.id === selectedId) ?? visible[0] ?? null;
  const standards = new Set(filtered.map((alloy) => alloy.standard).filter(Boolean)).size;
  const uns = new Set(filtered.map((alloy) => alloy.unsNumber).filter(Boolean)).size;

  return (
    <main className={styles.dashboard}>
      <nav className={styles.appNav} aria-label="Funcionalidades do PMI">
        <div>
          <strong>PMI</strong>
          <span>Identificação positiva de materiais</span>
        </div>
        <div className={styles.navActions}>
          <button
            type="button"
            className={activeView === "alloys" ? styles.activeNav : ""}
            onClick={() => setActiveView("alloys")}
          >
            Banco de ligas
          </button>
          <button type="button" className={styles.navDisabled} disabled title="Em desenvolvimento">
            Importar leituras XRF
            <span className={styles.wip}>Em breve</span>
          </button>
          <button type="button" className={styles.navDisabled} disabled title="Em desenvolvimento">
            Relatórios
            <span className={styles.wip}>Em breve</span>
          </button>
        </div>
      </nav>

      {activeView === "reports" ? (
        <ReportBuilderPanel />
      ) : activeView === "import" ? (
        <ImportXrfPanel onBack={() => setActiveView("alloys")} />
      ) : (
        <>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Banco de dados metalúrgico</span>
          <h1>Consulta de ligas metálicas</h1>
          <h2 className={styles.heroSubtitle}>Handbook of Comparative World Steel Standards</h2>
          <p>
            Explore composições químicas, filtre por família, norma, grau, UNS e intervalos de elementos
            para encontrar equivalências e especificações.
          </p>
        </div>
        <div className={styles.heroCard}>
          <strong>{database.alloys.length.toLocaleString("pt-BR")}</strong>
          <span>ligas e especificações indexadas</span>
        </div>
      </section>

      <section className={styles.metricsGrid}>
        <div><strong>{filtered.length.toLocaleString("pt-BR")}</strong><span>resultados filtrados</span></div>
        <div><strong>{standards.toLocaleString("pt-BR")}</strong><span>designações/normas</span></div>
        <div><strong>{uns.toLocaleString("pt-BR")}</strong><span>UNS identificados</span></div>
        <div><strong>{database.elements.length}</strong><span>elementos principais</span></div>
      </section>

      <section className={styles.panel}>
        <div className={styles.filters}>
          <label>
            Busca global
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: ASTM A 240, 316, S30400, pressure vessel" />
          </label>
          <label>
            Família
            <select value={family} onChange={(event) => setFamily(event.target.value)}>
              <option>Todos</option>
              {database.families.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Capítulo
            <select value={chapter} onChange={(event) => setChapter(event.target.value)}>
              <option>Todos</option>
              {database.chapters.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Elemento
            <select value={element} onChange={(event) => setElement(event.target.value)}>
              {database.elements.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Mín. %
            <input type="number" step="0.01" value={min} onChange={(event) => setMin(event.target.value)} placeholder="0" />
          </label>
          <label>
            Máx. %
            <input type="number" step="0.01" value={max} onChange={(event) => setMax(event.target.value)} placeholder="100" />
          </label>
        </div>
      </section>

      <section className={styles.summaryRow}>
        <section className={`${styles.panel} ${styles.familyPanel}`}>
          <h2>Distribuição por família</h2>
          <div className={styles.bars}>
            {topFamilies.map((item) => (
              <button key={item.name} onClick={() => setFamily(item.name)} className={family === item.name ? styles.activeBar : ""}>
                <span>{item.name}</span>
                <div><i style={{ width: `${(item.count / database.alloys.length) * 100}%` }} /></div>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
        </section>

        {selected && (
          <section className={styles.detailPanel}>
            <div>
              <span className={styles.eyebrow}>Ficha técnica</span>
              <h2>{selected.grade || selected.standard || "Liga selecionada"}</h2>
              <p>{selected.sectionPt || selected.section}</p>
            </div>
            <dl>
              <div><dt>Norma</dt><dd>{selected.standard || "—"}</dd></div>
              <div><dt>Steel number</dt><dd>{selected.steelNumber || "—"}</dd></div>
              <div><dt>UNS</dt><dd>{selected.unsNumber || "—"}</dd></div>
              <div><dt>Outros</dt><dd>{selected.others || "—"}</dd></div>
            </dl>
          </section>
        )}
      </section>

      <section className={`${styles.panel} ${styles.resultsPanel}`}>
        <div className={styles.tableHeader}>
          <h2>Resultados</h2>
          <span>Mostrando {visible.length} de {filtered.length}</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.resultsTable}>
              <thead>
                <tr>
                  <th rowSpan={2}>Grau / Tipo</th>
                  <th rowSpan={2}>Norma</th>
                  <th rowSpan={2}>UNS</th>
                  <th rowSpan={2}>Família</th>
                  {database.elements.map((item) => (
                    <th key={item} colSpan={2} className={styles.elementHeader}>{item}</th>
                  ))}
                </tr>
                <tr>
                  {database.elements.flatMap((item) => [
                    <th key={`${item}-min`} className={styles.limitHeader}>Mín.</th>,
                    <th key={`${item}-max`} className={styles.limitHeader}>Máx.</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {visible.map((alloy) => (
                  <tr
                    key={alloy.id}
                    onClick={() => setSelectedId(alloy.id)}
                    className={selected?.id === alloy.id ? styles.selectedRow : ""}
                  >
                    <td><strong>{alloy.grade || "—"}</strong><small>{alloy.steelNumber || alloy.chapter}</small></td>
                    <td>{alloy.standard || "—"}</td>
                    <td>{alloy.unsNumber || "—"}</td>
                    <td>{alloy.family}</td>
                    {database.elements.flatMap((item) => {
                      const range = alloy.elements[item];
                      return [
                        <td key={`${item}-min`}>{formatLimit(range?.min ?? null)}</td>,
                        <td key={`${item}-max`}>{formatLimit(range?.max ?? null)}</td>,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
          </table>
        </div>
      </section>
        </>
      )}
    </main>
  );
}
