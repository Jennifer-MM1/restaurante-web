const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// ===== MIDDLEWARES =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// ===== CONECTAR A MONGODB =====
const connectDB = async () => {
  try {
    console.log('🔄 Intentando conectar a MongoDB Atlas...');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI no está definida en el archivo .env');
    }
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Atlas conectado exitosamente`);
    console.log(`🏠 Host: ${conn.connection.host}`);
    console.log(`📊 Base de datos: ${conn.connection.name}`);
    
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    console.log('💡 Verifica tu archivo .env y la configuración de MongoDB Atlas');
    console.log('⚠️  Continuando sin base de datos para desarrollo...');
  }
};

// Conectar a MongoDB
connectDB();

// ===== ESQUEMA DEL ADMIN =====
const adminSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  telefono: { type: String, required: true },
  rol: { 
    type: String, 
    enum: ['admin', 'super-admin'], 
    default: 'admin' 
  },
  activo: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now },
  ultimoAcceso: { type: Date, default: Date.now }
});


// Middleware para hashear contraseña
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar contraseñas
adminSchema.methods.compararPassword = async function(passwordIngresada) {
  return await bcrypt.compare(passwordIngresada, this.password);
};

// Método para actualizar último acceso
adminSchema.methods.actualizarUltimoAcceso = function() {
  this.ultimoAcceso = Date.now();
  return this.save({ validateBeforeSave: false });
};

// Crear modelo
const Admin = mongoose.model('Admin', adminSchema);

// ===== RUTAS PRINCIPALES =====

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Panel de admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ===== RUTAS DE AUTENTICACIÓN (EMBEBIDAS) =====

// Generar JWT
const generarToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'mi_secreto_jwt_super_seguro_2024', {
    expiresIn: '7d'
  });
};

// Middleware de autenticación
const verificarToken = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Token no proporcionado'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mi_secreto_jwt_super_seguro_2024');
    const admin = await Admin.findById(decoded.id).select('-password');
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Usuario no encontrado'
      });
    }

    if (!admin.activo) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Cuenta inactiva'
      });
    }

    req.admin = admin;
    next();

  } catch (error) {
    console.error('Error en verificación de token:', error);
    res.status(401).json({
      success: false,
      message: 'No autorizado - Token inválido'
    });
  }
};


// Middleware para verificar super-admin
const verificarSuperAdmin = (req, res, next) => {
  if (req.admin && req.admin.rol === 'super-admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Acceso denegado - Se requieren permisos de super-admin'
    });
  }
};
// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Intento de login:', req.body);
    
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
      console.log('❌ Admin no encontrado:', email);
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const passwordValida = await admin.compararPassword(password);
    
    if (!passwordValida) {
      console.log('❌ Contraseña inválida para:', email);
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar que esté activo
    if (!admin.activo) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta inactiva'
      });
    }

    // Actualizar último acceso
    admin.actualizarUltimoAcceso();

    // Generar token
    const token = generarToken(admin._id);

    console.log('✅ Login exitoso para:', email);

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
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/auth/profile
app.get('/api/auth/profile', verificarToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        admin: req.admin
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/auth/verify-token
app.get('/api/auth/verify-token', verificarToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Token válido',
      data: {
        admin: {
          id: req.admin._id,
          nombre: req.admin.nombre,
          apellido: req.admin.apellido,
          email: req.admin.email,
          telefono: req.admin.telefono,
          rol: req.admin.rol
        }
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
});

// POST /api/auth/logout
// PUT /api/auth/profile - Actualizar perfil
app.put('/api/auth/profile', verificarToken, async (req, res) => {
  try {
    const { nombre, apellido, telefono, configuracion } = req.body;

    // Validar campos requeridos
    if (!nombre || !apellido || !telefono) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, apellido y teléfono son obligatorios'
      });
    }

    const admin = await Admin.findByIdAndUpdate(
      req.admin._id,
      {
        ...(nombre && { nombre }),
        ...(apellido && { apellido }),
        ...(telefono && { telefono }),
        ...(configuracion && { configuracion })
      },
      { new: true, runValidators: true }
    );

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: {
        admin: {
          id: admin._id,
          nombre: admin.nombre,
          apellido: admin.apellido,
          email: admin.email,
          telefono: admin.telefono,
          rol: admin.rol,
          fechaCreacion: admin.fechaCreacion,
          ultimoAcceso: admin.ultimoAcceso
        }
      }
    });

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// PUT /api/auth/change-password - Cambiar contraseña
app.put('/api/auth/change-password', verificarToken, async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual y nueva son obligatorias'
      });
    }

    if (passwordNueva.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    // Obtener admin con contraseña
    const admin = await Admin.findById(req.admin._id).select('+password');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

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
});




// ===== RUTAS DE PRUEBA =====

// Test básico
app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '🎉 Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    database: {
      connected: mongoose.connection.readyState === 1,
      name: mongoose.connection.name || 'No conectado',
      host: mongoose.connection.host || 'No disponible'
    },
    routes: {
      available: [
        'GET / - Página principal',
        'GET /admin - Panel de administración',
        'GET /login.html - Login',
        'GET /setup - Crear admin de prueba',
        'POST /api/auth/login - API Login ✅',
        'POST /api/auth/register - API Registro ✅',
        'GET /api/auth/profile - Perfil del usuario ✅'
      ]
    }
  });
});

// Setup admin de prueba
app.get('/setup', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1 style="color: #ef4444;">❌ MongoDB no conectado</h1>
          <p>Verifica tu archivo .env</p>
          <a href="/test">Ver diagnóstico</a>
        </div>
      `);
    }

    const existingAdmin = await Admin.findOne({ email: 'admin@test.com' });
    
    if (existingAdmin) {
      return res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; border: 2px solid #10b981; border-radius: 10px; background: #f0fdf4;">
          <h1 style="color: #10b981;">✅ Admin de prueba ya existe</h1>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> admin@test.com</p>
            <p><strong>Password:</strong> password123</p>
          </div>
          <a href="/login.html" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 10px;">🔐 Ir al Login</a>
          <a href="/admin.html" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">🎛️ Panel Admin</a>
        </div>
      `);
    }

    const nuevoAdmin = new Admin({
      nombre: 'Admin',
      apellido: 'Prueba',
      email: 'admin@test.com',
      password: 'password123',
      telefono: '4441234567'
    });

    await nuevoAdmin.save();

    res.send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; border: 2px solid #10b981; border-radius: 10px; background: #f0fdf4;">
        <h1 style="color: #10b981;">🎉 Admin creado exitosamente</h1>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Email:</strong> admin@test.com</p>
          <p><strong>Password:</strong> password123</p>
        </div>
        <a href="/login.html" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">🔐 Probar Login</a>
      </div>
    `);

  } catch (error) {
    console.error('Error en setup:', error);
    res.send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
        <h1 style="color: #ef4444;">❌ Error: ${error.message}</h1>
        <a href="/test">Ver diagnóstico</a>
      </div>
    `);
  }
});




// ===== IMPORTAR MODELO DE RESTAURANT =====
const Restaurant = require('./models/Restaurant');









// ===== RUTAS DE GESTIÓN DE RESTAURANTES =====

// Obtener MI restaurante
app.get('/api/restaurants/my-restaurant', verificarToken, async (req, res) => {
  try {
    console.log('🔍 Buscando restaurante para admin:', req.admin._id);
    
    const restaurant = await Restaurant.findOne({ 
      adminId: req.admin._id, 
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
});

// GET /api/admin/my-restaurant (ruta adicional del segundo archivo)
app.get('/api/admin/my-restaurant', verificarToken, async (req, res) => {
  try {
    console.log('🔍 Buscando restaurante para admin:', req.admin._id);
    
    const restaurant = await Restaurant.findOne({ 
      adminId: req.admin._id,
      activo: true 
    }).populate('adminId', 'nombre apellido email telefono');
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró restaurante asociado a este administrador'
      });
    }
    
    console.log('✅ Restaurante encontrado:', restaurant.nombre);
    
    res.json({
      success: true,
      message: 'Restaurante obtenido exitosamente',
      data: restaurant
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo mi restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al obtener restaurante',
      error: error.message
    });
  }
});

// Actualizar información básica
app.patch('/api/restaurants/my-restaurant/basic-info', verificarToken, async (req, res) => {
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
      { adminId: req.admin._id, activo: true },
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
    
    // Notificar actualización via WebSocket si está disponible
    if (global.wsServer) {
      global.wsServer.notifyUpdatedRestaurant(restaurant, { tipo: 'información básica' });
    }
    
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
});

// Actualizar dirección
app.patch('/api/restaurants/my-restaurant/address', verificarToken, async (req, res) => {
  try {
    const { direccion } = req.body;
    
    if (!direccion || !direccion.calle || !direccion.ciudad || !direccion.codigoPostal) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos de dirección son requeridos'
      });
    }
    
    const restaurant = await Restaurant.findOneAndUpdate(
      { adminId: req.admin._id, activo: true },
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
    
    // Notificar actualización via WebSocket si está disponible
    if (global.wsServer) {
      global.wsServer.notifyUpdatedRestaurant(restaurant, { tipo: 'dirección' });
    }
    
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
});

// Actualizar horarios
app.patch('/api/restaurants/my-restaurant/schedule', verificarToken, async (req, res) => {
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
      { adminId: req.admin._id, activo: true },
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
    
    // Notificar actualización via WebSocket si está disponible
    if (global.wsServer) {
      global.wsServer.notifyUpdatedRestaurant(restaurant, { tipo: 'horarios' });
    }
    
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
});

// Actualizar menú
app.patch('/api/restaurants/my-restaurant/menu', verificarToken, async (req, res) => {
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
      { adminId: req.admin._id, activo: true },
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
    
    // Notificar actualización via WebSocket si está disponible
    if (global.wsServer) {
      global.wsServer.notifyUpdatedRestaurant(restaurant, { tipo: 'menú' });
    }
    
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
});

// Actualizar redes sociales
app.patch('/api/restaurants/my-restaurant/social-media', verificarToken, async (req, res) => {
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
      { adminId: req.admin._id, activo: true },
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
    
    // Notificar actualización via WebSocket si está disponible
    if (global.wsServer) {
      global.wsServer.notifyUpdatedRestaurant(restaurant, { tipo: 'redes sociales' });
    }
    
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
});

// Actualizar todo el restaurante (opción completa)
app.patch('/api/restaurants/my-restaurant', verificarToken, async (req, res) => {
  try {
    const updateData = req.body;
    
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
    
    const restaurant = await Restaurant.findOneAndUpdate(
      { adminId: req.admin._id, activo: true },
      updates,
      { new: true, runValidators: true }
    ).populate('adminId', 'nombre apellido email telefono');
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Establecimiento no encontrado'
      });
    }
    
    console.log('✅ Restaurante actualizado completamente:', restaurant.nombre);
    
    // Notificar actualización via WebSocket si está disponible
    if (global.wsServer) {
      global.wsServer.notifyUpdatedRestaurant(restaurant, { tipo: 'actualización completa' });
    }
    
    res.json({
      success: true,
      message: 'Establecimiento actualizado exitosamente',
      data: restaurant
    });
    
  } catch (error) {
    console.error('❌ Error actualizando restaurante:', error);
    
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
});



// ===== CONFIGURACIÓN DE MULTER PARA IMÁGENES =====
const multer = require('multer');
const fs = require('fs');

// Crear directorio si no existe
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'restaurants');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${uniqueSuffix}-${name}${ext}`);
  }
});

