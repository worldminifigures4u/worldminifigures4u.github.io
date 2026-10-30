-- Põe o site igual aos títulos do Wallapop: tudo em "Animação", com o subtema do título.

-- Antes: ver o estado atual
select nome, tema, subtema, stock, ativo, arquivado from public.produtos
where trim(nome) in ('Lion-O', 'Freakazoid', 'Tom', 'Jerry', 'Bonolenov Ndongo Hunter × Hunter')
   or trim(tema) in ('Thundercats', 'Warner Bros', 'Bluey');

update public.produtos set tema = 'Animação', subtema = 'ThunderCats'      where trim(nome) = 'Lion-O';
update public.produtos set tema = 'Animação', subtema = 'Warner Bros'      where trim(nome) = 'Freakazoid';
update public.produtos set tema = 'Animação', subtema = 'Tom and Jerry'    where trim(nome) in ('Tom', 'Jerry') and trim(tema) = 'Animação';
update public.produtos set tema = 'Animação', subtema = 'Hunter × Hunter'  where trim(nome) = 'Bonolenov Ndongo Hunter × Hunter';
update public.produtos set tema = 'Animação', subtema = 'Bluey'            where trim(tema) = 'Bluey';

-- Confirmação: todas as figuras de Animação com o subtema
select nome, subtema, stock, ativo, arquivado from public.produtos where trim(tema) = 'Animação' order by subtema, nome;
