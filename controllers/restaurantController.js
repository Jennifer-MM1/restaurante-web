// ===== CONTROLLERS/restaurantController.js =====
const Restaurant = require('../models/Restaurant');

// @desc    Obtener todos los restaurantes (público) con filtros y paginación
// @route   GET /api/restaurants
// @access  Público
const obtenerRestaurantes = async (req, res) => {
  try {
    const { 
      pagina = 1, 
      limite = 12, 
      tipo, 
      ciudad, 
      buscar,
      ordenar = 'fechaCreacion',
      direccion = 'desc'
    } = req.query;

    // Construir filtros
    const filtros = { activo: true };
    
    if (tipo && ['restaurante', 'bar', 'cafeteria'].includes(tipo)) {
      filtros.tipo = tipo;
    }
    
    if (ciudad) {
      filtros['direccion.ciudad'] = { $regex: ciudad, $options: 'i' };
    }
    
    if (buscar) {
      filtros.$or = [
        { nombre: { $regex: buscar, $options: 'i' } },
        { descripcion: { $regex: buscar, $options: 'i' } }
      ];
    }

    // Configurar ordenamiento
    const sortOptions = {};
    sortOptions[ordenar] = direccion === 'desc' ? -1 : 1;

    // Calcular skip
    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    // Ejecutar consultas en paralelo
    const [restaurantes, total] = await Promise.all([
      Restaurant.find(filtros)
        .populate('adminId', 'nombre apellido email telefono')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limite))
        .lean(), // Mejor performance
      Restaurant.countDocuments(filtros)
    ]);

    // Estadísticas adicionales
    const estadisticas = await Restaurant.aggregate([
      { $match: { activo: true } },
      { $group: { _id: '$tipo', count: { $sum: 1 } } }
    ]);

    const totalPaginas = Math.ceil(total / parseInt(limite));

    res.json({
      success: true,
      message: 'Restaurantes obtenidos exitosamente',
      data: {
        restaurantes: restaurantes.map(restaurant => ({
          id: restaurant._id,
          nombre: restaurant.nombre,
          tipo: restaurant.tipo,
          descripcion: restaurant.descripcion,
          direccion: restaurant.direccion,
          telefono: restaurant.telefono,
          email: restaurant.email,
          horarios: restaurant.horarios,
          menu: restaurant.menu,
          imagenes: restaurant.imagenes,
          redes: restaurant.redes,
          admin: restaurant.adminId,
          fechaCreacion: restaurant.fechaCreacion,
          fechaActualizacion: restaurant.fechaActualizacion
        })),
        pagination: {
          total,
          pagina: parseInt(pagina),
          limite: parseInt(limite),
          totalPaginas,
          hasNext: parseInt(pagina) < totalPaginas,
          hasPrev: parseInt(pagina) > 1
        },
        filtros: {
          tipo,
          ciudad,
          buscar,
          ordenar,
          direccion
        },
        estadisticas: estadisticas.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Error obteniendo restaurantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Obtener restaurante por ID con información completa
// @route   GET /api/restaurants/:id
// @access  Público
const obtenerRestaurantePorId = async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findOne({ 
      _id: id, 
      activo: true 
    }).populate('adminId', 'nombre apellido email telefono');

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Restaurante obtenido exitosamente',
      data: {
        restaurant: {
          id: restaurant._id,
          nombre: restaurant.nombre,
          tipo: restaurant.tipo,
          descripcion: restaurant.descripcion,
          direccion: restaurant.direccion,
          telefono: restaurant.telefono,
          email: restaurant.email,
          horarios: restaurant.horarios,
          menu: restaurant.menu,
          imagenes: restaurant.imagenes,
          redes: restaurant.redes,
          admin: restaurant.adminId,
          fechaCreacion: restaurant.fechaCreacion,
          fechaActualizacion: restaurant.fechaActualizacion
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Obtener restaurantes por tipo
// @route   GET /api/restaurants/tipo/:tipo
// @access  Público
const obtenerRestaurantesPorTipo = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { pagina = 1, limite = 12 } = req.query;

    if (!['restaurante', 'bar', 'cafeteria'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de establecimiento no válido'
      });
    }

    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const [restaurantes, total] = await Promise.all([
      Restaurant.find({ tipo, activo: true })
        .populate('adminId', 'nombre apellido')
        .sort({ fechaCreacion: -1 })
        .skip(skip)
        .limit(parseInt(limite))
        .lean(),
      Restaurant.countDocuments({ tipo, activo: true })
    ]);

    const totalPaginas = Math.ceil(total / parseInt(limite));

    res.json({
      success: true,
      message: `Restaurantes de tipo: ${tipo}`,
      data: {
        tipo,
        restaurantes,
        pagination: {
          total,
          pagina: parseInt(pagina),
          limite: parseInt(limite),
          totalPaginas,
          hasNext: parseInt(pagina) < totalPaginas,
          hasPrev: parseInt(pagina) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo restaurantes por tipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Buscar restaurantes
// @route   GET /api/restaurants/search/:termino
// @access  Público
const buscarRestaurantes = async (req, res) => {
  try {
    const { termino } = req.params;
    const { pagina = 1, limite = 12, tipo, ciudad } = req.query;

    if (!termino || termino.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Término de búsqueda requerido'
      });
    }

    // Construir filtros de búsqueda
    const filtros = {
      activo: true,
      $or: [
        { nombre: { $regex: termino, $options: 'i' } },
        { descripcion: { $regex: termino, $options: 'i' } },
        { 'direccion.ciudad': { $regex: termino, $options: 'i' } }
      ]
    };

    if (tipo) filtros.tipo = tipo;
    if (ciudad) filtros['direccion.ciudad'] = { $regex: ciudad, $options: 'i' };

    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const [restaurantes, total] = await Promise.all([
      Restaurant.find(filtros)
        .populate('adminId', 'nombre apellido')
        .sort({ fechaCreacion: -1 })
        .skip(skip)
        .limit(parseInt(limite))
        .lean(),
      Restaurant.countDocuments(filtros)
    ]);

    const totalPaginas = Math.ceil(total / parseInt(limite));

    res.json({
      success: true,
      message: `Búsqueda: "${termino}" - ${total} resultados`,
      data: {
        termino,
        restaurantes,
        pagination: {
          total,
          pagina: parseInt(pagina),
          limite: parseInt(limite),
          totalPaginas,
          hasNext: parseInt(pagina) < totalPaginas,
          hasPrev: parseInt(pagina) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error buscando restaurantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Obtener estadísticas públicas
// @route   GET /api/restaurants/stats
// @access  Público
const obtenerEstadisticas = async (req, res) => {
  try {
    const estadisticas = await Restaurant.aggregate([
      { $match: { activo: true } },
      {
        $group: {
          _id: null,
          totalRestaurantes: { $sum: 1 },
          tipoRestaurante: {
            $sum: { $cond: [{ $eq: ['$tipo', 'restaurante'] }, 1, 0] }
          },
          tipoBares: {
            $sum: { $cond: [{ $eq: ['$tipo', 'bar'] }, 1, 0] }
          },
          tipoCafeterias: {
            $sum: { $cond: [{ $eq: ['$tipo', 'cafeteria'] }, 1, 0] }
          }
        }
      }
    ]);

    const ciudades = await Restaurant.aggregate([
      { $match: { activo: true } },
      { $group: { _id: '$direccion.ciudad', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const recientes = await Restaurant.find({ activo: true })
      .sort({ fechaCreacion: -1 })
      .limit(5)
      .select('nombre tipo direccion.ciudad fechaCreacion')
      .lean();

    res.json({
      success: true,
      message: 'Estadísticas obtenidas exitosamente',
      data: {
        general: estadisticas[0] || {
          totalRestaurantes: 0,
          tipoRestaurante: 0,
          tipoBares: 0,
          tipoCafeterias: 0
        },
        ciudadesPopulares: ciudades,
        recientes
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Obtener restaurantes recientes (últimos 24h)
// @route   GET /api/restaurants/recent
// @access  Público
const obtenerRestaurantesRecientes = async (req, res) => {
  try {
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const restaurantesRecientes = await Restaurant.find({
      activo: true,
      fechaCreacion: { $gte: hace24h }
    })
    .populate('adminId', 'nombre apellido')
    .sort({ fechaCreacion: -1 })
    .limit(10)
    .lean();

    res.json({
      success: true,
      message: 'Restaurantes recientes obtenidos',
      data: {
        restaurantes: restaurantesRecientes,
        total: restaurantesRecientes.length,
        periodo: '24 horas'
      }
    });

  } catch (error) {
    console.error('Error obteniendo restaurantes recientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Obtener restaurantes actualizados recientemente
// @route   GET /api/restaurants/updated
// @access  Público
const obtenerRestaurantesActualizados = async (req, res) => {
  try {
    const hace1h = new Date(Date.now() - 60 * 60 * 1000);
    
    const restaurantesActualizados = await Restaurant.find({
      activo: true,
      fechaActualizacion: { $gte: hace1h },
      fechaCreacion: { $lt: hace1h } // Excluir los recién creados
    })
    .populate('adminId', 'nombre apellido')
    .sort({ fechaActualizacion: -1 })
    .limit(10)
    .lean();

    res.json({
      success: true,
      message: 'Restaurantes actualizados obtenidos',
      data: {
        restaurantes: restaurantesActualizados,
        total: restaurantesActualizados.length,
        periodo: '1 hora'
      }
    });

  } catch (error) {
    console.error('Error obteniendo restaurantes actualizados:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  obtenerRestaurantes,
  obtenerRestaurantePorId,
  obtenerRestaurantesPorTipo,
  buscarRestaurantes,
  obtenerEstadisticas,
  obtenerRestaurantesRecientes,
  obtenerRestaurantesActualizados
};