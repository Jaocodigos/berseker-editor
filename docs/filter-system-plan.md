# Plano de Implementacao — Sistema de Filtros (Personagens e Inimigos)

## Contexto

Adicionar um **botao de filtro** nas paginas `Characters` e `Enemies` que permite reduzir a lista exibida com base em:

- **Nome**: busca textual (substring, case-insensitive) no nome do personagem.
- **Titulos**: selecao de **um ou mais** titulos do catalogo da aventura atual (multi-selecao por checkbox).

O botao abre um painel inline com os dois campos; os filtros sao aplicados **no client-side** sobre a lista ja carregada (sem round-trip extra no backend). Nome e titulos combinam por **AND**; dentro de titulos, os selecionados combinam por **OR** (personagem passa se tiver qualquer um dos titulos marcados). Um botao "Limpar" zera os filtros. Estado do filtro **nao persiste** entre navegacoes (volta ao default ao sair da pagina).

### Escopo incluso
- Novo componente `CharacterFilter` reutilizado por `Characters.jsx` e `Enemies.jsx`.
- Botao de toggle que mostra/esconde o painel de filtros.
- Filtro por nome (input de texto, match por `includes` case-insensitive).
- Filtro por titulos com multi-selecao via checkbox list (populada por `GET /api/titles`, que ja e chamado nas duas paginas). Inclui opcao "Sem titulo" para personagens com `titleId = null`.
- Indicador visual de "filtro ativo" no botao (ex: badge com contador de filtros aplicados — nome conta como 1, lista de titulos conta como 1 se tiver qualquer item).
- Mensagem "Nenhum personagem encontrado" quando o filtro zera a lista.

### Fora de escopo
- Filtros por HP/XP/nivel/pilar — so nome e titulo por ora.
- Persistencia do filtro em `localStorage` ou URL query string.
- Ordenacao (sort) da lista — filtro apenas reduz, nao reordena.
- Paginacao ou virtualizacao — listas continuam pequenas o bastante.
- Filtro no backend (tudo client-side).

---

## Decisoes de Design

### Client-side vs server-side
- Filtro **client-side**: as paginas ja carregam todos os personagens/inimigos da aventura em um `fetch`. Nao vale a pena adicionar query params e re-fetch a cada digitacao.
- Vantagem extra: busca instantanea, sem debounce nem loading state.

### Combinacao de filtros
- **Entre campos (nome x titulos)**: `AND` — se nome = "Arq" e titulos marcados = ["Lorde do Norte"], mostra so quem bate nos dois.
- **Dentro de titulos**: `OR` — marcando "Lorde do Norte" e "Arqueiro Sombrio" mostra personagens com qualquer um dos dois.
- Campo vazio (input sem texto, nenhuma checkbox marcada) nao filtra (ignora o criterio).

### Componente compartilhado
- `CharacterFilter` recebe `{ characters, titles, onChange }` e devolve a lista filtrada por callback, OU recebe `{ titles, filters, onFiltersChange }` e delega o filtro para o pai.
- **Decisao**: componente controlado (segunda opcao). O pai mantem o estado `filters` e aplica a funcao de filtro sobre `characters` antes de passar para o map. Isso mantem a logica de `.filter()` perto do `.map()` e evita prop drilling de `onRefresh` etc.

### Comportamento do botao
- Clicar no botao abre/fecha o painel. Quando ha filtro ativo (algum campo preenchido), o botao mostra um destaque (cor/badge) mesmo com painel fechado.
- Nao e modal: o painel fica inline acima da lista, empurrando os cards para baixo.

### Titulo "sem titulo"
- Opcao extra na lista de checkbox: **"Sem titulo"** (inclui personagens com `titleId = null`).
- Representada internamente pela string sentinel `"null"` dentro do array `filters.titleIds`. IDs de titulos reais entram como numeros.
- Default: nenhuma checkbox marcada (= filtro de titulo desligado, mostra tudo).

