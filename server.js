import express from 'express';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

const app = express();
const pool = new pg.Pool({ connectionString: process.env.DB_URL, connectionTimeoutMillis: 5000 });
app.use(express.json({ limit: '32kb' }));
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));
async function initialize() {
  if (!process.env.DB_URL) throw new Error('DB_URL is required');
  await pool.query(`CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY, conversation UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`);
}
const validId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
app.get('/health', async (_req, res) => {
  try { await initialize(); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ error: 'Database unavailable' }); }
});
app.get('/api/messages/:conversation', async (req, res, next) => {
  if (!validId(req.params.conversation)) return res.status(400).json({ error: 'Invalid conversation' });
  try {
    await initialize();
    const { rows } = await pool.query('SELECT role, content FROM messages WHERE conversation = $1 ORDER BY id', [req.params.conversation]);
    res.json(rows);
  } catch (error) { next(error); }
});
app.post('/api/chat', async (req, res, next) => {
  const { conversation, message } = req.body;
  if (!validId(conversation) || typeof message !== 'string' || !message.trim() || message.length > 10000)
    return res.status(400).json({ error: 'Provide a conversation UUID and a message of 1–10000 characters' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is required' });
  try {
    await initialize();
    const { rows } = await pool.query('SELECT role, content FROM messages WHERE conversation = $1 ORDER BY id DESC LIMIT 40', [conversation]);
    const response = await fetch(`${(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [...rows.reverse(), { role: 'user', content: message }] }),
      signal: AbortSignal.timeout(60000)
    });
    if (!response.ok) return res.status(502).json({ error: 'Model provider rejected the request' });
    const reply = (await response.json()).choices?.[0]?.message?.content;
    if (typeof reply !== 'string') return res.status(502).json({ error: 'Provider returned no text' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO messages (conversation, role, content) VALUES ($1, $2, $3), ($1, $4, $5)', [conversation, 'user', message, 'assistant', reply]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    res.json({ reply });
  } catch (error) { next(error); }
});
app.use((error, _req, res, _next) => {
  console.error(error.name);
  res.status(500).json({ error: 'Chat request failed' });
});
const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
process.on('SIGTERM', () => server.close(() => pool.end()));
