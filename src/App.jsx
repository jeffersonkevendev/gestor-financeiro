import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, Wallet, CreditCard, ArrowRight, FileDown } from "lucide-react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Guarda o estado no localStorage do navegador quando disponível.
// Em ambientes sem acesso (ex: prévia sandboxed do Claude) cai de volta pro comportamento normal em memória.
function useLocalStorageState(chave, valorInicial) {
  const [valor, setValor] = useState(() => {
    try {
      const salvo = window.localStorage.getItem(chave);
      return salvo !== null ? JSON.parse(salvo) : valorInicial;
    } catch {
      return valorInicial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      // sem acesso a localStorage neste ambiente — os dados continuam funcionando só em memória
    }
  }, [chave, valor]);

  return [valor, setValor];
}


const COR = {
  papel: "#F3EFE2",
  papelEscuro: "#E8E1CC",
  tinta: "#1C2333",
  tintaSuave: "#4A5164",
  linha: "#D3C9AE",
  ouro: "#B8891F",
  ouroClaro: "#E3B565",
  roxo: "#820AD1",
  roxoClaro: "#F1E1FB",
  americanas: "#C81032",
  americanasClaro: "#F8D9DF",
  vermelho: "#A83232",
};

const fmt = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(v) ? v : 0
  );

const chaveDoMes = (dataStr) => (dataStr ? dataStr.slice(0, 7) : "");

const rotuloDoMes = (chave) => {
  if (!chave) return "Sem data";
  const [ano, mes] = chave.split("-");
  return `${MESES[parseInt(mes, 10) - 1]} de ${ano}`;
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ehJefferson = (nome) => (nome || "").trim().toLowerCase() === "jefferson";

const totalJeffersonEmMes = (comprasPorMesObj, chave) =>
  (comprasPorMesObj[chave] || []).filter((c) => ehJefferson(c.nome)).reduce((s, c) => s + c.valor, 0);

const mesAtualChave = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Preenche todos os meses entre o mais antigo e o mais recente (incluindo o mês atual), sem buracos.
const preencherIntervaloMeses = (chaves) => {
  const todas = [...new Set([...chaves, mesAtualChave()])];
  const datas = todas.map((c) => {
    const [a, m] = c.split("-").map(Number);
    return new Date(a, m - 1, 1);
  });
  const min = new Date(Math.min(...datas));
  const max = new Date(Math.max(...datas));
  const resultado = [];
  const cursor = new Date(min);
  while (cursor <= max) {
    resultado.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return resultado;
};

// Carrossel horizontal de meses, no estilo fatura (rolagem lateral, mês ativo em destaque)
function CarrosselMeses({ meses, mesSelecionado, onSelecionar, corAtiva }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 carrossel-meses" style={{ scrollbarWidth: "none" }}>
      {meses.map((chave) => {
        const ativo = chave === mesSelecionado;
        const [, m] = chave.split("-");
        const rotuloCurto = MESES[parseInt(m, 10) - 1].slice(0, 3);
        return (
          <button
            key={chave}
            onClick={() => onSelecionar(chave)}
            className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{
              background: ativo ? corAtiva : COR.papelEscuro,
              color: ativo ? "white" : COR.tintaSuave,
            }}
          >
            {rotuloCurto}
          </button>
        );
      })}
    </div>
  );
}

// -------- campos reutilizáveis --------
function Campo({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs w-full" style={{ color: COR.tintaSuave }}>
      <span className="uppercase tracking-wide font-semibold leading-tight min-h-[32px] flex items-end">{label}</span>
      {children}
    </label>
  );
}

const inputBase =
  "box-border h-10 px-2.5 rounded-md border bg-white outline-none text-sm focus:ring-2";

