const mongoose = require('mongoose');

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

// Schema para imágenes - NUEVO
const imagenSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  path: {
    type: String,
    required: true
  }
}, { _id: true });

// Schema principal del restaurante
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
    default: () => ({})
  },
  menu: {
    type: [menuCategorySchema],
    default: []
  },
  imagenes: {
    type: [imagenSchema],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 20; // Máximo 20 imágenes
      },
      message: 'No se pueden tener más de 20 imágenes'
    }
  },
  redes: {
    type: redesSchema,
    default: () => ({})
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'El administrador es obligatorio'],
    index: true
  },
  activo: {
    type: Boolean,
    default: true,
    index: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaActualizacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indices para optimizar consultas
restaurantSchema.index({ adminId: 1, activo: 1 });
restaurantSchema.index({ tipo: 1, activo: 1 });
restaurantSchema.index({ 'direccion.ciudad': 1, activo: 1 });

// Virtual para obtener la imagen principal
restaurantSchema.virtual('imagenPrincipal').get(function() {
  return this.imagenes && this.imagenes.length > 0 ? this.imagenes[0] : null;
});

// Virtual para contar total de imágenes
restaurantSchema.virtual('totalImagenes').get(function() {
  return this.imagenes ? this.imagenes.length : 0;
});

// Middleware pre-save para actualizar fechaActualizacion
restaurantSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.fechaActualizacion = new Date();
  }
  next();
});

// Método para agregar imagen
restaurantSchema.methods.agregarImagen = function(imagenData) {
  if (!this.imagenes) {
    this.imagenes = [];
  }
  this.imagenes.push(imagenData);
  return this.save();
};

// Método para eliminar imagen
restaurantSchema.methods.eliminarImagen = function(imageId) {
  if (!this.imagenes) return this.save();
  
  this.imagenes = this.imagenes.filter(img => img._id.toString() !== imageId);
  return this.save();
};

// Método para establecer imagen principal
restaurantSchema.methods.establecerImagenPrincipal = function(imageId) {
  if (!this.imagenes || this.imagenes.length === 0) return this.save();
  
  const imageIndex = this.imagenes.findIndex(img => img._id.toString() === imageId);
  if (imageIndex === -1 || imageIndex === 0) return this.save();
  
  const [selectedImage] = this.imagenes.splice(imageIndex, 1);
  this.imagenes.unshift(selectedImage);
  
  return this.save();
};

// Método para obtener horario del día actual
restaurantSchema.methods.getHorarioHoy = function() {
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const hoy = dias[new Date().getDay()];
  return this.horarios[hoy] || { abierto: false };
};

// Método para verificar si está abierto ahora
restaurantSchema.methods.estaAbiertoAhora = function() {
  const horarioHoy = this.getHorarioHoy();
  if (!horarioHoy.abierto) return false;
  
  const ahora = new Date();
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
  
  const [aperturaHora, aperturaMin] = horarioHoy.apertura.split(':').map(Number);
  const [cierreHora, cierreMin] = horarioHoy.cierre.split(':').map(Number);
  
  const apertura = aperturaHora * 60 + aperturaMin;
  const cierre = cierreHora * 60 + cierreMin;
  
  return horaActual >= apertura && horaActual <= cierre;
};

module.exports = mongoose.model('Restaurant', restaurantSchema);