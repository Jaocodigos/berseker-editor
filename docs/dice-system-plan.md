# Plano de Implementacao — Sistema de Calculo de Dados

## Contexto

Hoje o campo `dano` das habilidades e apenas texto descritivo (ex: "2d6+3"). Ao usar uma habilidade na Aventura, o sistema deduz a mana mas nao calcula o resultado dos dados.

O objetivo e que, ao usar uma habilidade, o servidor parse a notacao de dados, faca uma rolagem, e retorne o resultado. O resultado aparece como um flash temporario (10 segundos) no card do personagem/inimigo, visivel para todos os jogadores via polling.

O jogador aplica o dano/cura manualmente — o resultado e apenas informativo.

### Escopo incluso
- Parser de notacao de dados: `NdX`, `NdX+M`, `NdX-M` (ex: `2d6+3`, `1d20`, `3d8-1`)
- Rolagem no servidor ao usar habilidade
- Resultado retornado na resposta do `use-ability`
- Resultado visivel para todos os jogadores (via polling existente)
- Display temporario (flash de 10 segundos) no card do personagem na Adventure
- Funciona para PCs e inimigos

### Fora de escopo (por enquanto)
- Historico/log de rolagens
- Rolagem avulsa (sem estar vinculada a uma habilidade)
- Aplicacao automatica de dano/cura ao HP
- Notacoes complexas (ex: `2d6+1d4`, `4d6 drop lowest`, vantagem/desvantagem)
- Distincao entre dano e cura (tudo e "resultado" generico)

---

## Decisoes de Design

### Rolagem no servidor
A rolagem acontece no servidor para garantir que todos vejam o mesmo resultado. O resultado vem na resposta do `POST /api/characters/:id/use-ability`.

### Persistencia do resultado (Map em memoria)
Para que outros jogadores vejam o resultado via polling, os dados das rolagens recentes ficam em um `Map` em memoria no servidor — sem alteracao no banco de dados.

```js
// server: Map em memoria
// key: characterId, value: { abilityName, notation, rolls, modifier, total, at }
const recentRolls = new Map()
```

- `use-ability` salva o resultado no Map e retorna na resposta
- Entradas com mais de 15 segundos sao limpas automaticamente ao consultar
- Se o servidor reiniciar, as rolagens em andamento se perdem (irrelevante — sao dados de 10 segundos)

### Visibilidade via polling
Um endpoint leve `GET /api/adventure/dice-rolls?characterIds=1,2,3` retorna as rolagens dos ultimos 15 segundos para os personagens solicitados. O frontend da Adventure faz polling desse endpoint junto com o polling existente de personagens.

### Notacao invalida
Se o campo `dano` nao for uma notacao valida de dados (ex: texto livre como "especial"), a habilidade e usada normalmente (mana deduzida) mas sem rolagem — nenhum flash aparece. Isso mantem retrocompatibilidade com habilidades existentes.

### Display
O resultado aparece como um banner/toast no card do personagem na Adventure:
- Mostra: nome da habilidade, notacao, dados individuais e total
- Exemplo: **Bola de Fogo** | 2d6+3 | [4, 2] +3 = **9**
- Desaparece apos 10 segundos com fade-out

---

## Etapas de Implementacao

### Etapa 1 — Utilitario de dados (server)

Criar `server/src/utils/dice.js` com duas funcoes:

```js
// parseDice("2d6+3") -> { count: 2, sides: 6, modifier: 3 }
// parseDice("1d20")  -> { count: 1, sides: 20, modifier: 0 }
// parseDice("3d8-1") -> { count: 3, sides: 8, modifier: -1 }
// parseDice("texto") -> null (notacao invalida)
function parseDice(notation) { ... }

// rollDice("2d6+3") -> { notation: "2d6+3", rolls: [4, 2], modifier: 3, total: 9 }
// rollDice("texto") -> null
function rollDice(notation) { ... }
```

Regex para parsing: `/^(\d+)d(\d+)([+-]\d+)?$/i`

Validacoes:
- `count` entre 1 e 100
- `sides` entre 1 e 100
- Retorna `null` se invalido

**Dependencias**: nenhuma.

---

### Etapa 2 — Backend: Map em memoria e integrar rolagem no use-ability

#### 2.1 — Store em memoria

Criar `server/src/store/diceRolls.js`:

```js
const recentRolls = new Map()

function saveRoll(characterId, rollData) {
    recentRolls.set(characterId, { ...rollData, at: Date.now() })
}

function getRolls(characterIds) {
    const now = Date.now()
    const result = {}
    for (const id of characterIds) {
        const roll = recentRolls.get(id)
        if (roll && now - roll.at < 15000) {
            result[id] = roll
        } else if (roll) {
            recentRolls.delete(id) // limpa expirado
        }
    }
    return result
}
```

#### 2.2 — Integrar no use-ability

Modificar `POST /api/characters/:id/use-ability` em `server/src/index.js`:

1. Apos validar a habilidade e deduzir a mana, chamar `rollDice(ability.dano)`
2. Se o resultado nao for `null` (notacao valida):
   - Salvar no Map via `saveRoll(characterId, { abilityName, notation, rolls, modifier, total })`
