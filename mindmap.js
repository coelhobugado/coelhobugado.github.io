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
    let connectButton = null;

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
    let currentlySelectedNodeId = null;
    let selectedNodeForDragging = null;
    let isDraggingNode = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    function getNodeAt(targetX, targetY) {
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            if (targetX >= node.x && targetX <= node.x + node.width &&
                targetY >= node.y && targetY <= node.y + node.height) {
                return node;
            }
        }
        return null;
    }

    function createNode(x, y, text = 'Novo Nó', width = 150, height = 100, color = CANVAS_DEFAULTS.NODE_COLOR, shape = 'rectangle') {
        return {
            id: Date.now() + Math.random(),
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

    function getEdgeConnectionPoint(node, outsidePoint) {
        const nodeCenterX = node.x + node.width / 2;
        const nodeCenterY = node.y + node.height / 2;

        const dx = outsidePoint.x - nodeCenterX;
        const dy = outsidePoint.y - nodeCenterY;

        let t = Infinity, edgeX, edgeY;

        if (dy !== 0) {
            const currentT = (node.y - nodeCenterY) / dy;
            if (currentT > 0) {
                const x = nodeCenterX + currentT * dx;
                if (x >= node.x && x <= node.x + node.width && currentT < t) {
                    t = currentT; edgeX = x; edgeY = node.y;
                }
            }
        }
        if (dy !== 0) {
            const currentT = (node.y + node.height - nodeCenterY) / dy;
            if (currentT > 0) {
                const x = nodeCenterX + currentT * dx;
                if (x >= node.x && x <= node.x + node.width && currentT < t) {
                    t = currentT; edgeX = x; edgeY = node.y + node.height;
                }
            }
        }
        if (dx !== 0) {
            const currentT = (node.x - nodeCenterX) / dx;
            if (currentT > 0) {
                const y = nodeCenterY + currentT * dy;
                if (y >= node.y && y <= node.y + node.height && currentT < t) {
                    t = currentT; edgeX = node.x; edgeY = y;
                }
            }
        }
        if (dx !== 0) {
            const currentT = (node.x + node.width - nodeCenterX) / dx;
            if (currentT > 0) {
                const y = nodeCenterY + currentT * dy;
                if (y >= node.y && y <= node.y + node.height && currentT < t) {
                    t = currentT; edgeX = node.x + node.width; edgeY = y;
                }
            }
        }
        if (t === Infinity) return { x: nodeCenterX, y: nodeCenterY }; 
        return { x: edgeX, y: edgeY };
    }

    const minZoom = 0.1;
    const maxZoom = 5.0;

    function resizeCanvas() {
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        draw();
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

    function drawConnections(ctx, connectionsArray, nodesArray) {
        connectionsArray.forEach(conn => {
            const fromNode = nodesArray.find(node => node.id === conn.fromNodeId);
            const toNode = nodesArray.find(node => node.id === conn.toNodeId);

            if (fromNode && toNode) {
                const fromNodeCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
                const toNodeCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

                const startPoint = getEdgeConnectionPoint(fromNode, toNodeCenter);
                const endPoint = getEdgeConnectionPoint(toNode, fromNodeCenter);

                const cp1 = { x: startPoint.x, y: startPoint.y };
                const cp2 = { x: endPoint.x, y: endPoint.y };

                const distance = Math.sqrt(Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2));
                const offset = Math.max(distance / 3, 50);

                if (Math.abs(startPoint.x - endPoint.x) > Math.abs(startPoint.y - endPoint.y)) {
                    if (startPoint.y < endPoint.y) {
                        cp1.y += offset;
                        cp2.y -= offset;
                    } else {
                        cp1.y -= offset;
                        cp2.y += offset;
                    }
                } else {
                    if (startPoint.x < endPoint.x) {
                        cp1.x += offset;
                        cp2.x -= offset;
                    } else {
                        cp1.x -= offset;
                        cp2.x += offset;
                    }
                }

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
            ctx.save();

            ctx.fillStyle = node.color || CANVAS_DEFAULTS.NODE_COLOR;
            ctx.strokeStyle = CANVAS_DEFAULTS.NODE_BORDER_COLOR;
            ctx.lineWidth = CANVAS_DEFAULTS.NODE_BORDER_WIDTH;

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
            } else {
                ctx.beginPath();
                ctx.rect(node.x, node.y, node.width, node.height);
                ctx.fill();
                ctx.stroke();
            }

            let selectionStrokeStyle = null;
            if (isConnectingModeFlag && node.id === firstSelectedNodeId) {
                selectionStrokeStyle = CANVAS_DEFAULTS.CONNECTION_MODE_SELECTION_BORDER_COLOR;
            } else if (node.id === currentSelectedNodeId) {
                selectionStrokeStyle = CANVAS_DEFAULTS.STANDARD_SELECTION_BORDER_COLOR;
            }

            if (selectionStrokeStyle) {
                ctx.strokeStyle = selectionStrokeStyle;
                ctx.lineWidth = CANVAS_DEFAULTS.SELECTION_BORDER_WIDTH;
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
                } else {
                    ctx.beginPath();
                    ctx.rect(node.x, node.y, node.width, node.height);
                }
                ctx.stroke();
            }

            const fontSize = node.fontSize || CANVAS_DEFAULTS.NODE_FONT_SIZE;
            const fontFamily = node.fontFamily || CANVAS_DEFAULTS.NODE_FONT_FAMILY;
            const fontWeight = node.isBold ? 'bold' : 'normal';
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            ctx.fillStyle = node.textColor || CANVAS_DEFAULTS.NODE_TEXT_COLOR;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.text, node.x + node.width / 2, node.y + node.height / 2);
            
            ctx.restore();
        });
    }

    function draw() {
        drawCanvasBase(ctx, canvas, panX, panY, zoom);

        ctx.save();
        drawConnections(ctx, connections, nodes);
        ctx.restore();

        drawNodes(ctx, nodes, isConnectingMode, firstSelectedNodeForConnectionId, currentlySelectedNodeId);

        ctx.restore();
    }

    window.addEventListener('keydown', (event) => {
        if ((event.key === 'Delete' || event.key === 'Backspace') && currentlySelectedNodeId !== null) {
            const nodeIdToRemove = currentlySelectedNodeId;
            nodes = nodes.filter(node => node.id !== nodeIdToRemove);
            connections = connections.filter(conn => conn.fromNodeId !== nodeIdToRemove && conn.toNodeId !== nodeIdToRemove);
            
            finishEditing();
            currentlySelectedNodeId = null;
            updateTextFormatControls(null);
            draw();
        }
    });

    canvas.addEventListener('wheel', (event) => {
        finishEditing();
        event.preventDefault();
        const zoomFactor = 1.1;
        const mouseX = event.offsetX;
        const mouseY = event.offsetY;

        const worldBeforeZoom = screenToWorld(mouseX, mouseY);

        if (event.deltaY < 0) {
            zoom = Math.min(zoom * zoomFactor, maxZoom);
        } else {
            zoom = Math.max(zoom / zoomFactor, minZoom);
        }

        const worldAfterZoom = screenToWorld(mouseX, mouseY);

        panX += (worldAfterZoom.x - worldBeforeZoom.x) * zoom;
        panY += (worldAfterZoom.y - worldBeforeZoom.y) * zoom;

        draw();
    });

    canvas.addEventListener('dblclick', (event) => {
        const worldMousePos = screenToWorld(event.offsetX, event.offsetY);
        const nodeToEdit = getNodeAt(worldMousePos.x, worldMousePos.y);

        if (nodeToEdit) {
            event.stopPropagation();

            finishEditing();

            isEditingText = true;
            editingNode = nodeToEdit;

            textInput = document.createElement('textarea');
            textInput.value = editingNode.text;
            textInput.style.position = 'absolute';

            const canvasRect = canvas.getBoundingClientRect();
            const screenX = editingNode.x * zoom + panX + canvasRect.left;
            const screenY = editingNode.y * zoom + panY + canvasRect.top;
            const screenWidth = editingNode.width * zoom;
            const screenHeight = editingNode.height * zoom;

            textInput.style.left = `${screenX}px`;
            textInput.style.top = `${screenY}px`;
            textInput.style.width = `${screenWidth}px`;
            textInput.style.height = `${screenHeight}px`;
            textInput.style.fontFamily = editingNode.fontFamily || 'Arial';
            textInput.style.fontSize = `${editingNode.fontSize * zoom}px`;
            textInput.style.color = editingNode.textColor || '#000000';
            textInput.style.fontWeight = editingNode.isBold ? 'bold' : 'normal';
            textInput.style.textAlign = 'center';
            textInput.style.padding = '0';
            textInput.style.boxSizing = 'border-box';
            textInput.style.border = '1px solid #777';
            textInput.style.outline = 'none';
            textInput.style.resize = 'none';
            textInput.style.overflow = 'hidden';
            
            document.body.appendChild(textInput);
            textInput.focus();
            textInput.select();

            textInput.addEventListener('blur', finishEditing);
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    finishEditing();
                }
                if (e.key === 'Escape') {
                    if (textInput && editingNode) textInput.value = editingNode.text;
                    finishEditing();
                }
            });
        } else {
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const worldCoords = screenToWorld(mouseX, mouseY);
            const newNode = createNode(worldCoords.x - 75, worldCoords.y - 50);
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

        if (event.button === 0) {
            if (!isConnectingMode) {
                const clickedNode = getNodeAt(worldMousePos.x, worldMousePos.y);
                if (clickedNode) {
                    selectedNodeForDragging = clickedNode;
                    isDraggingNode = true;
                    dragOffsetX = worldMousePos.x - selectedNodeForDragging.x;
                    dragOffsetY = worldMousePos.y - selectedNodeForDragging.y;
                    
                    finishEditing();
                    currentlySelectedNodeId = selectedNodeForDragging.id;
                    updateTextFormatControls(selectedNodeForDragging);
                    event.stopPropagation();
                    draw();
                } else {
                    finishEditing();
                    currentlySelectedNodeId = null;
                    updateTextFormatControls(null);
                    draw();
                }
            } else {
                const clickedNode = getNodeAt(worldMousePos.x, worldMousePos.y);
                if (clickedNode) {
                    if (firstSelectedNodeForConnectionId === null) {
                        firstSelectedNodeForConnectionId = clickedNode.id;
                        currentlySelectedNodeId = null;
                    } else if (firstSelectedNodeForConnectionId !== clickedNode.id) {
                        const existingConnection = connections.find(c =>
                            (c.fromNodeId === firstSelectedNodeForConnectionId && c.toNodeId === clickedNode.id) ||
                            (c.fromNodeId === clickedNode.id && c.toNodeId === firstSelectedNodeForConnectionId)
                        );
                        if (!existingConnection) {
                            connections.push({
                                id: Date.now(),
                                fromNodeId: firstSelectedNodeForConnectionId,
                                toNodeId: clickedNode.id
                            });
                        }
                        firstSelectedNodeForConnectionId = null;
                        isConnectingMode = false;
                        if(connectButton) connectButton.textContent = '🔗 Criar Conexão';
                    } else {
                        firstSelectedNodeForConnectionId = null;
                    }
                    draw();
                }
            }
        } else if (event.button === 1) {
            isPanning = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            canvas.style.cursor = 'grabbing';
        }
    });

    canvas.addEventListener('mousemove', (event) => {
        if (isDraggingNode && selectedNodeForDragging) {
            const worldMousePos = screenToWorld(event.offsetX, event.offsetY);
            selectedNodeForDragging.x = worldMousePos.x - dragOffsetX;
            selectedNodeForDragging.y = worldMousePos.y - dragOffsetY;
            draw();
        } else if (isPanning) {
            finishEditing();
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
            canvas.style.cursor = 'grab';
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = 'default';
        }
        if (isDraggingNode) {
            isDraggingNode = false;
            selectedNodeForDragging = null;
        }
    });

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const addNodeButton = document.getElementById('addNode');
    connectButton = document.getElementById('toggleConnectionMode');

    addNodeButton.addEventListener('click', () => {
        const centerX = screenToWorld(canvas.width / 2, canvas.height / 2).x;
        const centerY = screenToWorld(canvas.width / 2, canvas.height / 2).y;
        const newNode = createNode(centerX - 75, centerY - 50, 'Novo Nó (Botão)');
        nodes.push(newNode);
        draw();
    });

    const zoomInButton = document.getElementById('zoomIn');
    const zoomOutButton = document.getElementById('zoomOut');

    if (connectButton) {
        connectButton.addEventListener('click', () => {
            finishEditing();
            isConnectingMode = !isConnectingMode;
            if (isConnectingMode) {
                connectButton.textContent = 'Cancelar Modo de Conexão';
                currentlySelectedNodeId = null;
                firstSelectedNodeForConnectionId = null;
                updateTextFormatControls(null);
            } else {
                connectButton.textContent = '🔗 Criar Conexão';
                firstSelectedNodeForConnectionId = null;
            }
            draw();
        });
    }

    zoomInButton.addEventListener('click', () => {
        finishEditing();
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
        finishEditing();
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
            finishEditing();
            const link = document.createElement('a');
            link.download = 'mapa-mental.png';
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
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
    textColorInput.addEventListener('input', () => {
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
    
    function updateTextEditingStyle() {
        if (isEditingText && textInput && editingNode && editingNode.id === currentlySelectedNodeId) {
            textInput.style.fontSize = `${editingNode.fontSize * zoom}px`;
            textInput.style.color = editingNode.textColor || '#000000';
            textInput.style.fontWeight = editingNode.isBold ? 'bold' : 'normal';
        }
    }

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

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme('light');
    }
});