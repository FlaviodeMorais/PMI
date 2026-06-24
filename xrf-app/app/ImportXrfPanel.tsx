"use client";

import { useState } from "react";
import styles from "./page.module.css";

interface ParseError {
  line: number;
  message: string;
}

interface ImportResult {
  file: string;
  totalLines: number;
  parsed: number;
  inserted: number;
  duplicates: number;
  failed: number;
  parseErrors: ParseError[];
  dbErrors: string[];
}

interface Props {
  onBack: () => void;
}

export default function ImportXrfPanel({ onBack }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/import", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Erro ao importar arquivo.");
        return;
      }

      setResult(data);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.importWorkspace}>
      <div className={styles.importHero}>
        <div>
          <span className={styles.eyebrow}>Banco de Dados</span>
          <h1>Importar leituras do equipamento</h1>
          <p>
            Envie o CSV exportado pelo XRF. O sistema interpreta e modela os dados do equipamento,
            grava as leituras em lotes e ignora registros já importados.
          </p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onBack}>
          Voltar ao banco de ligas
        </button>
      </div>

      <form className={styles.importPanel} onSubmit={handleSubmit}>
        <label className={styles.fileDrop}>
          <span>{file ? file.name : "Selecione um arquivo CSV"}</span>
          <small>Formato exportado pelo equipamento XRF</small>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" className={styles.primaryButton} disabled={!file || loading}>
          {loading ? "Importando..." : "Importar para o Supabase"}
        </button>
      </form>

      {error && <div className={styles.errorMessage}>Erro: {error}</div>}

      {result && (
        <>
          <section className={styles.importMetrics}>
            <div><strong>{result.totalLines}</strong><span>linhas no arquivo</span></div>
            <div><strong>{result.parsed}</strong><span>linhas processadas</span></div>
            <div><strong>{result.inserted}</strong><span>novas leituras</span></div>
            <div><strong>{result.duplicates}</strong><span>duplicadas ignoradas</span></div>
            <div><strong>{result.failed}</strong><span>falhas de gravação</span></div>
          </section>

          {(result.parseErrors.length > 0 || result.dbErrors.length > 0) && (
            <section className={styles.importIssues}>
              <h2>Ocorrências da importação</h2>
              {result.parseErrors.map((parseError) => (
                <p key={`${parseError.line}-${parseError.message}`}>
                  Linha {parseError.line}: {parseError.message}
                </p>
              ))}
              {result.dbErrors.map((dbError) => <p key={dbError}>{dbError}</p>)}
            </section>
          )}
        </>
      )}
    </section>
  );
}
