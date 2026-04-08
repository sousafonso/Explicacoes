# MatemaLab

Webapp Node.js para um explicador de Matemática publicar exercícios organizados por ano e matéria, com acesso público para alunos e uma área de administração protegida por sessão.

## Funcionalidades

- Área pública moderna e responsiva.
- 10.º, 11.º e 12.º ano com organização por matéria.
- Upload de PDFs e imagens.
- Painel admin com autenticação por sessão.
- Remoção de exercícios.
- Sem login do lado dos alunos.
- Tema claro/escuro.

## Instalação

```bash
npm install
cp .env.example .env
```

Depois gera um hash bcrypt para a tua password:

```bash
node -e "console.log(require('bcryptjs').hashSync('A_TUA_PASSWORD', 10))"
```

Coloca esse valor em `ADMIN_PASSWORD_HASH` e define `ADMIN_USERNAME` e `ADMIN_SESSION_SECRET`.

## Arranque

```bash
npm run dev
```

## Deploy no Render (gratuito)

Esta app ja esta preparada para deploy no Render com o ficheiro `render.yaml`.

### 1) Publicar codigo no GitHub

```bash
git init
git add .
git commit -m "prepare app for Render"
git branch -M main
git remote add origin <URL_DO_TEU_REPO>
git push -u origin main
```

### 2) Criar Web Service no Render

1. Entra em <https://render.com> e liga a tua conta GitHub.
2. Clica em `New +` -> `Blueprint` (recomendado, usa `render.yaml`) ou `Web Service`.
3. Seleciona o repositório.
4. Confirma branch `main` e cria o serviço.

### 3) Definir variaveis de ambiente no Render

No painel do servico, em `Environment`, define:

1. `ADMIN_USERNAME`
2. `ADMIN_PASSWORD_HASH`
3. `ADMIN_SESSION_SECRET`

Podes gerar hash bcrypt localmente com:

```bash
node -e "console.log(require('bcryptjs').hashSync('A_TUA_PASSWORD', 10))"
```

### 4) Testar apos deploy

1. Abre a URL publica gerada pelo Render.
2. Testa `/admin/login`.
3. Faz upload de um exercicio para validar o fluxo.

## Limitacao importante do plano free

No free tier, o sistema de ficheiros da instancia e efemero.
Isto significa que uploads e alteracoes em `data/exercises.json` podem perder-se apos restart/redeploy.

Para manter dados em producao, migra para servicos persistentes:

1. Ficheiros: Cloudinary, S3-compativel, etc.
2. Dados: Postgres (ex.: Supabase, Neon, Render Postgres).

## Rotas

- `/`
- `/materia/10`, `/materia/11`, `/materia/12`
- `/admin/login`
- `/admin`
