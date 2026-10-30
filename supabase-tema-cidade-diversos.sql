-- Figuras que estão em "Diversos" no site mas em "(Cidade)" no Wallapop.
update public.produtos set tema = 'Cidade', subtema = 'semsubtema'
where trim(nome) in ('Boneco de Neve v1', 'Mr. Gold', 'Party Clown', 'Quebra-Nozes', 'Universitário')
  and trim(tema) = 'Diversos';

select nome, tema, stock from public.produtos
where trim(nome) in ('Boneco de Neve v1', 'Mr. Gold', 'Party Clown', 'Quebra-Nozes', 'Universitário');
