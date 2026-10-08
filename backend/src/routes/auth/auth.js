// backend/src/routes/auth/auth.js
import express from 'express';
import { login } from '../../controllers/auth/authController.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import { getMyAccount, updateMyAccount, changeMyPassword, revokeMySessions } from '../../controllers/admin_pro/administracionController.js';
import { requestPasswordRecovery, resetPasswordWithCode } from '../../services/passwordRecovery.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', login);
router.post('/recuperar-password', requestPasswordRecovery);
router.post('/restablecer-password', resetPasswordWithCode);
router.get('/mi-cuenta', authMiddleware, getMyAccount);
router.put('/mi-cuenta', authMiddleware, updateMyAccount);
router.put('/mi-cuenta/password', authMiddleware, changeMyPassword);
router.post('/mi-cuenta/cerrar-sesiones', authMiddleware, revokeMySessions);

export default router;
