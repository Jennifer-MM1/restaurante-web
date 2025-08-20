// ===== JAVASCRIPT CORREGIDO PARA MENÚ MÓVIL =====

// Variables globales para el menú - NUEVA IMPLEMENTACIÓN
let menuState = {
    isOpen: false,
    elements: {
        toggle: null,
        menu: null,
        overlay: null
    },
    initialized: false
};

// ===== FUNCIÓN PRINCIPAL CORREGIDA =====
function setupMobileMenu() {
    console.log('🔧 Configurando menú móvil corregido...');
    
    // Prevenir múltiples inicializaciones
    if (menuState.initialized) {
        console.log('⚠️ Menú ya inicializado');
        return;
    }
    
    // Buscar elementos
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    
    if (!navToggle) {
        console.error('❌ No se encontró #nav-toggle');
        return;
    }
    
    if (!navMenu) {
        console.error('❌ No se encontró #nav-menu');
        return;
    }
    
    // Guardar referencias
    menuState.elements.toggle = navToggle;
    menuState.elements.menu = navMenu;
    
    // Crear overlay
    createMenuOverlay();
    
    // Limpiar eventos anteriores
    cleanupMenuEvents();
    
    // Configurar nuevos eventos
    setupMenuEvents();
    
    // Marcar como inicializado
    menuState.initialized = true;
    
    console.log('✅ Menú móvil configurado correctamente');
    console.log('📱 Elementos:', menuState.elements);
}

// Crear overlay
function createMenuOverlay() {
    // Eliminar overlay existente
    const existingOverlay = document.querySelector('.nav-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Crear nuevo overlay
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    overlay.id = 'nav-overlay';
    document.body.appendChild(overlay);
    
    menuState.elements.overlay = overlay;
    console.log('✅ Overlay creado');
}

// Limpiar eventos anteriores
function cleanupMenuEvents() {
    const { toggle } = menuState.elements;
    
    if (toggle) {
        // Clonar elemento para remover todos los event listeners
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        menuState.elements.toggle = newToggle;
        console.log('🧹 Eventos anteriores limpiados');
    }
}

// Configurar eventos del menú
function setupMenuEvents() {
    const { toggle, menu, overlay } = menuState.elements;
    
    // Evento principal del toggle
    toggle.addEventListener('click', handleMenuToggle);
    
    // Eventos del menú
    menu.addEventListener('click', handleMenuClick);
    
    // Evento del overlay
    if (overlay) {
        overlay.addEventListener('click', handleOverlayClick);
    }
    
    // Eventos globales
    document.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('resize', handleWindowResize);
    
    console.log('✅ Eventos configurados');
}

// ===== MANEJADORES DE EVENTOS =====

function handleMenuToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🍔 Toggle clicked, estado actual:', menuState.isOpen);
    
    if (menuState.isOpen) {
        closeMenu();
    } else {
        openMenu();
    }
}

function handleMenuClick(e) {
    // Solo cerrar si es un enlace de navegación
    if (e.target.classList.contains('nav-link')) {
        console.log('🔗 Nav link clicked');
        
        // Pequeño delay para la animación
        setTimeout(() => {
            closeMenu();
        }, 150);
    }
}

function handleOverlayClick(e) {
    console.log('👆 Overlay clicked');
    closeMenu();
}

function handleGlobalKeydown(e) {
    if (e.key === 'Escape' && menuState.isOpen) {
        console.log('⌨️ Escape pressed');
        closeMenu();
    }
}

function handleWindowResize() {
    if (window.innerWidth > 768 && menuState.isOpen) {
        console.log('📱 Window resized, closing menu');
        closeMenu();
    }
}

// ===== FUNCIONES DE CONTROL DEL MENÚ =====

function openMenu() {
    console.log('🔓 Abriendo menú...');
    
    const { menu, overlay } = menuState.elements;
    
    // Cambiar estado
    menuState.isOpen = true;
    
    // Agregar clases con un pequeño delay para asegurar la animación
    requestAnimationFrame(() => {
        menu.classList.add('active');
        if (overlay) {
            overlay.classList.add('active');
        }
        
        // Prevenir scroll del body
        document.body.style.overflow = 'hidden';
        
        // Actualizar icono
        updateMenuIcon();
        
        console.log('📂 Menú abierto - clases aplicadas');
    });
}

