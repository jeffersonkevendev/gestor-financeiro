import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANTE: troque "meu-caixa" pelo nome exato do seu repositório no GitHub.
// Ex: se o repositório é https://github.com/seu-usuario/financas-app,
// o base deve ser "/financas-app/".
export default defineConfig({
  plugins: [react()],
  base: "/gestor-financeiro/",
});
