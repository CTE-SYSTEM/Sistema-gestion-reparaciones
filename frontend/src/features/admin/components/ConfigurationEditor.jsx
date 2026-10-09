import { useEffect, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { administracionService, errorText } from '../services/administracionService';
import { AdminSection, AdminField, AdminButton, AdminNotice, inputClass, formatAdminDate } from './AdministrationUI';

const fields = {
  negocio: [
    ['nombre', 'Nombre del taller', 'text'], ['correo', 'Correo de contacto', 'email'],
    ['telefono', 'Teléfono de contacto', 'tel'], ['direccion', 'Dirección', 'text'],
    ['garantia_meses', 'Garantía predeterminada (meses)', 'number', 1, 36, 'Se aplica a nuevas garantías automáticas y al valor inicial de emisión manual.'],
    ['margen_repuesto_porcentaje', 'Margen inicial de repuestos (%)', 'number', 0, 1000, 'Se aplica al crear un repuesto si no se indica una ganancia específica.'],
    ['garantia_condiciones', 'Condiciones de garantía', 'textarea', null, null, 'Las garantías emitidas conservan sus condiciones.'],
  ],
  reglas: [
    ['garantia_aviso_dias', 'Avisar garantías por vencer (días)', 'number', 1, 365, 'Usado en el resumen y en el filtro inicial del reporte.'],
    ['orden_atrasada_dias', 'Considerar una orden atrasada después de (días)', 'number', 1, 365, 'Usado por el reporte de órdenes atrasadas.'],
    ['alerta_tecnica_horas', 'Alertar trabajo técnico sin avance después de (horas)', 'number', 1, 720, 'Se aplica al tablero y a las alertas del jefe técnico. Valor inicial: 72 horas.'],
    ['correccion_cierre_horas', 'Corregir un cierre técnico dentro de (horas)', 'number', 1, 168, 'El técnico debe indicar un motivo; después de este plazo, la corrección se marca como excepción.'],
    ['correccion_excepcional_habilitada', 'Permitir correcciones excepcionales después del plazo', 'checkbox', null, null, 'Las excepciones exigen motivo y quedan marcadas en el historial.'],
    ['stock_minimo_predeterminado', 'Stock mínimo de repuestos nuevos', 'number', 0, 100000, 'Se aplica si Secretaría deja vacío el mínimo al crear un repuesto. Cada repuesto puede tener su propio mínimo.'],
    ['rentabilidad_alerta_porcentaje', 'Aviso de rentabilidad inferior a (%)', 'number', 0, 100],
    ['margen_orden_alerta_porcentaje', 'Aviso de margen por orden inferior a (%)', 'number', 0, 100],
    ['password_minimo', 'Longitud mínima de nuevas contraseñas', 'number', 8, 64, 'No cambia las contraseñas actuales. Máximo 72 bytes por contraseña.'],
  ],
};
export default function ConfigurationEditor({ section = 'negocio', title = 'Configuración del negocio', onSaved }) {
  const [config, setConfig] = useState(null), [values, setValues] = useState(null);
  const [reason, setReason] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const reload = async () => {
    setLoading(true); setError('');
    try { const { data } = await administracionService.getConfiguracion(); setConfig(data.data); setValues(data.data.valores[section]); setReason(''); }
    catch (e) { setError(await errorText(e)); } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [section]);
  const change = (key, value) => { setValues((prev) => ({ ...prev, [key]: value })); setMessage(''); };
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const { data } = await administracionService.saveConfiguracion({ valores: { [section]: values }, revision: config.revision, motivo: reason });
      setConfig(data.data); setValues(data.data.valores[section]); setReason(''); setMessage(data.message); onSaved?.();
    } catch (e) { setError(await errorText(e)); } finally { setSaving(false); }
  };
  return <AdminSection title={title} description={config?.actualizado_en ? `Último cambio: ${formatAdminDate(config.actualizado_en)} · Revisión ${config.revision}` : 'Valores iniciales del taller.'}>
    <div className="space-y-4"><AdminNotice error message={error} /><AdminNotice message={message} />
      {loading ? <p className="text-sm text-slate-500">Cargando configuración…</p> : values &&
        <form onSubmit={save} className="space-y-5">
          <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
            {section === 'respaldos' ? <>
              <label className="flex items-center gap-2 rounded-xl bg-indigo-50 p-3 text-sm font-semibold text-indigo-800"><input type="checkbox" checked={values.habilitado} onChange={(e) => change('habilitado', e.target.checked)} />Respaldos automáticos activos</label>
              <AdminField label="Frecuencia"><select className={inputClass} value={values.frecuencia} onChange={(e) => change('frecuencia', e.target.value)}><option value="diaria">Diaria</option><option value="semanal">Semanal</option><option value="mensual">Mensual</option></select></AdminField>
              <AdminField label="Hora de ejecución" hint="Hora de Nicaragua (UTC−6)."><input className={inputClass} type="time" required value={values.hora} onChange={(e) => change('hora', e.target.value)} /></AdminField>
              {values.frecuencia === 'semanal' && <AdminField label="Día de la semana"><select className={inputClass} value={values.dia_semana} onChange={(e) => change('dia_semana', Number(e.target.value))}>{['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((day, i) => <option key={day} value={i}>{day}</option>)}</select></AdminField>}
              {values.frecuencia === 'mensual' && <AdminField label="Día del mes" hint="Entre 1 y 28 para que exista en todos los meses."><input className={inputClass} type="number" min="1" max="28" required value={values.dia_mes} onChange={(e) => change('dia_mes', e.target.value === '' ? '' : Number(e.target.value))} /></AdminField>}
              <AdminField label="Conservar copias durante (días)" hint="0 conserva todas. Un valor mayor elimina las copias completas gestionadas más antiguas; siempre conserva la última completa."><input className={inputClass} type="number" min="0" max="3650" required value={values.conservacion_dias} onChange={(e) => change('conservacion_dias', e.target.value === '' ? '' : Number(e.target.value))} /></AdminField>
            </> : fields[section].map(([key, label, type, min, max, hint]) => <div key={key} className={type === 'textarea' ? 'sm:col-span-2' : ''}><AdminField label={label} hint={hint}>
              {type === 'checkbox' ? <input type="checkbox" checked={values[key]} onChange={(e) => change(key, e.target.checked)} /> : type === 'textarea' ? <textarea className={inputClass} rows={3} maxLength={2000} required value={values[key]} onChange={(e) => change(key, e.target.value)} /> :
                <input className={inputClass} type={type} min={min ?? undefined} max={max ?? undefined} step={key === 'margen_repuesto_porcentaje' ? '0.01' : undefined} required={type === 'number' || key === 'nombre'} maxLength={type === 'number' ? undefined : 300} value={values[key]} onChange={(e) => change(key, type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />}
            </AdminField></div>)}
          </fieldset>
          {section === 'reglas' && ['tarifas_diagnostico', 'tarifas_mano_obra'].map((key) => <section key={key} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{key === 'tarifas_diagnostico' ? 'Tarifas de diagnóstico' : 'Tarifas de mano de obra'}</h3><p className="text-xs text-slate-500">Secretaría podrá elegir una tarifa o indicar un importe distinto al cobrar.</p></div><button type="button" className="rounded border px-3 py-2 text-sm text-indigo-700" onClick={() => change(key, [...(values[key] || []), { nombre: '', monto: 0 }])} disabled={saving || (values[key]?.length || 0) >= 30}>Agregar tarifa</button></div>
            {(values[key] || []).map((tarifa, index) => <div key={index} className="mb-2 flex flex-wrap items-end gap-2"><label className="flex-1 text-sm">Nombre<input className={inputClass} maxLength={100} required value={tarifa.nombre} onChange={(e) => change(key, values[key].map((item, i) => i === index ? { ...item, nombre: e.target.value } : item))} /></label><label className="w-36 text-sm">Monto C$<input className={inputClass} type="number" min="0.01" max="10000000" step="0.01" required value={tarifa.monto || ''} onChange={(e) => change(key, values[key].map((item, i) => i === index ? { ...item, monto: Number(e.target.value) } : item))} /></label><button type="button" className="rounded border px-3 py-2 text-sm text-red-700" onClick={() => change(key, values[key].filter((_, i) => i !== index))} disabled={saving}>Quitar</button></div>)}
            {!values[key]?.length && <p className="text-sm text-slate-500">Sin tarifas predefinidas.</p>}
          </section>)}
          <AdminField label="Motivo del cambio" hint="Se guardará con su usuario y la fecha en auditoría."><input className={inputClass} required minLength={5} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe por qué cambias esta configuración" disabled={saving} /></AdminField>
          <div className="flex flex-wrap gap-2"><AdminButton type="submit" disabled={saving}><Save size={16} />{saving ? 'Guardando…' : 'Guardar cambios'}</AdminButton><AdminButton secondary onClick={reload} disabled={saving}><RotateCcw size={16} />Recargar valores</AdminButton></div>
        </form>}
      {!loading && !values && <AdminButton secondary onClick={reload}>Reintentar</AdminButton>}
    </div>
  </AdminSection>;
}
