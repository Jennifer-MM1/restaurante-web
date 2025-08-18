// ===== VARIABLES GLOBALES =====
let currentPage = 1;
let currentFilter = 'todos';
let currentSearch = '';
let isLoading = false;

// ===== ELEMENTOS DEL DOM =====
const elements = {
    // Navegación
    navToggle: document.getElementById('nav-toggle'),
    navMenu: document.getElementById('nav-menu'),
    navLinks: document.querySelectorAll('.nav-link'),
    
    // Búsqueda
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    
    // Filtros
    filterTabs: document.querySelectorAll('.filter-tab'),
    
    // Resultados
    loading: document.getElementById('loading'),
    resultsGrid: document.getElementById('results-grid'),
    resultsCount: document.getElementById('results-count'),
    emptyState: document.getElementById('empty-state'),
    
    // Estadísticas
    totalCount: document.getElementById('total-count'),
    restaurantCount: document.getElementById('restaurant-count'),
    barCount: document.getElementById('bar-count'),
    cafeCount: document.getElementById('cafe-count'),
    
    // Paginación
    pagination: document.getElementById('pagination'),
    paginationInfo: document.getElementById('pagination-info'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    
    // Modal
    modal: document.getElementById('restaurant-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalClose: document.getElementById('modal-close')
};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    setupMobileMenu(); // ← FUNCIÓN DEL MENÚ MÓVIL INTEGRADA
    loadStatistics();
    loadRestaurants();
    updateActiveNavLink();
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Navegación móvil ya se maneja en setupMobileMenu()
    
    // Búsqueda
    if (elements.searchInput) {
        elements.searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    if (elements.searchBtn) {
        elements.searchBtn.addEventListener('click', performSearch);
    }
    
    // Filtros
    elements.filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const filter = this.dataset.filter;
            setActiveFilter(filter);
            loadRestaurants();
        });
    });
    
    // Modal
    if (elements.modalClose) {
        elements.modalClose.addEventListener('click', closeModal);
    }
    
    if (elements.modal) {
        elements.modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }
    
    // Paginación
    if (elements.prevBtn) {
        elements.prevBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                loadRestaurants();
            }
        });
    }
    
    if (elements.nextBtn) {
        elements.nextBtn.addEventListener('click', function() {
            currentPage++;
            loadRestaurants();
        });
    }
    
    // Tecla Escape para cerrar modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && elements.modal && elements.modal.style.display === 'block') {
            closeModal();
        }
    });
}

// ===== 🍔 JAVASCRIPT PARA MENÚ MÓVIL =====
function setupMobileMenu() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    
    if (!navToggle || !navMenu) {
        console.warn('⚠️ Elementos del menú móvil no encontrados');
        console.log('nav-toggle:', navToggle);
        console.log('nav-menu:', navMenu);
        return;
    }
    
    console.log('✅ Menú móvil inicializado correctamente');
    
    // Toggle del menú
    navToggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const isActive = navMenu.classList.contains('active');
        
        if (isActive) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
        
        console.log('🍔 Menú toggled:', !isActive ? 'abierto' : 'cerrado');
    });
    
    // Cerrar menú al hacer click en un enlace
    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            console.log('🔗 Link clickeado, cerrando menú');
            closeMobileMenu();
        });
    });
    
    // Cerrar menú al hacer click fuera
    document.addEventListener('click', function(e) {
        if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
            if (navMenu.classList.contains('active')) {
                console.log('👆 Click fuera del menú, cerrando');
                closeMobileMenu();
            }
        }
    });
    
    // Cerrar menú con tecla Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && navMenu.classList.contains('active')) {
            console.log('⌨️ Escape presionado, cerrando menú');
            closeMobileMenu();
        }
    });
    
    // Cerrar menú al redimensionar ventana
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && navMenu.classList.contains('active')) {
            console.log('📱 Pantalla redimensionada, cerrando menú');
            closeMobileMenu();
        }
    });
    
    function openMobileMenu() {
        navMenu.classList.add('active');
        updateMenuIcon(true);
    }
    
    function closeMobileMenu() {
        navMenu.classList.remove('active');
        updateMenuIcon(false);
    }
    
    function updateMenuIcon(isOpen) {
        const icon = navToggle.querySelector('i');
        if (icon) {
            if (isOpen) {
                icon.className = 'fas fa-times';
                navToggle.setAttribute('aria-label', 'Cerrar menú');
            } else {
                icon.className = 'fas fa-bars';
                navToggle.setAttribute('aria-label', 'Abrir menú');
            }
        }
    }
}

