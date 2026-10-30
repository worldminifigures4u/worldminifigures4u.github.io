-- "Echo Clone Force 99" passa para o subtema Bad Batch (igual ao título no Wallapop).
update public.produtos set subtema = 'Bad Batch'
where trim(nome) = 'Echo Clone Force 99' and trim(tema) = 'Star Wars';

select nome, tema, subtema from public.produtos where subtema = 'Bad Batch' order by nome;
