export const pruebasSalidaPorTipo = (tipo) => {
  const text = String(tipo || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const portatil = /celular|telefono|smartphone|movil|iphone|tablet|ipad|laptop|notebook|portatil/.test(text);
  return ['funcion_principal', ...(portatil ? ['carga'] : []),
    ...(portatil || /monitor|pantalla|televisor|\btv\b|proyector/.test(text) ? ['pantalla'] : []),
    ...(portatil || /\bpc\b|computadora|ordenador|desktop|router|modem|consola|playstation|xbox/.test(text) ? ['conectividad'] : [])];
};
