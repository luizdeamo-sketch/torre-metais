/* Torre de Controle - Metais: telas.
   Padrão visual em marca/index.html. Os cálculos (termômetro, risco, lotes, câmbio, preço-alvo, avisos) estão em js/analise.js;
   a memória de 15 anos da LME está em js/memoria.js (gerada por coletor/memoria.js).
   Regras: o termômetro mostra onde o preço está, não para onde vai; as frases sugerem, nunca mandam.
   Estrutura (29/10/2026): 5 telas. Hoje = quadro de cotações + avisos + meus alvos. Metais = detalhe (o dólar é um item dela).
   Minha compra = simulador. Radar e Dólar viraram parte dessas telas. */
(function () {
  const P = window.__PRECOS, A = window.Analise, C = window.CONFIG, MEM = window.TM_MEMORIA;
  const $ = s => document.querySelector(s);
  const ORDEM = ["aluminio", "cobre", "zinco", "niquel", "chumbo", "estanho", "minerio", "aco"].filter(k => P.metais[k]);
  const nf = (v, d = 0) => v == null || isNaN(v) ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const rs = (v, d = 0) => "R$ " + nf(v, d);
  const us = (v, d = 0) => "US$ " + nf(v, d);
  const pct = v => Math.abs(v) < 0.05 ? "0,0%" : (v > 0 ? "+" : "−") + nf(Math.abs(v), 1) + "%";
  const sinal = v => (v >= 0 ? "+" : "−");
  const cls = v => v > 0.05 ? "sobe" : v < -0.05 ? "desce" : "";
  const dataBR = iso => iso.split("-").reverse().join("/");
  const dataCurta = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(2, 4);
  const nomeCurto = k => k === "dolar" ? "Dólar" : P.metais[k].nome.replace(" bobina a quente (EUA)", " (bobina)").replace(" 62%", "");
  const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
               set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const estado = { tela: "", metal: LS.get("tm_metal", "aluminio"), periodo: LS.get("tm_periodo", 365), moeda: LS.get("tm_moeda", "brl"), todosAvisos: false };
  const perfil = () => LS.get("tm_perfil", { papel: "ambos", metais: [], feito: false });
  const meusPrecos = () => LS.get("tm_alertas", []);
  const avisosHoje = () => A.radar(perfil(), meusPrecos());
  const dataPrecos = A.ultimo(A.serie("aluminio")).data;
  const fonteRisco = k => MEM && MEM.risco && MEM.risco[k] ? `desde ${MEM.desde}` : "dos últimos 3 anos";
  const chanceTxt = v => v >= 70 ? "alta" : v >= 40 ? "média" : v >= 15 ? "baixa" : "muito baixa";
  let graficos = [];

  const IC = {
    sobre: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h6"/>',
    hoje: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    metal: '<path d="M3 20h18"/><path d="M5 16l4-5 4 3 6-8"/>',
    simulador: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8v4H8z"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    sugestoes: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.1A8.5 8.5 0 1 1 21 12z"/>',
  };
  const icone = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[id]}</svg>`;
  const marca = () => `<div class="marca"><img src="icone.svg" alt=""><div class="marca-txt"><small>Torre de Controle</small><b>${C.EMPRESA}<i></i></b></div></div>`;

  // [id, nome, nome curto na barra do celular]
  const TELAS = [["sobre", "Apresentação", "Sobre"], ["hoje", "Hoje", "Hoje"], ["metal", "Metais", "Metais"], ["simulador", "Minha compra", "Compra"], ["sugestoes", "Sugestões", "Sugestões"]];

  function menu() {
    $("#menu").innerHTML = marca() +
      TELAS.map(([id, nome, curto]) => `<button data-tela="${id}" title="${nome}">${icone(id)}<span class="nm">${nome}</span><span class="nc">${curto}</span>${id === "sugestoes" ? '<span class="cont" id="contRetorno" hidden></span>' : ""}</button>`).join("") +
      `<div class="rodape-menu">Fechamento de ${dataBR(dataPrecos)}<br>Método Torre de Controle · Capacity Case</div>`;
    $("#menu").onclick = e => { const b = e.target.closest("button[data-tela]"); if (b) ir(b.dataset.tela); };
    $("#topoMovel").innerHTML = marca() + `<div class="data">Fechamento<b>${dataBR(dataPrecos)}</b></div>`;
  }

  function ir(tela, extra) {
    if (tela === "alertas" || tela === "radar") tela = "hoje";       // Radar virou a área de avisos do Hoje
    if (tela === "dolar") { tela = "metal"; extra = { ...(extra || {}), metal: "dolar" }; } // o dólar é um item de Metais
    if (extra) Object.assign(estado, extra);
    if (estado.metal !== "dolar" && !P.metais[estado.metal]) estado.metal = "aluminio";
    graficos.forEach(g => g.destroy()); graficos = [];
    estado.tela = tela; LS.set("tm_tela", tela); LS.set("tm_visitou", true);
    document.querySelectorAll("nav.menu button").forEach(b => b.classList.toggle("ativo", b.dataset.tela === tela));
    const m = $("#conteudo");
    ({ sobre: telaSobre, hoje: telaHoje, metal: telaMetal, simulador: telaSimulador, sugestoes: () => window.Balao.telaSugestoes(m) })[tela](m);
    window.scrollTo(0, 0);
    window.Balao && window.Balao.evento("tela", { tela });
    window.Balao && window.Balao.retornoNaTela(tela);
  }
  const abreMetal = k => { LS.set("tm_metal", k); ir("metal", { metal: k }); };

  // ---------- pedaços reutilizados ----------
  const corTermo = p => p < 35 ? "compra" : p >= 65 ? "venda" : "neutro";
  // Mini termômetro para tabelas e listas: barra 0-100 com marcador e o número.
  const miniTermo = p => `<span class="mt ${corTermo(p)}"><span class="mt-barra"><i style="left:${Math.max(3, Math.min(97, p))}%"></i></span><b class="num">${p}</b></span>`;
  function barraAno(p, rotEsq = "mais barato do ano", rotDir = "mais caro do ano") {
    return `<div class="ano"><i style="left:${Math.max(2, Math.min(98, p)).toFixed(0)}%"></i></div>
      <div class="linha entre mini mut"><span>${rotEsq}</span><span>${rotDir}</span></div>`;
  }
  function leituraTermo(nivel, papel) {
    return papel === "compra" ? nivel.compra : papel === "venda" ? nivel.venda : nivel.chave === "m" ? "Neutro para comprar e vender" : `${nivel.compra} · ${nivel.venda.toLowerCase()}`;
  }
  const kpi = (rot, valor, sub, extra = "") => `<div class="kpi"><div class="sobrelinha">${rot}</div><div class="kv num">${valor}</div>${sub ? `<div class="mut peq">${sub}</div>` : ""}${extra}</div>`;
  function textoHistoria(k, t) {
    const ev = MEM && MEM.termo && MEM.termo[k], n = t.nivel.chave;
    if (!ev || !ev.every(p => p.faixas[n] && p.faixas[n].n >= 40))
      return "Para este item não há história longa gratuita. Use o termômetro como referência de preço, não como previsão.";
    const [a, b] = ev;
    return `Com o termômetro nesta faixa, o preço em R$ estava mais alto 30 dias depois em <b>${nf(a.faixas[n].subiu)}%</b> dos dias de ${a.de} a ${a.ate} e em <b>${nf(b.faixas[n].subiu)}%</b> de ${b.de} para cá (em qualquer dia: ${nf(a.base)}% e ${nf(b.base)}%). Até 2019, comprar barato no ano dava vantagem; depois, não. O termômetro diz onde o preço está, não para onde vai.`;
  }
  // Gráfico dentro de <details>: só desenha quando abre (fechado, o canvas não tem tamanho).
  function graficoAoAbrir(det, cria) { det.addEventListener("toggle", () => { if (det.open && !det.dataset.ok) { det.dataset.ok = 1; graficos.push(cria()); } }); }

  // ---------- Apresentação ----------
  function telaSobre(m) {
    m.innerHTML = `
    <div class="sb-topo"><span class="etq"><img src="icone.svg" alt="">Torre de Controle - ${C.EMPRESA}</span>
      <h1>Comprar e vender metal com número, todo dia.</h1>
      <p>LME, minério, aço e dólar numa tela só, em reais por tonelada. A torre mostra onde o preço está no ano, quanto ele costuma mexer, quanto do custo vem do dólar e avisa quando o preço que você quer chega.</p></div>
    <h2>Como a torre foi montada aqui</h2>
    <div class="grade">
      <div class="card"><div class="sb-num">Lê</div><h3>As bolsas e o Banco Central</h3><p class="mut">Alumínio, cobre, zinco, níquel, chumbo e estanho da LME (à vista, 3 meses e estoque). Minério de ferro e aço da CME. Dólar PTAX do Banco Central.</p></div>
      <div class="card"><div class="sb-num">Junta</div><h3>Tudo em reais por tonelada</h3><p class="mut">Cada cotação vira R$/t com o dólar do mesmo dia, para separar o que veio do metal e o que veio do câmbio.</p></div>
      <div class="card"><div class="sb-num">Cria</div><h3>Termômetro, risco e avisos</h3><p class="mut">Termômetro do ano, faixa provável em 30 dias, plano em lotes, peso do dólar e preço-alvo com chance de chegar, a partir de 15 anos de LME.</p></div>
    </div>
    <h2>O que a torre entrega</h2>
    <div class="grade g4">
      <div class="card"><h3>Hoje</h3><p class="mut">O quadro de cotações com o termômetro, os avisos do dia e os seus preços-alvo.</p></div>
      <div class="card"><h3>Metais</h3><p class="mut">Cada metal e o dólar em detalhe: gráfico, risco de 30 dias, lotes, câmbio e preço-alvo.</p></div>
      <div class="card"><h3>Minha compra</h3><p class="mut">Quanto custa a sua compra hoje, quanto pode variar e o plano em 4 lotes semanais.</p></div>
      <div class="card"><h3>Avisos</h3><p class="mut">Preço no alto ou no fundo do ano, movimento forte, dólar e o seu preço-alvo chegando. Também no celular.</p></div>
    </div>
    <h2>Como funciona</h2>
    <div class="grade g4">
      <div class="card"><div class="sb-num">1 · Origem</div><span class="mut">LME (via Westmetall), CME e Banco Central, lidos às 7h e às 15h dos dias úteis, com 1 dia de atraso.</span></div>
      <div class="card"><div class="sb-num">2 · Organiza</div><span class="mut">Tudo em R$/t: quase 3 anos no painel e 15 anos na memória da LME.</span></div>
      <div class="card"><div class="sb-num">3 · Mostra</div><span class="mut">Celular e computador, no mesmo endereço. No celular, dá para instalar como aplicativo.</span></div>
      <div class="card"><div class="sb-num">4 · Age</div><span class="mut">A torre avisa e sugere. Você decide quando comprar, quanto e se trava preço ou câmbio.</span></div>
    </div>
    <h2>O que estamos construindo primeiro</h2>
    <div class="card rolar"><table>
      <tr><td>Quadro de cotações, termômetro, risco de 30 dias, lotes, câmbio e preço-alvo</td><td><span class="selo compra">tela pronta</span></td></tr>
      <tr><td>Avisos neste aparelho (com a torre aberta ou em segundo plano)</td><td><span class="selo compra">tela pronta</span></td></tr>
      <tr><td>Aviso no celular mesmo com o aplicativo fechado</td><td><span class="selo aten">em construção</span></td></tr>
      <tr><td>Preço local de cada cliente (prêmio Brasil, sucata) lançado uma vez</td><td><span class="selo aten">em construção</span></td></tr>
      <tr><td>Login por empresa e Sugestões no banco do cliente</td><td><span class="selo aten">em construção</span></td></tr>
    </table></div>
    <h2>Como a gente usa</h2>
    <div class="grade">
      <div class="card"><h3>Todo dia</h3><p class="mut">O comprador abre o Hoje, olha o quadro e os avisos dos metais que compra.</p></div>
      <div class="card"><h3>Toda semana</h3><p class="mut">A reunião de compras usa Minha compra para decidir volume, lotes e câmbio.</p></div>
      <div class="card"><h3>No caminho</h3><p class="mut">A Capacity Case acompanha o uso, ouve o balão 💬 e ajusta a torre.</p></div>
    </div>
    <h2>Princípios</h2>
    <div class="grade">
      <div class="card"><h3>Não é bala de prata</h3><p class="mut">Ninguém acerta o preço de amanhã. Em 15 anos de LME, "comprar quando está barato" funcionou até 2019 e deixou de funcionar depois. A torre mostra onde o preço está e ajuda a reduzir o risco.</p></div>
      <div class="card"><h3>Um dado, uma fonte</h3><p class="mut">Cotação vem da bolsa, dólar do Banco Central. O que é só seu (prêmio, frete) é lançado uma vez.</p></div>
      <div class="card"><h3>Poucos números que importam</h3><p class="mut">Preço em R$/t, termômetro e risco de 30 dias. O resto fica um toque abaixo.</p></div>
      <div class="card"><h3>Cada um vê o que precisa</h3><p class="mut">Cada pessoa escolhe se compra, vende ou os dois, e quais metais acompanha.</p></div>
      <div class="card"><h3>Os dados ficam na empresa</h3><p class="mut">O que a sua empresa lança fica no banco da sua empresa. Ninguém fica refém de ninguém.</p></div>
    </div>
    <h2>Quem acessa</h2>
    <div class="grade">
      <div class="card"><h3>Gestor</h3><p class="mut">Dono ou diretor de compras. Vê tudo, define os preços-alvo da empresa e lê todas as sugestões.</p></div>
      <div class="card"><h3>Comprador ou vendedor</h3><p class="mut">Usa o Hoje, Metais e Minha compra no dia a dia. Entra por convite do gestor.</p></div>
    </div>
    <div class="card sb-metodo" style="margin-top:24px"><b>Sobre o método.</b> A Torre de Controle é o método da Capacity Case, de Luiz Amo: juntar, ler e criar os sistemas da empresa numa torre só, para o dono decidir com número, não com sensação. <a href="https://capacitycase.com.br" target="_blank" rel="noopener">capacitycase.com.br</a></div>
    <p class="linha" style="margin-top:18px"><button class="btn acc" onclick="Balao.abrir({via:'apresentacao'})">💬 Dar uma sugestão</button> <button class="btn pri" onclick="TM.ir('hoje')">Ir para o Hoje →</button> <a class="btn" href="marca/" target="_blank" rel="noopener">Marca e padrão visual</a></p>
    <div class="rodape"><span>Uso interno e confidencial. Dados tratados conforme a LGPD. Cotações públicas com 1 dia de atraso; não é recomendação de investimento.</span><span>Método Torre de Controle · Capacity Case</span></div>`;
  }

  // ---------- Hoje ----------
  function cartaoPerfil() {
    const p = perfil();
    return `<div class="card perfil"><div class="linha entre"><h3>Ajuste a torre para você</h3><button class="btn peq pri" id="pFechar">Pronto</button></div>
      <div class="linha" style="margin-top:10px;gap:18px;align-items:flex-start">
        <div><div class="sobrelinha" style="margin-bottom:6px">Eu</div><div class="seg" id="pPapel">${[["compra", "Compro"], ["venda", "Vendo"], ["ambos", "Os dois"]].map(([v, l]) => `<button class="${p.papel === v ? "ativo" : ""}" data-v="${v}">${l}</button>`).join("")}</div></div>
        <div style="flex:1;min-width:240px"><div class="sobrelinha" style="margin-bottom:6px">Metais que acompanho <span class="mut" style="text-transform:none;letter-spacing:0;font-weight:500">(nenhum = todos)</span></div>
          <div class="chips-rolam" id="pMetais" style="flex-wrap:wrap;margin:0">${ORDEM.map(k => `<button class="chip ${p.metais.includes(k) ? "ativo" : ""}" data-v="${k}">${nomeCurto(k)}</button>`).join("")}</div></div></div></div>`;
  }
  function ligaPerfil(m) {
    const p = perfil();
    m.querySelectorAll("#pPapel button").forEach(b => b.onclick = () => { p.papel = b.dataset.v; LS.set("tm_perfil", p); ir("hoje"); });
    m.querySelectorAll("#pMetais .chip").forEach(b => b.onclick = () => {
      const k = b.dataset.v; p.metais = p.metais.includes(k) ? p.metais.filter(x => x !== k) : [...p.metais, k]; LS.set("tm_perfil", p); ir("hoje");
    });
    const f = m.querySelector("#pFechar"); if (f) f.onclick = () => { p.feito = true; LS.set("tm_perfil", p); ir("hoje"); };
  }
  const lista = v => v.length <= 1 ? v.join("") : v.slice(0, -1).join(", ") + " e " + v[v.length - 1];

  function telaHoje(m) {
    const p = perfil(), meus = p.metais.length ? ORDEM.filter(k => p.metais.includes(k)) : ORDEM;
    const avs = avisosHoje(), d = A.resumoDolar(), dp = Math.round(d.pctAno);
    const baratos = meus.filter(k => A.resumo(k).termo.pct < 35).map(nomeCurto), caros = meus.filter(k => A.resumo(k).termo.pct >= 65).map(nomeCurto);
    const frase = `${baratos.length ? `<b>Baratos no ano:</b> ${lista(baratos)}.` : "Nenhum metal barato no ano."} ${caros.length ? `<b>Caros:</b> ${lista(caros)}.` : "Nenhum caro."} <b>Dólar</b> ${rs(d.h.brl, 4)}, ${pct(d.v7)} na semana.`;
    const linhaMetal = k => { const r = A.resumo(k);
      return `<tr data-metal="${k}"><td class="nome"><b>${nomeCurto(k)}</b><span class="mut mini">${r.bolsa.split(" ")[0]}</span></td><td class="n preco-c num">${rs(r.h.brl)}</td>
        <td class="n num ${cls(r.v1)}">${pct(r.v1)}</td><td class="n num ocultar-movel">${pct(r.v30)}</td><td class="n num ocultar-movel">${pct(r.v365)}</td><td class="termo-c">${miniTermo(r.termo.pct)}</td></tr>`; };
    const nAv = estado.todosAvisos ? avs.length : Math.min(avs.length, 5);
    const alvos = meusPrecos();
    m.innerHTML = `<div class="cabeca"><div><h1>Mercado hoje</h1><p class="sub">Fechamento de ${dataBR(dataPrecos)} · R$ por tonelada · dados com 1 dia de atraso</p></div>
        ${p.feito ? `<button class="btn peq" id="pAbrir">${p.papel === "compra" ? "Compro" : p.papel === "venda" ? "Vendo" : "Compro e vendo"} · ${p.metais.length ? p.metais.length + " metais" : "todos os metais"} ▾</button>` : ""}</div>
      ${P.falhas && P.falhas.length ? `<div class="aviso">Algumas cotações não foram lidas hoje: ${P.falhas.join("; ")}</div>` : ""}
      ${!p.feito ? cartaoPerfil() : ""}
      <div class="frase-dia">${frase}</div>
      <div class="hoje-grade">
        <div class="card sem-pad"><div class="card-topo"><h3>Cotações</h3><span class="mut mini">Termômetro: 0 = dia mais barato dos últimos 12 meses · 100 = o mais caro</span></div>
          <table class="quadro"><thead><tr><th>Metal</th><th class="n">R$/t</th><th class="n">Dia</th><th class="n ocultar-movel">30 dias</th><th class="n ocultar-movel">12 meses</th><th>Termômetro</th></tr></thead>
          <tbody>${meus.map(linhaMetal).join("")}
            <tr data-metal="dolar" class="linha-dolar"><td class="nome"><b>Dólar</b><span class="mut mini">PTAX</span></td><td class="n preco-c num">${rs(d.h.brl, 4)}</td><td class="n num ${cls(d.v1)}">${pct(d.v1)}</td><td class="n num ocultar-movel">${pct(d.v30)}</td><td class="n num ocultar-movel">${pct(d.v365)}</td><td class="termo-c">${miniTermo(dp)}</td></tr></tbody></table></div>
        <div class="pilha">
          <div class="card"><div class="linha entre"><h3>Avisos de hoje</h3><span class="mut mini">${avs.length}</span></div>
            ${avs.length ? `<ul class="avisos">${avs.slice(0, nAv).map(i => `<li class="${i.tipo}" ${i.metal ? `data-metal="${i.metal}"` : 'data-metal="dolar"'}><i></i><div><b>${i.titulo}</b><span>${i.acao}</span></div></li>`).join("")}</ul>
              ${avs.length > 5 ? `<button class="btn peq" id="hMais" style="margin-top:8px">${estado.todosAvisos ? "Mostrar menos" : `Ver todos (${avs.length})`}</button>` : ""}` : '<p class="mut peq">Nada fora do normal hoje.</p>'}
            ${avisoNotificacao()}</div>
          <div class="card"><div class="linha entre"><h3>Meus preços-alvo</h3><span class="mut mini">${alvos.length}</span></div>
            ${alvos.length ? `<ul class="alvos">${alvos.map((al, i) => { const v = A.ultimo(A.serie(al.metal)).brl, dist = (al.valor / v - 1) * 100, chegou = al.tipo === "abaixo" ? v <= al.valor : v >= al.valor, ch = A.chanceAlvo(A.risco(al.metal), dist);
              return `<li><div data-metal="${al.metal}"><b>${nomeCurto(al.metal)} ${al.tipo === "abaixo" ? "abaixo de" : "acima de"} ${rs(al.valor)}</b><span class="mut mini">${chegou ? "chegou" : `falta ${pct(dist).replace(/^[+−]/, "")} · chance em 30 dias ${nf(ch)}%`}</span></div>${chegou ? '<span class="selo meu">chegou</span>' : ""}<button class="x" data-del="${i}" title="Apagar">×</button></li>`; }).join("")}</ul>`
              : '<p class="mut peq">Diga o preço que você quer pagar ou receber, na tela de cada metal. A torre mostra a chance de chegar e avisa.</p>'}</div>
        </div>
      </div>
      <p class="mut mini" style="margin-top:14px">O termômetro mostra onde o preço está, não para onde vai. Fontes: ${P.fontes}. Coletado em ${P.coletadoEm.replace("T", " às ").slice(0, 19)}.</p>`;
    m.querySelectorAll("[data-metal]").forEach(el => el.onclick = () => abreMetal(el.dataset.metal));
    m.querySelectorAll("[data-del]").forEach(b => b.onclick = e => { e.stopPropagation(); const l = meusPrecos(); l.splice(+b.dataset.del, 1); LS.set("tm_alertas", l); window.Balao.desfez(); ir("hoje"); });
    if ($("#hMais")) $("#hMais").onclick = () => ir("hoje", { todosAvisos: !estado.todosAvisos });
    if ($("#pAbrir")) $("#pAbrir").onclick = () => { const q = perfil(); q.feito = false; LS.set("tm_perfil", q); ir("hoje"); };
    ligaPerfil(m); ligaNotificacao(m);
  }

  // ---------- avisos no aparelho (Notification) ----------
  function avisoNotificacao() {
    if (!("Notification" in window)) return "";
    if (Notification.permission === "default") return '<div class="notif"><span class="mut mini">Receber estes avisos no celular ou no computador?</span><button class="btn peq acc" id="rAvisos">Ligar avisos</button></div>';
    if (Notification.permission === "granted") return '<div class="notif"><span class="mut mini">Avisos ligados neste aparelho (com a torre aberta ou em segundo plano).</span></div>';
    return "";
  }
  function ligaNotificacao(m) {
    const b = m.querySelector("#rAvisos"); if (b) b.onclick = async e => { e.stopPropagation(); await Notification.requestPermission(); LS.set("tm_avisados", []); avisar(); ir(estado.tela); };
  }
  function notifica(i) {
    try {
      const n = new Notification(i.titulo, { body: i.acao, icon: "icone.svg", badge: "icone.svg", tag: i.id });
      n.onclick = () => { window.focus(); abreMetal(i.metal || "dolar"); n.close(); };
    } catch (e) { /* alguns celulares só avisam pelo service worker */ }
  }
  function avisar() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const ja = LS.get("tm_avisados", []), novos = avisosHoje().filter(i => i.forca >= 60 && !ja.includes(i.id));
    novos.slice(0, 3).forEach(notifica);
    if (novos.length > 3) notifica({ id: "varios", titulo: `Mais ${novos.length - 3} avisos na torre`, acao: "Abra a torre para ver todos." });
    LS.set("tm_avisados", ja.concat(novos.map(i => i.id)).slice(-300));
  }

  // ---------- Metais (detalhe; o dólar também é um item) ----------
  function cor(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  const PER = [[90, "3m"], [180, "6m"], [365, "1 ano"], [730, "2 anos"]];

  function telaMetal(m) {
    const k = estado.metal, ehDolar = k === "dolar", p = perfil();
    const r = ehDolar ? null : A.resumo(k), d = A.resumoDolar(), R = A.risco(k);
    const v = ehDolar ? d.h.brl : r.h.brl, dec = ehDolar ? 4 : 0;
    const pctTermo = ehDolar ? Math.round(d.pctAno) : r.termo.pct, nivel = A.nivelDe(pctTermo);
    const serie = ehDolar ? d.serie.map(x => ({ data: x.data, brl: x.brl })) : A.serie(k);
    const campo = ehDolar ? "brl" : estado.moeda, fmt = campo === "brl" ? (x => rs(x, dec)) : us;
    const vars = ehDolar ? [d.v1, d.v30, d.v365] : [r.v1, r.v30, r.v365];
    const tipoAlvo = p.papel === "venda" ? "acima" : "abaixo";
    m.innerHTML = `<div class="chips-rolam">${[...ORDEM, "dolar"].map(x => `<button class="chip ${x === k ? "ativo" : ""}" data-m="${x}">${nomeCurto(x)}</button>`).join("")}</div>
      <div class="cabeca metal-topo"><div><h1>${ehDolar ? "Dólar PTAX" : r.nome}</h1><p class="sub">${ehDolar ? "Banco Central" : r.bolsa} · fechamento de ${dataBR(ehDolar ? d.h.data : r.h.data)}</p></div>
        <div class="preco-topo"><div class="big num">${rs(v, dec)}${ehDolar ? "" : ' <span class="peq mut">/t</span>'}</div><div class="mut peq">${ehDolar ? "" : us(r.h.usd) + "/t · "}dia <b class="num">${pct(vars[0])}</b> · 30 dias <b class="num">${pct(vars[1])}</b> · 12 meses <b class="num">${pct(vars[2])}</b></div></div></div>
      <div class="kpis">
        <div class="kpi termo ${corTermo(pctTermo)}"><div class="linha entre"><div class="sobrelinha">Termômetro do ano</div><span class="tn num">${pctTermo}</span></div><div class="rot">${nivel.rotulo}</div>${barraAno(pctTermo)}${ehDolar ? "" : `<div class="mut mini" style="margin-top:4px">${leituraTermo(nivel, p.papel)}</div>`}</div>
        ${kpi("Faixa provável em 30 dias", `${rs(v * (1 + R.r30[0] / 100), dec)} a ${rs(v * (1 + R.r30[2] / 100), dec)}`, `${pct(R.r30[0])} a ${pct(R.r30[2])} em 8 de cada 10 meses, pela história ${fonteRisco(k)}`)}
        ${ehDolar ? kpi("Mínimo e máximo do ano", `${rs(d.min, 2)} a ${rs(d.max, 2)}`, "PTAX dos últimos 12 meses")
          : kpi("Peso do dólar no risco", `${A.parteDolar(k)}%`, A.parteDolar(k) >= 30 ? "Travar o câmbio com o banco protege boa parte do custo." : "O risco maior está no metal; travar só o câmbio protege pouco.")}
      </div>
      <div class="card" style="margin-top:16px"><div class="linha entre" style="margin-bottom:12px"><h3>Preço em ${campo === "brl" ? "R$" : "US$"}${ehDolar ? "" : " por tonelada"}</h3>
        <div class="linha"><div class="seg">${PER.map(([n, l]) => `<button data-per="${n}" class="${estado.periodo == n ? "ativo" : ""}">${l}</button>`).join("")}</div>
        ${ehDolar ? "" : `<div class="seg"><button data-moeda="brl" class="${campo === "brl" ? "ativo" : ""}">R$</button><button data-moeda="usd" class="${campo === "usd" ? "ativo" : ""}">US$</button></div>`}</div></div>
        <div class="graf"><canvas id="gPreco"></canvas></div></div>
      <div class="grade g2" style="margin-top:16px">
        ${ehDolar ? `<div class="card"><h3>O peso do dólar em cada metal</h3><p class="mut peq" style="margin:4px 0 8px">Parte do sobe-e-desce em R$ dos últimos 12 meses que veio do dólar.</p>
            <table class="peq">${ORDEM.map(x => `<tr data-metal="${x}" style="cursor:pointer"><td>${nomeCurto(x)}</td><td class="n num">${A.parteDolar(x)}%</td></tr>`).join("")}</table>
            <p class="mut mini" style="margin:8px 0 0">Quando o dólar sobe, o metal em US$ muitas vezes cai e compensa em parte.</p></div>
          <div class="card"><h3>Travar o câmbio</h3><p class="mut">Pela história ${fonteRisco("dolar")}, o dólar mexeu de ${pct(R.r30[0])} a ${pct(R.r30[2])} em 30 dias em 8 de cada 10 meses. Quem tem pagamento grande em dólar à frente pode tirar esse risco do custo com um contrato a termo no banco.</p></div>`
        : `<div class="card"><h3>Comprar em lotes</h3>
            <div class="duas"><div><div class="kv num">${nf(R.umDiaP90, 1)}%</div><div class="mut mini">tudo num dia só</div></div><div><div class="kv num compra-t">${nf(R.lotesP90, 1)}%</div><div class="mut mini">em 4 lotes semanais</div></div></div>
            <p class="mut peq" style="margin:10px 0">Quanto o preço pago ficou longe da média do mês, em 1 de cada 10 meses. O lote não garante preço menor: tira a dependência de um dia só.</p>
            <button class="btn peq" onclick="TM.ir('simulador')">Montar o plano da minha compra →</button></div>
          <div class="card"><h3>Preço-alvo</h3>
            <div class="form" style="margin-top:10px"><label class="campo">${p.papel === "venda" ? "Quero vender acima de (R$/t)" : "Quero comprar abaixo de (R$/t)"}<input id="mAlvo" type="number" step="100" inputmode="numeric" value="${Math.round(v * (tipoAlvo === "acima" ? 1.05 : .95) / 100) * 100}"></label>
              <button class="btn pri" id="mVigiar">Vigiar este preço</button></div><div class="evid" id="mChance"></div></div>`}
      </div>
      <details class="dobra"><summary>O que a história diz sobre o termômetro</summary><div class="dobra-c"><p>${textoHistoria(k, { nivel })}</p></div></details>
      ${ehDolar ? "" : `<details class="dobra" id="dTermo"><summary>Termômetro ao longo do tempo</summary><div class="dobra-c"><div class="graf medio"><canvas id="gTermo"></canvas></div></div></details>
      <details class="dobra"><summary>Contexto do mercado</summary><div class="dobra-c"><ul class="sinais">${r.termo.sinais.map(s => `<li><span class="s ${s.t}">${s.t === "alta" ? "↑" : s.t === "baixa" ? "↓" : "–"}</span><span>${s.txt}</span></li>`).join("")}
        <li><span class="s neutro">$</span><span>De onde veio a variação de 30 dias: metal ${sinal(r.dec.efeitoMetal)}${rs(Math.abs(r.dec.efeitoMetal))}/t, dólar ${sinal(r.dec.efeitoDolar)}${rs(Math.abs(r.dec.efeitoDolar))}/t.</span></li></ul>
        <p class="mut mini">Contexto para a negociação. Nenhum desses sinais, sozinho, prevê o preço.</p></div></details>
      ${P.metais[k].tem3m ? `<details class="dobra" id="dEst"><summary>Estoque nos armazéns da LME</summary><div class="dobra-c"><div class="graf medio"><canvas id="gEst"></canvas></div></div></details>` : ""}`}`;
    m.querySelectorAll("[data-m]").forEach(b => b.onclick = () => abreMetal(b.dataset.m));
    m.querySelectorAll("tr[data-metal]").forEach(b => b.onclick = () => abreMetal(b.dataset.metal));
    m.querySelectorAll("[data-per]").forEach(b => b.onclick = () => { LS.set("tm_periodo", +b.dataset.per); ir("metal", { periodo: +b.dataset.per }); });
    m.querySelectorAll("[data-moeda]").forEach(b => b.onclick = () => { LS.set("tm_moeda", b.dataset.moeda); ir("metal", { moeda: b.dataset.moeda }); });
    const ativo = m.querySelector(".chips-rolam .chip.ativo"); if (ativo) ativo.parentNode.scrollLeft = ativo.offsetLeft - 16;

    if (!ehDolar) {
      const chance = () => { const alvo = +$("#mAlvo").value; if (!alvo) { $("#mChance").innerHTML = ""; return; }
        const dist = (alvo / v - 1) * 100, ja = tipoAlvo === "abaixo" ? alvo >= v : alvo <= v, ch = A.chanceAlvo(R, dist);
        $("#mChance").innerHTML = ja ? "Esse preço já está valendo hoje." : `A <b>${pct(dist)}</b> de hoje. Pela história ${fonteRisco(k)}, o preço encostou num ponto assim em <b>${nf(ch)}%</b> dos meses: chance ${chanceTxt(ch)} em 30 dias.`; };
      $("#mAlvo").oninput = chance; chance();
      $("#mVigiar").onclick = () => { const valor = +$("#mAlvo").value; if (!valor) { window.Balao.recusa("Preencha o preço-alvo."); return; }
        const l = meusPrecos(); l.push({ metal: k, tipo: tipoAlvo, valor }); LS.set("tm_alertas", l); ir("hoje"); };
    }

    const ini = serie.length - A.janela(serie, estado.periodo).length, pts = serie.slice(ini), lab = pts.map(x => dataCurta(x.data));
    const ano = A.janela(serie, 365).map(x => x[campo]), p25 = A.quantil(ano, .25), p75 = A.quantil(ano, .75);
    const mm = A.mediaMovel(serie, 60, campo).slice(ini);
    graficos.push(new Chart($("#gPreco"), { type: "line",
      data: { labels: lab, datasets: [
        { label: "Preço", data: pts.map(x => x[campo]), borderColor: cor("--ink"), borderWidth: 2, pointRadius: 0, tension: .15 },
        { label: "Média de 3 meses", data: mm, borderColor: cor("--acc"), borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0 },
        { label: "Faixa do ano (topo)", data: pts.map(() => p75), borderColor: "transparent", pointRadius: 0, fill: "+1", backgroundColor: "rgba(94,110,126,.09)" },
        { label: "Faixa do ano (base)", data: pts.map(() => p25), borderColor: "transparent", pointRadius: 0 } ] },
      options: opcoesGrafico(fmt) }));
    if (!ehDolar) {
      graficoAoAbrir($("#dTermo"), () => { const ht = A.historicoTermo(k, Math.max(estado.periodo, 365));
        return new Chart($("#gTermo"), { type: "line", data: { labels: ht.map(x => dataCurta(x.data)), datasets: [
          { label: "Termômetro", data: ht.map(x => x.pct), borderColor: cor("--ink"), borderWidth: 1.6, pointRadius: 0, tension: .2 },
          { label: "Linha de 85 (base)", data: ht.map(() => 85), borderColor: cor("--venda"), borderWidth: 1, borderDash: [3, 3], pointRadius: 0 },
          { label: "Linha de 15 (base)", data: ht.map(() => 15), borderColor: cor("--compra"), borderWidth: 1, borderDash: [3, 3], pointRadius: 0 } ] },
          options: { ...opcoesGrafico(x => nf(x)), scales: { ...opcoesGrafico().scales, y: { min: 0, max: 100, ticks: { color: cor("--mut"), stepSize: 25 }, grid: { color: cor("--lin2") } } } } }); });
      if ($("#dEst")) graficoAoAbrir($("#dEst"), () => new Chart($("#gEst"), { type: "line",
        data: { labels: lab, datasets: [{ label: "Estoque LME (t)", data: pts.map(x => x.estoque), borderColor: cor("--aten"), borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: "rgba(178,106,0,.07)" }] },
        options: opcoesGrafico(x => nf(x) + " t") }));
    }
  }

  function opcoesGrafico(fmt) {
    return { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: cor("--mut"), filter: i => !i.text.includes("(base)") && !i.text.includes("(topo)"), boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { family: "Inter", size: 12 } } },
        tooltip: { backgroundColor: "#0B1F33", padding: 10, titleFont: { family: "Inter" }, bodyFont: { family: "Inter" },
          callbacks: { label: c => /Faixa|Linha/.test(c.dataset.label) ? null : `${c.dataset.label}: ${fmt(c.parsed.y)}` } } },
      scales: { x: { ticks: { color: cor("--mut"), maxTicksLimit: innerWidth < 600 ? 4 : 7, maxRotation: 0, font: { family: "Inter", size: 11 } }, grid: { display: false } },
        y: { ticks: { color: cor("--mut"), callback: v => nf(v), font: { family: "Inter", size: 11 } }, grid: { color: cor("--lin2") }, border: { display: false } } } };
  }

  // ---------- Minha compra ----------
  function telaSimulador(m) {
    const s = LS.get("tm_sim", { metal: "aluminio", ton: 25, forma: "premio", premio: 350, pct: 80 });
    m.innerHTML = `<div class="cabeca"><div><h1>Minha compra</h1><p class="sub">Quanto custa hoje, quanto pode variar em 30 dias e como fica em 4 lotes semanais.</p></div></div>
      <div class="compra-grade">
        <div class="card"><div class="form uma">
          <label class="campo">Metal<select id="sMetal">${ORDEM.map(x => `<option value="${x}" ${x === s.metal ? "selected" : ""}>${P.metais[x].nome}</option>`).join("")}</select></label>
          <label class="campo">Toneladas no mês<input id="sTon" type="number" min="0" step="0.5" inputmode="decimal" value="${s.ton}"></label>
          <label class="campo">Como o seu preço é formado<select id="sForma"><option value="premio" ${s.forma === "premio" ? "selected" : ""}>Bolsa + prêmio (US$/t)</option><option value="pct" ${s.forma === "pct" ? "selected" : ""}>% da bolsa (sucata)</option></select></label>
          <label class="campo" id="lPremio">Prêmio (US$/t)<input id="sPremio" type="number" step="10" inputmode="numeric" value="${s.premio}"></label>
          <label class="campo" id="lPct">% da bolsa<input id="sPct" type="number" step="1" inputmode="numeric" value="${s.pct}"></label>
        </div></div>
        <div id="sRes"></div></div>`;
    const calc = () => {
      const v = { metal: $("#sMetal").value, ton: +$("#sTon").value || 0, forma: $("#sForma").value, premio: +$("#sPremio").value || 0, pct: +$("#sPct").value || 0 };
      LS.set("tm_sim", v);
      $("#lPremio").style.display = v.forma === "premio" ? "" : "none"; $("#lPct").style.display = v.forma === "pct" ? "" : "none";
      const a = A.serie(v.metal), t = A.resumo(v.metal).termo, R = A.risco(v.metal), pd = A.parteDolar(v.metal);
      const custo = x => (v.forma === "premio" ? (x.usd + v.premio) : x.usd * v.pct / 100) * x.dolar * v.ton;
      const h = A.ultimo(a), hoje = custo(h), m90 = A.media(A.janela(a, 90).map(custo)), dif = hoje - m90;
      const semanas = [0, 7, 14, 21].map(dd => dataBR(A.isoMais(new Date().toISOString().slice(0, 10), dd)));
      $("#sRes").innerHTML = `<div class="card destaque"><div class="sobrelinha">Custo hoje</div><div class="kv grande num">${rs(hoje)}</div>
          <div class="mut peq">${rs(v.ton ? hoje / v.ton : 0)}/t · dólar ${rs(h.dolar, 4)} · termômetro ${t.pct} (${t.nivel.rotulo.toLowerCase()}) · ${dif >= 0 ? "acima" : "abaixo"} da média de 3 meses em ${rs(Math.abs(dif))}</div></div>
        <div class="kpis" style="margin-top:16px">
          ${kpi("Se deixar para daqui a 30 dias", `${rs(hoje * (1 + R.r30[0] / 100))} a ${rs(hoje * (1 + R.r30[2] / 100))}`, `8 de cada 10 meses, pela história ${fonteRisco(v.metal)}`)}
          ${kpi("Tudo num dia só × 4 lotes", `${rs(hoje * R.umDiaP90 / 100)} × ${rs(hoje * R.lotesP90 / 100)}`, "quanto o custo pode ficar longe da média do mês (1 em cada 10 meses)")}
          ${kpi("Se o dólar subir 5%", `+${rs(hoje * 0.05)}`, `${pd}% do risco deste metal vem do dólar${pd >= 30 ? ": vale cotar câmbio travado no banco" : ""}`)}
        </div>
        <div class="card" style="margin-top:16px"><h3>Plano em 4 lotes semanais</h3>
          <table class="peq" style="margin-top:8px"><tr><th>Semana</th><th class="n">Toneladas</th><th class="n">Custo pelo preço de hoje</th></tr>
            ${semanas.map((dt, i) => `<tr><td>${i + 1}ª · ${dt}</td><td class="n num">${nf(v.ton / 4, 1)} t</td><td class="n num">${rs(hoje / 4)}</td></tr>`).join("")}</table>
          <p class="mut mini" style="margin:10px 0 0">O lote não garante preço menor: tira a dependência de um dia de sorte ou de azar. Frete, impostos e prazo de pagamento ficam de fora. Faixas são o que aconteceu no passado, não garantia.</p></div>`;
    };
    m.querySelectorAll("input,select").forEach(el => el.oninput = calc); calc();
  }

  window.TM = { ir, get tela() { return estado.tela; } };
  menu();
  const inicio = LS.get("tm_tela", "hoje");
  ir(LS.get("tm_visitou", false) ? (inicio === "sugestoes" ? "hoje" : inicio) : "sobre");
  avisar();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) avisar(); });
})();
