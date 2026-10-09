const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export const passwordRecoveryEmail = ({ code, validMinutes, senderName }) => {
  const brand = String(senderName || 'SGR Taller').replace(/[\r\n]/g, ' ').trim();
  const safeCode = escapeHtml(code);
  const safeMinutes = escapeHtml(validMinutes);
  return {
    subject: `${brand}: código para restablecer tu contraseña`,
    text: `Restablece tu contraseña en SGR\n\nTu código de verificación:\n\n${code}\n\nCópialo e introdúcelo en la pantalla de recuperación. Vence en ${validMinutes} minutos.\n\nSi no solicitaste este cambio, ignora el mensaje y no compartas el código.\n\nSGR · Sistema de Gestión para Talleres de Reparación`,
    html: `<!doctype html>
<html lang="es" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Restablece tu contraseña en SGR</title>
</head>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#17233a;">
  <div lang="es" dir="ltr">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tu código de SGR vence en ${safeMinutes} minutos.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f6fb;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e3e9f2;border-radius:16px;">
          <tr><td style="padding:32px 32px 8px;">
            <span style="display:inline-block;background:#164a93;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:2px;padding:10px 14px;border-radius:8px;">SGR</span>
          </td></tr>
          <tr><td style="padding:12px 32px 0;">
            <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#152b4f;">Restablece tu contraseña</h1>
            <p style="margin:0;font-size:16px;line-height:1.6;color:#46566d;">Usa este código para continuar en SGR.</p>
          </td></tr>
          <tr><td align="center" style="padding:28px 32px 8px;">
            <div style="width:100%;box-sizing:border-box;background:#eef5ff;border:1px solid #c9dcf8;border-radius:12px;padding:22px 12px;">
              <p style="margin:0 0 10px;color:#315b91;font-size:12px;font-weight:700;letter-spacing:1.4px;">CÓDIGO DE VERIFICACIÓN</p>
              <p style="margin:0;color:#123d78;font-family:Consolas,Monaco,monospace;font-size:34px;font-weight:700;letter-spacing:5px;line-height:1.25;">${safeCode}</p>
            </div>
          </td></tr>
          <tr><td style="padding:12px 32px 28px;">
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#46566d;">Selecciona y copia el código. Introdúcelo en la pantalla de recuperación.</p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#315b91;font-weight:700;">Válido durante ${safeMinutes} minutos</p>
          </td></tr>
          <tr><td style="padding:22px 32px 30px;border-top:1px solid #e8edf4;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#69778b;">Si no solicitaste este cambio, ignora el mensaje. No compartas este código con nadie.</p>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#718097;">SGR · Sistema de Gestión para Talleres de Reparación</p>
      </td></tr>
    </table>
  </div>
</body>
</html>`,
  };
};
