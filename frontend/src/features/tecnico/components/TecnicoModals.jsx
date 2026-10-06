import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';
import { RecepcionTecnica } from './ExpedienteTecnico';
import { X } from 'lucide-react';
import { EstadoBadge } from './TecnicoBadges';
import FotosServicio from '../../secretaria/components/shared/FotosServicio';
import { pruebasSalidaPorTipo } from '../utils/pruebasSalida';

const cleanCurrencyInput = (value = '') => String(value).replace(/[^\d.]/g, '');

const formatCurrencyInput = (value = '') => {
  const cleanValue = cleanCurrencyInput(value);
  if (!cleanValue) return '';

  const [integerPart, ...decimalParts] = cleanValue.split('.');
  const formattedInteger = integerPart.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') || '0';
  const decimalPart = decimalParts.join('').slice(0, 2);

  if (cleanValue.includes('.')) {
    return `${formattedInteger}.${decimalPart}`;
  }

  return formattedInteger;
};

const parseCurrencyInput = (value = '') => cleanCurrencyInput(value).replace(/(\..*)\./g, '$1');

const formatCurrencyDisplay = (value = '') => {
  const numeric = Number(String(value).replace(/[^\d.-]/g, ''));
  if (Number.isNaN(numeric)) return String(value || '');
  const [integerPart, decimalPart] = numeric.toFixed(2).split('.');
  return `${integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${decimalPart}`;
};

export const SolicitarRepuestoModal = ({ orden, onClose, onSubmit }) => {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null), [manual, setManual] = useState(false), [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState(1), [loading, setLoading] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (search === query) return;
    const timer = setTimeout(() => { setQuery(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search, query]);
  const catalogo = useQuery({ queryKey: ['tecnico-catalogo', query, page, orden.equipoTipo, cantidad],
    enabled: !manual,
    queryFn: async ({ signal }) => (await api.get('/tecnicos/catalogo', { signal, params: { search: query, page, tipo: orden.equipoTipo, cantidad } })).data });
  const send = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      if (manual ? !nombre.trim() : !selected) throw new Error('Seleccione una pieza o indique una pieza por registrar.');
      await onSubmit(orden.id, { repuesto_id: manual ? undefined : selected.id_repuesto,
        repuesto: manual ? nombre.trim() : selected.nombre, cantidad: Number(cantidad), solicitar_sin_registro: manual });
      onClose();
    } catch (err) { setError(err.response?.data?.error || err.message || 'No se pudo enviar la solicitud'); }
    finally { setLoading(false); }
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 tecnico-dialog">
    <div role="dialog" aria-modal="true" aria-labelledby="solicitud-pieza-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 text-slate-900 shadow-xl">
      <div className="mb-4 flex items-center justify-between"><h2 id="solicitud-pieza-title" className="text-lg font-bold">Solicitar pieza · Orden #{orden.id}</h2><button aria-label="Cerrar solicitud" onClick={onClose}><X /></button></div>
      <p className="mb-4 text-sm">{orden.equipo}</p>
      <form onSubmit={send} className="space-y-4">
        <label className="block text-sm">Cantidad<input type="number" min="1" step="1" required value={cantidad} onChange={(e) => { setCantidad(e.target.value); setSelected(null); }} className="mt-1 w-full rounded border bg-white p-2" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={manual} onChange={(e) => { setManual(e.target.checked); setSelected(null); }} /> Solicitar una pieza que no está registrada</label>
        {manual ? <label className="block text-sm">Descripción de la pieza<input required maxLength={180} value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full rounded border bg-white p-2" placeholder="Nombre, modelo y especificaciones técnicas" /></label> : <>
          <label className="block text-sm">Buscar piezas<input value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1 w-full rounded border bg-white p-2" placeholder="Nombre o descripción" /></label>
          {selected && <p className="rounded border border-indigo-200 p-2 text-sm">Seleccionada: <strong>{selected.nombre}</strong><button type="button" onClick={() => setSelected(null)} className="ml-3 underline">Cambiar</button></p>}
          {catalogo.isFetching && <p role="status" className="text-sm">Consultando disponibilidad…</p>}
          {catalogo.error && <p role="alert" className="text-sm text-red-700">No se pudo cargar el catálogo. <button type="button" onClick={() => catalogo.refetch()}>Reintentar</button></p>}
          <div className="max-h-52 space-y-2 overflow-y-auto">{(catalogo.data?.data || []).map((p) => <button key={p.id_repuesto} type="button" disabled={!p.disponible} onClick={() => setSelected(p)} className={'w-full rounded border p-3 text-left text-sm disabled:opacity-50 ' + (selected?.id_repuesto === p.id_repuesto ? 'border-indigo-500 bg-indigo-50' : '')}><strong>{p.nombre}</strong><span className="block text-xs">{p.descripcion}</span><span className="block text-xs">{p.disponible ? 'Disponible para la cantidad indicada' : 'Cantidad no disponible'}</span></button>)}</div>
          {!catalogo.isFetching && !catalogo.error && catalogo.data?.data.length === 0 && <p className="text-sm">No hay coincidencias en el catálogo. Puede describir una pieza por registrar.</p>}
          <div className="flex items-center justify-between gap-2 text-sm"><button type="button" disabled={page === 1 || catalogo.isFetching} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} · {catalogo.data?.meta.total || 0} piezas</span><button type="button" disabled={!catalogo.data?.meta.hasMore || catalogo.isFetching} onClick={() => setPage(page + 1)}>Siguiente</button></div>
        </>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" onClick={onClose}>Cancelar</button><button disabled={loading || (!manual && !selected)} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Enviando…' : 'Enviar solicitud'}</button></div>
      </form>
    </div>
  </div>;
};

