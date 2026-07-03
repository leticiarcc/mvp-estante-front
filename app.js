const baseUrl = 'http://localhost:5000';
const TEMPO_LIMITE_REQUISICAO = 2500; // ms - evita ficar esperando se o backend não responder
const CHAVE_LOCAL = 'estante_virtual_livros';

let livros = [];
let filtroAtual = 'todos';
let idEditando = -1;
let graficoStatus = null;
let graficoMensal = null;

/* =========================================================
   UTILITÁRIOS
   ========================================================= */

// Evita problemas de HTML quebrado quando o texto do usuário
// contém caracteres como < > & "
function escaparHtml(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Faz uma requisição fetch com timeout, aborta se o tempo limite for atingido
function fetchComTimeout(url, opcoes) {
    const controlador = new AbortController();
    const temporizador = setTimeout(function () {
        controlador.abort();
    }, TEMPO_LIMITE_REQUISICAO);

    const opcoesFinais = Object.assign({}, opcoes, { signal: controlador.signal });

    return fetch(url, opcoesFinais).finally(function () {
        clearTimeout(temporizador);
    });
}

function mostrarAvisoModo(modoOffline) {
    const aviso = document.getElementById('aviso-modo-offline');
    if (!aviso) return;
    aviso.style.display = modoOffline ? 'block' : 'none';
}

/* =========================================================
   ARMAZENAMENTO LOCAL (usado quando o backend está off - usa dados locais)
   ========================================================= */

function obterLivrosLocal() {
    try {
        const dados = localStorage.getItem(CHAVE_LOCAL);
        return dados ? JSON.parse(dados) : [];
    } catch (erro) {
        console.log('Erro ao ler localStorage:', erro);
        return [];
    }
}

function salvarLivrosLocal(lista) {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(lista));
}

function gerarProximoIdLocal(lista) {
    if (!lista.length) return 1;
    return Math.max.apply(null, lista.map(function (l) { return l.id; })) + 1;
}

function cadastrarLivroLocal(livro) {
    const lista = obterLivrosLocal();

    const jaExiste = lista.some(function (l) {
        return l.titulo.trim().toLowerCase() === livro.titulo.trim().toLowerCase();
    });

    if (jaExiste) {
        const erroDuplicado = new Error('Livro com o mesmo título já cadastrado.');
        erroDuplicado.tipo = 'duplicado-local';
        throw erroDuplicado;
    }

    livro.id = gerarProximoIdLocal(lista);
    lista.push(livro);
    salvarLivrosLocal(lista);
}

function atualizarLivroLocal(id, dadosNovos) {
    const lista = obterLivrosLocal();
    const indice = lista.findIndex(function (l) { return l.id === id; });

    if (indice === -1) {
        throw new Error('Livro não encontrado no armazenamento local.');
    }

    lista[indice] = Object.assign({}, lista[indice], dadosNovos, { id: id });
    salvarLivrosLocal(lista);
}

function apagarLivroLocal(id) {
    let lista = obterLivrosLocal();
    lista = lista.filter(function (l) { return l.id !== id; });
    salvarLivrosLocal(lista);
}

function calcularEstatisticasStatusLocal(lista) {
    const ordem = ['Concluído', 'Estou lendo', 'Quero ler'];
    const contagem = { 'Concluído': 0, 'Estou lendo': 0, 'Quero ler': 0 };

    lista.forEach(function (livro) {
        if (contagem.hasOwnProperty(livro.status)) {
            contagem[livro.status]++;
        }
    });

    const labels = [];
    const values = [];

    ordem.forEach(function (status) {
        if (contagem[status] > 0) {
            labels.push(status);
            values.push(contagem[status]);
        }
    });

    return { labels: labels, values: values };
}

function calcularEstatisticasMensalLocal(lista) {
    const concluidos = lista.filter(function (l) {
        return l.status === 'Concluído' && l.data_fim;
    });

    const contagemPorMes = {};

    concluidos.forEach(function (livro) {
        const partes = String(livro.data_fim).split('-');
        if (partes.length < 2) return;

        const chave = partes[0] + '-' + partes[1]; // YYYY-MM
        contagemPorMes[chave] = (contagemPorMes[chave] || 0) + 1;
    });

    const chavesOrdenadas = Object.keys(contagemPorMes).sort();

    const labels = chavesOrdenadas.map(function (chave) {
        const partes = chave.split('-');
        return partes[1] + '/' + partes[0]; // MM/YYYY
    });

    const values = chavesOrdenadas.map(function (chave) {
        return contagemPorMes[chave];
    });

    return { labels: labels, values: values };
}