// Configuración de multer
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10
  }
});

// ===== RUTAS DE GESTIÓN DE IMÁGENES =====

// 📸 Obtener todas las imágenes del restaurante
app.get('/api/restaurants/images', verificarToken, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ 
      adminId: req.admin._id, 
      activo: true 
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró restaurante asociado'
      });
    }

    // Verificar que las imágenes existen físicamente
    const imagenesValidas = [];
    if (restaurant.imagenes && restaurant.imagenes.length > 0) {
      for (const imagen of restaurant.imagenes) {
        if (fs.existsSync(imagen.path)) {
          imagenesValidas.push(imagen);
        } else {
          console.log(`⚠️ Imagen no encontrada: ${imagen.path}`);
        }
      }
      
      // Actualizar BD si hay imágenes que no existen
      if (imagenesValidas.length !== restaurant.imagenes.length) {
        restaurant.imagenes = imagenesValidas;
        await restaurant.save();
      }
    }

    res.json({
      success: true,
      message: 'Imágenes obtenidas correctamente',
      data: imagenesValidas.map((img, index) => ({
        id: img._id,
        filename: img.filename,
        url: img.url,
        size: img.size,
        path: img.path,
        uploadDate: img.uploadDate,
        esPrincipal: index === 0,
        index: index
      }))
    });

  } catch (error) {
    console.error('❌ Error obteniendo imágenes:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al obtener imágenes',
      error: error.message
    });
  }
});

// 📤 Subir nuevas imágenes
app.post('/api/restaurants/images/upload', verificarToken, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se enviaron archivos'
      });
    }

    const restaurant = await Restaurant.findOne({ 
      adminId: req.admin._id, 
      activo: true 
    });

    if (!restaurant) {
      // Limpiar archivos si no hay restaurante
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error eliminando archivo:', err);
        });
      });
      
      return res.status(404).json({
        success: false,
        message: 'No se encontró restaurante asociado'
      });
    }

    // Crear objetos de imagen según tu modelo
    const nuevasImagenes = req.files.map(file => ({
      filename: file.filename,                               // ✅ Requerido
      url: `/uploads/restaurants/${file.filename}`,          // ✅ Requerido
      size: file.size,                                       // ✅ Requerido
      path: file.path,                                       // ✅ Requerido
      uploadDate: new Date()                                 // ✅ Auto-generado
    }));

    // Agregar imágenes al restaurante
    if (!restaurant.imagenes) {
      restaurant.imagenes = [];
    }
    
    restaurant.imagenes.push(...nuevasImagenes);
    restaurant.fechaActualizacion = new Date();
    
    await restaurant.save();

    console.log(`✅ ${nuevasImagenes.length} imágenes subidas para ${restaurant.nombre}`);

    res.json({
      success: true,
      message: `${nuevasImagenes.length} imagen(es) subida(s) exitosamente`,
      data: {
        imagenesAgregadas: nuevasImagenes.length,
        totalImagenes: restaurant.imagenes.length,
        nuevasImagenes: nuevasImagenes.map((img, index) => ({
          filename: img.filename,
          url: img.url,
          size: img.size,
          esPrincipal: restaurant.imagenes.length === nuevasImagenes.length && index === 0
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error subiendo imágenes:', error);
    
    // Limpiar archivos en caso de error
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error eliminando archivo:', err);
        });
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error del servidor al subir imágenes',
      error: error.message
    });
  }
});

// 🗑️ Eliminar imagen específica
app.delete('/api/restaurants/images/:imageId', verificarToken, async (req, res) => {
  try {
    const { imageId } = req.params;

    const restaurant = await Restaurant.findOne({ 
      adminId: req.admin._id, 
      activo: true 
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró restaurante asociado'
      });
    }

    if (!restaurant.imagenes || restaurant.imagenes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No hay imágenes para eliminar'
      });
    }

    // Buscar imagen por ID
    const imagenIndex = restaurant.imagenes.findIndex(img => img._id.toString() === imageId);
    
    if (imagenIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Imagen no encontrada'
      });
    }

    const imagenAEliminar = restaurant.imagenes[imagenIndex];
    
    // Eliminar archivo físico
    if (fs.existsSync(imagenAEliminar.path)) {
      fs.unlinkSync(imagenAEliminar.path);
      console.log(`🗑️ Archivo eliminado: ${imagenAEliminar.path}`);
    }

    // Eliminar de la base de datos
    restaurant.imagenes.splice(imagenIndex, 1);
    restaurant.fechaActualizacion = new Date();
    
    await restaurant.save();

    console.log(`✅ Imagen eliminada de ${restaurant.nombre}`);

    res.json({
      success: true,
      message: 'Imagen eliminada exitosamente',
      data: {
        totalImagenes: restaurant.imagenes.length,
        imagenEliminada: {
          id: imagenAEliminar._id,
          filename: imagenAEliminar.filename,
          url: imagenAEliminar.url
        }
      }
    });

  } catch (error) {
    console.error('❌ Error eliminando imagen:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al eliminar imagen',
      error: error.message
    });
  }
});

