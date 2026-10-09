import { useEffect, useState } from 'react';
import Autocomplete from '../../shared/components/Autocomplete';
import { getClientes } from '../../recepcion/services/clientesService';
import { getEquipos } from '../../recepcion/services/equiposService';
import { createOrdenDirecta } from '../services/ordenesService';

export default function OrdenDirectaForm({ onCreated, onCancel }) {
  const [clienteSearch, setClienteSearch] = useState('');
  const [equipoSearch, setEquipoSearch] = useState('');
  const [clientes, setClientes] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [buscandoEquipos, setBuscandoEquipos] = useState(false);
  const [form, setForm] = useState({ cliente_id: '', equipo_id: '', falla_reportada: '', prioridad: 'Normal', monto_autorizado: '', autorizado: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setBuscandoClientes(true);
      try {
        const { data } = await getClientes({ search: clienteSearch.trim(), page: 1, pageSize: 50 });
        if (active) setClientes(data.data || []);
      } catch {
        if (active) setError('No se pudieron buscar los clientes.');
      } finally {
        if (active) setBuscandoClientes(false);
      }
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [clienteSearch]);
  useEffect(() => {
    if (!form.cliente_id) { setEquipos([]); return undefined; }
    let active = true;
    const timer = window.setTimeout(async () => {
      setBuscandoEquipos(true);
      try {
        const { data } = await getEquipos({ cliente_id: form.cliente_id, search: equipoSearch.trim(), page: 1, pageSize: 50 });
        if (active) setEquipos(data.data || []);
      } catch {
        if (active) setError('No se pudieron cargar los equipos de este cliente.');
      } finally {
        if (active) setBuscandoEquipos(false);
      }
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [form.cliente_id, equipoSearch]);

  const clientesDisponibles = clienteSeleccionado && !clientes.some((c) => c.id_cliente === clienteSeleccionado.id_cliente)
    ? [clienteSeleccionado, ...clientes] : clientes;
  const equiposDisponibles = equipoSeleccionado && !equipos.some((e) => e.id_equipo === equipoSeleccionado.id_equipo)
    ? [equipoSeleccionado, ...equipos] : equipos;
  const change = (key, value) => { setForm((prev) => ({ ...prev, [key]: value })); setError(''); };
  const changeCliente = (event) => {
    const id = event.target.value;
    setClienteSeleccionado(clientesDisponibles.find((c) => String(c.id_cliente) === String(id)) || null);
    setEquipoSeleccionado(null);
    setEquipoSearch('');
    setEquipos([]);
    setForm((prev) => ({ ...prev, cliente_id: id, equipo_id: '' }));
    setError('');
  };
  const changeEquipo = (event) => {
    const id = event.target.value;
    setEquipoSeleccionado(equiposDisponibles.find((e) => String(e.id_equipo) === String(id)) || null);
    change('equipo_id', id);
  };
  const save = async (event) => {
    event.preventDefault();
    if (!form.cliente_id || !form.equipo_id) { setError('Seleccione primero el cliente y uno de sus equipos.'); return; }
    if (equipoSeleccionado?.cliente_id !== Number(form.cliente_id)) { setError('El equipo seleccionado no pertenece a este cliente.'); return; }
    if (!form.autorizado) { setError('Confirme que el cliente autorizó la reparación y el monto.'); return; }
    setSaving(true); setError('');
    try {
      const { data } = await createOrdenDirecta(form);
      onCreated(data.data);
    } catch (e) { setError(e.response?.data?.error || 'No se pudo crear la orden directa'); }
    finally { setSaving(false); }
  };
  return <form onSubmit={save} className="rounded-xl border border-indigo-200 bg-white p-5 text-left shadow-sm">
    <h3 className="text-base font-bold">Orden directa para una falla conocida</h3>
    <p className="mt-1 text-xs text-slate-600">Para trabajos conocidos, como cambiar una pantalla. La orden quedará pendiente para que el jefe técnico asigne al responsable. Se facturan la mano de obra de reparación y las piezas utilizadas, sin cargo de diagnóstico.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Autocomplete
        label="Buscar cliente por nombre"
        name="cliente_id"
        value={form.cliente_id}
        onChange={changeCliente}
        onQueryChange={setClienteSearch}
        options={clientesDisponibles}
        getOptionValue={(cliente) => cliente.id_cliente}
        getOptionLabel={(cliente) => cliente.nombre || `Cliente #${cliente.id_cliente}`}
        getOptionDescription={(cliente) => `ID: ${cliente.id_cliente}${cliente.telefono ? ` · ${cliente.telefono}` : ''}`}
        placeholder="Nombre, teléfono o correo"
        helpText={buscandoClientes ? 'Buscando clientes…' : 'Seleccione el cliente de la lista de resultados.'}
        emptyMessage={buscandoClientes ? 'Buscando…' : 'No hay clientes con ese nombre'}
        required
      />
      <Autocomplete
        label="Equipo del cliente"
        name="equipo_id"
        value={form.equipo_id}
        onChange={changeEquipo}
        onQueryChange={setEquipoSearch}
        options={equiposDisponibles}
        getOptionValue={(equipo) => equipo.id_equipo}
        getOptionLabel={(equipo) => [equipo.tipo, equipo.marca, equipo.modelo].filter(Boolean).join(' ') || `Equipo #${equipo.id_equipo}`}
        getOptionDescription={(equipo) => [`ID: ${equipo.id_equipo}`, equipo.numero_serie ? `S/N: ${equipo.numero_serie}` : ''].filter(Boolean).join(' · ')}
        placeholder={form.cliente_id ? 'Seleccione o busque su equipo' : 'Seleccione primero al cliente'}
        helpText={form.cliente_id ? 'Se muestran únicamente los equipos de este cliente.' : 'Primero seleccione un cliente.'}
        emptyMessage={buscandoEquipos ? 'Buscando…' : 'Este cliente no tiene equipos con ese criterio'}
        disabled={!form.cliente_id}
        required
      />
      <label className="sm:col-span-2 text-sm font-medium">Falla conocida y trabajo solicitado<textarea className="mt-1 w-full rounded border p-2" required minLength={5} maxLength={2000} rows={3} value={form.falla_reportada} onChange={(e) => change('falla_reportada', e.target.value)} /></label>
      <label className="text-sm font-medium">Prioridad<select className="mt-1 w-full rounded border p-2" value={form.prioridad} onChange={(e) => change('prioridad', e.target.value)}><option value="Normal">Normal</option><option value="Alta">Alta</option><option value="Urgente">Urgente</option></select></label>
      <label className="text-sm font-medium">Monto autorizado C$<input className="mt-1 w-full rounded border p-2" type="number" min="0.01" step="0.01" required value={form.monto_autorizado} onChange={(e) => change('monto_autorizado', e.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-500">Registra la autorización del cliente. El cobro final se calcula al facturar la orden.</span></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autorizado} onChange={(e) => change('autorizado', e.target.checked)} />El cliente autorizó el trabajo y el monto.</label>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-4 flex gap-2"><button type="submit" disabled={saving} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creando…' : 'Crear orden directa'}</button><button type="button" onClick={onCancel} className="rounded border px-4 py-2 text-sm">Cancelar</button></div>
  </form>;
}
