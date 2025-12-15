// files.js - Logic for the Files Manager Page

let currentPath = []; // Breadcrumb path: array of {id, name}
let currentParentId = null;

async function initFilesPage() {
    console.log('Initializing Files Page');
    // Load initial file list (root)
    await loadFiles(null);

    // Setup Event Listeners
    setupFileEventListeners();
    setupContextMenu();
    setupMoveModal();
    setupShareModal();
    setupVideoModal();
    setupTransferPanel();
    startTransferPolling();
    // setupSearch(); // Moved to global app.js
}

// setupSearch removed - moved to search.js





// Search rendering functions removed - moved to search.js


async function loadFiles(parentId) {
    const fileGrid = document.getElementById('file-grid');
    const loadingState = document.getElementById('files-loading');
    const emptyState = document.getElementById('files-empty-state');

    // Reset View
    fileGrid.innerHTML = '';
    fileGrid.style.display = 'none';
    emptyState.style.display = 'none';
    loadingState.style.display = 'flex';

    try {
        const url = parentId ? `/api/files?parentId=${parentId}` : '/api/files';
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch files');
        const files = await response.json();

        loadingState.style.display = 'none';

        if (files.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            fileGrid.style.display = 'grid';
            renderFiles(files);
        }

        updateBreadcrumbs();
    } catch (error) {
        console.error('Error loading files:', error);
        loadingState.innerHTML = '<p class="error-text">Failed to load files</p>';
    }
}

function renderFiles(files) {
    const fileGrid = document.getElementById('file-grid');
    fileGrid.innerHTML = '';

    files.forEach(file => {
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        fileCard.dataset.id = file.id;
        fileCard.dataset.type = file.type;
        fileCard.dataset.name = file.name;

        // Determine File Type
        const isImage = file.type === 'file' && /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
        const isVideo = file.type === 'file' && /\.(mp4|webm|ogg|mkv)$/i.test(file.name);
        const isDocx = file.type === 'file' && file.name.toLowerCase().endsWith('.docx');

        // Define Icon
        let icon = '';
        if (file.type === 'folder') {
            icon = `
            <svg xmlns="http://www.w3.org/2000/svg" class="file-icon folder-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
            </svg>`;
        } else if (isImage) {
            const token = localStorage.getItem('token');
            const imageUrl = `/api/files/download/${file.id}?token=${token}`;
            icon = `<img src="${imageUrl}" alt="${file.name}" class="file-preview-img" loading="lazy" />`;
        } else if (isVideo) {
            icon = `
            <svg xmlns="http://www.w3.org/2000/svg" class="file-icon video-icon" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z" />
            </svg>`;
        } else {
            icon = `
            <svg xmlns="http://www.w3.org/2000/svg" class="file-icon doc-icon" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM12.75 12a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V18a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V12Z" clip-rule="evenodd" />
                <path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z" />
            </svg>`;
        }

        fileCard.innerHTML = `
            <div class="file-icon-wrapper">${icon}</div>
            <div class="file-info">
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-meta">${file.type === 'folder' ? 'Folder' : formatBytes(file.size)}</div>
            </div>
        `;

        // Folder Navigation
        if (file.type === 'folder') {
            fileCard.addEventListener('dblclick', () => {
                enterFolder(file.id, file.name);
            });
        }

        // Image Preview
        if (isImage) {
            fileCard.addEventListener('dblclick', () => {
                const token = localStorage.getItem('token');
                window.open(`/api/files/download/${file.id}?token=${token}`, '_blank');
            });
        }

        // Video Preview
        if (isVideo) {
            fileCard.addEventListener('dblclick', () => {
                playVideo(file.id, file.name);
            });
        }

        // Word Editor
        if (isDocx) {
            fileCard.addEventListener('dblclick', () => {
                editFile(file.id);
            });
        }

        // Drag and Drop Support
        fileCard.setAttribute('draggable', true);
        fileCard.addEventListener('dragstart', handleDragStart);
        fileCard.addEventListener('dragover', handleDragOver);
        fileCard.addEventListener('dragleave', handleDragLeave);
        fileCard.addEventListener('drop', handleDrop);

        fileGrid.appendChild(fileCard);
    });
}

