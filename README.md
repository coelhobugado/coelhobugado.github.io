# 🧠 Gerador de Mapas Mentais com IA

Bem-vindo ao Gerador de Mapas Mentais com IA! Esta é uma aplicação web que permite criar mapas mentais visualmente atraentes e organizados a partir de um texto base, utilizando o poder da Inteligência Artificial através da API Gemini.

## Funcionalidades Principais

*   **Entrada de Texto Simples:** Forneça o texto base que deseja transformar em um mapa mental.
*   **Geração com IA:** Utiliza a API Gemini (especificamente o modelo `gemini-2.0-flash`) para analisar o texto e gerar uma estrutura hierárquica para o mapa mental.
*   **Visualização Interativa:**
    *   O mapa mental é renderizado como um gráfico SVG interativo.
    *   **Zoom:** Aproxime e afaste o mapa para melhor visualização.
    *   **Pan (Arrastar):** Mova a área visível do mapa.
    *   **Resetar Visualização:** Centralize e ajuste o zoom do mapa para a visualização padrão.
*   **Temas:**
    *   **Alternador de Tema:** Mude entre o tema claro e escuro para melhor conforto visual.
*   **Nós Inteligentes:**
    *   **Truncamento de Texto:** Títulos de nós muito longos são automaticamente abreviados com "..." para manter a clareza. O texto completo pode ser visto no dataset do nó (para desenvolvimento).
    *   **Evitar Colisões:** Um algoritmo básico tenta evitar que os nós se sobreponham, ajustando suas posições.
    *   **Estilo Dinâmico:** Os nós possuem tamanhos e cores dinâmicas baseadas no seu nível hierárquico e tema atual.
*   **Feedback ao Usuário:**
    *   **Indicador de Carregamento:** Exibe uma animação enquanto o mapa mental está sendo gerado.
    *   **Mensagens de Erro:** Informa sobre problemas comuns (ex: chave de API inválida, texto de entrada muito curto, falhas na API).
*   **Chave de API:** Requer que o usuário insira sua própria chave da API Gemini para funcionar.

## Como Usar

1.  **Abra o Arquivo:** Abra o arquivo `index.html` em seu navegador web preferido (Google Chrome, Firefox, Edge, etc.).
2.  **Insira a Chave da API:** Ao carregar a página, um pop-up solicitará sua chave da API Gemini. Cole sua chave e clique em "OK".
    *   *Nota: A chave é armazenada localmente no navegador e não é enviada para nenhum servidor externo além da API do Google Gemini.*
3.  **Forneça o Texto Base:** Na seção "Insira o texto base para o seu mapa mental:", digite ou cole o conteúdo que você deseja usar para criar o mapa.
    *   *Dica: Textos com uma estrutura clara ou tópicos bem definidos tendem a gerar mapas melhores.*
4.  **Gere o Mapa:** Clique no botão "💡 Gerar Mapa Mental".
5.  **Interaja com o Mapa:**
    *   Use os botões `+`, `-` e `🎯` no canto superior direito do mapa para controlar o zoom e recentralizar.
    *   Clique e arraste no fundo do mapa para movê-lo.
    *   Use a roda do mouse (scroll) sobre o mapa para aplicar zoom.
6.  **Limpar:** Clique em "🗑️ Limpar Tudo" para apagar o texto de entrada e o mapa mental atual.
7.  **Alternar Tema:** Clique no botão "🌓 Tema" (ou "🌙 Tema Escuro" / "☀️ Tema Claro") para mudar a aparência da interface e do mapa.

## Tecnologias Utilizadas

*   **HTML5:** Estrutura da página.
*   **CSS3:** Estilização, incluindo variáveis CSS para temas e design responsivo básico.
*   **JavaScript (Vanilla ES6+):** Lógica da aplicação, manipulação do DOM, interações SVG e chamadas à API.
*   **API Google Gemini:** Para a geração da estrutura do mapa mental a partir do texto.

## Observações sobre a Geração do Mapa

*   A qualidade do mapa mental gerado depende da clareza e estrutura do texto de entrada, bem como da capacidade do modelo Gemini em interpretá-lo.
*   O prompt enviado à API instrui o modelo a criar títulos com no máximo `MAX_TEXT_LENGTH` (definido no código como 30 caracteres) e a seguir uma estrutura hierárquica específica. Ocasionalmente, o modelo pode não seguir estas instruções perfeitamente.

Divirta-se criando seus mapas mentais!
