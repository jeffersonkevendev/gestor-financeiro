import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus, Pencil, Trash2, Check, X, Wallet, CreditCard, ArrowRight, FileDown,
  CheckCircle2, Circle, Download, LogOut, Mail, Lock, Eye, EyeOff, UserPlus, ShieldCheck,
  ArrowLeft, User, Phone, Calculator as IconeCalculadora, Delete, Home,
  BarChart3, MoreHorizontal, ChevronRight, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
} from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import html2canvas from "html2canvas";
import { auth, googleProvider, db } from "./firebase";
import { criarSincronizacaoNuvem } from "./sincronizacaoNuvem";

const mensagemErroAuth = (codigo) => {
  const mapa = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-disabled": "Essa conta foi desativada.",
    "auth/user-not-found": "Não encontramos uma conta com esse e-mail.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente em instantes.",
    "auth/missing-password": "Digite sua senha.",
    "auth/operation-not-allowed": "O login com Google precisa ser ativado no Firebase.",
    "auth/configuration-not-found": "Confira a configuração de autenticação do Firebase.",
    "auth/unauthorized-domain": "Este endereço precisa ser autorizado no Firebase para entrar com Google.",
    "auth/account-exists-with-different-credential": "Este e-mail já está associado a outro método de login. Vincule a conta Google à conta existente para manter seus dados.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
    "permission-denied": "Sem permissão pra salvar seus dados. Confira as regras do Firestore.",
  };
  return mapa[codigo] || `Algo deu errado${codigo ? ` (${codigo})` : ""}. Tente novamente.`;
};

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
  cartao: "#FFFFFF",
  texto: "#1C2333",
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

// Extrai só o primeiro nome — usado pra agrupar "Jefferson" e "Jefferson Keven" como a mesma pessoa no filtro.
const primeiroNomeDe = (nome) => (nome || "").trim().split(/\s+/)[0] || "";

const ehPessoaAutomatica = (nome, lista) =>
  lista.some((p) => p.trim().toLowerCase() === (nome || "").trim().toLowerCase());

const totalAutomaticoEmMes = (comprasPorMesObj, chave, pessoas) =>
  (comprasPorMesObj[chave] || []).filter((c) => ehPessoaAutomatica(c.nome, pessoas)).reduce((s, c) => s + c.valor, 0);

const hojeISO = () => new Date().toISOString().slice(0, 10);

// Máscara de valor monetário: digita só números, a vírgula e os centavos vão se ajustando sozinhos.
const formatarValorDigitado = (textoDigitado) => {
  const digitos = textoDigitado.replace(/\D/g, "");
  if (!digitos) return "";
  const centavos = parseInt(digitos, 10);
  return (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const valorMascaradoParaNumero = (mascarado) => {
  if (!mascarado) return NaN;
  const limpo = mascarado.replace(/\./g, "").replace(",", ".");
  return parseFloat(limpo);
};

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

const DADOS_PADRAO_NUVEM = {
  despesas: [],
  receitas: [],
  cartoes: CARTOES_PADRAO,
  pagamentosCartaoPagos: {},
  orcamentoMensal: 0,
};

// Guarda despesas, receitas, cartões, orçamento e pagamentos no Firestore, num documento por usuário logado.
function useDadosNuvem(uid) {
  const [estado, setEstado] = useState({
    dados: DADOS_PADRAO_NUVEM, carregando: true, salvando: false,
    temPendencias: false, erroLeitura: "", erroSalvar: "",
  });
  const sincronizacao = useRef(null);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "usuarios", uid);
    const controle = criarSincronizacaoNuvem({
      padrao: DADOS_PADRAO_NUVEM,
      escutar: (sucesso, erro) => onSnapshot(ref, { includeMetadataChanges: true }, sucesso, erro),
      // Substitui só os campos alterados, inclusive mapas, preservando perfil e outros campos.
      gravar: (patch) => setDoc(ref, patch, { mergeFields: Object.keys(patch) }),
      notificar: setEstado,
    });
    sincronizacao.current = controle;
    controle.iniciar();
    return () => {
      controle.parar();
      sincronizacao.current = null;
    };
  }, [uid]);

  useEffect(() => {
    if (!estado.temPendencias) return;
    const avisar = (evento) => {
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [estado.temPendencias]);

  const criarSetter = (campo) => (valor) => sincronizacao.current?.alterar(campo, valor);
  return {
    ...estado.dados,
    setDespesas: criarSetter("despesas"),
    setReceitas: criarSetter("receitas"),
    setCartoes: criarSetter("cartoes"),
    setPagamentosCartaoPagos: criarSetter("pagamentosCartaoPagos"),
    setOrcamentoMensal: criarSetter("orcamentoMensal"),
    carregando: estado.carregando,
    salvando: estado.salvando,
    temPendencias: estado.temPendencias,
    erroNuvem: estado.erroLeitura || estado.erroSalvar,
    tentarNovamente: () => sincronizacao.current?.tentarNovamente(),
  };
}

function TelaErroNuvem({ mensagem, temPendencias, salvando, tentarNovamente }) {
  const [erroSaida, setErroSaida] = useState("");
  const sair = async () => {
    try { await signOut(auth); }
    catch (erro) { setErroSaida(mensagemErroAuth(erro.code)); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: COR.papel, color: COR.tinta }}>
      <div className="max-w-sm w-full rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold mb-3">{temPendencias ? "Alterações ainda não salvas" : "Não foi possível carregar seus dados"}</h1>
        <p role="alert" className="text-sm mb-4" style={{ color: COR.vermelho }}>{mensagem}</p>
        {temPendencias && <p className="text-sm mb-4">Suas alterações estão nesta sessão. Mantenha esta página aberta e tente novamente para salvar.</p>}
        <button onClick={tentarNovamente} disabled={salvando} className="w-full rounded-xl p-3 text-white font-bold disabled:opacity-60" style={{ background: COR.ouro }}>
          {salvando ? "Salvando..." : "Tentar novamente"}
        </button>
        {!temPendencias && <button onClick={sair} className="w-full mt-3 p-2 text-sm">Sair e entrar novamente</button>}
        {erroSaida && <p role="alert" className="mt-3 text-sm" style={{ color: COR.vermelho }}>{erroSaida}</p>}
      </div>
    </div>
  );
}

