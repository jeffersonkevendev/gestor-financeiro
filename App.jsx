import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus, Pencil, Trash2, Check, X, Wallet, CreditCard, ArrowRight, FileDown,
  CheckCircle2, Circle, Download,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

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
  verde: "#2E7D5B",
  verdeClaro: "#DCEEE3",
  vermelho: "#A83232",
};

const CATEGORIAS = ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Assinaturas", "Outros"];
const CORES_CATEGORIA = ["#B8891F", "#2E7D5B", "#2A6F97", "#A83232", "#7A4FB5", "#B5651D", "#4A5164", "#8A8F63"];
const corCategoria = (nome) => {
  const i = CATEGORIAS.indexOf(nome);
  return CORES_CATEGORIA[i >= 0 ? i : CORES_CATEGORIA.length - 1];
};

const PALETA_CARTOES = [
  { cor: "#820AD1", corClara: "#F1E1FB" },
  { cor: "#C81032", corClara: "#F8D9DF" },
  { cor: "#1F7A5C", corClara: "#D7F0E4" },
  { cor: "#B5651D", corClara: "#F5DFC4" },
  { cor: "#2A6F97", corClara: "#D6E9F5" },
  { cor: "#7A4FB5", corClara: "#E7DBF7" },
];
const corDoCartao = (indice) => PALETA_CARTOES[indice % PALETA_CARTOES.length];

const CARTOES_PADRAO = [
  { id: "nubank", nome: "Cartão Nubank", cor: PALETA_CARTOES[0].cor, corClara: PALETA_CARTOES[0].corClara, compras: [] },
  { id: "americanas", nome: "Cartão Americanas", cor: PALETA_CARTOES[1].cor, corClara: PALETA_CARTOES[1].corClara, compras: [] },
];

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

const ehPessoaAutomatica = (nome, lista) =>
  lista.some((p) => p.trim().toLowerCase() === (nome || "").trim().toLowerCase());

const totalAutomaticoEmMes = (comprasPorMesObj, chave, pessoas) =>
  (comprasPorMesObj[chave] || []).filter((c) => ehPessoaAutomatica(c.nome, pessoas)).reduce((s, c) => s + c.valor, 0);

const hojeISO = () => new Date().toISOString().slice(0, 10);

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

// Botão de excluir com confirmação em duas etapas (evita apagar sem querer)
function BotaoExcluirConfirmar({ onConfirmar }) {
  const [confirmando, setConfirmando] = useState(false);
  if (confirmando) {
    return (
      <span className="flex items-center gap-1.5">
        <button onClick={() => { onConfirmar(); setConfirmando(false); }} style={{ color: COR.vermelho }} title="Confirmar exclusão">
          <Check size={15} />
        </button>
        <button onClick={() => setConfirmando(false)} style={{ color: COR.tintaSuave }} title="Cancelar">
          <X size={15} />
        </button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirmando(true)} style={{ color: COR.vermelho }} title="Excluir">
      <Trash2 size={14} />
    </button>
  );
}

