// files.js - Logic for the Files Manager Page

let currentPath = []; // Breadcrumb path: array of {id, name}
let currentParentId = null;

async function initFilesPage() {
    console.log('Initializing Files Page');
    // Check for pending navigation from Dashboard
    if (window.pendingNavigate) {
        const { parentId, fileId } = window.pendingNavigate;
        window.pendingNavigate = null; // Clear it
        console.log('Handling pending navigation:', parentId, fileId);
        await loadFiles(parentId || null);

        // Highlight file after render
        setTimeout(() => {
            const card = document.querySelector(`.file-card[data-id="${fileId}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.transition = 'box-shadow 0.5s, transform 0.5s';
                card.style.boxShadow = '0 0 0 4px var(--primary-color)';
                card.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    card.style.boxShadow = '';
                    card.style.transform = '';
                }, 2000);
            }
        }, 100);
    } else {
        // Load initial file list (root)
        await loadFiles(null);
    }

    // Setup Event Listeners
    setupFileEventListeners();
    setupContextMenu();
    setupMoveModal();
    setupMetadataModal();
    setupShareModal();
    setupVideoModal();
    setupTransferPanel();
    setupTransferPanel();
    startTransferPolling();
    setupLockModals();
    // setupSearch(); // Moved to global app.js
}

// setupSearch removed - moved to search.js





// Search rendering functions removed - moved to search.js


let currentPage = 1;
const itemsPerPage = 100; // Match backend default

async function loadFiles(parentId, page = 1) {
    currentPage = page; // Update global state
    const fileGrid = document.getElementById('file-grid');
    const loadingState = document.getElementById('files-loading');
    const emptyState = document.getElementById('files-empty-state');
    const paginationContainer = document.getElementById('pagination-controls') || createPaginationContainer();

    // Reset View
    fileGrid.innerHTML = '';
    fileGrid.style.display = 'none';
    emptyState.style.display = 'none';
    loadingState.style.display = 'flex';
    paginationContainer.style.display = 'none';

    try {
        let url = parentId ? `/api/files?parentId=${parentId}` : '/api/files';
        // Append pagination params
        url += (url.includes('?') ? '&' : '?') + `page=${page}&limit=${itemsPerPage}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch files');
        const data = await response.json();

        // Handle new response structure
        let files = [];
        let pagination = null;
        if (Array.isArray(data)) {
            files = data;
        } else {
            files = data.files;
            pagination = data.pagination;
        }

        loadingState.style.display = 'none';

        if (files.length === 0 && page === 1) {
            emptyState.style.display = 'flex';
        } else {
            fileGrid.style.display = 'grid';
            renderFiles(files);

            if (pagination) {
                if (page > pagination.totalPages && pagination.totalPages > 0) {
                    loadFiles(parentId, pagination.totalPages);
                    return;
                }
                if (pagination.totalPages > 1) {
                    renderPagination(pagination);
                    paginationContainer.style.display = 'flex';
                }
            }
        }

        updateBreadcrumbs();
    } catch (error) {
        console.error('Error loading files:', error);
        loadingState.innerHTML = '<p class="error-text">Failed to load files</p>';
    }
}

function createPaginationContainer() {
    const container = document.createElement('div');
    container.id = 'pagination-controls';
    container.className = 'pagination-controls'; // You might need to add CSS for this
    container.style.display = 'none';
    container.style.justifyContent = 'center';
    container.style.gap = '10px';
    container.style.padding = '20px';
    container.style.width = '100%';

    // Insert after file grid
    const fileGrid = document.getElementById('file-grid');
    fileGrid.parentNode.insertBefore(container, fileGrid.nextSibling);
    return container;
}

function renderPagination(pagination) {
    const container = document.getElementById('pagination-controls');
    container.innerHTML = '';

    const { page, totalPages } = pagination;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Previous';
    prevBtn.className = 'btn btn-secondary'; // Assuming 'btn' classes exist
    prevBtn.disabled = page <= 1;
    prevBtn.onclick = () => loadFiles(currentParentId, page - 1);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.className = 'btn btn-secondary';
    nextBtn.disabled = page >= totalPages;
    nextBtn.onclick = () => loadFiles(currentParentId, page + 1);

    const info = document.createElement('span');
    info.textContent = `Page ${page} of ${totalPages}`;
    info.style.alignSelf = 'center';

    container.appendChild(prevBtn);
    container.appendChild(info);
    container.appendChild(nextBtn);
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
        if (file.is_locked) fileCard.dataset.locked = "true";

        // Add metadata for tooltip
        if (file.caption) fileCard.dataset.caption = file.caption;
        if (file.tags) {
            try {
                fileCard.dataset.tags = typeof file.tags === 'string' ? file.tags : JSON.stringify(file.tags);
            } catch (e) { console.error('Tag error', e); }
        }

        // Determine File Type
        const isImage = file.type === 'file' && /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(file.name);
        const isVideo = file.type === 'file' && /\.(mp4|webm|ogg|mkv)$/i.test(file.name);
        const isPdf = file.type === 'file' && file.name.toLowerCase().endsWith('.pdf');
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
            const imageUrl = file.is_locked ? '/assets/lock-placeholder.png' : `/api/files/download/${file.id}?token=${token}`;
            if (file.is_locked) {
                icon = `<svg xmlns="http://www.w3.org/2000/svg" class="file-icon" viewBox="0 0 24 24" fill="#888"><path d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3H5.25A2.25 2.25 0 003 12v7.5A2.25 2.25 0 005.25 21.75h13.5A2.25 2.25 0 0021 19.5V12a2.25 2.25 0 00-2.25-2.25h-1.5v-3A5.25 5.25 0 0012 1.5zM8.25 6.75a3.75 3.75 0 117.5 0v3h-7.5v-3z"/></svg>`;
            } else {
                icon = `<img src="${imageUrl}" alt="${file.name}" class="file-preview-img" loading="lazy" />`;
            }
        } else if (isVideo) {
            icon = `
            <svg xmlns="http://www.w3.org/2000/svg" class="file-icon video-icon" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z" />
            </svg>`;
        } else if (isPdf) {
            icon = `
            <svg xmlns="http://www.w3.org/2000/svg" class="file-icon pdf-icon" viewBox="0 0 24 24" fill="currentColor" style="color: #F40F02;">
                <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" />
                <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
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
            ${file.is_locked ? '<div class="lock-overlay"><i class="fas fa-lock"></i></div>' : ''}
        `;

        // If locked, single click prompts password (for view)
        // If not locked, normal behavior
        if (file.is_locked) {
            fileCard.classList.add('locked-file');
            fileCard.addEventListener('click', () => {
                promptUnlock(file.id, false, (token) => {
                    // Determine what to do after unlock
                    if (isImage) {
                        const fullUrl = `/api/files/download/${file.id}?token=${localStorage.getItem('token')}&unlockToken=${token}`;
                        window.open(fullUrl, '_blank');
                    } else if (isVideo) {
                        playVideo(file.id, file.name, token);
                    } else if (isPdf) {
                        window.open(`pdf-viewer.html?id=${file.id}&name=${encodeURIComponent(file.name)}&unlockToken=${token}`, '_blank');
                    } else if (isDocx) {
                        window.open(`/editor.html?id=${file.id}&unlockToken=${token}`, '_blank');
                    } else {
                        downloadFile(file.id, token);
                    }
                });
            });
        } else {
            if (file.type === 'folder') {
                fileCard.addEventListener('click', () => {
                    enterFolder(file.id, file.name);
                });
            }

            if (isImage) {
                fileCard.addEventListener('click', () => {
                    const token = localStorage.getItem('token');
                    window.open(`/api/files/download/${file.id}?token=${token}`, '_blank');
                });
            }

            if (isVideo) {
                fileCard.addEventListener('click', () => {
                    playVideo(file.id, file.name);
                });
            }

            if (isPdf) {
                fileCard.addEventListener('click', () => {
                    window.open(`pdf-viewer.html?id=${file.id}&name=${encodeURIComponent(file.name)}`, '_blank');
                });
            }

            if (isDocx) {
                fileCard.addEventListener('click', () => {
                    editFile(file.id);
                });
            }
        }

        if (!file.is_locked) {
            fileCard.setAttribute('draggable', true);
            fileCard.addEventListener('dragstart', handleDragStart);
        }

        fileCard.addEventListener('dragover', handleDragOver);
        fileCard.addEventListener('dragleave', handleDragLeave);
        fileCard.addEventListener('drop', handleDrop);

        // Tooltip Events
        fileCard.addEventListener('mouseenter', (e) => showTooltip(e, fileCard));
        fileCard.addEventListener('mouseleave', hideTooltip);
        fileCard.addEventListener('mousemove', moveTooltip);

        fileGrid.appendChild(fileCard);
    });
}

function enterFolder(id, name) {
    currentPath.push({ id, name });
    currentParentId = id;
    loadFiles(id, 1);
}

function navigateToBreadcrumb(index) {
    if (index === -1) {
        currentPath = [];
        currentParentId = null;
    } else {
        currentPath = currentPath.slice(0, index + 1);
        currentParentId = currentPath[currentPath.length - 1].id;
    }
    loadFiles(currentParentId, 1);
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
            loadFiles(currentParentId, currentPage);
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
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Show Transfer Panel immediately
    const panel = document.getElementById('transfer-panel');
    if (panel) {
        panel.style.display = 'flex';
        panel.classList.remove('collapsed');
    }

    // Process all files
    const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        if (currentParentId) {
            formData.append('parentId', currentParentId);
        }
        formData.append('file', file);

        try {
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (response.ok) {
                // Success for this file
                return { success: true, file: file.name };
            } else {
                console.error(`Failed to upload ${file.name}`);
                return { success: false, file: file.name };
            }
        } catch (e) {
            console.error(`Error uploading ${file.name}`, e);
            return { success: false, file: file.name };
        }
    });

    try {
        await Promise.all(uploadPromises);

        // Trigger generic poll to update UI
        fetchTransfers();

        // Clear input
        e.target.value = '';
    } catch (err) {
        console.error('Batch upload error', err);
        alert('Some uploads may have failed');
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
let contextMenuFileName = null;
let contextMenuIsLocked = false;

function setupContextMenu() {
    const fileGrid = document.getElementById('file-grid');
    const contextMenu = document.getElementById('context-menu');
    const deleteBtn = document.getElementById('ctx-delete');
    const downloadBtn = document.getElementById('ctx-download');
    const moveBtn = document.getElementById('ctx-move');
    const editBtn = document.getElementById('ctx-edit');
    const shareBtn = document.getElementById('ctx-share');
    const metadataBtn = document.getElementById('ctx-metadata');
    const lockBtn = document.getElementById('ctx-lock');
    const unlockBtn = document.getElementById('ctx-unlock');

    // Context Menu Trigger
    fileGrid.addEventListener('contextmenu', (e) => {
        const fileCard = e.target.closest('.file-card');
        if (fileCard) {
            e.preventDefault();
            const id = fileCard.dataset.id;
            const type = fileCard.dataset.type;
            const name = fileCard.dataset.name;
            const locked = fileCard.dataset.locked === "true";

            showContextMenu(e.pageX, e.pageY, id, type, name, locked);
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
            const executeDelete = async (token) => {
                if (confirm('Are you sure you want to delete this item?')) {
                    await deleteFile(contextMenuFileId, token);
                }
            };

            if (contextMenuIsLocked) {
                promptUnlock(contextMenuFileId, false, executeDelete);
            } else {
                executeDelete(null);
            }
        }
    };

    downloadBtn.onclick = () => {
        if (contextMenuFileId && contextMenuFileType !== 'folder') {
            const executeDownload = (token) => {
                downloadFile(contextMenuFileId, token);
            };
            if (contextMenuIsLocked) {
                promptUnlock(contextMenuFileId, false, executeDownload);
            } else {
                executeDownload(null);
            }
        }
    };

    if (moveBtn) {
        moveBtn.onclick = () => {
            if (contextMenuFileId) {
                const executeMove = (token) => {
                    openMoveModal(contextMenuFileId, token);
                    contextMenu.style.display = 'none';
                };

                if (contextMenuIsLocked) {
                    promptUnlock(contextMenuFileId, false, executeMove);
                } else {
                    executeMove(null);
                }
            }
        };
    }

    if (editBtn) {
        editBtn.onclick = () => {
            if (contextMenuFileId) {
                const executeEdit = (token) => {
                    editFile(contextMenuFileId, token);
                    contextMenu.style.display = 'none';
                };
                if (contextMenuIsLocked) {
                    promptUnlock(contextMenuFileId, false, executeEdit);
                } else {
                    executeEdit(null);
                }
            }
        };
    }

    if (shareBtn) {
        shareBtn.onclick = () => {
            if (contextMenuFileId) {
                const executeShare = (token) => {
                    openShareModal(contextMenuFileId, token);
                    contextMenu.style.display = 'none';
                };
                if (contextMenuIsLocked) {
                    promptUnlock(contextMenuFileId, false, executeShare);
                } else {
                    executeShare(null);
                }
            }
        };
    }

    if (metadataBtn) {
        metadataBtn.onclick = () => {
            if (contextMenuFileId) {
                const executeMeta = (token = null) => {
                    const fileCard = document.querySelector(`.file-card[data-id="${contextMenuFileId}"]`);
                    const caption = fileCard.dataset.caption || '';
                    let tags = [];
                    try {
                        tags = fileCard.dataset.tags ? JSON.parse(fileCard.dataset.tags) : [];
                        if (typeof tags === 'string') tags = JSON.parse(tags);
                    } catch (e) { tags = []; }

                    openMetadataModal(contextMenuFileId, contextMenuFileName, caption, tags, token);
                    contextMenu.style.display = 'none';
                };

                if (contextMenuIsLocked) {
                    promptUnlock(contextMenuFileId, false, executeMeta);
                } else {
                    executeMeta(null);
                }
            }
        };
    }

    if (lockBtn) {
        lockBtn.onclick = () => {
            if (contextMenuFileId) {
                openLockModal(contextMenuFileId);
                contextMenu.style.display = 'none';
            }
        };
    }

    if (unlockBtn) {
        unlockBtn.onclick = () => {
            if (contextMenuFileId) {
                promptUnlock(contextMenuFileId, true); // true = permanent unlock
                contextMenu.style.display = 'none';
            }
        };
    }
}


function showContextMenu(x, y, id, type, name, locked) {
    hideTooltip();
    const contextMenu = document.getElementById('context-menu');
    const downloadBtn = document.getElementById('ctx-download');
    const editBtn = document.getElementById('ctx-edit');
    const shareBtn = document.getElementById('ctx-share');
    const lockBtn = document.getElementById('ctx-lock');
    const unlockBtn = document.getElementById('ctx-unlock');

    contextMenuFileId = id;
    contextMenuFileType = type;
    contextMenuFileName = name;
    contextMenuIsLocked = locked;

    // Position Menu
    contextMenu.style.top = `${y}px`;
    contextMenu.style.left = `${x}px`;
    contextMenu.style.display = 'block';

    // Lock/Unlock Toggle
    if (locked) {
        if (lockBtn) lockBtn.style.display = 'none';
        if (unlockBtn) unlockBtn.style.display = 'flex';
    } else {
        if (lockBtn) lockBtn.style.display = 'flex';
        if (unlockBtn) unlockBtn.style.display = 'none';
    }

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

async function deleteFile(id, unlockToken = null) {
    try {
        let url = `/api/files/${id}`;
        if (unlockToken) url += `?unlockToken=${unlockToken}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            loadFiles(currentParentId, currentPage);
            if (window.updateUserData) window.updateUserData();
        } else {
            console.error('Delete failed');
            alert('Failed to delete item');
        }
    } catch (e) {
        console.error('Delete error:', e);
    }
}

function downloadFile(id, unlockToken = null) {
    const token = localStorage.getItem('token');
    let url = `/api/files/download/${id}`;

    // Append tokens
    const params = new URLSearchParams();
    params.append('token', token);
    if (unlockToken) params.append('unlockToken', unlockToken);

    url += `?${params.toString()}`;

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
            loadFiles(currentParentId, currentPage);
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
let fileToMoveToken = null;

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
            await moveFile(fileToMoveId, moveTargetId, fileToMoveToken);
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

function openMoveModal(id, unlockToken = null) {
    fileToMoveId = id;
    fileToMoveToken = unlockToken;
    moveTargetId = null;
    const confirmBtn = document.getElementById('btn-confirm-move');
    if (confirmBtn) confirmBtn.disabled = true;

    const searchInput = document.getElementById('move-search-input');
    if (searchInput) searchInput.value = '';

    renderMoveResults(''); // Show root initially

    const modal = document.getElementById('move-modal');
    if (modal) modal.style.display = 'block';
}

// --- Lock Modals & Logic ---

function setupLockModals() {
    // Lock Modal
    const lockModal = document.getElementById('lock-file-modal');
    const closeLockBtn = document.getElementById('close-lock-modal');
    const cancelLockBtn = document.getElementById('btn-cancel-lock');
    const confirmLockBtn = document.getElementById('btn-confirm-lock');

    // Unlock Modal (Prompt)
    const unlockModal = document.getElementById('unlock-file-modal');
    const closeUnlockBtn = document.getElementById('close-unlock-modal');
    const cancelUnlockBtn = document.getElementById('btn-cancel-unlock');
    const confirmUnlockBtn = document.getElementById('btn-confirm-unlock');

    // Close Handlers
    const closeLock = () => { if (lockModal) lockModal.style.display = 'none'; document.getElementById('lock-password-input').value = ''; };
    const closeUnlock = () => { if (unlockModal) unlockModal.style.display = 'none'; document.getElementById('unlock-password-input').value = ''; };

    if (closeLockBtn) closeLockBtn.onclick = closeLock;
    if (cancelLockBtn) cancelLockBtn.onclick = closeLock;

    if (closeUnlockBtn) closeUnlockBtn.onclick = closeUnlock;
    if (cancelUnlockBtn) cancelUnlockBtn.onclick = closeUnlock;

    window.addEventListener('click', (e) => {
        if (e.target === lockModal) closeLock();
        if (e.target === unlockModal) closeUnlock();
    });

    // Confirm Lock
    if (confirmLockBtn) {
        confirmLockBtn.onclick = async () => {
            const password = document.getElementById('lock-password-input').value;
            if (!password || password.length < 4) {
                alert('Password must be at least 4 characters');
                return;
            }
            await lockFile(window.lockTargetId, password);
            closeLock();
        };
    }

    // Confirm Unlock
    if (confirmUnlockBtn) {
        confirmUnlockBtn.onclick = async () => {
            const password = document.getElementById('unlock-password-input').value;
            if (!password) {
                alert('Please enter password');
                return;
            }

            if (window.unlockPermanent) {
                await unlockFilePermanent(window.unlockTargetId, password);
            } else {
                await verifyAndExecute(window.unlockTargetId, password);
            }
            closeUnlock();
        };
    }
}

function openLockModal(id) {
    window.lockTargetId = id;
    const modal = document.getElementById('lock-file-modal');
    if (modal) modal.style.display = 'block';
    const input = document.getElementById('lock-password-input');
    if (input) input.focus();
}

function promptUnlock(id, permanent = false, callback = null) {
    window.unlockTargetId = id;
    window.unlockPermanent = permanent;
    window.afterUnlockAction = callback;

    const modal = document.getElementById('unlock-file-modal');
    const title = document.getElementById('unlock-modal-title');
    const btn = document.getElementById('btn-confirm-unlock');

    if (title) title.innerText = permanent ? 'Unlock File (Remove Lock)' : 'Enter Password to Access';
    if (btn) btn.innerText = permanent ? 'Unlock' : 'Access';

    if (modal) modal.style.display = 'block';

    const input = document.getElementById('unlock-password-input');
    if (input) input.focus();
}

async function lockFile(id, password) {
    try {
        const response = await fetch(`/api/files/${id}/lock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ password })
        });
        const data = await response.json();
        if (response.ok) {
            alert('File locked successfully');
            loadFiles(currentParentId, currentPage);
        } else {
            alert(data.error || 'Failed to lock file');
        }
    } catch (e) {
        console.error(e);
        alert('Error locking file');
    }
}