// ⭐ Establecer imagen como principal
app.patch('/api/restaurants/images/:imageId/set-main', verificarToken, async (req, res) => {
  try {
    const { imageId } = req.params;

    const restaurant = await Restaurant.findOne({ 
      adminId: req.admin._id, 
      activo: true 
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró restaurante asociado'
      });
    }

    if (!restaurant.imagenes || restaurant.imagenes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No hay imágenes disponibles'
      });
    }

    // Buscar imagen por ID
    const imagenIndex = restaurant.imagenes.findIndex(img => img._id.toString() === imageId);
    
    if (imagenIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Imagen no encontrada'
      });
    }

    if (imagenIndex === 0) {
      return res.json({
        success: true,
        message: 'Esta imagen ya es la principal',
        data: {
          imagenPrincipal: restaurant.imagenes[0]
        }
      });
    }

    // Mover imagen al primer lugar
    const imagenPrincipal = restaurant.imagenes.splice(imagenIndex, 1)[0];
    restaurant.imagenes.unshift(imagenPrincipal);
    restaurant.fechaActualizacion = new Date();
    
    await restaurant.save();

    console.log(`✅ Imagen principal actualizada para ${restaurant.nombre}`);

    res.json({
      success: true,
      message: 'Imagen principal actualizada exitosamente',
      data: {
        imagenPrincipal: {
          id: imagenPrincipal._id,
          filename: imagenPrincipal.filename,
          url: imagenPrincipal.url,
          size: imagenPrincipal.size
        },
        totalImagenes: restaurant.imagenes.length
      }
    });

  } catch (error) {
    console.error('❌ Error estableciendo imagen principal:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al establecer imagen principal',
      error: error.message
    });
  }
});

// 🌐 Obtener imagen principal (ruta pública)
app.get('/api/restaurants/:id/main-image', async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findOne({ 
      _id: id, 
      activo: true 
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    const mainImage = restaurant.imagenes && restaurant.imagenes.length > 0 
      ? restaurant.imagenes[0] 
      : null;

    res.json({
      success: true,
      data: {
        mainImage: mainImage ? {
          url: mainImage.url,
          filename: mainImage.filename,
          size: mainImage.size
        } : null,
        totalImages: restaurant.imagenes ? restaurant.imagenes.length : 0
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo imagen principal:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor'
    });
  }
});

// 🛡️ Middleware de manejo de errores para multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Archivo demasiado grande. Máximo 5MB por imagen.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Demasiados archivos. Máximo 10 imágenes por vez.'
      });
    }
  }
  
  if (error.message === 'Solo se permiten archivos de imagen') {
    return res.status(400).json({
      success: false,
      message: 'Solo se permiten archivos de imagen (JPG, PNG, GIF, WebP)'
    });
  }
  
  next(error);
});



// 🧪 Ruta de prueba para verificar imágenes
app.get('/test-images', async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ 
      activo: true,
      imagenes: { $exists: true, $ne: [] }
    }).limit(5);

    let html = '<h1>🖼️ Test de Imágenes</h1>';
    
    if (restaurants.length === 0) {
      html += '<p>❌ No hay restaurantes con imágenes</p>';
    } else {
      html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">';
      
      restaurants.forEach(restaurant => {
        html += `
          <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
            <h3>${restaurant.nombre}</h3>
            <p><strong>Total imágenes:</strong> ${restaurant.imagenes.length}</p>
        `;
        
        restaurant.imagenes.forEach((imagen, index) => {
          const exists = fs.existsSync(imagen.path);
          html += `
            <div style="margin: 10px 0; padding: 10px; background: ${exists ? '#f0f9ff' : '#fef2f2'};">
              <p><strong>Imagen ${index + 1}:</strong></p>
              <p>URL: <code>${imagen.url}</code></p>
              <p>Archivo: ${exists ? '✅ Existe' : '❌ No existe'}</p>
              <p>Path: <code>${imagen.path}</code></p>
              <p>Tamaño: ${imagen.size ? (imagen.size / 1024).toFixed(2) + ' KB' : 'No definido'}</p>
              ${exists ? `<img src="${imagen.url}" style="max-width: 200px; max-height: 150px; object-fit: cover;" />` : ''}
            </div>
          `;
        });
        
        html += '</div>';
      });
      
      html += '</div>';
    }
    
    html += `
      <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px;">
        <h3>📋 Información del Sistema</h3>
        <p><strong>Carpeta de uploads:</strong> <code>${uploadsDir}</code></p>
        <p><strong>Carpeta existe:</strong> ${fs.existsSync(uploadsDir) ? '✅ Sí' : '❌ No'}</p>
        <p><strong>Archivos en carpeta:</strong></p>
        <ul>
    `;
    
    try {
      const files = fs.readdirSync(uploadsDir);
      files.forEach(file => {
        html += `<li><code>${file}</code></li>`;
      });
    } catch (error) {
      html += `<li>❌ Error leyendo carpeta: ${error.message}</li>`;
    }
    
    html += `
        </ul>
      </div>
      <p style="margin-top: 20px;"><a href="/admin.html">← Volver al Admin</a></p>
    `;
    
    res.send(html);
    
  } catch (error) {
    res.send(`<h1>❌ Error</h1><pre>${error.message}</pre>`);
  }
});

// 🔧 Ruta para verificar imagen específica
app.get('/check-image/:filename', (req, res) => {
  const { filename } = req.params;
  const imagePath = path.join(uploadsDir, filename);
  
  if (fs.existsSync(imagePath)) {
    res.json({
      success: true,
      exists: true,
      path: imagePath,
      url: `/uploads/restaurants/${filename}`,
      size: fs.statSync(imagePath).size
    });
  } else {
    res.status(404).json({
      success: false,
      exists: false,
      path: imagePath
    });
  }
});



app.post('/api/restaurants/images/upload', verificarToken, (req, res) => {
  // Tu código de upload aquí
});

app.delete('/api/restaurants/images/:imageId', verificarToken, async (req, res) => {
  // Tu código de eliminar imagen aquí
});

app.patch('/api/restaurants/images/:imageId/set-main', verificarToken, async (req, res) => {
  // Tu código de imagen principal aquí
});

// Otras rutas específicas de restaurantes
app.get('/api/restaurants/my-restaurant', verificarToken, async (req, res) => {
  // Tu código existente
});

app.patch('/api/restaurants/my-restaurant/basic-info', verificarToken, async (req, res) => {
  // Tu código existente
});

app.get('/api/restaurants/stats', async (req, res) => {
  // Tu código existente
});

// ✅ RUTAS CON PARÁMETROS AL FINAL (después de las específicas)
// Estas deben ir DESPUÉS de todas las rutas específicas

