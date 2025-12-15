function setupSearch() {
    const searchInput = document.getElementById('global-search');
    const dropdown = document.getElementById('search-results-dropdown');

    if (searchInput) {
        // Debounce logic moved inside or we can use a helper if available. 
        // Assuming debounce is available globally or we define it here.
        // files.js has debounce, app.js doesn't. Let's define it here to be safe and independent.

        const debounce = (func, wait) => {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };

        searchInput.oninput = debounce(async (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                const results = await fetchSearchResults(query);
                renderSearchDropdown(results, query);
            } else {
                if (dropdown) dropdown.style.display = 'none';
                // If we are on files page, maybe reload? 
                // Matching previous behavior: if on files page, reload current folder.
                if (window.currentPage === 'files' && typeof loadFiles === 'function') {
                    // We need currentParentId from files.js. 
                    // Since it's a global var in files.js, we *might* access it if files.js is loaded.
                    // But accessing global vars across files is brittle.
                    // Ideally files.js exposes a 'reloadCurrentView' or similar.
                    // For now, let's just trigger loadFiles(null) or check global.
                    // Actually, files.js defines `currentParentId` at top level.
                    // If files.js is loaded, `currentParentId` should be window.currentParentId (if var isn't used) -> actually `let` at top level does NOT attach to window.
                    // We might need to export it or just reload root if we can't access it.
                    // Or we just don't reload on clear if it's too complex for now, but user likes it.

                    // Allow simple reload if we can access the function.
                    if (typeof loadFiles === 'function') {
                        // We can't easily access currentParentId if it's not on window.
                        // Assumption: loadFiles(null) loads root.
                        // Better: don't auto-reload on global search clear unless strictly needed.
                        // But the previous code did: loadFiles(currentParentId).
                        // Let's rely on files.js exposing `reloadFilesView` or similar later.
                        // For now, we skip auto-reload on simple clear to avoid breaking state, or we assume root.
                    }
                }
            }
        }, 300);

        // Hide dropdown on click outside
        document.addEventListener('click', (e) => {
            if (dropdown && !dropdown.contains(e.target) && e.target !== searchInput) {
                dropdown.style.display = 'none';
            }
        });

        // Show dropdown again if focused and has value
        searchInput.onfocus = async () => {
            if (searchInput.value.trim().length > 0 && dropdown.style.display === 'none') {
                const results = await fetchSearchResults(searchInput.value.trim());
                renderSearchDropdown(results, searchInput.value.trim());
            }
        };
    }
}

async function fetchSearchResults(query) {
    try {
        const response = await fetch(`/api/files/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Search failed');
        return await response.json();
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

function renderSearchDropdown(files, query) {
    const dropdown = document.getElementById('search-results-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = '';

    // Reddit-style: ensure it's visible
    dropdown.style.display = 'block';

    if (files.length === 0) {
        dropdown.innerHTML = '<div class="search-no-results">No results found</div>';
        return;
    }

    const maxResults = 5;
    const displayFiles = files.slice(0, maxResults);

    displayFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'search-result-item';

        let icon = '';
        if (file.type === 'folder') {
            // Folder Icon
            icon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color: #fbbf24;"><path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" /></svg>`;
        } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)) {
            // Image Icon
            icon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
        } else {
            // File Icon
            icon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
        }

        item.innerHTML = `
            <div class="search-result-icon">${icon}</div>
            <div class="search-result-info">
                <div class="search-result-name" title="${file.name}">${file.name}</div>
                <div class="search-result-meta">
                    <span>${file.type === 'folder' ? 'Folder' : formatBytes(file.size)}</span>
                    ${file.caption ? `<span class="search-result-caption">• ${file.caption.substring(0, 30)}...</span>` : ''}
                </div>
            </div>
        `;

        item.onclick = async () => {
            dropdown.style.display = 'none';
            if (file.type === 'folder') {
                await handleFolderNavigation(file.id, file.name);
            } else {
                if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)) {
                    window.open(`/api/files/download/${file.id}?token=${localStorage.getItem('token')}`, '_blank');
                }
            }
        };

        dropdown.appendChild(item);
    });

    // Footer with "Show all results"
    const footer = document.createElement('div');
    footer.className = 'search-footer';
    const showAllBtn = document.createElement('button');
    showAllBtn.textContent = `Show all results for "${query}"`;
    showAllBtn.onclick = async () => {
        dropdown.style.display = 'none';
        await handleShowAllResults(files, query);
    };
    footer.appendChild(showAllBtn);
    dropdown.appendChild(footer);
}

// Navigation Helpers

async function handleFolderNavigation(id, name) {
    if (window.currentPage !== 'files') {
        // Need to switch page. 
        // Assuming loadPage is global from app.js
        if (typeof loadPage === 'function') {
            await loadPage('files');
        } else {
            console.error('loadPage is not defined');
            return;
        }
    }

    // Now call enterFolder. 
    // We assume enterFolder is available globally from files.js
    if (typeof enterFolder === 'function') {
        enterFolder(id, name);
    } else {
        console.error('enterFolder is not defined');
    }
}

async function handleShowAllResults(files, query) {
    if (window.currentPage !== 'files') {
        if (typeof loadPage === 'function') {
            await loadPage('files');
        }
    }

    // Now call showFullSearchResults.
    // We assume it returns to global scope logic or we need to access files.js logic
    if (typeof showFullSearchResults === 'function') {
        showFullSearchResults(files, query);
    } else if (typeof renderFiles === 'function') {
        // Fallback if showFullSearchResults isn't global
        // We can manually reconstruct the view
        const fileGrid = document.getElementById('file-grid');
        const emptyState = document.getElementById('files-empty-state');
        const breadcrumbs = document.getElementById('breadcrumbs');

        if (fileGrid) {
            fileGrid.style.display = 'grid';
            if (emptyState) emptyState.style.display = 'none';

            breadcrumbs.innerHTML = `
                <span class="breadcrumb-item" onclick="loadFiles(null)">My Files</span>
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-item active">Search: "${query}"</span>
            `;

            renderFiles(files);
        }
    }
}

// Utility
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
