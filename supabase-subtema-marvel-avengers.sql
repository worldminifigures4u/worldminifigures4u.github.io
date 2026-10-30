-- Figuras com "(Avengers)" no título do Wallapop mas sem subtema no site.
update public.produtos set subtema = 'Avengers'
where trim(tema) = 'Marvel'
  and trim(nome) in ('Captain América Sam Wilson v2', 'Vision', 'Iron Patriot Endgame', 'Hulkbuster e Iron Man');

select nome, subtema from public.produtos
where trim(nome) in ('Captain América Sam Wilson v2', 'Vision', 'Iron Patriot Endgame', 'Hulkbuster e Iron Man');