function enterFolder(id, name) {
    currentPath.push({ id, name });
    currentParentId = id;
    loadFiles(id);
}

function navigateToBreadcrumb(index) {
    if (index === -1) {
        currentPath = [];
        currentParentId = null;
    } else {
        currentPath = currentPath.slice(0, index + 1);
        currentParentId = currentPath[currentPath.length - 1].id;
    }
    loadFiles(currentParentId);
}

function updateBreadcrumbs() {
    const breadcrumbs = document.getElementById('breadcrumbs');
    breadcrumbs.innerHTML = '';

    // Root
    const rootItem = document.createElement('span');
    rootItem.className = 'breadcrumb-item';
    rootItem.textContent = 'My Files';
    rootItem.onclick = () => navigateToBreadcrumb(-1);
    // DnD for Root
    rootItem.ondragover = handleBreadcrumbDragOver;
    rootItem.ondragleave = handleBreadcrumbDragLeave;
    rootItem.ondrop = (e) => handleBreadcrumbDrop(e, 'root');
    breadcrumbs.appendChild(rootItem);

    currentPath.forEach((item, index) => {
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = '/';
        breadcrumbs.appendChild(separator);

        const link = document.createElement('span');
        link.className = 'breadcrumb-item';
        link.textContent = item.name;
        if (index !== currentPath.length - 1) {
            link.onclick = () => navigateToBreadcrumb(index);
            // DnD for Items
            link.ondragover = handleBreadcrumbDragOver;
            link.ondragleave = handleBreadcrumbDragLeave;
            link.ondrop = (e) => handleBreadcrumbDrop(e, item.id);
        } else {
            link.classList.add('active');
        }
        breadcrumbs.appendChild(link);
    });
}

function setupFileEventListeners() {
    const newFolderBtn = document.getElementById('btn-new-folder');
    const uploadBtn = document.getElementById('btn-upload-file');
    const fileInput = document.getElementById('file-input-hidden');

    if (newFolderBtn) {
        newFolderBtn.onclick = createNewFolder;
    }

    if (uploadBtn) {
        uploadBtn.onclick = () => fileInput.click();
    }

    if (fileInput) {
        fileInput.onchange = handleFileUpload;
    }
}

async function createNewFolder() {
    const name = prompt("Enter folder name:");
    if (!name) return;

    try {
        const response = await fetch('/api/files/folder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                name: name,
                parentId: currentParentId
            })
        });

        if (response.ok) {
            loadFiles(currentParentId);
        } else {
            const err = await response.json();
            alert(err.error || 'Failed to create folder');
        }
    } catch (e) {
        console.error(e);
        alert('Error creating folder');
    }
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    if (currentParentId) {
        formData.append('parentId', currentParentId);
    }
    formData.append('file', file);

    // Show uploading... (could optimize this UX)

    try {
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            // console.log('Upload response:', data);

            // Open Transfer Panel if it's the first time
            const panel = document.getElementById('transfer-panel');
            if (panel) {
                panel.style.display = 'flex';
                panel.classList.remove('collapsed');
            }

            // Trigger an immediate poll
            fetchTransfers();

            // Don't reload files immediately as it is async now. 
            // The polling (or user) will refresh when complete.
        } else {
            alert('Upload failed');
        }
    } catch (e) {
        console.error(e);
        alert('Error uploading file');
    } finally {
        e.target.value = ''; // Reset input
    }
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

let contextMenuFileId = null;
let contextMenuFileType = null;

