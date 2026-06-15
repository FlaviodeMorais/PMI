"use client";

import { useState } from "react";

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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao importar arquivo");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Importar leituras XRF</h1>
      <p>Selecione o arquivo CSV exportado pelo equipamento XRF.</p>

      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!file || loading} style={{ marginLeft: "1rem" }}>
          {loading ? "Importando..." : "Importar"}
        </button>
      </form>

      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>Erro: {error}</p>
      )}

      {result && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Resumo da importação</h2>
          <ul>
            <li>Arquivo: {result.file}</li>
            <li>Linhas no arquivo: {result.totalLines}</li>
            <li>Linhas processadas: {result.parsed}</li>
            <li>Inseridas: {result.inserted}</li>
            <li>Duplicadas (ignoradas): {result.duplicates}</li>
            <li>Falhas ao gravar: {result.failed}</li>
          </ul>

          {result.parseErrors.length > 0 && (
            <>
              <h3>Erros de leitura ({result.parseErrors.length})</h3>
              <ul>
                {result.parseErrors.map((e, i) => (
                  <li key={i}>
                    Linha {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </>
          )}

          {result.dbErrors.length > 0 && (
            <>
              <h3>Erros de gravação</h3>
              <ul>
                {result.dbErrors.map((msg, i) => (
                  <li key={i} style={{ color: "red" }}>
                    {msg}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </main>
  );
}
