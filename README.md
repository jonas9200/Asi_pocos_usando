# AGS Lista de Poços v2 — Painel Universal MQTT

Sistema de gerenciamento de equipamentos de irrigação com **painel de controle universal**.
Um único HTML serve todos os equipamentos — cada um com seus próprios tópicos MQTT.

---

## Como funciona

```
Admin cadastra equipamento (nome + ID ex: "C2")
           ↓
Sistema gera automaticamente os tópicos:
  as/poco/C2/comando   ← Liga/Desliga
  as/poco/C2/dados     ← JSON do ESP32 (live)
  as/poco/C2/status    ← online/offline

Operador vê a lista → clica no card → abre painel já configurado para aquele equipamento
```

---

## Estrutura

```
ags-lista-pocos/
├── server.js              ← Backend Node.js (API + GitHub storage)
├── package.json
├── equipments.json        ← Arquivo inicial (vazio) — suba no GitHub
└── public/
    ├── admin.html         ← Painel Admin (CRUD completo)
    ├── operador.html      ← Lista de equipamentos para operador
    └── painel.html        ← Painel de controle UNIVERSAL (serve todos)
```

**Rotas:**
- `/`          → Admin (CRUD)
- `/operador`  → Lista para operador
- `/painel?id=EQUIPMENT_ID` → Painel de controle (carrega dinamicamente)

---

## Deploy no Render

### 1. Criar repositório no GitHub
- Crie um repositório (público ou privado)
- Faça upload de todos os arquivos
- Confirme que `equipments.json` está na raiz com conteúdo `[]`

### 2. Criar Token GitHub
- GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
- **Generate new token** → marque a permissão `repo` → copie o token

### 3. Deploy no Render
- [render.com](https://render.com) → **New → Web Service**
- Conecte ao repositório
- Configure:
  - **Build Command:** `npm install`
  - **Start Command:** `npm start`

### 4. Variáveis de Ambiente
Na aba **Environment** do serviço:

| Variável       | Valor                            |
|----------------|----------------------------------|
| `GITHUB_TOKEN` | Token gerado no passo 2          |
| `GITHUB_OWNER` | Seu usuário GitHub               |
| `GITHUB_REPO`  | Nome do repositório              |

---

## Como cadastrar um equipamento

1. Acesse `/` (Admin)
2. Clique em **Adicionar Equipamento**
3. Preencha:
   - **Nome:** Poço C2
   - **Tipo:** Poço
   - **ID do Poço:** `C2`  ← o sistema monta os tópicos automaticamente
   - **Localização:** As5
4. Os tópicos gerados aparecerão em tempo real no formulário:
   - `as/poco/C2/comando`
   - `as/poco/C2/dados`
   - `as/poco/C2/status`
5. Salvar → dados vão para o GitHub

---

## ESP32 — Tópicos esperados

O painel espera receber no tópico `as/poco/{ID}/dados` um JSON com:

```json
{
  "Ultima_atualizacao": "2026-03-18 10:30:00 (Qua)",
  "Ligado_desligado":   "1",
  "Aut_man":            "0",
  "Falha":              "0",
  "Programacao_ativa":  false,
  "Dias_mascara":       127,
  "Horario_iniciar":    "08:00",
  "Horario_parar":      "17:00"
}
```

Comandos enviados no tópico `as/poco/{ID}/comando`:
- `Liga` → liga o poço
- `Desliga` → desliga o poço
- `{P:1,I:0800,F:1700,K:127}` → configura programação

---

## Broker MQTT

Configurado em `painel.html`:
```
wss://mqtt.aguasanta.agr.br
Usuário: coas
```
Para alterar, edite as linhas no `painel.html`:
```js
const BROKER = 'wss://mqtt.aguasanta.agr.br';
// ...
username: 'coas',
password: 'AguaSanta@452',
```
