export const passwordRecoveryEmail = ({ code, validMinutes, senderName }) => {
  const brand = String(senderName || 'SGR Taller').replace(/[\r\n]/g, ' ').trim();
  return {
    subject: `${brand}: código para restablecer tu contraseña`,
    text: `Tu código para restablecer la contraseña es ${code}. Vence en ${validMinutes} minutos. Si no lo solicitaste, ignora este mensaje.`,
  };
};
