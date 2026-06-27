-- Tabela de usuários (traders e administrador)
-- Executado automaticamente pelo servidor a cada inicialização (ver src/migrate.js)
-- "IF NOT EXISTS" garante que não dá erro se a tabela já existir.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'trader' CHECK (role IN ('trader', 'admin')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Sessões do Diário de Trader, uma por dia por usuário.
-- pdf_stats guarda as ~32 métricas importadas do PDF do BlackArrow (formato livre, por isso JSONB).
CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  market VARCHAR(50),
  total_result NUMERIC(12,2) NOT NULL DEFAULT 0,
  vp VARCHAR(80),
  renko_100r VARCHAR(80),
  renko_50r VARCHAR(80),
  vwap_note VARCHAR(80),
  rule3 VARCHAR(80),
  risk_rule VARCHAR(80),
  disc_star INTEGER NOT NULL DEFAULT 0,
  good TEXT,
  improve TEXT,
  intent TEXT,
  emotions JSONB NOT NULL DEFAULT '[]',
  errors JSONB NOT NULL DEFAULT '[]',
  pdf_stats JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON journal_entries (user_id, entry_date);

-- Relatórios publicados em "Análise de Mercado". A avaliação fica nas próprias
-- colunas (eval_*) porque é sempre 1 por relatório — não precisa de tabela própria.
CREATE TABLE IF NOT EXISTS market_reports (
  id SERIAL PRIMARY KEY,
  macro TEXT,
  tecnica TEXT,
  resumo TEXT,
  image TEXT,
  like_count INTEGER NOT NULL DEFAULT 0,
  eval_rating INTEGER,
  eval_text TEXT,
  eval_time TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_reports_created_at ON market_reports (created_at DESC);

-- Comentários de visitantes em cada relatório, com espaço pra uma resposta
-- do Analista (reply_*). Sem login — só nome e texto, por escolha do produto.
CREATE TABLE IF NOT EXISTS market_comments (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES market_reports(id) ON DELETE CASCADE,
  author VARCHAR(255) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reply_text TEXT,
  reply_time TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_comments_report ON market_comments (report_id);

-- E-mails de quem clicou em "Avisar quando publicar uma nova análise".
-- Por enquanto só guarda — o envio automático de e-mail é uma etapa futura.
CREATE TABLE IF NOT EXISTS subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Mensagens enviadas pelo formulário de contato (área Sobre).
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
