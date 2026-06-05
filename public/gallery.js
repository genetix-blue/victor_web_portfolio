let allFolders = [];
let currentFolderId = null;

// Load and display folders with their photos
async function loadGallery() {
    try {
        const response = await fetch('/api/folders');
        const folders = await response.json();
        
        // Load all photos for each folder
        allFolders = await Promise.all(folders.map(async (folder) => {
            try {
                const photosResponse = await fetch(`/api/photos/folder/${folder.id}`);
                const photos = await photosResponse.json();
                return { ...folder, photos, photoCount: photos.length };
            } catch (error) {
                return { ...folder, photos: [], photoCount: 0 };
            }
        }));

        displayNavLinks(allFolders);
        
        // Show first folder by default
        if (allFolders.length > 0) {
            showFolder(allFolders[0].id);
        }
    } catch (error) {
        console.error('Error loading gallery:', error);
        document.getElementById('gallery').innerHTML = '<p class="loading">Error loading gallery</p>';
    }
}

function displayNavLinks(folders) {
    const navLinks = document.getElementById('nav-links');
    
    if (folders.length === 0) {
        navLinks.innerHTML = '';
        return;
    }

    navLinks.innerHTML = folders.map(folder => `
        <a href="#" onclick="showFolder('${folder.id}'); return false;" class="nav-link" id="link-${folder.id}">
            ${escapeHtml(folder.name)}
        </a>
    `).join('');
}

function showFolder(folderId) {
    currentFolderId = folderId;
    const folder = allFolders.find(f => f.id === folderId);
    
    if (!folder) return;

    // Update active link
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.getElementById(`link-${folderId}`);
    if (activeLink) activeLink.classList.add('active');

    // Display folder content
    const gallery = document.getElementById('gallery');
    
    if (folder.photos.length === 0) {
        gallery.innerHTML = `<div class="folder-view">
            <h2>${escapeHtml(folder.name)}</h2>
            <p class="empty-folder">No photos in this folder</p>
        </div>`;
    } else {
        gallery.innerHTML = `<div class="folder-view">
            <h2>${escapeHtml(folder.name)}</h2>
            <div class="photos-grid">
                ${folder.photos.map(photo => `
                    <div class="gallery-item" onclick="openLightbox('${photo.url}')">
                        <img src="${photo.url}" alt="Gallery photo" loading="lazy">
                    </div>
                `).join('')}
            </div>
        </div>`;
    }
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