async function unlockFilePermanent(id, password) {
    try {
        const response = await fetch(`/api/files/${id}/unlock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ password })
        });
        const data = await response.json();
        if (response.ok) {
            alert('File unlocked');
            loadFiles(currentParentId, currentPage);
        } else {
            alert(data.error || 'Failed to unlock file');
        }
    } catch (e) {
        console.error(e);
        alert('Error unlocking file');
    }
}

async function verifyAndExecute(id, password) {
    try {
        const response = await fetch(`/api/files/${id}/verify-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ password })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            const token = data.token;
            if (window.afterUnlockAction && typeof window.afterUnlockAction === 'function') {
                window.afterUnlockAction(token);
            }
        } else {
            alert('Incorrect password');
        }
    } catch (e) {
        console.error(e);
        alert('Error unlocking');
    }
}

function openWithToken(id, unlockToken) {
    // Construct URL
    // We also need the User Auth Token for the middleware (unless we bypass auth for unlocked? No, security).
    const authToken = localStorage.getItem('token');

    // We will use `?token=AUTH_TOKEN&unlockToken=UNLOCK_TOKEN`
    // Assuming I fix the backend to look for `unlockToken`.

    const url = `/api/files/download/${id}?token=${authToken}&unlockToken=${unlockToken}`;
    window.open(url, '_blank');
}


