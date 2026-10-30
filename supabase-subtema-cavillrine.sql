-- Cavillrine não é X-Men: fica em Marvel sem subtema.
update public.produtos set subtema = 'semsubtema'
where trim(nome) = 'Cavillrine' and trim(tema) = 'Marvel';

select nome, tema, subtema from public.produtos where trim(nome) = 'Cavillrine';