export const DiagnosticoModal = ({ orden, readOnly = false, onClose, onSubmit, onSaveDraft }) => {
  const [diagnostico, setDiagnostico] = useState(orden.borrador?.diagnostico ?? orden.diagnostico ?? '');
  const [solucion, setSolucion] = useState(orden.borrador?.solucion ?? orden.solucion ?? '');
  const [presupuesto, setPresupuesto] = useState(formatCurrencyInput(orden.borrador?.presupuesto ?? orden.presupuesto ?? ''));
  const [moneda, setMoneda] = useState(orden.borrador?.moneda_presupuesto || orden.moneda_presupuesto || 'NIO');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [notice, setNotice] = useState('');
  const saveDraft = async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      await onSaveDraft(orden.id, { diagnostico, solucion, presupuesto: parseCurrencyInput(presupuesto), moneda_presupuesto: moneda });
      setNotice('Borrador guardado. El diagnóstico sigue en revisión.');
    } catch (err) { setError(err.response?.data?.error || 'No se pudo guardar el borrador'); }
    finally { setLoading(false); }
  };
  const handlePresupuestoChange = (event) => {
    setPresupuesto(formatCurrencyInput(event.target.value));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const presupuestoValue = parseCurrencyInput(presupuesto);
      await onSubmit(orden.id, {
        diagnostico,
        solucion,
        presupuesto: presupuestoValue === '' ? undefined : presupuestoValue,
        moneda_presupuesto: moneda,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar el diagnostico.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm tecnico-dialog">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 text-slate-900">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
              {readOnly ? 'Detalle Diagnostico' : 'Completar Diagnostico'}
            </h3>
            <EstadoBadge estado={orden.estado} />
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InfoBlock label="Equipo">#{orden.id} - {orden.equipo}</InfoBlock>
          <InfoBlock label="Falla reportada">{orden.falla}</InfoBlock>
          <RecepcionTecnica recepcion={orden.recepcion} />
          <FormTextarea label="Hallazgos" readOnly={readOnly} required rows="3" value={diagnostico} onChange={setDiagnostico} />
          <FormTextarea label="Accion / Solucion" readOnly={readOnly} required={!readOnly} rows="2" value={solucion} onChange={setSolucion} />
          <div>
            <label htmlFor="presupuesto-estimado" className="block text-[10px] font-black text-slate-500 uppercase mb-1">Presupuesto estimado</label>
            <div className="grid gap-2 sm:grid-cols-2">
            <select aria-label="Moneda del presupuesto" disabled={readOnly || loading} value={moneda} onChange={(e) => setMoneda(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
              <option value="NIO">Córdobas · C$ (NIO)</option><option value="USD">Dólares · US$ (USD)</option>
            </select>
            <input
              id="presupuesto-estimado"
              readOnly={readOnly}
              type="text"
              inputMode="decimal"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-purple-500 read-only:bg-slate-50"
              value={presupuesto}
              onChange={handlePresupuestoChange}
              placeholder="0.00"
            />
            </div>
          </div>
          <FotosServicio kind="diagnosticos" id={orden.id} tipoInicial="FOTO_DIAGNOSTICO" allowedTypes={['FOTO_DIAGNOSTICO']} readOnly={readOnly} />
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</div>}
          {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
          <div className="flex flex-wrap justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold uppercase text-slate-600">Cerrar</button>
            {!readOnly && <button type="button" disabled={loading} onClick={saveDraft} className="rounded border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700">Guardar borrador</button>}
            {!readOnly && (
              <button type="submit" disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold uppercase">
                {loading ? 'Guardando...' : 'Marcar Completado'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export const CierreOrdenModal = ({ orden, estado, onClose, onSubmit }) => {
  const esIrreparable = estado === 'IRREPARABLE';
  const [form, setForm] = useState({
    resultado_final: esIrreparable ? 'IRREPARABLE' : 'REPARADO',
    enciende_salida: '',
    usa_corriente_ac_salida: '',
    observacion_final: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const labels = { funcion_principal: 'Función principal', carga: 'Carga', pantalla: 'Pantalla', conectividad: 'Conectividad' };
  const pruebas = pruebasSalidaPorTipo(orden.equipoTipo).map((key) => [key, labels[key]]);
  const handleChange = (event) => {
    const { name, type, checked, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(orden.id, { estado, ...form,
        enciende_salida: form.enciende_salida === '' ? undefined : form.enciende_salida === 'true',
        usa_corriente_ac_salida: form.usa_corriente_ac_salida === '' ? undefined : form.usa_corriente_ac_salida === 'true',
        pruebas_salida: esIrreparable ? undefined : Object.fromEntries(pruebas.map(([key]) => [key, form[key]])),
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo cerrar la orden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm tecnico-dialog">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 text-slate-900">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
              {esIrreparable ? 'Marcar Irreparable' : 'Finalizar Orden'}
            </h3>
            <p className="text-xs font-semibold text-slate-500">Orden #{orden.id} - {orden.equipo}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Este cierre no cambia los datos de recepcion. Guarda el estado real del equipo al salir del taller.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Encendido al finalizar<select required={!esIrreparable} name="enciende_salida" value={form.enciende_salida} onChange={handleChange} className="mt-1 w-full rounded border bg-white p-2"><option value="">Seleccione resultado</option><option value="true">Enciende</option><option value="false">No enciende</option></select></label>
            <label className="text-sm">Probado con alimentación AC<select required={!esIrreparable} name="usa_corriente_ac_salida" value={form.usa_corriente_ac_salida} onChange={handleChange} className="mt-1 w-full rounded border bg-white p-2"><option value="">Seleccione resultado</option><option value="true">Sí, probado con AC</option><option value="false">No / No aplica</option></select></label>
          </div>
          {!esIrreparable && <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">Pruebas realizadas</legend>{pruebas.map(([key, label]) => <label key={key} className="block text-sm">{label}<select required name={key} value={form[key] || ''} onChange={handleChange} className="mt-1 w-full rounded border bg-white p-2"><option value="">Seleccione resultado</option><option value="CORRECTO">Correcto</option><option value="FALLA">Presenta falla</option><option value="NO_APLICA">No aplica</option></select></label>)}</fieldset>}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
              {esIrreparable ? 'Justificacion de irreparabilidad' : 'Observacion final'}
            </label>
            <textarea
              required
              rows="4"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
              name="observacion_final"
              value={form.observacion_final}
              onChange={handleChange}
               placeholder={esIrreparable ? 'Explique por que no se puede reparar y que se reviso.' : 'Explique pruebas realizadas y condicion de entrega.'}
            />
          </div>
          {esIrreparable && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              La orden quedara pendiente de revision del Jefe Tecnico antes de cerrar el flujo.
            </div>
          )}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold uppercase text-slate-600">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase">
              {loading ? 'Guardando...' : esIrreparable ? 'Guardar Irreparable' : 'Guardar Finalizacion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const InfoBlock = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">{label}</label>
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700">{children}</div>
  </div>
);

const FormTextarea = ({ label, value, onChange, ...props }) => (
  <div>
    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">{label}</label>
    <textarea
      {...props}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-purple-500 read-only:bg-slate-50"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);
