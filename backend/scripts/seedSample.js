/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/support';

async function createUserIfMissing({ name, email, password, role }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ name, email, role });
    await user.setPassword(password);
    await user.save();
    console.log(`Usuario creado: ${email} (${role})`);
  } else {
    console.log(`Usuario existente: ${email}`);
  }
  return user;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Conectado a MongoDB para seed');

  await createUserIfMissing({
    name: 'HOSPITAL VILLAVICENCIO',
    email: 'hospital.villavicencio@demo.com',
    password: 'demo123',
    role: 'client'
  });

  await createUserIfMissing({
    name: 'ASESOR JOSE PROSOFT',
    email: 'asesor.jose.prosoft@demo.com',
    password: 'demo123',
    role: 'agent'
  });

  await createUserIfMissing({
    name: 'DIEGO MOJICA PROSOFT',
    email: 'diego.mojica.prosoft@demo.com',
    password: 'demo123',
    role: 'programmer'
  });

  await createUserIfMissing({
    name: 'ADMINISTRADOR PROSOFT SAS',
    email: 'administrador.prosoft@demo.com',
    password: 'demo123',
    role: 'admin'
  });

  console.log('Seed finalizado: solo cuentas base creadas/validadas (sin tickets ni encuestas).');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
