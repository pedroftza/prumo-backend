# Prumo Backend (API de autenticação)

API que dá suporte ao login real do site da Prumo — substitui as senhas
de demonstração que existiam no painel.

## O que esse projeto faz nessa primeira fase

- Cria contas de trader (visitantes do Diário) com nome, e-mail e senha de verdade.
- Cria UMA conta de administrador (a sua), protegida por um código secreto.
- Faz login validando a senha de verdade (criptografada no banco, nunca em texto puro).
- Devolve um "token" que o site guarda no navegador pra saber que você está logado.

Isso ainda **não** salva as sessões do Diário nem os relatórios da Análise
de Mercado — essas são as próximas fases.

## Passo a passo no Render

### 1. Subir esse código pro GitHub

Mesma lógica que você já fez com o site: crie um repositório novo (ex:
`prumo-backend`) e suba todos esses arquivos por lá (pelo "Add file →
Upload files" do GitHub, como fizemos antes). **Não suba o arquivo `.env`**
se você criar um — ele é só pra teste local, e já está na lista de arquivos
ignorados.

### 2. Criar o banco de dados no Render

1. No painel do Render, clique em **New → PostgreSQL**.
2. Dê um nome (ex: `prumo-db`), escolha a região e o plano gratuito.
3. Clique em **Create Database**. Espere alguns minutos até o status
   ficar "Available".

### 3. Criar o serviço da API no Render

1. Clique em **New → Web Service**.
2. Selecione o repositório `prumo-backend` que você subiu.
3. Confirme as configurações:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Antes de clicar em criar, role até **Environment Variables** e adicione:
   - `DATABASE_URL` → copie da página do banco que você criou no passo 2
     (procure por "Internal Database URL" ou "Connection String" lá).
   - `JWT_SECRET` → invente um texto longo e aleatório (tipo uma senha de 40 caracteres).
   - `ADMIN_SETUP_CODE` → invente outro texto secreto, só pra criar sua conta de admin uma vez.
   - `ALLOWED_ORIGINS` → `https://prumotrading.com,https://www.prumotrading.com`
   - `NODE_ENV` → `production`
5. Clique em **Create Web Service**. Acompanhe os logs — quando aparecer
   "API da Prumo rodando na porta...", está no ar.
6. Copie o endereço que o Render deu pro serviço (algo como
   `https://prumo-backend-xxxx.onrender.com`) — você vai precisar dele no
   próximo passo, lá no painel da Prumo.

### 4. Criar sua conta de administrador (uma única vez)

Depois que o serviço estiver no ar, você (ou eu, te ajudando) vai chamar o
endpoint `/api/auth/setup-admin` uma única vez com seu nome, e-mail, senha
e o `ADMIN_SETUP_CODE` que você escolheu. Eu te ajudo a fazer essa chamada
quando chegar nessa etapa — depois disso, essa porta se fecha sozinha e
ninguém mais consegue criar outra conta admin, mesmo sabendo o código.

## Variáveis de ambiente (resumo)

| Nome | O que é |
|---|---|
| `DATABASE_URL` | Endereço de conexão do banco PostgreSQL (o Render fornece) |
| `JWT_SECRET` | Texto secreto usado para validar os logins |
| `ADMIN_SETUP_CODE` | Código de uso único pra criar a conta de administrador |
| `ALLOWED_ORIGINS` | Quais sites podem chamar essa API |
| `NODE_ENV` | Deixe como `production` |
