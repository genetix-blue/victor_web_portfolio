let adminToken = null;
let folders = [];

// Check if already logged in
window.addEventListener('DOMContentLoaded', () => {
    adminToken = sessionStorage.getItem('adminToken');
    if (adminToken) {
        showAdminPanel();
        loadFolders();
    } else {
        showLoginPage();
    }
});

function showLoginPage() {
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
}

function showAdminPanel() {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
}

async function handleLogin(event) {
    event.preventDefault();
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success) {
            adminToken = data.token;
            sessionStorage.setItem('adminToken', adminToken);
            document.getElementById('password').value = '';
            document.getElementById('login-error').textContent = '';
            showAdminPanel();
            loadFolders();
        } else {
            document.getElementById('login-error').textContent = 'Invalid password';
        }
    } catch (error) {
        console.error('Login error:', error);
        document.getElementById('login-error').textContent = 'Login error';
    }
}

function logout() {
    sessionStorage.removeItem('adminToken');
    adminToken = null;
    showLoginPage();
    document.getElementById('password').value = '';
    document.getElementById('password').focus();
}

function updateFileName(event) {
    const file = event.target.files[0];
    const fileNameSpan = document.getElementById('file-name');
    
    if (file) {
        fileNameSpan.textContent = file.name;
    } else {
        fileNameSpan.textContent = 'No file selected';
    }
}

async function loadFolders() {
    try {
        const response = await fetch('/api/folders');
        folders = await response.json();
        displayFolders();
        updateFolderSelect();
    } catch (error) {
        console.error('Error loading folders:', error);
        showMessage('Error loading folders', 'error', 'folder-message');
    }
}

function displayFolders() {
    const foldersList = document.getElementById('folders-list');
    
    if (folders.length === 0) {
        foldersList.innerHTML = '<p class="empty">No folders yet. Create one to get started!</p>';
        return;
    }

    foldersList.innerHTML = folders.map(folder => `
        <div class="folder-item">
            <div class="folder-header">
                <h3>${escapeHtml(folder.name)}</h3>
                <div class="folder-actions">
                    <button onclick="renameFolder('${folder.id}')" class="btn-edit" title="Rename">✏️</button>
                    <button onclick="deleteFolder('${folder.id}')" class="btn-delete" title="Delete">🗑️</button>
                </div>
            </div>
            <button onclick="viewFolderPhotos('${folder.id}')" class="btn-view">View Photos (${folder.photo_count || 0})</button>
        </div>
    `).join('');
}

function updateFolderSelect() {
    const select = document.getElementById('folder-select');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">-- Choose a folder --</option>' + 
        folders.map(folder => `<option value="${folder.id}">${escapeHtml(folder.name)}</option>`).join('');
    
    select.value = currentValue;
}

async function createFolder() {
    const nameInput = document.getElementById('new-folder-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        showMessage('Folder name cannot be empty', 'error', 'folder-message');
        return;
    }

    try {
        const response = await fetch('/api/admin/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: adminToken, name })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Folder created successfully!', 'success', 'folder-message');
            nameInput.value = '';
            loadFolders();
        } else {
            showMessage(data.error || 'Failed to create folder', 'error', 'folder-message');
        }
    } catch (error) {
        console.error('Create folder error:', error);
        showMessage('Error creating folder', 'error', 'folder-message');
    }
}

async function renameFolder(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    const newName = prompt('Enter new folder name:', folder.name);
    if (!newName || !newName.trim()) return;

    try {
        const response = await fetch(`/api/admin/folders/${folderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: adminToken, name: newName })
        });

        if (response.ok) {
            showMessage('Folder renamed successfully!', 'success', 'folder-message');
            loadFolders();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to rename folder', 'error', 'folder-message');
        }
    } catch (error) {
        console.error('Rename folder error:', error);
        showMessage('Error renaming folder', 'error', 'folder-message');
    }
}

async function deleteFolder(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    if (!confirm(`Are you sure you want to delete "${folder.name}"? All photos in this folder will also be deleted.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/folders/${folderId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: adminToken })
        });

        if (response.ok) {
            showMessage('Folder deleted successfully!', 'success', 'folder-message');
            loadFolders();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to delete folder', 'error', 'folder-message');
        }
    } catch (error) {
        console.error('Delete folder error:', error);
        showMessage('Error deleting folder', 'error', 'folder-message');
    }
}

async function viewFolderPhotos(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    try {
        const response = await fetch(`/api/photos/folder/${folderId}`);
        const photos = await response.json();

        let html = `<div class="modal" onclick="if(event.target===this) this.remove()">
            <div class="modal-content">
                <h2>${escapeHtml(folder.name)} - Photos</h2>
                <button onclick="this.closest('.modal').remove()" class="btn-close">Close</button>`;

        if (photos.length === 0) {
            html += '<p>No photos in this folder</p>';
        } else {
            html += '<div class="photos-grid">' + photos.map(photo => `
                <div class="photo-item">
                    <img src="${photo.url}" alt="Photo" loading="lazy">
                    <button onclick="deletePhoto('${photo.id}')" class="btn-delete-photo">Delete</button>
                </div>
            `).join('') + '</div>';
        }

        html += '</div></div>';
        const modal = document.createElement('div');
        modal.innerHTML = html;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error loading folder photos:', error);
        showMessage('Error loading photos', 'error', 'folder-message');
    }
}

async function handleUpload(event) {
    event.preventDefault();
    
    const folderId = document.getElementById('folder-select').value;
    if (!folderId) {
        showMessage('Please select a folder', 'error', 'upload-message');
        return;
    }

    const fileInput = document.getElementById('photo-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('Please select a file', 'error', 'upload-message');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('token', adminToken);
    formData.append('folderId', folderId);

    try {
        const uploadBtn = event.target.querySelector('.upload-btn');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        const response = await fetch('/api/admin/photos', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            showMessage('Photo uploaded successfully!', 'success', 'upload-message');
            fileInput.value = '';
            document.getElementById('file-name').textContent = 'No file selected';
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to upload photo', 'error', 'upload-message');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showMessage('Upload failed', 'error', 'upload-message');
    } finally {
        const uploadBtn = event.target.querySelector('.upload-btn');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Photo';
    }
}

async function deletePhoto(photoId) {
    if (!confirm('Are you sure you want to delete this photo?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/photos/${photoId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: adminToken })
        });

        if (response.ok) {
            showMessage('Photo deleted successfully!', 'success', 'upload-message');
            document.querySelector('.modal')?.remove();
            loadFolders();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to delete photo', 'error', 'upload-message');
        }
    } catch (error) {
        console.error('Delete photo error:', error);
        showMessage('Error deleting photo', 'error', 'upload-message');
    }
}

function showMessage(message, type, elementId) {
    const element = document.getElementById(elementId || 'upload-message');
    element.textContent = message;
    element.className = `message ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            element.textContent = '';
            element.className = 'message';
        }, 3000);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
