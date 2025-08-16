const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Generar JWT
const generarToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// @desc    Registrar nuevo administrador
// @route   POST /api/auth/register
// @access  Público
const registrarAdmin = async (req, res) => {
  try {
    const { nombre, apellido, email, password, telefono } = req.body;

    // Verificar campos requeridos
    if (!nombre || !apellido || !email || !password || !telefono) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
    }

    // Verificar si el email ya existe
    const adminExistente = await Admin.findOne({ email });
    if (adminExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un administrador con este email'
      });
    }

    // Crear nuevo admin
    const admin = await Admin.create({
      nombre,
      apellido,
      email,
      password,
      telefono
    });

    // Generar token
    const token = generarToken(admin._id);

    res.status(201).json({
      success: true,
      message: 'Administrador registrado exitosamente',
      data: {
        admin: {
          id: admin._id,
          nombre: admin.nombre,
          apellido: admin.apellido,
          email: admin.email,
          telefono: admin.telefono,
          rol: admin.rol
        },
        token
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    
    // Manejar errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      const errores = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errores
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Login de administrador
// @route   POST /api/auth/login
// @access  Público
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verificar campos
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son obligatorios'
      });
    }

    // Buscar admin por email (incluir password)
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const passwordValida = await admin.compararPassword(password);
    if (!passwordValida) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar que esté activo
    if (!admin.activo) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta inactiva. Contacta al administrador'
      });
    }

    // Actualizar último acceso
    admin.actualizarUltimoAcceso();

    // Generar token
    const token = generarToken(admin._id);

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        admin: {
          id: admin._id,
          nombre: admin.nombre,
          apellido: admin.apellido,
          email: admin.email,
          telefono: admin.telefono,
          rol: admin.rol,
          ultimoAcceso: admin.ultimoAcceso
        },
        token
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Obtener perfil del admin logueado
// @route   GET /api/auth/profile
// @access  Privado
const obtenerPerfil = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    
    res.json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          nombre: admin.nombre,
          apellido: admin.apellido,
          email: admin.email,
          telefono: admin.telefono,
          rol: admin.rol,
          fechaCreacion: admin.fechaCreacion,
          ultimoAcceso: admin.ultimoAcceso,
          configuracion: admin.configuracion
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Actualizar perfil
// @route   PUT /api/auth/profile
// @access  Privado
const actualizarPerfil = async (req, res) => {
  try {
    const { nombre, apellido, telefono, configuracion } = req.body;

    const admin = await Admin.findByIdAndUpdate(
      req.admin.id,
      {
        ...(nombre && { nombre }),
        ...(apellido && { apellido }),
        ...(telefono && { telefono }),
        ...(configuracion && { configuracion })
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: { admin }
    });

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Cambiar contraseña
// @route   PUT /api/auth/change-password
// @access  Privado
const cambiarPassword = async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual y nueva son obligatorias'
      });
    }

    // Obtener admin con contraseña
    const admin = await Admin.findById(req.admin.id).select('+password');

    // Verificar contraseña actual
    const passwordValida = await admin.compararPassword(passwordActual);
    if (!passwordValida) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      });
    }

    // Actualizar contraseña
    admin.password = passwordNueva;
    await admin.save();

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Privado
const logout = async (req, res) => {
  res.json({
    success: true,
    message: 'Sesión cerrada exitosamente'
  });
};

module.exports = {
  registrarAdmin,
  loginAdmin,
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,
  logout
};