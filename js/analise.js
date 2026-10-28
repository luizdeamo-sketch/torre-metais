/* Torre de Controle - Metais: cálculos sobre as séries (sem tela).
   Tudo em cima de window.__PRECOS (gerado pelo coletor). Preço em R$/t = US$/t × PTAX do mesmo dia (ou do último dia útil antes). */
(function () {
  const P = window.__PRECOS;
  const datasDolar = Object.keys(P.dolar);

  function dolarEm(data) {
    if (P.dolar[data]) return P.dolar[data];
    let lo = 0, hi = datasDolar.length - 1, achou = null;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (datasDolar[m] <= data) { achou = m; lo = m + 1; } else hi = m - 1; }
    return achou == null ? null : P.dolar[datasDolar[achou]];
  }

  // Série do metal: [{data, usd, m3, estoque, dolar, brl}]
  const cache = {};
  function serie(chave) {
    if (cache[chave]) return cache[chave];
    const s = P.metais[chave].serie, out = [];
    for (const d of Object.keys(s)) {
      const [usd, m3, est] = s[d], dol = dolarEm(d);
      if (usd == null || dol == null) continue;
      out.push({ data: d, usd, m3, estoque: est, dolar: dol, brl: usd * dol });
    }
    return (cache[chave] = out);
  }
  function serieDolar() { return datasDolar.map(d => ({ data: d, valor: P.dolar[d] })); }

  const ultimo = a => a[a.length - 1];
  function diasAtras(a, dias) { // ponto mais recente com data <= hoje - dias
    const alvo = new Date(ultimo(a).data); alvo.setDate(alvo.getDate() - dias);
    const iso = alvo.toISOString().slice(0, 10);
    for (let i = a.length - 1; i >= 0; i--) if (a[i].data <= iso) return a[i];
    return a[0];
  }
  function janela(a, dias) {
    const alvo = new Date(ultimo(a).data); alvo.setDate(alvo.getDate() - dias);
    const iso = alvo.toISOString().slice(0, 10);
    return a.filter(p => p.data > iso);
  }
  const variacao = (agora, antes) => (agora / antes - 1) * 100;
  function percentil(valores, v) { // % dos dias em que o valor foi MENOR que v
    if (!valores.length) return 50;
    return valores.filter(x => x < v).length / valores.length * 100;
  }
  function quantil(valores, q) {
    const s = [...valores].sort((a, b) => a - b); if (!s.length) return null;
    const i = (s.length - 1) * q, b = Math.floor(i);
    return s[b] + (s[Math.min(b + 1, s.length - 1)] - s[b]) * (i - b);
  }
  const media = v => v.reduce((a, b) => a + b, 0) / (v.length || 1);
  function mediaMovel(a, n, campo) {
    return a.map((p, i) => i < n - 1 ? null : media(a.slice(i - n + 1, i + 1).map(x => x[campo])));
  }

  // De onde veio a variação em R$ no período: parte do metal (em US$) e parte do dólar.
  function decomposicao(a, dias) {
    const h = ultimo(a), ant = diasAtras(a, dias);
    const total = h.brl - ant.brl;
    const efeitoMetal = (h.usd - ant.usd) * ant.dolar;
    const efeitoDolar = (h.dolar - ant.dolar) * h.usd;
    return { dias, antes: ant, total, efeitoMetal, efeitoDolar, pct: variacao(h.brl, ant.brl) };
  }

  // Termômetro: o preço está barato ou caro? e o mercado empurra para cima ou para baixo?
  function termometro(chave) {
    const a = serie(chave), h = ultimo(a), ano = janela(a, 365).map(p => p.brl);
    const pctAno = percentil(ano, h.brl);
    const m60 = media(janela(a, 90).slice(-60).map(p => p.brl));
    const sinais = [];
    let pressao = 0;
    // tendência: média de 20 dias contra a de 60
    const ult60 = a.slice(-60).map(p => p.brl), m20 = media(ult60.slice(-20)), mm60 = media(ult60);
    if (m20 > mm60 * 1.01) { pressao++; sinais.push({ t: "alta", txt: "Tendência de alta: a média das últimas 4 semanas está acima da média de 3 meses." }); }
    else if (m20 < mm60 * 0.99) { pressao--; sinais.push({ t: "baixa", txt: "Tendência de queda: a média das últimas 4 semanas está abaixo da média de 3 meses." }); }
    else sinais.push({ t: "neutro", txt: "Sem tendência clara nas últimas semanas." });
    const m = P.metais[chave];
    if (m.tem3m && h.m3 != null) {
      const spread = (h.usd - h.m3) / h.usd * 100;
      if (spread > 0.5) { pressao++; sinais.push({ t: "alta", txt: `Metal para entrega imediata está ${spread.toFixed(1)}% mais caro que para 3 meses: falta metal agora.` }); }
      else if (spread < -1.5) { pressao--; sinais.push({ t: "baixa", txt: `Metal para 3 meses está ${(-spread).toFixed(1)}% mais caro que o imediato: há metal sobrando agora.` }); }
      else sinais.push({ t: "neutro", txt: "Preço imediato e de 3 meses próximos: mercado equilibrado." });
    }
    if (h.estoque != null) {
      const e30 = diasAtras(a, 30).estoque;
      if (e30) {
        const ve = variacao(h.estoque, e30);
        if (ve < -5) { pressao++; sinais.push({ t: "alta", txt: `Estoque da LME caiu ${(-ve).toFixed(0)}% em 30 dias: menos metal disponível.` }); }
        else if (ve > 5) { pressao--; sinais.push({ t: "baixa", txt: `Estoque da LME subiu ${ve.toFixed(0)}% em 30 dias: mais metal disponível.` }); }
        else sinais.push({ t: "neutro", txt: `Estoque da LME estável em 30 dias (${ve >= 0 ? "+" : ""}${ve.toFixed(0)}%).` });
      }
    }
    const nivel = pctAno <= 25 ? "barato" : pctAno >= 75 ? "caro" : "medio";
    const dir = pressao > 0 ? "alta" : pressao < 0 ? "baixa" : "neutra";
    const R = {
      "barato|alta": ["bom", "Bom momento para comprar", "Preço em R$ entre os mais baixos do ano e o mercado mostra pressão de alta.", "ruim", "Segure a venda se puder"],
      "barato|neutra": ["bom", "Bom momento para comprar", "Preço em R$ entre os mais baixos do ano.", "ruim", "Momento fraco para vender"],
      "barato|baixa": ["bom", "Compre em partes", "Preço baixo, mas o mercado ainda empurra para baixo: divida a compra em lotes.", "ruim", "Momento fraco para vender"],
      "medio|alta": ["medio", "Compre o planejado", "Preço na média do ano, com pressão de alta: não adie compras necessárias.", "medio", "Venda o planejado"],
      "medio|neutra": ["medio", "Compre o planejado", "Preço na média do ano, sem pressão clara.", "medio", "Venda o planejado"],
      "medio|baixa": ["medio", "Pode esperar um pouco", "Preço na média do ano e o mercado empurra para baixo.", "medio", "Antecipe vendas se puder"],
      "caro|alta": ["ruim", "Compre só o necessário", "Preço em R$ entre os mais altos do ano e ainda subindo.", "bom", "Bom momento para vender"],
      "caro|neutra": ["ruim", "Compre só o necessário", "Preço em R$ entre os mais altos do ano.", "bom", "Bom momento para vender"],
      "caro|baixa": ["ruim", "Espere se puder", "Preço alto e o mercado mostra sinais de queda.", "bom", "Venda agora, antes de cair"],
    }[nivel + "|" + dir];
    return { nivel, dir, pctAno, m60, sinais, compra: { cor: R[0], titulo: R[1], porque: R[2] }, venda: { cor: R[3], titulo: R[4] } };
  }

  function resumo(chave) {
    const a = serie(chave), h = ultimo(a);
    return {
      chave, nome: P.metais[chave].nome, bolsa: P.metais[chave].bolsa, h,
      v1: variacao(h.brl, a[a.length - 2].brl), v7: variacao(h.brl, diasAtras(a, 7).brl),
      v30: variacao(h.brl, diasAtras(a, 30).brl), v365: variacao(h.brl, diasAtras(a, 365).brl),
      v30usd: variacao(h.usd, diasAtras(a, 30).usd),
      termo: termometro(chave), dec: decomposicao(a, 30),
    };
  }

  function resumoDolar() {
    const a = serieDolar().map(p => ({ data: p.data, brl: p.valor })), h = ultimo(a);
    const ano = janela(a, 365).map(p => p.brl);
    return { h, v1: variacao(h.brl, a[a.length - 2].brl), v30: variacao(h.brl, diasAtras(a, 30).brl),
      v365: variacao(h.brl, diasAtras(a, 365).brl), pctAno: percentil(ano, h.brl), min: Math.min(...ano), max: Math.max(...ano), serie: a };
  }

  window.Analise = { serie, serieDolar, resumo, resumoDolar, janela, diasAtras, quantil, media, mediaMovel, percentil, variacao, ultimo, dolarEm };
})();
