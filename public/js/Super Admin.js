/* ===== SUPER ADMIN PANEL JAVASCRIPT ===== */

const API_BASE = window.location.origin + '/api';
let currentUser = null;
let charts = {};
let monitoringInterval = null;
let refreshIntervals = {
    monitoring: null,
    sessions: null,
    activities: null
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
});

// ===== AUTHENTICATION =====
async function checkAuth() {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        showNotification('No has iniciado sesión', 'error');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
        return;
    }

    try {
        // Simulate API call for now - replace with real endpoint
        currentUser = {
            nombre: 'Super',
            apellido: 'Admin',
            rol: 'super-admin',
            id: 'super-admin-001'
        };
        
        updateUserInterface();
        loadDashboard();
        showNotification(`¡Bienvenido Super Admin ${currentUser.nombre}!`, 'success');
    } catch (error) {
        console.error('Error verificando auth:', error);
        showNotification('Error de autenticación', 'error');
    }
}

function updateUserInterface() {
    if (!currentUser) return;

    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');
    const userAvatar = document.getElementById('user-avatar');

    if (userName) {
        userName.textContent = `${currentUser.nombre} ${currentUser.apellido}`;
    }
    
    if (userRole) {
        userRole.textContent = currentUser.rol;
    }
    
    if (userAvatar) {
        const initials = (currentUser.nombre?.charAt(0) || '') + (currentUser.apellido?.charAt(0) || '');
        userAvatar.textContent = initials.toUpperCase();
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            switchTab(tabId);
        });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Search inputs
    document.getElementById('admin-search').addEventListener('input', debounce(searchAdmins, 500));
    document.getElementById('restaurant-search').addEventListener('input', debounce(searchRestaurants, 500));
    document.getElementById('restaurant-filter').addEventListener('change', searchRestaurants);

    // Notification form
    document.getElementById('notification-form').addEventListener('submit', sendNotification);
}

// ===== TAB NAVIGATION =====
function switchTab(tabId) {
    clearAllIntervals();

    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    // Load tab content
    switch(tabId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'monitoring':
            loadMonitoring();
            break;
        case 'admins':
            loadAdmins();
            break;
        case 'restaurants':
            loadRestaurants();
            break;
        case 'notifications':
            loadNotificationHistory();
            break;
        case 'stats':
            loadAdvancedStats();
            break;
    }
}

// ===== DASHBOARD FUNCTIONS =====
async function loadDashboard() {
    try {
        setTimeout(() => {
            const mockData = {
                resumen: {
                    totalAdmins: 45,
                    adminActivos: 38,
                    totalRestaurantes: 127,
                    restaurantesActivos: 119
                },
                estadisticasTipo: {
                    restaurante: 75,
                    bar: 35,
                    cafeteria: 17
                }
            };
            renderDashboard(mockData);
        }, 1000);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Error cargando dashboard', 'error');
    } finally {
        document.getElementById('dashboard-loading').style.display = 'none';
        document.getElementById('dashboard-content').style.display = 'block';
    }
}

