# Meu Caixa

App de controle de despesas com abas Despesas, Cartão Nubank e Cartão Americanas.

## Rodar localmente

```bash
npm install
npm run dev
```

## Publicar no GitHub Pages

1. Renomeie a pasta / crie um repositório no GitHub (ex: `meu-caixa`).
2. Em `vite.config.js`, troque `base: "/meu-caixa/"` pelo nome exato do seu repositório.
3. Suba o código:
   ```bash
   git init
   git add .
   git commit -m "primeira versão"
   git branch -M main
   git remote add origin https://github.com/jeffersonkevendev/gestor-financeiro.git
   git push -u origin main
   ```
4. No GitHub, vá em **Settings → Pages** e em "Build and deployment" escolha a fonte **GitHub Actions**.
5. O workflow em `.github/workflows/deploy.yml` builda e publica automaticamente a cada push na branch `main`.
6. Depois do primeiro deploy (alguns minutos), o site fica em:
   `https://jeffersonkevendev.github.io/gestor-financeiro/`
