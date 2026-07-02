# Título: Estante Virtual

Frontend da aplicação **Estante Virtual**, desenvolvido para a disciplina *Desenvolvimento Full Stack Básico*. Esta interface permite ao usuário **cadastrar, visualizar, editar e remover livros** da sua estante pessoal, além de acompanhar **estatísticas de leitura** por meio dos gráficos que demonstram quantidade de livros por status e quantidade de livros concluídos por mês.

---

## Tecnologias utilizadas

- **HTML5** — estrutura semântica da aplicação
- **CSS3** — estilização personalizada da interface
- **JavaScript** — lógica da aplicação, navegação entre telas e comunicação com a API
- **Bootstrap** — framework de estilo base (via CDN)
- **Chart.js** — geração dos gráficos de estatísticas (via CDN)
- **localStorage** — armazenamento local para funcionamento offline

---

## Pré-requisitos

Por ser uma aplicação web estática, o frontend **não requer instalação de dependências** — todas as bibliotecas externas (Bootstrap e Chart.js) são carregadas via CDN diretamente no `index.html`.

Você precisará apenas de:

- Um navegador
- *Observação:* O backend da Estante Virtual em execução em `http://localhost:5000` para persistência dos dados no banco de dados

---

## Instalação e configuração do ambiente

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd <nome-da-pasta-do-projeto>
```

### 2. Verifique a estrutura de arquivos

Certifique-se de que os três arquivos principais estão na mesma pasta:

```
.
├── index.html    # Estrutura e telas da aplicação
├── app.js        # Lógica, navegação e comunicação com a API
├── style.css     # Estilos personalizados da interface
└── README.md     # Este arquivo
```

---

## Como executar o projeto

### Modo offline (sem backend)

Basta abrir o arquivo `index.html` diretamente no navegador com **duplo clique**. Nenhum servidor, extensão ou configuração adicional é necessária.

Neste modo, todas as operações (cadastrar, visualizar, editar, apagar livros e visualizar gráficos) funcionam normalmente utilizando o `localStorage` do navegador como armazenamento temporário.

### Modo online (com backend)

1. Certifique-se de que o backend está em execução em `http://localhost:5000` (consulte o README do repositório backend para instruções).
2. Abra o arquivo `index.html` diretamente no navegador com duplo clique.

A troca entre os modos é **automática**: o frontend tenta se comunicar com o backend e, caso não obtenha resposta em até 2,5 segundos, assume o modo offline com `localStorage`.

> ⚠️ Os dados cadastrados em modo offline ficam armazenados apenas no navegador e não são sincronizados automaticamente com o banco de dados ao ligar o backend.

---

## Funcionalidades

- **Estante (listagem):** exibe todos os livros cadastrados em cards
- **Filtros:** permite filtrar os livros por status de leitura — *Todos*, *Lendo*, *Concluído* e *Quero ler*
- **Cadastro:** formulário dinâmico que exibe campos condicionais conforme o status selecionado (ex: data de início para "Estou lendo", nota em estrelas para "Concluído")
- **Edição:** pré-preenchimento do formulário com os dados do livro selecionado para atualização parcial
- **Remoção:** exclusão de livros com confirmação do usuário
- **Estatísticas:** dois gráficos interativos — distribuição de livros por status (pizza) e livros concluídos por mês (barras)

---

## Integração com o backend

O frontend consome as seguintes rotas da API:

| Método | Rota | Uso no frontend |
|---|---|---|
| `GET` | `/listarlivros` | Carrega a lista de livros na estante |
| `POST` | `/cadastrarlivro` | Salva um novo livro |
| `PATCH` | `/atualizarlivro?id={id}` | Atualiza os dados de um livro existente |
| `DELETE` | `/deletarlivro?id={id}` | Remove um livro da estante |
| `GET` | `/estatisticas/livros-por-status` | Dados do gráfico de pizza |
| `GET` | `/estatisticas/livros-concluidos-por-mes` | Dados do gráfico de barras |