export default function MeuCaixaApp() {
  const [aba, setAba] = useLocalStorageState("meu-caixa:aba-ativa", "despesas");
  const [despesas, setDespesas] = useLocalStorageState("meu-caixa:despesas", []);
  const [cartoes, setCartoes] = useLocalStorageState("meu-caixa:cartoes", CARTOES_PADRAO);
  const [pessoasAutomaticas, setPessoasAutomaticas] = useLocalStorageState("meu-caixa:pessoas-automaticas", ["Jefferson"]);

  const abas = ["despesas", ...cartoes.map((c) => `cartao-${c.id}`)];
  const indiceAbaBruto = abas.indexOf(aba);
  const indiceAba = indiceAbaBruto === -1 ? 0 : indiceAbaBruto;

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
    if (Math.abs(dy) > Math.abs(dx)) return;
    let deslocamento = dx;
    if (indiceAba === 0 && dx > 0) deslocamento = dx / 3;
    if (indiceAba === abas.length - 1 && dx < 0) deslocamento = dx / 3;
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

  // ---------- cartões (dinâmicos) ----------
  const [mostrarAddCartao, setMostrarAddCartao] = useState(false);
  const [nomeNovoCartao, setNomeNovoCartao] = useState("");

  const adicionarCartao = () => {
    const nome = nomeNovoCartao.trim();
    if (!nome) return;
    const id = uid();
    const paleta = corDoCartao(cartoes.length);
    setCartoes((prev) => [...prev, { id, nome, cor: paleta.cor, corClara: paleta.corClara, compras: [] }]);
    setAba(`cartao-${id}`);
    setNomeNovoCartao("");
    setMostrarAddCartao(false);
  };

  const excluirCartao = (id) => {
    setCartoes((prev) => prev.filter((c) => c.id !== id));
    setAba((atual) => (atual === `cartao-${id}` ? "despesas" : atual));
  };

  // ---------- pessoas com soma automática ----------
  const adicionarPessoaAutomatica = (nome) => {
    const limpo = nome.trim();
    if (!limpo) return;
    setPessoasAutomaticas((prev) => (prev.some((p) => p.toLowerCase() === limpo.toLowerCase()) ? prev : [...prev, limpo]));
  };
  const removerPessoaAutomatica = (nome) => setPessoasAutomaticas((prev) => prev.filter((p) => p !== nome));

  // ---------- exportar dados ----------
  const exportarDados = () => {
    const payload = { despesas, cartoes, pessoasAutomaticas, exportadoEm: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meu-caixa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

  const cartaoAtivo = cartoes.find((c) => `cartao-${c.id}` === aba);
  const acento = aba === "despesas" ? COR.ouro : cartaoAtivo?.cor || COR.roxo;
  const acentoClaro = aba === "despesas" ? COR.ouroClaro : cartaoAtivo?.corClara || COR.roxoClaro;

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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: COR.ouro }}>
                <Wallet size={18} color={COR.tinta} strokeWidth={2.5} />
              </div>
              <h1 className="fonte-display text-2xl" style={{ color: COR.papel }}>Meu Caixa</h1>
            </div>
            <button onClick={exportarDados} className="p-2 rounded-full" style={{ color: "#9AA1B4" }} title="Exportar dados (backup)">
              <Download size={18} />
            </button>
          </div>

          <nav className="flex gap-1 items-center overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setAba("despesas")}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors shrink-0 whitespace-nowrap"
              style={{ background: aba === "despesas" ? COR.papel : "transparent", color: aba === "despesas" ? COR.tinta : "#9AA1B4" }}
            >
              <Wallet size={15} /> Despesas
            </button>
            {cartoes.map((c) => {
              const ativo = aba === `cartao-${c.id}`;
              return (
                <button
                  key={c.id}
                  onClick={() => setAba(`cartao-${c.id}`)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors shrink-0 whitespace-nowrap"
                  style={{ background: ativo ? COR.papel : "transparent", color: ativo ? COR.tinta : "#9AA1B4" }}
                >
                  <CreditCard size={15} /> {c.nome}
                </button>
              );
            })}
            <button
              onClick={() => setMostrarAddCartao((v) => !v)}
              className="shrink-0 p-2 rounded-full ml-1"
              style={{ color: "#9AA1B4" }}
              title="Adicionar cartão"
            >
              <Plus size={16} />
            </button>
          </nav>

          {mostrarAddCartao && (
            <div className="flex gap-2 pb-3 pt-2">
              <input
                value={nomeNovoCartao}
                onChange={(e) => setNomeNovoCartao(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") adicionarCartao(); }}
                placeholder="Nome do novo cartão (ex: Cartão Inter)"
                className="flex-1 h-9 px-2.5 rounded-md border text-sm outline-none box-border"
                style={{ borderColor: COR.linha }}
              />
              <button onClick={adicionarCartao} className="px-3 rounded-md text-sm font-semibold text-white" style={{ background: COR.ouro }}>
                Adicionar
              </button>
            </div>
          )}
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
              despesas={despesas}
              onAtualizarDespesas={setDespesas}
              cartoes={cartoes}
              pessoasAutomaticas={pessoasAutomaticas}
              adicionarPessoaAutomatica={adicionarPessoaAutomatica}
              removerPessoaAutomatica={removerPessoaAutomatica}
            />
          </div>
          {cartoes.map((cartao) => (
            <div key={cartao.id} className="max-w-2xl mx-auto px-5 py-6 w-full shrink-0">
              <CartaoTab
                cartao={cartao}
                onAtualizarCompras={(novasCompras) =>
                  setCartoes((prev) => prev.map((c) => (c.id === cartao.id ? { ...c, compras: novasCompras } : c)))
                }
                onGerarPdf={gerarRelatorio}
                onExcluirCartao={excluirCartao}
                pessoasAutomaticas={pessoasAutomaticas}
              />
            </div>
          ))}
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
function DespesasTab({ despesas, onAtualizarDespesas, cartoes, pessoasAutomaticas, adicionarPessoaAutomatica, removerPessoaAutomatica }) {
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualChave());
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nova, setNova] = useState({ descricao: "", valor: "", vencimento: "", categoria: CATEGORIAS[CATEGORIAS.length - 1] });
  const [editandoId, setEditandoId] = useState(null);
  const [rascunho, setRascunho] = useState(null);
  const [novaPessoa, setNovaPessoa] = useState("");

  const despesasPorMes = useMemo(() => {
    const grupos = {};
    for (const d of despesas) {
      const chave = chaveDoMes(d.vencimento);
      (grupos[chave] ||= []).push(d);
    }
    return grupos;
  }, [despesas]);

  const cartoesComAgrupamento = useMemo(() => cartoes.map((c) => {
    const porMes = {};
    for (const compra of c.compras) {
      const chave = chaveDoMes(compra.data);
      (porMes[chave] ||= []).push(compra);
    }
    return { ...c, porMes };
  }), [cartoes]);

  const fontesCartao = useMemo(() => cartoesComAgrupamento.map((c) => ({
    label: c.nome,
    cor: c.cor,
    corClara: c.corClara,
    totalPorMes: (chave) => totalAutomaticoEmMes(c.porMes, chave, pessoasAutomaticas),
  })), [cartoesComAgrupamento, pessoasAutomaticas]);

  const chaves = useMemo(() => {
    const conjunto = new Set(Object.keys(despesasPorMes));
    for (const c of cartoesComAgrupamento) {
      for (const chave of Object.keys(c.porMes)) {
        if (totalAutomaticoEmMes(c.porMes, chave, pessoasAutomaticas) > 0) conjunto.add(chave);
      }
    }
    return [...conjunto].sort();
  }, [despesasPorMes, cartoesComAgrupamento, pessoasAutomaticas]);

  const meses = useMemo(() => preencherIntervaloMeses(chaves), [chaves]);

  const linhas = despesasPorMes[mesSelecionado] || [];
  const totaisCartoes = fontesCartao.map((f) => ({ ...f, total: f.totalPorMes(mesSelecionado) }));
  const somaCartoes = totaisCartoes.reduce((s, f) => s + f.total, 0);
  const totalDespesasMes = linhas.reduce((s, d) => s + d.valor, 0);
  const totalMes = totalDespesasMes + somaCartoes;
  const totalPago = linhas.filter((d) => d.paga).reduce((s, d) => s + d.valor, 0);
  const totalPendente = totalDespesasMes - totalPago;

  const dadosGrafico = useMemo(() => chaves.slice(-12).map((chave) => {
    const totalD = (despesasPorMes[chave] || []).reduce((s, d) => s + d.valor, 0);
    const totalC = fontesCartao.reduce((s, f) => s + f.totalPorMes(chave), 0);
    const [, m] = chave.split("-");
    return { mesRotulo: MESES[parseInt(m, 10) - 1].slice(0, 3), total: totalD + totalC };
  }), [chaves, despesasPorMes, fontesCartao]);

  const adicionar = () => {
    const valor = parseFloat(nova.valor);
    if (!nova.descricao.trim() || !nova.vencimento || !(valor > 0)) return;
    const novaDespesa = { id: uid(), descricao: nova.descricao.trim(), valor, vencimento: nova.vencimento, categoria: nova.categoria || "Outros", paga: false };
    onAtualizarDespesas([...despesas, novaDespesa]);
    setNova({ descricao: "", valor: "", vencimento: "", categoria: CATEGORIAS[CATEGORIAS.length - 1] });
    setMostrarForm(false);
    setMesSelecionado(chaveDoMes(novaDespesa.vencimento));
  };

  const iniciarEdicao = (d) => { setEditandoId(d.id); setRascunho({ ...d, valor: String(d.valor) }); };

  const salvarEdicao = () => {
    const valor = parseFloat(rascunho.valor);
    if (!rascunho.descricao.trim() || !rascunho.vencimento || !(valor > 0)) return;
    onAtualizarDespesas(despesas.map((d) =>
      d.id === editandoId
        ? { ...d, descricao: rascunho.descricao.trim(), valor, vencimento: rascunho.vencimento, categoria: rascunho.categoria }
        : d
    ));
    setEditandoId(null);
    setRascunho(null);
  };

  const cancelarEdicao = () => { setEditandoId(null); setRascunho(null); };
  const excluir = (id) => onAtualizarDespesas(despesas.filter((d) => d.id !== id));
  const togglePaga = (id) => onAtualizarDespesas(despesas.map((d) => (d.id === id ? { ...d, paga: !d.paga } : d)));

  const confirmarAdicionarPessoa = () => { adicionarPessoaAutomatica(novaPessoa); setNovaPessoa(""); };

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
        <p className="fonte-mono text-3xl font-bold mt-1" style={{ color: COR.papel }}>{fmt(totalMes)}</p>
        {linhas.length > 0 && (
          <p className="text-xs mt-1" style={{ color: "#9AA1B4" }}>
            Pago: <span className="fonte-mono">{fmt(totalPago)}</span> · Pendente: <span className="fonte-mono">{fmt(totalPendente)}</span>
          </p>
        )}
      </div>

      <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "white", border: `1px solid ${COR.linha}` }}>
        <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: COR.tintaSuave }}>
          Pessoas com soma automática nos cartões
        </p>
        <div className="flex flex-wrap gap-1.5">
          {pessoasAutomaticas.length === 0 && (
            <span className="text-xs" style={{ color: COR.tintaSuave }}>Nenhuma pessoa configurada.</span>
          )}
          {pessoasAutomaticas.map((p) => (
            <span key={p} className="flex items-center gap-1 text-xs font-medium pl-2 pr-1 py-1 rounded-full" style={{ background: COR.papelEscuro, color: COR.tinta }}>
              {p}
              <button onClick={() => removerPessoaAutomatica(p)} style={{ color: COR.vermelho }}><X size={11} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={novaPessoa}
            onChange={(e) => setNovaPessoa(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmarAdicionarPessoa(); }}
            placeholder="Adicionar pessoa..."
            className={inputBase + " flex-1"}
            style={{ borderColor: COR.linha }}
          />
          <button onClick={confirmarAdicionarPessoa} className="px-4 rounded-md text-sm font-semibold text-white" style={{ background: COR.ouro }}>+</button>
        </div>
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
          <Campo label="Categoria">
            <select className={inputBase} style={{ borderColor: COR.linha }} value={nova.categoria} onChange={(e) => setNova({ ...nova, categoria: e.target.value })}>
              {CATEGORIAS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
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
              onClick={adicionar}
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
                  <select className={inputBase} style={{ borderColor: COR.linha }} value={rascunho.categoria} onChange={(e) => setRascunho({ ...rascunho, categoria: e.target.value })}>
                    {CATEGORIAS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <input
                    className={inputBase} style={{ borderColor: COR.linha }}
                    type="number" step="0.01" min="0"
                    value={rascunho.valor}
                    onChange={(e) => setRascunho({ ...rascunho, valor: e.target.value })}
                  />
                  <input
                    className={inputBase} style={{ borderColor: COR.linha }}
                    type="date"
                    value={rascunho.vencimento}
                    onChange={(e) => setRascunho({ ...rascunho, vencimento: e.target.value })}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelarEdicao} className="p-1.5 rounded-md" style={{ color: COR.tintaSuave }}><X size={16} /></button>
                    <button onClick={salvarEdicao} className="p-1.5 rounded-md text-white" style={{ background: COR.ouro }}><Check size={16} /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <button onClick={() => togglePaga(d.id)} className="mt-0.5 shrink-0" title={d.paga ? "Marcar como pendente" : "Marcar como paga"}>
                    {d.paga ? <CheckCircle2 size={18} color={COR.verde} /> : <Circle size={18} color={COR.tintaSuave} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ textDecoration: d.paga ? "line-through" : "none", color: d.paga ? COR.tintaSuave : COR.tinta }}
                    >
                      {d.descricao}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: corCategoria(d.categoria) + "22", color: corCategoria(d.categoria) }}>
                        {d.categoria}
                      </span>
                      <span className="text-xs" style={{ color: COR.tintaSuave }}>
                        Vence em {new Date(d.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                      {!d.paga && d.vencimento < hojeISO() && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#F8D9DF", color: COR.vermelho }}>
                          Atrasada
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="fonte-mono text-sm font-semibold">{fmt(d.valor)}</span>
                    <button onClick={() => iniciarEdicao(d)} style={{ color: COR.tintaSuave }}><Pencil size={14} /></button>
                    <BotaoExcluirConfirmar onConfirmar={() => excluir(d.id)} />
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
                  {f.label} — soma automática
                </p>
              </div>
              <span className="fonte-mono text-sm font-semibold" style={{ color: f.cor }}>{fmt(f.total)}</span>
            </div>
          ))}
        </div>
      )}

      {dadosGrafico.length > 0 && (
        <div className="rounded-lg p-4" style={{ background: "white", border: `1px solid ${COR.linha}` }}>
          <p className="text-sm font-semibold mb-3" style={{ color: COR.tinta }}>Evolução mensal</p>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke={COR.linha} />
                <XAxis dataKey="mesRotulo" tick={{ fontSize: 11, fill: COR.tintaSuave }} axisLine={{ stroke: COR.linha }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: COR.tintaSuave }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: COR.linha }} />
                <Bar dataKey="total" fill={COR.ouro} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== ABA DE CARTÃO (reutilizada por todos os cartões) =====================
