-- Passa as figuras "Viking" e "Viking Magnus" para o tema "Medieval", com subtema "Vikings".

-- Antes: ver quais vão mudar (devem ser 2)
select nome, tema, subtema from public.produtos where trim(nome) in ('Viking', 'Viking Magnus');

update public.produtos
set tema = 'Medieval',
    subtema = 'Vikings'
where trim(nome) in ('Viking', 'Viking Magnus');

-- Confirmação: deve mostrar as 2 em Medieval / Vikings
select nome, tema, subtema from public.produtos where subtema = 'Vikings';
