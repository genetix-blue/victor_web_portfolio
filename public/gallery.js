let allFolders = [];
let currentFolderId = null;
let currentPhotos = [];

async function loadLandingSection() {
    const landingContainer = document.getElementById('landing-container');
    if (!landingContainer) return;

    try {
        const response = await fetch('landing.html');
        if (!response.ok) throw new Error('Landing file not found');

        landingContainer.innerHTML = await response.text();

        const viewGalleryButton = landingContainer.querySelector('.landing-button.primary');
        if (viewGalleryButton && allFolders.length > 0) {
            viewGalleryButton.addEventListener('click', (event) => {
                event.preventDefault();
                showFolder(allFolders[0].id);
            });
        }

        showLandingSection();
    } catch (error) {
        console.error('Error loading landing section:', error);
        landingContainer.innerHTML = '<p class="loading">Landing section unavailable</p>';
    }
}

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

        if (allFolders.length > 0) {
            const viewGalleryButton = document.querySelector('.landing-button.primary');
            if (viewGalleryButton) {
                viewGalleryButton.onclick = (event) => {
                    event.preventDefault();
                    showFolder(allFolders[0].id);
                };
            }
        }

        showLandingSection();
    } catch (error) {
        console.error('Error loading gallery:', error);
        document.getElementById('gallery').innerHTML = '<p class="loading">Error loading gallery</p>';
    }
}

function displayNavLinks(folders) {
    const navLinks = document.getElementById('nav-links');
    const homeLink = `<a href="#landing" class="nav-link active" id="link-home">Inicio</a>`;

    if (folders.length === 0) {
        navLinks.innerHTML = homeLink;
        return;
    }

    navLinks.innerHTML = [
        homeLink,
        ...folders.map(folder => `
            <a href="#" onclick="showFolder('${folder.id}'); return false;" class="nav-link" id="link-${folder.id}">
                ${escapeHtml(folder.name)}
            </a>
        `)
    ].join('');

    const homeNavLink = document.getElementById('link-home');
    if (homeNavLink) {
        homeNavLink.addEventListener('click', (event) => {
            event.preventDefault();
            showLandingSection();
        });
    }
}

function updateNavbarMode(isHome) {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    navbar.classList.toggle('is-home', isHome);
    navbar.classList.toggle('is-gallery', !isHome);
    navbar.style.background = 'transparent';
    navbar.style.boxShadow = 'none';
}

function showLandingSection() {
    const landingContainer = document.getElementById('landing-container');
    const galleryContainer = document.getElementById('gallery-container');

    if (landingContainer) {
        landingContainer.style.display = 'block';
    }

    if (galleryContainer) {
        galleryContainer.style.display = 'none';
    }

    updateNavbarMode(true);

    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const homeLink = document.getElementById('link-home');
    if (homeLink) homeLink.classList.add('active');
}

function showFolder(folderId) {
    currentFolderId = folderId;
    const folder = allFolders.find(f => f.id === folderId);
    
    if (!folder) return;

    const landingContainer = document.getElementById('landing-container');
    const galleryContainer = document.getElementById('gallery-container');

    if (landingContainer) {
        landingContainer.style.display = 'none';
    }

    if (galleryContainer) {
        galleryContainer.style.display = 'block';
    }

    updateNavbarMode(false);

    // Store current photos for arrow navigation
    currentPhotos = folder.photos;

    // Update active link
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.getElementById(`link-${folderId}`);
    if (activeLink) activeLink.classList.add('active');

    // Display folder content
    const gallery = document.getElementById('gallery');
    
    if (folder.photos.length === 0) {
        gallery.innerHTML = `<div class="folder-view">
            <p class="empty-folder">No photos in this folder</p>
        </div>`;
    } else {
        // 1. Notice we added 'is-loading' class to keep it hidden/transparent initially
        gallery.innerHTML = `<div class="folder-view">
            <div class="photos-grid is-loading">
                ${folder.photos.map((photo, index) => `
                    <div class="gallery-item" onclick="openLightbox(${index})">
                        <img src="${photo.url}" alt="Gallery photo" loading="lazy">
                    </div>
                `).join('')}
            </div>
        </div>`;

        // 2. Wait for all images to actually download before animating
        const grid = gallery.querySelector('.photos-grid');
        const images = grid.querySelectorAll('img');

        waitForImagesToLoad(images).then(() => {
            // Remove the loading state restrictions
            grid.classList.remove('is-loading');
            // Kick off your IntersectionObserver animations safely
            setupAnimations();
        });
    }
}

