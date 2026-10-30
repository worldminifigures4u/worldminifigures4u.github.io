-- Walter White v1 e v2: tema "Filmes e Séries", subtema "Breaking Bad".
update public.produtos set tema = 'Filmes e Séries', subtema = 'Breaking Bad'
where trim(nome) in ('Walter White Heisenberg v1', 'Walter White Heisenberg v2');

select nome, tema, subtema, stock, ativo from public.produtos where subtema = 'Breaking Bad';
