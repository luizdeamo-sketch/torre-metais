/* Torre de Controle - Metais: telas. */
(function () {
  const P = window.__PRECOS, A = window.Analise, C = window.CONFIG;
  const $ = s => document.querySelector(s);
  const ORDEM = ["aluminio", "cobre", "zinco", "niquel", "chumbo", "estanho", "minerio", "aco"].filter(k => P.metais[k]);
  const nf = (v, d = 0) => v == null ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const rs = (v, d = 0) => "R$ " + nf(v, d);
  const us = (v, d = 0) => "US$ " + nf(v, d);
  const pct = v => (v >= 0 ? "+" : "") + nf(v, 1) + "%";
  const cls = v => v > 0.05 ? "sobe" : v < -0.05 ? "desce" : "";
  const dataBR = iso => iso.split("-").reverse().join("/");
  const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
               set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const estado = { tela: "", metal: LS.get("tm_metal", "aluminio"), periodo: LS.get("tm_periodo", 365), moeda: LS.get("tm_moeda", "brl") };
  let graficos = [];

  const TELAS = [
    ["sobre", "📘", "Apresentação"], ["hoje", "📊", "Hoje"], ["metal", "📈", "Metal"], ["dolar", "💵", "Dólar"],
    ["simulador", "🧮", "Simulador"], ["alertas", "🔔", "Alertas"], ["sugestoes", "💬", "Sugestões"],
  ];

  function menu() {
    $("#menu").innerHTML = `<div class="marca">Torre de Controle - ${C.EMPRESA}<small>Mercado de metais</small></div>` +
      TELAS.map(([id, ic, nome]) => `<button data-tela="${id}">${ic} <span>${nome}</span>${id === "sugestoes" ? '<span class="cont" id="contRetorno" hidden></span>' : ""}</button>`).join("") +
      `<div class="rodape-menu">Preços de ${dataBR(A.ultimo(A.serie("aluminio")).data)}<br>Método Torre de Controle · Capacity Case</div>`;
    $("#menu").onclick = e => { const b = e.target.closest("button[data-tela]"); if (b) ir(b.dataset.tela); };
  }

  function ir(tela, extra) {
    if (extra) Object.assign(estado, extra);
    graficos.forEach(g => g.destroy()); graficos = [];
    estado.tela = tela; LS.set("tm_tela", tela); LS.set("tm_visitou", true);
    document.querySelectorAll("nav.menu button").forEach(b => b.classList.toggle("ativo", b.dataset.tela === tela));
    const m = $("#conteudo");
    ({ sobre: telaSobre, hoje: telaHoje, metal: telaMetal, dolar: telaDolar, simulador: telaSimulador, alertas: telaAlertas,
       sugestoes: () => window.Balao.telaSugestoes(m) })[tela](m);
    window.scrollTo(0, 0);
    window.Balao && window.Balao.evento("tela", { tela });
    window.Balao && window.Balao.retornoNaTela(tela);
  }

  // ---------- Apresentação ----------
  function telaSobre(m) {
    m.innerHTML = `
    <div class="sb-topo"><span class="etq">Torre de Controle - ${C.EMPRESA}</span>
      <h1>Saber, todo dia, se é hora de comprar ou de vender metal.</h1>
      <p>A torre lê as cotações da bolsa de metais de Londres (LME), do minério e do aço, junta com o dólar do Banco Central e mostra numa tela só, em reais por tonelada, se o preço está barato ou caro e para onde o mercado está empurrando.</p></div>
    <h2>Como a torre foi montada aqui</h2>
    <div class="grade">
      <div class="card"><div class="sb-num">Lê</div><h3>As bolsas e o Banco Central</h3><p class="mut">Alumínio, cobre, zinco, níquel, chumbo e estanho da LME (preço à vista, de 3 meses e estoque). Minério de ferro e aço da CME. Dólar PTAX do Banco Central.</p></div>
      <div class="card"><div class="sb-num">Junta</div><h3>Tudo em reais por tonelada</h3><p class="mut">Cada cotação em dólar vira R$/t com o dólar do mesmo dia. Assim dá para ver quanto da alta ou da queda veio do metal e quanto veio do câmbio.</p></div>
      <div class="card"><div class="sb-num">Cria</div><h3>O termômetro de compra e venda</h3><p class="mut">Compara o preço de hoje com o último ano e lê a pressão do mercado (tendência, estoque, preço imediato contra 3 meses). O resultado é uma frase simples: comprar, esperar, vender.</p></div>
    </div>
    <h2>O que a torre entrega</h2>
    <div class="grade">
      <div class="card"><h3>📊 Hoje</h3><p class="mut">Os 8 metais e o dólar numa tela. Variação do dia, da semana e do mês. Selo de compra e venda em cada um.</p></div>
      <div class="card"><h3>📈 Cada metal</h3><p class="mut">Gráfico de até 2 anos com a faixa normal do ano, a média de 3 meses e o estoque. Os motivos do termômetro, escritos.</p></div>
      <div class="card"><h3>🧮 Simulador</h3><p class="mut">Quanto custa a sua compra hoje (LME + prêmio, ou % da LME para sucata) contra a média de 3 meses e o melhor e o pior dia do ano.</p></div>
      <div class="card"><h3>🔔 Alertas</h3><p class="mut">Defina o preço que você quer pagar ou receber. A torre avisa quando o mercado chegar lá.</p></div>
    </div>
    <h2>Como funciona</h2>
    <div class="sb-fluxo">
      <div class="card"><b>1. Origem</b><span class="mut">LME (via Westmetall), CME e Banco Central. Lidos uma vez por dia útil, com 1 dia de atraso.</span></div>
      <div class="card"><b>2. Organiza</b><span class="mut">Converte tudo para R$/t e guarda 2 anos de história.</span></div>
      <div class="card"><b>3. Mostra</b><span class="mut">Painel no celular e no computador, com o mesmo endereço.</span></div>
      <div class="card"><b>4. Age</b><span class="mut">Você decide quando comprar, quanto comprar e quando travar preço com o fornecedor.</span></div>
    </div>
    <h2>O que estamos construindo primeiro</h2>
    <div class="card"><table>
      <tr><td>Painel Hoje, tela de cada metal, dólar, simulador e alertas</td><td><span class="selo bom">tela pronta</span></td></tr>
      <tr><td>Preço local de cada cliente (prêmio Brasil, sucata) lançado uma vez e usado em todas as contas</td><td><span class="selo medio">em construção</span></td></tr>
      <tr><td>Login por empresa e Sugestões guardadas no banco do cliente</td><td><span class="selo medio">em construção</span></td></tr>
      <tr><td>Aviso no celular quando um alerta disparar</td><td><span class="selo medio">em construção</span></td></tr>
    </table></div>
    <h2>Como a gente usa</h2>
    <div class="grade">
      <div class="card"><h3>Todo dia</h3><p class="mut">O comprador abre o Hoje de manhã e confere os selos dos metais que compra.</p></div>
      <div class="card"><h3>Toda semana</h3><p class="mut">A reunião de compras usa o termômetro e o simulador para decidir volume e prazo.</p></div>
      <div class="card"><h3>No caminho</h3><p class="mut">A Capacity Case acompanha o uso, ouve o balão 💬 e ajusta a torre.</p></div>
    </div>
    <h2>Princípios</h2>
    <div class="grade">
      <div class="card"><h3>Não é bala de prata</h3><p class="mut">Quem compra já conhece o mercado. A torre faz essa leitura mais rápida, todo dia, com número. O termômetro é um indicador, não uma garantia de preço futuro.</p></div>
      <div class="card"><h3>Um dado, uma fonte</h3><p class="mut">Cotação vem da bolsa, dólar vem do Banco Central. O que é só seu (prêmio, frete) é lançado uma vez, aqui.</p></div>
      <div class="card"><h3>Poucos números que importam</h3><p class="mut">Preço em R$/t, onde ele está no ano e o selo. O resto fica um clique abaixo.</p></div>
      <div class="card"><h3>Cada um vê o que precisa</h3><p class="mut">Acesso por pessoa e perfil.</p></div>
      <div class="card"><h3>Os dados ficam na empresa</h3><p class="mut">O que a sua empresa lança fica no banco da sua empresa. Ninguém fica refém de ninguém.</p></div>
    </div>
    <h2>Quem acessa</h2>
    <div class="grade">
      <div class="card"><h3>Gestor</h3><p class="mut">Dono ou diretor de compras. Vê tudo, define alertas da empresa e lê todas as sugestões.</p></div>
      <div class="card"><h3>Comprador</h3><p class="mut">Usa o painel, o simulador e os alertas no dia a dia. Entra por convite do gestor.</p></div>
    </div>
    <div class="card sb-metodo" style="margin-top:22px"><b>Sobre o método.</b> A Torre de Controle é o método da Capacity Case, de Luiz Amo: juntar, ler e criar os sistemas da empresa numa torre só, para o dono decidir com número, não com sensação. <a href="https://capacitycase.com.br" target="_blank" rel="noopener">capacitycase.com.br</a></div>
    <p style="margin-top:16px"><button class="btn pri" onclick="Balao.abrir({via:'apresentacao'})">💬 Dar uma sugestão</button> <button class="btn" onclick="TM.ir('hoje')">Ir para o painel Hoje →</button></p>
    <div class="rodape"><span>Uso interno e confidencial. Dados tratados conforme a LGPD. Cotações públicas com 1 dia de atraso; não é recomendação de investimento.</span><span>Método Torre de Controle · Capacity Case</span></div>`;
  }

  // ---------- Hoje ----------
  function faixaDolar() {
    const d = A.resumoDolar();
    return `<div class="faixa-dolar"><div><div class="mut peq">Dólar PTAX (Banco Central) · ${dataBR(d.h.data)}</div><div class="big">${rs(d.h.brl, 4)}</div></div>
      <div><div class="mut peq">Dia</div><span class="var ${cls(d.v1)}">${pct(d.v1)}</span></div>
      <div><div class="mut peq">30 dias</div><span class="var ${cls(d.v30)}">${pct(d.v30)}</span></div>
      <div><div class="mut peq">12 meses</div><span class="var ${cls(d.v365)}">${pct(d.v365)}</span></div>
      <div style="flex:1;min-width:200px"><div class="mut peq">Onde o dólar está no ano (mín. ${rs(d.min, 2)} · máx. ${rs(d.max, 2)})</div><div class="termo"><i style="left:calc(${d.pctAno.toFixed(0)}% - 2px)"></i></div></div></div>`;
  }

  function telaHoje(m) {
    const alertas = alertasDisparados();
    m.innerHTML = `<h1>Hoje no mercado de metais</h1>
      <p class="sub">Preços de fechamento de ${dataBR(A.ultimo(A.serie("aluminio")).data)} em R$ por tonelada. Selo verde: bom momento para comprar. Toque no metal para ver os motivos.</p>
      ${alertas.length ? `<div class="aviso">🔔 ${alertas.map(a => a.txt).join("<br>")}</div>` : ""}
      ${P.falhas && P.falhas.length ? `<div class="aviso">Algumas cotações não foram lidas hoje: ${P.falhas.join("; ")}</div>` : ""}
      ${faixaDolar()}
      <div class="grade">${ORDEM.map(k => cardMetal(A.resumo(k))).join("")}</div>
      <p class="mut peq" style="margin-top:14px">Fontes: ${P.fontes}. Coletado em ${P.coletadoEm.replace("T", " ")}.</p>`;
    m.querySelectorAll("[data-metal]").forEach(el => el.onclick = () => ir("metal", { metal: el.dataset.metal }));
    ORDEM.forEach(k => sparkline(m.querySelector(`canvas[data-spark="${k}"]`), A.janela(A.serie(k), 90).map(p => p.brl)));
  }

  function cardMetal(r) {
    const t = r.termo;
    return `<div class="card clicavel" data-metal="${r.chave}">
      <div class="linha" style="justify-content:space-between"><h3>${r.nome}</h3><span class="selo ${t.compra.cor}">${t.compra.titulo}</span></div>
      <div class="mut peq">${r.bolsa}</div>
      <div class="preco">${rs(r.h.brl)}<span class="mut peq" style="font-weight:400"> /t</span></div>
      <div class="mut peq">${us(r.h.usd)} /t</div>
      <div class="linha peq" style="margin-top:6px"><span>Dia <b class="var ${cls(r.v1)}">${pct(r.v1)}</b></span><span>7d <b class="var ${cls(r.v7)}">${pct(r.v7)}</b></span><span>30d <b class="var ${cls(r.v30)}">${pct(r.v30)}</b></span></div>
      <div class="termo" title="Onde o preço em R$ está no último ano"><i style="left:calc(${t.pctAno.toFixed(0)}% - 2px)"></i></div>
      <div class="linha peq mut" style="justify-content:space-between"><span>barato no ano</span><span>caro no ano</span></div>
      <canvas class="spark" data-spark="${r.chave}"></canvas></div>`;
  }

  function sparkline(cv, v) {
    if (!cv || !v.length) return;
    const w = cv.clientWidth * devicePixelRatio, h = cv.clientHeight * devicePixelRatio; cv.width = w; cv.height = h;
    const g = cv.getContext("2d"), mn = Math.min(...v), mx = Math.max(...v);
    g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--pri"); g.lineWidth = 2 * devicePixelRatio; g.beginPath();
    v.forEach((y, i) => { const X = i / (v.length - 1) * w, Y = h - (y - mn) / ((mx - mn) || 1) * (h - 4) - 2; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    g.stroke();
  }

  // ---------- Metal ----------
  function cor(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  function telaMetal(m) {
    const k = estado.metal, r = A.resumo(k), t = r.termo, a = A.serie(k), d = r.dec;
    const campo = estado.moeda;
    const fmt = campo === "brl" ? rs : us;
    const ano = A.janela(a, 365).map(p => p[campo]);
    const p25 = A.quantil(ano, .25), p75 = A.quantil(ano, .75);
    const tm = P.metais[k];
    m.innerHTML = `<h1>${r.nome}</h1><p class="sub">${tm.bolsa} · fechamento de ${dataBR(r.h.data)}</p>
      <div class="ctrl"><select id="selMetal" class="btn">${ORDEM.map(x => `<option value="${x}" ${x === k ? "selected" : ""}>${P.metais[x].nome}</option>`).join("")}</select>
        ${[[90, "3 meses"], [180, "6 meses"], [365, "1 ano"], [730, "2 anos"]].map(([n, l]) => `<button data-per="${n}" class="${estado.periodo == n ? "ativo" : ""}">${l}</button>`).join("")}
        <button data-moeda="brl" class="${campo === "brl" ? "ativo" : ""}">R$/t</button><button data-moeda="usd" class="${campo === "usd" ? "ativo" : ""}">US$/t</button></div>
      <div class="grade g2">
        <div class="card"><div class="mut peq">Para quem compra</div><div class="linha" style="margin:6px 0"><span class="selo ${t.compra.cor}" style="font-size:14px">${t.compra.titulo}</span></div><div>${t.compra.porque}</div>
          <div class="mut peq" style="margin-top:8px">Para quem vende: <span class="selo ${t.venda.cor}">${t.venda.titulo}</span></div>
          <div class="termo"><i style="left:calc(${t.pctAno.toFixed(0)}% - 2px)"></i></div>
          <div class="peq mut">Hoje o preço em R$ está acima de ${nf(t.pctAno)}% dos dias do último ano.</div></div>
        <div class="card"><div class="mut peq">Preço hoje</div><div class="big">${rs(r.h.brl)} <span class="peq mut">/t</span></div><div class="mut">${us(r.h.usd)} /t · dólar ${rs(r.h.dolar, 4)}</div>
          <table class="peq" style="margin-top:8px"><tr><th></th><th>Dia</th><th>7 dias</th><th>30 dias</th><th>12 meses</th></tr>
          <tr><td>R$/t</td><td class="var ${cls(r.v1)}">${pct(r.v1)}</td><td class="var ${cls(r.v7)}">${pct(r.v7)}</td><td class="var ${cls(r.v30)}">${pct(r.v30)}</td><td class="var ${cls(r.v365)}">${pct(r.v365)}</td></tr></table></div>
        <div class="card"><div class="mut peq">De onde veio a variação de 30 dias em R$</div><div class="big ${cls(d.total)}">${d.total >= 0 ? "+" : "−"}${rs(Math.abs(d.total))}<span class="peq mut"> /t (${pct(d.pct)})</span></div>
          <div class="sinais"><li>🪨 Metal na bolsa (em US$): <b class="${cls(d.efeitoMetal)}">${d.efeitoMetal >= 0 ? "+" : "−"}${rs(Math.abs(d.efeitoMetal))}</b></li>
          <li>💵 Dólar (de ${rs(d.antes.dolar, 2)} para ${rs(r.h.dolar, 2)}): <b class="${cls(d.efeitoDolar)}">${d.efeitoDolar >= 0 ? "+" : "−"}${rs(Math.abs(d.efeitoDolar))}</b></li></div></div>
        <div class="card"><div class="mut peq">Por que o termômetro diz isso</div><ul class="sinais">${t.sinais.map(s => `<li>${s.t === "alta" ? "⬆️" : s.t === "baixa" ? "⬇️" : "➖"} <span>${s.txt}</span></li>`).join("")}
          <li>📏 Faixa normal do ano (metade dos dias): ${fmt(p25)} a ${fmt(p75)} /t.</li></ul></div>
      </div>
      <div class="card" style="margin-top:14px"><h3>Preço em ${campo === "brl" ? "R$" : "US$"} por tonelada</h3><div class="graf"><canvas id="gPreco"></canvas></div></div>
      ${tm.tem3m ? `<div class="card" style="margin-top:14px"><h3>Estoque nos armazéns da LME (t)</h3><p class="mut peq">Estoque caindo costuma sustentar o preço; subindo, pesa contra.</p><div class="graf baixo"><canvas id="gEst"></canvas></div></div>` : ""}`;
    $("#selMetal").onchange = e => { LS.set("tm_metal", e.target.value); ir("metal", { metal: e.target.value }); };
    m.querySelectorAll("[data-per]").forEach(b => b.onclick = () => { LS.set("tm_periodo", +b.dataset.per); ir("metal", { periodo: +b.dataset.per }); });
    m.querySelectorAll("[data-moeda]").forEach(b => b.onclick = () => { LS.set("tm_moeda", b.dataset.moeda); ir("metal", { moeda: b.dataset.moeda }); });

    const mm = A.mediaMovel(a, 60, campo);
    const ini = a.length - A.janela(a, estado.periodo).length;
    const pts = a.slice(ini), mmv = mm.slice(ini);
    const lab = pts.map(p => dataBR(p.data));
    graficos.push(new Chart($("#gPreco"), {
      type: "line",
      data: { labels: lab, datasets: [
        { label: "Preço", data: pts.map(p => p[campo]), borderColor: cor("--pri"), borderWidth: 2, pointRadius: 0, tension: .15 },
        { label: "Média de 3 meses", data: mmv, borderColor: cor("--mut"), borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0 },
        { label: "Faixa normal do ano (topo)", data: pts.map(() => p75), borderColor: "transparent", pointRadius: 0, fill: "+1", backgroundColor: cor("--pri2") },
        { label: "Faixa normal do ano (base)", data: pts.map(() => p25), borderColor: "transparent", pointRadius: 0 },
      ] },
      options: opcoesGrafico(fmt),
    }));
    if (tm.tem3m) graficos.push(new Chart($("#gEst"), {
      type: "line", data: { labels: lab, datasets: [{ label: "Estoque LME", data: pts.map(p => p.estoque), borderColor: cor("--medio"), borderWidth: 2, pointRadius: 0 }] },
      options: opcoesGrafico(v => nf(v) + " t"),
    }));
  }

  function opcoesGrafico(fmt) {
    return { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: cor("--mut"), filter: i => !i.text.includes("(base)"), boxWidth: 12 } },
        tooltip: { callbacks: { label: c => c.dataset.label.includes("Faixa") ? null : `${c.dataset.label}: ${fmt(c.parsed.y)}` } } },
      scales: { x: { ticks: { color: cor("--mut"), maxTicksLimit: 8 }, grid: { display: false } },
        y: { ticks: { color: cor("--mut"), callback: v => nf(v) }, grid: { color: cor("--lin") } } } };
  }

  // ---------- Dólar ----------
  function telaDolar(m) {
    const d = A.resumoDolar(), a = A.janela(d.serie, estado.periodo);
    m.innerHTML = `<h1>Dólar</h1><p class="sub">PTAX de venda do Banco Central. É o dólar usado para converter todas as cotações em R$.</p>
      ${faixaDolar()}
      <div class="ctrl">${[[90, "3 meses"], [180, "6 meses"], [365, "1 ano"], [730, "2 anos"]].map(([n, l]) => `<button data-per="${n}" class="${estado.periodo == n ? "ativo" : ""}">${l}</button>`).join("")}</div>
      <div class="card"><div class="graf"><canvas id="gDol"></canvas></div></div>
      <h2>Quanto o dólar mexeu em cada metal nos últimos 30 dias</h2>
      <div class="card"><table><tr><th>Metal</th><th class="n">Variação em R$/t</th><th class="n">Por causa do metal</th><th class="n">Por causa do dólar</th></tr>
      ${ORDEM.map(k => { const r = A.resumo(k), x = r.dec; return `<tr><td>${r.nome}</td><td class="n ${cls(x.total)}">${rs(x.total)}</td><td class="n ${cls(x.efeitoMetal)}">${rs(x.efeitoMetal)}</td><td class="n ${cls(x.efeitoDolar)}">${rs(x.efeitoDolar)}</td></tr>`; }).join("")}
      </table><p class="mut peq">Dólar subindo encarece a compra em R$ mesmo com o metal parado na bolsa. Quem compra em R$ e tem prazo pode travar o câmbio com o banco.</p></div>`;
    m.querySelectorAll("[data-per]").forEach(b => b.onclick = () => { LS.set("tm_periodo", +b.dataset.per); ir("dolar", { periodo: +b.dataset.per }); });
    graficos.push(new Chart($("#gDol"), { type: "line",
      data: { labels: a.map(p => dataBR(p.data)), datasets: [{ label: "Dólar PTAX", data: a.map(p => p.brl), borderColor: cor("--pri"), borderWidth: 2, pointRadius: 0 }] },
      options: opcoesGrafico(v => rs(v, 4)) }));
  }

  // ---------- Simulador ----------
  function telaSimulador(m) {
    const s = LS.get("tm_sim", { metal: "aluminio", ton: 25, forma: "premio", premio: 350, pct: 80 });
    m.innerHTML = `<h1>Simulador de compra</h1><p class="sub">Quanto custa a sua compra hoje e como ela se compara com outros momentos do ano.</p>
      <div class="card"><div class="form">
        <label class="campo">Metal<select id="sMetal">${ORDEM.map(x => `<option value="${x}" ${x === s.metal ? "selected" : ""}>${P.metais[x].nome}</option>`).join("")}</select></label>
        <label class="campo">Toneladas<input id="sTon" type="number" min="0" step="0.5" value="${s.ton}"></label>
        <label class="campo">Como o seu preço é formado<select id="sForma"><option value="premio" ${s.forma === "premio" ? "selected" : ""}>Bolsa + prêmio (US$/t)</option><option value="pct" ${s.forma === "pct" ? "selected" : ""}>% da bolsa (sucata)</option></select></label>
        <label class="campo" id="lPremio">Prêmio (US$/t)<input id="sPremio" type="number" step="10" value="${s.premio}"></label>
        <label class="campo" id="lPct">% da bolsa<input id="sPct" type="number" step="1" value="${s.pct}"></label>
      </div></div><div id="sRes"></div>`;
    const calc = () => {
      const v = { metal: $("#sMetal").value, ton: +$("#sTon").value || 0, forma: $("#sForma").value, premio: +$("#sPremio").value || 0, pct: +$("#sPct").value || 0 };
      LS.set("tm_sim", v);
      $("#lPremio").style.display = v.forma === "premio" ? "" : "none"; $("#lPct").style.display = v.forma === "pct" ? "" : "none";
      const a = A.serie(v.metal);
      const custo = p => (v.forma === "premio" ? (p.usd + v.premio) : p.usd * v.pct / 100) * p.dolar * v.ton;
      const h = A.ultimo(a), ano = A.janela(a, 365), tri = A.janela(a, 90);
      const hoje = custo(h), m90 = A.media(tri.map(custo));
      const cs = ano.map(p => ({ p, c: custo(p) })).sort((x, y) => x.c - y.c), melhor = cs[0], pior = cs[cs.length - 1];
      const dol5 = hoje * 1.05;
      const dif = hoje - m90;
      $("#sRes").innerHTML = `<div class="grade" style="margin-top:14px">
        <div class="card"><div class="mut peq">Custo da compra hoje</div><div class="big">${rs(hoje)}</div><div class="mut peq">${rs(v.ton ? hoje / v.ton : 0)} por tonelada · dólar ${rs(h.dolar, 4)}</div></div>
        <div class="card"><div class="mut peq">Contra a média dos últimos 3 meses</div><div class="big ${cls(dif)}">${dif >= 0 ? "+" : "−"}${rs(Math.abs(dif))}</div><div class="mut peq">${dif >= 0 ? "Hoje está mais caro que a média." : "Hoje está mais barato que a média."}</div></div>
        <div class="card"><div class="mut peq">Melhor e pior dia do último ano</div><div>🟢 ${dataBR(melhor.p.data)}: <b>${rs(melhor.c)}</b></div><div>🔴 ${dataBR(pior.p.data)}: <b>${rs(pior.c)}</b></div></div>
        <div class="card"><div class="mut peq">Se o dólar subir 5% antes de fechar</div><div class="big sobe">${rs(dol5)}</div><div class="mut peq">+${rs(dol5 - hoje)} na mesma compra.</div></div></div>
        <p class="mut peq">O cálculo usa o fechamento da bolsa e o dólar PTAX de cada dia. Frete, impostos e condições de pagamento ficam de fora.</p>`;
    };
    m.querySelectorAll("input,select").forEach(el => el.oninput = calc); calc();
  }

  // ---------- Alertas (guardados neste aparelho) ----------
  function alertasDisparados() {
    return LS.get("tm_alertas", []).map(al => {
      const r = A.ultimo(A.serie(al.metal)), v = r.brl;
      const ok = al.tipo === "abaixo" ? v <= al.valor : v >= al.valor;
      return ok ? { txt: `${P.metais[al.metal].nome} ${al.tipo === "abaixo" ? "chegou abaixo de" : "passou de"} ${rs(al.valor)}/t: hoje ${rs(v)}/t.` } : null;
    }).filter(Boolean);
  }
  function telaAlertas(m) {
    const lista = LS.get("tm_alertas", []);
    m.innerHTML = `<h1>Alertas de preço</h1><p class="sub">Diga o preço em R$/t que você quer pagar (ou receber). Quando a cotação chegar lá, o aviso aparece no topo do painel Hoje. Por enquanto, os alertas ficam guardados neste aparelho.</p>
      <div class="card"><div class="form">
        <label class="campo">Metal<select id="aMetal">${ORDEM.map(x => `<option value="${x}">${P.metais[x].nome}</option>`).join("")}</select></label>
        <label class="campo">Avisar quando<select id="aTipo"><option value="abaixo">ficar abaixo de (para comprar)</option><option value="acima">passar de (para vender)</option></select></label>
        <label class="campo">Preço (R$/t)<input id="aValor" type="number" step="100"></label>
        <label class="campo">&nbsp;<button class="btn pri" id="aAdd">Criar alerta</button></label></div></div>
      <div class="card" style="margin-top:14px"><table><tr><th>Metal</th><th>Regra</th><th class="n">Hoje</th><th></th></tr>
      ${lista.map((al, i) => { const v = A.ultimo(A.serie(al.metal)).brl; return `<tr><td>${P.metais[al.metal].nome}</td><td>${al.tipo === "abaixo" ? "abaixo de" : "acima de"} ${rs(al.valor)}</td><td class="n">${rs(v)}</td><td><button class="btn" data-del="${i}">Apagar</button></td></tr>`; }).join("") || '<tr><td colspan="4" class="mut">Nenhum alerta ainda.</td></tr>'}
      </table></div>`;
    const sugere = () => { $("#aValor").value = Math.round(A.ultimo(A.serie($("#aMetal").value)).brl * ($("#aTipo").value === "abaixo" ? .95 : 1.05) / 100) * 100; };
    $("#aMetal").onchange = sugere; $("#aTipo").onchange = sugere; sugere();
    $("#aAdd").onclick = () => {
      const valor = +$("#aValor").value;
      if (!valor) { window.Balao.recusa("Preencha o preço do alerta."); return; }
      lista.push({ metal: $("#aMetal").value, tipo: $("#aTipo").value, valor }); LS.set("tm_alertas", lista); ir("alertas");
    };
    m.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { lista.splice(+b.dataset.del, 1); LS.set("tm_alertas", lista); window.Balao.desfez(); ir("alertas"); });
  }

  window.TM = { ir, get tela() { return estado.tela; } };
  menu();
  ir(LS.get("tm_visitou", false) ? (LS.get("tm_tela", "hoje") === "sugestoes" ? "hoje" : LS.get("tm_tela", "hoje")) : "sobre");
})();
