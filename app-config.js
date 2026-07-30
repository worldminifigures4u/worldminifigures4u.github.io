// Constantes partilhadas do site (carregar antes dos modulos da app).
const SUPABASE_URL = 'https://gksndzxadndrsynvzgzb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrc25kenhhZG5kcnN5bnZ6Z3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc5NzMsImV4cCI6MjA5NDY2Mzk3M30.EHZgacYr27dqoc4CJHsOwkNnJFGlLIteSHBi4B1HfVE';
const URL_PUBLICO_FALLBACK = 'https://figuresplanet.com/';
const ADMIN_EMAILS = ['worldminifigures4u@gmail.com'];
const PESO_PADRAO_PRODUTO_GRAMAS = 10;
const NOME_CONTA_CABECALHO_KEY = 'figures-planet-conta-primeiro-nome';
const CONTA_BLOQUEADA_KEY = 'figures-planet-conta-bloqueada';

/** Fecha o modal só se o clique começar e acabar no fundo (evita fechar ao selecionar texto). */
function ligarFechoModalPorFundo(modal, fechar) {
    if (!modal || typeof fechar !== 'function') return;
    let pointerDownNoFundo = false;
    modal.addEventListener('pointerdown', (evento) => {
        pointerDownNoFundo = evento.target === modal;
    });
    modal.addEventListener('pointercancel', () => {
        pointerDownNoFundo = false;
    });
    modal.addEventListener('click', (evento) => {
        if (evento.target === modal && pointerDownNoFundo) fechar(evento);
        pointerDownNoFundo = false;
    });
}
