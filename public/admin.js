let adminToken = null;
let folders = [];
let selectedFiles = [];
let landingImages = [];
let selectedLandingFiles = [];

function isVideoUrl(url) {
    return url.toLowerCase().split('?')[0].endsWith('.webm');
}

function renderAdminMedia(photo) {
    if (isVideoUrl(photo.url)) {
        return `<video src="${photo.url}" muted preload="metadata" class="photo-thumbnail"></video>`;
    }
    return `<img src="${photo.url}" alt="Photo" loading="lazy" class="photo-thumbnail">`;
}

// Check if already logged in
window.addEventListener('DOMContentLoaded', () => {
    adminToken = sessionStorage.getItem('adminToken');
    if (adminToken) {
        showAdminPanel();
        loadFolders();
        loadLandingImages();
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
            loadLandingImages();
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

async function loadFolders() {
    try {
        const response = await fetch('/api/folders');
        folders = await response.json();
        
        // Get photo count for each folder
        folders = await Promise.all(folders.map(async (folder) => {
            try {
                const photosResponse = await fetch(`/api/photos/folder/${folder.id}`);
                const photos = await photosResponse.json();
                return { ...folder, photoCount: photos.length };
            } catch (error) {
                return { ...folder, photoCount: 0 };
            }
        }));
        
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
        <div class="folder-item" data-id="${folder.id}">
            <div class="folder-header">
                <h3>${escapeHtml(folder.name)}</h3>
                <div class="folder-actions">
                    <button onclick="renameFolder('${folder.id}')" class="btn-edit" title="Rename">✏️</button>
                    <button onclick="deleteFolder('${folder.id}')" class="btn-delete" title="Delete">🗑️</button>
                </div>
            </div>
            <button onclick="viewFolderPhotos('${folder.id}')" class="btn-view">View Photos (<span class="count-val">${folder.photoCount || 0}</span>)</button>
        </div>
    `).join('');

    setupFolderSorting();
}

function setupFolderSorting() {
    const foldersList = document.getElementById('folders-list');
    if (!foldersList || foldersList.dataset.sortableBound === 'true') return;

    new Sortable(foldersList, {
        animation: 150,
        handle: '.folder-header',
        ghostClass: 'folder-item-ghost',
        chosenClass: 'folder-item-chosen',
        dragClass: 'folder-item-dragging'
    });

    foldersList.dataset.sortableBound = 'true';
}

async function saveFolderOrder() {
    const foldersList = document.getElementById('folders-list');
    if (!foldersList) return;

    const order = [...foldersList.querySelectorAll('.folder-item')].map((item, index) => ({
        id: item.dataset.id,
        order: index
    }));

    if (order.length === 0) return;

    try {
        const response = await fetch('/api/admin/folders/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: adminToken, order })
        });

        if (response.ok) {
            showMessage('Folder order saved successfully!', 'success', 'folder-message');
            await loadFolders();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to save folder order', 'error', 'folder-message');
        }
    } catch (error) {
        console.error('Save folder order error:', error);
        showMessage('Error saving folder order', 'error', 'folder-message');
    }
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
                <div class="folder-view">
                <h2>${escapeHtml(folder.name)} - Photos</h2>
                <button onclick="savePhotoOrder()" class="btn-primary">Save Order</button>
                </div>
                <button onclick="this.closest('.modal').remove()" class="btn-close">Close</button>`;

        if (photos.length === 0) {
            html += '<p class="empty-modal-msg">No photos in this folder</p>';
        } else {
            html += `
                <div class="photos-grid sortable-grid" data-folder-id="${folderId}">
                    ${photos.map(photo => `
                        <div class="gallery-item photo-item" data-photo-id="${photo.id}">
                            ${renderAdminMedia(photo)}
                            ${isVideoUrl(photo.url) ? '<span class="admin-video-badge" aria-label="Video"></span>' : ''}
                            <div class="photo-actions">
                                <button onclick="deletePhoto('${photo.id}')" class="delete-btn">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        html += '</div></div>';
        const modal = document.createElement('div');
        modal.innerHTML = html;
        document.body.appendChild(modal.firstElementChild);
        
        const gridElement = document.querySelector('.sortable-grid');
        if (gridElement) {
            new Sortable(gridElement, { animation: 150 });
        }
    } catch (error) {
        console.error('Error loading folder photos:', error);
        showMessage('Error loading photos', 'error', 'folder-message');
    }
}

async function savePhotoOrder() {
    const grid = document.querySelector('.sortable-grid');
    if (!grid) return;
    
    const photos = grid.querySelectorAll('.photo-item');
    const order = [...photos].map((photo, index) => ({
        id: photo.dataset.photoId,
        order: index
    }));
    
    try {
        const response = await fetch('/api/admin/photos/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: adminToken, order })
        });
        
        if (response.ok) {
            alert('Order saved successfully!');
        } else {
            alert('Failed to save order');
        }
    } catch (error) {
        console.error('Reorder error:', error);
        alert('Error saving order');
    }
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    selectedFiles = files;
    clearMessage('upload-message');
    
    const fileNameSpan = document.getElementById('file-name');
    if (files.length === 0) {
        fileNameSpan.textContent = 'No files selected';
        document.getElementById('preview-container').innerHTML = '';
        return;
    }

    fileNameSpan.textContent = `${files.length} file(s) selected`;
    displayPreview(files);
}

function displayPreview(files) {
    const previewContainer = document.getElementById('preview-container');
    previewContainer.innerHTML = '<h3>Media preview:</h3><div class="preview-grid">' +
        files.map((file, index) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const previewItem = document.querySelector(`[data-file-index="${index}"]`);
                if (previewItem) {
                    const media = file.type.startsWith('video/')
                        ? `<video src="${e.target.result}" controls muted></video>`
                        : `<img src="${e.target.result}" alt="Preview">`;
                    previewItem.innerHTML = `${media}<span class="preview-name">${escapeHtml(file.name)}</span>`;
                }
            };
            reader.readAsDataURL(file);
            
            return `<div class="preview-item" data-file-index="${index}">
                <div class="preview-loader">Loading...</div>
            </div>`;
        }).join('') + 
        '</div>';
}

async function handleUpload(event) {
    event.preventDefault();
    
    const folderId = document.getElementById('folder-select').value;
    if (!folderId) {
        showMessage('Please select a folder', 'error', 'upload-message');
        return;
    }

    if (selectedFiles.length === 0) {
        showMessage('Please select files', 'error', 'upload-message');
        return;
    }

    const uploadBtn = event.target.querySelector('.upload-btn');
    uploadBtn.disabled = true;

    let uploadedCount = 0;
    let failedCount = 0;
    const totalFiles = selectedFiles.length;

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('token', adminToken);
            formData.append('folderId', folderId);

            await uploadWithProgress('/api/admin/photos', formData, 'upload-progress', `Uploading ${i + 1}/${totalFiles}`);
            uploadedCount++;
        } catch (error) {
            console.error('Upload error for', file.name, error);
            failedCount++;
        }
        uploadBtn.textContent = `Uploading ${uploadedCount + failedCount}/${totalFiles}...`;
    }

    // Clear form and preview after all uploads
    document.getElementById('photo-file').value = '';
    document.getElementById('file-name').textContent = 'No files selected';
    document.getElementById('preview-container').innerHTML = '';
    selectedFiles = [];
    document.getElementById('upload-progress').hidden = true;

    if (failedCount === 0) {
        showMessage(`All ${uploadedCount} media items uploaded successfully!`, 'success', 'upload-message', false);
    } else {
        showMessage(`${uploadedCount} uploaded, ${failedCount} failed`, 'error', 'upload-message');
    }

    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload Images or Videos';
    
    // Reload folders to update photo counts
    loadFolders();
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
            // 1. Identify the targeted photo block element in the UI
            const photoItem = document.querySelector(`.photo-item[data-photo-id="${photoId}"]`);
            if (photoItem) {
                const gridContainer = photoItem.closest('.photos-grid');
                photoItem.remove(); // Remove item seamlessly from current View without breaking modal
                
                // 2. If no items remain, print empty state message directly inside the modal
                if (gridContainer && gridContainer.querySelectorAll('.photo-item').length === 0) {
                    gridContainer.insertAdjacentHTML('afterend', '<p class="empty-modal-msg">No photos in this folder</p>');
                    gridContainer.remove();
                    // Remove save order button if grid becomes empty
                    document.querySelector('.modal-content button[onclick="savePhotoOrder()"]')?.remove();
                }
            }

            // 3. Decrement the background folder photo counts seamlessly on the main screen without full reload
            const activeGrid = document.querySelector('.sortable-grid');
            if (activeGrid) {
                const folderId = activeGrid.dataset.folderId;
                const folderCard = document.querySelector(`.folder-item[data-id="${folderId}"]`);
                if (folderCard) {
                    const counterSpan = folderCard.querySelector('.count-val');
                    if (counterSpan) {
                        let currentCount = parseInt(counterSpan.textContent, 10) || 0;
                        counterSpan.textContent = Math.max(0, currentCount - 1);
                    }
                }
                // Silently sync local cache variable
                const cacheFolder = folders.find(f => f.id === folderId);
                if (cacheFolder && cacheFolder.photoCount > 0) cacheFolder.photoCount--;
            }
            
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to delete photo');
        }
    } catch (error) {
        console.error('Delete photo error:', error);
        alert('Error deleting photo');
    }
}