// -------- tela de carregamento --------
function TelaCarregando() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center" style={{ background: COR.tinta }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&display=swap');
        .fonte-display { font-family: 'Fraunces', serif; }
      `}</style>
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ border: `2px solid ${COR.ouro}` }}>
        <Wallet size={26} color={COR.ouro} strokeWidth={2} />
      </div>
      <h1 className="fonte-display text-xl mb-5" style={{ color: "white" }}>Meu Caixa</h1>
      <div
        className="w-7 h-7 rounded-full animate-spin"
        style={{ border: "3px solid rgba(255,255,255,0.15)", borderTopColor: COR.ouro }}
      />
      <p className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.6)" }}>Carregando...</p>
    </div>
  );
}

function TelaLogin({ erroInicial }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(erroInicial || "");

  useEffect(() => { if (erroInicial) setErro(erroInicial); }, [erroInicial]);

  const entrarComGoogle = async () => {
    if (carregando) return;
    setErro("");
    setCarregando(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setCarregando(false);
    } catch (erroPopup) {
      if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(erroPopup.code)) {
        setCarregando(false);
        return;
      }
      if (!["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(erroPopup.code)) {
        setErro(mensagemErroAuth(erroPopup.code));
        setCarregando(false);
        return;
      }
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (erroRedirect) {
        setErro(mensagemErroAuth(erroRedirect.code));
        setCarregando(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-full" style={{ background: COR.papel, fontFamily: "'Inter', ui-sans-serif, system-ui" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        .fonte-display { font-family: 'Fraunces', serif; }
      `}</style>
      <div className="relative pt-14 pb-20 px-6 text-center" style={{ background: COR.tinta }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 mx-auto" style={{ border: `2px solid ${COR.ouro}` }}>
          <Wallet size={32} color={COR.ouro} strokeWidth={2} />
        </div>
        <h1 className="fonte-display text-3xl font-bold mb-3" style={{ color: "white" }}>Meu Caixa</h1>
        <p className="text-sm mx-auto" style={{ color: "rgba(255,255,255,0.7)", maxWidth: 300 }}>
          Entre com sua conta Google para acessar suas despesas e cartões, salvos na nuvem.
        </p>
        <svg aria-hidden="true" className="absolute left-0 bottom-0 w-full" style={{ height: 36 }} viewBox="0 0 500 60" preserveAspectRatio="none">
          <path d="M0,30 C150,70 350,-10 500,30 L500,60 L0,60 Z" fill={COR.papel} />
        </svg>
      </div>
      <div className="px-6 pb-10 pt-6 flex flex-col gap-4 max-w-sm mx-auto">
        <button onClick={entrarComGoogle} disabled={carregando} className="w-full h-12 flex items-center justify-center gap-3 rounded-2xl font-semibold text-sm disabled:opacity-60" style={{ background: "white", color: COR.tinta, border: `1px solid ${COR.linha}` }}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 10.1-2 13.7-5.2l-6.3-5.3C29.3 35.4 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.3 5.3C41.6 35.4 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z" />
              </svg>
              {carregando ? "Conectando..." : "Entrar com Google"}
            </button>
        {erro && <p role="alert" className="text-sm text-center" style={{ color: COR.vermelho }}>{erro}</p>}
        <div className="flex items-center justify-center gap-2 mt-2">
          <ShieldCheck size={15} color={COR.tintaSuave} />
          <p className="text-xs text-center" style={{ color: COR.tintaSuave }}>Seus dados ficam salvos na sua conta.</p>
        </div>
      </div>
    </div>
  );
}

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

export default function App() {
  const [usuario, setUsuario] = useState(undefined); // undefined = verificando, null = deslogado, objeto = logado
  const [erroRedirecionamento, setErroRedirecionamento] = useState("");

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, (u) => setUsuario(u));
    getRedirectResult(auth).catch((e) => setErroRedirecionamento(mensagemErroAuth(e.code)));
    return cancelar;
  }, []);

  if (usuario === undefined) return <TelaCarregando />;
  if (usuario === null) return <TelaLogin erroInicial={erroRedirecionamento} />;
  return <MeuCaixaApp key={usuario.uid} usuario={usuario} />;
}

