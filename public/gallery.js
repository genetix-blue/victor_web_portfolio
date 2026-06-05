// Load and display photos
async function loadPhotos() {
    try {
        const response = await fetch('/api/photos');
        const photos = await response.json();
        displayPhotos(photos);
    } catch (error) {
        console.error('Error loading photos:', error);
        document.getElementById('gallery').innerHTML = '<p class="loading">Error loading photos</p>';
    }
}

function displayPhotos(photos) {
    const gallery = document.getElementById('gallery');
    
    if (photos.length === 0) {
        gallery.innerHTML = '<p class="loading">No photos yet</p>';
        return;
    }

    gallery.innerHTML = photos.map(photo => `
        <div class="gallery-item" onclick="openLightbox('${photo.url}')">
            <img src="${photo.url}" alt="Gallery photo" loading="lazy">
        </div>
    `).join('');
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

// Load photos on page load
document.addEventListener('DOMContentLoaded', loadPhotos);
