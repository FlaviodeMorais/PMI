-- Concede acesso ao schema "xrf" para os roles usados pela Data API do Supabase.
-- Necessario apos expor o schema "xrf" em Project Settings > Data API > Exposed schemas.
-- Nao afeta nenhum outro schema (ex: public).

grant usage on schema xrf to anon, authenticated, service_role;

grant all on all tables in schema xrf to anon, authenticated, service_role;
grant all on all sequences in schema xrf to anon, authenticated, service_role;
grant all on all routines in schema xrf to anon, authenticated, service_role;

alter default privileges in schema xrf grant all on tables to anon, authenticated, service_role;
alter default privileges in schema xrf grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema xrf grant all on routines to anon, authenticated, service_role;