function CartaoTab({ cartao, onAtualizarCompras, onGerarPdf, onExcluirCartao, pessoasAutomaticas }) {
  const { nome: nomeCartao, cor: corPrincipal, corClara, compras } = cartao;

  const [pessoaFiltro, setPessoaFiltro] = useState("todos");
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualChave());
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nova, setNova] = useState({ nome: "", compra: "", valor: "", data: "" });
  const [editandoId, setEditandoId] = useState(null);
  const [rascunho, setRascunho] = useState(null);
  const [confirmandoExclusaoCartao, setConfirmandoExclusaoCartao] = useState(false);

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

  const adicionar = () => {
    const valor = parseFloat(nova.valor);
    if (!nova.nome.trim() || !nova.compra.trim() || !nova.data || !(valor > 0)) return;
    const novaCompra = { id: uid(), nome: nova.nome.trim(), compra: nova.compra.trim(), valor, data: nova.data };
    onAtualizarCompras([...compras, novaCompra]);
    setNova({ nome: "", compra: "", valor: "", data: "" });
    setMostrarForm(false);
    setMesSelecionado(chaveDoMes(novaCompra.data));
  };

  const iniciarEdicao = (c) => { setEditandoId(c.id); setRascunho({ ...c, valor: String(c.valor) }); };

  const salvarEdicao = () => {
    const valor = parseFloat(rascunho.valor);
    if (!rascunho.nome.trim() || !rascunho.compra.trim() || !rascunho.data || !(valor > 0)) return;
    onAtualizarCompras(compras.map((c) =>
      c.id === editandoId
        ? { ...c, nome: rascunho.nome.trim(), compra: rascunho.compra.trim(), valor, data: rascunho.data }
        : c
    ));
    setEditandoId(null);
    setRascunho(null);
  };

  const cancelarEdicao = () => { setEditandoId(null); setRascunho(null); };
  const excluir = (id) => onAtualizarCompras(compras.filter((c) => c.id !== id));

  const gerarRelatorioPdf = () => {
    onGerarPdf({ nomeCartao, pessoaFiltro, mesSelecionado, linhas: linhasMes, total: totalMes });
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
              placeholder={pessoasAutomaticas[0] ? `Ex: ${pessoasAutomaticas[0]}` : "Nome de quem comprou"}
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
            <button onClick={adicionar} className="px-3 py-1.5 text-sm font-semibold rounded-md text-white" style={{ background: corPrincipal }}>
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
                  <input
                    className={inputBase} style={{ borderColor: COR.linha }}
                    value={rascunho.nome}
                    onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                  />
                  <input
                    className={inputBase} style={{ borderColor: COR.linha }}
                    type="date"
                    value={rascunho.data}
                    onChange={(e) => setRascunho({ ...rascunho, data: e.target.value })}
                  />
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
                        background: ehPessoaAutomatica(c.nome, pessoasAutomaticas) ? corPrincipal : COR.papelEscuro,
                        color: ehPessoaAutomatica(c.nome, pessoasAutomaticas) ? "white" : COR.tintaSuave,
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
                    <BotaoExcluirConfirmar onConfirmar={() => excluir(c.id)} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 oculta-impressao">
        {confirmandoExclusaoCartao ? (
          <div className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: "#F8D9DF" }}>
            <span className="text-xs font-medium" style={{ color: COR.vermelho }}>
              Excluir {nomeCartao} e todas as compras dele?
            </span>
            <div className="flex gap-2">
              <button onClick={() => onExcluirCartao(cartao.id)} className="text-xs font-semibold px-2 py-1 rounded" style={{ background: COR.vermelho, color: "white" }}>
                Excluir
              </button>
              <button onClick={() => setConfirmandoExclusaoCartao(false)} className="text-xs font-semibold px-2 py-1 rounded" style={{ color: COR.tintaSuave }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmandoExclusaoCartao(true)} className="w-full text-center text-xs font-medium py-1" style={{ color: COR.tintaSuave }}>
            Excluir este cartão
          </button>
        )}
      </div>
    </div>
  );
}
