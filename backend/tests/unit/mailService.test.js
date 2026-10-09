import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResendMessage, sendTransactionalEmail } from '../../src/services/mailService.js';
import { passwordRecoveryEmail } from '../../src/services/mailTemplates.js';

const configuration = {
  apiKey: 'test-key', senderEmail: 'acceso@example.com', senderName: 'Taller', replyToEmail: 'soporte@example.com',
};

test('el mensaje de recuperación incluye el código y el plazo configurado', () => {
  const message = passwordRecoveryEmail({ code: '123456', validMinutes: 10, senderName: 'Taller' });
  assert.match(message.subject, /Taller/);
  assert.match(message.text, /123456/);
  assert.match(message.text, /10 minutos/);
  assert.match(message.html, /<html lang="es" dir="ltr">/);
  assert.match(message.html, /CÓDIGO DE VERIFICACIÓN/);
  assert.match(message.html, />123456<\/p>/);
});

test('Resend recibe una estructura reutilizable para texto y plantillas', () => {
  assert.deepEqual(buildResendMessage({ to: 'persona@example.com', subject: 'Aviso', text: 'Mensaje' }, configuration), {
    from: 'Taller <acceso@example.com>',
    to: ['persona@example.com'],
    reply_to: 'soporte@example.com',
    subject: 'Aviso', text: 'Mensaje',
  });
  const richMessage = buildResendMessage({ to: 'persona@example.com', subject: 'Aviso', text: 'Mensaje', html: '<p>Mensaje</p>' }, configuration);
  assert.equal(richMessage.text, 'Mensaje');
  assert.equal(richMessage.html, '<p>Mensaje</p>');
  const template = buildResendMessage({ to: ['persona@example.com'], templateId: 'plantilla-recuperacion', params: { CODE: '123456' } }, configuration);
  assert.deepEqual(template.template, { id: 'plantilla-recuperacion', variables: { CODE: '123456' } });
  assert.throws(() => buildResendMessage({ to: 'dirección-inválida', subject: 'Aviso', text: 'Mensaje' }, configuration));
});

test('el envío usa la API de Resend y detecta fallos sin exponer la clave', async () => {
  const previous = {
    key: process.env.RESEND_API_KEY, sender: process.env.RESEND_FROM_EMAIL,
    name: process.env.RESEND_FROM_NAME, reply: process.env.RESEND_REPLY_TO_EMAIL,
    fetch: globalThis.fetch,
  };
  process.env.RESEND_API_KEY = 'secret-for-test';
  process.env.RESEND_FROM_EMAIL = 'acceso@example.com';
  process.env.RESEND_FROM_NAME = 'Taller';
  delete process.env.RESEND_REPLY_TO_EMAIL;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.resend.com/emails');
      assert.equal(options.headers.authorization, 'Bearer secret-for-test');
      const body = JSON.parse(options.body);
      assert.equal(body.text, 'Mensaje');
      assert.deepEqual(body.to, ['persona@example.com']);
      return Response.json({ id: 'test-message-id' }, { status: 200 });
    };
    assert.equal(await sendTransactionalEmail({ to: 'persona@example.com', subject: 'Aviso', text: 'Mensaje' }), 'test-message-id');
    globalThis.fetch = async () => new Response('', { status: 401 });
    await assert.rejects(sendTransactionalEmail({ to: 'persona@example.com', subject: 'Aviso', text: 'Mensaje' }),
      (error) => error.message.includes('401') && !error.message.includes('secret-for-test'));
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of Object.entries({
      RESEND_API_KEY: previous.key, RESEND_FROM_EMAIL: previous.sender,
      RESEND_FROM_NAME: previous.name, RESEND_REPLY_TO_EMAIL: previous.reply,
    })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