function showMessage(message, type, elementId, autoClear = true) {
    const element = document.getElementById(elementId || 'upload-message');
    if (!element) return;
    element.textContent = message;
    element.className = `message ${type}`;
    
    if (type === 'success' && autoClear) {
        setTimeout(() => {
            element.textContent = '';
            element.className = 'message';
        }, 3000);
    }
}

function clearMessage(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = '';
    element.className = 'message';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function uploadWithProgress(url, formData, progressId, progressLabel) {
    return new Promise((resolve, reject) => {
        const progress = document.getElementById(progressId);
        const bar = progress.querySelector('.upload-progress-bar');
        const value = progress.querySelector('.upload-progress-value');
        const label = progress.querySelector('.upload-progress-header span');
        progress.hidden = false;
        bar.style.width = '0%';
        value.textContent = '0%';
        label.textContent = progressLabel;

        const request = new XMLHttpRequest();
        request.open('POST', url);
        request.upload.addEventListener('progress', event => {
            if (!event.lengthComputable) return;
            const percent = Math.round((event.loaded / event.total) * 100);
            bar.style.width = `${percent}%`;
            value.textContent = `${percent}%`;
        });
        request.addEventListener('progress', () => {
            const updates = request.responseText.trim().split('\n');
            updates.forEach(update => {
                try {
                    const data = JSON.parse(update);
                    if (typeof data.conversionProgress === 'number') {
                        label.textContent = 'Converting';
                        bar.style.width = `${data.conversionProgress}%`;
                        value.textContent = `${data.conversionProgress}%`;
                    }
                } catch (error) {
                    // The final response may still be arriving.
                }
            });
        });
        request.addEventListener('load', () => {
            progress.hidden = true;
            const responseLines = request.responseText.trim().split('\n').filter(Boolean);
            const responseData = JSON.parse(responseLines[responseLines.length - 1] || '{}');
            if (request.status >= 200 && request.status < 300 && !responseData.error) {
                resolve(responseData);
            } else {
                reject(new Error(responseData.error || 'Upload failed'));
            }
        });
        request.addEventListener('error', () => {
            progress.hidden = true;
            reject(new Error('Network error during upload'));
        });
        request.addEventListener('abort', () => {
            progress.hidden = true;
            reject(new Error('Upload cancelled'));
        });
        request.send(formData);
    });
}

async function loadLandingImages() {
    try {
        const response = await fetch('/api/landing-images');
        if (!response.ok) throw new Error('Failed to load landing images');
        landingImages = await response.json();
        displayLandingImages();
    } catch (error) {
        console.error('Error loading landing images:', error);
        showMessage('Error loading home page images', 'error', 'landing-message');
    }
}

function displayLandingImages() {
    const imagesList = document.getElementById('landing-images-list');
    if (!imagesList) return;

    if (landingImages.length === 0) {
        imagesList.innerHTML = '<p class="empty">No home page images yet.</p>';
        return;
    }

    imagesList.innerHTML = landingImages.map(image => `
        <div class="landing-image-item" data-image-id="${image.id}">
            <img src="${image.url}" alt="Home page image">
            <button onclick="deleteLandingImage('${image.id}')" class="delete-btn">Delete</button>
        </div>
    `).join('');

    if (!imagesList.dataset.sortableBound) {
        new Sortable(imagesList, { animation: 150 });
        imagesList.dataset.sortableBound = 'true';
    }
}

function handleLandingFileSelect(event) {
    selectedLandingFiles = Array.from(event.target.files);
    clearMessage('landing-message');
    document.getElementById('landing-file-name').textContent = selectedLandingFiles.length
        ? `${selectedLandingFiles.length} file(s) selected`
        : 'No files selected';
    displayLandingPreview(selectedLandingFiles);
}

function displayLandingPreview(files) {
    const previewContainer = document.getElementById('landing-preview-container');
    if (!files.length) {
        previewContainer.innerHTML = '';
        return;
    }

    previewContainer.innerHTML = '<h3>Preview:</h3><div class="preview-grid">' + files.map((file, index) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const previewItem = previewContainer.querySelector(`[data-landing-file-index="${index}"]`);
            if (previewItem) previewItem.innerHTML = `<img src="${event.target.result}" alt="Preview"><span class="preview-name">${escapeHtml(file.name)}</span>`;
        };
        reader.readAsDataURL(file);
        return `<div class="preview-item" data-landing-file-index="${index}"><div class="preview-loader">Loading...</div></div>`;
    }).join('') + '</div>';
}