### Inimigos (visibilidade)
- Player nao ve inimigos, entao o filtro na pagina `Enemies` so e usado pelo mestre.
- Como `GET /api/adventure/enemies` ja omite `title` para players (decisao do plano de titles), no lado do mestre o `title` vem aninhado normalmente e o filtro funciona. Nada a mudar no backend.

---

## Arquitetura

### Componente

`client/src/components/CharacterFilter.jsx`

```jsx
export default function CharacterFilter({ titles, filters, onFiltersChange }) {
    const [open, setOpen] = useState(false);
    const activeCount = (filters.name ? 1 : 0) + (filters.titleIds.length > 0 ? 1 : 0);

    const toggleTitle = (value) => {
        const next = filters.titleIds.includes(value)
            ? filters.titleIds.filter(v => v !== value)
            : [...filters.titleIds, value];
        onFiltersChange({ ...filters, titleIds: next });
    };

    return (
        <div className="character-filter">
            <button
                className={`rpg-button filter-button ${activeCount > 0 ? 'active' : ''}`}
                onClick={() => setOpen(o => !o)}
            >
                Filtrar {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
            </button>

            {open && (
                <div className="filter-panel">
                    <div className="form-field">
                        <label>Nome</label>
                        <input
                            type="text"
                            value={filters.name}
                            onChange={(e) => onFiltersChange({ ...filters, name: e.target.value })}
                        />
                    </div>
                    <div className="form-field">
                        <label>Titulos</label>
                        <div className="filter-title-list">
                            <label className="filter-title-option">
                                <input
                                    type="checkbox"
                                    checked={filters.titleIds.includes("null")}
                                    onChange={() => toggleTitle("null")}
                                />
                                Sem titulo
                            </label>
                            {titles.map(t => (
                                <label key={t.id} className="filter-title-option">
                                    <input
                                        type="checkbox"
                                        checked={filters.titleIds.includes(t.id)}
                                        onChange={() => toggleTitle(t.id)}
                                    />
                                    <span style={{ color: t.color }}>{t.nome}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <button
                        className="rpg-button"
                        onClick={() => onFiltersChange({ name: "", titleIds: [] })}
                    >
                        Limpar
                    </button>
                </div>
            )}
        </div>
    );
}
```

Shape do estado:

```js
{ name: string, titleIds: Array<number | "null"> }
```

### Funcao de filtro (util compartilhado)

`client/src/utils/filterCharacters.js`

```js
export function filterCharacters(characters, filters) {
    return characters.filter((c) => {
        if (filters.name) {
            const q = filters.name.toLowerCase();
            if (!c.name?.toLowerCase().includes(q)) return false;
        }
        if (filters.titleIds.length > 0) {
            const wantsUntitled = filters.titleIds.includes("null");
            const wantedIds = filters.titleIds.filter(v => v !== "null");
            const matches =
                (c.titleId == null && wantsUntitled) ||
                (c.titleId != null && wantedIds.includes(c.titleId));
            if (!matches) return false;
        }
        return true;
    });
}
```

### Integracao nas paginas

Em `Characters.jsx` e `Enemies.jsx`:

```jsx
const [filters, setFilters] = useState({ name: "", titleIds: [] });
const visibleCharacters = filterCharacters(characters, filters);

// ...
<CharacterFilter titles={titles} filters={filters} onFiltersChange={setFilters} />
<div className="characters-list">
    {visibleCharacters.length === 0 && <p className="empty-state">Nenhum personagem encontrado.</p>}
    {visibleCharacters.map((char) => (
        <CharacterCard key={char.id} character={char} onRefresh={fetchCharacters} />
    ))}
</div>
```

---

## Etapas de Implementacao

### Etapa 1 — Util `filterCharacters`

Criar `client/src/utils/filterCharacters.js` com a funcao pura descrita acima.

**Dependencias**: nenhuma.

---

### Etapa 2 — Componente `CharacterFilter`

Criar `client/src/components/CharacterFilter.jsx` conforme esboco. CSS minimo em `App.css` (ou arquivo proprio se o padrao do projeto for por-componente — verificar antes):

