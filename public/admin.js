let adminToken = null;

// Check if already logged in
window.addEventListener('DOMContentLoaded', () => {
    adminToken = sessionStorage.getItem('adminToken');
    if (adminToken) {
        showAdminPanel();
        loadPhotos();
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
            loadPhotos();
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

async function handleUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('photo-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('Please select a file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('token', adminToken);

    try {
        const uploadBtn = event.target.querySelector('.upload-btn');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        const response = await fetch('/api/admin/photos', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            showMessage('Photo uploaded successfully!', 'success');
            fileInput.value = '';
            document.getElementById('file-name').textContent = 'No file selected';
            loadPhotos();
        } else {
            const error = await response.json();
            showMessage(error.error || 'Upload failed', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showMessage('Upload error', 'error');
    } finally {
        const uploadBtn = event.target.querySelector('.upload-btn');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Photo';
    }
}

async function loadPhotos() {
    try {
        const response = await fetch('/api/photos');
        const photos = await response.json();
        displayPhotos(photos);
    } catch (error) {
        console.error('Error loading photos:', error);
    }
}

function displayPhotos(photos) {
    const photosList = document.getElementById('photos-list');

    if (photos.length === 0) {
        photosList.innerHTML = '<div class="empty-message">No photos yet. Upload your first photo!</div>';
        return;
    }

    photosList.innerHTML = photos.map((photo, index) => `
        <div class="photo-item">
            <img src="${photo.url}" alt="Gallery photo" class="photo-thumbnail">
            <div class="photo-actions">
                ${index > 0 ? `<button class="move-up-btn" onclick="movePhoto('${photo.id}', 'up')">↑ Up</button>` : ''}
                ${index < photos.length - 1 ? `<button class="move-down-btn" onclick="movePhoto('${photo.id}', 'down')">Down ↓</button>` : ''}
                <button class="delete-btn" onclick="deletePhoto('${photo.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

async function movePhoto(photoId, direction) {
    try {
        const response = await fetch('/api/photos');
        const photos = await response.json();
        
        const currentIndex = photos.findIndex(p => p.id === photoId);
        if (currentIndex === -1) return;

        if (direction === 'up' && currentIndex > 0) {
            [photos[currentIndex], photos[currentIndex - 1]] = [photos[currentIndex - 1], photos[currentIndex]];
        } else if (direction === 'down' && currentIndex < photos.length - 1) {
            [photos[currentIndex], photos[currentIndex + 1]] = [photos[currentIndex + 1], photos[currentIndex]];
        }

        const order = photos.map(p => p.id);
        
        const reorderResponse = await fetch('/api/admin/photos/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: adminToken, order })
        });

        if (reorderResponse.ok) {
            loadPhotos();
        } else {
            showMessage('Failed to reorder photos', 'error');
        }
    } catch (error) {
        console.error('Reorder error:', error);
        showMessage('Reorder error', 'error');
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
            showMessage('Photo deleted successfully!', 'success');
            loadPhotos();
        } else {
            showMessage('Failed to delete photo', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showMessage('Delete error', 'error');
    }
}

function showMessage(text, type) {
    const messageEl = document.getElementById('upload-message');
    messageEl.textContent = text;
    messageEl.className = `message show ${type}`;
    
    setTimeout(() => {
        messageEl.classList.remove('show');
    }, 3000);
}
