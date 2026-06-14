import pdfplumber

PDF = "MAEN0006.pdf"

with pdfplumber.open(PDF) as pdf:
    # PDF page index is 0-based; book page 23 -> PDF page 38 -> index 37
    for idx in [37, 38]:
        page = pdf.pages[idx]
        print(f"===== PDF PAGE {idx+1} =====")
        tables = page.extract_tables()
        print(f"Tabelas encontradas: {len(tables)}")
        for ti, table in enumerate(tables):
            print(f"--- Tabela {ti} ({len(table)} linhas) ---")
            for row in table[:8]:
                print(row)
