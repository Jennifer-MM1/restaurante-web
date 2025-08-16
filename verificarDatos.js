// verificarDatos.js - Script para verificar que los datos estén correctos
const mongoose = require('mongoose');
require('dotenv').config();

// Conectar a la misma BD que tu aplicación
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant-db', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Conectado a MongoDB:', conn.connection.host);
    return conn;
  } catch (error) {
    console.error('❌ Error conectando:', error.message);
    process.exit(1);
  }
};

// Usar los mismos esquemas que tu aplicación
const adminSchema = new mongoose.Schema({
  nombre: String,
  apellido: String,
  email: String,
  password: String,
  telefono: String,
  rol: { type: String, default: 'admin' },
  activo: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now },
  ultimoAcceso: { type: Date, default: Date.now }
});

const restaurantSchema = new mongoose.Schema({
  nombre: String,
  tipo: { type: String, enum: ['restaurante', 'bar', 'cafeteria'] },
  descripcion: String,
  direccion: {
    calle: String,
    ciudad: String,
    codigoPostal: String
  },
  telefono: String,
  email: String,
  horarios: Object,
  menu: Array,
  redes: Object,
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  activo: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now },
  fechaActualizacion: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);
const Restaurant = mongoose.model('Restaurant', restaurantSchema);

const verificarDatos = async () => {
  try {
    await connectDB();
    
    console.log('\n🔍 VERIFICANDO DATOS EN LA BASE DE DATOS');
    console.log('==========================================');
    
    // Contar admins
    const totalAdmins = await Admin.countDocuments();
    console.log(`\n👥 ADMINISTRADORES:`);
    console.log(`Total: ${totalAdmins}`);
    
    // Mostrar algunos admins de ejemplo
    const adminsEjemplo = await Admin.find({}).limit(5).select('nombre apellido email');
    console.log('\n📋 Primeros 5 admins:');
    adminsEjemplo.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.nombre} ${admin.apellido} (${admin.email})`);
    });
    
    // Verificar si hay admins @test.com
    const adminsTest = await Admin.find({ email: { $regex: '@test.com$' } });
    console.log(`\n✅ Admins con @test.com: ${adminsTest.length}`);
    
    // Contar restaurantes
    const totalRestaurantes = await Restaurant.countDocuments();
    console.log(`\n🏪 RESTAURANTES:`);
    console.log(`Total: ${totalRestaurantes}`);
    
    // Estadísticas por tipo
    const statsByType = await Restaurant.aggregate([
      { $group: { _id: '$tipo', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📊 Por tipo:');
    statsByType.forEach(stat => {
      console.log(`${stat._id}: ${stat.count}`);
    });
    
    // Verificar restaurantes activos
    const restaurantesActivos = await Restaurant.countDocuments({ activo: true });
    console.log(`\n✅ Restaurantes activos: ${restaurantesActivos}`);
    
    // Mostrar algunos restaurantes de ejemplo
    const restaurantesEjemplo = await Restaurant.find({})
      .populate('adminId', 'nombre apellido email')
      .limit(5)
      .select('nombre tipo descripcion adminId');
    
    console.log('\n📋 Primeros 5 restaurantes:');
    restaurantesEjemplo.forEach((rest, index) => {
      console.log(`${index + 1}. ${rest.nombre} (${rest.tipo}) - Admin: ${rest.adminId?.email || 'Sin admin'}`);
    });
    
    // Verificar endpoint data structure
    console.log('\n🔍 SIMULANDO ENDPOINT /api/restaurants:');
    console.log('======================================');
    
    const filtros = { activo: true };
    const skip = 0;
    const limite = 12;
    
    const [restaurantes, total] = await Promise.all([
      Restaurant.find(filtros)
        .populate('adminId', 'nombre apellido email telefono')
        .sort({ fechaCreacion: -1 })
        .skip(skip)
        .limit(limite)
        .lean(),
      Restaurant.countDocuments(filtros)
    ]);
    
    console.log(`📊 Total encontrados: ${total}`);
    console.log(`📄 En esta página: ${restaurantes.length}`);
    
    if (restaurantes.length > 0) {
      console.log('\n✅ Ejemplo de datos que devolvería el endpoint:');
      const ejemplo = restaurantes[0];
      console.log({
        id: ejemplo._id,
        nombre: ejemplo.nombre,
        tipo: ejemplo.tipo,
        descripcion: ejemplo.descripcion.substring(0, 50) + '...',
        ciudad: ejemplo.direccion?.ciudad,
        admin: ejemplo.adminId?.email,
        fechaCreacion: ejemplo.fechaCreacion
      });
    }
    
    // Verificar que no hay datos antiguos
    const adminsViejos = await Admin.find({ 
      email: { $not: { $regex: '@test.com$' } } 
    }).limit(3);
    
    if (adminsViejos.length > 0) {
      console.log('\n⚠️  ADVERTENCIA: Encontrados admins con emails NO @test.com:');
      adminsViejos.forEach(admin => {
        console.log(`- ${admin.email}`);
      });
      console.log('\n🚨 Esto significa que el seeder no eliminó los datos anteriores correctamente.');
      console.log('💡 Ejecuta de nuevo: node seedDatabase.js');
    } else {
      console.log('\n✅ PERFECTO: Solo hay admins con @test.com');
    }
    
    // Test de login
    console.log('\n🔐 PROBANDO LOGIN:');
    console.log('==================');
    
    const bcrypt = require('bcryptjs');
    const testAdmin = await Admin.findOne({ email: 'maria@test.com' });
    
    if (testAdmin) {
      try {
        const passwordMatch = await bcrypt.compare('password123', testAdmin.password);
        console.log(`✅ Login test maria@test.com: ${passwordMatch ? 'FUNCIONA' : 'FALLA'}`);
      } catch (error) {
        console.log(`❌ Error en bcrypt: ${error.message}`);
      }
    } else {
      console.log('❌ No se encontró maria@test.com');
    }
    
    console.log('\n🎯 CONCLUSIÓN:');
    console.log('===============');
    if (totalAdmins > 0 && totalRestaurantes > 0 && adminsTest.length > 0) {
      console.log('✅ Los datos están correctos en la base de datos');
      console.log('🔄 Asegúrate de reiniciar tu servidor: npm run dev');
      console.log('🌐 Luego ve a: http://localhost:3003');
    } else {
      console.log('❌ Hay problemas con los datos');
      console.log('🔧 Ejecuta: node seedDatabase.js');
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Verificación completada');
  }
};

// Ejecutar verificación
verificarDatos();