-- Schema dedicado para o app de leituras XRF.
-- Isolado em "xrf" para nao afetar tabelas existentes em "public" no mesmo projeto Supabase.

create schema if not exists xrf;

create table if not exists xrf.readings (
  id bigint generated always as identity primary key,
  source_file text not null,
  reading_date date not null,
  reading_time time not null,
  reading_number int not null,
  averaging numeric,
  duration numeric,
  name text,
  descricao text,
  corrida text,
  qtd text,
  laudo text,
  norma text,
  pass_threshold numeric,
  pass_fail text,
  match text,
  alloy_1 text,
  alloy_2 text,
  unit text,
  elements jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (reading_date, reading_time, reading_number, name)
);
