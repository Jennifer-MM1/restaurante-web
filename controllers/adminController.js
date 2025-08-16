const Restaurant = require('../models/Restaurant');
const Admin = require('../models/Admin');

// @desc    Obtener estadísticas del dashboard
// @route   GET /api/admin/dashboard
// @access  Privado
const obtenerDashboard = async (req, res) => {
  try {
    // Obtener estadísticas reales
    const totalRestaurantes = await Restaurant.countDocuments({ adminId: req.admin.id });
    const restaurantesActivos = await Restaurant.countDocuments({ adminId: req.admin.id, activo: true });
    const restaurantesInactivos = await Restaurant.countDocuments({ adminId: req.admin.id, activo: false });

    res.json({
      success: true,
      message: 'Dashboard cargado exitosamente',
      data: {
        resumen: {
          totalRestaurantes,
          restaurantesActivos,
          restaurantesInactivos
        },
        admin: {
          id: req.admin.id,
          nombre: req.admin.nombre,
          apellido: req.admin.apellido,
          email: req.admin.email,
          rol: req.admin.rol
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Obtener MI restaurante (individual)
// @route   GET /api/admin/my-restaurant
// @access  Privado
const obtenerMiRestaurante = async (req, res) => {
  try {
    console.log('🔍 Buscando restaurante para admin:', req.admin.id);
    
    const restaurant = await Restaurant.findOne({ 
      adminId: req.admin.id, 
      activo: true 
    }).populate('adminId', 'nombre apellido email telefono');
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró establecimiento asociado a este administrador'
      });
    }
    
    console.log('✅ Restaurante encontrado:', restaurant.nombre);
    
    res.json({
      success: true,
      data: restaurant
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al obtener establecimiento',
      error: error.message
    });
  }
};

// @desc    Obtener mis restaurantes (lista)
// @route   GET /api/admin/restaurants
// @access  Privado
const obtenerMisRestaurantes = async (req, res) => {
  try {
    const restaurantes = await Restaurant.find({ adminId: req.admin.id })
      .populate('adminId', 'nombre apellido email')
      .sort({ fechaCreacion: -1 });

    res.json({
      success: true,
      message: 'Mis restaurantes obtenidos exitosamente',
      data: {
        restaurantes,
        total: restaurantes.length
      }
    });
  } catch (error) {
    console.error('Error obteniendo mis restaurantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Actualizar información básica de MI restaurante
// @route   PATCH /api/admin/my-restaurant/basic-info
// @access  Privado
const actualizarInformacionBasica = async (req, res) => {
  try {
    const { nombre, descripcion, telefono, email } = req.body;
    
    // Validar campos requeridos
    if (!nombre || !descripcion || !telefono || !email) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos'
      });
    }
    
    const restaurant = await Restaurant.findOneAndUpdate(
      { adminId: req.admin.id, activo: true },
      {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        telefono: telefono.trim(),
        email: email.toLowerCase().trim(),
        fechaActualizacion: new Date()
      },
      { new: true, runValidators: true }
    ).populate('adminId', 'nombre apellido email telefono');
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Establecimiento no encontrado'
      });
    }
    
    console.log('✅ Información básica actualizada:', restaurant.nombre);
    
    res.json({
      success: true,
      message: 'Información básica actualizada exitosamente',
      data: restaurant
    });
    
  } catch (error) {
    console.error('❌ Error actualizando información básica:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error del servidor',
      error: error.message
    });
  }
};

// @desc    Actualizar dirección de MI restaurante
// @route   PATCH /api/admin/my-restaurant/address
// @access  Privado
const actualizarDireccion = async (req, res) => {
  try {
    const { direccion } = req.body;
    
    if (!direccion || !direccion.calle || !direccion.ciudad || !direccion.codigoPostal) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos de dirección son requeridos'
      });
    }
    
    const restaurant = await Restaurant.findOneAndUpdate(
      { adminId: req.admin.id, activo: true },
      {
        direccion: {
          calle: direccion.calle.trim(),
          ciudad: direccion.ciudad.trim(),
          codigoPostal: direccion.codigoPostal.trim()
        },
        fechaActualizacion: new Date()
      },
      { new: true, runValidators: true }
    ).populate('adminId', 'nombre apellido email telefono');
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Establecimiento no encontrado'
      });
    }
    
    console.log('✅ Dirección actualizada:', restaurant.nombre);
    
    res.json({
      success: true,
      message: 'Dirección actualizada exitosamente',
      data: restaurant
    });
    
  } catch (error) {
    console.error('❌ Error actualizando dirección:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor',
      error: error.message
    });
  }
};

