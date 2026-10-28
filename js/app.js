/* Torre de Controle - Metais: telas.
   Padrão visual em marca/index.html. Os cálculos (termômetro, risco, lotes, câmbio, preço-alvo, Radar) estão em js/analise.js;
   a memória de 15 anos da LME está em js/memoria.js (gerada por coletor/memoria.js).
   Regra desde 28/10/2026: o termômetro mostra onde o preço está, não para onde vai. Nada de "compre agora": as frases sugerem. */
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
  const dataCurta = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7);
  const nomeCurto = k => P.metais[k].nome.replace(" bobina a quente (EUA)", " (bobina)").replace(" 62%", "");
  const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
               set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const estado = { tela: "", metal: LS.get("tm_metal", "aluminio"), periodo: LS.get("tm_periodo", 365), moeda: LS.get("tm_moeda", "brl"), filtro: "tudo" };
  const perfil = () => LS.get("tm_perfil", { papel: "ambos", metais: [], feito: false });
  const meusPrecos = () => LS.get("tm_alertas", []);
  const radarHoje = () => A.radar(perfil(), meusPrecos());
  const dataPrecos = A.ultimo(A.serie("aluminio")).data;
  const fonteRisco = k => MEM && MEM.risco && MEM.risco[k] ? `desde ${MEM.desde}` : "dos últimos 3 anos";
  let graficos = [];

  const IC = {
    sobre: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h6"/>',
    hoje: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    metal: '<path d="M3 20h18"/><path d="M5 16l4-5 4 3 6-8"/>',
    dolar: '<path d="M12 2v20"/><path d="M17 6.5c-1-1.5-2.8-2.3-5-2.3-2.8 0-4.6 1.5-4.6 3.6 0 5 9.8 2.6 9.8 7.8 0 2.2-2 3.8-5 3.8-2.4 0-4.4-1-5.4-2.6"/>',
    simulador: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8v4H8z"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    sugestoes: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.1A8.5 8.5 0 1 1 21 12z"/>',
  };
  const icone = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[id]}</svg>`;
  const marca = () => `<div class="marca"><img src="icone.svg" alt=""><div class="marca-txt"><small>Torre de Controle</small><b>${C.EMPRESA}<i></i></b></div></div>`;

  // [id, nome, nome curto na barra do celular]
  const TELAS = [["sobre", "Apresentação", "Sobre"], ["hoje", "Hoje", "Hoje"], ["radar", "Radar", "Radar"], ["metal", "Metais", "Metais"], ["dolar", "Dólar", "Dólar"], ["simulador", "Simulador", "Simular"], ["sugestoes", "Sugestões", "Sugestões"]];

  function menu() {
    $("#menu").innerHTML = marca() +
      TELAS.map(([id, nome, curto]) => `<button data-tela="${id}" title="${nome}">${icone(id)}<span class="nm">${nome}</span><span class="nc">${curto}</span>${id === "sugestoes" ? '<span class="cont" id="contRetorno" hidden></span>' : ""}${id === "radar" ? '<span class="cont" id="contRadar" hidden></span>' : ""}</button>`).join("") +
      `<div class="rodape-menu">Fechamento de ${dataBR(dataPrecos)}<br>Método Torre de Controle · Capacity Case</div>`;
    $("#menu").onclick = e => { const b = e.target.closest("button[data-tela]"); if (b) ir(b.dataset.tela); };
    $("#topoMovel").innerHTML = marca() + `<div class="data">Fechamento<b>${dataBR(dataPrecos)}</b></div>`;
    contadorRadar();
  }
  function contadorRadar() {
    const lidos = LS.get("tm_radar_lidos", []), n = radarHoje().filter(i => i.forca >= 60 && !lidos.includes(i.id)).length, el = $("#contRadar");
    if (el) { el.hidden = !n; el.textContent = n; }
  }

  function ir(tela, extra) {
    if (tela === "alertas") tela = "radar"; // a tela Alertas virou parte do Radar
    if (extra) Object.assign(estado, extra);
    graficos.forEach(g => g.destroy()); graficos = [];
    estado.tela = tela; LS.set("tm_tela", tela); LS.set("tm_visitou", true);
    document.querySelectorAll("nav.menu button").forEach(b => b.classList.toggle("ativo", b.dataset.tela === tela));
    const m = $("#conteudo");
    ({ sobre: telaSobre, hoje: telaHoje, radar: telaRadar, metal: telaMetal, dolar: telaDolar, simulador: telaSimulador,
       sugestoes: () => window.Balao.telaSugestoes(m) })[tela](m);
    window.scrollTo(0, 0);
    window.Balao && window.Balao.evento("tela", { tela });
    window.Balao && window.Balao.retornoNaTela(tela);
  }

  // ---------- pedaços reutilizados ----------
  function barraAno(pctAno, rotEsq = "mais barato do ano", rotDir = "mais caro do ano") {
    return `<div class="ano" title="Onde o preço em R$ está nos últimos 12 meses"><i style="left:${Math.max(2, Math.min(98, pctAno)).toFixed(0)}%"></i></div>
      <div class="linha entre mini mut"><span>${rotEsq}</span><span>${rotDir}</span></div>`;
  }
  // Termômetro: 0 = o dia mais barato dos últimos 12 meses, 100 = o mais caro. A cor segue o papel: verde favorece quem compra, azul quem vende.
  function termometro(t, papel, peq) {
    const cor = t.pct < 35 ? "compra" : t.pct >= 65 ? "venda" : "neutro";
    const leitura = papel === "compra" ? t.nivel.compra : papel === "venda" ? t.nivel.venda : t.nivel.chave === "m" ? "Neutro para comprar e para vender" : `${t.nivel.compra} · ${t.nivel.venda.toLowerCase()}`;
    return `<div class="termo ${cor} ${peq ? "peq" : ""}"><div class="linha entre" style="align-items:baseline"><div><div class="sobrelinha">Termômetro do ano</div><div class="rot">${t.nivel.rotulo}</div></div><span class="tn num">${t.pct}</span></div>
      ${barraAno(t.pct)}<div class="mut peq" style="margin-top:4px">${leitura}</div></div>`;
  }
  const NOME_TIPO = { compra: "Para quem compra", venda: "Para quem vende", atencao: "Atenção", dolar: "Dólar", meu: "Seu preço" };
  function itemRadar(i, compacto) {
    return `<div class="ri ${i.tipo} ${compacto ? "compacto" : ""} ${i.metal ? "clicavel" : ""}" ${i.metal ? `data-metal="${i.metal}"` : 'data-dolar="1"'}>
      <div class="linha"><span class="selo ${i.tipo}">${NOME_TIPO[i.tipo]}</span>${i.novo ? '<span class="selo novo">novo</span>' : ""}</div>
      <h3>${i.titulo}</h3><p>${i.texto}</p><div class="acao">${i.acao}</div></div>`;
  }
  function ligaCliques(m) {
    m.querySelectorAll("[data-metal]").forEach(el => el.onclick = () => { LS.set("tm_metal", el.dataset.metal); ir("metal", { metal: el.dataset.metal }); });
    m.querySelectorAll("[data-dolar]").forEach(el => { el.style.cursor = "pointer"; el.onclick = () => ir("dolar"); });
  }
  // O que a história diz sobre esta faixa do termômetro (memória de 15 anos da LME; minério e aço não têm).
  function textoHistoria(k, t) {
    const ev = MEM && MEM.termo && MEM.termo[k], n = t.nivel.chave;
    if (!ev || !ev.every(p => p.faixas[n] && p.faixas[n].n >= 40))
      return "Para este metal não há história longa gratuita. Use o termômetro como referência de preço, não como previsão.";
    const [a, b] = ev;
    return `<b>O que a história diz:</b> com o termômetro nesta faixa, o preço em R$ estava mais alto 30 dias depois em <b>${nf(a.faixas[n].subiu)}%</b> dos dias de ${a.de} a ${a.ate} e em <b>${nf(b.faixas[n].subiu)}%</b> de ${b.de} para cá (em qualquer dia: ${nf(a.base)}% e ${nf(b.base)}%). Ou seja: o termômetro diz onde o preço está, não para onde vai.`;
  }
  const chanceTxt = v => v >= 70 ? "alta" : v >= 40 ? "média" : v >= 15 ? "baixa" : "muito baixa";

  // ---------- Apresentação ----------
  function telaSobre(m) {
    m.innerHTML = `
    <div class="sb-topo"><span class="etq"><img src="icone.svg" alt="">Torre de Controle - ${C.EMPRESA}</span>
      <h1>Comprar e vender metal com número, todo dia.</h1>
      <p>A torre lê as cotações da bolsa de metais de Londres (LME), do minério e do aço, junta com o dólar do Banco Central e mostra numa tela só, em reais por tonelada, onde o preço está no ano, quanto ele costuma mexer em 30 dias e quanto disso vem do dólar. Ela avisa quando algo muda e quando o preço que você quer chega.</p></div>
    <h2>Como a torre foi montada aqui</h2>
    <div class="grade">
      <div class="card"><div class="sb-num">Lê</div><h3>As bolsas e o Banco Central</h3><p class="mut">Alumínio, cobre, zinco, níquel, chumbo e estanho da LME (preço à vista, de 3 meses e estoque). Minério de ferro e aço da CME. Dólar PTAX do Banco Central.</p></div>
      <div class="card"><div class="sb-num">Junta</div><h3>Tudo em reais por tonelada</h3><p class="mut">Cada cotação em dólar vira R$/t com o dólar do mesmo dia. Assim dá para ver quanto da alta ou da queda veio do metal e quanto veio do câmbio.</p></div>
      <div class="card"><div class="sb-num">Cria</div><h3>Termômetro, risco e avisos</h3><p class="mut">O termômetro diz se o preço está barato ou caro no ano. A memória de 15 anos da LME mostra quanto o preço costuma mexer em 30 dias, quanto comprar em lotes protege e a chance de o seu preço-alvo chegar.</p></div>
    </div>
    <h2>O que a torre entrega</h2>
    <div class="grade g4">
      <div class="card"><h3>Hoje</h3><p class="mut">O resumo do dia numa frase, os avisos mais importantes e o termômetro dos seus metais.</p></div>
      <div class="card"><h3>Radar</h3><p class="mut">Preço no alto ou no fundo do ano, movimentos fortes, dólar e os seus preços-alvo, com a chance de cada um chegar.</p></div>
      <div class="card"><h3>Cada metal</h3><p class="mut">Gráfico de até 2 anos, o risco dos próximos 30 dias, o peso do dólar e o que a história diz sobre o termômetro.</p></div>
      <div class="card"><h3>Simulador</h3><p class="mut">Quanto custa a sua compra hoje, a faixa provável em 30 dias e um plano em 4 lotes semanais.</p></div>
    </div>
    <h2>Como funciona</h2>
    <div class="grade g4">
      <div class="card"><div class="sb-num">1 · Origem</div><span class="mut">LME (via Westmetall), CME e Banco Central. Lidos às 7h e às 15h dos dias úteis, com 1 dia de atraso.</span></div>
      <div class="card"><div class="sb-num">2 · Organiza</div><span class="mut">Converte tudo para R$/t e guarda quase 3 anos no painel e 15 anos na memória da LME.</span></div>
      <div class="card"><div class="sb-num">3 · Mostra</div><span class="mut">Painel no celular e no computador, no mesmo endereço. No celular dá para instalar como aplicativo.</span></div>
      <div class="card"><div class="sb-num">4 · Age</div><span class="mut">O Radar avisa e sugere o próximo passo. Você decide quando comprar, quanto e quando travar preço ou câmbio.</span></div>
    </div>
    <h2>O que estamos construindo primeiro</h2>
    <div class="card rolar"><table>
      <tr><td>Hoje, Radar, termômetro, risco de 30 dias, compra em lotes, câmbio e preço-alvo com chance de chegar</td><td><span class="selo compra">tela pronta</span></td></tr>
      <tr><td>Avisos neste aparelho (com a torre aberta ou em segundo plano)</td><td><span class="selo compra">tela pronta</span></td></tr>
      <tr><td>Aviso no celular mesmo com o aplicativo fechado</td><td><span class="selo aten">em construção</span></td></tr>
      <tr><td>Preço local de cada cliente (prêmio Brasil, sucata) lançado uma vez e usado em todas as contas</td><td><span class="selo aten">em construção</span></td></tr>
      <tr><td>Login por empresa e Sugestões guardadas no banco do cliente</td><td><span class="selo aten">em construção</span></td></tr>
    </table></div>
    <h2>Como a gente usa</h2>
    <div class="grade">
      <div class="card"><h3>Todo dia</h3><p class="mut">O comprador abre o Hoje de manhã, lê o resumo e o Radar dos metais que compra.</p></div>
      <div class="card"><h3>Toda semana</h3><p class="mut">A reunião de compras usa o simulador para decidir volume, lotes e se trava o câmbio.</p></div>
      <div class="card"><h3>No caminho</h3><p class="mut">A Capacity Case acompanha o uso, ouve o balão 💬 e ajusta a torre.</p></div>
    </div>
    <h2>Princípios</h2>
    <div class="grade">
      <div class="card"><h3>Não é bala de prata</h3><p class="mut">Ninguém acerta o preço de amanhã. Testamos 15 anos da LME: "comprar quando está barato" funcionou até 2019 e deixou de funcionar depois. Por isso a torre não manda comprar: mostra onde o preço está e ajuda a reduzir o risco.</p></div>
      <div class="card"><h3>Um dado, uma fonte</h3><p class="mut">Cotação vem da bolsa, dólar vem do Banco Central. O que é só seu (prêmio, frete) é lançado uma vez, aqui.</p></div>
      <div class="card"><h3>Poucos números que importam</h3><p class="mut">Preço em R$/t, o termômetro e o risco de 30 dias. O resto fica um toque abaixo.</p></div>
      <div class="card"><h3>Cada um vê o que precisa</h3><p class="mut">Cada pessoa escolhe se compra, vende ou os dois, e quais metais acompanha.</p></div>
      <div class="card"><h3>Os dados ficam na empresa</h3><p class="mut">O que a sua empresa lança fica no banco da sua empresa. Ninguém fica refém de ninguém.</p></div>
    </div>
    <h2>Quem acessa</h2>
    <div class="grade">
      <div class="card"><h3>Gestor</h3><p class="mut">Dono ou diretor de compras. Vê tudo, define os preços-alvo da empresa e lê todas as sugestões.</p></div>
      <div class="card"><h3>Comprador ou vendedor</h3><p class="mut">Usa o Hoje, o Radar e o simulador no dia a dia. Entra por convite do gestor.</p></div>
    </div>
    <div class="card sb-metodo" style="margin-top:24px"><b>Sobre o método.</b> A Torre de Controle é o método da Capacity Case, de Luiz Amo: juntar, ler e criar os sistemas da empresa numa torre só, para o dono decidir com número, não com sensação. <a href="https://capacitycase.com.br" target="_blank" rel="noopener">capacitycase.com.br</a></div>
    <p class="linha" style="margin-top:18px"><button class="btn acc" onclick="Balao.abrir({via:'apresentacao'})">💬 Dar uma sugestão</button> <button class="btn pri" onclick="TM.ir('hoje')">Ir para o painel Hoje →</button> <a class="btn" href="marca/" target="_blank" rel="noopener">Marca e padrão visual</a></p>
    <div class="rodape"><span>Uso interno e confidencial. Dados tratados conforme a LGPD. Cotações públicas com 1 dia de atraso; não é recomendação de investimento.</span><span>Método Torre de Controle · Capacity Case</span></div>`;
  }

  // ---------- Hoje ----------
  function saudacao() { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }

  function cartaoPerfil() {
    const p = perfil();
    return `<div class="card perfil" id="cPerfil"><div class="linha entre"><h3>Deixe a torre com a sua cara</h3><button class="btn peq" id="pFechar">Pronto</button></div>
      <p class="mut peq" style="margin:4px 0 12px">Escolha o que você faz e os metais que acompanha. O Hoje e o Radar mostram só o que importa para você. Fica guardado neste aparelho.</p>
      <div class="sobrelinha" style="margin-bottom:6px">Eu</div>
      <div class="chips-rolam" id="pPapel">${[["compra", "Compro"], ["venda", "Vendo"], ["ambos", "Compro e vendo"]].map(([v, l]) => `<button class="chip ${p.papel === v ? "ativo" : ""}" data-v="${v}">${l}</button>`).join("")}</div>
      <div class="sobrelinha" style="margin-bottom:6px">Metais que acompanho <span class="mut" style="text-transform:none;letter-spacing:0;font-weight:500">(nenhum marcado = todos)</span></div>
      <div class="chips-rolam" id="pMetais">${ORDEM.map(k => `<button class="chip ${p.metais.includes(k) ? "ativo" : ""}" data-v="${k}">${nomeCurto(k)}</button>`).join("")}</div></div>`;
  }
  function ligaPerfil(m) {
    const p = perfil();
    m.querySelectorAll("#pPapel .chip").forEach(b => b.onclick = () => { p.papel = b.dataset.v; LS.set("tm_perfil", p); ir("hoje"); });
    m.querySelectorAll("#pMetais .chip").forEach(b => b.onclick = () => {
      const k = b.dataset.v; p.metais = p.metais.includes(k) ? p.metais.filter(x => x !== k) : [...p.metais, k]; LS.set("tm_perfil", p); ir("hoje");
    });
    const f = m.querySelector("#pFechar"); if (f) f.onclick = () => { p.feito = true; LS.set("tm_perfil", p); ir("hoje"); };
  }
  function frasePapel(p) { return p.papel === "compra" ? "para quem compra" : p.papel === "venda" ? "para quem vende" : "para comprar e vender"; }
  const lista = v => v.length <= 1 ? v.join("") : v.slice(0, -1).join(", ") + " e " + v[v.length - 1];

  function telaHoje(m) {
    const p = perfil(), meus = p.metais.length ? ORDEM.filter(k => p.metais.includes(k)) : ORDEM;
    const rad = radarHoje(), d = A.resumoDolar();
    const t = k => A.resumo(k).termo;
    const baratos = meus.filter(k => t(k).pct < 35).map(nomeCurto), caros = meus.filter(k => t(k).pct >= 65).map(nomeCurto);
    const meuP = rad.filter(i => i.tipo === "meu" && i.id.includes("|meu|")).length;
    const partes = [];
    if (meuP) partes.push(`<b>${meuP === 1 ? "um preço-alvo seu chegou" : meuP + " preços-alvo seus chegaram"}</b>`);
    partes.push(baratos.length ? `<b>${baratos.length === 1 ? "1 está barato" : baratos.length + " estão baratos"}</b> no ano (${lista(baratos)})` : "nenhum está barato no ano");
    partes.push(caros.length ? `<b>${caros.length === 1 ? "1 está caro" : caros.length + " estão caros"}</b> (${lista(caros)})` : "nenhum está caro");
    const dolTxt = Math.abs(d.v7) >= 1.5 ? `O dólar ${d.v7 > 0 ? "subiu" : "caiu"} <b>${pct(d.v7).slice(1)}</b> na semana e está ${d.pctAno >= 65 ? "caro" : d.pctAno < 35 ? "barato" : "no meio da faixa"} no ano.`
      : `O dólar está estável na semana e ${d.pctAno >= 65 ? "caro" : d.pctAno < 35 ? "barato" : "no meio da faixa"} no ano.`;
    const fraseResumo = `${p.metais.length ? "Dos seus metais" : "Dos 8 metais"}, hoje ${lista(partes)}. ${dolTxt}`;

    m.innerHTML = `<div class="cabeca"><div><h1>${saudacao()}</h1><p class="sub">Fechamento de ${dataBR(dataPrecos)} · preços em R$ por tonelada · leitura ${frasePapel(p)}</p></div>
        ${p.feito ? '<button class="btn peq" id="pAbrir">Ajustar meus metais</button>' : ""}</div>
      ${P.falhas && P.falhas.length ? `<div class="aviso">Algumas cotações não foram lidas hoje: ${P.falhas.join("; ")}</div>` : ""}
      ${!p.feito ? cartaoPerfil() + "<div style='height:16px'></div>" : ""}
      <div class="resumo"><div class="sobrelinha">Resumo do dia</div><p>${fraseResumo}</p>
        <div class="chips"><span>Dólar <b class="num">${rs(d.h.brl, 4)}</b> ${pct(d.v1)}</span>${meus.slice(0, 4).map(k => { const r = A.resumo(k); return `<span>${nomeCurto(k)} <b class="num">${rs(r.h.brl)}</b> ${pct(r.v1)}</span>`; }).join("")}</div></div>
      <div class="linha entre"><h2>Radar de hoje</h2><button class="btn peq" onclick="TM.ir('radar')">Ver tudo (${rad.length})</button></div>
      ${rad.length ? `<div class="radar">${rad.slice(0, innerWidth > 980 ? Math.min(8, Math.max(3, Math.floor((innerWidth - 324) / 334))) : 3).map(i => itemRadar(i, true)).join("")}</div>` : `<div class="card vazio">Nada fora do normal hoje.</div>`}
      <h2>${p.metais.length ? "Seus metais" : "Todos os metais"}</h2>
      <div class="metais">${meus.map(k => cartaoMetal(A.resumo(k), p)).join("")}${cartaoDolar(d)}</div>
      <p class="mut mini" style="margin-top:16px">O termômetro mostra onde o preço está nos últimos 12 meses, não para onde vai. Fontes: ${P.fontes}. Coletado em ${P.coletadoEm.replace("T", " às ").slice(0, 19)}.</p>`;
    ligaCliques(m); ligaPerfil(m);
    if ($("#pAbrir")) $("#pAbrir").onclick = () => { const q = perfil(); q.feito = false; LS.set("tm_perfil", q); ir("hoje"); };
    meus.forEach(k => sparkline(m.querySelector(`canvas[data-spark="${k}"]`), A.janela(A.serie(k), 90).map(x => x.brl)));
    sparkline(m.querySelector('canvas[data-spark="dolar"]'), A.janela(d.serie, 90).map(x => x.brl));
  }

  function cartaoMetal(r, p) {
    return `<div class="card clicavel cm" data-metal="${r.chave}">
      <div class="topo"><div><h3>${r.nome}</h3><div class="bolsa">${r.bolsa}</div></div><span class="var num ${cls(r.v1)} peq">${pct(r.v1)}</span></div>
      <div class="precos"><span class="preco num">${rs(r.h.brl)}</span><span class="mut peq">/t · ${us(r.h.usd)}</span></div>
      <div class="vars"><span>7 dias <b class="num">${pct(r.v7)}</b></span><span>30 dias <b class="num">${pct(r.v30)}</b></span><span>12 meses <b class="num">${pct(r.v365)}</b></span></div>
      ${termometro(r.termo, p.papel, true)}
      <canvas class="spark" data-spark="${r.chave}"></canvas></div>`;
  }
  function cartaoDolar(d) {
    return `<div class="card clicavel cm" data-dolar="1">
      <div class="topo"><div><h3>Dólar PTAX</h3><div class="bolsa">Banco Central · ${dataBR(d.h.data)}</div></div><span class="var num ${cls(d.v1)} peq">${pct(d.v1)}</span></div>
      <div class="precos"><span class="preco num">${rs(d.h.brl, 4)}</span></div>
      <div class="vars"><span>7 dias <b class="num">${pct(d.v7)}</b></span><span>30 dias <b class="num">${pct(d.v30)}</b></span><span>12 meses <b class="num">${pct(d.v365)}</b></span></div>
      ${barraAno(d.pctAno, `mín. ${rs(d.min, 2)}`, `máx. ${rs(d.max, 2)}`)}
      <canvas class="spark" data-spark="dolar"></canvas></div>`;
  }

  function sparkline(cv, v) {
    if (!cv || !v.length) return;
    const w = cv.clientWidth * devicePixelRatio, h = cv.clientHeight * devicePixelRatio; cv.width = w; cv.height = h;
    const g = cv.getContext("2d"), mn = Math.min(...v), mx = Math.max(...v);
    const pts = v.map((y, i) => [i / (v.length - 1) * w, h - (y - mn) / ((mx - mn) || 1) * (h - 6) - 3]);
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, "rgba(224,123,46,.18)"); grad.addColorStop(1, "rgba(224,123,46,0)");
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineTo(w, h); g.lineTo(0, h); g.fillStyle = grad; g.fill();
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.strokeStyle = cor("--ink"); g.lineWidth = 1.8 * devicePixelRatio; g.lineJoin = "round"; g.stroke();
    const [lx, ly] = pts[pts.length - 1]; g.beginPath(); g.arc(lx - 3 * devicePixelRatio, ly, 3 * devicePixelRatio, 0, 7); g.fillStyle = cor("--acc"); g.fill();
  }

  // ---------- Radar ----------
  function telaRadar(m) {
    const todos = radarHoje(), p = perfil();
    LS.set("tm_radar_lidos", todos.map(i => i.id)); contadorRadar();
    const F = [["tudo", "Tudo"], ["compra", "Quem compra"], ["venda", "Quem vende"], ["atencao", "Atenção"], ["dolar", "Dólar"], ["meu", "Meus preços"]];
    const lst = estado.filtro === "tudo" ? todos : todos.filter(i => i.tipo === estado.filtro);
    const permissao = "Notification" in window ? Notification.permission : "indisponivel";
    const T = MEM && MEM.todos;
    m.innerHTML = `<div class="cabeca"><div><h1>Radar</h1><p class="sub">A torre lê os 8 metais e o dólar todo dia e avisa o que saiu do normal: preço no alto ou no fundo do ano, movimento forte, dólar e os seus preços-alvo. Leitura ${frasePapel(p)}${p.metais.length ? ", só nos seus metais" : ""}.</p></div></div>
      <div class="chips-rolam">${F.map(([v, l]) => { const n = v === "tudo" ? todos.length : todos.filter(i => i.tipo === v).length; return `<button class="chip ${estado.filtro === v ? "ativo" : ""}" data-f="${v}">${l} · ${n}</button>`; }).join("")}</div>
      ${lst.length ? `<div class="radar">${lst.map(i => itemRadar(i)).join("")}</div>` : `<div class="card vazio">Nada neste filtro hoje.</div>`}

      <h2>Meus preços-alvo</h2>
      <p class="sub">Diga o preço em R$/t que você quer pagar ou receber. A torre mostra a chance de ele chegar em 30 dias, pela história do metal, e avisa quando chegar perto e quando chegar. Fica guardado neste aparelho.</p>
      <div class="card"><div class="form">
        <label class="campo">Metal<select id="aMetal">${ORDEM.map(x => `<option value="${x}">${P.metais[x].nome}</option>`).join("")}</select></label>
        <label class="campo">Avisar quando<select id="aTipo"><option value="abaixo">ficar abaixo de (para comprar)</option><option value="acima">passar de (para vender)</option></select></label>
        <label class="campo">Preço (R$/t)<input id="aValor" type="number" step="100" inputmode="numeric"></label>
        <button class="btn pri" id="aAdd">Vigiar este preço</button></div>
        <div class="evid" id="aChance"></div>
        <div class="rolar" style="margin-top:14px"><table><tr><th>Metal</th><th>Alvo</th><th class="n">Hoje</th><th class="n">Falta</th><th class="n">Chance em 30 dias</th><th></th></tr>
        ${meusPrecos().map((al, i) => { const v = A.ultimo(A.serie(al.metal)).brl, dist = (al.valor / v - 1) * 100, chegou = al.tipo === "abaixo" ? v <= al.valor : v >= al.valor, ch = A.chanceAlvo(A.risco(al.metal), dist);
          return `<tr><td>${P.metais[al.metal].nome}</td><td>${al.tipo === "abaixo" ? "abaixo de" : "acima de"} ${rs(al.valor)}</td><td class="n">${rs(v)}</td><td class="n">${chegou ? '<span class="selo meu">chegou</span>' : pct(dist)}</td><td class="n">${chegou ? "–" : nf(ch) + "%"}</td><td class="n"><button class="btn peq" data-del="${i}">Apagar</button></td></tr>`; }).join("") || '<tr><td colspan="6" class="mut">Nenhum preço vigiado ainda.</td></tr>'}
        </table></div></div>

      <h2>Avisos neste aparelho</h2>
      <div class="card"><div class="linha entre"><div style="flex:1;min-width:240px"><h3>${permissao === "granted" ? "Avisos ligados" : "Receber um aviso quando algo mudar"}</h3>
        <p class="mut peq">${permissao === "granted" ? "Quando o coletor trouxer um aviso novo importante ou o seu preço-alvo chegar, este aparelho mostra uma notificação. Hoje ela sai com a torre aberta ou em segundo plano; com o aplicativo fechado, ainda está em construção."
          : permissao === "denied" ? "Os avisos estão bloqueados neste navegador. Libere nas configurações do site para receber."
          : permissao === "indisponivel" ? "Este navegador não mostra avisos. No celular, instale a torre na tela inicial (menu do navegador › Adicionar à tela inicial)."
          : "A torre mostra uma notificação no celular ou no computador quando o seu preço-alvo chegar ou quando aparecer um aviso importante nos seus metais."}</p></div>
        ${permissao === "default" ? '<button class="btn acc" id="rAvisos">Ligar avisos</button>' : permissao === "granted" ? '<button class="btn" id="rTeste">Mandar um aviso de teste</button>' : ""}</div></div>

      <h2>Como a torre decide</h2>
      <div class="grade g2">
        <div class="card"><h3>Termômetro do ano (0 a 100)</h3><p class="mut">Onde o preço em R$ de hoje está entre os dias dos últimos 12 meses: 0 é o dia mais barato, 100 o mais caro. Abaixo de 15 ou acima de 85, entra no Radar.</p></div>
        <div class="card"><h3>Por que a torre não manda comprar</h3>${T ? `<p class="mut">Testamos 15 anos dos 6 metais da LME. Com o termômetro em cada faixa, o preço em R$ estava mais alto 30 dias depois em:</p>
          <div class="rolar"><table class="peq"><tr><th>Termômetro</th><th class="n">${T[0].de} a ${T[0].ate}</th><th class="n">${T[1].de} em diante</th></tr>
          ${A.NIVEIS.map(n => `<tr><td>${n[2]}</td><td class="n">${nf(T[0].faixas[n[1]].subiu)}%</td><td class="n">${nf(T[1].faixas[n[1]].subiu)}%</td></tr>`).join("")}</table></div>
          <p class="mut peq">Até 2019, comprar barato no ano dava vantagem. De 2020 para cá virou o contrário. A torre mostra onde o preço está e ajuda a reduzir o risco; a hora de comprar segue com você.</p>`
          : '<p class="mut">O termômetro diz onde o preço está, não para onde vai.</p>'}</div>
        <div class="card"><h3>Compra em lotes</h3><p class="mut">Comprar tudo num dia só deixa o custo nas mãos daquele dia. Pela história de cada metal, a torre mostra quanto um dia isolado e 4 lotes semanais costumam ficar longe da média do mês. O plano está no Simulador.</p></div>
        <div class="card"><h3>Câmbio e preço-alvo</h3><p class="mut">Cada metal mostra quanto do sobe-e-desce em R$ veio do dólar: quanto maior, mais travar o câmbio com o banco protege. O preço-alvo usa o mínimo e o máximo de cada mês da história para dar a chance de chegar em 30 dias.</p></div>
      </div>`;
    ligaCliques(m);
    m.querySelectorAll("[data-f]").forEach(b => b.onclick = () => ir("radar", { filtro: b.dataset.f }));
    const mostraChance = () => {
      const k = $("#aMetal").value, v = A.ultimo(A.serie(k)).brl, alvo = +$("#aValor").value, tipo = $("#aTipo").value;
      if (!alvo) { $("#aChance").innerHTML = ""; return; }
      const dist = (alvo / v - 1) * 100, ja = tipo === "abaixo" ? alvo >= v : alvo <= v, ch = A.chanceAlvo(A.risco(k), dist);
      $("#aChance").innerHTML = ja ? "Esse preço já está valendo hoje." :
        `Hoje: ${rs(v)}/t. O alvo fica a <b>${pct(dist)}</b>. Pela história ${fonteRisco(k)}, o preço encostou num ponto assim em <b>${nf(ch)}%</b> dos meses: chance ${chanceTxt(ch)} em 30 dias.`;
    };
    const sugere = () => { $("#aValor").value = Math.round(A.ultimo(A.serie($("#aMetal").value)).brl * ($("#aTipo").value === "abaixo" ? .95 : 1.05) / 100) * 100; mostraChance(); };
    $("#aMetal").onchange = sugere; $("#aTipo").onchange = sugere; $("#aValor").oninput = mostraChance; sugere();
    $("#aAdd").onclick = () => {
      const valor = +$("#aValor").value;
      if (!valor) { window.Balao.recusa("Preencha o preço que você quer vigiar."); return; }
      const l = meusPrecos(); l.push({ metal: $("#aMetal").value, tipo: $("#aTipo").value, valor }); LS.set("tm_alertas", l); ir("radar");
    };
    m.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { const l = meusPrecos(); l.splice(+b.dataset.del, 1); LS.set("tm_alertas", l); window.Balao.desfez(); ir("radar"); });
    const bA = $("#rAvisos"); if (bA) bA.onclick = async () => { await Notification.requestPermission(); LS.set("tm_avisados", []); avisar(); ir("radar"); };
    const bT = $("#rTeste"); if (bT) bT.onclick = () => notifica({ id: "teste", titulo: "Torre de Controle - " + C.EMPRESA, acao: "Avisos ligados. Você vai receber os avisos novos aqui." });
  }

  // ---------- avisos (Notification) ----------
  function notifica(i) {
    try {
      const n = new Notification(i.titulo, { body: i.acao, icon: "icone.svg", badge: "icone.svg", tag: i.id });
      n.onclick = () => { window.focus(); i.metal ? ir("metal", { metal: i.metal }) : ir("radar"); n.close(); };
    } catch (e) { /* alguns celulares só avisam pelo service worker */ }
  }
  function avisar() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const ja = LS.get("tm_avisados", []), novos = radarHoje().filter(i => i.forca >= 60 && !ja.includes(i.id));
    novos.slice(0, 3).forEach(notifica);
    if (novos.length > 3) notifica({ id: "varios", titulo: `Mais ${novos.length - 3} avisos no Radar`, acao: "Abra a torre para ver todos." });
    LS.set("tm_avisados", ja.concat(novos.map(i => i.id)).slice(-300));
  }

  // ---------- Metal ----------
  function cor(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  function telaMetal(m) {
    const k = estado.metal, r = A.resumo(k), t = r.termo, a = A.serie(k), d = r.dec, p = perfil(), R = A.risco(k), pd = A.parteDolar(k);
    const campo = estado.moeda, fmt = campo === "brl" ? rs : us;
    const ano = A.janela(a, 365).map(x => x[campo]);
    const p25 = A.quantil(ano, .25), p75 = A.quantil(ano, .75), mn = Math.min(...ano), mx = Math.max(...ano);
    const tm = P.metais[k], PER = [[90, "3m"], [180, "6m"], [365, "1 ano"], [730, "2 anos"]];
    const v = r.h.brl, alvoSug = Math.round(v * (p.papel === "venda" ? 1.05 : .95) / 100) * 100;
    m.innerHTML = `<div class="chips-rolam">${ORDEM.map(x => `<button class="chip ${x === k ? "ativo" : ""}" data-m="${x}">${nomeCurto(x)}</button>`).join("")}</div>
      <div class="cabeca"><div><h1>${r.nome}</h1><p class="sub">${tm.bolsa} · fechamento de ${dataBR(r.h.data)}</p></div></div>
      <div class="grade g2">
        <div class="card">${termometro(t, p.papel)}<div class="evid">${textoHistoria(k, t)}</div></div>
        <div class="card"><div class="sobrelinha">Preço hoje</div><div class="big num" style="margin-top:6px">${rs(v)} <span class="peq mut">/t</span></div>
          <div class="mut peq">${us(r.h.usd)} /t · dólar ${rs(r.h.dolar, 4)}</div>
          <div class="rolar"><table class="peq" style="margin-top:10px"><tr><th></th><th class="n">Dia</th><th class="n">7 dias</th><th class="n">30 dias</th><th class="n">12 meses</th></tr>
            <tr><td>R$/t</td><td class="n">${pct(r.v1)}</td><td class="n">${pct(r.v7)}</td><td class="n">${pct(r.v30)}</td><td class="n">${pct(r.v365)}</td></tr></table></div></div>
      </div>
      <div class="grade g2" style="margin-top:16px">
        <div class="card"><div class="sobrelinha">Risco dos próximos 30 dias</div>
          <p style="margin-top:8px">Pela história ${fonteRisco(k)}, em 30 dias o preço em R$ ficou entre <b>${pct(R.r30[0])}</b> e <b>${pct(R.r30[2])}</b> em 8 de cada 10 meses. Hoje isso seria de <b class="num">${rs(v * (1 + R.r30[0] / 100))}</b> a <b class="num">${rs(v * (1 + R.r30[2] / 100))}</b>/t.</p>
          <ul class="sinais"><li><span class="s neutro">1</span><span>Comprando tudo num dia só, em 1 de cada 10 meses o preço daquele dia ficou mais de <b>${nf(R.umDiaP90, 1)}%</b> longe da média do mês.</span></li>
          <li><span class="s baixa">4</span><span>Em 4 lotes semanais, esse desvio caiu para <b>${nf(R.lotesP90, 1)}%</b>.</span></li></ul>
          <button class="btn peq" style="margin-top:10px" onclick="TM.ir('simulador')">Montar plano de lotes →</button></div>
        <div class="card"><div class="sobrelinha">Câmbio</div>
          <p style="margin-top:8px">Nos últimos 12 meses, <b>${pd}%</b> do sobe-e-desce do preço em R$ veio do dólar. ${pd >= 30 ? "É uma parte grande: travar o câmbio com o banco (contrato a termo) protege boa parte do custo." : "O risco maior está no próprio metal: travar só o câmbio protege pouco."}</p>
          <ul class="sinais"><li><span class="s neutro">M</span><span>Variação de 30 dias por causa do metal (em US$): <b class="num">${sinal(d.efeitoMetal)}${rs(Math.abs(d.efeitoMetal))}</b>/t</span></li>
          <li><span class="s neutro">$</span><span>Por causa do dólar (de ${rs(d.antes.dolar, 2)} para ${rs(r.h.dolar, 2)}): <b class="num">${sinal(d.efeitoDolar)}${rs(Math.abs(d.efeitoDolar))}</b>/t</span></li></ul></div>
        <div class="card"><div class="sobrelinha">Preço-alvo</div>
          <div class="form" style="margin-top:10px"><label class="campo">${p.papel === "venda" ? "Quero vender acima de (R$/t)" : "Quero comprar abaixo de (R$/t)"}<input id="mAlvo" type="number" step="100" inputmode="numeric" value="${alvoSug}"></label>
            <button class="btn pri" id="mVigiar">Vigiar este preço</button></div><div class="evid" id="mChance"></div></div>
        <div class="card"><div class="sobrelinha">O que o mercado está dizendo</div><ul class="sinais">${t.sinais.map(s => `<li><span class="s ${s.t}">${s.t === "alta" ? "↑" : s.t === "baixa" ? "↓" : "–"}</span><span>${s.txt}</span></li>`).join("")}
          <li><span class="s neutro">$</span><span>Dólar ${t.pctDolar >= 65 ? "caro" : t.pctDolar < 35 ? "barato" : "no meio da faixa"} no ano: acima de ${nf(t.pctDolar)}% dos dias.</span></li></ul>
          <p class="mut mini" style="margin:8px 0 0">Contexto para a negociação. Nenhum desses sinais, sozinho, prevê o preço.</p></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="linha entre" style="margin-bottom:12px"><h3>Preço em ${campo === "brl" ? "R$" : "US$"} por tonelada</h3>
        <div class="linha"><div class="seg">${PER.map(([n, l]) => `<button data-per="${n}" class="${estado.periodo == n ? "ativo" : ""}">${l}</button>`).join("")}</div>
        <div class="seg"><button data-moeda="brl" class="${campo === "brl" ? "ativo" : ""}">R$</button><button data-moeda="usd" class="${campo === "usd" ? "ativo" : ""}">US$</button></div></div></div>
        <div class="graf"><canvas id="gPreco"></canvas></div>
        <p class="mut mini" style="margin:8px 0 0">Faixa sombreada: onde o preço ficou na metade dos dias do último ano (${fmt(p25)} a ${fmt(p75)}). Mínimo ${fmt(mn)}, máximo ${fmt(mx)}.</p></div>
      <div class="grade g2" style="margin-top:16px">
        <div class="card"><h3>Termômetro ao longo do tempo</h3><p class="mut peq" style="margin:4px 0 10px">Abaixo de 15 e acima de 85, o metal entra no Radar.</p><div class="graf medio"><canvas id="gTermo"></canvas></div></div>
        ${tm.tem3m ? `<div class="card"><h3>Estoque nos armazéns da LME (t)</h3><p class="mut peq" style="margin:4px 0 10px">Estoque caindo costuma sustentar o preço; subindo, pesa contra.</p><div class="graf medio"><canvas id="gEst"></canvas></div></div>` : ""}
      </div>`;
    m.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { LS.set("tm_metal", b.dataset.m); ir("metal", { metal: b.dataset.m }); });
    m.querySelectorAll("[data-per]").forEach(b => b.onclick = () => { LS.set("tm_periodo", +b.dataset.per); ir("metal", { periodo: +b.dataset.per }); });
    m.querySelectorAll("[data-moeda]").forEach(b => b.onclick = () => { LS.set("tm_moeda", b.dataset.moeda); ir("metal", { moeda: b.dataset.moeda }); });
    const ativo = m.querySelector(".chips-rolam .chip.ativo"); if (ativo) ativo.parentNode.scrollLeft = ativo.offsetLeft - 16;
    const tipoAlvo = p.papel === "venda" ? "acima" : "abaixo";
    const chance = () => { const alvo = +$("#mAlvo").value; if (!alvo) { $("#mChance").innerHTML = ""; return; }
      const dist = (alvo / v - 1) * 100, ja = tipoAlvo === "abaixo" ? alvo >= v : alvo <= v, ch = A.chanceAlvo(R, dist);
      $("#mChance").innerHTML = ja ? "Esse preço já está valendo hoje." : `O alvo fica a <b>${pct(dist)}</b> de hoje. Pela história ${fonteRisco(k)}, o preço encostou num ponto assim em <b>${nf(ch)}%</b> dos meses: chance ${chanceTxt(ch)} em 30 dias.`; };
    $("#mAlvo").oninput = chance; chance();
    $("#mVigiar").onclick = () => { const valor = +$("#mAlvo").value; if (!valor) { window.Balao.recusa("Preencha o preço-alvo."); return; }
      const l = meusPrecos(); l.push({ metal: k, tipo: tipoAlvo, valor }); LS.set("tm_alertas", l); ir("radar", { filtro: "tudo" }); };

    const mm = A.mediaMovel(a, 60, campo);
    const ini = a.length - A.janela(a, estado.periodo).length;
    const pts = a.slice(ini), mmv = mm.slice(ini), lab = pts.map(x => dataCurta(x.data) + "/" + x.data.slice(2, 4));
    graficos.push(new Chart($("#gPreco"), {
      type: "line",
      data: { labels: lab, datasets: [
        { label: "Preço", data: pts.map(x => x[campo]), borderColor: cor("--ink"), borderWidth: 2, pointRadius: 0, tension: .15 },
        { label: "Média de 3 meses", data: mmv, borderColor: cor("--acc"), borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0 },
        { label: "Faixa do ano (topo)", data: pts.map(() => p75), borderColor: "transparent", pointRadius: 0, fill: "+1", backgroundColor: "rgba(94,110,126,.09)" },
        { label: "Faixa do ano (base)", data: pts.map(() => p25), borderColor: "transparent", pointRadius: 0 },
      ] },
      options: opcoesGrafico(fmt),
    }));
    const ht = A.historicoTermo(k, Math.max(estado.periodo, 365));
    graficos.push(new Chart($("#gTermo"), {
      type: "line",
      data: { labels: ht.map(x => dataCurta(x.data) + "/" + x.data.slice(2, 4)), datasets: [
        { label: "Termômetro", data: ht.map(x => x.pct), borderColor: cor("--ink"), borderWidth: 1.6, pointRadius: 0, tension: .2 },
        { label: "Linha de 85 (base)", data: ht.map(() => 85), borderColor: cor("--venda"), borderWidth: 1, borderDash: [3, 3], pointRadius: 0 },
        { label: "Linha de 15 (base)", data: ht.map(() => 15), borderColor: cor("--compra"), borderWidth: 1, borderDash: [3, 3], pointRadius: 0 },
      ] },
      options: { ...opcoesGrafico(x => nf(x)), scales: { ...opcoesGrafico().scales, y: { min: 0, max: 100, ticks: { color: cor("--mut"), stepSize: 25 }, grid: { color: cor("--lin2") } } } },
    }));
    if (tm.tem3m) graficos.push(new Chart($("#gEst"), {
      type: "line", data: { labels: lab, datasets: [{ label: "Estoque LME", data: pts.map(x => x.estoque), borderColor: cor("--aten"), borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: "rgba(178,106,0,.07)" }] },
      options: opcoesGrafico(x => nf(x) + " t"),
    }));
  }

  function opcoesGrafico(fmt) {
    return { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: cor("--mut"), filter: i => !i.text.includes("(base)"), boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { family: "Inter", size: 12 } } },
        tooltip: { backgroundColor: "#0B1F33", padding: 10, titleFont: { family: "Inter" }, bodyFont: { family: "Inter" },
          callbacks: { label: c => /Faixa|Linha/.test(c.dataset.label) ? null : `${c.dataset.label}: ${fmt(c.parsed.y)}` } } },
      scales: { x: { ticks: { color: cor("--mut"), maxTicksLimit: innerWidth < 600 ? 4 : 7, maxRotation: 0, font: { family: "Inter", size: 11 } }, grid: { display: false } },
        y: { ticks: { color: cor("--mut"), callback: v => nf(v), font: { family: "Inter", size: 11 } }, grid: { color: cor("--lin2") }, border: { display: false } } } };
  }

  // ---------- Dólar ----------
  function telaDolar(m) {
    const d = A.resumoDolar(), a = A.janela(d.serie, estado.periodo), R = A.risco("dolar");
    const PER = [[90, "3m"], [180, "6m"], [365, "1 ano"], [730, "2 anos"]];
    m.innerHTML = `<div class="cabeca"><div><h1>Dólar</h1><p class="sub">PTAX de venda do Banco Central. É o dólar usado para converter todas as cotações em R$.</p></div></div>
      <div class="grade g2">
        <div class="card"><div class="sobrelinha">PTAX de ${dataBR(d.h.data)}</div><div class="big num" style="margin-top:6px">${rs(d.h.brl, 4)}</div>
          <div class="vars linha mut peq" style="margin:6px 0 12px;gap:16px"><span>Dia <b class="num">${pct(d.v1)}</b></span><span>7 dias <b class="num">${pct(d.v7)}</b></span><span>30 dias <b class="num">${pct(d.v30)}</b></span><span>12 meses <b class="num">${pct(d.v365)}</b></span></div>
          ${barraAno(d.pctAno, `mín. do ano ${rs(d.min, 2)}`, `máx. ${rs(d.max, 2)}`)}</div>
        <div class="card"><div class="sobrelinha">O que isso quer dizer</div>
          <p>${d.pctAno >= 65 ? "O dólar está <b>caro</b> no ano: acima de " + nf(d.pctAno) + "% dos dias. Quem compra metal em dólar paga mais em R$; quem recebe em dólar ganha." : d.pctAno < 35 ? "O dólar está <b>barato</b> no ano: abaixo de " + nf(100 - d.pctAno) + "% dos dias." : "O dólar está <b>no meio da faixa</b> do ano."}</p>
          <p class="mut peq">Pela história ${fonteRisco("dolar")}, em 30 dias o dólar ficou entre ${pct(R.r30[0])} e ${pct(R.r30[2])} em 8 de cada 10 meses: hoje, de ${rs(d.h.brl * (1 + R.r30[0] / 100), 2)} a ${rs(d.h.brl * (1 + R.r30[2] / 100), 2)}. Quem tem pagamento grande em dólar à frente pode travar o câmbio com o banco (contrato a termo) e tirar esse risco do custo.</p></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="linha entre" style="margin-bottom:12px"><h3>PTAX</h3><div class="seg">${PER.map(([n, l]) => `<button data-per="${n}" class="${estado.periodo == n ? "ativo" : ""}">${l}</button>`).join("")}</div></div>
        <div class="graf"><canvas id="gDol"></canvas></div></div>
      <h2>O peso do dólar em cada metal</h2>
      <div class="card rolar"><table><tr><th>Metal</th><th class="n">Parte do risco que vem do dólar (12 meses)</th><th class="n">Variação 30 dias em R$/t</th><th class="n">Por causa do metal</th><th class="n">Por causa do dólar</th></tr>
      ${ORDEM.map(k => { const r = A.resumo(k), x = r.dec; return `<tr class="clicavel" data-metal="${k}" style="cursor:pointer"><td>${r.nome}</td><td class="n">${A.parteDolar(k)}%</td><td class="n">${sinal(x.total)}${rs(Math.abs(x.total))}</td><td class="n">${sinal(x.efeitoMetal)}${rs(Math.abs(x.efeitoMetal))}</td><td class="n">${sinal(x.efeitoDolar)}${rs(Math.abs(x.efeitoDolar))}</td></tr>`; }).join("")}
      </table><p class="mut peq">Quando o dólar sobe, o metal em US$ muitas vezes cai e compensa em parte. Por isso o peso do dólar pode ser pequeno mesmo num mês de dólar forte.</p></div>`;
    ligaCliques(m);
    m.querySelectorAll("[data-per]").forEach(b => b.onclick = () => { LS.set("tm_periodo", +b.dataset.per); ir("dolar", { periodo: +b.dataset.per }); });
    graficos.push(new Chart($("#gDol"), { type: "line",
      data: { labels: a.map(x => dataCurta(x.data) + "/" + x.data.slice(2, 4)), datasets: [{ label: "Dólar PTAX", data: a.map(x => x.brl), borderColor: cor("--ink"), borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: "rgba(224,123,46,.07)" }] },
      options: opcoesGrafico(x => rs(x, 4)) }));
  }

  // ---------- Simulador ----------
  function telaSimulador(m) {
    const s = LS.get("tm_sim", { metal: "aluminio", ton: 25, forma: "premio", premio: 350, pct: 80 });
    m.innerHTML = `<div class="cabeca"><div><h1>Simulador de compra</h1><p class="sub">Quanto custa a sua compra hoje, quanto ela pode variar em 30 dias e como fica em 4 lotes semanais.</p></div></div>
      <div class="card"><div class="form">
        <label class="campo">Metal<select id="sMetal">${ORDEM.map(x => `<option value="${x}" ${x === s.metal ? "selected" : ""}>${P.metais[x].nome}</option>`).join("")}</select></label>
        <label class="campo">Toneladas no mês<input id="sTon" type="number" min="0" step="0.5" inputmode="decimal" value="${s.ton}"></label>
        <label class="campo">Como o seu preço é formado<select id="sForma"><option value="premio" ${s.forma === "premio" ? "selected" : ""}>Bolsa + prêmio (US$/t)</option><option value="pct" ${s.forma === "pct" ? "selected" : ""}>% da bolsa (sucata)</option></select></label>
        <label class="campo" id="lPremio">Prêmio (US$/t)<input id="sPremio" type="number" step="10" inputmode="numeric" value="${s.premio}"></label>
        <label class="campo" id="lPct">% da bolsa<input id="sPct" type="number" step="1" inputmode="numeric" value="${s.pct}"></label>
      </div></div><div id="sRes"></div>`;
    const calc = () => {
      const v = { metal: $("#sMetal").value, ton: +$("#sTon").value || 0, forma: $("#sForma").value, premio: +$("#sPremio").value || 0, pct: +$("#sPct").value || 0 };
      LS.set("tm_sim", v);
      $("#lPremio").style.display = v.forma === "premio" ? "" : "none"; $("#lPct").style.display = v.forma === "pct" ? "" : "none";
      const a = A.serie(v.metal), t = A.resumo(v.metal).termo, R = A.risco(v.metal), pd = A.parteDolar(v.metal);
      const custo = x => (v.forma === "premio" ? (x.usd + v.premio) : x.usd * v.pct / 100) * x.dolar * v.ton;
      const h = A.ultimo(a), ano = A.janela(a, 365), tri = A.janela(a, 90);
      const hoje = custo(h), m90 = A.media(tri.map(custo));
      const cs = ano.map(x => ({ x, c: custo(x) })).sort((p1, p2) => p1.c - p2.c), melhor = cs[0], pior = cs[cs.length - 1];
      const dol5 = hoje * 1.05, dif = hoje - m90, lote = v.ton / 4;
      const semanas = [0, 7, 14, 21].map(dd => dataBR(A.isoMais(new Date().toISOString().slice(0, 10), dd)));
      $("#sRes").innerHTML = `<div class="grade g2" style="margin-top:16px">
        <div class="card"><div class="sobrelinha">Custo da compra hoje</div><div class="big num" style="margin-top:6px">${rs(hoje)}</div><div class="mut peq">${rs(v.ton ? hoje / v.ton : 0)} por tonelada · dólar ${rs(h.dolar, 4)}</div>
          <div style="margin-top:14px">${termometro(t, "compra", true)}</div>
          <ul class="sinais" style="margin-top:8px">
            <li><span class="s neutro">≈</span><span>Contra a média de 3 meses: <b class="num">${sinal(dif)}${rs(Math.abs(dif))}</b> ${dif >= 0 ? "(hoje está mais caro)" : "(hoje está mais barato)"}</span></li>
            <li><span class="s baixa">↓</span><span>Melhor dia do ano, ${dataBR(melhor.x.data)}: <b class="num">${rs(melhor.c)}</b></span></li>
            <li><span class="s alta">↑</span><span>Pior dia do ano, ${dataBR(pior.x.data)}: <b class="num">${rs(pior.c)}</b></span></li></ul></div>
        <div class="card"><div class="sobrelinha">Se deixar para daqui a 30 dias</div>
          <p style="margin-top:8px">Pela história ${fonteRisco(v.metal)}, em 8 de cada 10 meses a mesma compra ficaria entre <b class="num">${rs(hoje * (1 + R.r30[0] / 100))}</b> e <b class="num">${rs(hoje * (1 + R.r30[2] / 100))}</b> (${pct(R.r30[0])} a ${pct(R.r30[2])}).</p>
          <div class="sobrelinha" style="margin-top:16px">Plano em 4 lotes semanais</div>
          <div class="rolar"><table class="peq" style="margin-top:6px"><tr><th>Semana</th><th class="n">Toneladas</th><th class="n">Custo pelo preço de hoje</th></tr>
            ${semanas.map((dt, i) => `<tr><td>${i + 1}ª · ${dt}</td><td class="n">${nf(lote, 1)} t</td><td class="n">${rs(hoje / 4)}</td></tr>`).join("")}</table></div>
          <p class="peq" style="margin:10px 0 0">Comprando tudo num dia só, em 1 de cada 10 meses o preço ficou mais de <b>${nf(R.umDiaP90, 1)}%</b> longe da média do mês (${rs(hoje * R.umDiaP90 / 100)} nesta compra). Em 4 lotes, até <b>${nf(R.lotesP90, 1)}%</b> (${rs(hoje * R.lotesP90 / 100)}). O lote não garante preço menor: tira a dependência de um dia de sorte ou de azar.</p></div>
        <div class="card"><div class="sobrelinha">Câmbio</div>
          <p style="margin-top:8px">Se o dólar subir 5% antes de fechar, a compra vai para <b class="num">${rs(dol5)}</b> (+${rs(dol5 - hoje)}).</p>
          <p class="mut peq">Nos últimos 12 meses, ${pd}% do sobe-e-desce deste metal em R$ veio do dólar. ${pd >= 30 ? "Para uma compra deste tamanho, vale cotar com o banco um contrato a termo para travar o câmbio." : "O risco maior está no metal; travar só o câmbio protege pouco."}</p></div>
      </div>
        <p class="mut mini">O cálculo usa o fechamento da bolsa e o dólar PTAX de cada dia. Frete, impostos e condições de pagamento ficam de fora. Faixas e desvios são o que aconteceu no passado, não garantia.</p>`;
    };
    m.querySelectorAll("input,select").forEach(el => el.oninput = calc); calc();
  }

  window.TM = { ir, get tela() { return estado.tela; } };
  menu();
  const inicio = LS.get("tm_tela", "hoje");
  ir(LS.get("tm_visitou", false) ? (inicio === "sugestoes" ? "hoje" : inicio) : "sobre");
  avisar();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { avisar(); contadorRadar(); } });
})();