// Helper function to track image loading states
function waitForImagesToLoad(images) {
    const promises = Array.from(images).map(img => {
        return new Promise((resolve) => {
            // If image is already cached/loaded by the browser
            if (img.complete) {
                resolve();
            } else {
                img.onload = () => resolve();
                img.onerror = () => resolve(); // Resolve anyway so one broken image doesn't break the gallery
            }
        });
    });
    return Promise.all(promises);
}

// Helper function to track image loading states
function waitForImagesToLoad(images) {
    const promises = Array.from(images).map(img => {
        return new Promise((resolve) => {
            // If image is already cached/loaded by the browser
            if (img.complete) {
                resolve();
            } else {
                img.onload = () => resolve();
                img.onerror = () => resolve(); // Resolve anyway so one broken image doesn't break the gallery
            }
        });
    });
    return Promise.all(promises);
}

// Lightbox functionality with arrow navigation
function openLightbox(photoIndex) {
    if (currentPhotos.length === 0 || photoIndex < 0 || photoIndex >= currentPhotos.length) {
        return;
    }

    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox active';
    const imageUrl = currentPhotos[photoIndex].url;
    
    lightbox.innerHTML = `
        <span class="lightbox-nav prev" onclick="navigateLightbox(-1)">&lt;</span>
        <div class="lightbox-content">
            <span class="lightbox-close" onclick="this.closest('.lightbox').remove()">&times;</span>
            <img src="${imageUrl}" alt="Full size" class="lightbox-image">
            ${currentPhotos.length > 1 ? `
                <span class="lightbox-counter">${photoIndex + 1} / ${currentPhotos.length}</span>
                ` : ''}
                </div>
        <span class="lightbox-nav next" onclick="navigateLightbox(1)">&gt;</span>
    `;
    document.body.appendChild(lightbox);

    // Store current index in lightbox element
    lightbox.dataset.currentIndex = photoIndex;

    // Close on background click
    lightbox.onclick = (e) => {
        if (e.target === lightbox) lightbox.remove();
    };
}

document.addEventListener('keydown', handleKeyDown);

function handleKeyDown(e) {
    const lb = document.querySelector('.lightbox.active');
    if (!lb) return;

    if (e.key === 'Escape') {
        lb.remove();
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateLightbox(-1);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateLightbox(1);
    }
}

function navigateLightbox(direction) {
    const lightbox = document.querySelector('.lightbox.active');
    if (!lightbox) return;

    let currentIndex = parseInt(lightbox.dataset.currentIndex);
    let newIndex = currentIndex + direction;

    if (newIndex < 0) {
        newIndex = currentPhotos.length - 1;
    } else if (newIndex >= currentPhotos.length) {
        newIndex = 0;
    }

    const newImageUrl = currentPhotos[newIndex].url;
    const img = lightbox.querySelector('.lightbox-image');
    const counter = lightbox.querySelector('.lightbox-counter');
    
    img.src = newImageUrl;
    lightbox.dataset.currentIndex = newIndex;
    
    if (counter) {
        counter.textContent = `${newIndex + 1} / ${currentPhotos.length}`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load landing and gallery on page load
window.addEventListener('DOMContentLoaded', async () => {
    await loadLandingSection();
    await loadGallery();
});

const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    },
    {
        threshold: 0
    }
);

function setupAnimations() {
    document.querySelectorAll('.gallery-item').forEach((item) => {
        observer.observe(item);
    });
}
