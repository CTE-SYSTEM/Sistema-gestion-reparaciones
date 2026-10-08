const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const mailConfiguration = () => ({
  apiKey: process.env.BREVO_API_KEY?.trim() || '',
  senderEmail: process.env.BREVO_SENDER_EMAIL?.trim() || '',
  senderName: process.env.BREVO_SENDER_NAME?.trim() || 'SGR Taller',
  replyToEmail: process.env.BREVO_REPLY_TO_EMAIL?.trim() || '',
});

export const isMailConfigured = () => {
  const { apiKey, senderEmail, replyToEmail } = mailConfiguration();
  return Boolean(apiKey && EMAIL_PATTERN.test(senderEmail)
    && (!replyToEmail || EMAIL_PATTERN.test(replyToEmail)));
};

const recipientList = (to) => {
  const emails = Array.isArray(to) ? to : [to];
  if (!emails.length || emails.length > 50 || emails.some((email) => typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim()))) {
    throw new TypeError('Indique entre uno y cincuenta correos destinatarios válidos.');
  }
  return emails.map((email) => ({ email: email.trim() }));
};

export const buildBrevoMessage = ({ to, subject, text, html, templateId, params } = {}, configuration = mailConfiguration()) => {
  if (!configuration.apiKey || !EMAIL_PATTERN.test(configuration.senderEmail)
    || (configuration.replyToEmail && !EMAIL_PATTERN.test(configuration.replyToEmail))) {
    throw new Error('El envío de correos no está configurado.');
  }
  const message = {
    sender: { email: configuration.senderEmail, name: configuration.senderName },
    to: recipientList(to),
  };
  if (configuration.replyToEmail) message.replyTo = { email: configuration.replyToEmail };
  if (templateId !== undefined) {
    if (!Number.isSafeInteger(templateId) || templateId <= 0 || text || html) throw new TypeError('La plantilla de Brevo no es válida.');
    message.templateId = templateId;
    if (params) message.params = params;
  } else {
    if (typeof subject !== 'string' || !subject.trim() || /[\r\n]/.test(subject)) throw new TypeError('Indique un asunto válido.');
    if (Boolean(text) === Boolean(html)) throw new TypeError('Indique contenido de texto o HTML.');
    message.subject = subject.trim();
    if (text) message.textContent = text;
    if (html) message.htmlContent = html;
  }
  return message;
};

export const sendTransactionalEmail = async (options) => {
  const configuration = mailConfiguration();
  const message = buildBrevoMessage(options, configuration);
  const response = await fetch(BREVO_EMAIL_URL, {
    method: 'POST',
    headers: {
      'api-key': configuration.apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Brevo respondió ${response.status} al enviar el correo.`);
  const result = await response.json();
  return result.messageId || null;
};