export default function MeuCaixaApp() {
  const [aba, setAba] = useLocalStorageState("meu-caixa:aba-ativa", "despesas");
  const abas = ["despesas", "cartao", "americanas"];
  const indiceAba = abas.indexOf(aba);

  // ---------- gesto de deslizar entre abas ----------
  const [arraste, setArraste] = useState(0);
  const arrastandoRef = useRef(false);
  const ignorarGestoRef = useRef(false);
  const inicioRef = useRef({ x: 0, y: 0 });

  const aoTocarInicio = (e) => {
    ignorarGestoRef.current = !!e.target.closest(".carrossel-meses, input, select, textarea");
    if (ignorarGestoRef.current) return;
    arrastandoRef.current = true;
    inicioRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const aoTocarMover = (e) => {
    if (!arrastandoRef.current || ignorarGestoRef.current) return;
    const dx = e.touches[0].clientX - inicioRef.current.x;
    const dy = e.touches[0].clientY - inicioRef.current.y;
    if (Math.abs(dy) > Math.abs(dx)) return; // gesto vertical, deixa a página rolar
    let deslocamento = dx;
    if (indiceAba === 0 && dx > 0) deslocamento = dx / 3; // resistência na primeira aba
    if (indiceAba === abas.length - 1 && dx < 0) deslocamento = dx / 3; // resistência na última
    setArraste(deslocamento);
  };

  const aoTocarFim = () => {
    if (!arrastandoRef.current) return;
    arrastandoRef.current = false;
    const LIMITE = 60;
    if (arraste < -LIMITE && indiceAba < abas.length - 1) setAba(abas[indiceAba + 1]);
    else if (arraste > LIMITE && indiceAba > 0) setAba(abas[indiceAba - 1]);
    setArraste(0);
  };

  // ---------- despesas ----------
  const [despesas, setDespesas] = useLocalStorageState("meu-caixa:despesas", []);
  const [novaDespesa, setNovaDespesa] = useState({ descricao: "", valor: "", vencimento: "" });
  const [mostrarFormDespesa, setMostrarFormDespesa] = useState(false);
  const [editandoDespesaId, setEditandoDespesaId] = useState(null);
  const [rascunhoDespesa, setRascunhoDespesa] = useState(null);

  // ---------- cartão nubank ----------
  const [compras, setCompras] = useLocalStorageState("meu-caixa:compras-nubank", []);
  const [novaCompra, setNovaCompra] = useState({ nome: "", compra: "", valor: "", data: "" });
  const [mostrarFormCompra, setMostrarFormCompra] = useState(false);
  const [editandoCompraId, setEditandoCompraId] = useState(null);
  const [rascunhoCompra, setRascunhoCompra] = useState(null);

  // ---------- cartão americanas ----------
  const [comprasAmericanas, setComprasAmericanas] = useLocalStorageState("meu-caixa:compras-americanas", []);
  const [novaCompraAmericanas, setNovaCompraAmericanas] = useState({ nome: "", compra: "", valor: "", data: "" });
  const [mostrarFormCompraAmericanas, setMostrarFormCompraAmericanas] = useState(false);
  const [editandoCompraAmericanasId, setEditandoCompraAmericanasId] = useState(null);
  const [rascunhoCompraAmericanas, setRascunhoCompraAmericanas] = useState(null);

  // ---------- agrupamentos ----------
  const despesasPorMes = useMemo(() => {
    const grupos = {};
    for (const d of despesas) {
      const chave = chaveDoMes(d.vencimento);
      (grupos[chave] ||= []).push(d);
    }
    return grupos;
  }, [despesas]);

  const comprasPorMes = useMemo(() => {
    const grupos = {};
    for (const c of compras) {
      const chave = chaveDoMes(c.data);
      (grupos[chave] ||= []).push(c);
    }
    return grupos;
  }, [compras]);

  const comprasAmericanasPorMes = useMemo(() => {
    const grupos = {};
    for (const c of comprasAmericanas) {
      const chave = chaveDoMes(c.data);
      (grupos[chave] ||= []).push(c);
    }
    return grupos;
  }, [comprasAmericanas]);

  const totalJeffersonPorMes = (chave) => totalJeffersonEmMes(comprasPorMes, chave);
  const totalJeffersonAmericanasPorMes = (chave) => totalJeffersonEmMes(comprasAmericanasPorMes, chave);

  const chavesDespesas = useMemo(() => {
    const chaves = new Set(Object.keys(despesasPorMes));
    for (const chave of Object.keys(comprasPorMes)) {
      if (totalJeffersonPorMes(chave) > 0) chaves.add(chave);
    }
    for (const chave of Object.keys(comprasAmericanasPorMes)) {
      if (totalJeffersonAmericanasPorMes(chave) > 0) chaves.add(chave);
    }
    return [...chaves].sort();
  }, [despesasPorMes, comprasPorMes, comprasAmericanasPorMes]);

  const totalGeralDespesas = chavesDespesas.reduce((soma, chave) => {
    const linhas = despesasPorMes[chave] || [];
    return soma + linhas.reduce((s, d) => s + d.valor, 0) + totalJeffersonPorMes(chave) + totalJeffersonAmericanasPorMes(chave);
  }, 0);

  // ---------- ações despesas ----------
  const adicionarDespesa = () => {
    const valor = parseFloat(novaDespesa.valor);
    if (!novaDespesa.descricao.trim() || !novaDespesa.vencimento || !(valor > 0)) return;
    setDespesas((prev) => [
      ...prev,
      { id: uid(), descricao: novaDespesa.descricao.trim(), valor, vencimento: novaDespesa.vencimento },
    ]);
    setNovaDespesa({ descricao: "", valor: "", vencimento: "" });
    setMostrarFormDespesa(false);
  };

  const iniciarEdicaoDespesa = (d) => {
    setEditandoDespesaId(d.id);
    setRascunhoDespesa({ ...d, valor: String(d.valor) });
  };

  const salvarEdicaoDespesa = () => {
    const valor = parseFloat(rascunhoDespesa.valor);
    if (!rascunhoDespesa.descricao.trim() || !rascunhoDespesa.vencimento || !(valor > 0)) return;
    setDespesas((prev) =>
      prev.map((d) =>
        d.id === editandoDespesaId
          ? { ...d, descricao: rascunhoDespesa.descricao.trim(), valor, vencimento: rascunhoDespesa.vencimento }
          : d
      )
    );
    setEditandoDespesaId(null);
    setRascunhoDespesa(null);
  };

  const excluirDespesa = (id) => setDespesas((prev) => prev.filter((d) => d.id !== id));

  // ---------- ações cartão ----------
  const adicionarCompra = () => {
    const valor = parseFloat(novaCompra.valor);
    if (!novaCompra.nome.trim() || !novaCompra.compra.trim() || !novaCompra.data || !(valor > 0)) return;
    setCompras((prev) => [
      ...prev,
      { id: uid(), nome: novaCompra.nome.trim(), compra: novaCompra.compra.trim(), valor, data: novaCompra.data },
    ]);
    setNovaCompra({ nome: "", compra: "", valor: "", data: "" });
    setMostrarFormCompra(false);
  };

  const iniciarEdicaoCompra = (c) => {
    setEditandoCompraId(c.id);
    setRascunhoCompra({ ...c, valor: String(c.valor) });
  };

  const salvarEdicaoCompra = () => {
    const valor = parseFloat(rascunhoCompra.valor);
    if (!rascunhoCompra.nome.trim() || !rascunhoCompra.compra.trim() || !rascunhoCompra.data || !(valor > 0)) return;
    setCompras((prev) =>
      prev.map((c) =>
        c.id === editandoCompraId
          ? { ...c, nome: rascunhoCompra.nome.trim(), compra: rascunhoCompra.compra.trim(), valor, data: rascunhoCompra.data }
          : c
      )
    );
    setEditandoCompraId(null);
    setRascunhoCompra(null);
  };

  const excluirCompra = (id) => setCompras((prev) => prev.filter((c) => c.id !== id));

  // ---------- ações cartão americanas ----------
  const adicionarCompraAmericanas = () => {
    const valor = parseFloat(novaCompraAmericanas.valor);
    if (!novaCompraAmericanas.nome.trim() || !novaCompraAmericanas.compra.trim() || !novaCompraAmericanas.data || !(valor > 0)) return;
    setComprasAmericanas((prev) => [
      ...prev,
      { id: uid(), nome: novaCompraAmericanas.nome.trim(), compra: novaCompraAmericanas.compra.trim(), valor, data: novaCompraAmericanas.data },
    ]);
    setNovaCompraAmericanas({ nome: "", compra: "", valor: "", data: "" });
    setMostrarFormCompraAmericanas(false);
  };

  const iniciarEdicaoCompraAmericanas = (c) => {
    setEditandoCompraAmericanasId(c.id);
    setRascunhoCompraAmericanas({ ...c, valor: String(c.valor) });
  };

  const salvarEdicaoCompraAmericanas = () => {
    const valor = parseFloat(rascunhoCompraAmericanas.valor);
    if (!rascunhoCompraAmericanas.nome.trim() || !rascunhoCompraAmericanas.compra.trim() || !rascunhoCompraAmericanas.data || !(valor > 0)) return;
    setComprasAmericanas((prev) =>
      prev.map((c) =>
        c.id === editandoCompraAmericanasId
          ? { ...c, nome: rascunhoCompraAmericanas.nome.trim(), compra: rascunhoCompraAmericanas.compra.trim(), valor, data: rascunhoCompraAmericanas.data }
          : c
      )
    );
    setEditandoCompraAmericanasId(null);
    setRascunhoCompraAmericanas(null);
  };

  const excluirCompraAmericanas = (id) => setComprasAmericanas((prev) => prev.filter((c) => c.id !== id));

  // ---------- relatório em PDF (compartilhado entre os cartões, para não duplicar na impressão) ----------
  const [relatorio, setRelatorio] = useState(null);

  const gerarRelatorio = (dados) => {
    setRelatorio(dados);
    setTimeout(() => {
      const tituloAnterior = document.title;
      const slug = dados.nomeCartao.replace(/\s+/g, "-");
      document.title = `Relatorio-${slug}-${dados.pessoaFiltro === "todos" ? "todos" : dados.pessoaFiltro}-${dados.mesSelecionado}`;
      window.print();
      setTimeout(() => { document.title = tituloAnterior; }, 500);
    }, 50);
  };

  const acento = aba === "despesas" ? COR.ouro : aba === "cartao" ? COR.roxo : COR.americanas;
  const acentoClaro = aba === "despesas" ? COR.ouroClaro : aba === "cartao" ? COR.roxoClaro : COR.americanasClaro;

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: COR.papel, color: COR.tinta, fontFamily: "'Inter', ui-sans-serif, system-ui" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .fonte-display { font-family: 'Fraunces', serif; }
        .fonte-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        input:focus, select:focus { border-color: ${acento} !important; box-shadow: 0 0 0 2px ${acentoClaro}; }
        .relatorio-impressao { display: none; }
        @media print {
          .oculta-impressao { display: none !important; }
          .relatorio-impressao { display: block !important; }
        }
      `}</style>

      {/* cabeçalho */}
      <header style={{ background: COR.tinta }} className="px-5 pt-7 pb-0 oculta-impressao">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: COR.ouro }}
            >
              <Wallet size={18} color={COR.tinta} strokeWidth={2.5} />
            </div>
            <h1 className="fonte-display text-2xl" style={{ color: COR.papel }}>
              Meu Caixa
            </h1>
          </div>

          <nav className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {[
              { id: "despesas", label: "Despesas", icon: Wallet },
              { id: "cartao", label: "Cartão Nubank", icon: CreditCard },
              { id: "americanas", label: "Cartão Americanas", icon: CreditCard },
            ].map(({ id, label, icon: Icon }) => {
              const ativo = aba === id;
              return (
                <button
                  key={id}
                  onClick={() => setAba(id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors shrink-0 whitespace-nowrap"
                  style={{
                    background: ativo ? COR.papel : "transparent",
                    color: ativo ? COR.tinta : "#9AA1B4",
                  }}
                >
                  <Icon size={15} />
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main
        className="overflow-hidden"
        style={{ touchAction: "pan-y" }}
        onTouchStart={aoTocarInicio}
        onTouchMove={aoTocarMover}
        onTouchEnd={aoTocarFim}
      >
        <div
          className="flex w-full"
          style={{
            transform: `translateX(calc(${-indiceAba * 100}% + ${arraste}px))`,
            transition: arrastandoRef.current ? "none" : "transform 0.25s ease",
          }}
        >
          <div className="max-w-2xl mx-auto px-5 py-6 w-full shrink-0 oculta-impressao">
            <DespesasTab
              chaves={chavesDespesas}
              despesasPorMes={despesasPorMes}
              fontesCartao={[
                { label: "Cartão Nubank", totalPorMes: totalJeffersonPorMes, cor: COR.roxo, corClara: COR.roxoClaro },
                { label: "Cartão Americanas", totalPorMes: totalJeffersonAmericanasPorMes, cor: COR.americanas, corClara: COR.americanasClaro },
              ]}
              mostrarForm={mostrarFormDespesa}
              setMostrarForm={setMostrarFormDespesa}
              nova={novaDespesa}
              setNova={setNovaDespesa}
              adicionar={adicionarDespesa}
              editandoId={editandoDespesaId}
              rascunho={rascunhoDespesa}
              setRascunho={setRascunhoDespesa}
              iniciarEdicao={iniciarEdicaoDespesa}
              salvarEdicao={salvarEdicaoDespesa}
              cancelarEdicao={() => { setEditandoDespesaId(null); setRascunhoDespesa(null); }}
              excluir={excluirDespesa}
            />
          </div>
          <div className="max-w-2xl mx-auto px-5 py-6 w-full shrink-0">
            <CartaoTab
              nomeCartao="Cartão Nubank"
              corPrincipal={COR.roxo}
              corClara={COR.roxoClaro}
              compras={compras}
              onGerarPdf={gerarRelatorio}
              mostrarForm={mostrarFormCompra}
              setMostrarForm={setMostrarFormCompra}
              nova={novaCompra}
              setNova={setNovaCompra}
              adicionar={adicionarCompra}
              editandoId={editandoCompraId}
              rascunho={rascunhoCompra}
              setRascunho={setRascunhoCompra}
              iniciarEdicao={iniciarEdicaoCompra}
              salvarEdicao={salvarEdicaoCompra}
              cancelarEdicao={() => { setEditandoCompraId(null); setRascunhoCompra(null); }}
              excluir={excluirCompra}
            />
          </div>
          <div className="max-w-2xl mx-auto px-5 py-6 w-full shrink-0">
            <CartaoTab
              nomeCartao="Cartão Americanas"
              corPrincipal={COR.americanas}
              corClara={COR.americanasClaro}
              compras={comprasAmericanas}
              onGerarPdf={gerarRelatorio}
              mostrarForm={mostrarFormCompraAmericanas}
              setMostrarForm={setMostrarFormCompraAmericanas}
              nova={novaCompraAmericanas}
              setNova={setNovaCompraAmericanas}
              adicionar={adicionarCompraAmericanas}
              editandoId={editandoCompraAmericanasId}
              rascunho={rascunhoCompraAmericanas}
              setRascunho={setRascunhoCompraAmericanas}
              iniciarEdicao={iniciarEdicaoCompraAmericanas}
              salvarEdicao={salvarEdicaoCompraAmericanas}
              cancelarEdicao={() => { setEditandoCompraAmericanasId(null); setRascunhoCompraAmericanas(null); }}
              excluir={excluirCompraAmericanas}
            />
          </div>
        </div>
      </main>

      {/* área exclusiva de impressão / PDF — única para qualquer cartão, evita duplicar relatórios */}
      {relatorio && (
        <div className="relatorio-impressao" style={{ color: "#111", fontFamily: "'Inter', ui-sans-serif" }}>
          <h1 className="fonte-display" style={{ fontSize: "22px", marginBottom: 2 }}>
            Relatório de compras — {relatorio.nomeCartao}
          </h1>
          <p style={{ fontSize: "12px", color: "#555", marginBottom: 4 }}>
            {relatorio.pessoaFiltro === "todos" ? "Todas as pessoas" : relatorio.pessoaFiltro} · {rotuloDoMes(relatorio.mesSelecionado)}
          </p>
          <p style={{ fontSize: "11px", color: "#777", marginBottom: 16 }}>
            Gerado em {new Date().toLocaleDateString("pt-BR")}
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#555" }}>
                {relatorio.pessoaFiltro === "todos" && <th style={{ padding: "3px 0" }}>Pessoa</th>}
                <th style={{ padding: "3px 0" }}>Compra</th>
                <th style={{ padding: "3px 0" }}>Data</th>
                <th style={{ padding: "3px 0", textAlign: "right" }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.linhas.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid #eee" }}>
                  {relatorio.pessoaFiltro === "todos" && <td style={{ padding: "3px 0" }}>{c.nome}</td>}
                  <td style={{ padding: "3px 0" }}>{c.compra}</td>
                  <td style={{ padding: "3px 0" }}>{new Date(c.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td style={{ padding: "3px 0", textAlign: "right" }} className="fonte-mono">{fmt(c.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: "2px solid #111", paddingTop: 8, marginTop: 12, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700 }}>Total do mês</span>
            <span style={{ fontWeight: 700 }} className="fonte-mono">{fmt(relatorio.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== ABA DESPESAS =====================
function DespesasTab(props) {
  const {
    chaves, despesasPorMes, fontesCartao,
    mostrarForm, setMostrarForm, nova, setNova, adicionar,
    editandoId, rascunho, setRascunho, iniciarEdicao, salvarEdicao, cancelarEdicao, excluir,
  } = props;

  const [mesSelecionado, setMesSelecionado] = useState(mesAtualChave());
  const meses = useMemo(() => preencherIntervaloMeses(chaves), [chaves]);

  const linhas = despesasPorMes[mesSelecionado] || [];
  const totaisCartoes = fontesCartao.map((f) => ({ ...f, total: f.totalPorMes(mesSelecionado) }));
  const somaCartoes = totaisCartoes.reduce((s, f) => s + f.total, 0);
  const totalMes = linhas.reduce((s, d) => s + d.valor, 0) + somaCartoes;

  const handleAdicionar = () => {
    const chave = chaveDoMes(nova.vencimento);
    adicionar();
    if (chave) setMesSelecionado(chave);
  };

  return (
    <div className="flex flex-col gap-6">
      <CarrosselMeses meses={meses} mesSelecionado={mesSelecionado} onSelecionar={setMesSelecionado} corAtiva={COR.ouro} />

      {/* fita de total - elemento assinatura */}
      <div
        className="relative rounded-md px-5 py-4"
        style={{
          background: COR.tinta,
          backgroundImage:
            `repeating-linear-gradient(90deg, transparent, transparent 7px, ${COR.papel}22 7px, ${COR.papel}22 8px)`,
        }}
      >
        <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: COR.ouroClaro }}>
          Total de despesas — {rotuloDoMes(mesSelecionado)}
        </p>
        <p className="fonte-mono text-3xl font-bold mt-1" style={{ color: COR.papel }}>
          {fmt(totalMes)}
        </p>
      </div>

      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold border-2 border-dashed transition-colors"
        style={{ borderColor: COR.ouro, color: COR.ouro }}
      >
        <Plus size={16} /> Adicionar despesa
      </button>

      {mostrarForm && (
        <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: "white", border: `1px solid ${COR.linha}` }}>
          <Campo label="Descrição">
            <input
              className={inputBase}
              style={{ borderColor: COR.linha }}
              placeholder="Ex: Aluguel, luz, internet..."
              value={nova.descricao}
              onChange={(e) => setNova({ ...nova, descricao: e.target.value })}
            />
          </Campo>
          <Campo label="Valor (R$)">
            <input
              className={inputBase}
              style={{ borderColor: COR.linha }}
              type="number" step="0.01" min="0" placeholder="0,00"
              value={nova.valor}
              onChange={(e) => setNova({ ...nova, valor: e.target.value })}
            />
          </Campo>
          <Campo label="Vencimento">
            <input
              className={inputBase}
              style={{ borderColor: COR.linha }}
              type="date"
              value={nova.vencimento}
              onChange={(e) => setNova({ ...nova, vencimento: e.target.value })}
            />
          </Campo>
          <div className="flex gap-2 justify-end mt-1">
            <button onClick={() => setMostrarForm(false)} className="px-3 py-1.5 text-sm rounded-md" style={{ color: COR.tintaSuave }}>
              Cancelar
            </button>
            <button
              onClick={handleAdicionar}
              className="px-3 py-1.5 text-sm font-semibold rounded-md text-white"
              style={{ background: COR.ouro }}
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {linhas.length === 0 && somaCartoes === 0 && !mostrarForm && (
        <p className="text-sm text-center py-8" style={{ color: COR.tintaSuave }}>
          Nenhuma despesa em {rotuloDoMes(mesSelecionado)} ainda.
        </p>
      )}

      {(linhas.length > 0 || somaCartoes > 0) && (
        <div className="rounded-lg overflow-hidden" style={{ background: "white", border: `1px solid ${COR.linha}` }}>
          {linhas.map((d, i) => (
            <div key={d.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${COR.linha}` }}>
              {editandoId === d.id ? (
                <div className="p-3 flex flex-col gap-2" style={{ background: COR.papelEscuro }}>
                  <input
                    className={inputBase} style={{ borderColor: COR.linha }}
                    value={rascunho.descricao}
                    onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <input
                      className={inputBase + " flex-1"} style={{ borderColor: COR.linha }}
                      type="number" step="0.01" min="0"
                      value={rascunho.valor}
                      onChange={(e) => setRascunho({ ...rascunho, valor: e.target.value })}
                    />
                    <input
                      className={inputBase + " flex-1"} style={{ borderColor: COR.linha }}
                      type="date"
                      value={rascunho.vencimento}
                      onChange={(e) => setRascunho({ ...rascunho, vencimento: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelarEdicao} className="p-1.5 rounded-md" style={{ color: COR.tintaSuave }}><X size={16} /></button>
                    <button onClick={salvarEdicao} className="p-1.5 rounded-md text-white" style={{ background: COR.ouro }}><Check size={16} /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2.5 group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.descricao}</p>
                    <p className="text-xs" style={{ color: COR.tintaSuave }}>
                      Vence em {new Date(d.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="fonte-mono text-sm font-semibold">{fmt(d.valor)}</span>
                    <button onClick={() => iniciarEdicao(d)} style={{ color: COR.tintaSuave }}><Pencil size={14} /></button>
                    <button onClick={() => excluir(d.id)} style={{ color: COR.vermelho }}><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {totaisCartoes.filter((f) => f.total > 0).map((f, idx) => (
            <div
              key={f.label}
              className="flex items-center justify-between px-3 py-2.5"
              style={{ borderTop: (linhas.length || idx > 0) ? `1px solid ${COR.linha}` : "none", background: f.corClara }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <ArrowRight size={13} color={f.cor} />
                <p className="text-sm font-medium truncate" style={{ color: f.cor }}>
                  {f.label} — Jefferson
                </p>
              </div>
              <span className="fonte-mono text-sm font-semibold" style={{ color: f.cor }}>{fmt(f.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== ABA DE CARTÃO (reutilizada por Nubank e Americanas) =====================
function CartaoTab(props) {
  const {
    nomeCartao, corPrincipal, corClara, compras, onGerarPdf,
    mostrarForm, setMostrarForm, nova, setNova, adicionar,
    editandoId, rascunho, setRascunho, iniciarEdicao, salvarEdicao, cancelarEdicao, excluir,
  } = props;

  const [pessoaFiltro, setPessoaFiltro] = useState("todos");
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualChave());

  const nomesUnicos = useMemo(
    () => [...new Set(compras.map((c) => c.nome))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [compras]
  );

  const comprasFiltradas = useMemo(
    () => (pessoaFiltro === "todos" ? compras : compras.filter((c) => c.nome === pessoaFiltro)),
    [compras, pessoaFiltro]
  );

  const comprasPorMes = useMemo(() => {
    const grupos = {};
    for (const c of comprasFiltradas) {
      const chave = chaveDoMes(c.data);
      (grupos[chave] ||= []).push(c);
    }
    return grupos;
  }, [comprasFiltradas]);

  const meses = useMemo(() => preencherIntervaloMeses(Object.keys(comprasPorMes)), [comprasPorMes]);
  const linhasMes = comprasPorMes[mesSelecionado] || [];
  const totalMes = linhasMes.reduce((s, c) => s + c.valor, 0);

  const handleAdicionar = () => {
    const chave = chaveDoMes(nova.data);
    adicionar();
    if (chave) setMesSelecionado(chave);
  };

  const gerarRelatorioPdf = () => {
    onGerarPdf({
      nomeCartao,
      pessoaFiltro,
      mesSelecionado,
      linhas: linhasMes,
      total: totalMes,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 oculta-impressao">
        <div className="flex-1">
          <Campo label="Filtrar por pessoa">
            <select
              className={inputBase + " w-full"}
              style={{ borderColor: COR.linha }}
              value={pessoaFiltro}
              onChange={(e) => setPessoaFiltro(e.target.value)}
            >
              <option value="todos">Todas as pessoas</option>
              {nomesUnicos.map((nome) => (
                <option key={nome} value={nome}>{nome}</option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="flex items-end">
          <button
            onClick={gerarRelatorioPdf}
            disabled={linhasMes.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: COR.tinta }}
            title={pessoaFiltro === "todos" ? "Gera o relatório do mês selecionado" : `Gera o relatório de ${pessoaFiltro} no mês selecionado`}
          >
            <FileDown size={15} /> Gerar PDF
          </button>
        </div>
      </div>

      <CarrosselMeses meses={meses} mesSelecionado={mesSelecionado} onSelecionar={setMesSelecionado} corAtiva={corPrincipal} />

      <div className="rounded-md px-5 py-4 oculta-impressao" style={{ background: corPrincipal }}>
        <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: corClara }}>
          {pessoaFiltro === "todos" ? `Total no ${nomeCartao}` : `Total de ${pessoaFiltro}`} — {rotuloDoMes(mesSelecionado)}
        </p>
        <p className="fonte-mono text-3xl font-bold mt-1 text-white">{fmt(totalMes)}</p>
      </div>

      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold border-2 border-dashed oculta-impressao"
        style={{ borderColor: corPrincipal, color: corPrincipal }}
      >
        <Plus size={16} /> Adicionar compra
      </button>

      {mostrarForm && (
        <div className="rounded-lg p-4 flex flex-col gap-3 oculta-impressao" style={{ background: "white", border: `1px solid ${COR.linha}` }}>
          <Campo label="Nome de quem comprou">
            <input
              className={inputBase} style={{ borderColor: COR.linha }}
              placeholder="Ex: Jefferson"
              value={nova.nome}
              onChange={(e) => setNova({ ...nova, nome: e.target.value })}
            />
          </Campo>
          <Campo label="Data da compra">
            <input
              className={inputBase} style={{ borderColor: COR.linha }}
              type="date"
              value={nova.data}
              onChange={(e) => setNova({ ...nova, data: e.target.value })}
            />
          </Campo>
          <Campo label="Compra">
            <input
              className={inputBase} style={{ borderColor: COR.linha }}
              placeholder="Ex: Supermercado, farmácia..."
              value={nova.compra}
              onChange={(e) => setNova({ ...nova, compra: e.target.value })}
            />
          </Campo>
          <Campo label="Valor (R$)">
            <input
              className={inputBase} style={{ borderColor: COR.linha }}
              type="number" step="0.01" min="0" placeholder="0,00"
              value={nova.valor}
              onChange={(e) => setNova({ ...nova, valor: e.target.value })}
            />
          </Campo>
          <div className="flex gap-2 justify-end mt-1">
            <button onClick={() => setMostrarForm(false)} className="px-3 py-1.5 text-sm rounded-md" style={{ color: COR.tintaSuave }}>
              Cancelar
            </button>
            <button onClick={handleAdicionar} className="px-3 py-1.5 text-sm font-semibold rounded-md text-white" style={{ background: corPrincipal }}>
              Salvar
            </button>
          </div>
        </div>
      )}

      {linhasMes.length === 0 && !mostrarForm && (
        <p className="text-sm text-center py-8 oculta-impressao" style={{ color: COR.tintaSuave }}>
          Nenhuma compra {pessoaFiltro === "todos" ? "" : `de ${pessoaFiltro} `}em {rotuloDoMes(mesSelecionado)}.
        </p>
      )}

      {linhasMes.length > 0 && (
        <div className="rounded-lg overflow-hidden oculta-impressao" style={{ background: "white", border: `1px solid ${COR.linha}` }}>
          {linhasMes.map((c, i) => (
            <div key={c.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${COR.linha}` }}>
              {editandoId === c.id ? (
                <div className="p-3 flex flex-col gap-2" style={{ background: COR.papelEscuro }}>
                  <div className="flex gap-2">
                    <input
                      className={inputBase + " flex-1"} style={{ borderColor: COR.linha }}
                      value={rascunho.nome}
                      onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                    />
                    <input
                      className={inputBase + " flex-1"} style={{ borderColor: COR.linha }}
                      type="date"
                      value={rascunho.data}
                      onChange={(e) => setRascunho({ ...rascunho, data: e.target.value })}
                    />
                  </div>
                  <input
                    className={inputBase} style={{ borderColor: COR.linha }}
                    value={rascunho.compra}
                    onChange={(e) => setRascunho({ ...rascunho, compra: e.target.value })}
                  />
                  <input
                    className={inputBase} style={{ borderColor: COR.linha }}
                    type="number" step="0.01" min="0"
                    value={rascunho.valor}
                    onChange={(e) => setRascunho({ ...rascunho, valor: e.target.value })}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelarEdicao} className="p-1.5 rounded-md" style={{ color: COR.tintaSuave }}><X size={16} /></button>
                    <button onClick={salvarEdicao} className="p-1.5 rounded-md text-white" style={{ background: corPrincipal }}><Check size={16} /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="min-w-0 flex items-start gap-2">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                      style={{
                        background: ehJefferson(c.nome) ? corPrincipal : COR.papelEscuro,
                        color: ehJefferson(c.nome) ? "white" : COR.tintaSuave,
                      }}
                    >
                      {c.nome}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.compra}</p>
                      <p className="text-xs" style={{ color: COR.tintaSuave }}>
                        {new Date(c.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="fonte-mono text-sm font-semibold">{fmt(c.valor)}</span>
                    <button onClick={() => iniciarEdicao(c)} style={{ color: COR.tintaSuave }}><Pencil size={14} /></button>
                    <button onClick={() => excluir(c.id)} style={{ color: COR.vermelho }}><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