function MeuCaixaApp({ usuario }) {
  const [aba, setAba] = useLocalStorageState("meu-caixa:aba-ativa", "inicio");
  const [erroSaida, setErroSaida] = useState("");
  const { despesas, setDespesas, receitas, setReceitas, cartoes, setCartoes, pagamentosCartaoPagos, setPagamentosCartaoPagos, orcamentoMensal, setOrcamentoMensal, carregando, salvando, temPendencias, erroNuvem, tentarNovamente } = useDadosNuvem(usuario.uid);
  const [mostrarMenuUsuario, setMostrarMenuUsuario] = useState(false);
  const [mostrarCalculadora, setMostrarCalculadora] = useState(false);
  const [cartaoSelecionadoId, setCartaoSelecionadoId] = useState(null);
  const [mostrarNovaReceita, setMostrarNovaReceita] = useState(false);
  const [receitaEditando, setReceitaEditando] = useState(null);
  const [mostrarOrcamento, setMostrarOrcamento] = useState(false);

  // A soma automática nos cartões usa o nome de quem está logado — sem precisar configurar nada.
  const nomeDoUsuario = (usuario.displayName || usuario.email || "").trim();
  const primeiroNomeDoUsuario = nomeDoUsuario.split(/\s+/)[0] || "";
  const pessoasAutomaticas = useMemo(() => {
    const nomes = new Set();
    if (nomeDoUsuario) nomes.add(nomeDoUsuario);
    if (primeiroNomeDoUsuario) nomes.add(primeiroNomeDoUsuario);
    return [...nomes];
  }, [nomeDoUsuario, primeiroNomeDoUsuario]);

  // ---------- navegação (abas deslizáveis) ----------
  const abas = ["inicio", "despesas", ...cartoes.map((c) => `cartao-${c.id}`)];
  const indiceAbaBruto = abas.indexOf(aba);
  const indiceAba = indiceAbaBruto === -1 ? 0 : indiceAbaBruto;

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

  const irPara = (novaSecao) => {
    setAba(novaSecao);
    setCartaoSelecionadoId(null);
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
    setCartaoSelecionadoId(id);
    setNomeNovoCartao("");
    setMostrarAddCartao(false);
  };

  const excluirCartao = (id) => {
    setCartoes((prev) => prev.filter((c) => c.id !== id));
    setCartaoSelecionadoId((atual) => (atual === id ? null : atual));
  };

  const [cartaoParaExcluir, setCartaoParaExcluir] = useState(null);
  const confirmarExclusaoCartao = () => {
    if (!cartaoParaExcluir) return;
    excluirCartao(cartaoParaExcluir.id);
    setCartaoParaExcluir(null);
  };

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

  // ---------- relatório em imagem (compartilhado entre os cartões, para não duplicar) ----------
  const [relatorio, setRelatorio] = useState(null);
  const [gerandoImagem, setGerandoImagem] = useState(false);

  const gerarRelatorio = (dados) => {
    setRelatorio(dados);
    setGerandoImagem(true);
    setTimeout(async () => {
      const elemento = document.getElementById("relatorio-para-captura");
      if (!elemento) { setGerandoImagem(false); return; }
      try {
        const canvas = await html2canvas(elemento, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
        const url = canvas.toDataURL("image/jpeg", 0.92);
        const slug = dados.nomeCartao.replace(/\s+/g, "-");
        const a = document.createElement("a");
        a.href = url;
        a.download = `Relatorio-${slug}-${dados.pessoaFiltro === "todos" ? "todos" : dados.pessoaFiltro}-${dados.mesSelecionado}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } finally {
        setGerandoImagem(false);
      }
    }, 80);
  };

  const cartaoAtivo = cartoes.find((c) => `cartao-${c.id}` === aba);
  const acento = aba === "despesas" || aba === "inicio" ? COR.ouro : cartaoAtivo?.cor || COR.roxo;
  const acentoClaro = aba === "despesas" || aba === "inicio" ? COR.ouroClaro : cartaoAtivo?.corClara || COR.roxoClaro;

  // ---------- receitas ----------
  const adicionarOuAtualizarReceita = (dadosReceita) => {
    if (dadosReceita.id) {
      setReceitas((prev) => prev.map((r) => (r.id === dadosReceita.id ? dadosReceita : r)));
    } else {
      setReceitas((prev) => [...prev, { ...dadosReceita, id: uid() }]);
    }
    setMostrarNovaReceita(false);
    setReceitaEditando(null);
  };
  const excluirReceita = (id) => setReceitas((prev) => prev.filter((r) => r.id !== id));

  if (erroNuvem) return <TelaErroNuvem mensagem={erroNuvem} temPendencias={temPendencias} salvando={salvando} tentarNovamente={tentarNovamente} />;
  if (carregando) return <TelaCarregando />;

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: COR.papel, color: COR.texto, fontFamily: "'Inter', ui-sans-serif, system-ui" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .fonte-display { font-family: 'Fraunces', serif; }
        .fonte-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        input:focus, select:focus { border-color: ${acento} !important; box-shadow: 0 0 0 2px ${acentoClaro}; }
        .relatorio-impressao { position: fixed; top: 0; left: -10000px; width: 420px; background: white; }
      `}</style>

      {temPendencias && <div role="status" aria-live="polite" className="sticky top-0 z-50 px-5 py-3 text-center text-sm" style={{ background: COR.ouroClaro, color: COR.tinta }}>
        Salvando no Firebase... Mantenha esta página aberta até concluir.
      </div>}

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
            <div className="relative">
              <button onClick={() => setMostrarMenuUsuario((v) => !v)} className="w-8 h-8 rounded-full overflow-hidden border-2" style={{ borderColor: "#3a4257" }}>
                {usuario.photoURL ? (
                  <img src={usuario.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex items-center justify-center w-full h-full text-xs font-bold" style={{ background: COR.ouro, color: COR.texto }}>
                    {(usuario.displayName || usuario.email || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
              {mostrarMenuUsuario && (
                <div className="absolute right-0 top-10 rounded-md p-3 z-50" style={{ background: COR.cartao, minWidth: 220, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
                  <p className="text-xs font-semibold truncate" style={{ color: COR.texto }}>{usuario.displayName || "Usuário"}</p>
                  <p className="text-[11px] truncate mb-3" style={{ color: COR.tintaSuave }}>{usuario.email}</p>

                  <button
                    onClick={() => { setMostrarMenuUsuario(false); exportarDados(); }}
                    className="flex items-center gap-1.5 text-xs font-semibold w-full text-left py-1.5"
                    style={{ color: COR.texto }}
                  >
                    <Download size={13} /> Exportar dados
                  </button>

                  <button
                    disabled={temPendencias}
                    onClick={async () => {
                      setErroSaida("");
                      try { await signOut(auth); }
                      catch (erro) { setErroSaida(mensagemErroAuth(erro.code)); }
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold w-full text-left py-1.5 disabled:opacity-60"
                    style={{ color: COR.vermelho }}
                  >
                    <LogOut size={13} /> {temPendencias ? "Aguarde o salvamento" : "Sair da conta"}
                  </button>
                  {erroSaida && <p role="alert" className="text-xs mt-2" style={{ color: COR.vermelho }}>{erroSaida}</p>}
                </div>
              )}
            </div>
          </div>

          <nav className="flex gap-1 items-center overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setAba("inicio")}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors shrink-0 whitespace-nowrap"
              style={{ background: aba === "inicio" ? COR.papel : "transparent", color: aba === "inicio" ? COR.tinta : "#9AA1B4" }}
            >
              <Home size={15} /> Início
            </button>
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
                <div
                  key={c.id}
                  className="flex items-center shrink-0 rounded-t-lg transition-colors"
                  style={{ background: ativo ? COR.papel : "transparent" }}
                >
                  <button
                    onClick={() => setAba(`cartao-${c.id}`)}
                    className="flex items-center gap-1.5 pl-4 pr-1.5 py-2.5 text-sm font-semibold whitespace-nowrap"
                    style={{ color: ativo ? COR.tinta : "#9AA1B4" }}
                  >
                    <CreditCard size={15} /> {c.nome}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCartaoParaExcluir(c); }}
                    className="pr-3 pl-0.5 py-2.5"
                    style={{ color: ativo ? COR.tintaSuave : "#6b7280" }}
                    title={`Excluir ${c.nome}`}
                  >
                    <X size={13} />
                  </button>
                </div>
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
          <div className="max-w-2xl mx-auto px-5 pt-6 pb-28 w-full shrink-0 oculta-impressao">
            <InicioTab
              despesas={despesas}
              cartoes={cartoes}
              pessoasAutomaticas={pessoasAutomaticas}
              primeiroNome={primeiroNomeDoUsuario}
              onIrPara={setAba}
              onAbrirCalculadora={() => setMostrarCalculadora(true)}
            />
          </div>
          <div className="max-w-2xl mx-auto px-5 pt-6 pb-28 w-full shrink-0 oculta-impressao">
            <DespesasTab
              despesas={despesas}
              onAtualizarDespesas={setDespesas}
              cartoes={cartoes}
              pessoasAutomaticas={pessoasAutomaticas}
              pagamentosCartaoPagos={pagamentosCartaoPagos}
              onAtualizarPagamentosCartao={setPagamentosCartaoPagos}
            />
          </div>
          {cartoes.map((cartao) => (
            <div key={cartao.id} className="max-w-2xl mx-auto px-5 pt-6 pb-28 w-full shrink-0">
              <CartaoTab
                cartao={cartao}
                onAtualizarCompras={(novasCompras) =>
                  setCartoes((prev) => prev.map((c) => (c.id === cartao.id ? { ...c, compras: novasCompras } : c)))
                }
                onGerarPdf={gerarRelatorio}
                gerandoImagem={gerandoImagem}
                onPedirExclusao={() => setCartaoParaExcluir(cartao)}
                pessoasAutomaticas={pessoasAutomaticas}
              />
            </div>
          ))}
        </div>
      </main>

      {/* botão flutuante da calculadora */}
      <button
        onClick={() => setMostrarCalculadora(true)}
        className="fixed z-40 w-14 h-14 rounded-full flex items-center justify-center oculta-impressao"
        style={{ background: COR.ouro, right: 18, bottom: 22, boxShadow: "0 8px 20px rgba(0,0,0,0.35)" }}
        title="Calculadora"
      >
        <IconeCalculadora size={22} color="white" />
      </button>
      <Calculadora aberta={mostrarCalculadora} aoFechar={() => setMostrarCalculadora(false)} />

      {/* modal de confirmação — excluir cartão */}
      {cartaoParaExcluir && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-5 oculta-impressao"
          style={{ background: "rgba(28,35,51,0.6)" }}
          onClick={() => setCartaoParaExcluir(null)}
        >
          <div className="rounded-lg p-5 max-w-sm w-full" style={{ background: COR.cartao }} onClick={(e) => e.stopPropagation()}>
            <p className="fonte-display text-lg mb-2" style={{ color: COR.texto }}>
              Excluir {cartaoParaExcluir.nome}?
            </p>
            <p className="text-sm mb-5" style={{ color: COR.tintaSuave }}>
              Isso vai apagar permanentemente {cartaoParaExcluir.compras.length === 1 ? "a compra registrada" : "as compras registradas"} nesse cartão. Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCartaoParaExcluir(null)} className="px-3 py-1.5 text-sm rounded-md" style={{ color: COR.tintaSuave }}>
                Cancelar
              </button>
              <button onClick={confirmarExclusaoCartao} className="px-3 py-1.5 text-sm font-semibold rounded-md text-white" style={{ background: COR.vermelho }}>
                Excluir cartão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* área exclusiva de impressão / PDF — única para qualquer cartão, evita duplicar relatórios */}
      {relatorio && (
        <div id="relatorio-para-captura" className="relatorio-impressao" style={{ color: "#111", fontFamily: "'Inter', ui-sans-serif", padding: 24 }}>
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
                <th style={{ padding: "3px 0", textAlign: "right" }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.linhas.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid #eee" }}>
                  {relatorio.pessoaFiltro === "todos" && <td style={{ padding: "3px 0" }}>{c.nome}</td>}
                  <td style={{ padding: "3px 0" }}>{c.compra}</td>
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

// ===================== CALCULADORA =====================
function Calculadora({ aberta, aoFechar }) {
  const [visor, setVisor] = useState("0");
  const [valorAnterior, setValorAnterior] = useState(null);
  const [operador, setOperador] = useState(null);
  const [aguardandoNovoValor, setAguardandoNovoValor] = useState(false);

  if (!aberta) return null;

  const formatarResultado = (n) => {
    if (!isFinite(n)) return "Erro";
    const arredondado = Math.round(n * 1e8) / 1e8;
    return String(arredondado);
  };

  const inserirNumero = (digito) => {
    setVisor((v) => {
      if (aguardandoNovoValor) { setAguardandoNovoValor(false); return digito; }
      if (v === "0") return digito;
      if (v.replace("-", "").length >= 14) return v;
      return v + digito;
    });
  };

  const inserirPonto = () => {
    setVisor((v) => {
      if (aguardandoNovoValor) { setAguardandoNovoValor(false); return "0."; }
      return v.includes(".") ? v : v + ".";
    });
  };

  const calcular = (proximoOperador = null) => {
    if (operador === null || valorAnterior === null) {
      if (proximoOperador) { setOperador(proximoOperador); setAguardandoNovoValor(true); }
      return;
    }
    const atual = parseFloat(visor);
    let resultado = atual;
    if (operador === "+") resultado = valorAnterior + atual;
    else if (operador === "-") resultado = valorAnterior - atual;
    else if (operador === "×") resultado = valorAnterior * atual;
    else if (operador === "÷") resultado = atual === 0 ? Infinity : valorAnterior / atual;

    const texto = formatarResultado(resultado);
    setVisor(texto);
    setValorAnterior(proximoOperador ? parseFloat(texto) : null);
    setOperador(proximoOperador);
    setAguardandoNovoValor(true);
  };

  const escolherOperador = (op) => {
    if (operador && !aguardandoNovoValor) { calcular(op); return; }
    setValorAnterior(parseFloat(visor));
    setOperador(op);
    setAguardandoNovoValor(true);
  };

  const limpar = () => { setVisor("0"); setValorAnterior(null); setOperador(null); setAguardandoNovoValor(false); };
  const apagar = () => setVisor((v) => (v.length > 1 ? v.slice(0, -1) : "0"));
  const alternarSinal = () => setVisor((v) => (v === "0" ? v : v.startsWith("-") ? v.slice(1) : `-${v}`));
  const porcentagem = () => setVisor((v) => formatarResultado(parseFloat(v) / 100));

  const BotaoCalc = ({ children, onClick, cor = "numero", className = "" }) => {
    const estilos = {
      numero: { background: COR.cartao, color: COR.texto, border: `1px solid ${COR.linha}` },
      funcao: { background: COR.papelEscuro, color: COR.texto },
      operador: { background: COR.ouro, color: "white" },
      igual: { background: COR.tinta, color: COR.ouroClaro },
    };
    return (
      <button
        onClick={onClick}
        className={`h-14 rounded-xl text-lg font-semibold flex items-center justify-center active:opacity-70 ${className}`}
        style={estilos[cor]}
      >
        {children}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center oculta-impressao"
      style={{ background: "rgba(28,35,51,0.6)" }}
      onClick={aoFechar}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ background: COR.papel }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-6" style={{ background: COR.tinta }}>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Calculadora</p>
            <button onClick={aoFechar} style={{ color: "rgba(255,255,255,0.7)" }}><X size={18} /></button>
          </div>
          <p className="fonte-mono text-right text-4xl font-bold truncate" style={{ color: "white" }}>{visor}</p>
        </div>

        <div className="grid grid-cols-4 gap-2.5 p-4">
          <BotaoCalc onClick={limpar} cor="funcao">C</BotaoCalc>
          <BotaoCalc onClick={apagar} cor="funcao"><Delete size={18} /></BotaoCalc>
          <BotaoCalc onClick={porcentagem} cor="funcao">%</BotaoCalc>
          <BotaoCalc onClick={() => escolherOperador("÷")} cor="operador">÷</BotaoCalc>

          <BotaoCalc onClick={() => inserirNumero("7")}>7</BotaoCalc>
          <BotaoCalc onClick={() => inserirNumero("8")}>8</BotaoCalc>
          <BotaoCalc onClick={() => inserirNumero("9")}>9</BotaoCalc>
          <BotaoCalc onClick={() => escolherOperador("×")} cor="operador">×</BotaoCalc>

          <BotaoCalc onClick={() => inserirNumero("4")}>4</BotaoCalc>
          <BotaoCalc onClick={() => inserirNumero("5")}>5</BotaoCalc>
          <BotaoCalc onClick={() => inserirNumero("6")}>6</BotaoCalc>
          <BotaoCalc onClick={() => escolherOperador("-")} cor="operador">−</BotaoCalc>

          <BotaoCalc onClick={() => inserirNumero("1")}>1</BotaoCalc>
          <BotaoCalc onClick={() => inserirNumero("2")}>2</BotaoCalc>
          <BotaoCalc onClick={() => inserirNumero("3")}>3</BotaoCalc>
          <BotaoCalc onClick={() => escolherOperador("+")} cor="operador">+</BotaoCalc>

          <BotaoCalc onClick={alternarSinal} cor="funcao">+/-</BotaoCalc>
          <BotaoCalc onClick={() => inserirNumero("0")}>0</BotaoCalc>
          <BotaoCalc onClick={inserirPonto}>,</BotaoCalc>
          <BotaoCalc onClick={() => calcular()} cor="igual">=</BotaoCalc>
        </div>
      </div>
    </div>
  );
}

// ===================== ABA INÍCIO =====================
function InicioTab({ despesas, cartoes, pessoasAutomaticas, primeiroNome, onIrPara, onAbrirCalculadora }) {
  const mesAtual = mesAtualChave();

  const despesasMes = useMemo(() => despesas.filter((d) => chaveDoMes(d.vencimento) === mesAtual), [despesas, mesAtual]);
  const totalDespesasReais = despesasMes.reduce((s, d) => s + d.valor, 0);

  const cartoesComTotal = useMemo(() => cartoes.map((c) => {
    const porMes = {};
    for (const compra of c.compras) {
      const chave = chaveDoMes(compra.data);
      (porMes[chave] ||= []).push(compra);
    }
    return { ...c, totalMes: totalAutomaticoEmMes(porMes, mesAtual, pessoasAutomaticas) };
  }), [cartoes, mesAtual, pessoasAutomaticas]);

  const somaCartoesMes = cartoesComTotal.reduce((s, c) => s + c.totalMes, 0);
  const totalGeralMes = totalDespesasReais + somaCartoesMes;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="fonte-display text-2xl" style={{ color: COR.texto }}>
          Olá{primeiroNome ? `, ${primeiroNome}` : ""}
        </p>
        <p className="text-sm" style={{ color: COR.tintaSuave }}>{rotuloDoMes(mesAtual)}</p>
      </div>

      <button
        onClick={() => onIrPara("despesas")}
        className="text-left rounded-md px-5 py-4"
        style={{
          background: COR.tinta,
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 7px, ${COR.papel}22 7px, ${COR.papel}22 8px)`,
        }}
      >
        <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: COR.ouroClaro }}>Despesas deste mês</p>
        <p className="fonte-mono text-3xl font-bold mt-1" style={{ color: COR.papel }}>{fmt(totalGeralMes)}</p>
        <p className="text-xs mt-1" style={{ color: "#9AA1B4" }}>
          Despesas: <span className="fonte-mono">{fmt(totalDespesasReais)}</span> · Cartões: <span className="fonte-mono">{fmt(somaCartoesMes)}</span>
        </p>
      </button>

      <div>
        <p className="text-sm font-semibold mb-2" style={{ color: COR.texto }}>Cartões</p>
        <div className="flex flex-col gap-2">
          {cartoesComTotal.map((c) => (
            <button
              key={c.id}
              onClick={() => onIrPara(`cartao-${c.id}`)}
              className="flex items-center justify-between rounded-lg px-4 py-3"
              style={{ background: COR.cartao, border: `1px solid ${COR.linha}` }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.cor }} />
                <span className="text-sm font-medium truncate" style={{ color: COR.texto }}>{c.nome}</span>
              </div>
              <span className="fonte-mono text-sm font-semibold shrink-0" style={{ color: c.cor }}>{fmt(c.totalMes)}</span>
            </button>
          ))}
          {cartoesComTotal.length === 0 && (
            <p className="text-sm" style={{ color: COR.tintaSuave }}>Nenhum cartão cadastrado ainda.</p>
          )}
        </div>
      </div>

      <button
        onClick={onAbrirCalculadora}
        className="flex items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold text-white"
        style={{ background: COR.ouro }}
      >
        <IconeCalculadora size={16} /> Abrir calculadora
      </button>
    </div>
  );
}

// ===================== ABA DESPESAS =====================
function DespesasTab({ despesas, onAtualizarDespesas, cartoes, pessoasAutomaticas, pagamentosCartaoPagos, onAtualizarPagamentosCartao }) {
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualChave());
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nova, setNova] = useState({ descricao: "", valor: "", vencimento: "", categoria: CATEGORIAS[CATEGORIAS.length - 1] });
  const [editandoId, setEditandoId] = useState(null);
  const [rascunho, setRascunho] = useState(null);

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
    id: c.id,
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
  const totaisCartoes = fontesCartao.map((f) => ({
    ...f,
    total: f.totalPorMes(mesSelecionado),
    chavePagamento: `${f.id}-${mesSelecionado}`,
    pago: !!pagamentosCartaoPagos[`${f.id}-${mesSelecionado}`],
  }));
  const somaCartoes = totaisCartoes.reduce((s, f) => s + f.total, 0);
  const totalDespesasMes = linhas.reduce((s, d) => s + d.valor, 0);
  const totalMes = totalDespesasMes + somaCartoes;
  const totalPagoDespesas = linhas.filter((d) => d.paga).reduce((s, d) => s + d.valor, 0);
  const totalPagoCartoes = totaisCartoes.filter((f) => f.total > 0 && f.pago).reduce((s, f) => s + f.total, 0);
  const totalPago = totalPagoDespesas + totalPagoCartoes;
  const totalPendente = totalMes - totalPago;

  const toggleCartaoPago = (chave) => {
    onAtualizarPagamentosCartao((prev) => ({ ...prev, [chave]: !prev[chave] }));
  };

  const dadosGrafico = useMemo(() => chaves.slice(-12).map((chave) => {
    const totalD = (despesasPorMes[chave] || []).reduce((s, d) => s + d.valor, 0);
    const totalC = fontesCartao.reduce((s, f) => s + f.totalPorMes(chave), 0);
    const [, m] = chave.split("-");
    return { mesRotulo: MESES[parseInt(m, 10) - 1].slice(0, 3), total: totalD + totalC };
  }), [chaves, despesasPorMes, fontesCartao]);

  const adicionar = () => {
    const valor = valorMascaradoParaNumero(nova.valor);
    if (!nova.descricao.trim() || !nova.vencimento || !(valor > 0)) return;
    const novaDespesa = { id: uid(), descricao: nova.descricao.trim(), valor, vencimento: nova.vencimento, categoria: nova.categoria || "Outros", paga: false };
    onAtualizarDespesas([...despesas, novaDespesa]);
    setNova({ descricao: "", valor: "", vencimento: "", categoria: CATEGORIAS[CATEGORIAS.length - 1] });
    setMostrarForm(false);
    setMesSelecionado(chaveDoMes(novaDespesa.vencimento));
  };

  const iniciarEdicao = (d) => { setEditandoId(d.id); setRascunho({ ...d, valor: formatarValorDigitado(String(Math.round(d.valor * 100))) }); };

  const salvarEdicao = () => {
    const valor = valorMascaradoParaNumero(rascunho.valor);
    if (!rascunho.descricao.trim() || !rascunho.vencimento || !(valor > 0)) return;
    onAtualizarDespesas(despesas.map((d) =>
      d.id === editandoId
        ? { ...d, descricao: rascunho.descricao.trim(), valor, vencimento: rascunho.vencimento, categoria: rascunho.categoria }
        : d
    ));
    setEditandoId(null);
    setRascunho(null);
    setMesSelecionado(chaveDoMes(rascunho.vencimento));
  };

  const cancelarEdicao = () => { setEditandoId(null); setRascunho(null); };
  const excluir = (id) => onAtualizarDespesas(despesas.filter((d) => d.id !== id));
  const togglePaga = (id) => onAtualizarDespesas(despesas.map((d) => (d.id === id ? { ...d, paga: !d.paga } : d)));

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

      <button
        onClick={() => setMostrarForm((v) => !v)}
        className="flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold border-2 border-dashed transition-colors"
        style={{ borderColor: COR.ouro, color: COR.ouro }}
      >
        <Plus size={16} /> Adicionar despesa
      </button>

      {mostrarForm && (
        <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: COR.cartao, border: `1px solid ${COR.linha}` }}>
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
              type="text" inputMode="numeric" placeholder="0,00"
              value={nova.valor}
              onChange={(e) => setNova({ ...nova, valor: formatarValorDigitado(e.target.value) })}
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
        <div className="rounded-lg overflow-hidden" style={{ background: COR.cartao, border: `1px solid ${COR.linha}` }}>
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
                    type="text" inputMode="numeric"
                    value={rascunho.valor}
                    onChange={(e) => setRascunho({ ...rascunho, valor: formatarValorDigitado(e.target.value) })}
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
                <div className="px-3 py-2.5">
                  <div className="flex items-start gap-3">
                    <button onClick={() => togglePaga(d.id)} className="mt-0.5 shrink-0" title={d.paga ? "Marcar como pendente" : "Marcar como paga"}>
                      {d.paga ? <CheckCircle2 size={18} color={COR.verde} /> : <Circle size={18} color={COR.tintaSuave} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-medium break-words"
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
                  </div>
                  <div className="flex items-center justify-between mt-2 pl-7">
                    <span className="fonte-mono text-sm font-semibold">{fmt(d.valor)}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => iniciarEdicao(d)} style={{ color: COR.tintaSuave }}><Pencil size={14} /></button>
                      <BotaoExcluirConfirmar onConfirmar={() => excluir(d.id)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {totaisCartoes.filter((f) => f.total > 0).map((f, idx) => (
            <div key={f.id} style={{ borderTop: (linhas.length || idx > 0) ? `1px solid ${COR.linha}` : "none" }}>
              <div className="px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleCartaoPago(f.chavePagamento)} className="mt-0.5 shrink-0" title={f.pago ? "Marcar como pendente" : "Marcar como paga"}>
                    {f.pago ? <CheckCircle2 size={18} color={COR.verde} /> : <Circle size={18} color={COR.tintaSuave} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium break-words"
                      style={{ textDecoration: f.pago ? "line-through" : "none", color: f.pago ? COR.tintaSuave : COR.tinta }}
                    >
                      {f.label} — soma automática
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: f.corClara, color: f.cor }}>
                        <ArrowRight size={10} /> Cartão
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pl-7">
                  <span className="fonte-mono text-sm font-semibold" style={{ color: f.cor }}>{fmt(f.total)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dadosGrafico.length > 0 && (
        <div className="rounded-lg p-4" style={{ background: COR.cartao, border: `1px solid ${COR.linha}` }}>
          <p className="text-sm font-semibold mb-3" style={{ color: COR.texto }}>Evolução mensal</p>
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
function CartaoTab({ cartao, onAtualizarCompras, onGerarPdf, gerandoImagem, onPedirExclusao, pessoasAutomaticas }) {
  const { nome: nomeCartao, cor: corPrincipal, corClara, compras } = cartao;

  const [pessoaFiltro, setPessoaFiltro] = useState("todos");
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualChave());
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nova, setNova] = useState({ nome: "", compra: "", valor: "", data: "" });
  const [valorNegativo, setValorNegativo] = useState(false);
  const [mesCompra, setMesCompra] = useState(mesAtualChave());
  const [parcelada, setParcelada] = useState(false);
  const [parcelaAtual, setParcelaAtual] = useState("1");
  const [totalParcelas, setTotalParcelas] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [rascunho, setRascunho] = useState(null);

  const nomesUnicos = useMemo(
    () => [...new Set(compras.map((c) => primeiroNomeDe(c.nome)))].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [compras]
  );

  const comprasFiltradas = useMemo(
    () => (pessoaFiltro === "todos" ? compras : compras.filter((c) => primeiroNomeDe(c.nome).toLowerCase() === pessoaFiltro.toLowerCase())),
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
    const magnitude = valorMascaradoParaNumero(nova.valor);
    if (!nova.nome.trim() || !nova.compra.trim() || !(magnitude > 0) || !mesCompra) return;
    const valor = valorNegativo ? -magnitude : magnitude;

    const [anoBase, mesBase] = mesCompra.split("-").map(Number);

    let novosRegistros;
    if (parcelada) {
      const inicio = parseInt(parcelaAtual, 10);
      const total = parseInt(totalParcelas, 10);
      if (!(inicio >= 1) || !(total >= inicio)) return;
      const totalLimitado = Math.min(total, 120);
      novosRegistros = [];
      for (let numero = inicio; numero <= totalLimitado; numero++) {
        const dataParcela = new Date(anoBase, mesBase - 1 + (numero - inicio), 1);
        const dataStr = `${dataParcela.getFullYear()}-${String(dataParcela.getMonth() + 1).padStart(2, "0")}-01`;
        novosRegistros.push({
          id: uid(),
          nome: nova.nome.trim(),
          compra: `${nova.compra.trim()} (parcela ${numero}/${totalLimitado})`,
          valor,
          data: dataStr,
        });
      }
    } else {
      novosRegistros = [{ id: uid(), nome: nova.nome.trim(), compra: nova.compra.trim(), valor, data: `${mesCompra}-01` }];
    }

    onAtualizarCompras([...compras, ...novosRegistros]);
    setNova({ nome: "", compra: "", valor: "", data: "" });
    setValorNegativo(false);
    setParcelada(false);
    setParcelaAtual("1");
    setTotalParcelas("");
    setMostrarForm(false);
    setMesSelecionado(chaveDoMes(novosRegistros[0].data));
  };

  const iniciarEdicao = (c) => {
    setEditandoId(c.id);
    setRascunho({ ...c, valor: formatarValorDigitado(String(Math.round(Math.abs(c.valor) * 100))), negativo: c.valor < 0, mes: chaveDoMes(c.data) });
  };

  const salvarEdicao = () => {
    const magnitude = valorMascaradoParaNumero(rascunho.valor);
    if (!rascunho.nome.trim() || !rascunho.compra.trim() || !(magnitude > 0) || !rascunho.mes) return;
    const valor = rascunho.negativo ? -magnitude : magnitude;
    onAtualizarCompras(compras.map((c) =>
      c.id === editandoId
        ? { ...c, nome: rascunho.nome.trim(), compra: rascunho.compra.trim(), valor, data: `${rascunho.mes}-01` }
        : c
    ));
    setEditandoId(null);
    setRascunho(null);
    setMesSelecionado(rascunho.mes);
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
            disabled={linhasMes.length === 0 || gerandoImagem}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: COR.tinta }}
            title={pessoaFiltro === "todos" ? "Gera uma imagem do relatório do mês selecionado" : `Gera uma imagem do relatório de ${pessoaFiltro} no mês selecionado`}
          >
            <FileDown size={15} /> {gerandoImagem ? "Gerando..." : "Gerar imagem"}
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
        <div className="rounded-lg p-4 flex flex-col gap-3 oculta-impressao" style={{ background: COR.cartao, border: `1px solid ${COR.linha}` }}>
          <Campo label="Nome de quem comprou">
            <input
              className={inputBase} style={{ borderColor: COR.linha }}
              placeholder={pessoasAutomaticas[0] ? `Ex: ${pessoasAutomaticas[0]}` : "Nome de quem comprou"}
              value={nova.nome}
              onChange={(e) => setNova({ ...nova, nome: e.target.value })}
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
          <Campo label={parcelada ? "Mês da 1ª parcela lançada" : "Mês da compra"}>
            <input
              className={inputBase} style={{ borderColor: COR.linha }}
              type="month"
              value={mesCompra}
              onChange={(e) => setMesCompra(e.target.value)}
            />
          </Campo>
          <Campo label={parcelada ? "Valor da parcela (R$)" : "Valor (R$)"}>
            <input
              className={inputBase} style={{ borderColor: COR.linha }}
              type="text" inputMode="numeric" placeholder="0,00"
              value={nova.valor}
              onChange={(e) => setNova({ ...nova, valor: formatarValorDigitado(e.target.value) })}
            />
          </Campo>

          <label className="flex items-center gap-2 text-sm font-medium" style={{ color: COR.tintaSuave }}>
            <input
              type="checkbox"
              checked={valorNegativo}
              onChange={(e) => setValorNegativo(e.target.checked)}
              className="w-4 h-4"
              style={{ accentColor: corPrincipal }}
            />
            Valor negativo (pagamento antecipado / estorno)
          </label>

          <label className="flex items-center gap-2 text-sm font-medium" style={{ color: COR.tintaSuave }}>
            <input
              type="checkbox"
              checked={parcelada}
              onChange={(e) => setParcelada(e.target.checked)}
              className="w-4 h-4"
              style={{ accentColor: corPrincipal }}
            />
            Compra parcelada
          </label>

          {parcelada && (
            <>
              <Campo label="Em qual parcela ela está agora">
                <input
                  className={inputBase} style={{ borderColor: COR.linha }}
                  type="number" min="1" placeholder="Ex: 7"
                  value={parcelaAtual}
                  onChange={(e) => setParcelaAtual(e.target.value)}
                />
              </Campo>
              <Campo label="Total de parcelas">
                <input
                  className={inputBase} style={{ borderColor: COR.linha }}
                  type="number" min="1" placeholder="Ex: 12"
                  value={totalParcelas}
                  onChange={(e) => setTotalParcelas(e.target.value)}
                />
              </Campo>
              <p className="text-xs -mt-1" style={{ color: COR.tintaSuave }}>
                Vamos lançar essa compra a partir deste mês até a parcela {totalParcelas || "final"}, uma por mês, automaticamente.
              </p>
            </>
          )}

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
        <div className="rounded-lg oculta-impressao overflow-y-auto max-h-96" style={{ background: COR.cartao, border: `1px solid ${COR.linha}`, paddingBottom: 64 }}>
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
                    value={rascunho.compra}
                    onChange={(e) => setRascunho({ ...rascunho, compra: e.target.value })}
                  />
                  <input
                    className={inputBase} style={{ borderColor: COR.linha }}
                    type="month"
                    value={rascunho.mes}
                    onChange={(e) => setRascunho({ ...rascunho, mes: e.target.value })}
                  />
                  <input
                    className={inputBase} style={{ borderColor: COR.linha }}
                    type="text" inputMode="numeric"
                    value={rascunho.valor}
                    onChange={(e) => setRascunho({ ...rascunho, valor: formatarValorDigitado(e.target.value) })}
                  />
                  <label className="flex items-center gap-2 text-sm font-medium" style={{ color: COR.tintaSuave }}>
                    <input
                      type="checkbox"
                      checked={!!rascunho.negativo}
                      onChange={(e) => setRascunho({ ...rascunho, negativo: e.target.checked })}
                      className="w-4 h-4"
                      style={{ accentColor: corPrincipal }}
                    />
                    Valor negativo (pagamento antecipado / estorno)
                  </label>
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelarEdicao} className="p-1.5 rounded-md" style={{ color: COR.tintaSuave }}><X size={16} /></button>
                    <button onClick={salvarEdicao} className="p-1.5 rounded-md text-white" style={{ background: corPrincipal }}><Check size={16} /></button>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                      style={{
                        background: ehPessoaAutomatica(c.nome, pessoasAutomaticas) ? corPrincipal : COR.papelEscuro,
                        color: ehPessoaAutomatica(c.nome, pessoasAutomaticas) ? "white" : COR.tintaSuave,
                      }}
                    >
                      {c.nome}
                    </span>
                    <p className="text-sm font-medium break-words min-w-0 flex-1">{c.compra}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="fonte-mono text-sm font-semibold">{fmt(c.valor)}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => iniciarEdicao(c)} style={{ color: COR.tintaSuave }}><Pencil size={14} /></button>
                      <BotaoExcluirConfirmar onConfirmar={() => excluir(c.id)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 oculta-impressao">
        <button onClick={onPedirExclusao} className="w-full text-center text-xs font-medium py-1" style={{ color: COR.tintaSuave }}>
          Excluir este cartão
        </button>
      </div>
    </div>
  );
}

