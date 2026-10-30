-- Ninjago passa a subtema de "Animação" (igual aos títulos do Wallapop).
update public.produtos set tema = 'Animação', subtema = 'Ninjago'
where trim(tema) = 'Ninjago';

-- Confirmação: a primeira deve dar 0, a segunda as figuras do Ninjago
select count(*) as ainda_tema_ninjago from public.produtos where trim(tema) = 'Ninjago';
select nome, stock, ativo from public.produtos where subtema = 'Ninjago' order by nome;
