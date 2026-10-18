# Meu Caixa

Aplicativo web de controle financeiro pessoal para organizar receitas, despesas e compras no cartão, com identificação de pessoas e sincronização pelo Firebase.

**[Acessar o aplicativo](https://jeffersonkevendev.github.io/gestor-financeiro/)**

## Funcionalidades

- **Login com Google:** acesso à conta sem formulário de e-mail e senha.
- **Visão geral:** acompanhamento das receitas, despesas, orçamento e compromissos do mês.
- **Despesas:** cadastro, edição, vencimentos, pagamentos e repetições mensais.
- **Cartões:** cadastro de cartões, acompanhamento das faturas e configuração do vencimento.
- **Compras:** lançamentos à vista ou parcelados, estornos e pagamentos antecipados.
- **Divisão de compras:** distribuição do valor entre pessoas, com exibição agrupada do lançamento.
- **Filtros:** seleção de mês e pessoas, busca por compra ou nome e resumo por pessoa.
- **Identificação visual:** logos de bancos e empresas, com ícones por categoria quando não houver uma marca reconhecida.
- **Gráficos:** acompanhamento da evolução mensal das despesas e dos cartões.
- **Compra por voz:** registro de compras à vista em navegadores compatíveis, com autorização do microfone.
- **Ferramentas:** calculadora, ocultação de valores, geração de imagem do relatório e exportação dos dados.
- **Desfazer exclusão:** recuperação pelo aviso exibido após a remoção de um registro.
- **Sincronização:** mensagens de erro, indicação de alterações pendentes e nova tentativa de gravação no Firestore.

## Tecnologias

| Tecnologia | Uso |
| --- | --- |
| React e JSX | Interface e componentes |
| Vite | Desenvolvimento e compilação |
| Tailwind CSS | Estilos e layout responsivo |
| Firebase Authentication | Autenticação com Google |
| Cloud Firestore | Armazenamento dos dados por usuário |
| Recharts | Gráficos |
| Lucide React | Ícones |
| html2canvas | Geração de imagens dos relatórios |
| GitHub Actions e GitHub Pages | Compilação e publicação |

## Executar localmente

Use Node.js 20, como no workflow de publicação, e npm.

```bash
git clone https://github.com/jeffersonkevendev/gestor-financeiro.git
cd gestor-financeiro
npm install
npm run dev
```

Abra o endereço informado pelo Vite no terminal.

### Configurar o Firebase

A configuração do cliente fica em `src/firebase.js`. Para utilizar seu próprio projeto:

1. Crie um aplicativo web no console Firebase e copie a configuração para `firebaseConfig` nesse arquivo.
2. Ative o provedor **Google** em Authentication.
3. Confira os domínios autorizados em Authentication, incluindo `localhost` para desenvolvimento e o domínio usado na publicação.
4. Crie o banco Cloud Firestore e configure regras que restrinjam o acesso ao documento do usuário autenticado.

O app usa o caminho `usuarios/{uid}`, em que `uid` é o identificador da conta autenticada. As regras do Firestore devem proteger esse caminho; a configuração pública do cliente não substitui o controle de acesso.

## Estrutura principal

| Arquivo ou pasta | Finalidade |
| --- | --- |
| `src/App.jsx` | Interface, navegação e funcionalidades |
| `src/firebase.js` | Inicialização do Firebase |
| `src/sincronizacaoNuvem.js` | Controle da leitura e gravação dos dados |
| `src/sincronizacaoNuvem.test.js` | Testes da sincronização |
| `src/main.jsx` | Entrada do React |
| `src/index.css` | Estilos globais |
| `public/` | Arquivos públicos |
| `.github/workflows/deploy.yml` | Publicação no GitHub Pages |
| `vite.config.js` | Configuração do Vite e caminho do site |

**O arquivo utilizado pelo aplicativo é `src/App.jsx`.** Ao atualizar a interface, substitua esse arquivo dentro de `src`.

## Verificar alterações

```bash
node --test src/sincronizacaoNuvem.test.js
npm run build
npm run preview
```

Os testes verificam o comportamento da sincronização com respostas simuladas. Depois de publicar, confira também o login e o salvamento com uma conta real.

## Publicar no GitHub Pages

O repositório já possui o workflow `.github/workflows/deploy.yml`.

1. Em **Settings → Pages**, selecione **GitHub Actions** como fonte da publicação.
2. Envie as alterações para a branch `main`.
3. Acompanhe a compilação e a publicação na aba **Actions**.
4. Acesse [jeffersonkevendev.github.io/gestor-financeiro/](https://jeffersonkevendev.github.io/gestor-financeiro/).

O `base` de `vite.config.js` está configurado como `/gestor-financeiro/`. Se mudar o nome do repositório, ajuste esse caminho.

Esse workflow publica no **GitHub Pages**. Atualizar este repositório não atualiza automaticamente um endereço do Firebase Hosting.

## Dados e uso

- A conta Google identifica o documento usado para armazenar os dados financeiros. Para acessar os mesmos dados, entre com a mesma conta.
- Aguarde o fim do aviso de salvamento antes de fechar a página ou sair da conta. Alterações pendentes podem estar somente na sessão atual.
- Se ocorrer uma falha, mantenha a página aberta e use a opção de tentar novamente.
- Use a exportação dos dados para manter uma cópia dos registros.
- O reconhecimento de voz depende do navegador e pode utilizar um serviço online para processar o áudio.

## Autor

Desenvolvido por [Jefferson Keven](https://github.com/jeffersonkevendev).