function setupContextMenu() {
    const fileGrid = document.getElementById('file-grid');
    const contextMenu = document.getElementById('context-menu');
    const deleteBtn = document.getElementById('ctx-delete');
    const downloadBtn = document.getElementById('ctx-download');
    const moveBtn = document.getElementById('ctx-move');
    const editBtn = document.getElementById('ctx-edit');
    const shareBtn = document.getElementById('ctx-share');

    // Context Menu Trigger
    fileGrid.addEventListener('contextmenu', (e) => {
        const fileCard = e.target.closest('.file-card');
        if (fileCard) {
            e.preventDefault();
            const id = fileCard.dataset.id;
            const type = fileCard.dataset.type;
            const name = fileCard.dataset.name;

            showContextMenu(e.pageX, e.pageY, id, type, name);
        }
    });

    // Close Menu on Click Outside
    document.addEventListener('click', (e) => {
        if (contextMenu.style.display === 'block') {
            contextMenu.style.display = 'none';
        }
    });

    // Action Handlers
    deleteBtn.onclick = async () => {
        if (contextMenuFileId) {
            if (confirm('Are you sure you want to delete this item?')) {
                await deleteFile(contextMenuFileId);
            }
        }
    };

    downloadBtn.onclick = () => {
        if (contextMenuFileId && contextMenuFileType !== 'folder') {
            downloadFile(contextMenuFileId);
        }
    };

    if (moveBtn) {
        moveBtn.onclick = () => {
            if (contextMenuFileId) {
                openMoveModal(contextMenuFileId);
                contextMenu.style.display = 'none';
            }
        };
    }

    if (editBtn) {
        editBtn.onclick = () => {
            if (contextMenuFileId) {
                editFile(contextMenuFileId);
                contextMenu.style.display = 'none';
            }
        };
    }

    if (shareBtn) {
        shareBtn.onclick = () => {
            if (contextMenuFileId) {
                openShareModal(contextMenuFileId);
                contextMenu.style.display = 'none';
            }
        };
    }
}

function showContextMenu(x, y, id, type, name) {
    const contextMenu = document.getElementById('context-menu');
    const downloadBtn = document.getElementById('ctx-download');
    const editBtn = document.getElementById('ctx-edit');
    const shareBtn = document.getElementById('ctx-share');

    contextMenuFileId = id;
    contextMenuFileType = type;

    // Position Menu
    contextMenu.style.top = `${y}px`;
    contextMenu.style.left = `${x}px`;
    contextMenu.style.display = 'block';

    // Toggle Download for folders
    if (type === 'folder') {
        downloadBtn.style.display = 'none';
        if (editBtn) editBtn.style.display = 'none';
    } else {
        downloadBtn.style.display = 'flex';
        // Show edit if .docx
        if (editBtn) {
            if (name.toLowerCase().endsWith('.docx')) {
                editBtn.style.display = 'flex';
            } else {
                editBtn.style.display = 'none';
            }
        }
    }
}

async function deleteFile(id) {
    try {
        const response = await fetch(`/api/files/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            loadFiles(currentParentId);
            if (window.updateUserData) window.updateUserData();
        } else {
            console.error('Delete failed');
            alert('Failed to delete item');
        }
    } catch (e) {
        console.error('Delete error:', e);
    }
}

function downloadFile(id) {
    // Trigger download via window.location (or create anchor)
    // Using fetch blob if auth header is strictly required, BUT standard browser download is easier 
    // if we pass token in query param or rely on cookie. 
    // Since we use Bearer header, we need to fetch blob and save it.

    const token = localStorage.getItem('token');

    fetch(`/api/files/download/${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (!response.ok) throw new Error('Download failed');
            return response.blob().then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                // Content-Disposition usually handles filename, but if we have it in DOM we can use it.
                // For now, let the browser infer or we need to extract filename from response headers.
                // Simplified: we rely on browser detection or response header.

                // To be precise, let's try to get filename from header
                const disposition = response.headers.get('Content-Disposition');
                let filename = 'download';
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }

                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
            });
        })
        .catch(err => {
            console.error(err);
            alert('Failed to download file');
        });
}


// Drag and Drop Handlers
let draggedFileId = null;

