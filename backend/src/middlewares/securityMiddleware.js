import { randomUUID } from 'crypto';
import { normalizeRole } from '../utils/roles.js';

export const requestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
  });
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  const payload = {
    error: status >= 500 ? 'Error interno del servidor' : err.message,
    requestId: req.id,
  };

  if (process.env.NODE_ENV !== 'production' && normalizeRole(req.user?.rol) !== 'tecnico') {
    payload.details = err.message;
  }

  console.error(`[${req.id || 'sin-request-id'}]`, err.stack || err);
  return res.status(status).json(payload);
};
