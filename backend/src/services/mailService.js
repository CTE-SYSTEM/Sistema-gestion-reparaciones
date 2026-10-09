const RESEND_EMAIL_URL = 'https://api.resend.com/emails';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const mailConfiguration = () => ({
  apiKey: process.env.RESEND_API_KEY?.trim() || '',
  senderEmail: process.env.RESEND_FROM_EMAIL?.trim() || '',
  senderName: process.env.RESEND_FROM_NAME?.trim() || 'SGR Taller',
  replyToEmail: process.env.RESEND_REPLY_TO_EMAIL?.trim() || '',
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
  return emails.map((email) => email.trim());
};

export const buildResendMessage = ({ to, subject, text, html, templateId, params } = {}, configuration = mailConfiguration()) => {
  if (!configuration.apiKey || !EMAIL_PATTERN.test(configuration.senderEmail)
    || (configuration.replyToEmail && !EMAIL_PATTERN.test(configuration.replyToEmail))) {
    throw new Error('El envío de correos no está configurado.');
  }
  const senderName = configuration.senderName?.replace(/[\r\n<>]/g, ' ').trim();
  const message = {
    from: senderName ? `${senderName} <${configuration.senderEmail}>` : configuration.senderEmail,
    to: recipientList(to),
  };
  if (configuration.replyToEmail) message.reply_to = configuration.replyToEmail;
  if (subject !== undefined) {
    if (typeof subject !== 'string' || !subject.trim() || /[\r\n]/.test(subject)) throw new TypeError('Indique un asunto válido.');
    message.subject = subject.trim();
  }
  if (templateId !== undefined) {
    if (typeof templateId !== 'string' || !templateId.trim() || text || html
      || (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params)))) {
      throw new TypeError('La plantilla de Resend no es válida.');
    }
    message.template = { id: templateId.trim() };
    if (params) message.template.variables = params;
  } else {
    if (!message.subject) throw new TypeError('Indique un asunto válido.');
    if (!text && !html) throw new TypeError('Indique contenido de texto o HTML.');
    if (text) message.text = text;
    if (html) message.html = html;
  }
  return message;
};

export const sendTransactionalEmail = async (options) => {
  const configuration = mailConfiguration();
  const message = buildResendMessage(options, configuration);
  const response = await fetch(RESEND_EMAIL_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${configuration.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Resend respondió ${response.status} al enviar el correo.`);
  const result = await response.json();
  return result.id || null;
};
