// backend/src/controllers/auth/authController.js
import prisma from '../../app/prismaClient.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export const login = async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
    }

    // 1. Buscar usuario por nombre_usuario (tal cual tu schema Prisma)
    const usuario = await prisma.usuarios.findUnique({
      where: { nombre_usuario: username },
    });

    if (!usuario) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // 2. Verificar si está activo
    if (!usuario.activo) {
      return res.status(403).json({ message: 'Cuenta desactivada' });
    }

    // 3. Comparar contraseña con bcryptjs
    const validPassword = await bcrypt.compare(password, usuario.contrasena_hash);
    
    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // 4. Generar Token JWT
    const [session] = await prisma.$queryRaw`SELECT sesion_version FROM "Usuarios" WHERE id_usuario = ${usuario.id_usuario}`;
    const token = jwt.sign(
      { id: usuario.id_usuario, username: usuario.nombre_usuario, rol: usuario.rol, sesion_version: session.sesion_version },
      env.jwtSecret,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre_usuario,
        rol: usuario.rol,
      },
    });

  } catch (error) {
    console.error('Error en el login controlador:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};
