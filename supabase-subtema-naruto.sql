-- Naruto passa a subtema de "Animação".
update public.produtos set tema = 'Animação', subtema = 'Naruto'
where trim(tema) = 'Naruto';

select nome, tema, subtema, stock from public.produtos where subtema = 'Naruto';
