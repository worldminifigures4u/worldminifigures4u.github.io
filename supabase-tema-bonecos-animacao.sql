-- Muda o tema "Bonecos" para "Animação" em todos os produtos.
update public.produtos
set tema = 'Animação'
where trim(tema) = 'Bonecos';

-- Confirmação: deve devolver 0
select count(*) as ainda_bonecos from public.produtos where trim(tema) = 'Bonecos';