3. Se for `null` (notacao invalida ou texto livre):
   - Nao salvar rolagem (habilidade funciona normalmente, so sem dado)
4. Retornar o resultado da rolagem na resposta (campo `diceRoll` no JSON):

```js
// Resposta atual:
{ pillar: { id, actualMana, ... } }

// Nova resposta:
{ pillar: { id, actualMana, ... }, diceRoll: { abilityName, notation, rolls, modifier, total } | null }
```

#### 2.3 — Endpoint de rolagens recentes

`GET /api/adventure/dice-rolls?characterIds=1,2,3`

- Recebe lista de IDs via query param
- Retorna as rolagens dos ultimos 15 segundos para esses personagens
- Resposta: `{ "1": { abilityName, notation, rolls, modifier, total, at }, "3": { ... } }`
- Se nenhum personagem tem rolagem recente, retorna `{}`

**Dependencias**: Etapa 1.

---

### Etapa 4 — Frontend: exibir resultado no card (PCs)

Na pagina `Adventure.jsx`, ao receber a resposta do `handleUseAbility`:

1. Se `diceRoll` nao for `null`, armazenar o resultado em um state `diceResults` (mapa `characterId -> rollData`)
2. Exibir um banner/flash no card do personagem com o resultado
3. Apos 10 segundos, remover o resultado do state (fade-out)

Para resultados vindos de outros jogadores (via polling do novo endpoint):
1. Polling de `GET /api/adventure/dice-rolls?characterIds=...` a cada 3-5 segundos
2. Se uma rolagem for retornada e ainda nao estiver sendo exibida, mostrar o flash
3. Usar o timestamp `at` para calcular quanto tempo de exibicao resta

Layout do flash no card:

```
+--------------------------------------------------+
| Personagem Nome                        HP 20/30   |
| ================================================ |
| [flash] Bola de Fogo | 2d6+3 | [4, 2] +3 = 9    |
| ================================================ |
| Pilares...                                        |
+--------------------------------------------------+
```

**Dependencias**: Etapa 3.

---

### Etapa 5 — Frontend: exibir resultado no card (Inimigos)

Mesma logica da Etapa 4, mas aplicada a secao de inimigos:

- O mestre usa habilidade do inimigo -> resultado aparece no card do inimigo
- Players veem o flash no card do inimigo tambem (via polling de `/api/adventure/dice-rolls`)
- Para players: o flash mostra apenas o nome da habilidade e o resultado total (sem detalhes de stats que estao ocultos)

**Dependencias**: Etapa 4.

---

### Etapa 6 — Estilo do flash

CSS para o banner de resultado:

- Fundo semi-transparente com cor neutra (dourado/amarelo para resultado generico)
- Texto com o nome da habilidade, notacao, dados individuais entre colchetes e total em destaque
- Animacao de entrada (slide-down ou fade-in)
- Animacao de saida (fade-out nos ultimos 2 segundos)
- Responsivo: em mobile, o flash ocupa a largura total do card

**Dependencias**: Etapas 4 e 5.

---

### Etapa 7 — Testes

#### Server
- Testes unitarios do `parseDice`: notacoes validas, invalidas, edge cases
- Testes unitarios do `rollDice`: resultado dentro dos limites esperados, retorna null para invalido
- Testes da rota `use-ability` com rolagem: verifica que `diceRoll` vem na resposta
- Testes do endpoint `dice-rolls`: retorna rolagens recentes, ignora expiradas
- Testes do store em memoria: saveRoll, getRolls, limpeza de expirados

#### Client
- Testes da Adventure: flash aparece apos usar habilidade, desaparece apos timeout
- Testes do polling de dice-rolls: flash aparece quando ha rolagem recente

**Dependencias**: todas as etapas anteriores.

---

## Dependencias externas (pacotes novos)

Nenhuma. O parser de dados e a rolagem usam apenas `Math.random()` e regex nativa.

---

## Ordem sugerida de execucao

```
Etapa 1 (Utilitario dice.js)
    |
    v
Etapa 2 (Backend: store + use-ability + endpoint)
    |
    v
Etapa 3 (Frontend: flash nos PCs)
    |
    v
Etapa 4 (Frontend: flash nos inimigos)
    |
    v
Etapa 5 (CSS do flash)
    |
    v
Etapa 6 (Testes)
```

As etapas 3 e 4 podem ser feitas juntas se preferir.
A etapa 5 pode ser feita em paralelo com 3/4.

---

## Riscos e consideracoes

- **Polling**: o endpoint de dice-rolls usa polling a cada 3-5 segundos. Outros jogadores podem ver o flash com um pequeno delay. No futuro, com WebSocket (do grid system), o resultado pode ser transmitido instantaneamente.
- **Math.random()**: para um RPG entre amigos, `Math.random()` e perfeitamente adequado. Nao e criptograficamente seguro, mas nao precisa ser.
- **Retrocompatibilidade**: habilidades com `dano` em texto livre (ex: "especial", "ver descricao") continuam funcionando — a rolagem so acontece se a notacao for valida.
- **Map em memoria**: dados se perdem ao reiniciar o servidor, mas sao transientes por natureza (10-15 segundos de vida). Nenhuma alteracao no banco de dados.
- **Sem migration**: zero mudancas no schema do Prisma.
