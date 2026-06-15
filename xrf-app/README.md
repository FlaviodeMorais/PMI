# XRF App

App para importar os logs CSV exportados pelo equipamento de XRF e gravá-los em um
banco Supabase, evitando duplicar leituras já importadas.

## 1. Criar a tabela no Supabase

No projeto Supabase, abra o **SQL Editor** e rode o conteúdo de
[`supabase/schema.sql`](supabase/schema.sql). Isso cria um schema dedicado `xrf` com a
tabela `xrf.readings` — não altera nada em `public` ou em outras tabelas existentes.

## 2. Configurar variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha com os dados do seu projeto
(Supabase → Project Settings → API):

```
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

A **service role key** é secreta — só é usada no servidor (API route), nunca é
enviada ao navegador. Não faça commit de `.env.local`.

## 3. Rodar localmente

Requer Node.js 18+.

```bash
npm install
npm run dev
```

Abra http://localhost:3000, selecione o CSV exportado do equipamento e clique em
"Importar". O resumo mostra quantas linhas foram inseridas e quantas já existiam
(duplicadas, ignoradas).

## 4. Deploy (Vercel)

1. Suba este diretório para um repositório no GitHub
2. Importe o projeto na [Vercel](https://vercel.com/new)
3. Configure as mesmas variáveis de ambiente (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`) em Project Settings → Environment Variables
4. Deploy

## Estrutura de dados

Cada linha do CSV é gravada em `xrf.readings`. Os ~31 elementos químicos (Ti, V,
Cr, Mn, Fe, ... L.E.) ficam na coluna `elements` (JSONB), no formato:

```json
{ "Ti": { "value": 1.82, "tol": 0.521 }, "Cr": { "value": 2.333, "tol": 0.196 } }
```

A deduplicação usa a chave única `(reading_date, reading_time, reading_number, name)` —
reenviar o mesmo arquivo não cria registros duplicados.
