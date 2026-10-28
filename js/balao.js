/* Escuta de quem usa (padrão Capacity Case): balão 💬, aba Sugestões com retorno, registro de uso e faixa de versão nova.
   Banco: Supabase do cliente (tabelas tm_sugestoes e tm_uso_eventos, ver supabase/schema.sql). Sem SUPABASE_URL no config,
   tudo fica guardado neste aparelho e é enviado quando o banco for ligado. */
(function () {
  const C = window.CONFIG, $ = s => document.querySelector(s);
  const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
               set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const usuario = () => LS.get("tm_email", "") || "visitante";
  const ehLuiz = () => C.EMAILS_LUIZ.includes(usuario().toLowerCase());
  const temBanco = !!(C.SUPABASE_URL && C.SUPABASE_ANON);

  async function api(caminho, corpo, metodo = "POST") {
    const r = await fetch(C.SUPABASE_URL + "/rest/v1/" + caminho, { method: metodo,
      headers: { apikey: C.SUPABASE_ANON, Authorization: "Bearer " + (LS.get("tm_token", "") || C.SUPABASE_ANON), "Content-Type": "application/json", Prefer: "return=representation" },
      body: corpo ? JSON.stringify(corpo) : undefined });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  // ---------- registro de uso (lote a cada 15 s) ----------
  const fila = [], ultimos = [];
  const limpa = s => String(s || "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/\d{3,}/g, "[n]").slice(0, 160);
  function evento(tipo, dados = {}) {
    const e = { tipo, tela: dados.tela || (window.TM && TM.tela) || "", alvo: limpa(dados.alvo), motivo: dados.motivo || "", em: new Date().toISOString(), autor_email: usuario() };
    fila.push(e); ultimos.push(e); if (ultimos.length > 20) ultimos.shift();
    if (tipo === "tela") detectaVolta(e.tela);
  }
  setInterval(async () => {
    if (!fila.length) return;
    const lote = fila.splice(0);
    if (temBanco) { try { await api("tm_uso_eventos", lote); } catch (e) { fila.unshift(...lote); } }
    else { const g = LS.get("tm_uso_local", []); LS.set("tm_uso_local", g.concat(lote).slice(-500)); }
  }, 15000);
  addEventListener("beforeunload", () => evento("saida"));
  addEventListener("error", e => { evento("erro", { alvo: e.message }); });

  // ---------- gatilhos do balão ----------
  let ultimaOferta = LS.get("tm_balao_oferta", 0), cliques = [];
  function podeOferecer() {
    return !ehLuiz() && Date.now() - ultimaOferta > 15 * 60 * 1000 && $("#modalBalao").style.display !== "flex" && !gravando;
  }
  function oferecer(motivo, pergunta) {
    if (!podeOferecer()) return;
    ultimaOferta = Date.now(); LS.set("tm_balao_oferta", ultimaOferta);
    const o = $("#balaoOferta");
    o.innerHTML = `<div style="margin-bottom:8px">${pergunta}</div><button class="btn pri" id="ofSim">Contar</button> <button class="btn" id="ofNao">Agora não</button>`;
    o.style.display = "block"; evento("balao", { motivo: "ofereceu:" + motivo });
    $("#ofSim").onclick = () => { o.style.display = "none"; abrir({ via: "automatico", motivo, pergunta }); };
    $("#ofNao").onclick = () => { o.style.display = "none"; evento("balao", { motivo: "recusou:" + motivo }); };
    setTimeout(() => { o.style.display = "none"; }, 20000);
  }
  document.addEventListener("click", e => {
    const alvo = e.target.closest("button,a,select,input,.card,[data-tela]");
    const nome = alvo ? (alvo.dataset.tela || alvo.id || alvo.textContent || alvo.tagName) : e.target.tagName;
    evento("clique", { alvo: nome });
    const agora = Date.now(); cliques = cliques.filter(c => agora - c.t < 1000 && Math.abs(c.x - e.clientX) < 30 && Math.abs(c.y - e.clientY) < 30);
    cliques.push({ t: agora, x: e.clientX, y: e.clientY });
    if (cliques.length >= 3) { cliques = []; evento("raiva", { alvo: nome }); oferecer("travou", "Parece que isso não respondeu como você esperava. Quer contar o que estava tentando fazer?"); }
  }, true);
  let historico = [];
  function detectaVolta(tela) {
    const agora = Date.now(); historico.push({ tela, t: agora }); historico = historico.slice(-3);
    if (historico.length === 3 && historico[0].tela === tela && historico[1].tela !== tela && agora - historico[0].t < 30000)
      oferecer("voltou", "Não achou o que procurava? Conta pra gente o que você queria ver.");
  }
  function recusa(msg) {
    evento("aviso", { alvo: msg });
    const d = document.createElement("div"); d.className = "aviso"; d.textContent = msg;
    const m = $("#conteudo"); m.prepend(d); setTimeout(() => d.remove(), 5000);
    oferecer("recusa", "O sistema recusou o que você fez. Quer contar o que estava tentando?");
  }
  function desfez() { oferecer("desfez", "Você acabou de apagar o que salvou. Algo não ficou como queria?"); }

  // ---------- caixa "Conta pra gente" ----------
  let tipoSel = "melhoria", anexos = [], audio = null, gravando = false, rec = null, mr = null, ctx = {};
  function montarModal() {
    const f = document.createElement("div"); f.className = "modal-fundo"; f.id = "modalBalao";
    f.innerHTML = `<div class="modal"><h3 style="margin:0">Conta pra gente 💬</h3><p class="mut peq" id="mbPergunta">O que você achou, o que não funcionou ou o que falta?</p>
      <div class="tipos">${[["melhoria", "Ideia de melhoria"], ["problema", "Algo não funciona"], ["duvida", "Dúvida"]].map(([v, l]) => `<button data-tipo="${v}">${l}</button>`).join("")}</div>
      <textarea id="mbTexto" placeholder="Escreva aqui, cole um print (Ctrl+V) ou use o microfone"></textarea>
      <div class="linha" style="margin-top:8px"><button class="btn" id="mbFalar">🎤 Falar</button><label class="btn">📸 Print<input id="mbArq" type="file" accept="image/*" multiple hidden></label><span class="mut peq" id="mbStatus"></span></div>
      <div class="anexos" id="mbAnexos"></div>
      <div class="linha" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="mbFechar">Cancelar</button><button class="btn pri" id="mbEnviar">Enviar</button></div></div>`;
    document.body.appendChild(f);
    f.querySelectorAll("[data-tipo]").forEach(b => b.onclick = () => { tipoSel = b.dataset.tipo; marcaTipo(); });
    $("#mbFechar").onclick = fechar; f.onclick = e => { if (e.target === f) fechar(); };
    $("#mbArq").onchange = e => [...e.target.files].forEach(addAnexo);
    $("#mbTexto").addEventListener("paste", e => [...(e.clipboardData || {}).files || []].forEach(addAnexo));
    f.addEventListener("dragover", e => e.preventDefault());
    f.addEventListener("drop", e => { e.preventDefault(); [...e.dataTransfer.files].forEach(addAnexo); });
    $("#mbFalar").onclick = alternaVoz; $("#mbEnviar").onclick = enviar;
  }
  const marcaTipo = () => document.querySelectorAll("#modalBalao [data-tipo]").forEach(b => b.classList.toggle("ativo", b.dataset.tipo === tipoSel));
  function addAnexo(file) {
    if (!file.type.startsWith("image/")) return;
    const r = new FileReader(); r.onload = () => { anexos.push(r.result); $("#mbAnexos").innerHTML = anexos.map(a => `<img src="${a}">`).join(""); }; r.readAsDataURL(file);
  }
  async function alternaVoz() {
    if (gravando) { rec && rec.stop(); mr && mr.state !== "inactive" && mr.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mr = new MediaRecorder(stream); const partes = [];
      mr.ondataavailable = e => partes.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); const fr = new FileReader(); fr.onload = () => audio = fr.result; fr.readAsDataURL(new Blob(partes, { type: "audio/webm" })); fimVoz(); };
      mr.start();
    } catch (e) { $("#mbStatus").textContent = "Sem acesso ao microfone."; }
    if (SR) {
      rec = new SR(); rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = false;
      const base = $("#mbTexto").value;
      let dito = "";
      rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) dito += e.results[i][0].transcript + " "; $("#mbTexto").value = (base + " " + dito).trim(); };
      rec.onend = () => { mr && mr.state !== "inactive" && mr.stop(); };
      rec.start();
    }
    gravando = true; $("#mbFalar").textContent = "⏹ Parar"; $("#mbStatus").textContent = "Ouvindo…";
  }
  function fimVoz() { gravando = false; $("#mbFalar").textContent = "🎤 Falar"; $("#mbStatus").textContent = audio || mr ? "Áudio gravado." : ""; }
  function abrir(c = {}) {
    if (!$("#modalBalao")) montarModal();
    ctx = c; tipoSel = c.motivo === "travou" || c.motivo === "recusa" ? "problema" : "melhoria"; anexos = []; audio = null;
    $("#mbTexto").value = ""; $("#mbAnexos").innerHTML = ""; $("#mbStatus").textContent = "";
    $("#mbPergunta").textContent = c.pergunta || "O que você achou, o que não funcionou ou o que falta?";
    marcaTipo(); $("#modalBalao").style.display = "flex"; evento("balao", { motivo: "abriu:" + (c.via || "botao") });
    setTimeout(() => $("#mbTexto").focus(), 50);
  }
  function fechar() { if (gravando) alternaVoz(); $("#modalBalao").style.display = "none"; evento("balao", { motivo: "fechou" }); }
  async function enviar() {
    const texto = $("#mbTexto").value.trim();
    if (!texto && !anexos.length && !audio) { $("#mbStatus").textContent = "Escreva, fale ou anexe algo antes de enviar."; return; }
    const s = { id: crypto.randomUUID(), autor_email: usuario(), tipo: tipoSel, texto, tela: (window.TM && TM.tela) || "", origem: audio ? "voz" : "texto",
      anexos, audio, status: "nova", resposta: null, historico: [], criada_em: new Date().toISOString(),
      contexto: { via: ctx.via || "botao", motivo: ctx.motivo || "", pergunta: ctx.pergunta || "", rota: location.hash, largura: innerWidth, ultimos: ultimos.slice(-20) } };
    try { if (temBanco) await api("tm_sugestoes", s); else { const l = LS.get("tm_sug_local", []); l.unshift(s); LS.set("tm_sug_local", l); } }
    catch (e) { $("#mbStatus").textContent = "Não consegui enviar agora. Tente de novo em instantes."; return; }
    evento("balao", { motivo: "enviou" });
    $("#modalBalao .modal").innerHTML = `<h3>Anotado! 🙌</h3><p class="mut">Obrigado. A resposta vai aparecer aqui mesmo, nesta tela, quando a gente tratar.</p><button class="btn pri" onclick="this.closest('.modal-fundo').remove()">Fechar</button>`;
    if (window.TM && TM.tela === "sugestoes") TM.ir("sugestoes");
  }

  // ---------- tela Sugestões ----------
  const STATUS = { nova: "Nova", em_analise: "Em análise", aprovada: "Aprovada", em_execucao: "Em execução", concluida: "Concluída", rejeitada: "Não vamos fazer", depois: "Mais adiante" };
  async function lista() {
    if (temBanco) return api("tm_sugestoes?select=*&order=criada_em.desc", null, "GET"); // a RLS já filtra: só as minhas, ou todas para o gestor
    return LS.get("tm_sug_local", []).filter(s => ehGestor() || s.autor_email === usuario());
  }
  const ehGestor = () => LS.get("tm_gestor", false) || ehLuiz();
  async function telaSugestoes(m) {
    const ls = await lista();
    m.innerHTML = `<h1>Sugestões</h1><p class="sub">Tudo o que você mandou pelo balão 💬 e o que já foi feito. Cada pessoa vê as próprias sugestões; o gestor vê todas.</p>
      ${temBanco ? "" : '<div class="aviso">Banco ainda não ligado: as sugestões ficam guardadas neste aparelho e sobem quando a empresa ativar o login.</div>'}
      <div class="card" style="margin-bottom:14px"><div class="linha"><label class="campo" style="flex:1;min-width:220px">Seu e-mail<input id="sgEmail" type="email" value="${usuario() === "visitante" ? "" : usuario()}" placeholder="voce@empresa.com.br"></label>
      <button class="btn pri" onclick="Balao.abrir({via:'aba'})">💬 Nova sugestão</button></div></div>
      <div class="grade g2">${ls.map(s => `<div class="card"><div class="linha" style="justify-content:space-between"><b>${{ melhoria: "💡 Ideia", problema: "🛠️ Não funciona", duvida: "❓ Dúvida" }[s.tipo] || s.tipo}</b><span class="selo ${s.status === "concluida" ? "bom" : s.status === "rejeitada" ? "ruim" : "medio"}">${STATUS[s.status]}</span></div>
        <div class="mut peq">${new Date(s.criada_em).toLocaleString("pt-BR")} · tela ${s.tela || "–"}${ehGestor() ? " · " + s.autor_email : ""}</div>
        <p>${(s.texto || "(sem texto)").replace(/</g, "&lt;")}</p>${(s.anexos || []).map(a => `<img src="${a}" style="max-width:100%;border-radius:8px">`).join("")}
        ${s.audio ? `<audio controls src="${s.audio}" style="width:100%"></audio>` : ""}
        ${s.resposta ? `<div class="retorno"><b>Resposta:</b> ${s.resposta}</div>` : ""}
        ${ehGestor() ? `<div class="linha"><select data-st="${s.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === s.status ? "selected" : ""}>${v}</option>`).join("")}</select><input data-resp="${s.id}" placeholder="Responder para quem sugeriu" style="flex:1;min-width:160px" value="${s.resposta || ""}"><button class="btn" data-salva="${s.id}">Salvar</button></div>` : ""}
      </div>`).join("") || '<div class="card mut">Nenhuma sugestão ainda. Use o 💬 no canto da tela.</div>'}</div>`;
    $("#sgEmail").onchange = e => { LS.set("tm_email", e.target.value.trim().toLowerCase()); TM.ir("sugestoes"); };
    m.querySelectorAll("[data-salva]").forEach(b => b.onclick = () => salvaStatus(b.dataset.salva, m.querySelector(`[data-st="${b.dataset.salva}"]`).value, m.querySelector(`[data-resp="${b.dataset.salva}"]`).value));
  }
  async function salvaStatus(id, status, resposta) {
    const nota = { quem: usuario(), quando: new Date().toISOString(), status, resposta };
    if (temBanco) await api("tm_sugestoes?id=eq." + id, { status, resposta, respondida_em: nota.quando, historico_add: nota }, "PATCH");
    else { const l = LS.get("tm_sug_local", []); const s = l.find(x => x.id === id); Object.assign(s, { status, resposta, respondida_em: nota.quando, lido_autor: false }); s.historico.push(nota); LS.set("tm_sug_local", l); }
    TM.ir("sugestoes");
  }

  // ---------- retorno na tela de origem ----------
  async function retornoNaTela(tela) {
    const ls = (await lista()).filter(s => s.autor_email === usuario() && s.resposta && !s.lido_autor);
    const cont = $("#contRetorno"); if (cont) { cont.hidden = !ls.length; cont.textContent = ls.length; }
    const aqui = ls.find(s => s.tela === tela); if (!aqui) return;
    const d = document.createElement("div"); d.className = "retorno";
    d.innerHTML = `<b>Sobre a sua sugestão nesta tela:</b> ${aqui.resposta} <span class="linha" style="margin-top:6px"><button class="btn" data-ok="1">Ficou bom</button><button class="btn" data-ok="0">Ainda não ficou</button></span>`;
    $("#conteudo").prepend(d);
    d.querySelectorAll("[data-ok]").forEach(b => b.onclick = async () => {
      const ok = b.dataset.ok === "1";
      if (temBanco) await api("tm_sugestoes?id=eq." + aqui.id, { lido_autor: true, avaliacao_autor: ok ? "ficou_bom" : "ainda_nao" }, "PATCH");
      else { const l = LS.get("tm_sug_local", []); Object.assign(l.find(x => x.id === aqui.id), { lido_autor: true, avaliacao_autor: ok ? "ficou_bom" : "ainda_nao", status: ok ? "concluida" : "em_analise" }); LS.set("tm_sug_local", l); }
      d.remove(); if (!ok) abrir({ via: "retorno", pergunta: "O que ainda não ficou bom?" });
    });
  }

  // ---------- faixa de versão nova (nunca recarrega sozinho) ----------
  async function verificarVersao() {
    try {
      const r = await fetch("versao.json?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) return;
      const { versao } = await r.json();
      if (versao && versao !== C.VERSAO) mostrarFaixa();
    } catch (e) {}
  }
  function mostrarFaixa() {
    const f = $("#faixaVersao");
    f.innerHTML = `<span>Saiu uma versão nova, com melhorias. Salve o que estiver fazendo e clique em Atualizar.</span><button id="btAtualizar">Atualizar</button>`;
    f.style.display = "flex"; $("#btAtualizar").onclick = () => { LS.set("tm_ver_vista", ""); location.reload(); };
  }
  function novidades() {
    const vista = LS.get("tm_ver_vista", null); LS.set("tm_ver_vista", C.VERSAO);
    if (vista === null || vista === C.VERSAO) return;
    const n = (window.NOVIDADES || []).find(x => x.versao === C.VERSAO); if (!n) return;
    const f = document.createElement("div"); f.className = "modal-fundo"; f.style.display = "flex";
    f.innerHTML = `<div class="modal"><h3>Novidades (${n.data})</h3><ul>${n.itens.map(i => `<li>${i}</li>`).join("")}</ul><button class="btn pri">Entendi</button></div>`;
    f.querySelector("button").onclick = () => f.remove(); document.body.appendChild(f);
  }
  setInterval(verificarVersao, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) verificarVersao(); });

  window.Balao = { abrir, evento, recusa, desfez, telaSugestoes, retornoNaTela, verificarVersao };
  const btn = document.createElement("button"); btn.id = "balaoBtn"; btn.title = "Conta pra gente"; btn.textContent = "💬"; btn.onclick = () => abrir({ via: "botao" });
  document.body.appendChild(btn);
  const of = document.createElement("div"); of.id = "balaoOferta"; document.body.appendChild(of);
  montarModal(); $("#modalBalao").style.display = "none";
  novidades(); verificarVersao();
})();