/* =========================================================
   NAVEGAÇÃO ENTRE as TELAS
   ========================================================= */

function mudarTela(nomeDaTela) {
    document.getElementById('tela-lista').style.display = 'none';
    document.getElementById('tela-cadastro').style.display = 'none';

    const telaEstatisticas = document.getElementById('tela-estatisticas');
    if (telaEstatisticas) {
        telaEstatisticas.style.display = 'none';
    }

    document.getElementById(nomeDaTela).style.display = 'block';

    if (nomeDaTela === 'tela-lista') {
        carregarLivros();
        limparFormulario();
    }

    if (nomeDaTela === 'tela-estatisticas') {
        // tempo para renderizar a tela antes de mostrar os gráficos
        setTimeout(function () {
            carregarGraficoStatus();
            carregarGraficoMensal();
        }, 100);
    }
}

/* =========================================================
   CARREGAMENTO DE DADOS (LISTA DE LIVROS)
   ========================================================= */

function carregarLivros() {
    fetchComTimeout(baseUrl + '/listarlivros')
        .then(function (resposta) {
            if (!resposta.ok) {
                throw new Error('Erro HTTP ao listar livros: ' + resposta.status);
            }
            return resposta.json();
        })
        .then(function (dadosDoBanco) {
            livros = dadosDoBanco.livros || dadosDoBanco || [];
            mostrarAvisoModo(false);
            mostrarLivros();
            carregarGraficoStatus();
        })
        .catch(function (erro) {
            console.log('Backend indisponível, usando dados locais. Detalhe:', erro);
            livros = obterLivrosLocal();
            mostrarAvisoModo(true);
            mostrarLivros();
            carregarGraficoStatus();
        });
}

function mostrarLivros() {
    const caixaLivros = document.getElementById('container-livros');
    if (!caixaLivros) return;

    if (!livros || livros.length === 0) {
        caixaLivros.innerHTML = "<p>Olá, sua estante está vazia, cadastre seu primeiro livro! 📔 </p>";
        return;
    }

    let htmlFinal = '';
    let algumVisivel = false;

    for (let i = 0; i < livros.length; i++) {
        const livro = livros[i];

        if (filtroAtual !== 'todos' && livro.status !== filtroAtual) {
            continue;
        }

        algumVisivel = true;

        let classeCor = 'cor-queroler';
        if (livro.status === 'Estou lendo') classeCor = 'cor-lendo';
        if (livro.status === 'Concluído') classeCor = 'cor-concluido';

        let htmlCard = '<div class="col-md-4">';
        htmlCard += '<div class="card-livro ' + classeCor + '">';

        htmlCard += '<span class="badge-status ' + classeCor + '">' + escaparHtml(livro.status) + '</span><br><br>';
        htmlCard += '<h4>' + escaparHtml(livro.titulo) + '</h4>';
        htmlCard += '<p><strong>Autor:</strong> ' + escaparHtml(livro.autor) + '</p>';
        htmlCard += '<p><strong>Gênero:</strong> ' + escaparHtml(livro.genero) + '</p>';


        if (livro.status === 'Estou lendo') {
            const porcentagem = Math.min(Math.round((livro.pagina_atual / livro.qtde_paginas) * 100), 100);
            htmlCard += '<p class="mb-1">Página ' + (livro.pagina_atual || 0) + ' de ' + livro.qtde_paginas + ' — <strong>' + porcentagem + '%</strong></p>';
            htmlCard += '<div class="barra-progresso-fundo">';
            htmlCard += '<div class="barra-progresso-preenchimento" style="width:' + porcentagem + '%"></div>';
            htmlCard += '</div>';
        }

        if (livro.status === 'Concluído' && livro.nota > 0) {
            const estrelasPreenchidas = '★'.repeat(livro.nota);
            const estrelasVazias = '★'.repeat(5 - livro.nota);
            htmlCard += '<p class="mb-1"><strong>Nota:</strong> ';
            htmlCard += '<span class="stars-display">' + estrelasPreenchidas + '</span>';
            htmlCard += '<span class="stars-empty">' + estrelasVazias + '</span></p>';
        }

        if (livro.anotacoes && livro.anotacoes.trim() !== '') {
            htmlCard += '<div class="texto-anotacao">Anotações: ' + escaparHtml(livro.anotacoes) + '</div>';
        }

        htmlCard += '<hr>';
        htmlCard += '<button class="btn btn-sm btn-primary" onclick="prepararEdicao(' + livro.id + ')">Editar</button> ';
        htmlCard += '<button class="btn btn-sm btn-danger" onclick="apagarLivro(' + livro.id + ')">Apagar</button>';

        htmlCard += '</div></div>';

        htmlFinal += htmlCard;
    }

    if (!algumVisivel) {
        caixaLivros.innerHTML = "<p>Nenhum livro encontrado para este filtro.</p>";
        return;
    }

    caixaLivros.innerHTML = htmlFinal;
}

