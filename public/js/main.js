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