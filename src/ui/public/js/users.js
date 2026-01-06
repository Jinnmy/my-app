window.initUsersPage = function () {
    const userList = document.getElementById('users-list');
    const userModal = document.getElementById('user-modal');
    const userForm = document.getElementById('user-form');
    const addUserBtn = document.getElementById('add-user-btn');
    const closeModalBtn = document.querySelector('.close-modal');
    const cancelBtn = document.querySelector('.close-modal-btn');
    const modalTitle = document.getElementById('user-modal-title');
    const storageSlider = document.getElementById('storage_limit_slider');
    const storageInput = document.getElementById('storage_limit');
    const maxStorageDisplay = document.getElementById('max-storage-display');
    const modalDeleteBtn = document.getElementById('modal-delete-btn');
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Access Control
    if (user.role !== 'admin') {
        alert('Access Denied: Admins only.');
        window.location.href = '#'; // Or loadPage('dashboard-home') if using router, but simplified here.
        // Better: trigger router to go home
        if (window.loadPage) window.loadPage('dashboard-home');
        return;
    }

    // Storage Slider Logic
    const BYTES_PER_GB = 1073741824;

    function setupStorageSlider(currentLimit = 0) {
        // Reset to default safe state first
        storageSlider.min = 0;

        // Convert input currentLimit (bytes) to GB for display
        const currentLimitGB = Math.floor((currentLimit || 0) / BYTES_PER_GB);

        storageSlider.value = currentLimitGB;
        storageInput.value = currentLimitGB;

        fetch('/api/system/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(stats => {
                // Max allowed is current limit + available unallocated space
                // 'available' from API is TotalDisk - TotalAllocated
                const availableUnallocated = stats.available || 0;

                // Calculate max available for this user in GB
                // We add current limit (bytes) + available unallocated (bytes) then convert to GB
                const maxTotalBytes = availableUnallocated + (currentLimit || 0);
                const maxAllowedGB = Math.floor(maxTotalBytes / BYTES_PER_GB);

                storageSlider.max = maxAllowedGB;

                // Set initial value in GB
                let initValGB = currentLimitGB;
                if (!initValGB && initValGB !== 0) initValGB = 10; // Default 10GB for new
                if (initValGB > maxAllowedGB) initValGB = maxAllowedGB;

                storageSlider.value = initValGB;
                storageInput.value = initValGB;
                storageInput.max = maxAllowedGB; // Also constrain the number input

                maxStorageDisplay.textContent = `Max available: ${maxAllowedGB} GB`;
            })
            .catch(err => {
                console.error("Failed to fetch storage stats", err);
                maxStorageDisplay.textContent = "Error fetching storage info";
            });
    }

    // Sync Slider & Input
    if (storageSlider && storageInput) {
        storageSlider.addEventListener('input', () => {
            storageInput.value = storageSlider.value;
        });

        storageInput.addEventListener('input', () => {
            let val = parseFloat(storageInput.value) || 0;
            const max = parseFloat(storageInput.max) || Infinity;
            if (val > max) {
                // optionally clamp, but maybe just let them type and handle validation later?
                // Clamping while typing is annoying. Let's just update slider if within range.
            }
            if (val >= 0 && val <= max) {
                storageSlider.value = val;
            }
        });

        // Clamp on blur
        storageInput.addEventListener('blur', () => {
            let val = parseFloat(storageInput.value) || 0;
            const max = parseFloat(storageInput.max) || Infinity;
            if (val > max) {
                storageInput.value = max;
                storageSlider.value = max;
            }
            if (val < 0) {
                storageInput.value = 0;
                storageSlider.value = 0;
            }
        });
    }

    // Helper to format bytes
    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    // Fetch Users
    async function fetchUsers() {
        try {
            const response = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const users = await response.json();
            // Filter out the current user
            const filteredUsers = users.filter(u => u.id != user.id);
            renderUsers(filteredUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
            alert('Failed to load users');
        }
    }

    // Render Users
    function renderUsers(users) {
        userList.innerHTML = users.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td><span class="badge ${user.role}">${user.role}</span></td>
                <td>
                    <div class="storage-info">
                        ${formatBytes(user.used_storage)} / ${formatBytes(user.storage_limit)}
                    </div>
                </td>
                <td>
                    <button class="action-btn edit" data-id="${user.id}"><i data-feather="edit-2"></i> Edit</button>
                    <button class="action-btn delete" data-id="${user.id}"><i data-feather="trash"></i></button>
                </td>
            </tr>
        `).join('');

        // Attach event listeners to new buttons
        document.querySelectorAll('.edit').forEach(btn => {
            btn.addEventListener('click', () => editUser(btn.dataset.id, users));
        });
        document.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', () => deleteUser(btn.dataset.id));
        });

        // Replace Feather icons
        if (window.feather) {
            feather.replace();
        }
    }

    // Open Modal (Add)
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            modalTitle.textContent = 'Add User';
            userForm.reset();
            document.getElementById('user-id').value = '';
            document.getElementById('password').required = true;
            document.getElementById('password').placeholder = '';

            // Setup slider for new user (current limit 0)
            setupStorageSlider(0); // Init with 0, will default to 10GB in setup

            modalDeleteBtn.style.display = 'none'; // Hide delete button for new users

            userModal.classList.add('active');
        });
    }

    // Edit User
    function editUser(id, users) {
        const user = users.find(u => u.id == id);
        if (!user) return;

        modalTitle.textContent = 'Edit User';
        document.getElementById('user-id').value = user.id;
        document.getElementById('username').value = user.username;
        document.getElementById('email').value = user.email;
        document.getElementById('role').value = user.role;
        // document.getElementById('storage_limit').value = user.storage_limit; // Handled by slider setup

        document.getElementById('password').required = false;
        document.getElementById('password').placeholder = 'Leave blank to keep unchanged';

        setupStorageSlider(user.storage_limit);

        // Show delete button and setup listener
        modalDeleteBtn.style.display = 'block';
        modalDeleteBtn.onclick = () => {
            closeModal();
            deleteUser(id);
        };

        userModal.classList.add('active');
    }

    // Close Modal
    function closeModal() {
        userModal.classList.remove('active');
    }
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === userModal) closeModal();
    });

    // Handle Form Submit
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('user-id').value;
            const formData = {
                username: document.getElementById('username').value,
                email: document.getElementById('email').value,
                role: document.getElementById('role').value,
                // storage_limit comes in as GB from input, convert to bytes
                storage_limit: (parseInt(document.getElementById('storage_limit').value) || 0) * BYTES_PER_GB,
            };

            const password = document.getElementById('password').value;
            if (password) formData.password = password;

            try {
                const url = id ? `/api/users/${id}` : '/api/users';
                const method = id ? 'PUT' : 'POST';

                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Operation failed');
                }

                closeModal();
                fetchUsers();
                alert(id ? 'User updated successfully' : 'User created successfully');

            } catch (error) {
                console.error('Error saving user:', error);
                alert(error.message);
            }
        });
    }

    // Delete User
    async function deleteUser(id) {
        if (!confirm('Are you sure you want to delete this user? All their files will be permanently deleted.')) return;

        try {
            const response = await fetch(`/api/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Delete failed');
            }

            fetchUsers();
            alert('User deleted successfully');
        } catch (error) {
            console.error('Error deleting user:', error);
            alert(error.message);
        }
    }

    // Initial Load
    fetchUsers();
    if (window.feather) feather.replace();
};