function handleDragStart(e) {
    draggedFileId = this.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedFileId);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (this.dataset.type === 'folder' && this.dataset.id !== draggedFileId) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    // Safety check
    if (!draggedFileId) return;

    const targetId = this.dataset.id;
    const targetType = this.dataset.type;

    if (targetType !== 'folder') return;
    if (draggedFileId === targetId) return;

    // Call Backend
    try {
        const response = await fetch(`/api/files/move/${draggedFileId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ targetParentId: targetId })
        });

        if (response.ok) {
            // Refresh
            loadFiles(currentParentId);
        } else {
            const err = await response.json();
            alert(err.error || 'Move failed');
        }
    } catch (error) {
        console.error('Move error:', error);
        alert('Failed to move file');
    } finally {
        draggedFileId = null;
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    }
}

// --- Move Modal & Logic ---

let moveTargetId = null;
let fileToMoveId = null;

function setupMoveModal() {
    const modal = document.getElementById('move-modal');
    const closeBtn = document.getElementById('close-move-modal');
    const cancelBtn = document.getElementById('btn-cancel-move');
    const confirmBtn = document.getElementById('btn-confirm-move');
    const searchInput = document.getElementById('move-search-input');

    const closeModal = () => {
        modal.style.display = 'none';
        searchInput.value = '';
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (searchInput) {
        searchInput.oninput = debounce(async (e) => {
            const query = e.target.value;
            await renderMoveResults(query);
        }, 300);
    }

    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            if (!moveTargetId || !fileToMoveId) return;
            await moveFile(fileToMoveId, moveTargetId);
            closeModal();
        };
    }
}

async function renderMoveResults(query) {
    const resultsContainer = document.getElementById('move-results');
    resultsContainer.innerHTML = '';

    // Always show Root
    const rootItem = createMoveResultItem('root', '/ (Root)', '');
    resultsContainer.appendChild(rootItem);

    // If query is empty, maybe show nothing else or show recent? For now just root.
    if (!query) return;

    try {
        const response = await fetch(`/api/files/search?query=${query}&type=folder`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const folders = await response.json();

        folders.forEach(folder => {
            if (folder.id == fileToMoveId) return; // Cannot move into itself
            resultsContainer.appendChild(createMoveResultItem(folder.id, folder.name, folder.path));
        });
    } catch (e) {
        console.error(e);
    }
}

function createMoveResultItem(id, name, path) {
    const div = document.createElement('div');
    div.className = 'move-result-item';
    div.style.padding = '8px';
    div.style.cursor = 'pointer';
    div.style.borderBottom = '1px solid #333';
    div.innerHTML = `<span>${name}</span> <small style="color: #888; font-size: 0.8em; margin-left: 10px;">${id === 'root' ? '' : path}</small>`;

    div.onclick = () => {
        document.querySelectorAll('.move-result-item').forEach(el => el.style.backgroundColor = 'transparent');
        div.style.backgroundColor = 'var(--primary-color, #007bff)'; // Selection highlight, using var or fallback
        moveTargetId = id;
        document.getElementById('btn-confirm-move').disabled = false;
    };
    return div;
}

function openMoveModal(id) {
    fileToMoveId = id;
    moveTargetId = null;
    const confirmBtn = document.getElementById('btn-confirm-move');
    if (confirmBtn) confirmBtn.disabled = true;

    const searchInput = document.getElementById('move-search-input');
    if (searchInput) searchInput.value = '';

    renderMoveResults(''); // Show root initially

    const modal = document.getElementById('move-modal');
    if (modal) modal.style.display = 'block';
}

// Helper debounce
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function moveFile(fileId, targetParentId) {
    try {
        const response = await fetch(`/api/files/move/${fileId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ targetParentId: targetParentId })
        });

        if (response.ok) {
            loadFiles(currentParentId); // Refresh view
            // If moved to breadcrumb, current view might be fine, or item disappears.
        } else {
            const err = await response.json();
            alert(err.error || 'Move failed');
        }
    } catch (error) {
        console.error('Move error:', error);
        alert('Failed to move file');
    }
}

// --- Share Modal & Logic ---

let shareFileId = null;