// @desc    Actualizar horarios de MI restaurante
// @route   PATCH /api/admin/my-restaurant/schedule
// @access  Privado
const actualizarHorarios = async (req, res) => {
  try {
    const { horarios } = req.body;
    
    if (!horarios) {
      return res.status(400).json({
        success: false,
        message: 'Los horarios son requeridos'
      });
    }
    
    // Validar estructura de horarios
    const diasValidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const horariosValidos = {};
    
    diasValidos.forEach(dia => {
      if (horarios[dia]) {
        horariosValidos[dia] = {
          apertura: horarios[dia].apertura || '',
          cierre: horarios[dia].cierre || ''
        };
      }
    });
    
    const restaurant = await Restaurant.findOneAndUpdate(
      { adminId: req.admin.id, activo: true },
      {
        horarios: horariosValidos,
        fechaActualizacion: new Date()
      },
      { new: true, runValidators: true }
    ).populate('adminId', 'nombre apellido email telefono');
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Establecimiento no encontrado'
      });
    }
    
    console.log('✅ Horarios actualizados:', restaurant.nombre);
    
    res.json({
      success: true,
      message: 'Horarios actualizados exitosamente',
      data: restaurant
    });
    
  } catch (error) {
    console.error('❌ Error actualizando horarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor',
      error: error.message
    });
  }
};

// @desc    Actualizar menú de MI restaurante
// @route   PATCH /api/admin/my-restaurant/menu
// @access  Privado
const actualizarMenu = async (req, res) => {
  try {
    const { menu } = req.body;
    
    if (!menu || !Array.isArray(menu)) {
      return res.status(400).json({
        success: false,
        message: 'El menú debe ser un array válido'
      });
    }
    
    // Validar estructura del menú
    for (const categoria of menu) {
      if (!categoria.categoria || !categoria.items || !Array.isArray(categoria.items)) {
        return res.status(400).json({
          success: false,
          message: 'Estructura de menú inválida'
        });
      }
      
      for (const item of categoria.items) {
        if (!item.nombre || typeof item.precio !== 'number' || item.precio < 0) {
          return res.status(400).json({
            success: false,
            message: 'Cada item del menú debe tener nombre y precio válido'
          });
        }
      }
    }
    
    const restaurant = await Restaurant.findOneAndUpdate(
      { adminId: req.admin.id, activo: true },
      {
        menu: menu,
        fechaActualizacion: new Date()
      },
      { new: true, runValidators: true }
    ).populate('adminId', 'nombre apellido email telefono');
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Establecimiento no encontrado'
      });
    }
    
    console.log('✅ Menú actualizado:', restaurant.nombre);
    
    res.json({
      success: true,
      message: 'Menú actualizado exitosamente',
      data: restaurant
    });
    
  } catch (error) {
    console.error('❌ Error actualizando menú:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor',
      error: error.message
    });
  }
};

// @desc    Actualizar redes sociales de MI restaurante
// @route   PATCH /api/admin/my-restaurant/social-media
// @access  Privado
const actualizarRedesSociales = async (req, res) => {
  try {
    const { redes } = req.body;
    
    if (!redes) {
      return res.status(400).json({
        success: false,
        message: 'Los datos de redes sociales son requeridos'
      });
    }
    
    // Validar URLs si se proporcionan
    const redesActualizadas = {};
    
    if (redes.facebook) {
      if (redes.facebook.trim() !== '') {
        try {
          new URL(redes.facebook);
          redesActualizadas.facebook = redes.facebook.trim();
        } catch {
          return res.status(400).json({
            success: false,
            message: 'La URL de Facebook no es válida'
          });
        }
      }
    }
    
    if (redes.website) {
      if (redes.website.trim() !== '') {
        try {
          new URL(redes.website);
          redesActualizadas.website = redes.website.trim();
        } catch {
          return res.status(400).json({
            success: false,
            message: 'La URL del website no es válida'
          });
        }
      }
    }
    
    if (redes.instagram) {
      redesActualizadas.instagram = redes.instagram.trim();
    }
    
    if (redes.twitter) {
      redesActualizadas.twitter = redes.twitter.trim();
    }
    
    const restaurant = await Restaurant.findOneAndUpdate(
      { adminId: req.admin.id, activo: true },
      {
        redes: redesActualizadas,
        fechaActualizacion: new Date()
      },
      { new: true, runValidators: true }
    ).populate('adminId', 'nombre apellido email telefono');
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Establecimiento no encontrado'
      });
    }
    
    console.log('✅ Redes sociales actualizadas:', restaurant.nombre);
    
    res.json({
      success: true,
      message: 'Redes sociales actualizadas exitosamente',
      data: restaurant
    });
    
  } catch (error) {
    console.error('❌ Error actualizando redes sociales:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor',
      error: error.message
    });
  }
};

