import test from "node:test";
import assert from "node:assert/strict";
import { criarSincronizacaoNuvem } from "./sincronizacaoNuvem.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const snapshot = (dados, metadata = {}) => ({
  metadata: { fromCache: false, hasPendingWrites: false, ...metadata },
  exists: () => dados !== null,
  data: () => dados,
});

function preparar(t, gravar = async () => {}, tempoLeitura = 15000) {
  let sucesso, falha, estado;
  let cancelamentos = 0;
  const controle = criarSincronizacaoNuvem({
    padrao: { despesas: [], receitas: [], pagamentos: {}, orcamento: 0 },
    escutar: (ok, erro) => { sucesso = ok; falha = erro; return () => cancelamentos++; },
    gravar,
    tempoLeitura,
    notificar: (novo) => { estado = novo; },
  });
  t.after(() => controle.parar());
  controle.iniciar();
  return { controle, get estado() { return estado; }, get sucesso() { return sucesso; }, get falha() { return falha; }, get cancelamentos() { return cancelamentos; } };
}

test("erro de leitura bloqueia alterações e nova tentativa recupera dados", async (t) => {
  let escritas = 0;
  const app = preparar(t, async () => escritas++);
  app.falha({ code: "permission-denied" });
  assert.match(app.estado.erroLeitura, /recusou/);
  assert.equal(app.estado.carregando, false);
  app.controle.alterar("despesas", [1]);
  assert.equal(escritas, 0);
  app.controle.tentarNovamente();
  app.sucesso(snapshot({ despesas: [42] }));
  assert.deepEqual(app.estado.dados.despesas, [42]);
  assert.equal(app.estado.erroLeitura, "");
});

test("cache vazio não inicializa documento nem libera edição", (t) => {
  let escritas = 0;
  const app = preparar(t, async () => escritas++);
  app.sucesso(snapshot(null, { fromCache: true }));
  app.controle.alterar("receitas", [1]);
  assert.equal(app.estado.carregando, true);
  assert.equal(escritas, 0);
  app.sucesso(snapshot(null));
  assert.equal(app.estado.carregando, false);
  assert.equal(escritas, 0);
});

test("grava apenas o campo alterado e confirma após a resposta", async (t) => {
  let concluir;
  const patches = [];
  const app = preparar(t, (patch) => { patches.push(patch); return new Promise((resolve) => { concluir = resolve; }); });
  app.sucesso(snapshot({ perfil: { nome: "Teste" }, receitas: [10] }));
  app.controle.alterar("despesas", [20]);
  assert.deepEqual(patches, [{ despesas: [20] }]);
  assert.equal(app.estado.temPendencias, true);
  assert.equal(app.estado.salvando, true);
  concluir();
  await tick();
  assert.equal(app.estado.temPendencias, false);
  assert.deepEqual(app.estado.dados.perfil, { nome: "Teste" });
  assert.deepEqual(app.estado.dados.receitas, [10]);
});

test("falha ao salvar preserva alterações para tentar novamente", async (t) => {
  const patches = [];
  let falhar = true;
  const app = preparar(t, async (patch) => {
    patches.push(patch);
    if (falhar) throw { code: "permission-denied" };
  });
  app.sucesso(snapshot({ despesas: [1] }));
  app.controle.alterar("despesas", (anterior) => [...anterior, 2]);
  await tick();
  app.sucesso(snapshot({ despesas: [1] }));
  assert.deepEqual(app.estado.dados.despesas, [1, 2]);
  assert.equal(app.estado.temPendencias, true);
  assert.match(app.estado.erroSalvar, /recusou/);
  falhar = false;
  app.controle.tentarNovamente();
  await tick();
  assert.deepEqual(patches, [{ despesas: [1, 2] }, { despesas: [1, 2] }]);
  assert.equal(app.estado.temPendencias, false);
  assert.equal(app.estado.erroSalvar, "");
});

test("alterações rápidas são serializadas sem perder valores ou outros campos", async (t) => {
  const patches = [];
  const resolver = [];
  const app = preparar(t, (patch) => { patches.push(patch); return new Promise((resolve) => resolver.push(resolve)); });
  app.sucesso(snapshot({ despesas: [1] }));
  app.controle.alterar("despesas", (anterior) => [...anterior, 2]);
  app.controle.alterar("despesas", (anterior) => [...anterior, 3]);
  app.controle.alterar("receitas", [8]);
  app.sucesso(snapshot({ despesas: [1, 2] }));
  assert.deepEqual(app.estado.dados.despesas, [1, 2, 3]);
  assert.equal(patches.length, 1);
  resolver.shift()();
  await tick();
  assert.deepEqual(patches[1], { despesas: [1, 2, 3], receitas: [8] });
  resolver.shift()();
  await tick();
  assert.equal(app.estado.temPendencias, false);
  assert.deepEqual(app.estado.dados.receitas, [8]);
});

test("sem conexão a gravação continua pendente, sem falso sucesso", (t) => {
  const app = preparar(t, () => new Promise(() => {}));
  app.sucesso(snapshot({ despesas: [1] }));
  app.controle.alterar("despesas", [2]);
  app.sucesso(snapshot({ despesas: [2] }, { hasPendingWrites: true }));
  assert.equal(app.estado.salvando, true);
  assert.equal(app.estado.temPendencias, true);
});

test("exclusão de pagamentos envia o mapa vazio como campo completo", async (t) => {
  const patches = [];
  const app = preparar(t, async (patch) => patches.push(patch));
  app.sucesso(snapshot({ pagamentos: { janeiro: true } }));
  app.controle.alterar("pagamentos", {});
  await tick();
  assert.deepEqual(patches, [{ pagamentos: {} }]);
  assert.deepEqual(app.estado.dados.pagamentos, {});
});

test("falhas de leitura e escrita simultâneas preservam a alteração no retry", async (t) => {
  let falhar = true;
  const app = preparar(t, async () => { if (falhar) throw { code: "unavailable" }; });
  app.sucesso(snapshot({ despesas: [1] }));
  app.controle.alterar("despesas", [2]);
  app.falha({ code: "permission-denied" });
  await tick();
  falhar = false;
  app.controle.tentarNovamente();
  assert.equal(app.estado.temPendencias, true);
  app.sucesso(snapshot({ despesas: [1] }));
  await tick();
  assert.deepEqual(app.estado.dados.despesas, [2]);
  assert.equal(app.estado.temPendencias, false);
  assert.equal(app.estado.erroLeitura, "");
});

test("leitura sem resposta termina com mensagem de conexão", async (t) => {
  const app = preparar(t, async () => {}, 5);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(app.estado.carregando, false);
  assert.match(app.estado.erroLeitura, /internet/);
});

test("callbacks de sessão antiga não alteram a sessão atual", async (t) => {
  let concluir;
  const app = preparar(t, () => new Promise((resolve) => { concluir = resolve; }));
  const antiga = app.sucesso;
  app.falha({ code: "unavailable" });
  app.controle.tentarNovamente();
  antiga(snapshot({ despesas: [99] }));
  assert.equal(app.estado.carregando, true);
  app.sucesso(snapshot({ despesas: [1] }));
  app.controle.alterar("despesas", [2]);
  const estado = app.estado;
  app.controle.parar();
  concluir();
  await tick();
  app.sucesso(snapshot({ despesas: [99] }));
  assert.equal(app.estado, estado);
});