function closeMenu() {
    console.log('🔒 Cerrando menú...');
    
    const { menu, overlay } = menuState.elements;
    
    // Cambiar estado
    menuState.isOpen = false;
    
    // Remover clases
    menu.classList.remove('active');
    if (overlay) {
        overlay.classList.remove('active');
    }
    
    // Restaurar scroll del body
    document.body.style.overflow = '';
    
    // Actualizar icono
    updateMenuIcon();
    
    console.log('📁 Menú cerrado - clases removidas');
}

function updateMenuIcon() {
    const { toggle } = menuState.elements;
    const icon = toggle.querySelector('i');
    
    if (icon) {
        if (menuState.isOpen) {
            icon.className = 'fas fa-times';
            toggle.setAttribute('aria-label', 'Cerrar menú');
            toggle.setAttribute('aria-expanded', 'true');
        } else {
            icon.className = 'fas fa-bars';
            toggle.setAttribute('aria-label', 'Abrir menú');
            toggle.setAttribute('aria-expanded', 'false');
        }
        
        console.log('🔄 Icono actualizado:', menuState.isOpen ? 'X' : '☰');
    }
}

// ===== FUNCIONES DE DEBUG =====
function debugMenu() {
    console.log('🔍 DEBUG MENÚ COMPLETO:');
    console.log('📊 Estado del menú:', menuState);
    console.log('📱 Ancho de ventana:', window.innerWidth);
    console.log('🔘 Toggle element:', menuState.elements.toggle);
    console.log('📋 Menu element:', menuState.elements.menu);
    console.log('🫥 Overlay element:', menuState.elements.overlay);
    
    if (menuState.elements.toggle) {
        console.log('👁️ Toggle visible:', getComputedStyle(menuState.elements.toggle).display);
    }
    
    if (menuState.elements.menu) {
        console.log('📂 Menu active:', menuState.elements.menu.classList.contains('active'));
        console.log('🎨 Menu styles:', {
            transform: getComputedStyle(menuState.elements.menu).transform,
            opacity: getComputedStyle(menuState.elements.menu).opacity,
            visibility: getComputedStyle(menuState.elements.menu).visibility
        });
    }
}

function forceCloseMenu() {
    console.log('🚨 Forzando cierre del menú...');
    menuState.isOpen = false;
    
    const menu = document.getElementById('nav-menu');
    const overlay = document.querySelector('.nav-overlay');
    
    if (menu) menu.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    
    document.body.style.overflow = '';
    updateMenuIcon();
    
    console.log('✅ Menú forzado a cerrar');
}

function forceOpenMenu() {
    console.log('🚨 Forzando apertura del menú...');
    menuState.isOpen = true;
    
    const menu = document.getElementById('nav-menu');
    const overlay = document.querySelector('.nav-overlay');
    
    if (menu) menu.classList.add('active');
    if (overlay) overlay.classList.add('active');
    
    document.body.style.overflow = 'hidden';
    updateMenuIcon();
    
    console.log('✅ Menú forzado a abrir');
}

// Hacer funciones disponibles globalmente para debug
window.debugMenu = debugMenu;
window.forceCloseMenu = forceCloseMenu;
window.forceOpenMenu = forceOpenMenu;
window.menuState = menuState;

// ===== INICIALIZACIÓN MEJORADA =====

// Reemplazar tu DOMContentLoaded existente con este:
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, inicializando...');
    
    // Configurar menú móvil PRIMERO
    setupMobileMenu();
    
    // Pequeño delay para asegurar que todo esté listo
    setTimeout(() => {
        // Tu inicialización existente
        initializeApp();
    }, 100);
});

function initializeApp() {
    console.log('🏁 Inicializando aplicación principal...');
    
    // Tu código existente sin setupMobileMenu()
    setupEventListeners(); // SIN navegación móvil
    loadStatistics();
    loadRestaurants();
    updateActiveNavLink();
}

// Event listeners originales SIN navegación móvil
function setupEventListeners() {
    // NO incluir navegación móvil aquí
    
    // Búsqueda
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
    
    // Resto de tus event listeners...
    console.log('✅ Event listeners principales configurados');
}

console.log('📱 Script de menú móvil cargado');