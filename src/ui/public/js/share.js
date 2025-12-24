document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    const loading = document.getElementById('loading');
    const card = document.getElementById('share-card');
    const errorContainer = document.getElementById('error-container');

    if (!token) {
        showError();
        return;
    }

    try {
        const response = await fetch(`/api/files/s/${token}`);
        if (response.ok) {
            const file = await response.json();
            renderFile(file);
        } else {
            showError();
        }
    } catch (e) {
        console.error(e);
        showError();
    }

    function showError() {
        loading.style.display = 'none';
        card.style.display = 'none';
        errorContainer.style.display = 'block';
    }

    function renderFile(file) {
        loading.style.display = 'none';
        card.style.display = 'block';

        document.getElementById('file-name').textContent = file.filename;
        document.getElementById('file-meta').textContent = formatBytes(file.size);

        // Icon Logic
        const iconContainer = document.getElementById('file-icon-container');
        iconContainer.innerHTML = getIcon(file.type, file.filename);

        document.getElementById('btn-download').onclick = () => {
            window.location.href = `/api/files/s/${token}/download`;
        };
    }

    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    function getIcon(type, name) {
        if (type === 'folder') {
            return `
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="var(--primary-color)" class="file-icon-large">
                <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
            </svg>`;
        }

        const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name);
        const isVideo = /\.(mp4|webm|ogg|mkv)$/i.test(name);
        const isPdf = name.toLowerCase().endsWith('.pdf');

        if (isImage) {
            return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="file-icon-large">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
            </svg>`;
        } else if (isVideo) {
            return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="file-icon-large">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                <line x1="7" y1="2" x2="7" y2="22"></line>
                <line x1="17" y1="2" x2="17" y2="22"></line>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <line x1="2" y1="7" x2="7" y2="7"></line>
                <line x1="2" y1="17" x2="7" y2="17"></line>
                <line x1="17" y1="17" x2="22" y2="17"></line>
                <line x1="17" y1="7" x2="22" y2="7"></line>
            </svg>`;
        } else if (isPdf) {
            return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#F40F02" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="file-icon-large">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>`;
        } else {
            return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="file-icon-large">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>`;
        }
    }
});