- `.character-filter` container flex.
- `.filter-button.active` com destaque visual (ex: borda/fundo diferente).
- `.filter-badge` circulo pequeno com o contador.
- `.filter-panel` caixa abaixo do botao, com os dois campos e o botao Limpar.
- `.filter-title-list` container vertical (ou grid com overflow-y quando houver muitos titulos).
- `.filter-title-option` label em linha com checkbox + texto colorido (cor do titulo aplicada inline).

**Dependencias**: nenhuma (visual standalone).

---

### Etapa 3 — Integracao em `Characters.jsx`

- Importar `CharacterFilter` e `filterCharacters`.
- Adicionar estado `filters`.
- Renderizar `<CharacterFilter>` acima da lista de cards.
- Substituir `characters.map(...)` por `filterCharacters(characters, filters).map(...)`.
- Adicionar empty state quando a lista filtrada esta vazia.

**Dependencias**: Etapas 1 e 2.

---

### Etapa 4 — Integracao em `Enemies.jsx`

Mesmo trabalho da Etapa 3, aplicado em `Enemies.jsx`. A unica diferenca e a fonte dos dados (`enemies` em vez de `characters`).

**Dependencias**: Etapas 1 e 2.

---

### Etapa 5 — Testes

#### `filterCharacters.test.js` (util)
- Lista vazia retorna vazia.
- Sem filtros (`titleIds: []`, `name: ""`) retorna a lista inteira.
- Filtro por nome casa substring case-insensitive.
- `titleIds` com um ID numerico retorna so quem tem aquele titulo.
- `titleIds` com `"null"` retorna so quem tem `titleId` nulo.
- `titleIds` com varios IDs retorna quem tem **qualquer** um deles (OR).
- `titleIds` misturando numeros e `"null"` retorna uniao dos dois conjuntos.
- Combinacao nome + titulos: AND (ambos precisam bater).

#### `CharacterFilter.test.jsx` (componente)
- Renderiza botao com label "Filtrar".
- Clique no botao abre e fecha o painel.
- Digitacao no input chama `onFiltersChange` com `name` atualizado.
- Clique em checkbox de titulo adiciona o ID em `titleIds`.
- Clique em checkbox ja marcada remove o ID de `titleIds`.
- Checkbox "Sem titulo" alterna a sentinel `"null"` no array.
- Multiplos cliques acumulam selecoes (nao mutuamente exclusivos).
- Botao "Limpar" reseta `filters` para `{ name: "", titleIds: [] }`.
- Badge aparece quando `filters.name` ou `filters.titleIds.length > 0`.

#### `Characters.test.jsx` e `Enemies.test.jsx`
- Adicionar casos: quando usuario filtra por nome, so cards correspondentes aparecem.
- Empty state aparece quando nenhum personagem casa.

**Dependencias**: Etapas 1-4.

---

## Ordem de Execucao Recomendada

1. Etapa 1 (util + teste unitario junto)
2. Etapa 2 (componente + teste)
3. Etapas 3 e 4 em paralelo (ou sequenciais, sao quase identicas)
4. Etapa 5 (testes de integracao nas paginas)

---

## Riscos e Observacoes

- **Performance**: com listas pequenas (< 100 personagens) filtrar no client em cada keystroke e trivial. Se no futuro a quantidade crescer, considerar debounce ou mover filtro para backend com query params.
- **Sincronia titulos <-> personagens**: a lista de titulos no dropdown pode estar defasada se o mestre criar/deletar um titulo em outra aba. Como ja e o caso hoje no form de criacao, nao vamos resolver isso aqui.
- **Acessibilidade**: painel aberto por botao deve ter `aria-expanded` e fechar com Esc — considerar no momento da implementacao se ja houver padrao no projeto; caso contrario, nao bloquear a entrega.
- **Estado efemero**: ao sair da pagina e voltar, o filtro reseta. Se virar dor, migrar para URL query string (`?q=...&title=...`) sem quebrar nada.