function renderDashboard(data) {
    const statsContainer = document.getElementById('dashboard-stats');
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-title">Total Administradores</div>
                <div class="stat-icon primary">
                    <i class="fas fa-users"></i>
                </div>
            </div>
            <div class="stat-value">${data.resumen.totalAdmins}</div>
            <div class="stat-change">
                <i class="fas fa-check-circle"></i>
                <span>${data.resumen.adminActivos} activos</span>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-title">Total Restaurantes</div>
                <div class="stat-icon success">
                    <i class="fas fa-store"></i>
                </div>
            </div>
            <div class="stat-value">${data.resumen.totalRestaurantes}</div>
            <div class="stat-change">
                <i class="fas fa-check-circle"></i>
                <span>${data.resumen.restaurantesActivos} activos</span>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-title">Super Admins</div>
                <div class="stat-icon warning">
                    <i class="fas fa-crown"></i>
                </div>
            </div>
            <div class="stat-value">3</div>
            <div class="stat-change">
                <i class="fas fa-shield-alt"></i>
                <span>Privilegios especiales</span>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-title">Estado del Sistema</div>
                <div class="stat-icon info">
                    <i class="fas fa-server"></i>
                </div>
            </div>
            <div class="stat-value" style="font-size: 1.5rem;">Óptimo</div>
            <div class="stat-change">
                <i class="fas fa-check"></i>
                <span>Todo funcionando</span>
            </div>
        </div>
    `;

    createDashboardCharts(data);
}

function createDashboardCharts(data) {
    // Growth Chart
    const growthCtx = document.getElementById('growthChart');
    if (growthCtx && charts.growthChart) {
        charts.growthChart.destroy();
    }

    charts.growthChart = new Chart(growthCtx, {
        type: 'line',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
            datasets: [{
                label: 'Restaurantes',
                data: [12, 19, 25, 31, 28, 35],
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                tension: 0.4
            }, {
                label: 'Administradores',
                data: [8, 12, 15, 18, 16, 20],
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Type Distribution Chart
    const typeCtx = document.getElementById('typeChart');
    if (typeCtx && charts.typeChart) {
        charts.typeChart.destroy();
    }

    const typeData = data.estadisticasTipo || {};
    charts.typeChart = new Chart(typeCtx, {
        type: 'doughnut',
        data: {
            labels: ['Restaurantes', 'Bares', 'Cafeterías'],
            datasets: [{
                data: [
                    typeData.restaurante || 0,
                    typeData.bar || 0,
                    typeData.cafeteria || 0
                ],
                backgroundColor: ['#059669', '#22c55e', '#f59e0b'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

// ===== MONITORING FUNCTIONS =====
function loadMonitoring() {
    loadMonitoringStats();
    loadOnlineUsers();
    loadRecentActivities();
    loadActiveSessions();

    // Set up auto-refresh for monitoring tab
    refreshIntervals.monitoring = setInterval(() => {
        loadMonitoringStats();
        loadOnlineUsers();
        loadRecentActivities();
    }, 30000); // Refresh every 30 seconds
}

function loadMonitoringStats() {
    // Simulate real-time data
    const totalVisits = Math.floor(Math.random() * 10000) + 50000;
    const visitsToday = Math.floor(Math.random() * 500) + 1200;
    const adminsOnline = Math.floor(Math.random() * 8) + 2;
    const uptimeHours = Math.floor(Math.random() * 100) + 720;

    document.getElementById('total-visits').textContent = totalVisits.toLocaleString();
    document.getElementById('visits-today').textContent = `${visitsToday} hoy`;
    document.getElementById('admins-online').textContent = adminsOnline;
    document.getElementById('uptime-hours').textContent = `${uptimeHours} horas activo`;

    // Top restaurant (mock data)
    const topRestaurants = ['La Bella Vista', 'El Rincón Dorado', 'Café Central', 'Burger Palace'];
    const randomRestaurant = topRestaurants[Math.floor(Math.random() * topRestaurants.length)];
    const restaurantVisits = Math.floor(Math.random() * 200) + 300;
    
    document.getElementById('top-restaurant').textContent = randomRestaurant;
    document.getElementById('top-restaurant-visits').textContent = `${restaurantVisits} visitas`;
}

function loadOnlineUsers() {
    const mockUsers = [
        { nombre: 'Ana', apellido: 'García', status: 'Editando menú', lastSeen: '2 min' },
        { nombre: 'Carlos', apellido: 'López', status: 'Revisando pedidos', lastSeen: '5 min' },
        { nombre: 'María', apellido: 'Rodríguez', status: 'Actualizando horarios', lastSeen: '1 min' },
        { nombre: 'Pedro', apellido: 'Martínez', status: 'Conectado', lastSeen: 'Ahora' },
        { nombre: 'Laura', apellido: 'Sánchez', status: 'Subiendo fotos', lastSeen: '3 min' }
    ];

    const onlineUsersHtml = mockUsers.map(user => `
        <div class="user-item">
            <div class="user-avatar-small">
                ${user.nombre.charAt(0)}${user.apellido.charAt(0)}
            </div>
            <div class="user-details">
                <div class="user-details-name">${user.nombre} ${user.apellido}</div>
                <div class="user-details-status">${user.status} • ${user.lastSeen}</div>
            </div>
            <div class="online-indicator"></div>
        </div>
    `).join('');

    document.getElementById('online-users-list').innerHTML = onlineUsersHtml;
    document.getElementById('online-count').textContent = mockUsers.length;
}

function loadRecentActivities() {
    const activities = [
        { user: 'Ana García', action: 'actualizó el menú', time: '2 min', type: 'success' },
        { user: 'Carlos López', action: 'cambió horarios', time: '5 min', type: 'info' },
        { user: 'María Rodríguez', action: 'subió nueva foto', time: '8 min', type: 'primary' },
        { user: 'Pedro Martínez', action: 'inició sesión', time: '12 min', type: 'success' },
        { user: 'Laura Sánchez', action: 'editó información', time: '15 min', type: 'warning' },
        { user: 'Jorge Ruiz', action: 'cerró sesión', time: '18 min', type: 'error' }
    ];

    const activitiesHtml = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${activity.type}">
                <i class="fas fa-${activity.type === 'success' ? 'check' : 
                                   activity.type === 'info' ? 'info' :
                                   activity.type === 'warning' ? 'exclamation' :
                                   activity.type === 'error' ? 'times' : 'user'}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-text">
                    <strong>${activity.user}</strong> ${activity.action}
                </div>
                <div class="activity-time">hace ${activity.time}</div>
            </div>
        </div>
    `).join('');

    document.getElementById('activity-list').innerHTML = activitiesHtml;
}

