const normalizeType = (type) => String(type || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// Los nombres guardados en Equipos son libres. Se reconocen familias sin cambiar
// las etiquetas antiguas ni restringir tipos nuevos que aún no conocemos.
export const getReceptionProfile = (type) => {
  const name = normalizeType(type);
  if (/\b(laptop|notebook|netbook|ultrabook)\b/.test(name)
    || /\b(pc|computadora|ordenador)\b.*\bportatil\b/.test(name)) return { charger: true, access: true };
  if (/\b(celular|movil|smartphone|telefono|iphone|tablet|ipad)\b/.test(name)) return { charger: true, access: true };
  if (/\b(consola|videojuego)\b.*\bportatil\b/.test(name)) return { charger: true, access: true };
  if (/\b(monitor|pantalla|televisor|tv|proyector)\b/.test(name)) return { charger: false, access: false };
  if (/\b(impresora|escaner|scanner|multifuncional)\b/.test(name)) return { charger: false, access: false };
  if (/\b(ups|no break|nobreak)\b/.test(name)) return { charger: false, access: false };
  if (/\b(router|enrutador|modem)\b/.test(name)) return { charger: false, access: true };
  if (/\b(consola|videojuego|playstation|xbox)\b/.test(name)) return { charger: false, access: true };
  if (/\b(pc|computadora|ordenador|desktop|escritorio|torre|cpu)\b/.test(name)) return { charger: false, access: true };
  return { charger: true, access: true };
};

export const chargerAppliesToType = (type) => getReceptionProfile(type).charger;
export const accessAppliesToType = (type) => getReceptionProfile(type).access;
