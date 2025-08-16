const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');

// @route   GET /api/restaurants
// @desc    Obtener todos los restaurantes con filtros y paginación
// @access  Público
router.get('/', restaurantController.obtenerRestaurantes);

// @route   GET /api/restaurants/stats
// @desc    Obtener estadísticas públicas
// @access  Público
router.get('/stats', restaurantController.obtenerEstadisticas);

// @route   GET /api/restaurants/tipo/:tipo
// @desc    Obtener restaurantes por tipo (restaurante, bar, cafeteria)
// @access  Público
router.get('/tipo/:tipo', restaurantController.obtenerRestaurantesPorTipo);

// @route   GET /api/restaurants/search/:termino
// @desc    Buscar restaurantes por nombre, descripción o ciudad
// @access  Público
router.get('/search/:termino', restaurantController.buscarRestaurantes);

// @route   GET /api/restaurants/:id
// @desc    Obtener un restaurante específico por ID
// @access  Público
// NOTA: Esta ruta debe ir al final para evitar conflictos con otras rutas
router.get('/:id', restaurantController.obtenerRestaurantePorId);

module.exports = router;