function loadActiveSessions() {
    const mockSessions = [
        { user: 'Ana García', ip: '192.168.1.100', device: 'Chrome - Windows', lastActivity: '2 min', location: 'Ciudad de México' },
        { user: 'Carlos López', ip: '192.168.1.101', device: 'Firefox - MacOS', lastActivity: '5 min', location: 'Guadalajara' },
        { user: 'María Rodríguez', ip: '192.168.1.102', device: 'Safari - iOS', lastActivity: '1 min', location: 'Monterrey' },
        { user: 'Pedro Martínez', ip: '192.168.1.103', device: 'Chrome - Android', lastActivity: '10 min', location: 'Puebla' }
    ];

    const sessionsHtml = `
        <table class="table">
            <thead>
                <tr>
                    <th>Usuario</th>
                    <th>IP</th>
                    <th>Dispositivo</th>
                    <th>Última Actividad</th>
                    <th>Ubicación</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${mockSessions.map(session => `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div class="user-avatar-small">${session.user.split(' ').map(n => n.charAt(0)).join('')}</div>
                                ${session.user}
                            </div>
                        </td>
                        <td><code>${session.ip}</code></td>
                        <td>${session.device}</td>
                        <td>hace ${session.lastActivity}</td>
                        <td>${session.location}</td>
                        <td>
                            <button class="btn btn-sm btn-danger" onclick="terminateSession('${session.user}')" title="Terminar sesión">
                                <i class="fas fa-sign-out-alt"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('sessions-table-container').innerHTML = sessionsHtml;
}

function terminateSession(userName) {
    const confirmed = confirm(`¿Terminar la sesión de ${userName}?`);
    if (confirmed) {
        showNotification(`Sesión de ${userName} terminada`, 'success');
        loadActiveSessions(); // Refresh the sessions table
    }
}