// Helper debounce
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function moveFile(fileId, targetParentId, unlockToken = null) {
    try {
        const body = { targetParentId: targetParentId };
        if (unlockToken) body.unlockToken = unlockToken;

        const response = await fetch(`/api/files/move/${fileId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            loadFiles(currentParentId, currentPage);
        } else {
            const err = await response.json();
            alert(err.error || 'Move failed');
        }
    } catch (error) {
        console.error('Move error:', error);
        alert('Failed to move file');
    }
}

async function renameFile(fileId, newName, unlockToken = null) {
    try {
        const body = { newName: newName };
        if (unlockToken) body.unlockToken = unlockToken;

        const response = await fetch(`/api/files/rename/${fileId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            loadFiles(currentParentId, currentPage);
        } else {
            const err = await response.json();
            alert(err.error || 'Rename failed');
        }
    } catch (e) {
        console.error('Rename error:', e);
        alert('Failed to rename item');
    }
}

// --- Share Modal & Logic ---

let shareFileId = null;
let shareFileToken = null;

function setupShareModal() {
    const modal = document.getElementById('share-modal');
    const closeBtn = document.getElementById('close-share-modal');
    const addShareBtn = document.getElementById('btn-add-share');
    const emailInput = document.getElementById('share-email-input');

    // Tabs
    const tabUser = document.querySelector('.tab-btn[data-tab="share-user"]');
    const tabLink = document.querySelector('.tab-btn[data-tab="share-link"]');
    const contentUser = document.getElementById('tab-share-user');
    const contentLink = document.getElementById('tab-share-link');

    // Link Elements
    const generateBtn = document.getElementById('btn-generate-link');
    const copyBtn = document.getElementById('btn-copy-link');
    const linkOutput = document.getElementById('share-link-output');
    const linkResult = document.getElementById('share-link-result');

    const closeModal = () => modal.style.display = 'none';

    if (closeBtn) closeBtn.onclick = closeModal;
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Tab Logic
    const switchTab = (tab) => {
        if (tab === 'share-user') {
            tabUser.classList.add('active');
            tabUser.style.borderBottom = '2px solid var(--primary-color)';
            tabUser.style.color = '#fff';
            tabLink.classList.remove('active');
            tabLink.style.borderBottom = 'none';
            tabLink.style.color = '#888';
            contentUser.style.display = 'block';
            contentLink.style.display = 'none';
        } else {
            tabLink.classList.add('active');
            tabLink.style.borderBottom = '2px solid var(--primary-color)';
            tabLink.style.color = '#fff';
            tabUser.classList.remove('active');
            tabUser.style.borderBottom = 'none';
            tabUser.style.color = '#888';
            contentLink.style.display = 'block';
            contentUser.style.display = 'none';
        }
    };

    if (tabUser) tabUser.onclick = () => switchTab('share-user');
    if (tabLink) tabLink.onclick = () => switchTab('share-link');

    // User Share Logic
    if (addShareBtn) {
        addShareBtn.onclick = async () => {
            const email = emailInput.value;
            if (!email) return;

            try {
                const body = { targetBy: 'email', value: email, permission: 'view' };
                if (shareFileToken) body.unlockToken = shareFileToken;

                const response = await fetch(`/api/files/${shareFileId}/share`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(body)
                });

                const data = await response.json();
                if (response.ok) {
                    emailInput.value = '';
                    loadSharedUsers(shareFileId, shareFileToken);
                } else {
                    alert(data.error || 'Share failed');
                }
            } catch (e) {
                console.error(e);
                alert('Share error');
            }
        };
    }

    // Generate Link Logic
    if (generateBtn) {
        generateBtn.onclick = async () => {
            const expiry = document.getElementById('share-link-expiry').value;
            const uses = document.getElementById('share-link-uses').value;

            try {
                const body = {
                    expiresIn: expiry === '0' ? null : parseInt(expiry),
                    maxUses: uses === '0' ? null : parseInt(uses)
                };

                const response = await fetch(`/api/files/${shareFileId}/share-link`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(body)
                });

                const data = await response.json();
                if (response.ok) {
                    const link = `${window.location.origin}/share.html?token=${data.token}`;
                    linkOutput.value = link;
                    linkResult.style.display = 'block';
                } else {
                    alert(data.error || 'Failed to generate link');
                }
            } catch (e) {
                console.error(e);
                alert('Error generating link');
            }
        };
    }

    if (copyBtn) {
        copyBtn.onclick = () => {
            linkOutput.select();
            document.execCommand('copy');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => copyBtn.textContent = originalText, 2000);
        };
    }
}

