const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const GITHUB_TOKEN     = process.env.GITHUB_TOKEN;
const GITHUB_OWNER     = process.env.GITHUB_OWNER;
const GITHUB_REPO      = process.env.GITHUB_REPO;
const GITHUB_FILE_PATH = 'equipments.json';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// ── GITHUB ────────────────────────────────────────────────
async function ghRequest(endpoint, options = {}) {
    const res = await fetch(`https://api.github.com${endpoint}`, {
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Content-Type':  'application/json',
            'User-Agent':    'AGS-Lista-Pocos',
            ...options.headers
        },
        ...options
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    return res.json();
}

async function readData() {
    try {
        const file = await ghRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`);
        const txt  = Buffer.from(file.content, 'base64').toString('utf8');
        if (!txt.trim()) return [];
        return JSON.parse(txt);
    } catch (err) {
        if (err.message.includes('404')) { await saveData([]); return []; }
        console.error('readData:', err.message);
        return [];
    }
}

async function saveData(data) {
    let sha = null;
    try {
        const cur = await ghRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`);
        sha = cur.sha;
    } catch (_) {}
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    await ghRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`, {
        method: 'PUT',
        body: JSON.stringify({
            message: `update equipments ${new Date().toISOString()}`,
            content,
            sha
        })
    });
}

// ── API ───────────────────────────────────────────────────
app.get('/api/equipments', async (_req, res) => {
    try { res.json(await readData()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/equipments', async (req, res) => {
    try {
        const { name, type, location, poco_id, description } = req.body;
        if (!name || !poco_id) return res.status(400).json({ error: 'name e poco_id são obrigatórios' });
        const list = await readData();
        const item = {
            id:          Date.now().toString(),
            name:        name.trim(),
            type:        (type || 'Poço').trim(),
            location:    (location || '').trim(),
            poco_id:     poco_id.trim(),
            description: (description || '').trim(),
            // tópicos montados automaticamente
            topic_cmd:    `as/poco/${poco_id.trim()}/comando`,
            topic_dados:  `as/poco/${poco_id.trim()}/dados`,
            topic_status: `as/poco/${poco_id.trim()}/status`,
            createdAt:   new Date().toISOString(),
            updatedAt:   new Date().toISOString()
        };
        list.push(item);
        await saveData(list);
        res.status(201).json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/equipments/:id', async (req, res) => {
    try {
        const list = await readData();
        const idx  = list.findIndex(e => e.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
        const { name, type, location, poco_id, description } = req.body;
        const pid = (poco_id || list[idx].poco_id).trim();
        list[idx] = {
            ...list[idx],
            name:         (name        || list[idx].name).trim(),
            type:         (type        || list[idx].type).trim(),
            location:     (location    != null ? location    : list[idx].location).trim(),
            poco_id:      pid,
            description:  (description != null ? description : list[idx].description).trim(),
            topic_cmd:    `as/poco/${pid}/comando`,
            topic_dados:  `as/poco/${pid}/dados`,
            topic_status: `as/poco/${pid}/status`,
            updatedAt:    new Date().toISOString()
        };
        await saveData(list);
        res.json(list[idx]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/equipments/:id', async (req, res) => {
    try {
        let list = await readData();
        const eq = list.find(e => e.id === req.params.id);
        if (!eq) return res.status(404).json({ error: 'Não encontrado' });
        list = list.filter(e => e.id !== req.params.id);
        await saveData(list);
        res.json({ ok: true, deleted: eq });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', async (_req, res) => {
    try {
        const list = await readData();
        res.json({ status: 'ok', equipments: list.length, timestamp: new Date().toISOString() });
    } catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
});

// ── PÁGINAS ───────────────────────────────────────────────
app.get('/',         (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/operador', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'operador.html')));
app.get('/painel',   (_req, res) => res.sendFile(path.join(__dirname, 'public', 'painel.html')));
app.get('/admin',    (_req, res) => res.redirect('/'));

// ── START ─────────────────────────────────────────────────
async function start() {
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
        console.error('Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO');
        process.exit(1);
    }
    const list = await readData();
    console.log(`GitHub OK — ${list.length} equipamento(s).`);
    app.listen(PORT, () => console.log(`Porta ${PORT}`));
}
start();
