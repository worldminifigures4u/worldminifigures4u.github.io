-- Figuras em "Tempos Antigos" no site mas em "(Medieval)" no Wallapop.
update public.produtos set tema = 'Medieval', subtema = 'semsubtema'
where trim(tema) = 'Tempos Antigos'
  and trim(nome) in ('Cavaleiro Templário v2', 'Cavaleiro Templário v3', 'Cavaleiro Templário v4',
                     'Teutonic Knight v1', 'Teutonic Knight v2', 'Golden Knight', 'Evil Dwarf');

select nome, tema, stock from public.produtos where trim(tema) = 'Medieval' order by nome;
