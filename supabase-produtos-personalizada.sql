-- Campo "Personalizada" nos produtos (aplicado via migração produtos_personalizada).
alter table public.produtos add column if not exists personalizada boolean not null default false;
-- listar_produtos_mapas_admin e listar_produtos_plataforma_admin passaram a devolver 'personalizada'.
-- Gravação: public.definir_personalizada_produto_admin(p_id text, p_valor boolean) (só admin).