function refreshSessions() {
    document.getElementById('sessions-table-container').innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Actualizando sesiones...</p>
        </div>
    `;
    setTimeout(loadActiveSessions, 1000);
}

// ===== ADMINS MANAGEMENT =====
function loadAdmins() {
    setTimeout(() => {
        const mockAdmins = [
            { nombre: 'Ana', apellido: 'García', email: 'ana@email.com', telefono: '555-0101', rol: 'admin', activo: true, ultimoAcceso: new Date() },
            { nombre: 'Carlos', apellido: 'López', email: 'carlos@email.com', telefono: '555-0102', rol: 'admin', activo: true, ultimoAcceso: new Date() },
            { nombre: 'María', apellido: 'Rodríguez', email: 'maria@email.com', telefono: '555-0103', rol: 'super-admin', activo: true, ultimoAcceso: new Date() }
        ];
        renderAdminsTable({ admins: mockAdmins });
    }, 1000);
}

function renderAdminsTable(data) {
    const container = document.getElementById('admins-table-container');
    
    const tableHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Último Acceso</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${data.admins.map(admin => `
                    <tr>
                        <td>${admin.nombre} ${admin.apellido}</td>
                        <td>${admin.email}</td>
                        <td>${admin.telefono}</td>
                        <td>
                            <span class="badge ${admin.rol === 'super-admin' ? 'badge-primary' : 'badge-success'}">
                                ${admin.rol === 'super-admin' ? '👑 Super Admin' : '👤 Admin'}
                            </span>
                        </td>
                        <td>
                            <span class="badge ${admin.activo ? 'badge-success' : 'badge-error'}">
                                ${admin.activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                        <td>${new Date(admin.ultimoAcceso).toLocaleDateString('es-ES')}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-primary" onclick="editAdmin('${admin._id}')" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm ${admin.activo ? 'btn-warning' : 'btn-success'}" onclick="toggleAdminStatus('${admin._id}', ${admin.activo})" title="${admin.activo ? 'Desactivar' : 'Activar'}">
                                    <i class="fas fa-${admin.activo ? 'ban' : 'check'}"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteAdmin('${admin._id}', '${admin.nombre} ${admin.apellido}')" title="Eliminar">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = tableHTML;
}

// ===== RESTAURANTS MANAGEMENT =====
function loadRestaurants() {
    setTimeout(() => {
        const mockRestaurants = [
            { nombre: 'La Bella Vista', tipo: 'restaurante', direccion: { ciudad: 'CDMX' }, adminId: { nombre: 'Ana', apellido: 'García', email: 'ana@email.com' }, activo: true, fechaCreacion: new Date() },
            { nombre: 'Café Central', tipo: 'cafeteria', direccion: { ciudad: 'Guadalajara' }, adminId: { nombre: 'Carlos', apellido: 'López', email: 'carlos@email.com' }, activo: true, fechaCreacion: new Date() },
            { nombre: 'El Rincón Dorado', tipo: 'bar', direccion: { ciudad: 'Monterrey' }, adminId: { nombre: 'María', apellido: 'Rodríguez', email: 'maria@email.com' }, activo: false, fechaCreacion: new Date() }
        ];
        renderRestaurantsTable({ restaurantes: mockRestaurants });
    }, 1000);
}

function renderRestaurantsTable(data) {
    const container = document.getElementById('restaurants-table-container');
    
    const tableHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Ciudad</th>
                    <th>Administrador</th>
                    <th>Estado</th>
                    <th>Fecha Creación</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${data.restaurantes.map(restaurant => `
                    <tr>
                        <td>
                            <strong>${restaurant.nombre}</strong>
                        </td>
                        <td>
                            <span class="badge badge-primary">
                                ${restaurant.tipo}
                            </span>
                        </td>
                        <td>${restaurant.direccion?.ciudad || '-'}</td>
                        <td>
                            ${restaurant.adminId?.nombre} ${restaurant.adminId?.apellido}
                            <br>
                            <small class="text-gray-500">${restaurant.adminId?.email}</small>
                        </td>
                        <td>
                            <span class="badge ${restaurant.activo ? 'badge-success' : 'badge-error'}">
                                ${restaurant.activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                        <td>${new Date(restaurant.fechaCreacion).toLocaleDateString('es-ES')}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-sm ${restaurant.activo ? 'btn-warning' : 'btn-success'}" onclick="toggleRestaurantStatus('${restaurant._id}', ${restaurant.activo})" title="${restaurant.activo ? 'Desactivar' : 'Activar'}">
                                    <i class="fas fa-${restaurant.activo ? 'ban' : 'check'}"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteRestaurant('${restaurant._id}', '${restaurant.nombre}')" title="Eliminar">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = tableHTML;
}

// ===== NOTIFICATIONS SYSTEM =====
async function sendNotification(e) {
    e.preventDefault();
    
    const formData = {
        type: document.getElementById('notification-type').value,
        priority: document.getElementById('notification-priority').value,
        title: document.getElementById('notification-title').value,
        message: document.getElementById('notification-message').value,
        target: document.getElementById('notification-target').value
    };

    try {
        showNotification('Enviando notificación...', 'info');
        
        setTimeout(() => {
            showNotification(`Notificación enviada exitosamente a ${getTargetText(formData.target)}`, 'success');
            document.getElementById('notification-form').reset();
            loadNotificationHistory();
        }, 1500);
        
    } catch (error) {
        console.error('Error sending notification:', error);
        showNotification('Error enviando notificación', 'error');
    }
}

function getTargetText(target) {
    const targets = {
        'all': 'todos los administradores',
        'super-admins': 'los super administradores',
        'regular-admins': 'los administradores regulares',
        'online': 'los usuarios conectados'
    };
    return targets[target] || 'los destinatarios seleccionados';
}

function loadNotificationHistory() {
    const mockHistory = [
        { 
            title: 'Mantenimiento Programado', 
            type: 'maintenance', 
            priority: 'high', 
            target: 'all', 
            sent: new Date(Date.now() - 3600000),
            status: 'sent'
        },
        { 
            title: 'Nueva Función Disponible', 
            type: 'update', 
            priority: 'medium', 
            target: 'all', 
            sent: new Date(Date.now() - 86400000),
            status: 'sent'
        },
        { 
            title: 'Recordatorio de Backup', 
            type: 'warning', 
            priority: 'low', 
            target: 'super-admins', 
            sent: new Date(Date.now() - 172800000),
            status: 'sent'
        }
    ];

    const typeIcons = {
        'info': '📢',
        'warning': '⚠️',
        'success': '✅',
        'update': '🔄',
        'maintenance': '🛠️'
    };

    const priorityColors = {
        'high': 'badge-error',
        'medium': 'badge-warning',
        'low': 'badge-success'
    };

    const historyHtml = `
        <table class="table">
            <thead>
                <tr>
                    <th>Notificación</th>
                    <th>Tipo</th>
                    <th>Prioridad</th>
                    <th>Destinatarios</th>
                    <th>Enviado</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
                ${mockHistory.map(notification => `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span>${typeIcons[notification.type]}</span>
                                <strong>${notification.title}</strong>
                            </div>
                        </td>
                        <td>
                            <span class="badge badge-primary">${notification.type}</span>
                        </td>
                        <td>
                            <span class="badge ${priorityColors[notification.priority]}">${notification.priority}</span>
                        </td>
                        <td>${getTargetText(notification.target)}</td>
                        <td>${notification.sent.toLocaleString('es-ES')}</td>
                        <td>
                            <span class="badge badge-success">
                                <i class="fas fa-check"></i> Enviado
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('notification-history-container').innerHTML = historyHtml;
}

// ===== ADVANCED STATISTICS =====
async function loadAdvancedStats() {
    try {
        const mockData = await generateMockAdvancedStats();
        renderAdvancedStats(mockData);
        createAdvancedCharts(mockData);
    } catch (error) {
        console.error('Error loading advanced stats:', error);
        showNotification('Error cargando estadísticas avanzadas', 'error');
    } finally {
        document.getElementById('stats-loading').style.display = 'none';
        document.getElementById('stats-content').style.display = 'block';
    }
}

async function generateMockAdvancedStats() {
    return {
        performanceMetrics: {
            avgResponseTime: 245,
            uptime: 99.8,
            totalRequests: 15678,
            errorRate: 0.2
        },
        growthMetrics: {
            monthlyGrowthRate: 12.5,
            yearlyGrowthRate: 145.3,
            userRetention: 89.2,
            conversionRate: 34.7
        },
        geographicData: {
            'Ciudad de México': 45,
            'Guadalajara': 23,
            'Monterrey': 18,
            'Puebla': 12,
            'Otros': 15
        },
        monthlyActivity: [
            { month: 'Ene', admins: 5, restaurants: 12, activity: 85 },
            { month: 'Feb', admins: 8, restaurants: 18, activity: 92 },
            { month: 'Mar', admins: 12, restaurants: 25, activity: 88 },
            { month: 'Abr', admins: 15, restaurants: 31, activity: 95 },
            { month: 'May', admins: 18, restaurants: 28, activity: 91 },
            { month: 'Jun', admins: 22, restaurants: 35, activity: 97 }
        ],
        yearlyComparison: [
            { year: '2022', restaurants: 85, admins: 45, revenue: 125000 },
            { year: '2023', restaurants: 142, admins: 78, revenue: 289000 },
            { year: '2024', restaurants: 267, admins: 124, revenue: 456000 },
            { year: '2025', restaurants: 398, admins: 189, revenue: 678000 }
        ],
        hourlyActivity: [
            { hour: '00:00', activity: 12 },
            { hour: '03:00', activity: 8 },
            { hour: '06:00', activity: 25 },
            { hour: '09:00', activity: 78 },
            { hour: '12:00', activity: 95 },
            { hour: '15:00', activity: 87 },
            { hour: '18:00', activity: 92 },
            { hour: '21:00', activity: 65 }
        ],
        userTrends: [
            { period: 'Q1', newUsers: 45, activeUsers: 123, churned: 8 },
            { period: 'Q2', newUsers: 67, activeUsers: 156, churned: 12 },
            { period: 'Q3', newUsers: 89, activeUsers: 198, churned: 15 },
            { period: 'Q4', newUsers: 112, activeUsers: 245, churned: 18 }
        ]
    };
}

function renderAdvancedStats(data) {
    const container = document.getElementById('advanced-stats');
    
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-title">⚡ Tiempo de Respuesta Promedio</div>
                <div class="stat-icon success">
                    <i class="fas fa-tachometer-alt"></i>
                </div>
            </div>
            <div class="stat-value">${data.performanceMetrics.avgResponseTime}ms</div>
            <div class="stat-change">
                <i class="fas fa-arrow-down"></i>
                <span>15% mejor que el mes pasado</span>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-title">🟢 Tiempo de Actividad</div>
                <div class="stat-icon primary">
                    <i class="fas fa-server"></i>
                </div>
            </div>
            <div class="stat-value">${data.performanceMetrics.uptime}%</div>
            <div class="stat-change">
                <i class="fas fa-check-circle"></i>
                <span>Excelente estabilidad</span>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-title">📈 Crecimiento Mensual</div>
                <div class="stat-icon accent">
                    <i class="fas fa-chart-line"></i>
                </div>
            </div>
            <div class="stat-value">+${data.growthMetrics.monthlyGrowthRate}%</div>
            <div class="stat-change">
                <i class="fas fa-arrow-up"></i>
                <span>Superando objetivos</span>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-title">🎯 Retención de Usuarios</div>
                <div class="stat-icon warning">
                    <i class="fas fa-users"></i>
                </div>
            </div>
            <div class="stat-value">${data.growthMetrics.userRetention}%</div>
            <div class="stat-change">
                <i class="fas fa-heart"></i>
                <span>Alta satisfacción</span>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-title">🚀 Total de Solicitudes</div>
                <div class="stat-icon info">
                    <i class="fas fa-exchange-alt"></i>
                </div>
            </div>
            <div class="stat-value">${data.performanceMetrics.totalRequests.toLocaleString()}</div>
            <div class="stat-change">
                <i class="fas fa-fire"></i>
                <span>Alto tráfico</span>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-title">💯 Tasa de Conversión</div>
                <div class="stat-icon success">
                    <i class="fas fa-bullseye"></i>
                </div>
            </div>
            <div class="stat-value">${data.growthMetrics.conversionRate}%</div>
            <div class="stat-change">
                <i class="fas fa-trophy"></i>
                <span>Por encima del promedio</span>
            </div>
        </div>
    `;
}

function createAdvancedCharts(data) {
    // Monthly Activity Chart
    const monthlyCtx = document.getElementById('monthlyActivityChart');
    if (monthlyCtx && charts.monthlyActivityChart) {
        charts.monthlyActivityChart.destroy();
    }

    charts.monthlyActivityChart = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: data.monthlyActivity.map(item => item.month),
            datasets: [{
                label: 'Restaurantes',
                data: data.monthlyActivity.map(item => item.restaurants),
                backgroundColor: '#059669',
                borderRadius: 6
            }, {
                label: 'Administradores',
                data: data.monthlyActivity.map(item => item.admins),
                backgroundColor: '#22c55e',
                borderRadius: 6
            }, {
                label: 'Actividad (%)',
                data: data.monthlyActivity.map(item => item.activity),
                backgroundColor: '#84cc16',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Geographic Distribution Chart
    const geoCtx = document.getElementById('geographicChart');
    if (geoCtx && charts.geographicChart) {
        charts.geographicChart.destroy();
    }

    charts.geographicChart = new Chart(geoCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(data.geographicData),
            datasets: [{
                data: Object.values(data.geographicData),
                backgroundColor: [
                    '#059669',
                    '#22c55e',
                    '#84cc16',
                    '#f59e0b',
                    '#06b6d4'
                ],
                borderWidth: 3,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                }
            }
        }
    });

    // Yearly Growth Chart
    const yearlyCtx = document.getElementById('yearlyGrowthChart');
    if (yearlyCtx && charts.yearlyGrowthChart) {
        charts.yearlyGrowthChart.destroy();
    }

    charts.yearlyGrowthChart = new Chart(yearlyCtx, {
        type: 'line',
        data: {
            labels: data.yearlyComparison.map(item => item.year),
            datasets: [{
                label: 'Restaurantes',
                data: data.yearlyComparison.map(item => item.restaurants),
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Administradores',
                data: data.yearlyComparison.map(item => item.admins),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Ingresos (K)',
                data: data.yearlyComparison.map(item => item.revenue / 1000),
                borderColor: '#84cc16',
                backgroundColor: 'rgba(132, 204, 22, 0.1)',
                tension: 0.4,
                fill: true,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });

    // Hourly Activity Chart
    const hourlyCtx = document.getElementById('hourlyActivityChart');
    if (hourlyCtx && charts.hourlyActivityChart) {
        charts.hourlyActivityChart.destroy();
    }

    charts.hourlyActivityChart = new Chart(hourlyCtx, {
        type: 'radar',
        data: {
            labels: data.hourlyActivity.map(item => item.hour),
            datasets: [{
                label: 'Actividad por Hora',
                data: data.hourlyActivity.map(item => item.activity),
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.2)',
                pointBackgroundColor: '#22c55e',
                pointBorderColor: '#059669',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });

    // User Trends Chart
    const trendsCtx = document.getElementById('userTrendsChart');
    if (trendsCtx && charts.userTrendsChart) {
        charts.userTrendsChart.destroy();
    }

    charts.userTrendsChart = new Chart(trendsCtx, {
        type: 'line',
        data: {
            labels: data.userTrends.map(item => item.period),
            datasets: [{
                label: 'Nuevos Usuarios',
                data: data.userTrends.map(item => item.newUsers),
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                tension: 0.4
            }, {
                label: 'Usuarios Activos',
                data: data.userTrends.map(item => item.activeUsers),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4
            }, {
                label: 'Usuarios Perdidos',
                data: data.userTrends.map(item => item.churned),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// ===== MODAL FUNCTIONS =====
function openCreateAdminModal() {
    showCreateAdminModal();
}

function openCreateRestaurantModal() {
    showCreateRestaurantModal();
}

function showCreateAdminModal() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">👤 Crear Nuevo Administrador</h3>
                <button class="modal-close" onclick="closeModal(this)">&times;</button>
            </div>
            <div class="modal-body">
                <form id="create-admin-form" class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Nombre</label>
                        <input type="text" class="form-input" placeholder="Nombre del administrador" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Apellido</label>
                        <input type="text" class="form-input" placeholder="Apellidos" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" placeholder="email@ejemplo.com" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Teléfono</label>
                        <input type="tel" class="form-input" placeholder="555-0123" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Contraseña</label>
                        <input type="password" class="form-input" placeholder="Contraseña temporal" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Rol</label>
                        <select class="form-select" required>
                            <option value="">Seleccionar rol...</option>
                            <option value="admin">👤 Administrador</option>
                            <option value="super-admin">👑 Super Administrador</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal(this)">Cancelar</button>
                <button type="submit" form="create-admin-form" class="btn btn-primary" onclick="createAdmin(this)">
                    <i class="fas fa-user-plus"></i>
                    Crear Administrador
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function showCreateRestaurantModal() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">🏪 Crear Nuevo Restaurante</h3>
                <button class="modal-close" onclick="closeModal(this)">&times;</button>
            </div>
            <div class="modal-body">
                <form id="create-restaurant-form" class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Nombre del Restaurante</label>
                        <input type="text" class="form-input" placeholder="Nombre del establecimiento" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tipo</label>
                        <select class="form-select" required>
                            <option value="">Seleccionar tipo...</option>
                            <option value="restaurante">🍽️ Restaurante</option>
                            <option value="bar">🍺 Bar</option>
                            <option value="cafeteria">☕ Cafetería</option>
                            <option value="comida-rapida">🍔 Comida Rápida</option>
                            <option value="panaderia">🥖 Panadería</option>
                            <option value="otro">🏪 Otro</option>
                        </select>
                    </div>
                    <div class="form-group full-width">
                        <label class="form-label">Descripción</label>
                        <textarea class="form-textarea" placeholder="Descripción del restaurante..." required></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Administrador</label>
                        <select class="form-select" required>
                            <option value="">Seleccionar administrador...</option>
                            <option value="1">Ana García (ana@email.com)</option>
                            <option value="2">Carlos López (carlos@email.com)</option>
                            <option value="3">María Rodríguez (maria@email.com)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Teléfono</label>
                        <input type="tel" class="form-input" placeholder="555-0123" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" placeholder="restaurante@email.com" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ciudad</label>
                        <input type="text" class="form-input" placeholder="Ciudad, Estado" required>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal(this)">Cancelar</button>
                <button type="submit" form="create-restaurant-form" class="btn btn-success" onclick="createRestaurant(this)">
                    <i class="fas fa-store"></i>
                    Crear Restaurante
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeModal(element) {
    const modal = element.closest('.modal');
    modal.classList.remove('show');
    setTimeout(() => {
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
    }, 300);
}

function createAdmin(element) {
    const modal = element.closest('.modal');
    showNotification('Creando administrador...', 'info');
    
    setTimeout(() => {
        showNotification('¡Administrador creado exitosamente!', 'success');
        closeModal(element);
        loadAdmins();
    }, 1500);
}

function createRestaurant(element) {
    const modal = element.closest('.modal');
    showNotification('Creando restaurante...', 'info');
    
    setTimeout(() => {
        showNotification('¡Restaurante creado exitosamente!', 'success');
        closeModal(element);
        loadRestaurants();
    }, 1500);
}

// ===== SEARCH FUNCTIONS =====
function searchAdmins() {
    const searchTerm = document.getElementById('admin-search').value.toLowerCase();
    showNotification(`Buscando: "${searchTerm}"`, 'info');
    
    setTimeout(() => {
        const filteredAdmins = [
            { nombre: 'Ana', apellido: 'García', email: 'ana@email.com', telefono: '555-0101', rol: 'admin', activo: true, ultimoAcceso: new Date() }
        ].filter(admin => 
            admin.nombre.toLowerCase().includes(searchTerm) || 
            admin.apellido.toLowerCase().includes(searchTerm) ||
            admin.email.toLowerCase().includes(searchTerm)
        );
        
        if (filteredAdmins.length > 0) {
            renderAdminsTable({ admins: filteredAdmins });
            showNotification(`${filteredAdmins.length} administrador(es) encontrado(s)`, 'success');
        } else {
            document.getElementById('admins-table-container').innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--gray-500);">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>No se encontraron administradores que coincidan con "<strong>${searchTerm}</strong>"</p>
                </div>
            `;
            showNotification('No se encontraron resultados', 'warning');
        }
    }, 800);
}

function searchRestaurants() {
    const searchTerm = document.getElementById('restaurant-search').value.toLowerCase();
    const filterType = document.getElementById('restaurant-filter').value;
    
    let searchText = searchTerm ? `"${searchTerm}"` : 'todos los restaurantes';
    if (filterType) {
        searchText += ` del tipo "${filterType}"`;
    }
    
    showNotification(`Buscando: ${searchText}`, 'info');
    
    setTimeout(() => {
        let filteredRestaurants = [
            { nombre: 'La Bella Vista', tipo: 'restaurante', direccion: { ciudad: 'CDMX' }, adminId: { nombre: 'Ana', apellido: 'García', email: 'ana@email.com' }, activo: true, fechaCreacion: new Date() },
            { nombre: 'Café Central', tipo: 'cafeteria', direccion: { ciudad: 'Guadalajara' }, adminId: { nombre: 'Carlos', apellido: 'López', email: 'carlos@email.com' }, activo: true, fechaCreacion: new Date() }
        ];

        if (searchTerm) {
            filteredRestaurants = filteredRestaurants.filter(restaurant => 
                restaurant.nombre.toLowerCase().includes(searchTerm) ||
                restaurant.direccion.ciudad.toLowerCase().includes(searchTerm)
            );
        }

        if (filterType) {
            filteredRestaurants = filteredRestaurants.filter(restaurant => 
                restaurant.tipo === filterType
            );
        }
        
        if (filteredRestaurants.length > 0) {
            renderRestaurantsTable({ restaurantes: filteredRestaurants });
            showNotification(`${filteredRestaurants.length} restaurante(s) encontrado(s)`, 'success');
        } else {
            document.getElementById('restaurants-table-container').innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--gray-500);">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>No se encontraron restaurantes que coincidan con los filtros seleccionados</p>
                </div>
            `;
            showNotification('No se encontraron resultados', 'warning');
        }
    }, 800);
}

// ===== ACTION FUNCTIONS =====
function toggleAdminStatus(adminId, currentStatus) {
    const action = currentStatus ? 'desactivar' : 'activar';
    const confirmed = confirm(`¿Estás seguro de que quieres ${action} este administrador?`);
    
    if (confirmed) {
        showNotification(`${action.charAt(0).toUpperCase() + action.slice(1)}ando administrador...`, 'info');
        
        setTimeout(() => {
            showNotification(`Administrador ${action}do exitosamente`, 'success');
            loadAdmins();
        }, 1500);
    }
}

function editAdmin(adminId) {
    showNotification('Abriendo editor de administrador...', 'info');
    setTimeout(() => {
        showNotification('Función de edición en desarrollo', 'warning');
    }, 1000);
}

function deleteAdmin(adminId, adminName) {
    const confirmed = confirm(`¿Estás seguro de que quieres eliminar al administrador "${adminName}"?\n\n⚠️ Esta acción no se puede deshacer.`);
    
    if (confirmed) {
        showNotification('Eliminando administrador...', 'info');
        
        setTimeout(() => {
            showNotification(`Administrador "${adminName}" eliminado exitosamente`, 'success');
            loadAdmins();
        }, 1500);
    }
}

function toggleRestaurantStatus(restaurantId, currentStatus) {
    const action = currentStatus ? 'desactivar' : 'activar';
    const confirmed = confirm(`¿Estás seguro de que quieres ${action} este restaurante?`);
    
    if (confirmed) {
        showNotification(`${action.charAt(0).toUpperCase() + action.slice(1)}ando restaurante...`, 'info');
        
        setTimeout(() => {
            showNotification(`Restaurante ${action}do exitosamente`, 'success');
            loadRestaurants();
        }, 1500);
    }
}

function deleteRestaurant(restaurantId, restaurantName) {
    const confirmed = confirm(`¿Estás seguro de que quieres eliminar el restaurante "${restaurantName}"?\n\n⚠️ Esta acción eliminará también todas las imágenes y datos asociados.`);
    
    if (confirmed) {
        showNotification('Eliminando restaurante...', 'info');
        
        setTimeout(() => {
            showNotification(`Restaurante "${restaurantName}" eliminado exitosamente`, 'success');
            loadRestaurants();
        }, 1500);
    }
}

// ===== UTILITY FUNCTIONS =====
function clearAllIntervals() {
    Object.values(refreshIntervals).forEach(interval => {
        if (interval) clearInterval(interval);
    });
    refreshIntervals = { monitoring: null, sessions: null, activities: null };
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                type === 'error' ? 'fa-exclamation-circle' : 
                type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span class="notification-message">${message}</span>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 5000);
    
    notification.querySelector('.notification-close').onclick = () => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    };
}

function logout() {
    const confirmed = confirm('¿Estás seguro de que quieres cerrar sesión?');
    
    if (confirmed) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        showNotification('Sesión cerrada correctamente', 'info');
        
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1000);
    }
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        switchTab('monitoring');
        showNotification('Atajo de teclado: Monitoreo activado', 'info');
    }
    
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        switchTab('notifications');
        showNotification('Atajo de teclado: Notificaciones activadas', 'info');
    }
    
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        switchTab('stats');
        showNotification('Atajo de teclado: Estadísticas activadas', 'info');
    }
});

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => {
    clearAllIntervals();
});

// ===== CONSOLE WELCOME MESSAGE =====
console.log(`
🎉 Super Admin Panel Cargado Exitosamente!

🔗 Atajos de Teclado:
• Ctrl+Shift+M: Monitoreo
• Ctrl+Shift+N: Notificaciones  
• Ctrl+Shift+S: Estadísticas

🛠️ Funcionalidades Disponibles:
• Monitoreo en tiempo real
• Gestión de administradores
• Control de restaurantes
• Sistema de notificaciones
• Estadísticas avanzadas

📧 Soporte: soporte@restauranteweb.com
`);