async function openShareModal(id, unlockToken = null) {
    shareFileId = id;
    shareFileToken = unlockToken;
    const modal = document.getElementById('share-modal');
    if (modal) {
        // Reset View
        const tabUser = document.querySelector('.tab-btn[data-tab="share-user"]');
        if (tabUser) tabUser.click(); // Switch to first tab
        document.getElementById('share-link-result').style.display = 'none';

        modal.style.display = 'block';
        loadSharedUsers(id, unlockToken);
    }
}

async function loadSharedUsers(fileId, unlockToken = null) {
    const list = document.getElementById('shared-users-list');
    list.innerHTML = '<p style="padding: 10px; color: #888;">Loading...</p>';

    try {
        let url = `/api/files/${fileId}/shared-users`;
        if (unlockToken) url += `?unlockToken=${unlockToken}`;

        const response = await fetch(url, {
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
    const videoModal = document.getElementById('video-modal');
    const videoPlayer = document.getElementById('video-player');
    const videoTitle = document.getElementById('video-title');

    videoTitle.textContent = fileName;
    videoModal.style.display = 'block';

    const token = localStorage.getItem('token');
    videoPlayer.src = `/api/files/download/${fileId}?token=${token}`;
    videoPlayer.play();
}


// --- PDF Viewer Logic ---
// logic moved to pdf-viewer.html

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
                        loadFiles(currentParentId, currentPage); // Refresh!
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

// --- Tooltip Logic ---

let tooltipEl = null;

function createTooltip() {
    if (tooltipEl) return;
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'file-tooltip';
    tooltipEl.className = 'file-tooltip';
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);
}

function showTooltip(e, card) {
    if (!tooltipEl) createTooltip();

    const name = card.dataset.name;
    const caption = card.dataset.caption;
    const tagsRaw = card.dataset.tags;

    // Only show if we have interesting info (caption or tags), or maybe always?
    if (!caption && !tagsRaw) return;

    let html = `<div class="tooltip-header">${name}</div>`;

    if (caption) {
        html += `<div class="tooltip-caption">${caption}</div>`;
    }

    if (tagsRaw) {
        try {
            const tags = JSON.parse(tagsRaw);
            if (Array.isArray(tags) && tags.length > 0) {
                html += `<div class="tooltip-tags">`;
                tags.forEach(tag => {
                    html += `<span class="tooltip-tag">${tag}</span>`;
                });
                html += `</div>`;
            }
        } catch (e) {
            console.error('Failed to parse tags for tooltip', e);
        }
    }

    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';

    // Position initial
    moveTooltip(e);
}

function hideTooltip() {
    if (tooltipEl) {
        tooltipEl.style.display = 'none';
    }
}

function moveTooltip(e) {
    if (!tooltipEl || tooltipEl.style.display === 'none') return;

    // Offset from cursor
    const offset = 15;
    const padding = 10; // Edge padding

    const tooltipRect = tooltipEl.getBoundingClientRect();
    const tooltipW = tooltipRect.width;
    const tooltipH = tooltipRect.height;

    // Viewport dimensions
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Default Position (Bottom-Right of cursor)
    // using clientX/Y because position is fixed
    let left = e.clientX + offset;
    let top = e.clientY + offset;

    // Horizontal Checks
    if (left + tooltipW > viewportW - padding) {
        // Try Left of cursor
        let tryLeft = e.clientX - tooltipW - offset;
        if (tryLeft < padding) {
            // If neither fits well, just pin to right edge or left edge? 
            // Pin to right edge
            left = viewportW - tooltipW - padding;
        } else {
            left = tryLeft;
        }
    }

    // Vertical Checks
    if (top + tooltipH > viewportH - padding) {
        // Try Top of cursor
        let tryTop = e.clientY - tooltipH - offset;
        if (tryTop < padding) {
            // If neither fits (e.g. tooltip is taller than cursor pos either way),
            // Pin to bottom or top.
            // Since we have max-height: 80vh, it should theoretically fit somewhere.
            // Let's bias towards keeping it fully visible.

            // Try formatting to fit best available space
            if (e.clientY > viewportH / 2) {
                // Cursor is in bottom half, force top (pinned to bottom margin) or just top of cursor
                top = Math.max(padding, tryTop);
            } else {
                // Cursor in top half, force bottom
                top = Math.min(viewportH - tooltipH - padding, top);
            }
        } else {
            top = tryTop;
        }
    }

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
}

// --- Metadata Modal & Logic ---

let metadataFileId = null;
let currentTags = [];

function setupMetadataModal() {
    const modal = document.getElementById('metadata-modal');
    const closeBtn = document.getElementById('close-metadata-modal');
    const cancelBtn = document.getElementById('btn-cancel-metadata');
    const saveBtn = document.getElementById('btn-save-metadata');
    const tagsInput = document.getElementById('meta-tags-input');

    const closeModal = () => modal.style.display = 'none';

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (tagsInput) {
        tagsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const tag = tagsInput.value.trim();
                if (tag && !currentTags.includes(tag)) {
                    currentTags.push(tag);
                    renderTags();
                    tagsInput.value = '';
                }
            }
        });
    }

    if (saveBtn) {
        saveBtn.onclick = async () => {
            const name = document.getElementById('meta-name').value;
            const caption = document.getElementById('meta-caption').value;
            await saveMetadata(metadataFileId, name, caption, currentTags);
            closeModal();
        };
    }
}

