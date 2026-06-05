// Load and display folders with their photos
async function loadGallery() {
    try {
        const response = await fetch('/api/folders');
        const folders = await response.json();
        
        // Load all photos for each folder
        const foldersWithPhotos = await Promise.all(folders.map(async (folder) => {
            try {
                const photosResponse = await fetch(`/api/photos/folder/${folder.id}`);
                const photos = await photosResponse.json();
                return { ...folder, photos };
            } catch (error) {
                return { ...folder, photos: [] };
            }
        }));

        displayNavLinks(foldersWithPhotos);
        displayFolderSections(foldersWithPhotos);
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
        <a href="#folder-${folder.id}" class="nav-link">${escapeHtml(folder.name)}</a>
    `).join('');
}

function displayFolderSections(folders) {
    const gallery = document.getElementById('gallery');
    
    if (folders.length === 0) {
        gallery.innerHTML = '<p class="loading">No folders yet</p>';
        return;
    }

    gallery.innerHTML = folders.map(folder => `
        <section class="folder-section" id="folder-${folder.id}">
            <h2>${escapeHtml(folder.name)}</h2>
            ${folder.photos.length === 0 
                ? '<p class="empty-folder">No photos in this folder</p>' 
                : `<div class="photos-grid">
                    ${folder.photos.map(photo => `
                        <div class="gallery-item" onclick="openLightbox('${photo.url}')">
                            <img src="${photo.url}" alt="Gallery photo" loading="lazy">
                        </div>
                    `).join('')}
                </div>`
            }
        </section>
    `).join('');

    // Add smooth scroll behavior
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
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
