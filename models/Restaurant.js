// ===== RESTAURANT SCHEMA ACTUALIZADO PARA CLOUDINARY =====

const mongoose = require('mongoose');

// Schema para imágenes CON CLOUDINARY
const imagenSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  cloudinaryId: { // NUEVO: ID para poder eliminar de Cloudinary
    type: String,
    required: true,
    trim: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  esPrincipal: {
    type: Boolean,
    default: false
  },
  fechaSubida: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Schema para elementos del menú
const menuItemSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  precio: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: true });

// Schema para categorías del menú
const menuCategorySchema = new mongoose.Schema({
  categoria: {
    type: String,
    required: true,
    trim: true
  },
  items: [menuItemSchema]
}, { _id: true });

// Schema para horarios
const horariosSchema = new mongoose.Schema({
  lunes: {
    abierto: { type: Boolean, default: true },
    apertura: { type: String, default: '09:00' },
    cierre: { type: String, default: '22:00' }
  },
  martes: {
    abierto: { type: Boolean, default: true },
    apertura: { type: String, default: '09:00' },
    cierre: { type: String, default: '22:00' }
  },
  miercoles: {
    abierto: { type: Boolean, default: true },
    apertura: { type: String, default: '09:00' },
    cierre: { type: String, default: '22:00' }
  },
  jueves: {
    abierto: { type: Boolean, default: true },
    apertura: { type: String, default: '09:00' },
    cierre: { type: String, default: '22:00' }
  },
  viernes: {
    abierto: { type: Boolean, default: true },
    apertura: { type: String, default: '09:00' },
    cierre: { type: String, default: '22:00' }
  },
  sabado: {
    abierto: { type: Boolean, default: true },
    apertura: { type: String, default: '09:00' },
    cierre: { type: String, default: '22:00' }
  },
  domingo: {
    abierto: { type: Boolean, default: false },
    apertura: { type: String, default: '09:00' },
    cierre: { type: String, default: '22:00' }
  }
}, { _id: false });

// Schema para dirección
const direccionSchema = new mongoose.Schema({
  calle: {
    type: String,
    required: true,
    trim: true
  },
  ciudad: {
    type: String,
    required: true,
    trim: true
  },
  codigoPostal: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

// Schema para redes sociales
const redesSchema = new mongoose.Schema({
  facebook: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/(www\.)?facebook\.com\/.+/.test(v);
      },
      message: 'URL de Facebook no válida'
    }
  },
  instagram: {
    type: String,
    trim: true
  },
  twitter: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'URL del website no válida'
    }
  }
}, { _id: false });

// Schema principal del restaurante ACTUALIZADO
const restaurantSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del restaurante es obligatorio'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  tipo: {
    type: String,
    required: [true, 'El tipo de establecimiento es obligatorio'],
    enum: {
      values: ['restaurante', 'bar', 'cafeteria', 'comida-rapida', 'panaderia', 'otro'],
      message: 'Tipo de establecimiento no válido'
    }
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es obligatoria'],
    trim: true,
    maxlength: [500, 'La descripción no puede exceder 500 caracteres']
  },
  direccion: {
    type: direccionSchema,
    required: [true, 'La dirección es obligatoria']
  },
  telefono: {
    type: String,
    required: [true, 'El teléfono es obligatorio'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^\+?[\d\s\-\(\)]{8,20}$/.test(v);
      },
      message: 'Formato de teléfono no válido'
    }
  },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Formato de email no válido'
    }
  },
  horarios: {
    type: horariosSchema,
    default: {}
  },
  menu: [menuCategorySchema],
  // IMPORTANTE: Schema de imágenes ACTUALIZADO para Cloudinary
  imagenes: [imagenSchema],
  redes: {
    type: redesSchema,
    default: {}
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'El administrador es obligatorio']
  },
  activo: {
    type: Boolean,
    default: true
  },
  verificado: {
    type: Boolean,
    default: false
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaActualizacion: {
    type: Date,
    default: Date.now
  }
});

// ===== MIDDLEWARE PARA ACTUALIZAR fechaActualizacion =====
restaurantSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.fechaActualizacion = new Date();
  }
  next();
});

// ===== MÉTODOS VIRTUALES =====
restaurantSchema.virtual('totalImagenes').get(function() {
  return this.imagenes ? this.imagenes.length : 0;
});

restaurantSchema.virtual('imagenPrincipal').get(function() {
  if (!this.imagenes || this.imagenes.length === 0) return null;
  
  const principal = this.imagenes.find(img => img.esPrincipal);
  return principal || this.imagenes[0];
});

// ===== MÉTODOS DE INSTANCIA =====

// Método para establecer imagen principal
restaurantSchema.methods.setImagenPrincipal = function(imageId) {
  if (!this.imagenes || this.imagenes.length === 0) {
    throw new Error('No hay imágenes disponibles');
  }

  // Quitar principal de todas
  this.imagenes.forEach(img => {
    img.esPrincipal = false;
  });

  // Buscar y establecer nueva principal
  const imagen = this.imagenes.id(imageId);
  if (!imagen) {
    throw new Error('Imagen no encontrada');
  }

  imagen.esPrincipal = true;
  return this.save();
};

// Método para eliminar imagen
restaurantSchema.methods.eliminarImagen = function(imageId) {
  if (!this.imagenes || this.imagenes.length === 0) {
    throw new Error('No hay imágenes para eliminar');
  }

  const imagen = this.imagenes.id(imageId);
  if (!imagen) {
    throw new Error('Imagen no encontrada');
  }

  // Si es la principal y hay más imágenes, hacer principal la primera
  if (imagen.esPrincipal && this.imagenes.length > 1) {
    this.imagenes.forEach((img, index) => {
      if (img._id.toString() !== imageId && index === 0) {
        img.esPrincipal = true;
      }
    });
  }

  imagen.remove();
  return this.save();
};

// ===== ÍNDICES =====
restaurantSchema.index({ adminId: 1 });
restaurantSchema.index({ activo: 1 });
restaurantSchema.index({ tipo: 1 });
restaurantSchema.index({ 'direccion.ciudad': 1 });
restaurantSchema.index({ fechaCreacion: -1 });

// ===== CONFIGURACIÓN DE TRANSFORMACIÓN JSON =====
restaurantSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Incluir información útil sobre imágenes
    ret.totalImagenes = ret.imagenes ? ret.imagenes.length : 0;
    ret.imagenPrincipalUrl = ret.imagenPrincipal ? ret.imagenPrincipal.url : null;
    return ret;
  }
});

module.exports = mongoose.model('Restaurant', restaurantSchema);