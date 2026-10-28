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
    const iniAno = isoMenos(h.data, 365), ano = [];
    for (let j = i; j >= 0 && a[j].data > iniAno; j--) ano.push(a[j].brl);
    const pctAno = percentil(ano, h.brl);
    const sinais = []; let pressao = 0;
    if (i >= 59) {
      let s20 = 0, s60 = 0;
      for (let j = i - 59; j <= i; j++) { s60 += a[j].brl; if (j > i - 20) s20 += a[j].brl; }
      const m20 = s20 / 20, mm60 = s60 / 60;
      if (m20 > mm60 * 1.01) { pressao++; sinais.push({ t: "alta", txt: "Tendência de alta: a média das últimas 4 semanas está acima da média de 3 meses." }); }
      else if (m20 < mm60 * 0.99) { pressao--; sinais.push({ t: "baixa", txt: "Tendência de queda: a média das últimas 4 semanas está abaixo da média de 3 meses." }); }
      else sinais.push({ t: "neutro", txt: "Sem tendência clara nas últimas semanas." });
    }
    let spread = null;
    if (m.tem3m && h.m3 != null) {
      spread = (h.usd - h.m3) / h.usd * 100;
      if (spread > 0.5) { pressao++; sinais.push({ t: "alta", txt: `Metal para entrega imediata está ${virg(spread)}% mais caro que para 3 meses: falta metal agora.` }); }
      else if (spread < -1.5) { pressao--; sinais.push({ t: "baixa", txt: `Metal para 3 meses está ${virg(-spread)}% mais caro que o imediato: há metal sobrando agora.` }); }
      else sinais.push({ t: "neutro", txt: "Preço imediato e de 3 meses próximos: mercado equilibrado." });
    }
    let ve30 = null;
    if (h.estoque != null) {
      const j30 = idxAte(a.datas, isoMenos(h.data, 30)), e30 = j30 >= 0 ? a[j30].estoque : null;
      if (e30) {
        ve30 = variacao(h.estoque, e30);
        const t = Math.abs(ve30).toFixed(0);
        if (ve30 < -5) { pressao++; sinais.push({ t: "alta", txt: `Estoque da LME caiu ${t}% em 30 dias: menos metal disponível.` }); }
        else if (ve30 > 5) { pressao--; sinais.push({ t: "baixa", txt: `Estoque da LME subiu ${t}% em 30 dias: mais metal disponível.` }); }
        else sinais.push({ t: "neutro", txt: `Estoque da LME estável em 30 dias (${ve30 >= 0 ? "+" : "−"}${t}%).` });
      }
    }
    const j7 = idxAte(a.datas, isoMenos(h.data, 7)), v5 = j7 >= 0 ? variacao(h.brl, a[j7].brl) : 0, v5usd = j7 >= 0 ? variacao(h.usd, a[j7].usd) : 0;
    const pctDolar = pctDolarEm(h.data);
    return { i, data: h.data, h, pctAno, pressao, sinais, spread, ve30, v5, v5usd, pctDolar };
  }

  // ---------- Índice de compra e de venda (0 a 100) ----------
  // Compra alta = preço em R$ baixo no ano + mercado empurrando para cima (vai encarecer) + dólar barato + queda forte na semana.
  // Venda alta  = preço em R$ alto no ano + mercado empurrando para baixo (vai baratear) + dólar caro + alta forte na semana.
  function indices(chave, i) {
    const L = leituraEm(chave, i);
    const quedaForte = L.v5 <= -3 ? 8 : 0, altaForte = L.v5 >= 3 ? 8 : 0;
    const compra = limita((100 - L.pctAno) + L.pressao * 8 + (50 - L.pctDolar) * 0.2 + quedaForte);
    const venda = limita(L.pctAno - L.pressao * 8 + (L.pctDolar - 50) * 0.2 + altaForte);
    return { ...L, compra, venda };
  }
  const FAIXAS = [ // [mínimo, nível, frase de compra, frase de venda]
    [75, "forte", "Compre agora", "Venda agora"],
    [60, "bom", "Bom para comprar", "Bom para vender"],
    [40, "neutro", "Compre o planejado", "Venda o planejado"],
    [25, "fraco", "Espere se puder", "Segure se puder"],
    [0, "ruim", "Só o necessário", "Evite vender"],
  ];
  const faixa = v => FAIXAS.find(f => v >= f[0]);
  function rotulo(tipo, v) { const f = faixa(v); return { nivel: f[1], titulo: tipo === "compra" ? f[2] : f[3], valor: v }; }

  // Por que o índice está assim, em frases curtas.
  function motivos(L, tipo) {
    const out = [], p = Math.round(L.pctAno);
    const baixo = p <= 1 ? "preço em R$ no ponto mais baixo do ano" : `preço em R$ entre os ${p}% mais baixos do ano`;
    const alto = p >= 99 ? "preço em R$ no ponto mais alto do ano" : `preço em R$ acima de ${p}% dos dias do ano`;
    if (tipo === "compra") {
      if (p <= 30) out.push(baixo); else if (p >= 70) out.push(alto); else out.push("preço em R$ no meio da faixa do ano");
      if (L.pressao > 0) out.push("mercado empurrando para cima");
      if (L.pressao < 0) out.push("mercado ainda empurrando para baixo");
      if (L.pctDolar <= 30) out.push("dólar entre os mais baixos do ano");
      if (L.pctDolar >= 70) out.push("dólar caro no ano");
      if (L.v5 <= -3) out.push(`caiu ${virg(Math.abs(L.v5))}% em uma semana`);
    } else {
      if (p >= 70) out.push(alto); else if (p <= 30) out.push(baixo); else out.push("preço em R$ no meio da faixa do ano");
      if (L.pressao < 0) out.push("mercado mostrando sinais de queda");
      if (L.pressao > 0) out.push("mercado ainda empurrando para cima");
      if (L.pctDolar >= 70) out.push("dólar caro, bom para quem recebe em R$");
      if (L.pctDolar <= 30) out.push("dólar barato no ano");
      if (L.v5 >= 3) out.push(`subiu ${virg(L.v5)}% em uma semana`);
    }
    return out;
  }

  // ---------- histórico do índice e evidência ----------
  const histCache = {};
  function historico(chave) {
    if (histCache[chave]) return histCache[chave];
    const a = serie(chave), out = [];
    const inicio = idxAte(a.datas, isoMais(a[0].data, 300)) + 1; // só depois de ~1 ano de história, para o percentil valer
    for (let i = Math.max(inicio, 60); i < a.length; i++) {
      const x = indices(chave, i);
      const j = idxAte(a.datas, isoMais(a[i].data, 30));
      const fwd = (j > i && a[j].data >= isoMais(a[i].data, 28)) ? variacao(a[j].brl, a[i].brl) : null;
      out.push({ i, data: a[i].data, compra: x.compra, venda: x.venda, fwd30: fwd });
    }
    return (histCache[chave] = out);
  }
  // Nos dias do passado em que o índice esteve na mesma faixa de hoje, o que o preço fez nos 30 dias seguintes?
  function evidencia(chave, tipo, valor) {
    const f = faixa(valor), prox = FAIXAS[FAIXAS.indexOf(f) - 1];
    const dentro = v => v >= f[0] && (!prox || v < prox[0]);
    const h = historico(chave).filter(x => x.fwd30 != null);
    const casos = h.filter(x => dentro(x[tipo]));
    const bom = x => tipo === "compra" ? x.fwd30 > 0 : x.fwd30 < 0; // comprou e depois subiu / vendeu e depois caiu
    const pctBom = v => v.length ? v.filter(bom).length / v.length * 100 : null;
    return { n: casos.length, total: h.length, pctBom: pctBom(casos), mediaFwd: casos.length ? media(casos.map(x => x.fwd30)) : null,
      pctBomGeral: pctBom(h), faixa: f[1] };
  }

  // ---------- resumo do metal ----------
  function termometro(chave) {
    const a = serie(chave), x = indices(chave, a.length - 1);
    const sem = indices(chave, Math.max(0, idxAte(a.datas, isoMenos(ultimo(a).data, 7))));
    return { ...x, m60: media(a.slice(-60).map(p => p.brl)),
      compraR: rotulo("compra", x.compra), vendaR: rotulo("venda", x.venda),
      compraAntes: sem.compra, vendaAntes: sem.venda,
      porqueCompra: motivos(x, "compra"), porqueVenda: motivos(x, "venda") };
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

  // ---------- Radar: oportunidades e avisos de hoje ----------
  // Item: {id, tipo: compra|venda|atencao|dolar|meu, metal, titulo, texto, acao, forca, novo}
  // perfil = {papel: compra|venda|ambos, metais: [...]} ; meusPrecos = [{metal, tipo: abaixo|acima, valor}]
  const fmtPct = v => (v >= 0 ? "+" : "−") + virg(Math.abs(v)) + "%";
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const reais = v => "R$ " + Math.round(v).toLocaleString("pt-BR");
  function radar(perfil, meusPrecos) {
    perfil = perfil || { papel: "ambos", metais: [] };
    const querCompra = perfil.papel !== "venda", querVenda = perfil.papel !== "compra";
    const chaves = Object.keys(P.metais).filter(k => !perfil.metais || !perfil.metais.length || perfil.metais.includes(k));
    const itens = [];
    for (const k of chaves) {
      const r = resumo(k), t = r.termo, a = serie(k), nome = r.nome, dia = r.h.data;
      if (querCompra && t.compra >= 60) itens.push({ id: `${k}|compra|${dia}`, tipo: "compra", metal: k, forca: t.compra,
        titulo: `${t.compra >= 75 ? "Janela forte de compra" : "Janela de compra"} · ${nome}`,
        texto: cap(t.porqueCompra.join(", ")) + ".",
        acao: t.compra >= 75 ? "Antecipe as compras das próximas semanas ou trave preço com o fornecedor." : "Compre o volume do mês agora em vez de esperar.",
        novo: t.compraAntes < 60 });
      if (querVenda && t.venda >= 60) itens.push({ id: `${k}|venda|${dia}`, tipo: "venda", metal: k, forca: t.venda,
        titulo: `${t.venda >= 75 ? "Janela forte de venda" : "Janela de venda"} · ${nome}`,
        texto: cap(t.porqueVenda.join(", ")) + ".",
        acao: t.venda >= 75 ? "Feche vendas e contratos agora: o preço está no alto do ano." : "Venda o estoque parado em vez de segurar para esperar mais.",
        novo: t.vendaAntes < 60 });
      // movimento forte do próprio metal na bolsa (em US$); o que é só do dólar vira o aviso do dólar
      if (t.v5usd <= -4) itens.push({ id: `${k}|queda|${dia}`, tipo: "atencao", metal: k, forca: Math.round(55 + Math.min(30, -t.v5usd * 3)),
        titulo: `Queda forte na bolsa · ${nome}`, texto: `Em US$/t, o metal caiu ${fmtPct(t.v5usd).slice(1)} em 7 dias (em R$/t: ${fmtPct(t.v5)}).`,
        acao: querCompra ? "Bom ponto para cotar com o fornecedor. Se o índice de compra não estiver alto, compre em partes." : "Se tiver contrato a fechar, segure alguns dias.", novo: true });
      if (t.v5usd >= 4) itens.push({ id: `${k}|alta|${dia}`, tipo: "atencao", metal: k, forca: Math.round(55 + Math.min(30, t.v5usd * 3)),
        titulo: `Alta forte na bolsa · ${nome}`, texto: `Em US$/t, o metal subiu ${fmtPct(t.v5usd).slice(1)} em 7 dias (em R$/t: ${fmtPct(t.v5)}).`,
        acao: querVenda ? "Boa hora para vender o que está parado." : "Não corra para comprar no pico: compre só o necessário e espere acomodar.", novo: true });
      const tri = janela(a, 90).map(p => p.brl);
      const junta = (tipo, frase) => { const j = itens.find(x => x.metal === k && x.tipo === tipo); if (j) { j.texto = j.texto.replace(/\.$/, "") + "; " + frase + "."; return true; } };
      if (r.h.brl <= Math.min(...tri) * 1.0001 && !junta("compra", "é o menor preço em 3 meses")) itens.push({ id: `${k}|min90|${dia}`, tipo: querCompra ? "compra" : "atencao", metal: k, forca: 62,
        titulo: `Menor preço em 3 meses · ${nome}`, texto: "O preço em R$/t de hoje é o mais baixo dos últimos 90 dias.", acao: "Vale cotar hoje.", novo: true });
      if (r.h.brl >= Math.max(...tri) * 0.9999 && !junta("venda", "é o maior preço em 3 meses")) itens.push({ id: `${k}|max90|${dia}`, tipo: querVenda ? "venda" : "atencao", metal: k, forca: 62,
        titulo: `Maior preço em 3 meses · ${nome}`, texto: "O preço em R$/t de hoje é o mais alto dos últimos 90 dias.",
        acao: querVenda ? "Bom momento para vender." : "Evite compras grandes agora, se puder.", novo: true });
      if (t.ve30 != null && Math.abs(t.ve30) >= 12) itens.push({ id: `${k}|estoque|${dia}`, tipo: "atencao", metal: k, forca: 50,
        titulo: `Estoque da LME ${t.ve30 < 0 ? "caiu" : "subiu"} ${Math.abs(t.ve30).toFixed(0)}% em 30 dias · ${nome}`,
        texto: t.ve30 < 0 ? "Menos metal nos armazéns costuma sustentar o preço." : "Mais metal nos armazéns costuma pesar contra o preço.",
        acao: t.ve30 < 0 ? "Quem compra: não deixe para depois." : "Quem compra: pode negociar com calma.", novo: false });
    }
    const d = resumoDolar(), dd = d.h.data, ptax = "R$ " + virg(d.h.brl, 4);
    if (d.pctAno <= 20) itens.push({ id: `dolar|baixo|${dd}`, tipo: "dolar", forca: Math.round(80 - d.pctAno),
      titulo: "Dólar entre os mais baixos do ano", texto: `PTAX a ${ptax}, abaixo de ${100 - Math.round(d.pctAno)}% dos dias do último ano.`,
      acao: "Quem compra em dólar: bom momento para travar o câmbio com o banco.", novo: true });
    if (d.pctAno >= 80) itens.push({ id: `dolar|alto|${dd}`, tipo: "dolar", forca: Math.round(d.pctAno - 10),
      titulo: "Dólar entre os mais altos do ano", texto: `PTAX a ${ptax}, acima de ${Math.round(d.pctAno)}% dos dias do último ano.`,
      acao: "Quem recebe em dólar: bom momento para fechar câmbio. Quem compra: evite travar agora.", novo: true });
    if (Math.abs(d.v7) >= 2) itens.push({ id: `dolar|semana|${dd}`, tipo: "dolar", forca: Math.round(50 + Math.min(30, Math.abs(d.v7) * 5)),
      titulo: `Dólar ${d.v7 > 0 ? "subiu" : "caiu"} ${fmtPct(d.v7).slice(1)} na semana`, texto: "Isso mexe no preço em R$ de todos os metais na mesma proporção.",
      acao: d.v7 > 0 ? "Compras em dólar ficaram mais caras: reveja os pedidos em aberto." : "Compras em dólar ficaram mais baratas: bom momento para fechar pedidos.", novo: true });
    for (const al of meusPrecos || []) {
      if (!P.metais[al.metal]) continue;
      const u = ultimo(serie(al.metal)), ok = al.tipo === "abaixo" ? u.brl <= al.valor : u.brl >= al.valor;
      if (ok) itens.push({ id: `${al.metal}|meu|${al.tipo}|${al.valor}|${u.data}`, tipo: "meu", metal: al.metal, forca: 95,
        titulo: `Seu preço chegou · ${P.metais[al.metal].nome}`,
        texto: `${al.tipo === "abaixo" ? "Abaixo" : "Acima"} de ${reais(al.valor)}/t: hoje está em ${reais(u.brl)}/t.`,
        acao: al.tipo === "abaixo" ? "É o preço que você queria pagar. Feche a compra." : "É o preço que você queria receber. Feche a venda.", novo: true });
    }
    return itens.sort((x, y) => y.forca - x.forca);
  }

  window.Analise = { serie, serieDolar, resumo, resumoDolar, janela, diasAtras, quantil, media, mediaMovel, percentil, variacao, ultimo, dolarEm,
    indices, historico, evidencia, rotulo, radar, FAIXAS };
})();
