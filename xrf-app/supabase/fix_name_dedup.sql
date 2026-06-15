-- Reseta os dados de teste e corrige a coluna "name" de xrf.readings.
-- Postgres trata NULL como valor sempre distinto em UNIQUE constraints, entao
-- linhas com name = NULL nunca eram detectadas como duplicadas.
-- Nao afeta nenhuma tabela fora do schema xrf.

truncate table xrf.readings;

alter table xrf.readings alter column name set default '';
alter table xrf.readings alter column name set not null;

-- Confirma o resultado
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'xrf' and table_name = 'readings' and column_name = 'name';