function setupShareModal() {
    const modal = document.getElementById('share-modal');
    const closeBtn = document.getElementById('close-share-modal');
    const addShareBtn = document.getElementById('btn-add-share');
    const emailInput = document.getElementById('share-email-input');

    const closeModal = () => modal.style.display = 'none';

    if (closeBtn) closeBtn.onclick = closeModal;
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (addShareBtn) {
        addShareBtn.onclick = async () => {
            const email = emailInput.value;
            if (!email) return;

            try {
                const response = await fetch(`/api/files/${shareFileId}/share`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ targetBy: 'email', value: email, permission: 'view' })
                });

                const data = await response.json();
                if (response.ok) {
                    emailInput.value = '';
                    loadSharedUsers(shareFileId);
                } else {
                    alert(data.error || 'Share failed');
                }
            } catch (e) {
                console.error(e);
                alert('Share error');
            }
        };
    }
}

async function openShareModal(id) {
    shareFileId = id;
    const modal = document.getElementById('share-modal');
    if (modal) {
        modal.style.display = 'block';
        loadSharedUsers(id);
    }
}

async function loadSharedUsers(fileId) {
    const list = document.getElementById('shared-users-list');
    list.innerHTML = '<p style="padding: 10px; color: #888;">Loading...</p>';

    try {
        const response = await fetch(`/api/files/${fileId}/shared-users`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const users = await response.json();

        list.innerHTML = '';
        if (users.length === 0) {
            list.innerHTML = '<p style="padding: 10px; color: #888;">No users yet</p>';
        } else {
            users.forEach(user => {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.justifyContent = 'space-between';
                div.style.alignItems = 'center';
                div.style.padding = '8px';
                div.style.borderBottom = '1px solid #333';

                div.innerHTML = `
                    <div>
                        <div style="font-weight: bold;">${user.username}</div>
                        <small style="color: #666;">${user.email}</small>
                    </div>
                    <button class="btn-text" style="color: #ff4d4d; font-size: 0.9em;" onclick="unshareFile('${fileId}', '${user.id}')">Remove</button>
                `;
                list.appendChild(div);
            });
        }
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p style="padding: 10px; color: red;">Failed to load data</p>';
    }
}

window.unshareFile = async (fileId, userId) => {
    if (!confirm('Revoke access for this user?')) return;

    try {
        const response = await fetch(`/api/files/${fileId}/unshare`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ targetUserId: userId })
        });

        if (response.ok) {
            loadSharedUsers(fileId);
        } else {
            alert('Failed to revoke access');
        }
    } catch (e) {
        console.error(e);
    }
};

// Breadcrumb DnD Handlers
function handleBreadcrumbDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.style.color = 'var(--accent-color, #4facfe)';
    e.currentTarget.style.fontWeight = 'bold';
}

function handleBreadcrumbDragLeave(e) {
    e.currentTarget.style.color = '';
    e.currentTarget.style.fontWeight = '';
}

async function handleBreadcrumbDrop(e, targetId) {
    e.preventDefault();
    e.currentTarget.style.color = '';
    e.currentTarget.style.fontWeight = '';

    const fileId = e.dataTransfer.getData('text/plain');
    if (!fileId) return;

    // Check if moving to same folder or current folder
    if (targetId === 'root') {
        if (!currentParentId) return; // Already in root
    } else {
        if (targetId == currentParentId) return; // Already in this folder
    }


    await moveFile(fileId, targetId);
}

// --- Video Player Logic ---

function setupVideoModal() {
    const modal = document.getElementById('video-modal');
    const closeBtn = document.getElementById('close-video-modal');
    const player = document.getElementById('video-player');

    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            player.pause();
            player.src = "";
        };

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                player.pause();
                player.src = "";
            }
        });
    }
}

function playVideo(fileId, fileName) {
    const modal = document.getElementById('video-modal');
    const title = document.getElementById('video-title');
    const player = document.getElementById('video-player');

    if (modal && player) {
        title.textContent = "Playing: " + fileName;
        player.src = `/api/files/stream/${fileId}?token=${localStorage.getItem('token')}`;
        modal.style.display = 'block';
        player.play().catch(e => console.log('Auto-play prevented', e));
    }
}

