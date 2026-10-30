-- Índio Apache, Xerife e Viajante do Faroeste passam de "Tempos Antigos" para "Faroeste".
update public.produtos set tema = 'Faroeste'
where trim(nome) in ('Índio Apache', 'Xerife', 'Viajante do Faroeste') and trim(tema) = 'Tempos Antigos';

select nome, stock, ativo from public.produtos where trim(tema) = 'Faroeste' order by nome;
