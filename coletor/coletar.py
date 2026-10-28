"""Coletor de preços da Torre de Controle - Metais.

Lê fontes públicas gratuitas (com atraso de 1 dia) e grava data/precos.js para o site:
  - LME (London Metal Exchange), cash e 3 meses, mais estoque: tabela pública da Westmetall
  - Dólar PTAX de venda: Banco Central do Brasil (SGS, série 1)
  - Minério de ferro 62% Fe (CME, TIO=F) e aço bobina a quente EUA (CME, HRC=F): Yahoo Finance

Uso:  python coletor/coletar.py            (de dentro da pasta torre-metais)
Roda todo dia útil (GitHub Actions ou tarefa agendada). Atenção: para vender o produto, as cotações da LME
precisam de licença de redistribuição (LME ou distribuidor licenciado). Ver PENDENCIAS.md.
"""
import datetime as dt, json, re, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "precos.js"
UA = {"User-Agent": "Mozilla/5.0 (TorreMetais coletor)"}
HOJE = dt.date.today()
ANOS = [HOJE.year - 2, HOJE.year - 1, HOJE.year]

LME = {  # chave: (campo Westmetall, nome)
    "aluminio": ("LME_Al_cash", "Alumínio"),
    "cobre": ("LME_Cu_cash", "Cobre"),
    "zinco": ("LME_Zn_cash", "Zinco"),
    "niquel": ("LME_Ni_cash", "Níquel"),
    "chumbo": ("LME_Pb_cash", "Chumbo"),
    "estanho": ("LME_Sn_cash", "Estanho"),
}
CME = {  # chave: (símbolo Yahoo, nome, fator para US$/t métrica, bolsa)
    "minerio": ("TIO=F", "Minério de ferro 62%", 1.0, "CME / SGX (referência China)"),
    "aco": ("HRC=F", "Aço bobina a quente (EUA)", 1 / 0.90718474, "CME (Midwest EUA)"),
}
MESES = {m: i + 1 for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July",
                                          "August", "September", "October", "November", "December"])}


def baixa(url, tentativas=3):
    for i in range(tentativas):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            if i == tentativas - 1:
                raise
            time.sleep(3 * (i + 1))


def num(s):
    s = s.strip().replace(",", "")
    return float(s) if s and s not in ("-", "–") else None


def westmetall(campo):
    linhas = {}
    for ano in ANOS:
        html = baixa(f"https://www.westmetall.com/en/markdaten.php?action=table&field={campo}&year={ano}")
        for d, cash, m3, est in re.findall(
                r"<tr>\s*<td[^>]*>(\d{1,2}\. \w+ \d{4})</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>", html):
            dia, mes, a = d.replace(".", "").split()
            data = dt.date(int(a), MESES[mes], int(dia)).isoformat()
            linhas[data] = [num(cash), num(m3), num(est)]
        time.sleep(1)
    return dict(sorted(linhas.items()))


def ptax():
    ini = dt.date(ANOS[0], 1, 1).strftime("%d/%m/%Y")
    fim = HOJE.strftime("%d/%m/%Y")
    js = json.loads(baixa(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json&dataInicial={ini}&dataFinal={fim}"))
    return {dt.datetime.strptime(x["data"], "%d/%m/%Y").date().isoformat(): float(x["valor"]) for x in js}


def yahoo(simbolo, fator):
    js = json.loads(baixa(f"https://query1.finance.yahoo.com/v8/finance/chart/{simbolo}?range=3y&interval=1d"))
    r = js["chart"]["result"][0]
    fech = r["indicators"]["quote"][0]["close"]
    out = {}
    for t, c in zip(r["timestamp"], fech):
        if c is not None:
            d = dt.datetime.fromtimestamp(t, dt.timezone.utc).date()
            if d.year >= ANOS[0]:
                out[d.isoformat()] = [round(c * fator, 2), None, None]
    return out


def main():
    falhas, metais = [], {}
    try:
        dolar = ptax()
    except Exception as e:
        print("FALHA dólar PTAX:", e); sys.exit(1)
    for k, (campo, nome) in LME.items():
        try:
            metais[k] = {"nome": nome, "bolsa": "LME (Londres)", "unidade": "US$/t", "tem3m": True, "serie": westmetall(campo)}
        except Exception as e:
            falhas.append(f"{nome}: {e}")
    for k, (sim, nome, fator, bolsa) in CME.items():
        try:
            metais[k] = {"nome": nome, "bolsa": bolsa, "unidade": "US$/t", "tem3m": False, "serie": yahoo(sim, fator)}
        except Exception as e:
            falhas.append(f"{nome}: {e}")
    if "aluminio" not in metais:
        print("FALHA: alumínio não coletado, mantendo o arquivo anterior."); sys.exit(1)
    agora = dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).isoformat(timespec="minutes")
    dados = {"coletadoEm": agora, "dolar": dict(sorted(dolar.items())), "metais": metais, "falhas": falhas,
             "fontes": "LME via Westmetall (1 dia de atraso) · PTAX Banco Central · CME via Yahoo Finance"}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("/* Gerado por coletor/coletar.py em %s. Não editar à mão. */\nwindow.__PRECOS = %s;\n"
                   % (agora, json.dumps(dados, ensure_ascii=False, separators=(",", ":"))), encoding="utf-8")
    n = {k: len(v["serie"]) for k, v in metais.items()}
    print("OK", agora, "dólar:", len(dolar), "dias;", n, "falhas:", falhas or "nenhuma")


if __name__ == "__main__":
    main()
