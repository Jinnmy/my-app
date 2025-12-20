// Allocations Page Logic
window.initAllocationsPage = async function () {
    const list = document.getElementById('allocationsList');
    const userSelect = document.getElementById('targetUser');
    const allocateBtn = document.getElementById('allocateBtn');
    const selectAll = document.getElementById('selectAll');
    const refreshBtn = document.getElementById('refreshAllocationsBtn');
    const selectionInfo = document.getElementById('selectionInfo');

    let allFiles = [];
    let selectedFiles = new Set();
    let users = [];

    // Helper to format bytes (simplified version or reuse global if available)
    // Assuming formatBytes is available globally from app.js; if not, defining it safely here
    const formatSize = window.formatBytes || function (bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['Bytes', 'KB', 'MB', 'GB', 'TB'][i];
    };

    async function loadUsers() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                users = await response.json();
                if (userSelect) {
                    userSelect.innerHTML = '<option value="">Select User...</option>';
                    users.forEach(u => {
                        const opt = document.createElement('option');
                        opt.value = u.id;
                        opt.textContent = u.username || u.email;
                        userSelect.appendChild(opt);
                    });
                }
            }
        } catch (e) {
            console.error('Failed to load users', e);
        }
    }

    async function loadFiles() {
        if (!list) return;
        list.innerHTML = '<div class="loading-state">Loading unmarked files...</div>';
        selectedFiles.clear();
        updateSelectionUI();

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/files/unmarked', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                allFiles = await response.json();
                renderList();
            } else {
                list.innerHTML = '<div class="empty-state">Failed to load files</div>';
            }
        } catch (e) {
            console.error(e);
            list.innerHTML = '<div class="empty-state">Error loading files</div>';
        }
    }

    function renderList() {
        if (!list) return;
        if (allFiles.length === 0) {
            list.innerHTML = '<div class="empty-state">No unmarked files found</div>';
            return;
        }

        list.innerHTML = '';
        allFiles.forEach(file => {
            const row = document.createElement('div');
            row.className = 'allocation-row';

            row.innerHTML = `
                <div class="col-checkbox"><input type="checkbox" class="file-check" value="${file.id}"></div>
                <div class="col-name" title="${file.name}">${file.name}</div>
                <div class="col-size">${formatSize(file.size)}</div>
                <div class="col-path" title="${file.path}">${file.path}</div>
                <div class="col-date">${new Date(file.created_at).toLocaleDateString()}</div>
            `;

            const checkbox = row.querySelector('.file-check');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) selectedFiles.add(file.id);
                else selectedFiles.delete(file.id);
                updateSelectionUI();
            });

            list.appendChild(row);
        });
    }

    function updateSelectionUI() {
        if (!selectionInfo) return;
        selectionInfo.textContent = `${selectedFiles.size} files selected`;
        if (allocateBtn) allocateBtn.disabled = selectedFiles.size === 0 || !userSelect.value;

        if (selectAll) {
            if (allFiles.length > 0 && selectedFiles.size === allFiles.length) {
                selectAll.checked = true;
                selectAll.indeterminate = false;
            } else if (selectedFiles.size > 0) {
                selectAll.checked = false;
                selectAll.indeterminate = true;
            } else {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            }
        }
    }

    if (selectAll) {
        selectAll.addEventListener('change', (e) => {
            const checkboxes = list.querySelectorAll('.file-check');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
                const id = parseInt(cb.value);
                if (e.target.checked) selectedFiles.add(id);
                else selectedFiles.delete(id);
            });
            updateSelectionUI();
        });
    }

    if (userSelect) userSelect.addEventListener('change', updateSelectionUI);

    if (refreshBtn) refreshBtn.addEventListener('click', loadFiles);

    if (allocateBtn) {
        allocateBtn.addEventListener('click', async () => {
            const targetUserId = userSelect.value;
            if (!targetUserId || selectedFiles.size === 0) return;

            if (!confirm(`Allocate ${selectedFiles.size} files to selected user?`)) return;

            allocateBtn.disabled = true;
            allocateBtn.textContent = 'Allocating...';

            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/files/allocate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        fileIds: Array.from(selectedFiles),
                        targetUserId: targetUserId
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    alert(result.message);
                    loadFiles(); // Refresh
                } else {
                    const err = await response.json();
                    alert('Error: ' + (err.error || 'Failed to allocate'));
                }
            } catch (e) {
                alert('Connection error');
                console.error(e);
            } finally {
                allocateBtn.disabled = false;
                allocateBtn.textContent = 'Allocate Selected';
            }
        });
    }

    // Initialize
    await loadUsers();
    await loadFiles();
};