// ===== FUNCIONES DE RESTAURANTES (TU CÓDIGO EXISTENTE) =====

// ===== main.js - Función actualizada para mostrar restaurantes =====
function createRestaurantCard(restaurant) {
    const typeIcon = getTypeIcon(restaurant.tipo);
    const statusIcon = restaurant.activo ? 
        '<i class="fas fa-check-circle" style="color: var(--success);"></i>' : 
        '<i class="fas fa-times-circle" style="color: var(--error);"></i>';
    
    // 🖼️ GESTIÓN DE IMÁGENES ACTUALIZADA
    let imageContent = '';
    if (restaurant.imagenes && restaurant.imagenes.length > 0) {
        const mainImage = restaurant.imagenes[0];
        // Verificar que la imagen tenga URL válida
        if (mainImage.url) {
            imageContent = `
                <img 
                    src="${mainImage.url}" 
                    alt="${restaurant.nombre}"
                    style="width: 100%; height: 100%; object-fit: cover;"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                >
                <div style="display: none; align-items: center; justify-content: center; height: 100%; background: var(--gray-100);">
                    <i class="${typeIcon}" style="font-size: 2rem; color: var(--gray-400);"></i>
                </div>
            `;
        } else {
            // Fallback si no hay URL válida
            imageContent = `<i class="${typeIcon}"></i>`;
        }
    } else {
        // Sin imágenes, mostrar icono
        imageContent = `<i class="${typeIcon}"></i>`;
    }
    
    return `
        <div class="restaurant-card" data-id="${restaurant._id || restaurant.id}">
            <div class="card-image">
                ${imageContent}
            </div>
            <div class="card-content">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${restaurant.nombre}</h3>
                        <span class="card-type ${restaurant.tipo}">
                            <i class="${typeIcon}"></i>
                            ${capitalizeFirst(restaurant.tipo)}
                        </span>
                    </div>
                    ${statusIcon}
                </div>
                <p class="card-description">${restaurant.descripcion}</p>
                <div class="card-info">
                    <div class="info-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${restaurant.direccion?.ciudad || 'Ciudad no especificada'}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-phone"></i>
                        <span>${formatPhone(restaurant.telefono)}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-envelope"></i>
                        <span>${restaurant.email}</span>
                    </div>
                    ${restaurant.imagenes && restaurant.imagenes.length > 0 ? `
                    <div class="info-item">
                        <i class="fas fa-images"></i>
                        <span>${restaurant.imagenes.length} imagen(es)</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// ===== FUNCIÓN PARA MOSTRAR DETALLES CON GALERÍA DE IMÁGENES =====
function displayRestaurantDetails(restaurant) {
    if (!elements.modalBody) return;
    
    const typeIcon = getTypeIcon(restaurant.tipo);
    
    // 🖼️ CREAR GALERÍA DE IMÁGENES
    let galleryHtml = '';
    if (restaurant.imagenes && restaurant.imagenes.length > 0) {
        galleryHtml = `
            <div class="detail-section">
                <h4><i class="fas fa-images"></i> Galería de Imágenes</h4>
                <div class="image-gallery">
                    ${restaurant.imagenes.map((imagen, index) => `
                        <div class="gallery-item ${index === 0 ? 'main-image' : ''}">
                            <img 
                                src="${imagen.url}" 
                                alt="${restaurant.nombre} - Imagen ${index + 1}"
                                onclick="openImageModal('${imagen.url}', '${restaurant.nombre}')"
                                onerror="this.parentElement.style.display='none'"
                            >
                            ${index === 0 ? '<span class="main-badge">Principal</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    elements.modalBody.innerHTML = `
        <div class="restaurant-details">
            <div class="detail-header">
                <h2>${restaurant.nombre}</h2>
                <span class="card-type ${restaurant.tipo}">
                    <i class="${typeIcon}"></i>
                    ${capitalizeFirst(restaurant.tipo)}
                </span>
            </div>
            
            ${galleryHtml}
            
            <div class="detail-section">
                <h4><i class="fas fa-info-circle"></i> Descripción</h4>
                <p>${restaurant.descripcion}</p>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-map-marker-alt"></i> Dirección</h4>
                <p>
                    ${restaurant.direccion?.calle || ''}<br>
                    ${restaurant.direccion?.ciudad || ''}, ${restaurant.direccion?.codigoPostal || ''}
                </p>
            </div>
            
            <div class="detail-section">
                <h4><i class="fas fa-phone"></i> Contacto</h4>
                <p>
                    <strong>Teléfono:</strong> ${formatPhone(restaurant.telefono)}<br>
                    <strong>Email:</strong> ${restaurant.email}
                </p>
            </div>
            
            ${restaurant.horarios ? displayHorarios(restaurant.horarios) : ''}
            
            ${restaurant.menu && restaurant.menu.length > 0 ? displayMenu(restaurant.menu) : ''}
            
            ${restaurant.redes ? displayRedesSociales(restaurant.redes) : ''}
        </div>
    `;
}

// ===== FUNCIÓN PARA ABRIR MODAL DE IMAGEN =====
function openImageModal(imageUrl, restaurantName) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="image-modal-content">
            <span class="image-modal-close">&times;</span>
            <img src="${imageUrl}" alt="${restaurantName}">
            <div class="image-modal-info">
                <h3>${restaurantName}</h3>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cerrar modal
    modal.querySelector('.image-modal-close').onclick = () => {
        document.body.removeChild(modal);
    };
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
}

// ===== FUNCIONES AUXILIARES =====
function getTypeIcon(tipo) {
    const icons = {
        'restaurante': 'fas fa-utensils',
        'bar': 'fas fa-cocktail',
        'cafeteria': 'fas fa-coffee'
    };
    return icons[tipo] || 'fas fa-store';
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatPhone(phone) {
    if (!phone) return 'No disponible';
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
}

// ===== FUNCIONES DE CARGA DE DATOS =====
async function loadStatistics() {
    // Tu código para cargar estadísticas
}

async function loadRestaurants() {
    // Tu código para cargar restaurantes
}

function updateActiveNavLink() {
    // Tu código para actualizar navegación activa
}

function performSearch() {
    // Tu código para realizar búsqueda
}

function setActiveFilter(filter) {
    // Tu código para filtros
}

function closeModal() {
    if (elements.modal) {
        elements.modal.style.display = 'none';
    }
}

function displayHorarios(horarios) {
    // Tu código para mostrar horarios
    return '';
}

function displayMenu(menu) {
    // Tu código para mostrar menú
    return '';
}

function displayRedesSociales(redes) {
    // Tu código para mostrar redes sociales
    return '';
}

// ===== 🐛 FUNCIÓN PARA DETECTAR OVERFLOW (DEBUGGING) =====
function detectOverflow() {
    console.log('🔍 Detectando elementos que causan overflow...');
    const elements = document.querySelectorAll('*');
    let problemElements = [];
    
    elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            console.log('❌ Elemento problemático:', el, 'Ancho:', rect.width, 'Right:', rect.right);
            el.style.border = '2px solid red';
            problemElements.push(el);
        }
    });
    
    if (problemElements.length === 0) {
        console.log('✅ No se encontraron elementos que causen overflow');
    } else {
        console.log(`❌ Se encontraron ${problemElements.length} elementos problemáticos`);
    }
    
    return problemElements;
}

// ===== 🔧 FUNCIÓN PARA DEBUG DEL MENÚ =====
function debugMenu() {
    console.log('🔍 DEBUG DEL MENÚ:');
    console.log('nav-toggle:', document.getElementById('nav-toggle'));
    console.log('nav-menu:', document.getElementById('nav-menu'));
    console.log('Ancho de pantalla:', window.innerWidth);
    console.log('Menú activo:', document.getElementById('nav-menu')?.classList.contains('active'));
    console.log('CSS aplicado al toggle:', getComputedStyle(document.getElementById('nav-toggle')).display);
    console.log('CSS aplicado al menu:', getComputedStyle(document.getElementById('nav-menu')).transform);
}