/* =========================================================
   FILTROS
   ========================================================= */

function filtrarLivros(filtro) {
    filtroAtual = filtro;
    mostrarLivros();
}

/* =========================================================
   GRÁFICOS (ESTATÍSTICAS)
   ========================================================= */

function carregarGraficoStatus() {
    const canvas = document.getElementById('graficoStatus');
    // só executa se estiver na tela de estatísticas
    if (!canvas) {
        return;
    }

    fetchComTimeout(baseUrl + '/estatisticas/livros-por-status')
        .then(function (resposta) {
            if (!resposta.ok) {
                throw new Error('o Endpoint de estatísticas não foi encontrado');
            }
            return resposta.json();
        })
        .then(function (dados) {
            if (!dados || !dados.labels || !dados.values) {
                throw new Error('Dados inválidos para o gráfico de status');
            }
            renderizarGraficoStatus(dados);
        })
        .catch(function (erro) {
            console.log('Usando estatísticas locais (status):', erro);
            const dadosLocais = calcularEstatisticasStatusLocal(obterLivrosLocal());
            renderizarGraficoStatus(dadosLocais);
        });
}

/* Estruturando gráfico de status com o Chart.js */
function renderizarGraficoStatus(dados) {
    const canvas = document.getElementById('graficoStatus');
    if (!canvas) return;

    if (graficoStatus) {
        graficoStatus.destroy();
    }

    graficoStatus = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: dados.labels,
            datasets: [{
                data: dados.values,
                backgroundColor: [
                    '#198754', // Concluído
                    '#006faf', // Estou lendo
                    '#858381'  // Quero ler
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    enabled: true
                }
            }
        }
    });
}

function carregarGraficoMensal() {
    const canvas = document.getElementById('graficoMensal');
    if (!canvas) {
        return;
    }

    fetchComTimeout(baseUrl + '/estatisticas/livros-concluidos-por-mes')
        .then(function (res) {
            if (!res.ok) {
                throw new Error('Erro HTTP ao buscar livros por mês: ' + res.status);
            }
            return res.json();
        })
        .then(function (dados) {
            if (!dados || !dados.labels || !dados.values) {
                throw new Error('Resposta inválida do backend (livros por mês)');
            }
            renderizarGraficoMensal(dados);
        })
        .catch(function (erro) {
            console.log('Usando estatísticas locais (mensal):', erro);
            const dadosLocais = calcularEstatisticasMensalLocal(obterLivrosLocal());
            renderizarGraficoMensal(dadosLocais);
        });
}

/* Estruturando gráfico mensal com o Chart.js */
function renderizarGraficoMensal(dados) {
    const canvas = document.getElementById('graficoMensal');
    if (!canvas) return;

    // Destrói o gráfico anterior para não ter sobreposição nos dados
    if (graficoMensal) {
        graficoMensal.destroy();
    }

    graficoMensal = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: dados.labels,
            datasets: [{
                label: 'Livros concluídos por mês',
                data: dados.values,
                backgroundColor: '#5c3700'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true
                }
            }
        }
    });
}

/* =========================================================
   FORMULÁRIO (CADASTRO / EDIÇÃO)
   ========================================================= */

function verificarStatus() {
    const statusSelecionado = document.getElementById('status').value;

    document.getElementById('grupo-data-inicio').style.display = 'none';
    document.getElementById('grupo-pagina-atual').style.display = 'none';
    document.getElementById('grupo-data-fim').style.display = 'none';
    document.getElementById('grupo-nota').style.display = 'none';

    document.getElementById('data-inicio').required = false;
    document.getElementById('data-fim').required = false;

    if (statusSelecionado === 'Estou lendo') {
        document.getElementById('grupo-data-inicio').style.display = 'block';
        document.getElementById('grupo-pagina-atual').style.display = 'block';
        document.getElementById('data-inicio').required = true;
    } else if (statusSelecionado === 'Concluído') {
        document.getElementById('grupo-data-fim').style.display = 'block';
        document.getElementById('grupo-nota').style.display = 'block';
        document.getElementById('data-fim').required = true;
    }
}

function limparFormulario() {
    document.getElementById('form-livro').reset();
    idEditando = -1;
    document.getElementById('titulo-form').innerText = 'Adicionar Novo Livro';
    verificarStatus();
}

