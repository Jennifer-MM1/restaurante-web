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

// ===== AGREGAR ESTAS RUTAS DESPUÉS DE LAS RUTAS DE RESTAURANTES =====
// Pegar después de la última ruta que agregaste

// ===== RUTAS DE SETUP Y PRUEBA =====

// GET /setup - Crear admin de prueba
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

// ===== RUTAS DE ACTUALIZACIÓN DE RESTAURANTE =====

// PATCH /api/restaurants/my-restaurant/schedule - Actualizar horarios
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
          abierto: horarios[dia].abierto !== undefined ? horarios[dia].abierto : true,
          apertura: horarios[dia].apertura || '09:00',
          cierre: horarios[dia].cierre || '22:00'
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

// PATCH /api/restaurants/my-restaurant/menu - Actualizar menú
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

// PATCH /api/restaurants/my-restaurant/social-media - Actualizar redes sociales
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

// PATCH /api/restaurants/my-restaurant - Actualizar todo el restaurante
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

// ===== RUTAS DE PERFIL Y CAMBIO DE PASSWORD =====

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
// ===== AGREGAR ESTAS RUTAS DE SUPER ADMIN DESPUÉS DE LAS RUTAS ANTERIORES =====
// Pegar después de la última ruta que agregaste

// ===== MIDDLEWARE PARA VERIFICAR SUPER-ADMIN =====
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

console.log('✅ Rutas de Super Admin - Parte 1 agregadas');

// ===== CONTINUAR AGREGANDO DESPUÉS DE LAS RUTAS DE SUPER ADMIN PARTE 1 =====

// ===== CREAR SUPER ADMIN INICIAL =====

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

// ===== CREAR NUEVO RESTAURANTE CON ADMINISTRADOR =====

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

// ===== ELIMINACIÓN PERMANENTE (CON CLOUDINARY) =====

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
    
    // ✅ Eliminar imágenes de Cloudinary de los restaurantes
    if (restaurantesAsociados.length > 0) {
      for (const restaurant of restaurantesAsociados) {
        if (restaurant.imagenes && restaurant.imagenes.length > 0) {
          for (const imagen of restaurant.imagenes) {
            if (imagen.cloudinaryId) {
              try {
                await cloudinary.uploader.destroy(imagen.cloudinaryId);
                imagenesEliminadas++;
                console.log(`🗑️ Imagen eliminada de Cloudinary: ${imagen.cloudinaryId}`);
              } catch (err) {
                console.error(`❌ Error eliminando imagen de Cloudinary: ${imagen.cloudinaryId}`, err);
              }
            }
          }
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

    // ✅ Eliminar imágenes de Cloudinary
    if (restaurant.imagenes && restaurant.imagenes.length > 0) {
      for (const imagen of restaurant.imagenes) {
        if (imagen.cloudinaryId) {
          try {
            await cloudinary.uploader.destroy(imagen.cloudinaryId);
            imagenesEliminadas++;
            console.log(`🗑️ Imagen eliminada de Cloudinary: ${imagen.cloudinaryId}`);
          } catch (err) {
            console.error(`❌ Error eliminando imagen de Cloudinary: ${imagen.cloudinaryId}`, err);
          }
        }
      }
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

// ===== RUTAS DE PERFIL DE ADMIN =====

// GET /api/admin/profile - Perfil del admin
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

// GET /api/admin/my-restaurants - Mis restaurantes
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

// ===== PANEL DE ADMIN =====
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

console.log('✅ Rutas de Super Admin - Parte 2 (Completas) agregadas');

console.log('✅ Rutas de setup, menú y horarios agregadas');
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