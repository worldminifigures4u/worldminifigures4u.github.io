-- Figuras de Indiana Jones: tema "Filmes e Séries", subtema "Indiana Jones" (igual ao Wallapop).
-- Inclui os 4 Shanghai Gangster, que estavam em "Cidade".

select nome, tema, subtema, stock, ativo from public.produtos
where trim(nome) in ('Indiana Jones', 'Indiana Jones 2023', 'Indiana Jones Dial of Destiny',
  'Professor Henry Jones v1', 'Professor Henry Jones v2', 'Sallah Faisel el-Kahir', 'Múmia',
  'Shanghai Gangster v1', 'Shanghai Gangster v2', 'Shanghai Gangster v3', 'Shanghai Gangster v4');

update public.produtos set tema = 'Filmes e Séries', subtema = 'Indiana Jones'
where trim(nome) in ('Indiana Jones', 'Indiana Jones 2023', 'Indiana Jones Dial of Destiny',
  'Professor Henry Jones v1', 'Professor Henry Jones v2', 'Sallah Faisel el-Kahir', 'Múmia',
  'Shanghai Gangster v1', 'Shanghai Gangster v2', 'Shanghai Gangster v3', 'Shanghai Gangster v4');

-- Confirmação: devem aparecer 11
select nome, stock, ativo from public.produtos where subtema = 'Indiana Jones' order by nome;
