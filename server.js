const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose'); // ← SOLO UNA VEZ AQUÍ
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config();

// ===== CONFIGURACIÓN CLOUDINARY =====
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('🌩️ Cloudinary configurado:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? 'Configurado' : 'NO CONFIGURADO',
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'Configurado' : 'NO CONFIGURADO'
});

// ===== CONFIGURACIÓN DE STORAGE =====
const restaurantStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'restaurant-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      {
        width: 1200,
        height: 800,
        crop: 'limit',
        quality: 'auto:good'
      }
    ],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const name = file.originalname.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '_');
      return `restaurant-${uniqueSuffix}-${name}`;
    }
  }
});

const upload = multer({
  storage: restaurantStorage,
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

// ===== ESQUEMAS =====
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

adminSchema.methods.actualizarUltimoAcceso = function() {
  this.ultimoAcceso = Date.now();
  return this.save({ validateBeforeSave: false });
};

const Admin = mongoose.model('Admin', adminSchema);

// Schema para imágenes CON CLOUDINARY
const imagenSchema = new mongoose.Schema({
  filename: { type: String, required: true, trim: true },
  originalName: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  cloudinaryId: { type: String, required: true, trim: true },
  size: { type: Number, required: true, min: 0 },
  esPrincipal: { type: Boolean, default: false },
  fechaSubida: { type: Date, default: Date.now }
}, { _id: true });

// Schema simplificado de Restaurant
const restaurantSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  tipo: { type: String, required: true, enum: ['restaurante', 'bar', 'cafeteria'] },
  descripcion: { type: String, required: true, trim: true },
  telefono: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  direccion: {
    calle: { type: String, required: true, trim: true },
    ciudad: { type: String, required: true, trim: true },
    codigoPostal: { type: String, required: true, trim: true }
  },
  imagenes: [imagenSchema], // ← CON CLOUDINARY
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  activo: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now },
  fechaActualizacion: { type: Date, default: Date.now }
});

const Restaurant = mongoose.model('Restaurant', restaurantSchema);

// ===== FUNCIONES DE AUTH =====
const generarToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'mi_secreto_jwt_super_seguro_2024', {
    expiresIn: '7d'
  });
};

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

// ===== RUTAS BÁSICAS =====

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '🎉 Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    cloudinary: {
      configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    },
    database: {
      connected: mongoose.connection.readyState === 1
    }
  });
});

// ===== RUTA DE ESTADO CLOUDINARY =====
app.get('/api/cloudinary-status', (req, res) => {
  try {
    const isConfigured = !!(
      process.env.CLOUDINARY_CLOUD_NAME && 
      process.env.CLOUDINARY_API_KEY && 
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      configured: isConfigured,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'No configurado',
      api_key: process.env.CLOUDINARY_API_KEY ? 'Configurado' : 'No configurado',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'Configurado' : 'No configurado',
      storage: 'Cloudinary CDN',
      folder: 'restaurant-images'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ===== RUTAS DE AUTH =====
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son obligatorios'
      });
    }

    const admin = await Admin.findOne({ email }).select('+password');
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    const passwordValida = await admin.compararPassword(password);
    
    if (!passwordValida) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    if (!admin.activo) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta inactiva'
      });
    }

    admin.actualizarUltimoAcceso();
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
          rol: admin.rol
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

// ===== RUTAS DE IMÁGENES CON CLOUDINARY =====

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

    const imagenes = restaurant.imagenes || [];

    res.json({
      success: true,
      data: imagenes.map(imagen => ({
        id: imagen._id,
        filename: imagen.filename,
        originalName: imagen.originalName,
        url: imagen.url,
        cloudinaryId: imagen.cloudinaryId,
        size: imagen.size,
        esPrincipal: imagen.esPrincipal,
        fechaSubida: imagen.fechaSubida
      })),
      total: imagenes.length,
      storage: 'Cloudinary'
    });

  } catch (error) {
    console.error('❌ Error obteniendo imágenes:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor al obtener imágenes'
    });
  }
});

