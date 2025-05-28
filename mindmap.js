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

    let nodes = [];
    let nextNodeId = 0;
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

    function createNode(x, y, text = 'Novo Nó', width = 150, height = 100, color = 'lightblue', shape = 'rectangle') {
        return {
            id: Date.now() + Math.random(), // Ensure unique ID
            x,
            y,
            width,
            height,
            text,
            color,
            shape,
            fontSize: 16,
            fontFamily: 'Arial',
            textColor: '#000000',
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

    function draw() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Save context and apply transformations
        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(zoom, zoom);

        // Draw connections
        ctx.save();
        connections.forEach(conn => {
            const fromNode = nodes.find(node => node.id === conn.fromNodeId);
            const toNode = nodes.find(node => node.id === conn.toNodeId);

            if (fromNode && toNode) {
                const fromNodeCenter = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
                const toNodeCenter = { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 };

                const startPoint = getEdgeConnectionPoint(fromNode, toNodeCenter);
                const endPoint = getEdgeConnectionPoint(toNode, fromNodeCenter);

                const dx = Math.abs(startPoint.x - endPoint.x);
                // const dy = Math.abs(startPoint.y - endPoint.y); // For potential vertical control

                // Horizontal offset for control points - adjust factor as needed
                let controlPointOffsetX = dx * 0.5;
                if (controlPointOffsetX < 50) controlPointOffsetX = 50; // Minimum offset
                // if (startPoint.x > endPoint.x) controlPointOffsetX *= -1; // If end is to the left - this logic is tricky, better to adjust based on relative position to center

                const cp1x = startPoint.x + controlPointOffsetX;
                const cp1y = startPoint.y;
                const cp2x = endPoint.x - controlPointOffsetX;
                const cp2y = endPoint.y;
                
                // A slightly more robust control point placement based on node relative positions
                // This helps to ensure curves flow "outwards" from the node.
                let cp1 = { x: startPoint.x, y: startPoint.y };
                let cp2 = { x: endPoint.x, y: endPoint.y };

                const horizontalDistance = Math.abs(startPoint.x - endPoint.x);
                const verticalDistance = Math.abs(startPoint.y - endPoint.y);
                let offset = Math.max(horizontalDistance * 0.3, verticalDistance * 0.3, 50); // Ensure minimum offset
                
                // Determine primary direction for control points
                if (startPoint.x < toNodeCenter.x - fromNode.width/2) cp1.x += offset; // fromNode is to the left of toNode
                else if (startPoint.x > toNodeCenter.x + fromNode.width/2) cp1.x -= offset; // fromNode is to the right
                else if (startPoint.y < toNodeCenter.y) cp1.y += offset; // fromNode is above
                else cp1.y -= offset; // fromNode is below

                if (endPoint.x < fromNodeCenter.x - toNode.width/2) cp2.x += offset; // toNode is to the left of fromNode
                else if (endPoint.x > fromNodeCenter.x + toNode.width/2) cp2.x -= offset; // toNode is to the right
                else if (endPoint.y < fromNodeCenter.y) cp2.y += offset; // toNode is above
                else cp2.y -= offset; // toNode is below


                ctx.beginPath();
                ctx.moveTo(startPoint.x, startPoint.y);
                ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPoint.x, endPoint.y);
                ctx.strokeStyle = conn.color || 'grey'; // Changed default to grey
                ctx.lineWidth = conn.lineWidth || 2;
                ctx.stroke();
            }
        });
        ctx.restore();

        // Draw all nodes
        nodes.forEach(node => {
            ctx.save(); // Save context for each node to handle individual styles/paths

            ctx.fillStyle = node.color || 'lightblue';
            ctx.strokeStyle = 'black'; // Default border color
            ctx.lineWidth = 1;       // Default border width

            if (node.shape === 'ellipse') {
                ctx.beginPath();
                ctx.ellipse(node.x + node.width / 2, node.y + node.height / 2, node.width / 2, node.height / 2, 0, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            } else if (node.shape === 'diamond') {
                ctx.beginPath();
                ctx.moveTo(node.x + node.width / 2, node.y); // Top-middle
                ctx.lineTo(node.x + node.width, node.y + node.height / 2); // Middle-right
                ctx.lineTo(node.x + node.width / 2, node.y + node.height); // Bottom-middle
                ctx.lineTo(node.x, node.y + node.height / 2); // Middle-left
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else { // Default to rectangle
                ctx.beginPath();
                ctx.rect(node.x, node.y, node.width, node.height);
                ctx.fill();
                ctx.stroke();
            }
            
            // Draw selection indicator (AFTER shape is drawn)
            if (isConnectingMode && node.id === firstSelectedNodeForConnectionId) {
                ctx.strokeStyle = 'green'; // Special border for first node in connection mode
                ctx.lineWidth = 3;
                // Re-draw the path of the shape for the selection border
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
            } else if (node.id === currentlySelectedNodeId) {
                ctx.strokeStyle = 'red'; // Standard selection border
                ctx.lineWidth = 3; // Make it thicker
                 // Re-draw the path of the shape for the selection border
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

            // Text drawing
            const fontSize = node.fontSize || 16;
            const fontFamily = node.fontFamily || 'Arial';
            const fontWeight = node.isBold ? 'bold' : 'normal';
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            ctx.fillStyle = node.textColor || '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.text, node.x + node.width / 2, node.y + node.height / 2);
            
            ctx.restore(); // Restore context after drawing each node
        });

        // Restore context
        ctx.restore();
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
                            connections.push({
                                id: Date.now(),
                                fromNodeId: firstSelectedNodeForConnectionId,
                                toNodeId: clickedNode.id
                            });
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

});