function prepararEdicao(idBanco) {
    idEditando = idBanco;
    let livro = null;

    for (let i = 0; i < livros.length; i++) {
        if (livros[i].id === idBanco) {
            livro = livros[i];
            break;
        }
    }

    if (!livro) return;

    document.getElementById('titulo').value = livro.titulo;
    document.getElementById('qtde-paginas').value = livro.qtde_paginas;
    document.getElementById('autor').value = livro.autor;
    document.getElementById('genero').value = livro.genero;
    document.getElementById('status').value = livro.status;

    verificarStatus();

    document.getElementById('data-inicio').value = livro.data_inicio || '';
    document.getElementById('pagina-atual').value = livro.pagina_atual || 0;
    document.getElementById('data-fim').value = livro.data_fim || '';
    document.getElementById('anotacoes').value = livro.anotacoes || '';

    const botoesNota = document.getElementsByName('avaliacao');
    for (let i = 0; i < botoesNota.length; i++) {
        botoesNota[i].checked = (botoesNota[i].value === String(livro.nota));
    }

    document.getElementById('titulo-form').innerText = 'Editar Livro';

    mudarTela('tela-cadastro');
}

function apagarLivro(idBanco) {
    const certeza = confirm('Tem certeza que quer apagar este livro?');
    if (!certeza) return;

    fetchComTimeout(baseUrl + '/deletarlivro?id=' + idBanco, {
        method: 'DELETE'
    })
        .then(function (resposta) {
            if (!resposta.ok) {
                throw new Error('Erro HTTP ao apagar livro: ' + resposta.status);
            }
            carregarLivros();
        })
        .catch(function (erro) {
            const ehErroDeConexao = erro instanceof TypeError || erro.name === 'AbortError';

            if (ehErroDeConexao) {
                console.log('Backend indisponível, apagando localmente.');
                apagarLivroLocal(idBanco);
                carregarLivros();
            } else {
                console.log('Erro ao apagar o livro: ', erro);
                alert('Erro ao apagar o livro.');
            }
        });
}

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {
    const formLivro = document.getElementById('form-livro');

    if (formLivro) {
        formLivro.addEventListener('submit', function (event) {
            event.preventDefault();

            let nota = 0;
            const botoesNota = document.getElementsByName('avaliacao');
            for (let i = 0; i < botoesNota.length; i++) {
                if (botoesNota[i].checked) {
                    nota = parseInt(botoesNota[i].value, 10);
                }
            }

            const livroNovo = {
                titulo: document.getElementById('titulo').value,
                qtde_paginas: parseInt(document.getElementById('qtde-paginas').value, 10),
                autor: document.getElementById('autor').value,
                genero: document.getElementById('genero').value,
                status: document.getElementById('status').value,
                data_inicio: document.getElementById('data-inicio').value || null,
                pagina_atual: parseInt(document.getElementById('pagina-atual').value, 10) || 0,
                data_fim: document.getElementById('data-fim').value || null,
                anotacoes: document.getElementById('anotacoes').value,
                nota: nota
            };

            const estaEditando = idEditando !== -1;
            const url = estaEditando
                ? baseUrl + '/atualizarlivro?id=' + idEditando
                : baseUrl + '/cadastrarlivro';
            const metodo = estaEditando ? 'PATCH' : 'POST';

            fetchComTimeout(url, {
                method: metodo,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(livroNovo)
            })
                .then(function (resposta) {
                    if (!resposta.ok) {
                        const erroBackend = new Error('Backend recusou os dados: ' + resposta.status);
                        erroBackend.tipo = 'erro-backend';
                        throw erroBackend;
                    }
                    mudarTela('tela-lista');
                })
                .catch(function (erro) {
                    if (erro && erro.tipo === 'erro-backend') {
                        console.log('Erro de validação do backend ao salvar.');
                        alert('Erro ao salvar, livro já cadastrado!');
                        return;
                    }

                    console.log('Backend indisponível, salvando localmente. Detalhe:', erro);

                    try {
                        if (estaEditando) {
                            atualizarLivroLocal(idEditando, livroNovo);
                        } else {
                            cadastrarLivroLocal(livroNovo);
                        }
                        mudarTela('tela-lista');
                    } catch (erroLocal) {
                        console.log('Erro ao salvar localmente:', erroLocal);

                        if (erroLocal.tipo === 'duplicado-local') {
                            alert('Erro ao salvar, livro já cadastrado!');
                        } else {
                            alert('Não foi possível salvar o livro.');
                        }
                    }
                });
        });
    }

    // Carrega os livros assim que a página é aberta
    carregarLivros();
});