app.post('/api/restaurants/images/upload', verificarToken, upload.array('images', 10), async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ 
      adminId: req.admin._id, 
      activo: true 
    });

    if (!restaurant) {
      if (req.files) {
        for (const file of req.files) {
          try {
            await cloudinary.uploader.destroy(file.public_id);
          } catch (error) {
            console.error('Error limpiando Cloudinary:', error);
          }
        }
      }
      
      return res.status(404).json({
        success: false,
        message: 'No se encontró restaurante asociado'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se recibieron archivos'
      });
    }

    const nuevasImagenes = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      url: file.path,
      cloudinaryId: file.public_id,
      size: file.size,
      fechaSubida: new Date(),
      esPrincipal: false
    }));

    if (!restaurant.imagenes) {
      restaurant.imagenes = [];
    }

    restaurant.imagenes.push(...nuevasImagenes);
    
    if (restaurant.imagenes.length === nuevasImagenes.length) {
      restaurant.imagenes[0].esPrincipal = true;
    }

    restaurant.fechaActualizacion = new Date();
    await restaurant.save();

    res.json({
      success: true,
      message: `${nuevasImagenes.length} imagen(es) subida(s) correctamente`,
      data: {
        imagenesSubidas: nuevasImagenes.length,
        totalImagenes: restaurant.imagenes.length,
        storage: 'Cloudinary',
        imagenes: nuevasImagenes.map((img, index) => ({
          id: img._id || `temp-${index}`,
          filename: img.filename,
          originalName: img.originalName,
          url: img.url,
          cloudinaryId: img.cloudinaryId,
          size: img.size,
          esPrincipal: img.esPrincipal
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error subiendo imágenes a Cloudinary:', error);
    
    if (req.files) {
      for (const file of req.files) {
        try {
          await cloudinary.uploader.destroy(file.public_id);
        } catch (cleanupError) {
          console.error('Error en limpieza:', cleanupError);
        }
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error del servidor al subir imágenes',
      error: error.message
    });
  }
});

// ===== AGREGAR ESTAS RUTAS DESPUÉS DE LAS RUTAS DE IMÁGENES =====
// Pegar después de la última ruta de imágenes en tu server.js

// ===== RUTAS DE GESTIÓN DE RESTAURANTES =====

// GET /api/restaurants/my-restaurant - Obtener MI restaurante
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

// GET /api/admin/my-restaurant (ruta adicional)
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

// PATCH /api/restaurants/my-restaurant/basic-info - Actualizar información básica
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

// PATCH /api/restaurants/my-restaurant/address - Actualizar dirección
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

// GET /api/restaurants - Obtener todos los restaurantes (público)
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

    // Procesar restaurantes con información adicional
    const restaurantesConInfo = restaurantes.map(restaurant => ({
      id: restaurant._id,
      nombre: restaurant.nombre,
      tipo: restaurant.tipo,
      descripcion: restaurant.descripcion,
      direccion: restaurant.direccion,
      telefono: restaurant.telefono,
      email: restaurant.email,
      imagenes: restaurant.imagenes || [],
      admin: restaurant.adminId,
      fechaCreacion: restaurant.fechaCreacion,
      fechaActualizacion: restaurant.fechaActualizacion
    }));

    res.json({
      success: true,
      message: 'Restaurantes obtenidos exitosamente',
      data: {
        restaurantes: restaurantesConInfo,
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

// GET /api/restaurants/:id - Obtener restaurante específico (público)
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

// GET /api/auth/profile - Perfil del admin
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

// GET /api/auth/verify-token - Verificar token
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

// POST /api/auth/register - Registro de admins
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

console.log('✅ Rutas de restaurantes agregadas');

// ===== MANEJO DE ERRORES =====
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// ===== INICIALIZAR SERVIDOR =====
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🌩️ Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configurado' : 'NO CONFIGURADO'}`);
  console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Conectada' : 'Desconectada'}`);
  console.log('=====================================\n');
});

module.exports = app;