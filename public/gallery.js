// Load and display folders
async function loadGallery() {
    try {
        const response = await fetch('/api/folders');
        const folders = await response.json();
        displayFolders(folders);
    } catch (error) {
        console.error('Error loading folders:', error);
        document.getElementById('gallery').innerHTML = '<p class="loading">Error loading gallery</p>';
    }
}

function displayFolders(folders) {
    const gallery = document.getElementById('gallery');
    
    if (folders.length === 0) {
        gallery.innerHTML = '<p class="loading">No folders yet</p>';
        return;
    }

    gallery.innerHTML = folders.map(folder => `
        <div class="folder-card" onclick="openFolder('${folder.id}', '${escapeHtml(folder.name)}')">
            <div class="folder-icon">📁</div>
            <h3>${escapeHtml(folder.name)}</h3>
        </div>
    `).join('');
}

async function openFolder(folderId, folderName) {
    try {
        const response = await fetch(`/api/photos/folder/${folderId}`);
        const photos = await response.json();
        displayFolderPhotos(photos, folderName, folderId);
    } catch (error) {
        console.error('Error loading folder photos:', error);
        alert('Error loading photos');
    }
}

function displayFolderPhotos(photos, folderName, folderId) {
    const gallery = document.getElementById('gallery');
    
    if (photos.length === 0) {
        gallery.innerHTML = `<div class="folder-view">
            <button onclick="loadGallery()" class="back-btn">← Back to Folders</button>
            <h2>${escapeHtml(folderName)}</h2>
            <p class="loading">No photos in this folder</p>
        </div>`;
        return;
    }

    gallery.innerHTML = `<div class="folder-view">
        <button onclick="loadGallery()" class="back-btn">← Back to Folders</button>
        <h2>${escapeHtml(folderName)}</h2>
        <div class="photos-grid">
            ${photos.map(photo => `
                <div class="gallery-item" onclick="openLightbox('${photo.url}')">
                    <img src="${photo.url}" alt="Gallery photo" loading="lazy">
                </div>
            `).join('')}
        </div>
    </div>`;
}

// Lightbox functionality
function openLightbox(imageUrl) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox active';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <span class="lightbox-close" onclick="this.closest('.lightbox').remove()">&times;</span>
            <img src="${imageUrl}" alt="Full size" class="lightbox-image">
        </div>
    `;
    document.body.appendChild(lightbox);

    // Close on background click
    lightbox.onclick = (e) => {
        if (e.target === lightbox) lightbox.remove();
    };

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            lightbox.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load gallery on page load
document.addEventListener('DOMContentLoaded', loadGallery);