function openMetadataModal(id, name, caption, tags) {
    metadataFileId = id;
    currentTags = Array.isArray(tags) ? [...tags] : []; // copy

    document.getElementById('meta-name').value = name || '';
    document.getElementById('meta-caption').value = caption || '';
    renderTags();

    const modal = document.getElementById('metadata-modal');
    if (modal) modal.style.display = 'block';

    // Auto focus name? Or caption? Name is first.
    // document.getElementById('meta-name').focus();
}

function renderTags() {
    const list = document.getElementById('meta-tags-list');
    list.innerHTML = '';
    currentTags.forEach((tag, index) => {
        const chip = document.createElement('div');
        chip.style.cssText = 'background: #555; padding: 2px 8px; border-radius: 12px; display: flex; align-items: center; gap: 5px; font-size: 0.9em;';
        chip.innerHTML = `
            <span>${tag}</span>
            <span style="cursor: pointer; font-weight: bold; color: #ccc;" onclick="removeTag(${index})">&times;</span>
        `;
        list.appendChild(chip);
    });
}

// Make removeTag globally accessible
window.removeTag = function (index) {
    currentTags.splice(index, 1);
    renderTags();
};

async function saveMetadata(id, name, caption, tags) {
    try {
        const response = await fetch(`/api/files/metadata/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ name, caption, tags })
        });

        if (response.ok) {
            // Refresh files to update dataset and view
            loadFiles(currentParentId, currentPage);
        } else {
            const err = await response.json();
            alert(err.error || 'Failed to save metadata');
        }
    } catch (e) {
        console.error(e);
        alert('Error saving metadata');
    }
}

// --- Trash Page Logic ---

async function initTrashPage() {
    console.log('Initializing Trash Page');
    await loadTrashedFiles();
    setupTrashContextMenu();

    const emptyBtn = document.getElementById('btn-empty-trash');
    if (emptyBtn) {
        emptyBtn.style.display = 'none';
        // Optional: Manual empty trash trigger could go here
    }
}

async function loadTrashedFiles() {
    const fileGrid = document.getElementById('trash-grid');
    const loadingState = document.getElementById('trash-loading');
    const emptyState = document.getElementById('trash-empty-state');

    // Safety check if elements exist (in case page load failed partially)
    if (!fileGrid) return;

    fileGrid.innerHTML = '';
    fileGrid.style.display = 'none';
    emptyState.style.display = 'none';
    loadingState.style.display = 'flex';

    try {
        const response = await fetch('/api/files/trash', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch trash');
        const files = await response.json();

        loadingState.style.display = 'none';

        if (files.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            fileGrid.style.display = 'grid';
            renderTrashFiles(files);
        }
    } catch (error) {
        console.error('Error loading trash:', error);
        loadingState.innerHTML = '<p class="error-text">Failed to load trash</p>';
    }
}

function renderTrashFiles(files) {
    const fileGrid = document.getElementById('trash-grid');
    fileGrid.innerHTML = '';

    files.forEach(file => {
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        fileCard.dataset.id = file.id;
        fileCard.dataset.name = file.name;

        // Use same icon logic roughly
        let icon = '';
        if (file.type === 'folder') {
            icon = `
            <svg xmlns="http://www.w3.org/2000/svg" class="file-icon folder-icon" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.7">
                <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
            </svg>`;
        } else {
            icon = `
            <svg xmlns="http://www.w3.org/2000/svg" class="file-icon doc-icon" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.7">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>`;
        }

        fileCard.innerHTML = `
            <div class="file-icon-wrapper">${icon}</div>
            <div class="file-info">
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-meta">Deleted ${new Date(file.trashed_at).toLocaleDateString()}</div>
            </div>
        `;

        // Context menu event
        fileCard.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showTrashContextMenu(e.pageX, e.pageY, file.id);
        });

        fileGrid.appendChild(fileCard);
    });
}