async function handleLandingUpload(event) {
    event.preventDefault();
    if (!selectedLandingFiles.length) {
        showMessage('Please select images', 'error', 'landing-message');
        return;
    }

    const uploadButton = event.target.querySelector('.upload-btn');
    uploadButton.disabled = true;
    let uploadedCount = 0;

    for (const file of selectedLandingFiles) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('token', adminToken);
        try {
            await uploadWithProgress('/api/admin/landing-images', formData, 'landing-upload-progress', `Uploading ${uploadedCount + 1}/${selectedLandingFiles.length}`);
            uploadedCount++;
        } catch (error) {
            console.error('Landing image upload error:', error);
        }
    }

    document.getElementById('landing-image-file').value = '';
    document.getElementById('landing-file-name').textContent = 'No files selected';
    document.getElementById('landing-preview-container').innerHTML = '';
    selectedLandingFiles = [];
    document.getElementById('landing-upload-progress').hidden = true;
    uploadButton.disabled = false;
    showMessage(`${uploadedCount} home page image(s) uploaded`, 'success', 'landing-message', false);
    await loadLandingImages();
}

async function deleteLandingImage(imageId) {
    if (!confirm('Are you sure you want to delete this home page image?')) return;

    try {
        const response = await fetch(`/api/admin/landing-images/${imageId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: adminToken })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete image');
        }
        await loadLandingImages();
    } catch (error) {
        console.error('Delete landing image error:', error);
        showMessage(error.message, 'error', 'landing-message');
    }
}

async function saveLandingImageOrder() {
    const imagesList = document.getElementById('landing-images-list');
    const order = [...imagesList.querySelectorAll('.landing-image-item')].map((item, index) => ({
        id: item.dataset.imageId,
        order: index
    }));

    try {
        const response = await fetch('/api/admin/landing-images/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: adminToken, order })
        });
        if (!response.ok) throw new Error('Failed to save image order');
        showMessage('Home page image order saved!', 'success', 'landing-message');
        await loadLandingImages();
    } catch (error) {
        console.error('Save landing image order error:', error);
        showMessage(error.message, 'error', 'landing-message');
    }
}