// debugServer.js - Script para diagnosticar problemas del servidor
const mongoose = require('mongoose');
require('dotenv').config();

const diagnosticar = async () => {
  console.log('🔍 DIAGNÓSTICO DEL SERVIDOR');
  console.log('===========================\n');

  // 1. Verificar variables de entorno
  console.log('1. VARIABLES DE ENTORNO:');
  console.log('------------------------');
  console.log(`MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Definida' : '❌ No definida'}`);
  console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Definida' : '❌ No definida'}`);
  console.log(`PORT: ${process.env.PORT || '3003 (por defecto)'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development (por defecto)'}\n`);

  // 2. Verificar conexión a MongoDB
  console.log('2. CONEXIÓN A MONGODB:');
  console.log('----------------------');
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant-db', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB conectado exitosamente');
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Base de datos: ${conn.connection.name}`);
    
    // Verificar datos
    const Admin = mongoose.model('Admin', new mongoose.Schema({}, { strict: false }));
    const Restaurant = mongoose.model('Restaurant', new mongoose.Schema({}, { strict: false }));
    
    const adminCount = await Admin.countDocuments();
    const restaurantCount = await Restaurant.countDocuments();
    
    console.log(`   Admins: ${adminCount}`);
    console.log(`   Restaurantes: ${restaurantCount}`);
    
    await mongoose.connection.close();
    console.log('✅ Conexión cerrada correctamente\n');
  } catch (error) {
    console.log('❌ Error conectando a MongoDB:');
    console.log(`   ${error.message}\n`);
  }

  // 3. Verificar archivos requeridos
  console.log('3. ARCHIVOS REQUERIDOS:');
  console.log('-----------------------');
  const fs = require('fs');
  const path = require('path');
  
  const archivosRequeridos = [
    'server.js',
    'package.json',
    '.env',
    'models/Admin.js',
    'models/Restaurant.js',
    'websocket/websocketServer.js',
    'controllers/restaurantController.js',
    'public/index.html'
  ];
  
  archivosRequeridos.forEach(archivo => {
    const existe = fs.existsSync(path.join(process.cwd(), archivo));
    console.log(`   ${archivo}: ${existe ? '✅ Existe' : '❌ No existe'}`);
  });

  // 4. Verificar dependencias
  console.log('\n4. DEPENDENCIAS:');
  console.log('----------------');
  try {
    const packageJson = require(path.join(process.cwd(), 'package.json'));
    const dependenciasRequeridas = ['express', 'mongoose', 'bcryptjs', 'jsonwebtoken', 'cors', 'dotenv', 'ws'];
    
    dependenciasRequeridas.forEach(dep => {
      const instalada = packageJson.dependencies && packageJson.dependencies[dep];
      console.log(`   ${dep}: ${instalada ? '✅ Instalada' : '❌ No instalada'}`);
    });
  } catch (error) {
    console.log('❌ Error leyendo package.json');
  }

  // 5. Verificar puerto
  console.log('\n5. PUERTO:');
  console.log('----------');
  const net = require('net');
  const puerto = process.env.PORT || 3003;
  
  const server = net.createServer();
  
  try {
    await new Promise((resolve, reject) => {
      server.listen(puerto, () => {
        console.log(`✅ Puerto ${puerto} disponible`);
        server.close(resolve);
      });
      server.on('error', reject);
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.log(`❌ Puerto ${puerto} ya está en uso`);
      console.log('💡 Solución: mata el proceso o usa otro puerto');
    } else {
      console.log(`❌ Error con puerto: ${error.message}`);
    }
  }

  console.log('\n6. RECOMENDACIONES:');
  console.log('-------------------');
  console.log('Si hay errores arriba:');
  console.log('1. Instala dependencias faltantes: npm install');
  console.log('2. Verifica tu archivo .env');
  console.log('3. Mata procesos en el puerto: npx kill-port 3003');
  console.log('4. Reinicia: npm run dev');
};

diagnosticar().catch(console.error);