// --- Transfer Queue Logic ---

let transferPollInterval = null;
const processingTransfers = new Set();

function setupTransferPanel() {
    const toggle = document.getElementById('transfer-toggle');
    const panel = document.getElementById('transfer-panel');
    if (toggle && panel) {
        toggle.onclick = () => {
            panel.classList.toggle('collapsed');
        };
    }
}

function startTransferPolling() {
    if (transferPollInterval) clearInterval(transferPollInterval);
    fetchTransfers();
    transferPollInterval = setInterval(fetchTransfers, 2000);
}

async function fetchTransfers() {
    try {
        const res = await fetch('/api/transfers', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
            const transfers = await res.json();
            renderTransfers(transfers);
        }
    } catch (e) { console.error('Transfer poll error', e); }
}

function renderTransfers(transfers) {
    const list = document.getElementById('transfer-list');
    const countBadge = document.getElementById('transfer-count');
    const panel = document.getElementById('transfer-panel');

    if (!list) return;

    // Check if we need to show panel (if hidden and new items appear)
    if (transfers.length > 0 && panel.style.display === 'none') {
        panel.style.display = 'flex';
    }

    const activeTransfers = transfers.filter(t => t.status === 'pending' || t.status === 'processing');
    const activeCount = activeTransfers.length;
    countBadge.textContent = activeCount;

    // Check for completions to trigger refresh
    const completedNow = transfers.filter(t => t.status === 'completed');

    // Simple logic: If we have recent completions and we haven't refreshed for them yet?
    // Better: Keep track of "known completed" or just check if any "processing" became "completed".
    // Since we poll every 2s, we can check if we have any *new* completions in this batch vs previous not easily storeable without state.
    // Simpler: Just refresh if we see a completed item that is young? No.
    // Let's use a state Set of known active IDs.

    transfers.forEach(t => {
        if (t.status === 'completed') {
            // If this was active before (or we just want to be aggressive), refresh. 
            // To avoid infinite loops, we can check if it was updated very recently?
            // Or better: Let's track `processingTransfers` in a global Set.
            if (processingTransfers.has(t.id)) {
                processingTransfers.delete(t.id);
                // It just finished!
                if (t.type === 'upload') {
                    // Check if it belongs to current folder? 
                    // t.metadata.parentId vs currentParentId.
                    // Note: parentId might be null (root) or string.
                    const targetParentId = (t.metadata && t.metadata.parentId) ? t.metadata.parentId : null;

                    // Loose equality for null/undefined mismatch
                    if (targetParentId == currentParentId) {
                        loadFiles(currentParentId); // Refresh!
                    }
                    if (window.updateUserData) window.updateUserData();
                }
            }
        } else if (t.status === 'processing' || t.status === 'pending') {
            processingTransfers.add(t.id);
        }
    });

    // Render (only Active/Failed to keep list clean)
    list.innerHTML = '';

    // Filter out completed for display
    const visibleTransfers = transfers.filter(t => t.status !== 'completed');

    visibleTransfers.forEach(t => {
        const item = document.createElement('div');
        item.className = `transfer-item item-${t.status}`;

        const name = (t.metadata && t.metadata.originalname) ? t.metadata.originalname : 'File';

        item.innerHTML = `
            <div class="transfer-info">
                <span class="transfer-name" title="${name}">${name}</span>
                <span class="transfer-status status-${t.status}">${t.status}</span>
            </div>
            <div class="transfer-progress">
                <div class="progress-bar"></div>
            </div>
        `;
        list.appendChild(item);
    });

    // Hide panel if empty
    if (visibleTransfers.length === 0) {
        panel.style.display = 'none';
        panel.classList.add('collapsed'); // Reset state
    }
}

function editFile(id) {
    // Open editor in a new tab/window
    window.open(`/editor.html?id=${id}`, '_blank');
}
