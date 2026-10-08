import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrevoMessage, sendTransactionalEmail } from '../../src/services/mailService.js';
import { passwordRecoveryEmail } from '../../src/services/mailTemplates.js';

const configuration = {
  apiKey: 'test-key', senderEmail: 'acceso@example.com', senderName: 'Taller', replyToEmail: 'soporte@example.com',
};

test('el mensaje de recuperación incluye el código y el plazo configurado', () => {
  const message = passwordRecoveryEmail({ code: '123456', validMinutes: 10, senderName: 'Taller' });
  assert.match(message.subject, /Taller/);
  assert.match(message.text, /123456/);
  assert.match(message.text, /10 minutos/);
});

test('Brevo recibe una estructura reutilizable para texto y plantillas', () => {
  assert.deepEqual(buildBrevoMessage({ to: 'persona@example.com', subject: 'Aviso', text: 'Mensaje' }, configuration), {
    sender: { email: 'acceso@example.com', name: 'Taller' },
    to: [{ email: 'persona@example.com' }],
    replyTo: { email: 'soporte@example.com' },
    subject: 'Aviso', textContent: 'Mensaje',
  });
  const template = buildBrevoMessage({ to: ['persona@example.com'], templateId: 7, params: { CODE: '123456' } }, configuration);
  assert.equal(template.templateId, 7);
  assert.deepEqual(template.params, { CODE: '123456' });
  assert.throws(() => buildBrevoMessage({ to: 'dirección-inválida', subject: 'Aviso', text: 'Mensaje' }, configuration));
});

test('el envío usa la API de Brevo y detecta fallos sin exponer la clave', async () => {
  const previous = {
    key: process.env.BREVO_API_KEY, sender: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME, reply: process.env.BREVO_REPLY_TO_EMAIL,
    fetch: globalThis.fetch,
  };
  process.env.BREVO_API_KEY = 'secret-for-test';
  process.env.BREVO_SENDER_EMAIL = 'acceso@example.com';
  process.env.BREVO_SENDER_NAME = 'Taller';
  delete process.env.BREVO_REPLY_TO_EMAIL;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
      assert.equal(options.headers['api-key'], 'secret-for-test');
      const body = JSON.parse(options.body);
      assert.equal(body.textContent, 'Mensaje');
      assert.deepEqual(body.to, [{ email: 'persona@example.com' }]);
      return Response.json({ messageId: '<test@brevo>' }, { status: 201 });
    };
    assert.equal(await sendTransactionalEmail({ to: 'persona@example.com', subject: 'Aviso', text: 'Mensaje' }), '<test@brevo>');
    globalThis.fetch = async () => new Response('', { status: 401 });
    await assert.rejects(sendTransactionalEmail({ to: 'persona@example.com', subject: 'Aviso', text: 'Mensaje' }),
      (error) => error.message.includes('401') && !error.message.includes('secret-for-test'));
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of Object.entries({
      BREVO_API_KEY: previous.key, BREVO_SENDER_EMAIL: previous.sender,
      BREVO_SENDER_NAME: previous.name, BREVO_REPLY_TO_EMAIL: previous.reply,
    })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
