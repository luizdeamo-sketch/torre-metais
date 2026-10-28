/* Torre de Controle - Metais: cálculos sobre as séries (sem tela).
   Tudo em cima de window.__PRECOS (gerado pelo coletor). Preço em R$/t = US$/t × PTAX do mesmo dia (ou do último dia útil antes).
   A inteligência de compra e venda mora aqui:
   - indices(): Índice de compra e Índice de venda (0 a 100) de qualquer dia do histórico;
   - evidencia(): o que aconteceu com o preço nos 30 dias seguintes quando o índice esteve na mesma faixa;
   - radar(): as oportunidades e os avisos de hoje, do mais forte para o mais fraco. */
(function () {
  const P = window.__PRECOS;
  const datasDolar = Object.keys(P.dolar);

  function idxAte(datas, data) { // último índice com datas[i] <= data
    let lo = 0, hi = datas.length - 1, achou = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (datas[m] <= data) { achou = m; lo = m + 1; } else hi = m - 1; }
    return achou;
  }
  function dolarEm(data) {
    if (P.dolar[data]) return P.dolar[data];
    const i = idxAte(datasDolar, data);
    return i < 0 ? null : P.dolar[datasDolar[i]];
  }
  const isoMenos = (iso, dias) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - dias); return d.toISOString().slice(0, 10); };
  const isoMais = (iso, dias) => isoMenos(iso, -dias);

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
    out.datas = out.map(p => p.data);
    return (cache[chave] = out);
  }
  function serieDolar() { return datasDolar.map(d => ({ data: d, valor: P.dolar[d] })); }

  const ultimo = a => a[a.length - 1];
  function diasAtras(a, dias) { // ponto mais recente com data <= último - dias
    const iso = isoMenos(ultimo(a).data, dias);
    for (let i = a.length - 1; i >= 0; i--) if (a[i].data <= iso) return a[i];
    return a[0];
  }
  function janela(a, dias) {
    const iso = isoMenos(ultimo(a).data, dias);
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
  const limita = v => Math.max(0, Math.min(100, Math.round(v)));

  // Pesos do índice antigo, só para coletor/calibrar.js (relatório em coletor/calibracao.md). O site usa o termômetro.
  // Cada peso multiplica um sinal: valor (onde o preço está na janela), tendencia, spread (imediato × 3 meses), estoque, dolar, semana.
  // Peso negativo inverte o sinal (ex.: tendência de alta passa a pesar a favor de vender, não de comprar).
  const CFG = {
    janela: 365,
    compra: { valor: 1, tendencia: 1, spread: 1, estoque: 1, dolar: 1, semana: 1 },
    venda: { valor: 1, tendencia: 1, spread: 1, estoque: 1, dolar: 1, semana: 1 },
  };
  const virg = (v, d = 1) => v.toFixed(d).replace(".", ",");

  // Onde o dólar estava no ano, em cada dia (0 = o mais barato do ano, 100 = o mais caro).
  const pctDolarCache = {};
  function pctDolarEm(data) {
    const i = idxAte(datasDolar, data); if (i < 0) return 50;
    const d = datasDolar[i]; if (pctDolarCache[d] != null) return pctDolarCache[d];
    const ini = isoMenos(d, 365), v = P.dolar[d], ano = [];
    for (let j = i; j >= 0 && datasDolar[j] > ini; j--) ano.push(P.dolar[datasDolar[j]]);
    return (pctDolarCache[d] = percentil(ano, v));
  }

  // ---------- leitura de um dia ----------
  // Tudo calculado só com o que se sabia até aquele dia (serve para o histórico sem "olhar o futuro").
  function leituraEm(chave, i) {
    const a = serie(chave), h = a[i], m = P.metais[chave];
    const iniAno = isoMenos(h.data, CFG.janela), ano = [];
    for (let j = i; j >= 0 && a[j].data > iniAno; j--) ano.push(a[j].brl);
    const pctAno = percentil(ano, h.brl);
    const sinais = []; let pressao = 0, tend = 0, spr = 0, est = 0;
    if (i >= 59) {
      let s20 = 0, s60 = 0;
      for (let j = i - 59; j <= i; j++) { s60 += a[j].brl; if (j > i - 20) s20 += a[j].brl; }
      const m20 = s20 / 20, mm60 = s60 / 60;
      if (m20 > mm60 * 1.01) { pressao++; tend = 1; sinais.push({ t: "alta", txt: "Tendência de alta: a média das últimas 4 semanas está acima da média de 3 meses." }); }
      else if (m20 < mm60 * 0.99) { pressao--; tend = -1; sinais.push({ t: "baixa", txt: "Tendência de queda: a média das últimas 4 semanas está abaixo da média de 3 meses." }); }
      else sinais.push({ t: "neutro", txt: "Sem tendência clara nas últimas semanas." });
    }
    let spread = null;
    if (m.tem3m && h.m3 != null) {
      spread = (h.usd - h.m3) / h.usd * 100;
      if (spread > 0.5) { pressao++; spr = 1; sinais.push({ t: "alta", txt: `Metal para entrega imediata está ${virg(spread)}% mais caro que para 3 meses: falta metal agora.` }); }
      else if (spread < -1.5) { pressao--; spr = -1; sinais.push({ t: "baixa", txt: `Metal para 3 meses está ${virg(-spread)}% mais caro que o imediato: há metal sobrando agora.` }); }
      else sinais.push({ t: "neutro", txt: "Preço imediato e de 3 meses próximos: mercado equilibrado." });
    }
    let ve30 = null;
    if (h.estoque != null) {
      const j30 = idxAte(a.datas, isoMenos(h.data, 30)), e30 = j30 >= 0 ? a[j30].estoque : null;
      if (e30) {
        ve30 = variacao(h.estoque, e30);
        const t = Math.abs(ve30).toFixed(0);
        if (ve30 < -5) { pressao++; est = 1; sinais.push({ t: "alta", txt: `Estoque da LME caiu ${t}% em 30 dias: menos metal disponível.` }); }
        else if (ve30 > 5) { pressao--; est = -1; sinais.push({ t: "baixa", txt: `Estoque da LME subiu ${t}% em 30 dias: mais metal disponível.` }); }
        else sinais.push({ t: "neutro", txt: `Estoque da LME estável em 30 dias (${ve30 >= 0 ? "+" : "−"}${t}%).` });
      }
    }
    const j7 = idxAte(a.datas, isoMenos(h.data, 7)), v5 = j7 >= 0 ? variacao(h.brl, a[j7].brl) : 0, v5usd = j7 >= 0 ? variacao(h.usd, a[j7].usd) : 0;
    const pctDolar = pctDolarEm(h.data);
    return { i, data: h.data, h, pctAno, pressao, tend, spr, est, sinais, spread, ve30, v5, v5usd, pctDolar };
  }
  const leituraCache = {};
  const leitura = (chave, i) => { const c = chave + "|" + i; return leituraCache[c] || (leituraCache[c] = leituraEm(chave, i)); };

  // ---------- Índice antigo (só para coletor/calibrar.js, que guarda o teste que levou ao termômetro) ----------
  function pontua(L, tipo, w) {
    const s = tipo === "compra" ? 1 : -1;
    return limita(50 + w.valor * s * (50 - L.pctAno)
      + 8 * s * (w.tendencia * L.tend + w.spread * L.spr + w.estoque * L.est)
      + w.dolar * s * (50 - L.pctDolar) * 0.2
      + w.semana * 8 * (tipo === "compra" ? (L.v5 <= -3 ? 1 : 0) : (L.v5 >= 3 ? 1 : 0)));
  }

  // ---------- Termômetro de preço ----------
  // Onde o preço em R$ de hoje está entre os dias dos últimos 12 meses: 0 = o mais barato, 100 = o mais caro.
  // É um termômetro, não uma previsão: a calibração de 28/10/2026 (coletor/calibracao.md) mostrou que "comprar barato no ano"
  // ajudou de 2009 a 2019 e atrapalhou de 2020 em diante.
  const NIVEIS = [ // [até, chave, rótulo, leitura para quem compra, leitura para quem vende]
    [15, "mb", "Muito barato no ano", "Muito favorável para comprar", "Desfavorável para vender"],
    [35, "b", "Barato no ano", "Favorável para comprar", "Pouco favorável para vender"],
    [65, "m", "Na média do ano", "Neutro para comprar", "Neutro para vender"],
    [85, "c", "Caro no ano", "Pouco favorável para comprar", "Favorável para vender"],
    [101, "mc", "Muito caro no ano", "Desfavorável para comprar", "Muito favorável para vender"],
  ];
  function nivelDe(pct) { const n = NIVEIS.find(x => pct < x[0]); return { chave: n[1], rotulo: n[2], compra: n[3], venda: n[4] }; }

  // ---------- Risco de 30 dias, compra em lotes e chance de um preço-alvo ----------
  // a = [{data, brl}] em ordem. Para cada dia de início: o que o preço fez nos 30 dias seguintes (fim, mínimo e máximo),
  // e quanto um dia só e 4 lotes semanais se afastaram da média daquele mês.
  function riscoSerie(a, desde) {
    const datas = a.map(p => p.data), r30 = [], min30 = [], max30 = [], umDia = [], lotes = [];
    for (let i = 0; i < a.length; i++) {
      if (desde && a[i].data < desde) continue;
      const j = idxAte(datas, isoMais(a[i].data, 30));
      if (j <= i || a[j].data < isoMais(a[i].data, 27)) continue;
      const p0 = a[i].brl; let mn = Infinity, mx = -Infinity, soma = 0;
      for (let t = i; t <= j; t++) { soma += a[t].brl; if (t > i) { mn = Math.min(mn, a[t].brl); mx = Math.max(mx, a[t].brl); } }
      const mediaMes = soma / (j - i + 1);
      const lote = media([0, 7, 14, 21].map(d => a[idxAte(datas, isoMais(a[i].data, d))].brl));
      r30.push(a[j].brl / p0 - 1); min30.push(mn / p0 - 1); max30.push(mx / p0 - 1);
      umDia.push(Math.abs(p0 / mediaMes - 1)); lotes.push(Math.abs(lote / mediaMes - 1));
    }
    const pc = v => +(v * 100).toFixed(2);
    const percentis = v => { const o = [...v].sort((x, y) => x - y); return Array.from({ length: 101 }, (_, k) => pc(o[Math.round((o.length - 1) * k / 100)])); };
    return { n: r30.length, desde: (a.find(p => !desde || p.data >= desde) || a[0]).data.slice(0, 4),
      r30: [pc(quantil(r30, .1)), pc(quantil(r30, .5)), pc(quantil(r30, .9))],
      umDiaP90: pc(quantil(umDia, .9)), lotesP90: pc(quantil(lotes, .9)), min30: percentis(min30), max30: percentis(max30) };
  }
  // Chance (0 a 100) de o preço encostar num alvo nos próximos 30 dias, pela história. x = distância do alvo em % (negativo = abaixo).
  function chanceAlvo(R, x) {
    if (x <= 0) return R.min30.filter(v => v <= x).length / 101 * 100;
    return R.max30.filter(v => v >= x).length / 101 * 100;
  }
  const riscoCache = {};
  function risco(chave) { // memória de 15 anos (js/memoria.js) quando existe; senão, os ~3 anos do site
    if (riscoCache[chave]) return riscoCache[chave];
    const M = window.TM_MEMORIA && window.TM_MEMORIA.risco;
    return (riscoCache[chave] = (M && M[chave]) ||
      riscoSerie(chave === "dolar" ? serieDolar().map(p => ({ data: p.data, brl: p.valor })) : serie(chave)));
  }
  // Quanto do sobe-e-desce do preço em R$ nos últimos 12 meses veio do dólar (0 a 100), por variações de 30 dias.
  function parteDolar(chave) {
    const a = janela(serie(chave), 365), datas = a.map(p => p.data), du = [], dd = [];
    for (let i = 0; i < a.length; i++) {
      const j = idxAte(datas, isoMais(a[i].data, 30)); if (j <= i || a[j].data < isoMais(a[i].data, 27)) continue;
      du.push(Math.log(a[j].usd / a[i].usd)); dd.push(Math.log(a[j].dolar / a[i].dolar));
    }
    const mu = media(du), md = media(dd);
    const vu = media(du.map(v => (v - mu) ** 2)), vd = media(dd.map(v => (v - md) ** 2)), cv = media(du.map((v, k) => (v - mu) * (dd[k] - md)));
    const tot = vu + vd + 2 * cv;
    return tot > 0 ? limita((vd + cv) / tot * 100) : 0;
  }

  // ---------- resumo do metal ----------
  function termometro(chave) {
    const a = serie(chave), L = leitura(chave, a.length - 1);
    const sem = leitura(chave, Math.max(0, idxAte(a.datas, isoMenos(ultimo(a).data, 7))));
    return { ...L, pct: Math.round(L.pctAno), nivel: nivelDe(L.pctAno), pctAntes: Math.round(sem.pctAno), m60: media(a.slice(-60).map(p => p.brl)) };
  }
  // O termômetro dia a dia (para o gráfico da tela do metal).
  function historicoTermo(chave, dias) {
    const a = serie(chave), ini = isoMenos(ultimo(a).data, dias), out = [];
    for (let i = 250; i < a.length; i++) if (a[i].data > ini) out.push({ data: a[i].data, pct: Math.round(leitura(chave, i).pctAno) });
    return out;
  }

  // De onde veio a variação em R$ no período: parte do metal (em US$) e parte do dólar.
  function decomposicao(a, dias) {
    const h = ultimo(a), ant = diasAtras(a, dias);
    const total = h.brl - ant.brl;
    const efeitoMetal = (h.usd - ant.usd) * ant.dolar;
    const efeitoDolar = (h.dolar - ant.dolar) * h.usd;
    return { dias, antes: ant, total, efeitoMetal, efeitoDolar, pct: variacao(h.brl, ant.brl) };
  }

  const resumoCache = {};
  function resumo(chave) {
    if (resumoCache[chave]) return resumoCache[chave];
    const a = serie(chave), h = ultimo(a);
    return (resumoCache[chave] = {
      chave, nome: P.metais[chave].nome, bolsa: P.metais[chave].bolsa, h,
      v1: variacao(h.brl, a[a.length - 2].brl), v7: variacao(h.brl, diasAtras(a, 7).brl),
      v30: variacao(h.brl, diasAtras(a, 30).brl), v365: variacao(h.brl, diasAtras(a, 365).brl),
      v30usd: variacao(h.usd, diasAtras(a, 30).usd),
      termo: termometro(chave), dec: decomposicao(a, 30),
    });
  }

  function resumoDolar() {
    const a = serieDolar().map(p => ({ data: p.data, brl: p.valor })), h = ultimo(a);
    const ano = janela(a, 365).map(p => p.brl);
    return { h, v1: variacao(h.brl, a[a.length - 2].brl), v7: variacao(h.brl, diasAtras(a, 7).brl), v30: variacao(h.brl, diasAtras(a, 30).brl),
      v365: variacao(h.brl, diasAtras(a, 365).brl), pctAno: percentil(ano, h.brl), min: Math.min(...ano), max: Math.max(...ano), serie: a };
  }

  // ---------- Radar: o que mudou e merece atenção hoje ----------
  // Item: {id, tipo: compra|venda|atencao|dolar|meu, metal, titulo, texto, acao, forca, novo}
  // As ações são sugestões ("vale cotar", "considere"), nunca ordens: o termômetro não prevê o preço.
  // perfil = {papel: compra|venda|ambos, metais: [...]} ; meusPrecos = [{metal, tipo: abaixo|acima, valor}]
  const fmtPct = v => (v >= 0 ? "+" : "−") + virg(Math.abs(v)) + "%";
  const reais = v => "R$ " + Math.round(v).toLocaleString("pt-BR");
  function radar(perfil, meusPrecos) {
    perfil = perfil || { papel: "ambos", metais: [] };
    const querCompra = perfil.papel !== "venda", querVenda = perfil.papel !== "compra";
    const chaves = Object.keys(P.metais).filter(k => !perfil.metais || !perfil.metais.length || perfil.metais.includes(k));
    const itens = [];
    const lotesTxt = k => { const R = risco(k); return `Para volume grande, considere 4 lotes semanais: na história, um dia isolado ficou até ${virg(R.umDiaP90)}% longe da média do mês; 4 lotes, até ${virg(R.lotesP90)}%.`; };
    for (const k of chaves) {
      const r = resumo(k), t = r.termo, a = serie(k), nome = r.nome, dia = r.h.data, p = t.pct;
      const tri = janela(a, 90).map(x => x.brl), min90 = r.h.brl <= Math.min(...tri) * 1.0001, max90 = r.h.brl >= Math.max(...tri) * 0.9999;
      if (p < 15) itens.push({ id: `${k}|baixo|${dia}`, tipo: querCompra ? "compra" : "atencao", metal: k, forca: 70 + (15 - p),
        titulo: `Preço entre os mais baixos do ano · ${nome}`,
        texto: `Hoje o preço em R$ está abaixo de ${100 - p}% dos dias dos últimos 12 meses${min90 ? "; é o menor em 3 meses" : ""}.`,
        acao: querCompra ? "Vale cotar com o fornecedor. " + lotesTxt(k) : "Para quem vende, o preço está no fundo do ano: se puder, venda só o necessário.",
        novo: t.pctAntes >= 15 });
      else if (min90) itens.push({ id: `${k}|min90|${dia}`, tipo: querCompra ? "compra" : "atencao", metal: k, forca: 62,
        titulo: `Menor preço em 3 meses · ${nome}`, texto: "O preço em R$/t de hoje é o mais baixo dos últimos 90 dias.",
        acao: querCompra ? "Vale cotar hoje." : "Para quem vende, momento fraco.", novo: true });
      if (p >= 85) itens.push({ id: `${k}|alto|${dia}`, tipo: querVenda ? "venda" : "atencao", metal: k, forca: 70 + (p - 85),
        titulo: `Preço entre os mais altos do ano · ${nome}`,
        texto: `Hoje o preço em R$ está acima de ${p}% dos dias dos últimos 12 meses${max90 ? "; é o maior em 3 meses" : ""}.`,
        acao: querVenda ? "Vale oferecer agora a quem compra de você. Para volume grande, venda em lotes." : "Se a compra pode esperar, considere comprar só o necessário agora e o resto em lotes semanais.",
        novo: t.pctAntes < 85 });
      else if (max90) itens.push({ id: `${k}|max90|${dia}`, tipo: querVenda ? "venda" : "atencao", metal: k, forca: 62,
        titulo: `Maior preço em 3 meses · ${nome}`, texto: "O preço em R$/t de hoje é o mais alto dos últimos 90 dias.",
        acao: querVenda ? "Vale oferecer hoje." : "Considere comprar em lotes em vez de tudo de uma vez.", novo: true });
      // movimento forte do próprio metal na bolsa (em US$); o que é só do dólar vira o aviso do dólar
      if (Math.abs(t.v5usd) >= 4) itens.push({ id: `${k}|semana|${dia}`, tipo: "atencao", metal: k, forca: Math.round(55 + Math.min(30, Math.abs(t.v5usd) * 3)),
        titulo: `${t.v5usd > 0 ? "Alta" : "Queda"} forte na bolsa · ${nome}`,
        texto: `Em US$/t, o metal ${t.v5usd > 0 ? "subiu" : "caiu"} ${fmtPct(t.v5usd).slice(1)} em 7 dias (em R$/t: ${fmtPct(t.v5)}).`,
        acao: "Com o preço mexendo forte, fechar tudo num dia só fica mais arriscado: se houver pedido grande, considere lotes.", novo: true });
      if (t.ve30 != null && Math.abs(t.ve30) >= 12) itens.push({ id: `${k}|estoque|${dia}`, tipo: "atencao", metal: k, forca: 50,
        titulo: `Estoque da LME ${t.ve30 < 0 ? "caiu" : "subiu"} ${Math.abs(t.ve30).toFixed(0)}% em 30 dias · ${nome}`,
        texto: t.ve30 < 0 ? "Menos metal nos armazéns costuma sustentar o preço." : "Mais metal nos armazéns costuma pesar contra o preço.",
        acao: "É contexto para a negociação, não um sinal sozinho.", novo: false });
    }
    const d = resumoDolar(), dd = d.h.data, ptax = "R$ " + virg(d.h.brl, 4);
    if (d.pctAno <= 15) itens.push({ id: `dolar|baixo|${dd}`, tipo: "dolar", forca: Math.round(80 - d.pctAno),
      titulo: "Dólar entre os mais baixos do ano", texto: `PTAX a ${ptax}, abaixo de ${100 - Math.round(d.pctAno)}% dos dias do último ano.`,
      acao: "Quem compra em dólar e tem pagamento à frente pode considerar travar o câmbio com o banco (contrato a termo).", novo: true });
    if (d.pctAno >= 85) itens.push({ id: `dolar|alto|${dd}`, tipo: "dolar", forca: Math.round(d.pctAno - 10),
      titulo: "Dólar entre os mais altos do ano", texto: `PTAX a ${ptax}, acima de ${Math.round(d.pctAno)}% dos dias do último ano.`,
      acao: "Quem recebe em dólar pode considerar fechar câmbio. Quem compra: o custo em R$ subiu mesmo com o metal parado.", novo: true });
    if (Math.abs(d.v7) >= 2) itens.push({ id: `dolar|semana|${dd}`, tipo: "dolar", forca: Math.round(50 + Math.min(30, Math.abs(d.v7) * 5)),
      titulo: `Dólar ${d.v7 > 0 ? "subiu" : "caiu"} ${fmtPct(d.v7).slice(1)} na semana`, texto: "Isso mexe no preço em R$ de todos os metais na mesma proporção.",
      acao: d.v7 > 0 ? "Reveja os pedidos em aberto em dólar; para pagamentos grandes, vale conversar com o banco sobre travar o câmbio." : "Compras em dólar ficaram mais baratas em R$.", novo: true });
    for (const al of meusPrecos || []) {
      if (!P.metais[al.metal]) continue;
      const u = ultimo(serie(al.metal)), dist = (al.valor / u.brl - 1) * 100, ok = al.tipo === "abaixo" ? u.brl <= al.valor : u.brl >= al.valor;
      const nome = P.metais[al.metal].nome;
      if (ok) itens.push({ id: `${al.metal}|meu|${al.tipo}|${al.valor}|${u.data}`, tipo: "meu", metal: al.metal, forca: 95,
        titulo: `Seu preço chegou · ${nome}`, texto: `${al.tipo === "abaixo" ? "Abaixo" : "Acima"} de ${reais(al.valor)}/t: hoje está em ${reais(u.brl)}/t.`,
        acao: al.tipo === "abaixo" ? "É o preço que você queria pagar." : "É o preço que você queria receber.", novo: true });
      else if (Math.abs(dist) <= 2) itens.push({ id: `${al.metal}|perto|${al.tipo}|${al.valor}|${u.data}`, tipo: "meu", metal: al.metal, forca: 78,
        titulo: `Seu preço está perto · ${nome}`, texto: `Falta ${virg(Math.abs(dist))}% para ${reais(al.valor)}/t (hoje ${reais(u.brl)}/t).`,
        acao: "Deixe o pedido conversado com o fornecedor para fechar rápido se chegar.", novo: true });
    }
    return itens.sort((x, y) => y.forca - x.forca);
  }

  // Só para a calibração: troca a janela e limpa o que foi calculado com a antiga.
  function configurar(c) {
    if (c.janela && c.janela !== CFG.janela) for (const k in leituraCache) delete leituraCache[k];
    Object.assign(CFG, c);
    for (const k in resumoCache) delete resumoCache[k];
  }

  window.Analise = { configurar, leitura, pontua, CFG, serie, serieDolar, resumo, resumoDolar, janela, diasAtras, quantil, media, mediaMovel, percentil, variacao, ultimo, dolarEm,
    NIVEIS, nivelDe, riscoSerie, risco, chanceAlvo, parteDolar, historicoTermo, radar, isoMais };
})();
