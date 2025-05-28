console.log('mindmap.js carregado');

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('mindMapCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('canvas-container');

    let isEditingText = false;
    let editingNode = null;
    let textInput = null;

    let connections = [];
    let isConnectingMode = false;
    let firstSelectedNodeForConnectionId = null;
    let connectButton = null; // Será atribuído em DOMContentLoaded

    const textFormatControlsDiv = document.getElementById('textFormatControls');
    const fontSizeInput = document.getElementById('fontSizeInput');
    const textColorInput = document.getElementById('textColorInput');
    const toggleBoldButton = document.getElementById('toggleBoldButton');

    function updateTextFormatControls(node) {
        if (node) {
            fontSizeInput.value = node.fontSize || 16;
            textColorInput.value = node.textColor || '#000000';
            toggleBoldButton.textContent = node.isBold ? 'Remover Negrito' : 'Negrito';
            toggleBoldButton.style.fontWeight = node.isBold ? 'bold' : 'normal';
            textFormatControlsDiv.style.display = 'block';
        } else {
            textFormatControlsDiv.style.display = 'none';
        }
    }

    // Definição de constantes para facilitar a customização
    const CANVAS_DEFAULTS = {
        NODE_COLOR: 'lightblue',
        NODE_FONT_FAMILY: 'Arial',
        NODE_FONT_SIZE: 16,
        NODE_TEXT_COLOR: '#000000',
        NODE_BORDER_COLOR: 'black',
        NODE_BORDER_WIDTH: 1,
        CONNECTION_MODE_SELECTION_BORDER_COLOR: 'green',
        STANDARD_SELECTION_BORDER_COLOR: 'red',
        SELECTION_BORDER_WIDTH: 3,
        CONNECTION_STROKE_COLOR: 'grey',
        CONNECTION_LINE_WIDTH: 2
    };

    let nodes = [];
    let currentlySelectedNodeId = null; // Para seleção e exclusão
    let selectedNodeForDragging = null;
    let isDraggingNode = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    function getNodeAt(targetX, targetY) {
        // Itera de trás para frente para selecionar o nó mais acima (se houver sobreposição)
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            // Verifica se o ponto está dentro do retângulo delimitador do nó
            if (targetX >= node.x && targetX <= node.x + node.width &&
                targetY >= node.y && targetY <= node.y + node.height) {
                return node;
            }
        }
        return null;
    }

    function createNode(x, y, text = 'Novo Nó', width = 150, height = 100, color = CANVAS_DEFAULTS.NODE_COLOR, shape = 'rectangle') {
        return {
            id: Date.now() + Math.random(), // Garante um ID único
            x,
            y,
            width,
            height,
            text,
            color,
            shape,
            fontSize: CANVAS_DEFAULTS.NODE_FONT_SIZE,
            fontFamily: CANVAS_DEFAULTS.NODE_FONT_FAMILY,
            textColor: CANVAS_DEFAULTS.NODE_TEXT_COLOR,
            isBold: false
        };
    }

    let panX = 0;
    let panY = 0;
    let zoom = 1;

    // Ajuda a encontrar o ponto de conexão na borda do retângulo delimitador de um nó
    function getEdgeConnectionPoint(node, outsidePoint) {
        const nodeCenterX = node.x + node.width / 2;
        const nodeCenterY = node.y + node.height / 2;

        const dx = outsidePoint.x - nodeCenterX;
        const dy = outsidePoint.y - nodeCenterY;

        let t = Infinity, edgeX, edgeY;

        // Verifica a interseção com cada um dos 4 lados do retângulo delimitador
        // Borda superior: y = node.y
        if (dy !== 0) {
            const currentT = (node.y - nodeCenterY) / dy;
            if (currentT > 0) {
                const x = nodeCenterX + currentT * dx;
                if (x >= node.x && x <= node.x + node.width && currentT < t) {
                    t = currentT; edgeX = x; edgeY = node.y;
                }
            }
        }
        // Borda inferior: y = node.y + node.height
        if (dy !== 0) {
            const currentT = (node.y + node.height - nodeCenterY) / dy;
            if (currentT > 0) {
                const x = nodeCenterX + currentT * dx;
                if (x >= node.x && x <= node.x + node.width && currentT < t) {
                    t = currentT; edgeX = x; edgeY = node.y + node.height;
                }
            }
        }
        // Borda esquerda: x = node.x
        if (dx !== 0) {
            const currentT = (node.x - nodeCenterX) / dx;
            if (currentT > 0) {
                const y = nodeCenterY + currentT * dy;
                if (y >= node.y && y <= node.y + node.height && currentT < t) {
                    t = currentT; edgeX = node.x; edgeY = y;
                }
            }
        }
        // Borda direita: x = node.x + node.width
        if (dx !== 0) {
            const currentT = (node.x + node.width - nodeCenterX) / dx;
            if (currentT > 0) {
                const y = nodeCenterY + currentT * dy;
                if (y >= node.y && y <= node.y + node.height && currentT < t) {
                    t = currentT; edgeX = node.x + node.width; edgeY = y;
                }
            }
        }
        // Se nenhuma interseção for encontrada (ex: outsidePoint está dentro do nó), retorna o centro ou um fallback
        if (t === Infinity) return { x: nodeCenterX, y: nodeCenterY }; 
        return { x: edgeX, y: edgeY };
    }

    const minZoom = 0.1;
    const maxZoom = 5.0;

    function resizeCanvas() {
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        draw(); // Redesenha o conteúdo após redimensionar
        console.log('Canvas redimensionado para:', canvas.width, 'x', canvas.height);
    }

    function worldToScreen(x, y) {
        return { x: x * zoom + panX, y: y * zoom + panY };
    }

    function screenToWorld(x, y) {
        return { x: (x - panX) / zoom, y: (y - panY) / zoom };
    }

    function drawCanvasBase(ctx, canvasElement, currentPanX, currentPanY, currentZoom) {
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        ctx.save();
        ctx.translate(currentPanX, currentPanY);
        ctx.scale(currentZoom, currentZoom);
    }

    function drawConnections(ctx, connectionsArray, nodesArray /* nodesArray é mantido para buscar, mas a busca pelo ID é mais robusta */) {
        connectionsArray.forEach(conn => {
            // Buscando os nós pelos IDs, o que é mais seguro caso a array 'nodes' seja modificada
            const fromNode = nodesArray.find(node => node.id === conn.fromNodeId);
            const toNode = nodesArray.find(node => node.id === conn.toNodeId);

            if (fromNode && toNode) {
                const fromNodeCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
                const toNodeCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

                const startPoint = getEdgeConnectionPoint(fromNode, toNodeCenter);
                const endPoint = getEdgeConnectionPoint(toNode, fromNodeCenter);

                // Pontos de controle para a curva de Bezier
                let cp1 = { x: startPoint.x, y: startPoint.y };
                let cp2 = { x: endPoint.x, y: endPoint.y };

                // Calcula um deslocamento dinâmico para os pontos de controle para fazer as curvas fluírem "para fora"
                const horizontalDistance = Math.abs(startPoint.x - endPoint.x);
                const verticalDistance = Math.abs(startPoint.y - endPoint.y);
                let offset = Math.max(horizontalDistance * 0.3, verticalDistance * 0.3, 50); // Garante um deslocamento mínimo

                // Ajusta os pontos de controle com base nas posições relativas para uma curva mais suave e para fora
                // Esta lógica pode ser bastante complexa para ser perfeita em todos os ângulos.
                // Uma abordagem mais simples pode ser usar apenas um deslocamento fixo em x/y, ou tangente à borda do nó.
                if (startPoint.x < toNodeCenter.x) cp1.x += offset; else cp1.x -= offset;
                if (startPoint.y < toNodeCenter.y) cp1.y += offset; else cp1.y -= offset;

                if (endPoint.x < fromNodeCenter.x) cp2.x += offset; else cp2.x -= offset;
                if (endPoint.y < fromNodeCenter.y) cp2.y += offset; else cp2.y -= offset;

                ctx.beginPath();
                ctx.moveTo(startPoint.x, startPoint.y);
                ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPoint.x, endPoint.y);
                ctx.strokeStyle = conn.color || CANVAS_DEFAULTS.CONNECTION_STROKE_COLOR;
                ctx.lineWidth = conn.lineWidth || CANVAS_DEFAULTS.CONNECTION_LINE_WIDTH;
                ctx.stroke();
            }
        });
    }

    function drawNodes(ctx, nodesArray, isConnectingModeFlag, firstSelectedNodeId, currentSelectedNodeId) {
        nodesArray.forEach(node => {
            ctx.save(); // Salva o contexto para cada nó

            ctx.fillStyle = node.color || CANVAS_DEFAULTS.NODE_COLOR;
            ctx.strokeStyle = CANVAS_DEFAULTS.NODE_BORDER_COLOR;
            ctx.lineWidth = CANVAS_DEFAULTS.NODE_BORDER_WIDTH;

            // Desenha a forma
            if (node.shape === 'ellipse') {
                ctx.beginPath();
                ctx.ellipse(node.x + node.width / 2, node.y + node.height / 2, node.width / 2, node.height / 2, 0, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            } else if (node.shape === 'diamond') {
                ctx.beginPath();
                ctx.moveTo(node.x + node.width / 2, node.y);
                ctx.lineTo(node.x + node.width, node.y + node.height / 2);
                ctx.lineTo(node.x + node.width / 2, node.y + node.height);
                ctx.lineTo(node.x, node.y + node.height / 2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else { // Retângulo
                ctx.beginPath();
                ctx.rect(node.x, node.y, node.width, node.height);
                ctx.fill();
                ctx.stroke();
            }

            // Desenha o indicador de seleção
            let selectionStrokeStyle = null;
            if (isConnectingModeFlag && node.id === firstSelectedNodeId) {
                selectionStrokeStyle = CANVAS_DEFAULTS.CONNECTION_MODE_SELECTION_BORDER_COLOR;
            } else if (node.id === currentSelectedNodeId) {
                selectionStrokeStyle = CANVAS_DEFAULTS.STANDARD_SELECTION_BORDER_COLOR;
            }

            if (selectionStrokeStyle) {
                ctx.strokeStyle = selectionStrokeStyle;
                ctx.lineWidth = CANVAS_DEFAULTS.SELECTION_BORDER_WIDTH;
                // Redesenha o caminho da forma para a borda de seleção
                if (node.shape === 'ellipse') {
                    ctx.beginPath();
                    ctx.ellipse(node.x + node.width / 2, node.y + node.height / 2, node.width / 2, node.height / 2, 0, 0, 2 * Math.PI);
                } else if (node.shape === 'diamond') {
                    ctx.beginPath();
                    ctx.moveTo(node.x + node.width / 2, node.y);
                    ctx.lineTo(node.x + node.width, node.y + node.height / 2);
                    ctx.lineTo(node.x + node.width / 2, node.y + node.height);
                    ctx.lineTo(node.x, node.y + node.height / 2);
                    ctx.closePath();
                } else { // Retângulo
                    ctx.beginPath();
                    ctx.rect(node.x, node.y, node.width, node.height);
                }
                ctx.stroke();
            }

            // Desenha o texto
            const fontSize = node.fontSize || CANVAS_DEFAULTS.NODE_FONT_SIZE;
            const fontFamily = node.fontFamily || CANVAS_DEFAULTS.NODE_FONT_FAMILY;
            const fontWeight = node.isBold ? 'bold' : 'normal';
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            ctx.fillStyle = node.textColor || CANVAS_DEFAULTS.NODE_TEXT_COLOR;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.text, node.x + node.width / 2, node.y + node.height / 2);
            
            ctx.restore(); // Restaura o contexto após desenhar cada nó
        });
    }

    function draw() {
        drawCanvasBase(ctx, canvas, panX, panY, zoom);

        ctx.save(); // Para estilos específicos de conexão (embora os padrões sejam usados agora)
        drawConnections(ctx, connections, nodes);
        ctx.restore();

        drawNodes(ctx, nodes, isConnectingMode, firstSelectedNodeForConnectionId, currentlySelectedNodeId);

        ctx.restore(); // Corresponde ao save em drawCanvasBase
    }

    window.addEventListener('keydown', (event) => {
        if ((event.key === 'Delete' || event.key === 'Backspace') && currentlySelectedNodeId !== null) {
            const nodeIdToRemove = currentlySelectedNodeId;
            nodes = nodes.filter(node => node.id !== nodeIdToRemove);
            // Remove as conexões associadas ao nó excluído
            connections = connections.filter(conn => conn.fromNodeId !== nodeIdToRemove && conn.toNodeId !== nodeIdToRemove);
            currentlySelectedNodeId = null;
            updateTextFormatControls(null); // Oculta os controles
            draw();
        }
    });

    canvas.addEventListener('wheel', (event) => {
        if (isEditingText && textInput) {
            finishEditing();
        }
        event.preventDefault();
        const zoomFactor = 1.1;
        const mouseX = event.offsetX;
        const mouseY = event.offsetY;

        const worldBeforeZoom = screenToWorld(mouseX, mouseY);

        if (event.deltaY < 0) { // Zoom in
            zoom = Math.min(zoom * zoomFactor, maxZoom);
        } else { // Zoom out
            zoom = Math.max(zoom / zoomFactor, minZoom);
        }

        const worldAfterZoom = screenToWorld(mouseX, mouseY);

        // Ajusta o pan para dar zoom em direção ao cursor do mouse
        panX += (worldAfterZoom.x - worldBeforeZoom.x) * zoom;
        panY += (worldAfterZoom.y - worldBeforeZoom.y) * zoom;

        draw();
    });

    canvas.addEventListener('dblclick', (event) => {
        const worldMousePos = screenToWorld(event.offsetX, event.offsetY);
        const nodeToEdit = getNodeAt(worldMousePos.x, worldMousePos.y);

        if (nodeToEdit) {
            event.stopPropagation(); // Previne a criação de um novo nó se um nó foi clicado duas vezes

            if (isEditingText && textInput) {
                textInput.blur(); // Salva a edição de texto anterior antes de iniciar uma nova
            }

            isEditingText = true;
            editingNode = nodeToEdit;

            textInput = document.createElement('textarea');
            textInput.value = editingNode.text;
            textInput.style.position = 'absolute'; // Posição relativa à viewport

            const canvasRect = canvas.getBoundingClientRect();
            // Calcula as coordenadas de tela do canto superior esquerdo do nó
            const screenX = editingNode.x * zoom + panX + canvasRect.left;
            const screenY = editingNode.y * zoom + panY + canvasRect.top;
            const screenWidth = editingNode.width * zoom;
            const screenHeight = editingNode.height * zoom;

            textInput.style.left = `${screenX}px`;
            textInput.style.top = `${screenY}px`;
            textInput.style.width = `${screenWidth}px`;
            textInput.style.height = `${screenHeight}px`;
            // Aplica estilos de fonte diretamente na textarea para consistência
            textInput.style.fontFamily = editingNode.fontFamily || 'Arial';
            textInput.style.fontSize = `${editingNode.fontSize * zoom}px`; // Escala a fonte com o zoom
            textInput.style.color = editingNode.textColor || '#000000';
            textInput.style.fontWeight = editingNode.isBold ? 'bold' : 'normal';
            textInput.style.textAlign = 'center';
            textInput.style.padding = '0';
            textInput.style.boxSizing = 'border-box';
            textInput.style.border = '1px solid #777';
            textInput.style.outline = 'none';
            textInput.style.resize = 'none'; // Previne o redimensionamento manual da textarea
            textInput.style.overflow = 'hidden'; // Oculta as barras de rolagem
            
            document.body.appendChild(textInput);
            textInput.focus();
            textInput.select();

            textInput.addEventListener('blur', finishEditing);
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); // Previne nova linha na textarea ao pressionar Enter
                    finishEditing();
                }
                if (e.key === 'Escape') {
                    // Reverte para o texto original antes de fechar ou apenas fecha
                    if (textInput && editingNode) textInput.value = editingNode.text; // Opcional: reverte no Esc
                    finishEditing();
                }
            });
        } else {
            // Lógica existente para criar um novo nó se clicado duas vezes em uma área vazia do canvas
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const worldCoords = screenToWorld(mouseX, mouseY);
            const newNode = createNode(worldCoords.x - 75, worldCoords.y - 50); // Centraliza o novo nó sob o cursor
            nodes.push(newNode);
            draw();
        }
    });

    let isPanning = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    function finishEditing() {
        if (!isEditingText || !editingNode || !textInput) return;
        editingNode.text = textInput.value;
        document.body.removeChild(textInput);
        textInput = null;
        isEditingText = false;
        editingNode = null;
        draw();
    }

    canvas.addEventListener('mousedown', (event) => {
        const worldMousePos = screenToWorld(event.offsetX, event.offsetY);

        if (event.button === 0) { // Botão esquerdo do mouse
            if (!isConnectingMode) {
                const clickedNode = getNodeAt(worldMousePos.x, worldMousePos.y);
                if (clickedNode) {
                    selectedNodeForDragging = clickedNode;
                    isDraggingNode = true;
                    dragOffsetX = worldMousePos.x - selectedNodeForDragging.x;
                    dragOffsetY = worldMousePos.y - selectedNodeForDragging.y;
                    currentlySelectedNodeId = selectedNodeForDragging.id;
                    updateTextFormatControls(selectedNodeForDragging); // Mostra os controles
                    event.stopPropagation(); // Previne o pan ao clicar em um nó
                    draw();
                } else {
                    // Clicou em uma área vazia do canvas, deseleciona
                    currentlySelectedNodeId = null;
                    updateTextFormatControls(null); // Oculta os controles
                    draw();
                }
            } else { // isConnectingMode é verdadeiro
                const clickedNode = getNodeAt(worldMousePos.x, worldMousePos.y);
                if (clickedNode) {
                    if (firstSelectedNodeForConnectionId === null) {
                        firstSelectedNodeForConnectionId = clickedNode.id;
                        currentlySelectedNodeId = null; // Garante que nenhum nó esteja selecionado para arrastar/excluir
                    } else if (firstSelectedNodeForConnectionId !== clickedNode.id) {
                        // Verifica se a conexão já existe (bidirecional)
                        const existingConnection = connections.find(c =>
                            (c.fromNodeId === firstSelectedNodeForConnectionId && c.toNodeId === clickedNode.id) ||
                            (c.fromNodeId === clickedNode.id && c.toNodeId === firstSelectedNodeForConnectionId)
                        );
                        if (!existingConnection) {
                            connections.push({
                                id: Date.now(), // ID único para a conexão
                                fromNodeId: firstSelectedNodeForConnectionId,
                                toNodeId: clickedNode.id
                            });
                        }
                        firstSelectedNodeForConnectionId = null; // Reseta para a próxima conexão
                        isConnectingMode = false; // Sai do modo de conexão após uma conexão bem-sucedida
                        if(connectButton) connectButton.textContent = '🔗 Criar Conexão'; // Reseta o texto do botão
                    } else {
                        // Clicou no mesmo nó novamente, cancela a primeira seleção
                        firstSelectedNodeForConnectionId = null;
                    }
                    draw();
                }
            }
        } else if (event.button === 1) { // Botão do meio do mouse para pan
            isPanning = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            canvas.style.cursor = 'grabbing'; // Muda o cursor para indicar pan
        }
    });

    canvas.addEventListener('mousemove', (event) => {
        if (isDraggingNode && selectedNodeForDragging) {
            const worldMousePos = screenToWorld(event.offsetX, event.offsetY);
            selectedNodeForDragging.x = worldMousePos.x - dragOffsetX;
            selectedNodeForDragging.y = worldMousePos.y - dragOffsetY;
            draw();
        } else if (isPanning) {
            if (isEditingText && textInput) {
                finishEditing(); // Termina a edição de texto se o pan começar
            }
            const dx = event.clientX - lastMouseX;
            const dy = event.clientY - lastMouseY;
            panX += dx;
            panY += dy;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            draw();
        }
    });

    canvas.addEventListener('mouseup', (event) => {
        if (isDraggingNode) {
            isDraggingNode = false;
            selectedNodeForDragging = null;
        }
        if (event.button === 1 && isPanning) {
            isPanning = false;
            canvas.style.cursor = 'grab'; // Volta o cursor
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (isPanning) { // Para o pan se o mouse sair do canvas
            isPanning = false;
            canvas.style.cursor = 'default'; // Ou 'grab' se preferir
        }
        if (isDraggingNode) { // Para o arrasto se o mouse sair do canvas
            isDraggingNode = false;
            selectedNodeForDragging = null;
        }
    });

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Redimensionamento e desenho iniciais

    console.log('Canvas do Mapa Mental Inicializado a partir de mindmap.js');

    const addNodeButton = document.getElementById('addNode');
    connectButton = document.getElementById('toggleConnectionMode'); // Atribui à variável global

    addNodeButton.addEventListener('click', () => {
        const centerX = screenToWorld(canvas.width / 2, canvas.height / 2).x;
        const centerY = screenToWorld(canvas.width / 2, canvas.height / 2).y;
        const newNode = createNode(centerX - 75, centerY - 50, 'Novo Nó (Botão)'); // Centraliza o novo nó
        nodes.push(newNode);
        draw();
    });

    const zoomInButton = document.getElementById('zoomIn');
    const zoomOutButton = document.getElementById('zoomOut');

    if (connectButton) {
        connectButton.addEventListener('click', () => {
            isConnectingMode = !isConnectingMode;
            if (isConnectingMode) {
                connectButton.textContent = 'Cancelar Modo de Conexão';
                currentlySelectedNodeId = null; // Deseleciona qualquer nó para arrastar/excluir
                firstSelectedNodeForConnectionId = null; // Reseta a primeira seleção
                updateTextFormatControls(null); // Oculta os controles de texto
            } else {
                connectButton.textContent = '🔗 Criar Conexão';
                firstSelectedNodeForConnectionId = null; // Reseta a primeira seleção
            }
            draw(); // Para atualizar o feedback visual (ex: borda verde)
        });
    }

    zoomInButton.addEventListener('click', () => {
        if (isEditingText && textInput) {
            finishEditing();
        }
        const zoomFactor = 1.2;
        const center = { x: canvas.width / 2, y: canvas.height / 2 };
        const worldCenterBeforeZoom = screenToWorld(center.x, center.y);

        zoom = Math.min(zoom * zoomFactor, maxZoom);

        const worldCenterAfterZoom = screenToWorld(center.x, center.y);
        panX += (worldCenterAfterZoom.x - worldCenterBeforeZoom.x) * zoom;
        panY += (worldCenterAfterZoom.y - worldCenterBeforeZoom.y) * zoom;
        draw();
    });

    zoomOutButton.addEventListener('click', () => {
        if (isEditingText && textInput) {
            finishEditing();
        }
        const zoomFactor = 1 / 1.2;
        const center = { x: canvas.width / 2, y: canvas.height / 2 };
        const worldCenterBeforeZoom = screenToWorld(center.x, center.y);

        zoom = Math.max(zoom * zoomFactor, minZoom);

        const worldCenterAfterZoom = screenToWorld(center.x, center.y);
        panX += (worldCenterAfterZoom.x - worldCenterBeforeZoom.x) * zoom;
        panY += (worldCenterAfterZoom.y - worldCenterBeforeZoom.y) * zoom;
        draw();
    });

    document.getElementById('setShapeRectangle').addEventListener('click', () => setSelectedNodeShape('rectangle'));
    document.getElementById('setShapeEllipse').addEventListener('click', () => setSelectedNodeShape('ellipse'));
    document.getElementById('setShapeDiamond').addEventListener('click', () => setSelectedNodeShape('diamond'));

    const saveAsImageButton = document.getElementById('saveAsImage');
    if (saveAsImageButton) {
        saveAsImageButton.addEventListener('click', () => {
            if (isEditingText && textInput) {
                finishEditing(); // Finaliza qualquer edição de texto em andamento
            }
            // Cria um elemento de link temporário
            const link = document.createElement('a');
            // Define o atributo download e o nome do arquivo
            link.download = 'mapa-mental.png';
            // Converte o conteúdo do canvas para uma URL de dados (formato PNG)
            link.href = canvas.toDataURL('image/png');
            // Anexa o link ao corpo (necessário para Firefox)
            document.body.appendChild(link);
            // Clica programaticamente no link para iniciar o download
            link.click();
            // Remove o link do corpo
            document.body.removeChild(link);
        });
    }

    function setSelectedNodeShape(shape) {
        if (currentlySelectedNodeId !== null) {
            const selectedNode = nodes.find(node => node.id === currentlySelectedNodeId);
            if (selectedNode) {
                selectedNode.shape = shape;
                draw();
            }
        }
    }

    fontSizeInput.addEventListener('change', () => {
        if (currentlySelectedNodeId !== null) {
            const node = nodes.find(n => n.id === currentlySelectedNodeId);
            if (node) { node.fontSize = parseInt(fontSizeInput.value) || 16; draw(); updateTextEditingStyle(); }
        }
    });
    textColorInput.addEventListener('input', () => { // 'input' para pré-visualização ao vivo
        if (currentlySelectedNodeId !== null) {
            const node = nodes.find(n => n.id === currentlySelectedNodeId);
            if (node) { node.textColor = textColorInput.value; draw(); updateTextEditingStyle(); }
        }
    });
    toggleBoldButton.addEventListener('click', () => {
        if (currentlySelectedNodeId !== null) {
            const node = nodes.find(n => n.id === currentlySelectedNodeId);
            if (node) {
                node.isBold = !node.isBold;
                toggleBoldButton.textContent = node.isBold ? 'Remover Negrito' : 'Negrito';
                toggleBoldButton.style.fontWeight = node.isBold ? 'bold' : 'normal';
                draw();
                updateTextEditingStyle();
            }
        }
    });
    // Função auxiliar para atualizar o estilo da textarea se ela estiver ativa
    function updateTextEditingStyle() {
        if (isEditingText && textInput && editingNode && editingNode.id === currentlySelectedNodeId) {
            textInput.style.fontSize = `${editingNode.fontSize * zoom}px`; // Garante que a fonte escala com o zoom
            textInput.style.color = editingNode.textColor || '#000000';
            textInput.style.fontWeight = editingNode.isBold ? 'bold' : 'normal';
        }
    }

    // Lógica do Tema
    const themeSwitcherButton = document.getElementById('themeSwitcherButton');
    const THEME_STORAGE_KEY = 'mindmap-theme';

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark-theme');
            if (themeSwitcherButton) themeSwitcherButton.textContent = '☀️ Tema Claro';
        } else {
            document.documentElement.classList.remove('dark-theme');
            if (themeSwitcherButton) themeSwitcherButton.textContent = '🌙 Tema Escuro';
        }
    }

    function toggleTheme() {
        let currentThemeToSet;
        // Verifica com base na classe no <html>, que é a fonte da verdade para a exibição atual
        if (document.documentElement.classList.contains('dark-theme')) {
            currentThemeToSet = 'light';
        } else {
            currentThemeToSet = 'dark';
        }
        localStorage.setItem(THEME_STORAGE_KEY, currentThemeToSet);
        applyTheme(currentThemeToSet);
    }

    if (themeSwitcherButton) {
        themeSwitcherButton.addEventListener('click', toggleTheme);
    }

    // Carrega o tema salvo ao carregar a página
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        // Padrão para tema claro se nenhuma preferência for salva
        applyTheme('light');
    }
});