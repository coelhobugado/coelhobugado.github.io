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
    let connectButton = null; // Will be assigned in DOMContentLoaded

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
    let currentlySelectedNodeId = null; // For selection and deletion
    let selectedNodeForDragging = null;
    let isDraggingNode = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    function getNodeAt(targetX, targetY) {
        // Iterate in reverse to select top-most node
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
            id: Date.now() + Math.random(), // Ensure unique ID
            x,
            y,
            width,
            height,
            text,
            color, // This uses the parameter, which defaults to CANVAS_DEFAULTS.NODE_COLOR
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

        // Check intersection with each of the 4 sides
        // Top edge: y = node.y
        if (dy !== 0) {
            const currentT = (node.y - nodeCenterY) / dy;
            if (currentT > 0) {
                const x = nodeCenterX + currentT * dx;
                if (x >= node.x && x <= node.x + node.width && currentT < t) {
                    t = currentT; edgeX = x; edgeY = node.y;
                }
            }
        }
        // Bottom edge: y = node.y + node.height
        if (dy !== 0) {
            const currentT = (node.y + node.height - nodeCenterY) / dy;
            if (currentT > 0) {
                const x = nodeCenterX + currentT * dx;
                if (x >= node.x && x <= node.x + node.width && currentT < t) {
                    t = currentT; edgeX = x; edgeY = node.y + node.height;
                }
            }
        }
        // Left edge: x = node.x
        if (dx !== 0) {
            const currentT = (node.x - nodeCenterX) / dx;
            if (currentT > 0) {
                const y = nodeCenterY + currentT * dy;
                if (y >= node.y && y <= node.y + node.height && currentT < t) {
                    t = currentT; edgeX = node.x; edgeY = y;
                }
            }
        }
        // Right edge: x = node.x + node.width
        if (dx !== 0) {
            const currentT = (node.x + node.width - nodeCenterX) / dx;
            if (currentT > 0) {
                const y = nodeCenterY + currentT * dy;
                if (y >= node.y && y <= node.y + node.height && currentT < t) {
                    t = currentT; edgeX = node.x + node.width; edgeY = y;
                }
            }
        }
        // If no intersection found (e.g. outsidePoint is inside node), return center or a fallback
        if (t === Infinity) return { x: nodeCenterX, y: nodeCenterY }; 
        return { x: edgeX, y: edgeY };
    }
    const minZoom = 0.1;
    const maxZoom = 5.0;

    function resizeCanvas() {
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        draw(); // Redraw content after resize
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

    function drawConnections(ctx, connectionsArray, nodesArray /* nodesArray kept for now, though direct refs are primary */) {
        connectionsArray.forEach(conn => {
            const fromNode = conn.fromNode; // Use direct reference
            const toNode = conn.toNode;   // Use direct reference

            if (fromNode && toNode) {
                const fromNodeCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
                const toNodeCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

                const startPoint = getEdgeConnectionPoint(fromNode, toNodeCenter);
                const endPoint = getEdgeConnectionPoint(toNode, fromNodeCenter);

                // Bezier curve control point calculation (simplified for brevity, original logic assumed)
                const horizontalDistance = Math.abs(startPoint.x - endPoint.x);
                let offset = Math.max(horizontalDistance * 0.3, 50);

                let cp1 = { x: startPoint.x, y: startPoint.y };
                let cp2 = { x: endPoint.x, y: endPoint.y };

                if (startPoint.x < toNodeCenter.x - fromNode.width/2) cp1.x += offset;
                else if (startPoint.x > toNodeCenter.x + fromNode.width/2) cp1.x -= offset;
                else if (startPoint.y < toNodeCenter.y) cp1.y += offset;
                else cp1.y -= offset;

                if (endPoint.x < fromNodeCenter.x - toNode.width/2) cp2.x += offset;
                else if (endPoint.x > fromNodeCenter.x + toNode.width/2) cp2.x -= offset;
                else if (endPoint.y < fromNodeCenter.y) cp2.y += offset;
                else cp2.y -= offset;

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
            ctx.save(); // Save context for each node

            ctx.fillStyle = node.color || CANVAS_DEFAULTS.NODE_COLOR;
            ctx.strokeStyle = CANVAS_DEFAULTS.NODE_BORDER_COLOR;
            ctx.lineWidth = CANVAS_DEFAULTS.NODE_BORDER_WIDTH;

            // Draw shape
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
            } else { // Rectangle
                ctx.beginPath();
                ctx.rect(node.x, node.y, node.width, node.height);
                ctx.fill();
                ctx.stroke();
            }

            // Draw selection indicator
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
                } else { // Rectangle
                    ctx.beginPath();
                    ctx.rect(node.x, node.y, node.width, node.height);
                }
                ctx.stroke();
            }

            // Draw text
            const fontSize = node.fontSize || CANVAS_DEFAULTS.NODE_FONT_SIZE;
            const fontFamily = node.fontFamily || CANVAS_DEFAULTS.NODE_FONT_FAMILY;
            const fontWeight = node.isBold ? 'bold' : 'normal';
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            ctx.fillStyle = node.textColor || CANVAS_DEFAULTS.NODE_TEXT_COLOR;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.text, node.x + node.width / 2, node.y + node.height / 2);
            
            ctx.restore(); // Restore context after drawing each node
        });
    }

    function draw() {
        drawCanvasBase(ctx, canvas, panX, panY, zoom);

        ctx.save(); // For connection-specific styles (though defaults are mostly used now)
        drawConnections(ctx, connections, nodes);
        ctx.restore();

        drawNodes(ctx, nodes, isConnectingMode, firstSelectedNodeForConnectionId, currentlySelectedNodeId);

        ctx.restore(); // Matches the save in drawCanvasBase
    }

    window.addEventListener('keydown', (event) => {
        if ((event.key === 'Delete' || event.key === 'Backspace') && currentlySelectedNodeId !== null) {
            const nodeIdToRemove = currentlySelectedNodeId;
            nodes = nodes.filter(node => node.id !== nodeIdToRemove);
            // Remove connections associated with the deleted node
            connections = connections.filter(conn => conn.fromNodeId !== nodeIdToRemove && conn.toNodeId !== nodeIdToRemove);
            currentlySelectedNodeId = null;
            updateTextFormatControls(null); // Hide controls
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

        panX += (worldAfterZoom.x - worldBeforeZoom.x) * zoom;
        panY += (worldAfterZoom.y - worldBeforeZoom.y) * zoom;

        draw();
    });

    canvas.addEventListener('dblclick', (event) => {
        const worldMousePos = screenToWorld(event.offsetX, event.offsetY);
        const nodeToEdit = getNodeAt(worldMousePos.x, worldMousePos.y);

        if (nodeToEdit) {
            event.stopPropagation(); // Prevent new node creation

            if (isEditingText && textInput) {
                textInput.blur(); // Save previous before starting new
            }

            isEditingText = true;
            editingNode = nodeToEdit;

            textInput = document.createElement('textarea');
            textInput.value = editingNode.text;
            textInput.style.position = 'absolute'; // Position relative to viewport

            const canvasRect = canvas.getBoundingClientRect();
            const screenX = editingNode.x * zoom + panX + canvasRect.left;
            const screenY = editingNode.y * zoom + panY + canvasRect.top;
            const screenWidth = editingNode.width * zoom;
            const screenHeight = editingNode.height * zoom;

            textInput.style.left = `${screenX}px`;
            textInput.style.top = `${screenY}px`;
            textInput.style.width = `${screenWidth}px`;
            textInput.style.height = `${screenHeight}px`;
            textInput.style.fontSize = `${16 * zoom}px`; // Optional: scale font too
            textInput.style.border = '1px solid #777';
            textInput.style.outline = 'none';
            textInput.style.resize = 'none';
            textInput.style.fontFamily = editingNode.fontFamily || 'Arial';
            textInput.style.fontSize = `${editingNode.fontSize || 16}px`;
            textInput.style.color = editingNode.textColor || '#000000';
            textInput.style.fontWeight = editingNode.isBold ? 'bold' : 'normal';
            textInput.style.textAlign = 'center';
            textInput.style.padding = '0';
            textInput.style.boxSizing = 'border-box';
            document.body.appendChild(textInput);
            textInput.focus();
            textInput.select();

            textInput.addEventListener('blur', finishEditing);
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); // Prevent newline in textarea
                    finishEditing();
                }
                if (e.key === 'Escape') {
                    // Revert to original text before closing or just close
                    if (textInput && editingNode) textInput.value = editingNode.text; // Optional: revert on Esc
                    finishEditing();
                }
            });
        } else {
            // Existing logic for creating a new node
            const rect = canvas.getBoundingClientRect(); // already available via event.target.getBoundingClientRect()
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const worldCoords = screenToWorld(mouseX, mouseY); // already available
            const newNode = createNode(worldCoords.x, worldCoords.y);
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

        if (event.button === 0) { // Left mouse button
            if (!isConnectingMode) {
                const clickedNode = getNodeAt(worldMousePos.x, worldMousePos.y);
                if (clickedNode) {
                    selectedNodeForDragging = clickedNode;
                    isDraggingNode = true;
                    dragOffsetX = worldMousePos.x - selectedNodeForDragging.x;
                    dragOffsetY = worldMousePos.y - selectedNodeForDragging.y;
                    currentlySelectedNodeId = selectedNodeForDragging.id;
                    updateTextFormatControls(selectedNodeForDragging); // Show controls
                    event.stopPropagation(); // Prevent panning when clicking on a node
                    draw();
                } else {
                    // Clicked on empty canvas, deselect
                    currentlySelectedNodeId = null;
                    updateTextFormatControls(null); // Hide controls
                    draw();
                }
            } else { // isConnectingMode is true
                const clickedNode = getNodeAt(worldMousePos.x, worldMousePos.y);
                if (clickedNode) {
                    if (firstSelectedNodeForConnectionId === null) {
                        firstSelectedNodeForConnectionId = clickedNode.id;
                        currentlySelectedNodeId = null; // Ensure no node is selected for dragging/deletion actions
                    } else if (firstSelectedNodeForConnectionId !== clickedNode.id) {
                        // Check if connection already exists
                        const existingConnection = connections.find(c =>
                            (c.fromNodeId === firstSelectedNodeForConnectionId && c.toNodeId === clickedNode.id) ||
                            (c.fromNodeId === clickedNode.id && c.toNodeId === firstSelectedNodeForConnectionId)
                        );
                        if (!existingConnection) {
                            const fromNodeObject = nodes.find(node => node.id === firstSelectedNodeForConnectionId);
                            const toNodeObject = clickedNode; // This is the second node clicked

                            if (fromNodeObject && toNodeObject) {
                                connections.push({
                                    id: Date.now(),
                                    fromNodeId: firstSelectedNodeForConnectionId, // Keep ID for potential future use/filtering
                                    toNodeId: clickedNode.id,                   // Keep ID for potential future use/filtering
                                    fromNode: fromNodeObject,                   // Store direct reference
                                    toNode: toNodeObject                        // Store direct reference
                                });
                            } else {
                                console.error("Error: Could not find one or both nodes for connection.", 
                                              "From ID:", firstSelectedNodeForConnectionId, "To ID:", clickedNode.id);
                            }
                        }
                        firstSelectedNodeForConnectionId = null; // Reset for next connection
                        isConnectingMode = false; // Exit connection mode
                        if(connectButton) connectButton.textContent = 'Criar Conexão';
                    } else {
                        // Clicked the same node again, cancel first selection
                        firstSelectedNodeForConnectionId = null;
                    }
                    draw();
                }
            }
        } else if (event.button === 1) { // Middle mouse button for panning
            isPanning = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            canvas.style.cursor = 'grabbing'; // Change cursor to indicate panning
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
                finishEditing();
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
            canvas.style.cursor = 'grab'; // Change cursor back
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (isPanning) { // Stop panning if mouse leaves canvas
            isPanning = false;
            canvas.style.cursor = 'default'; // Or 'grab' if you prefer
        }
    });

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Initial resize and draw

    // Placeholder for future functionality
    console.log('Canvas do Mapa Mental Inicializado a partir de mindmap.js');

    const addNodeButton = document.getElementById('addNode');
    connectButton = document.getElementById('toggleConnectionMode'); // Assign to global

    addNodeButton.addEventListener('click', () => {
        const centerX = screenToWorld(canvas.width / 2, canvas.height / 2).x;
        const centerY = screenToWorld(canvas.width / 2, canvas.height / 2).y;
        const newNode = createNode(centerX, centerY, 'Novo Nó (Botão)');
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
                currentlySelectedNodeId = null; // Deselect any node for dragging
                firstSelectedNodeForConnectionId = null; // Reset first selection
            } else {
                connectButton.textContent = 'Criar Conexão';
                firstSelectedNodeForConnectionId = null; // Reset first selection
            }
            draw(); // To update visual feedback if any
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
                finishEditing(); // Finalize any ongoing text editing
            }
            // Create a temporary link element
            const link = document.createElement('a');
            // Set the download attribute and filename
            link.download = 'mapa-mental.png';
            // Convert the canvas content to a data URL (PNG format)
            link.href = canvas.toDataURL('image/png');
            // Append the link to the body (required for Firefox)
            document.body.appendChild(link);
            // Programmatically click the link to trigger the download
            link.click();
            // Remove the link from the body
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
    textColorInput.addEventListener('input', () => { // 'input' for live preview
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
    // Helper function to update textarea style if it's active
    function updateTextEditingStyle() {
        if (isEditingText && textInput && editingNode && editingNode.id === currentlySelectedNodeId) {
            textInput.style.fontSize = `${editingNode.fontSize || 16}px`;
            textInput.style.color = editingNode.textColor || '#000000';
            textInput.style.fontWeight = editingNode.isBold ? 'bold' : 'normal';
        }
    }

    // Theme Switcher Logic
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
        // Check based on the class on <html>, which is the source of truth for current display
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

    // Load saved theme on page load
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        // Default to light theme if no preference is saved
        applyTheme('light');
    }
});
