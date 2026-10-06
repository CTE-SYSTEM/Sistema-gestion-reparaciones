const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
export const nicaraguaParts = (date) => Object.fromEntries(formatter.formatToParts(date)
  .filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));

export const nextBackupDate = (settings, now = new Date()) => {
  if (!settings.habilitado) return null;
  const p = nicaraguaParts(now);
  const [hour, minute] = settings.hora.split(':').map(Number);
  // Nicaragua permanece en UTC-6; el calendario se calcula sin depender del servidor.
  let candidate = new Date(Date.UTC(p.year, p.month - 1, p.day, hour + 6, minute));
  if (settings.frecuencia === 'mensual') {
    candidate = new Date(Date.UTC(p.year, p.month - 1, settings.dia_mes, hour + 6, minute));
    if (candidate <= now) candidate = new Date(Date.UTC(p.year, p.month, settings.dia_mes, hour + 6, minute));
  } else if (settings.frecuencia === 'semanal') {
    const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
    candidate.setUTCDate(candidate.getUTCDate() + (settings.dia_semana - weekday + 7) % 7);
    if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 7);
  } else if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate;
};

export const validateBackupLocation = (month, file) => {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    || typeof file !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,180}$/.test(file) || file.includes('..')) {
    throw Object.assign(new Error('Archivo de respaldo no válido.'), { status: 400 });
  }
};