app.get('/api/restaurants/:id', async (req, res) => {
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
      data: { restaurant }
    });

  } catch (error) {
    console.error('Error obteniendo restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

app.get('/api/restaurants/:id/main-image', async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findOne({ 
      _id: id, 
      activo: true 
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    const mainImage = restaurant.imagenes && restaurant.imagenes.length > 0 
      ? restaurant.imagenes[0] 
      : null;

    res.json({
      success: true,
      data: {
        mainImage: mainImage ? {
          url: mainImage.url,
          filename: mainImage.filename
        } : null,
        totalImages: restaurant.imagenes ? restaurant.imagenes.length : 0
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo imagen principal:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor'
    });
  }
});

// ===== REGLA IMPORTANTE =====
// 🔴 NUNCA pongas rutas con parámetros (:id, :param) antes que rutas específicas
// 🟢 SIEMPRE pon las rutas específicas primero

/*
ORDEN CORRECTO:
1. /api/restaurants/images          ← Específica
2. /api/restaurants/my-restaurant   ← Específica  
3. /api/restaurants/stats           ← Específica
4. /api/restaurants/:id             ← Con parámetro (al final)

ORDEN INCORRECTO (CAUSA ERROR):
1. /api/restaurants/:id             ← Con parámetro (intercepta todo)
2. /api/restaurants/images          ← Nunca se ejecuta
*/









// ===== RUTAS PÚBLICAS DE RESTAURANTES (del segundo archivo) =====

// Obtener todos los restaurantes (público)
// Obtener todos los restaurantes (público) - VERSIÓN CORREGIDA
app.get('/api/restaurants', async (req, res) => {
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

    const sortOptions = {};
    sortOptions[ordenar] = direccion === 'desc' ? -1 : 1;

    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const [restaurantes, total] = await Promise.all([
      Restaurant.find(filtros)
        .populate('adminId', 'nombre apellido email telefono')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limite))
        .lean(),
      Restaurant.countDocuments(filtros)
    ]);

    const estadisticas = await Restaurant.aggregate([
      { $match: { activo: true } },
      { $group: { _id: '$tipo', count: { $sum: 1 } } }
    ]);

    const totalPaginas = Math.ceil(total / parseInt(limite));

    // 🖼️ PROCESAR IMÁGENES - Verificar que existen físicamente
    const restaurantesConImagenes = restaurantes.map(restaurant => {
      let imagenesValidas = [];
      
      if (restaurant.imagenes && restaurant.imagenes.length > 0) {
        imagenesValidas = restaurant.imagenes.filter(imagen => {
          if (imagen.path && fs.existsSync(imagen.path)) {
            return true;
          } else if (imagen.url) {
            // Verificar también por URL si no hay path
            const urlPath = path.join(__dirname, 'public', imagen.url.replace(/^\//, ''));
            return fs.existsSync(urlPath);
          }
          return false;
        });
      }
      
      return {
        id: restaurant._id,
        nombre: restaurant.nombre,
        tipo: restaurant.tipo,
        descripcion: restaurant.descripcion,
        direccion: restaurant.direccion,
        telefono: restaurant.telefono,
        email: restaurant.email,
        horarios: restaurant.horarios,
        menu: restaurant.menu,
        imagenes: imagenesValidas, // ✅ Solo imágenes que existen
        redes: restaurant.redes,
        admin: restaurant.adminId,
        fechaCreacion: restaurant.fechaCreacion,
        fechaActualizacion: restaurant.fechaActualizacion
      };
    });

    res.json({
      success: true,
      message: 'Restaurantes obtenidos exitosamente',
      data: {
        restaurantes: restaurantesConImagenes,
        pagination: {
          total,
          pagina: parseInt(pagina),
          limite: parseInt(limite),
          totalPaginas,
          hasNext: parseInt(pagina) < totalPaginas,
          hasPrev: parseInt(pagina) > 1
        },
        filtros: { tipo, ciudad, buscar, ordenar, direccion },
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
      message: 'Error interno del servidor'
    });
  }
});

// ===== RUTAS PRIVADAS DE ADMIN (del segundo archivo) =====
app.get('/api/admin/profile', verificarToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Perfil obtenido exitosamente',
      data: {
        admin: {
          id: req.admin._id,
          nombre: req.admin.nombre,
          apellido: req.admin.apellido,
          email: req.admin.email,
          telefono: req.admin.telefono,
          rol: req.admin.rol
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo perfil'
    });
  }
});

app.get('/api/admin/my-restaurants', verificarToken, async (req, res) => {
  try {
    const restaurantes = await Restaurant.find({ adminId: req.admin._id })
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
});




// ===== RUTAS DE SUPER ADMIN =====

// Ruta para panel de super admin
app.get('/super-admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'super-admin.html'));
});

// Dashboard de super admin
app.get('/api/super-admin/dashboard', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const [
      totalAdmins,
      adminActivos,
      totalRestaurantes,
      restaurantesActivos,
      estadisticasTipo,
      registrosRecientes
    ] = await Promise.all([
      Admin.countDocuments(),
      Admin.countDocuments({ activo: true }),
      Restaurant.countDocuments(),
      Restaurant.countDocuments({ activo: true }),
      Restaurant.aggregate([
        { $match: { activo: true } },
        { $group: { _id: '$tipo', count: { $sum: 1 } } }
      ]),
      Admin.find().sort({ fechaCreacion: -1 }).limit(5).select('-password')
    ]);

    const estadisticasPorTipo = estadisticasTipo.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    res.json({
      success: true,
      message: 'Dashboard de super admin obtenido exitosamente',
      data: {
        resumen: {
          totalAdmins,
          adminActivos,
          adminInactivos: totalAdmins - adminActivos,
          totalRestaurantes,
          restaurantesActivos,
          restaurantesInactivos: totalRestaurantes - restaurantesActivos
        },
        estadisticasTipo: estadisticasPorTipo,
        registrosRecientes
      }
    });

  } catch (error) {
    console.error('Error obteniendo dashboard super admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ===== GESTIÓN DE ADMINISTRADORES =====

// Obtener todos los administradores
app.get('/api/super-admin/admins', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { pagina = 1, limite = 10, buscar, rol, activo } = req.query;

    const filtros = {};
    
    if (buscar) {
      filtros.$or = [
        { nombre: { $regex: buscar, $options: 'i' } },
        { apellido: { $regex: buscar, $options: 'i' } },
        { email: { $regex: buscar, $options: 'i' } }
      ];
    }
    
    if (rol && ['admin', 'super-admin'].includes(rol)) {
      filtros.rol = rol;
    }
    
    if (activo !== undefined) {
      filtros.activo = activo === 'true';
    }

    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const [admins, total] = await Promise.all([
      Admin.find(filtros)
        .select('-password')
        .sort({ fechaCreacion: -1 })
        .skip(skip)
        .limit(parseInt(limite)),
      Admin.countDocuments(filtros)
    ]);

    const totalPaginas = Math.ceil(total / parseInt(limite));

    res.json({
      success: true,
      message: 'Administradores obtenidos exitosamente',
      data: {
        admins,
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
    console.error('Error obteniendo administradores:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Crear nuevo administrador
app.post('/api/super-admin/admins', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { nombre, apellido, email, password, telefono, rol } = req.body;

    // Validar campos requeridos
    if (!nombre || !apellido || !email || !password || !telefono) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
    }

    // Validar rol
    if (rol && !['admin', 'super-admin'].includes(rol)) {
      return res.status(400).json({
        success: false,
        message: 'Rol inválido'
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
    const nuevoAdmin = await Admin.create({
      nombre,
      apellido,
      email,
      password,
      telefono,
      rol: rol || 'admin'
    });

    const adminResponse = await Admin.findById(nuevoAdmin._id).select('-password');

    res.status(201).json({
      success: true,
      message: 'Administrador creado exitosamente',
      data: { admin: adminResponse }
    });

  } catch (error) {
    console.error('Error creando administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Actualizar administrador
app.put('/api/super-admin/admins/:id', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, telefono, rol, activo } = req.body;

    // No permitir que se modifique a sí mismo el rol
    if (id === req.admin._id.toString() && rol !== req.admin.rol) {
      return res.status(400).json({
        success: false,
        message: 'No puedes cambiar tu propio rol'
      });
    }

    const updates = {};
    if (nombre) updates.nombre = nombre;
    if (apellido) updates.apellido = apellido;
    if (telefono) updates.telefono = telefono;
    if (rol && ['admin', 'super-admin'].includes(rol)) updates.rol = rol;
    if (activo !== undefined) updates.activo = activo;

    const adminActualizado = await Admin.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!adminActualizado) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Administrador actualizado exitosamente',
      data: { admin: adminActualizado }
    });

  } catch (error) {
    console.error('Error actualizando administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Activar/Desactivar administrador
app.patch('/api/super-admin/admins/:id/toggle-status', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // No permitir que se desactive a sí mismo
    if (id === req.admin._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'No puedes cambiar tu propio estado'
      });
    }

    const admin = await Admin.findById(id).select('-password');
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    admin.activo = !admin.activo;
    await admin.save();

    res.json({
      success: true,
      message: `Administrador ${admin.activo ? 'activado' : 'desactivado'} exitosamente`,
      data: { admin }
    });

  } catch (error) {
    console.error('Error cambiando estado del administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ===== GESTIÓN GLOBAL DE RESTAURANTES =====

// Obtener todos los restaurantes (super admin)
app.get('/api/super-admin/restaurants', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { 
      pagina = 1, 
      limite = 10, 
      tipo, 
      ciudad, 
      buscar,
      activo,
      adminId 
    } = req.query;

    const filtros = {};
    
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

    if (activo !== undefined) {
      filtros.activo = activo === 'true';
    }

    if (adminId) {
      filtros.adminId = adminId;
    }

    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const [restaurantes, total] = await Promise.all([
      Restaurant.find(filtros)
        .populate('adminId', 'nombre apellido email telefono rol activo')
        .sort({ fechaCreacion: -1 })
        .skip(skip)
        .limit(parseInt(limite)),
      Restaurant.countDocuments(filtros)
    ]);

    const totalPaginas = Math.ceil(total / parseInt(limite));

    res.json({
      success: true,
      message: 'Restaurantes obtenidos exitosamente',
      data: {
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
    console.error('Error obteniendo restaurantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Activar/Desactivar restaurante
app.patch('/api/super-admin/restaurants/:id/toggle-status', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id).populate('adminId', 'nombre apellido email');
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    restaurant.activo = !restaurant.activo;
    restaurant.fechaActualizacion = new Date();
    await restaurant.save();

    res.json({
      success: true,
      message: `Restaurante ${restaurant.activo ? 'activado' : 'desactivado'} exitosamente`,
      data: { restaurant }
    });

  } catch (error) {
    console.error('Error cambiando estado del restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Editar restaurante (super admin)
app.put('/api/super-admin/restaurants/:id', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Campos permitidos para actualizar
    const allowedUpdates = [
      'nombre', 'descripcion', 'telefono', 'email', 'direccion', 
      'horarios', 'menu', 'redes', 'tipo'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });
    
    updates.fechaActualizacion = new Date();
    
    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('adminId', 'nombre apellido email telefono');
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Restaurante actualizado exitosamente',
      data: { restaurant }
    });
    
  } catch (error) {
    console.error('Error actualizando restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ===== ESTADÍSTICAS GLOBALES =====

// Estadísticas avanzadas del sistema
app.get('/api/super-admin/stats', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const [
      statsAdmins,
      statsRestaurantes,
      statsActividad,
      topCiudades,
      crecimientoMensual
    ] = await Promise.all([
      // Estadísticas de administradores
      Admin.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            activos: { $sum: { $cond: ['$activo', 1, 0] } },
            superAdmins: { $sum: { $cond: [{ $eq: ['$rol', 'super-admin'] }, 1, 0] } },
            adminsNormales: { $sum: { $cond: [{ $eq: ['$rol', 'admin'] }, 1, 0] } }
          }
        }
      ]),
      
      // Estadísticas de restaurantes
      Restaurant.aggregate([
        {
          $group: {
            _id: '$tipo',
            total: { $sum: 1 },
            activos: { $sum: { $cond: ['$activo', 1, 0] } }
          }
        }
      ]),
      
      // Actividad reciente
      Admin.aggregate([
        {
          $match: {
            ultimoAcceso: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: null,
            activosUltimaSemana: { $sum: 1 }
          }
        }
      ]),
      
      // Top ciudades
      Restaurant.aggregate([
        { $match: { activo: true } },
        {
          $group: {
            _id: '$direccion.ciudad',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Crecimiento mensual
      Restaurant.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$fechaCreacion' },
              month: { $month: '$fechaCreacion' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ])
    ]);

    res.json({
      success: true,
      message: 'Estadísticas globales obtenidas exitosamente',
      data: {
        admins: statsAdmins[0] || { total: 0, activos: 0, superAdmins: 0, adminsNormales: 0 },
        restaurantes: statsRestaurantes,
        actividad: statsActividad[0] || { activosUltimaSemana: 0 },
        topCiudades,
        crecimientoMensual
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas globales:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

//<!-- PASO 4: CREAR SUPER ADMIN -->
//<!-- Agrega esta ruta especial para crear el primer super admin: -->

// Crear super admin (solo si no existe ninguno)
app.get('/create-super-admin', async (req, res) => {
  try {
    // Verificar si ya existe un super admin
    const existingSuperAdmin = await Admin.findOne({ rol: 'super-admin' });
    
    if (existingSuperAdmin) {
      return res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; border: 2px solid #f59e0b; border-radius: 10px; background: #fffbeb;">
          <h1 style="color: #f59e0b;">⚠️ Super Admin ya existe</h1>
          <p><strong>Email:</strong> ${existingSuperAdmin.email}</p>
          <p>Ya existe un Super Administrador en el sistema.</p>
          <a href="/login.html" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">🔐 Ir al Login</a>
        </div>
      `);
    }

    // Crear el primer super admin
    const superAdmin = new Admin({
      nombre: 'Super',
      apellido: 'Admin',
      email: 'superadmin@restauranteweb.com',
      password: 'SuperAdmin123!',
      telefono: '4441234567',
      rol: 'super-admin'
    });

    await superAdmin.save();

    res.send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; border: 2px solid #10b981; border-radius: 10px; background: #f0fdf4;">
        <h1 style="color: #10b981;">🎉 Super Admin creado exitosamente</h1>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Email:</strong> superadmin@restauranteweb.com</p>
          <p><strong>Password:</strong> SuperAdmin123!</p>
          <p><strong>Rol:</strong> super-admin</p>
        </div>
        <p style="color: #059669; font-weight: bold;">⚠️ IMPORTANTE: Cambia la contraseña después del primer login</p>
        <div style="margin-top: 20px;">
          <a href="/login.html" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 10px;">🔐 Ir al Login</a>
          <a href="/super-admin.html" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">👑 Panel Super Admin</a>
        </div>
      </div>
    `);

  } catch (error) {
    console.error('Error creando super admin:', error);
    res.send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
        <h1 style="color: #ef4444;">❌ Error: ${error.message}</h1>
        <a href="/test">Ver diagnóstico</a>
      </div>
    `);
  }
});

// ===== ESTADÍSTICAS AVANZADAS DE PRECIOS =====

// Estadísticas detalladas de precios
app.get('/api/super-admin/price-stats', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const [
      preciosPorTipo,
      preciosPorCiudad,
      productosExtremos,
      distribucionPrecios,
      estadisticasMenus,
      topProductos
    ] = await Promise.all([
      // Precios promedio por tipo de restaurante
      Restaurant.aggregate([
        { $match: { activo: true, menu: { $exists: true, $ne: [] } } },
        { $unwind: '$menu' },
        { $unwind: '$menu.items' },
        {
          $group: {
            _id: '$tipo',
            precioPromedio: { $avg: '$menu.items.precio' },
            precioMinimo: { $min: '$menu.items.precio' },
            precioMaximo: { $max: '$menu.items.precio' },
            totalProductos: { $sum: 1 },
            restaurantes: { $addToSet: '$_id' }
          }
        },
        {
          $project: {
            tipo: '$_id',
            precioPromedio: { $round: ['$precioPromedio', 2] },
            precioMinimo: '$precioMinimo',
            precioMaximo: '$precioMaximo',
            totalProductos: '$totalProductos',
            totalRestaurantes: { $size: '$restaurantes' }
          }
        }
      ]),
      
      // Precios por ciudad
      Restaurant.aggregate([
        { $match: { activo: true, menu: { $exists: true, $ne: [] } } },
        { $unwind: '$menu' },
        { $unwind: '$menu.items' },
        {
          $group: {
            _id: '$direccion.ciudad',
            precioPromedio: { $avg: '$menu.items.precio' },
            precioMinimo: { $min: '$menu.items.precio' },
            precioMaximo: { $max: '$menu.items.precio' },
            totalProductos: { $sum: 1 },
            restaurantes: { $addToSet: '$_id' }
          }
        },
        {
          $project: {
            ciudad: '$_id',
            precioPromedio: { $round: ['$precioPromedio', 2] },
            precioMinimo: '$precioMinimo',
            precioMaximo: '$precioMaximo',
            totalProductos: '$totalProductos',
            totalRestaurantes: { $size: '$restaurantes' }
          }
        },
        { $sort: { precioPromedio: -1 } },
        { $limit: 10 }
      ]),
      
      // Productos más caros y más baratos
      Restaurant.aggregate([
        { $match: { activo: true, menu: { $exists: true, $ne: [] } } },
        { $unwind: '$menu' },
        { $unwind: '$menu.items' },
        {
          $project: {
            restaurante: '$nombre',
            ciudad: '$direccion.ciudad',
            tipo: '$tipo',
            categoria: '$menu.categoria',
            producto: '$menu.items.nombre',
            precio: '$menu.items.precio',
            descripcion: '$menu.items.descripcion'
          }
        },
        { $sort: { precio: -1 } }
      ]),
      
      // Distribución de precios en rangos
      Restaurant.aggregate([
        { $match: { activo: true, menu: { $exists: true, $ne: [] } } },
        { $unwind: '$menu' },
        { $unwind: '$menu.items' },
        {
          $bucket: {
            groupBy: '$menu.items.precio',
            boundaries: [0, 50, 100, 150, 200, 300, 500, 1000],
            default: '500+',
            output: {
              count: { $sum: 1 },
              productos: { 
                $push: {
                  nombre: '$menu.items.nombre',
                  precio: '$menu.items.precio',
                  restaurante: '$nombre'
                }
              }
            }
          }
        }
      ]),
      
      // Estadísticas generales de menús
      Restaurant.aggregate([
        { $match: { activo: true } },
        {
          $project: {
            nombre: 1,
            tipo: 1,
            ciudad: '$direccion.ciudad',
            totalCategorias: { $size: { $ifNull: ['$menu', []] } },
            totalItems: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$menu', []] },
                  as: 'categoria',
                  in: { $size: { $ifNull: ['$$categoria.items', []] } }
                }
              }
            },
            preciosItems: {
              $reduce: {
                input: {
                  $reduce: {
                    input: { $ifNull: ['$menu', []] },
                    initialValue: [],
                    in: { $concatArrays: ['$$value', { $ifNull: ['$$this.items', []] }] }
                  }
                },
                initialValue: [],
                in: { $concatArrays: ['$$value', [{ $ifNull: ['$$this.precio', 0] }]] }
              }
            }
          }
        },
        {
          $project: {
            nombre: 1,
            tipo: 1,
            ciudad: 1,
            totalCategorias: 1,
            totalItems: 1,
            precioPromedio: { 
              $cond: {
                if: { $gt: [{ $size: '$preciosItems' }, 0] },
                then: { $avg: '$preciosItems' },
                else: 0
              }
            },
            precioMinimo: { 
              $cond: {
                if: { $gt: [{ $size: '$preciosItems' }, 0] },
                then: { $min: '$preciosItems' },
                else: 0
              }
            },
            precioMaximo: { 
              $cond: {
                if: { $gt: [{ $size: '$preciosItems' }, 0] },
                then: { $max: '$preciosItems' },
                else: 0
              }
            }
          }
        }
      ]),
      
      // Top productos más populares (por frecuencia de nombres similares)
      Restaurant.aggregate([
        { $match: { activo: true, menu: { $exists: true, $ne: [] } } },
        { $unwind: '$menu' },
        { $unwind: '$menu.items' },
        {
          $group: {
            _id: { 
              $toLower: { 
                $trim: { 
                  input: '$menu.items.nombre' 
                } 
              } 
            },
            count: { $sum: 1 },
            precioPromedio: { $avg: '$menu.items.precio' },
            precioMinimo: { $min: '$menu.items.precio' },
            precioMaximo: { $max: '$menu.items.precio' },
            restaurantes: { $addToSet: '$nombre' },
            categorias: { $addToSet: '$menu.categoria' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
        {
          $project: {
            nombre: '$_id',
            frecuencia: '$count',
            precioPromedio: { $round: ['$precioPromedio', 2] },
            precioMinimo: '$precioMinimo',
            precioMaximo: '$precioMaximo',
            enRestaurantes: { $size: '$restaurantes' },
            categorias: '$categorias'
          }
        }
      ])
    ]);

    // Procesar productos extremos
    const productosCaros = productosExtremos.slice(0, 10);
    const productosBaratos = productosExtremos.slice(-10).reverse();

    // Calcular estadísticas generales de precios
    const todosLosPrecios = productosExtremos.map(p => p.precio);
    const estadisticasGenerales = {
      precioPromedio: todosLosPrecios.length > 0 ? 
        Math.round((todosLosPrecios.reduce((a, b) => a + b, 0) / todosLosPrecios.length) * 100) / 100 : 0,
      precioMinimo: todosLosPrecios.length > 0 ? Math.min(...todosLosPrecios) : 0,
      precioMaximo: todosLosPrecios.length > 0 ? Math.max(...todosLosPrecios) : 0,
      totalProductos: todosLosPrecios.length,
      mediana: todosLosPrecios.length > 0 ? 
        calcularMediana(todosLosPrecios.sort((a, b) => a - b)) : 0
    };

    res.json({
      success: true,
      message: 'Estadísticas de precios obtenidas exitosamente',
      data: {
        preciosPorTipo,
        preciosPorCiudad,
        productosCaros,
        productosBaratos,
        distribucionPrecios,
        estadisticasMenus,
        topProductos,
        estadisticasGenerales
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de precios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Función auxiliar para calcular mediana
function calcularMediana(arr) {
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

// Comparativa de precios entre tipos y ciudades
app.get('/api/super-admin/price-comparison', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { tipo, ciudad } = req.query;

    let matchConditions = { activo: true, menu: { $exists: true, $ne: [] } };
    
    if (tipo) matchConditions.tipo = tipo;
    if (ciudad) matchConditions['direccion.ciudad'] = ciudad;

    const comparativa = await Restaurant.aggregate([
      { $match: matchConditions },
      { $unwind: '$menu' },
      { $unwind: '$menu.items' },
      {
        $group: {
          _id: {
            tipo: '$tipo',
            ciudad: '$direccion.ciudad',
            categoria: '$menu.categoria'
          },
          precioPromedio: { $avg: '$menu.items.precio' },
          precioMinimo: { $min: '$menu.items.precio' },
          precioMaximo: { $max: '$menu.items.precio' },
          totalProductos: { $sum: 1 },
          productos: {
            $push: {
              nombre: '$menu.items.nombre',
              precio: '$menu.items.precio',
              restaurante: '$nombre'
            }
          }
        }
      },
      {
        $project: {
          tipo: '$_id.tipo',
          ciudad: '$_id.ciudad',
          categoria: '$_id.categoria',
          precioPromedio: { $round: ['$precioPromedio', 2] },
          precioMinimo: '$precioMinimo',
          precioMaximo: '$precioMaximo',
          totalProductos: '$totalProductos',
          rangoPrecios: { $subtract: ['$precioMaximo', '$precioMinimo'] },
          productos: { $slice: ['$productos', 5] } // Top 5 ejemplos
        }
      },
      { $sort: { precioPromedio: -1 } }
    ]);

    res.json({
      success: true,
      data: { comparativa, filtros: { tipo, ciudad } }
    });

  } catch (error) {
    console.error('Error en comparativa de precios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Análisis de tendencias de precios (simulado con datos históricos)
app.get('/api/super-admin/price-trends', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    // Simular tendencias mensuales (en un sistema real usarías fechas reales)
    const tendenciasMensuales = await Restaurant.aggregate([
      { $match: { activo: true, menu: { $exists: true, $ne: [] } } },
      { $unwind: '$menu' },
      { $unwind: '$menu.items' },
      {
        $group: {
          _id: {
            mes: { $month: '$fechaCreacion' },
            año: { $year: '$fechaCreacion' },
            tipo: '$tipo'
          },
          precioPromedio: { $avg: '$menu.items.precio' },
          totalProductos: { $sum: 1 }
        }
      },
      {
        $project: {
          mes: '$_id.mes',
          año: '$_id.año',
          tipo: '$_id.tipo',
          precioPromedio: { $round: ['$precioPromedio', 2] },
          totalProductos: '$totalProductos'
        }
      },
      { $sort: { año: 1, mes: 1 } }
    ]);

    // Análisis de categorías más populares
    const categoriasTendencia = await Restaurant.aggregate([
      { $match: { activo: true, menu: { $exists: true, $ne: [] } } },
      { $unwind: '$menu' },
      {
        $group: {
          _id: '$menu.categoria',
          restaurantesConCategoria: { $addToSet: '$_id' },
          totalItems: { $sum: { $size: { $ifNull: ['$menu.items', []] } } },
          precioPromedio: {
            $avg: {
              $avg: {
                $map: {
                  input: { $ifNull: ['$menu.items', []] },
                  as: 'item',
                  in: '$$item.precio'
                }
              }
            }
          }
        }
      },
      {
        $project: {
          categoria: '$_id',
          popularidad: { $size: '$restaurantesConCategoria' },
          totalItems: '$totalItems',
          precioPromedio: { $round: ['$precioPromedio', 2] }
        }
      },
      { $sort: { popularidad: -1 } },
      { $limit: 15 }
    ]);

    res.json({
      success: true,
      data: {
        tendenciasMensuales,
        categoriasTendencia
      }
    });

  } catch (error) {
    console.error('Error obteniendo tendencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ===== AGREGAR ESTAS RUTAS A TU server.js =====
// Agregar después de las rutas existentes de super-admin

// Crear nuevo administrador (super admin)
app.post('/api/super-admin/admins', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { nombre, apellido, email, password, telefono, rol = 'admin' } = req.body;

    // Validar campos requeridos
    if (!nombre || !apellido || !email || !password || !telefono) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
    }

    // Validar rol
    if (rol && !['admin', 'super-admin'].includes(rol)) {
      return res.status(400).json({
        success: false,
        message: 'Rol inválido'
      });
    }

    // Verificar que el email no existe
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un administrador con este email'
      });
    }

    // Crear nuevo administrador
    const admin = new Admin({
      nombre,
      apellido,
      email,
      password,
      telefono,
      rol,
      activo: true
    });

    await admin.save();

    // Responder sin la contraseña
    const adminResponse = await Admin.findById(admin._id).select('-password');

    res.status(201).json({
      success: true,
      message: 'Administrador creado exitosamente',
      data: { admin: adminResponse }
    });

  } catch (error) {
    console.error('Error creando administrador:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está en uso'
      });
    }
    
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
});

// Crear nuevo restaurante con administrador (super admin)
app.post('/api/super-admin/restaurants', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { 
      // Datos del restaurante
      nombre, 
      tipo, 
      descripcion, 
      telefono, 
      email, 
      direccion, 
      redes,
      // Administrador (existente o nuevo)
      adminId,
      newAdmin
    } = req.body;

    // Validar campos requeridos del restaurante
    if (!nombre || !tipo || !descripcion || !telefono || !email || !direccion) {
      return res.status(400).json({
        success: false,
        message: 'Los campos básicos del restaurante son obligatorios'
      });
    }

    // Validar dirección
    if (!direccion.calle || !direccion.ciudad || !direccion.codigoPostal) {
      return res.status(400).json({
        success: false,
        message: 'La dirección completa es obligatoria'
      });
    }

    let finalAdminId = adminId;

    // Si se va a crear un nuevo administrador
    if (newAdmin && !adminId) {
      const { nombre: adminNombre, apellido, email: adminEmail, password, telefono: adminTelefono } = newAdmin;

      // Validar campos del nuevo admin
      if (!adminNombre || !apellido || !adminEmail || !password || !adminTelefono) {
        return res.status(400).json({
          success: false,
          message: 'Todos los campos del administrador son obligatorios'
        });
      }

      // Verificar que el email del admin no existe
      const existingAdmin = await Admin.findOne({ email: adminEmail });
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un administrador con este email'
        });
      }

      // Crear el nuevo administrador
      const admin = new Admin({
        nombre: adminNombre,
        apellido,
        email: adminEmail,
        password,
        telefono: adminTelefono,
        rol: 'admin',
        activo: true
      });

      await admin.save();
      finalAdminId = admin._id;

      console.log('✅ Nuevo administrador creado:', adminEmail);
    }

    // Verificar que el administrador existe
    if (!finalAdminId) {
      return res.status(400).json({
        success: false,
        message: 'Debe seleccionar un administrador o crear uno nuevo'
      });
    }

    const admin = await Admin.findById(finalAdminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    // Verificar que el admin no tenga ya un restaurante activo
    const existingRestaurant = await Restaurant.findOne({ 
      adminId: finalAdminId, 
      activo: true 
    });

    if (existingRestaurant) {
      return res.status(400).json({
        success: false,
        message: `El administrador ${admin.nombre} ${admin.apellido} ya tiene un restaurante activo: ${existingRestaurant.nombre}`
      });
    }

    // Verificar que no existe un restaurante con el mismo email
    const existingRestaurantByEmail = await Restaurant.findOne({ email });
    if (existingRestaurantByEmail) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un restaurante con este email'
      });
    }

    // Crear el restaurante
    const restaurant = new Restaurant({
      nombre,
      tipo,
      descripcion,
      telefono,
      email,
      direccion: {
        calle: direccion.calle,
        ciudad: direccion.ciudad,
        codigoPostal: direccion.codigoPostal
      },
      redes: redes || {},
      adminId: finalAdminId,
      activo: true,
      // Horarios por defecto
      horarios: {
        lunes: { abierto: true, apertura: '09:00', cierre: '22:00' },
        martes: { abierto: true, apertura: '09:00', cierre: '22:00' },
        miercoles: { abierto: true, apertura: '09:00', cierre: '22:00' },
        jueves: { abierto: true, apertura: '09:00', cierre: '22:00' },
        viernes: { abierto: true, apertura: '09:00', cierre: '22:00' },
        sabado: { abierto: true, apertura: '09:00', cierre: '22:00' },
        domingo: { abierto: false, apertura: '09:00', cierre: '22:00' }
      },
      menu: [] // Menú vacío inicial
    });

    await restaurant.save();

    // Poblar con datos del administrador para la respuesta
    const restaurantPopulated = await Restaurant.findById(restaurant._id)
      .populate('adminId', 'nombre apellido email telefono rol activo');

    console.log('✅ Restaurante creado exitosamente:', nombre);

    res.status(201).json({
      success: true,
      message: 'Restaurante creado exitosamente',
      data: { 
        restaurant: restaurantPopulated,
        ...(newAdmin && { newAdminCreated: true })
      }
    });

  } catch (error) {
    console.error('Error creando restaurante:', error);
    
    if (error.code === 11000) {
      // Error de duplicado
      if (error.keyPattern.email) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un restaurante con este email'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Error de duplicado en los datos'
      });
    }
    
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
});

// Editar administrador (super admin)
app.put('/api/super-admin/admins/:id', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, email, telefono, rol, activo } = req.body;

    // Validar campos requeridos
    if (!nombre || !apellido || !email || !telefono) {
      return res.status(400).json({
        success: false,
        message: 'Los campos básicos son obligatorios'
      });
    }

    // Validar rol
    if (rol && !['admin', 'super-admin'].includes(rol)) {
      return res.status(400).json({
        success: false,
        message: 'Rol inválido'
      });
    }

    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    // Verificar que el email no esté en uso por otro admin
    if (email !== admin.email) {
      const existingAdmin = await Admin.findOne({ email, _id: { $ne: id } });
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'El email ya está en uso por otro administrador'
        });
      }
    }

    // Actualizar administrador
    const updatedAdmin = await Admin.findByIdAndUpdate(
      id,
      {
        nombre,
        apellido,
        email,
        telefono,
        ...(rol && { rol }),
        ...(activo !== undefined && { activo })
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Administrador actualizado exitosamente',
      data: { admin: updatedAdmin }
    });

  } catch (error) {
    console.error('Error actualizando administrador:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está en uso'
      });
    }
    
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
});

// Obtener administradores disponibles (sin restaurante asignado)
app.get('/api/super-admin/available-admins', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    // Obtener todos los administradores activos
    const allAdmins = await Admin.find({ 
      activo: true,
      rol: 'admin' // Solo admins normales, no super-admins
    }).select('_id nombre apellido email telefono');

    // Obtener IDs de admins que ya tienen restaurante
    const adminsWithRestaurant = await Restaurant.find({ 
      activo: true 
    }).distinct('adminId');

    // Filtrar admins disponibles
    const availableAdmins = allAdmins.filter(admin => 
      !adminsWithRestaurant.some(adminId => adminId.equals(admin._id))
    );

    res.json({
      success: true,
      message: 'Administradores disponibles obtenidos exitosamente',
      data: {
        admins: availableAdmins,
        total: availableAdmins.length
      }
    });

  } catch (error) {
    console.error('Error obteniendo administradores disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ===== FUNCIONES DE UTILIDAD =====

// Función para validar URL (puedes agregar esto si no existe)
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Función para limpiar datos de redes sociales
function cleanSocialMediaData(redes) {
  const cleaned = {};
  
  if (redes.facebook && redes.facebook.trim()) {
    const fb = redes.facebook.trim();
    if (isValidUrl(fb) && fb.includes('facebook.com')) {
      cleaned.facebook = fb;
    }
  }
  
  if (redes.instagram && redes.instagram.trim()) {
    cleaned.instagram = redes.instagram.trim();
  }
  
  if (redes.twitter && redes.twitter.trim()) {
    cleaned.twitter = redes.twitter.trim();
  }
  
  if (redes.website && redes.website.trim()) {
    const website = redes.website.trim();
    if (isValidUrl(website)) {
      cleaned.website = website;
    }
  }
  
  return cleaned;
}

console.log('✅ Rutas de Super Admin para creación de restaurantes agregadas');



// ===== AGREGAR ESTAS RUTAS A TU server.js =====
// Colocar después de las rutas existentes de super-admin

// 🗑️ ELIMINAR ADMINISTRADOR PERMANENTEMENTE
app.delete('/api/super-admin/admins/:id', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // ✅ Verificar que no sea el mismo super admin
    if (id === req.admin.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminarte a ti mismo'
      });
    }

    // ✅ Buscar el administrador
    const admin = await Admin.findById(id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    // ✅ Prevenir eliminación del último super admin
    if (admin.rol === 'super-admin') {
      const totalSuperAdmins = await Admin.countDocuments({ 
        rol: 'super-admin', 
        activo: true,
        _id: { $ne: id } 
      });
      
      if (totalSuperAdmins === 0) {
        return res.status(400).json({
          success: false,
          message: 'No puedes eliminar el último Super Administrador del sistema'
        });
      }
    }

    // ✅ Buscar restaurantes asociados
    const restaurantesAsociados = await Restaurant.find({ adminId: id });
    let imagenesEliminadas = 0;
    
    // ✅ Eliminar imágenes físicas de los restaurantes
    if (restaurantesAsociados.length > 0) {
      for (const restaurant of restaurantesAsociados) {
        if (restaurant.imagenes && restaurant.imagenes.length > 0) {
          restaurant.imagenes.forEach(imagen => {
            if (fs.existsSync(imagen.path)) {
              try {
                fs.unlinkSync(imagen.path);
                imagenesEliminadas++;
                console.log(`🗑️ Imagen eliminada: ${imagen.path}`);
              } catch (err) {
                console.error(`❌ Error eliminando imagen: ${imagen.path}`, err);
              }
            }
          });
        }
      }
      
      // ✅ Eliminar restaurantes de la base de datos
      await Restaurant.deleteMany({ adminId: id });
    }

    // ✅ Eliminar el administrador
    await Admin.findByIdAndDelete(id);

    // ✅ Log de auditoría
    console.log(`🔥 ELIMINACIÓN PERMANENTE - Admin: ${admin.email} por Super Admin: ${req.admin.email}`);

    res.json({
      success: true,
      message: `Administrador "${admin.nombre} ${admin.apellido}" eliminado permanentemente. Se eliminaron ${restaurantesAsociados.length} restaurante(s) y ${imagenesEliminadas} imagen(es).`,
      data: {
        adminEliminado: {
          id: admin._id,
          nombre: admin.nombre,
          apellido: admin.apellido,
          email: admin.email,
          rol: admin.rol
        },
        restaurantesEliminados: restaurantesAsociados.length,
        imagenesEliminadas: imagenesEliminadas
      }
    });

  } catch (error) {
    console.error('❌ Error eliminando administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al eliminar administrador'
    });
  }
});

// 🗑️ ELIMINAR RESTAURANTE PERMANENTEMENTE
app.delete('/api/super-admin/restaurants/:id', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Buscar el restaurante con información del admin
    const restaurant = await Restaurant.findById(id).populate('adminId', 'nombre apellido email');
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    let imagenesEliminadas = 0;

    // ✅ Eliminar imágenes físicas
    if (restaurant.imagenes && restaurant.imagenes.length > 0) {
      restaurant.imagenes.forEach(imagen => {
        if (fs.existsSync(imagen.path)) {
          try {
            fs.unlinkSync(imagen.path);
            imagenesEliminadas++;
            console.log(`🗑️ Imagen eliminada: ${imagen.path}`);
          } catch (err) {
            console.error(`❌ Error eliminando imagen: ${imagen.path}`, err);
          }
        }
      });
    }

    // ✅ Guardar información antes de eliminar
    const restauranteInfo = {
      id: restaurant._id,
      nombre: restaurant.nombre,
      tipo: restaurant.tipo,
      ciudad: restaurant.direccion?.ciudad || 'N/A',
      administrador: restaurant.adminId ? 
        `${restaurant.adminId.nombre} ${restaurant.adminId.apellido} (${restaurant.adminId.email})` : 
        'Administrador no encontrado'
    };

    // ✅ Eliminar de la base de datos
    await Restaurant.findByIdAndDelete(id);

    // ✅ Log de auditoría
    console.log(`🔥 ELIMINACIÓN PERMANENTE - Restaurante: ${restaurant.nombre} por Super Admin: ${req.admin.email}`);

    res.json({
      success: true,
      message: `Restaurante "${restaurant.nombre}" eliminado permanentemente. Se eliminaron ${imagenesEliminadas} imagen(es).`,
      data: {
        restauranteEliminado: restauranteInfo,
        imagenesEliminadas: imagenesEliminadas
      }
    });

  } catch (error) {
    console.error('❌ Error eliminando restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al eliminar restaurante'
    });
  }
});

// 📊 OBTENER ESTADÍSTICAS DE ELIMINACIONES (OPCIONAL)
app.get('/api/super-admin/deletion-stats', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    // Si implementas eliminación suave, puedes obtener estadísticas
    const stats = {
      // Estas serían las estadísticas si usaras eliminación suave
      adminsEliminados: 0, // await Admin.countDocuments({ eliminado: true })
      restaurantesEliminados: 0, // await Restaurant.countDocuments({ eliminado: true })
      // Con eliminación permanente, estas estadísticas no están disponibles
      message: 'Estadísticas de eliminación no disponibles con eliminación permanente'
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// 🔍 BUSCAR ANTES DE ELIMINAR (Función de ayuda)
app.get('/api/super-admin/admins/:id/deletion-impact', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    const restaurantesAsociados = await Restaurant.find({ adminId: id });
    let totalImagenes = 0;

    restaurantesAsociados.forEach(restaurant => {
      if (restaurant.imagenes) {
        totalImagenes += restaurant.imagenes.length;
      }
    });

    res.json({
      success: true,
      message: 'Impacto de eliminación calculado',
      data: {
        admin: {
          nombre: `${admin.nombre} ${admin.apellido}`,
          email: admin.email,
          rol: admin.rol
        },
        impacto: {
          restaurantesAfectados: restaurantesAsociados.length,
          imagenesAfectadas: totalImagenes,
          restaurantes: restaurantesAsociados.map(r => ({
            nombre: r.nombre,
            tipo: r.tipo,
            imagenes: r.imagenes ? r.imagenes.length : 0
          }))
        }
      }
    });

  } catch (error) {
    console.error('Error calculando impacto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// 🚨 ELIMINACIÓN MASIVA (CUIDADO - Solo para emergencias)
app.delete('/api/super-admin/admins/bulk-delete', verificarToken, verificarSuperAdmin, async (req, res) => {
  try {
    const { adminIds, confirmPhrase } = req.body;
    
    // ✅ Verificación de seguridad
    if (confirmPhrase !== 'ELIMINAR PERMANENTEMENTE') {
      return res.status(400).json({
        success: false,
        message: 'Frase de confirmación incorrecta'
      });
    }

    if (!Array.isArray(adminIds) || adminIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar una lista válida de IDs'
      });
    }

    // ✅ Verificar que no incluya al admin actual
    if (adminIds.includes(req.admin.id)) {
      return res.status(400).json({
        success: false,
        message: 'No puedes incluirte en la eliminación masiva'
      });
    }

    let resultados = {
      adminsEliminados: 0,
      restaurantesEliminados: 0,
      imagenesEliminadas: 0,
      errores: []
    };

    for (const adminId of adminIds) {
      try {
        const admin = await Admin.findById(adminId);
        if (!admin) {
          resultados.errores.push(`Admin ${adminId} no encontrado`);
          continue;
        }

        // Eliminar restaurantes y sus imágenes
        const restaurantes = await Restaurant.find({ adminId });
        for (const restaurant of restaurantes) {
          if (restaurant.imagenes) {
            restaurant.imagenes.forEach(imagen => {
              if (fs.existsSync(imagen.path)) {
                fs.unlinkSync(imagen.path);
                resultados.imagenesEliminadas++;
              }
            });
          }
        }

        await Restaurant.deleteMany({ adminId });
        resultados.restaurantesEliminados += restaurantes.length;

        await Admin.findByIdAndDelete(adminId);
        resultados.adminsEliminados++;

      } catch (error) {
        resultados.errores.push(`Error eliminando admin ${adminId}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Eliminación masiva completada. ${resultados.adminsEliminados} admins eliminados.`,
      data: resultados
    });

  } catch (error) {
    console.error('Error en eliminación masiva:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});



// ===== MANEJO DE ERRORES =====
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// ===== INICIALIZAR WEBSOCKET Y SERVIDOR =====
let wsServer = null;

try {
  // Intentar importar el WebSocket Server
  const WebSocketServer = require('./websocket/websocketServer');
  const server = http.createServer(app);
  wsServer = new WebSocketServer(server);
  global.wsServer = wsServer;
  
  server.listen(PORT, () => {
    console.log('\n🚀 ===== SERVIDOR INICIADO CON WEBSOCKET =====');
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Conectada' : 'Desconectada'}`);
    console.log('============================================\n');
  });
} catch (error) {
  console.log('⚠️  WebSocket no disponible, iniciando servidor básico...');
  app.listen(PORT, () => {
    console.log('\n🚀 ===== SERVIDOR INICIADO =====');
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Conectada' : 'Desconectada'}`);
    console.log('===============================\n');
  });
}

// ===== MANEJO GRACEFUL DE CIERRE =====
process.on('SIGTERM', () => {
  console.log('🔄 Cerrando servidor...');
  mongoose.connection.close(false, () => {
    console.log('✅ Conexión MongoDB cerrada');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🔄 Cerrando servidor...');
  mongoose.connection.close(false, () => {
    console.log('✅ Conexión MongoDB cerrada');
    process.exit(0);
  });
});

module.exports = app;