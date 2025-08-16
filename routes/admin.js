// routes/admin.js
const express = require('express');
const router = express.Router();
const {
  obtenerDashboard,
  obtenerMiRestaurante,
  obtenerMisRestaurantes,
  crearRestaurante,
  actualizarRestaurante,
  actualizarInformacionBasica,
  actualizarDireccion,
  actualizarHorarios,
  actualizarMenu,
  actualizarRedesSociales,
  cambiarEstadoRestaurante,
  eliminarRestaurante
} = require('../controllers/adminController');

const { verificarToken, verificarPropietario } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(verificarToken);

// ===== AGREGAR ESTAS RUTAS A TU routes/admin.js =====
// Insertar después de: router.use(verificarToken);

// @route   GET /api/admin/my-restaurant
// @desc    Obtener MI restaurante (individual)
// @access  Privado
router.get('/my-restaurant', adminController.obtenerMiRestaurante);

// @route   PATCH /api/admin/my-restaurant/basic-info
// @desc    Actualizar información básica de MI restaurante
// @access  Privado
router.patch('/my-restaurant/basic-info', sanitizarDatos, adminController.actualizarInformacionBasica);

// @route   PATCH /api/admin/my-restaurant/address
// @desc    Actualizar dirección de MI restaurante
// @access  Privado
router.patch('/my-restaurant/address', sanitizarDatos, adminController.actualizarDireccion);

// @route   PATCH /api/admin/my-restaurant/schedule
// @desc    Actualizar horarios de MI restaurante
// @access  Privado
router.patch('/my-restaurant/schedule', sanitizarDatos, adminController.actualizarHorarios);

// @route   PATCH /api/admin/my-restaurant/menu
// @desc    Actualizar menú de MI restaurante
// @access  Privado
router.patch('/my-restaurant/menu', sanitizarDatos, adminController.actualizarMenu);

// @route   PATCH /api/admin/my-restaurant/social-media
// @desc    Actualizar redes sociales de MI restaurante
// @access  Privado
router.patch('/my-restaurant/social-media', sanitizarDatos, adminController.actualizarRedesSociales);


// ===== RUTAS DEL DASHBOARD =====
router.get('/dashboard', obtenerDashboard);

// ===== RUTAS DE MI RESTAURANTE (INDIVIDUAL) =====
router.get('/my-restaurant', obtenerMiRestaurante);

// Actualizar información específica de MI restaurante
router.patch('/my-restaurant/basic-info', actualizarInformacionBasica);
router.patch('/my-restaurant/address', actualizarDireccion);
router.patch('/my-restaurant/schedule', actualizarHorarios);
router.patch('/my-restaurant/menu', actualizarMenu);
router.patch('/my-restaurant/social-media', actualizarRedesSociales);

// ===== RUTAS DE RESTAURANTES (MÚLTIPLES) =====
router.get('/restaurants', obtenerMisRestaurantes);
router.post('/restaurants', crearRestaurante);

// Rutas con verificación de propietario
router.put('/restaurants/:id', verificarPropietario, actualizarRestaurante);
router.patch('/restaurants/:id/toggle-status', verificarPropietario, cambiarEstadoRestaurante);
router.delete('/restaurants/:id', verificarPropietario, eliminarRestaurante);

module.exports = router;