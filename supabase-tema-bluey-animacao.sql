-- Passa as figuras do tema "Bluey" para o tema "Animação", com subtema "Bluey".

-- Antes: ver quais vão mudar (devem ser 4)
select nome, tema, subtema from public.produtos where trim(tema) = 'Bluey';

update public.produtos
set tema = 'Animação',
    subtema = 'Bluey'
where trim(tema) = 'Bluey';

-- Confirmação: a primeira deve devolver 0, a segunda as figuras do Bluey
select count(*) as ainda_tema_bluey from public.produtos where trim(tema) = 'Bluey';
select nome, tema, subtema from public.produtos where trim(tema) = 'Animação' and subtema = 'Bluey';