// @desc    Crear nuevo restaurante
// @route   POST /api/admin/restaurants
// @access  Privado
const crearRestaurante = async (req, res) => {
  try {
    const { nombre, tipo, descripcion, direccion, telefono, email, horarios, menu, redes } = req.body;

    // Validar campos requeridos
    if (!nombre || !tipo || !descripcion || !direccion || !telefono || !email) {
      return res.status(400).json({
        success: false,
        message: 'Los campos básicos son requeridos'
      });
    }

    // Verificar que el admin no tenga ya un restaurante activo
    const restauranteExistente = await Restaurant.findOne({ 
      adminId: req.admin.id, 
      activo: true 
    });

    if (restauranteExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya tienes un restaurante activo. Solo puedes tener uno por cuenta.'
      });
    }

    // Crear restaurante
    const restaurant = await Restaurant.create({
      nombre,
      tipo,
      descripcion,
      direccion,
      telefono,
      email,
      horarios: horarios || {},
      menu: menu || [],
      redes: redes || {},
      adminId: req.admin.id
    });

    const restaurantPopulated = await Restaurant.findById(restaurant._id)
      .populate('adminId', 'nombre apellido email telefono');

    res.status(201).json({
      success: true,
      message: 'Restaurante creado exitosamente',
      data: restaurantPopulated
    });

  } catch (error) {
    console.error('Error creando restaurante:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Actualizar restaurante completo
// @route   PUT /api/admin/restaurants/:id
// @access  Privado
const actualizarRestaurante = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Verificar que el restaurante pertenece al admin
    const restaurant = await Restaurant.findOne({ 
      _id: id, 
      adminId: req.admin.id 
    });
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado o no tienes permisos'
      });
    }
    
    // Campos permitidos para actualizar
    const allowedUpdates = [
      'nombre', 'descripcion', 'telefono', 'email', 'direccion', 
      'horarios', 'menu', 'redes'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });
    
    // Agregar fecha de actualización
    updates.fechaActualizacion = new Date();
    
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('adminId', 'nombre apellido email telefono');
    
    res.json({
      success: true,
      message: 'Restaurante actualizado exitosamente',
      data: updatedRestaurant
    });
    
  } catch (error) {
    console.error('Error actualizando restaurante:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Cambiar estado de restaurante
// @route   PATCH /api/admin/restaurants/:id/toggle-status
// @access  Privado
const cambiarEstadoRestaurante = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el restaurante pertenece al admin
    const restaurant = await Restaurant.findOne({ 
      _id: id, 
      adminId: req.admin.id 
    });
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado o no tienes permisos'
      });
    }
    
    // Cambiar estado
    restaurant.activo = !restaurant.activo;
    restaurant.fechaActualizacion = new Date();
    await restaurant.save();
    
    res.json({
      success: true,
      message: `Restaurante ${restaurant.activo ? 'activado' : 'desactivado'} exitosamente`,
      data: restaurant
    });
    
  } catch (error) {
    console.error('Error cambiando estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Eliminar restaurante (desactivar)
// @route   DELETE /api/admin/restaurants/:id
// @access  Privado
const eliminarRestaurante = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el restaurante pertenece al admin
    const restaurant = await Restaurant.findOne({ 
      _id: id, 
      adminId: req.admin.id 
    });
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado o no tienes permisos'
      });
    }
    
    // En lugar de eliminar, desactivar
    restaurant.activo = false;
    restaurant.fechaActualizacion = new Date();
    await restaurant.save();
    
    res.json({
      success: true,
      message: 'Restaurante eliminado exitosamente',
      data: restaurant
    });
    
  } catch (error) {
    console.error('Error eliminando restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// IMPORTANTE: Exportar todas las funciones
// CAMBIAR EL module.exports POR ESTE:
module.exports = {
  obtenerDashboard,
  obtenerMiRestaurante,           // ← NUEVA
  obtenerMisRestaurantes,
  crearRestaurante,
  actualizarRestaurante,
  actualizarMenu,
  actualizarInformacionBasica,    // ← NUEVA
  actualizarDireccion,           // ← NUEVA
  actualizarHorarios,            // ← NUEVA
  actualizarRedesSociales,       // ← NUEVA
  cambiarEstadoRestaurante,
  eliminarRestaurante
};