let trashContextId = null;

function setupTrashContextMenu() {
    const contextMenu = document.getElementById('trash-context-menu');
    const restoreBtn = document.getElementById('ctx-restore');
    const deleteForeverBtn = document.getElementById('ctx-delete-forever');

    // Global click listener to close is already in setupContextMenu but for the MAIN context menu.
    // We need one for this one too.
    document.addEventListener('click', () => {
        if (contextMenu && contextMenu.style.display === 'block') contextMenu.style.display = 'none';
    });

    if (restoreBtn) {
        restoreBtn.onclick = async () => {
            if (trashContextId) await restoreFile(trashContextId);
        };
    }

    if (deleteForeverBtn) {
        deleteForeverBtn.onclick = async () => {
            if (trashContextId) {
                if (confirm('Delete forever? This cannot be undone.')) {
                    await permanentDeleteFile(trashContextId);
                }
            }
        };
    }
}

function showTrashContextMenu(x, y, id) {
    const contextMenu = document.getElementById('trash-context-menu');
    if (!contextMenu) return;

    trashContextId = id;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.left = `${x}px`;
    contextMenu.style.display = 'block';
}

async function restoreFile(id) {
    try {
        const response = await fetch(`/api/files/restore/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            loadTrashedFiles();
        } else {
            alert('Failed to restore');
        }
    } catch (e) { console.error(e); }
}

async function permanentDeleteFile(id) {
    try {
        const response = await fetch(`/api/files/permanent/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            loadTrashedFiles();
            if (window.updateUserData) window.updateUserData();
        } else {
            alert('Failed to delete');
        }
    } catch (e) { console.error(e); }
}
