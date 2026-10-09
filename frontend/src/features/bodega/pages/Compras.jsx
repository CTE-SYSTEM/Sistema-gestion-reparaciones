import React, { useEffect, useState } from 'react';
import Table from '../../../components/Table';
import { CalendarDays, HelpCircle, Loader2, Plus, Search } from 'lucide-react';
import { GuidedTour, tourHighlightClass } from '../../shared/components/GuidedTour';
import { createCompra, getCompras, subirFotoCompra } from '../services/comprasService';
import FotosCompra from '../components/FotosCompra';
import RemotePhotoBridge from '../../shared/components/RemotePhotoBridge';
import CameraCapture from '../../shared/components/CameraCapture';
import { useQueryClient } from '@tanstack/react-query';
import { getProveedores } from '../services/proveedoresService';
import { getRepuestos } from '../services/repuestosService';
import { useInfiniteAreaList } from '../../shared/hooks/useInfiniteAreaList';
import { MAX_PHOTO_BYTES, PHOTO_LIMIT_LABEL } from '../../shared/components/photoQueue';

const normalizeText = (value = '') => String(value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
const money = (value) => `C$ ${Number(value || 0).toFixed(2)}`;
const purchaseDate = (value) => value ? new Date(value).toLocaleDateString('es-NI', { timeZone: 'UTC' }) : '-';
const todayInNicaragua = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const tourSteps = [
  { target: 'create', title: '1. Registrar compra', text: 'Nueva Compra abre el formulario para registrar entradas de repuestos.' },
  { target: 'form', title: '2. Datos principales', text: 'Seleccione proveedor y repuesto base. Si proveedor o costo cambian, la entrada se registra en otra variante.' },
  { target: 'numbers', title: '3. Cantidad y costo', text: 'La cantidad se registra como entrada de inventario; no decide si el repuesto es igual o diferente.' },
  { target: 'search', title: '4. Buscar compras', text: 'Filtra por proveedor, repuesto, documento o fechas para revisar entradas previas.' },
  { target: 'table', title: '5. Revisar historial', text: 'Abra una compra para revisar sus datos y las fotos del ticket en esta misma pantalla.' },
];



const CompraForm = ({ onSubmit, onCancel, proveedores = [], repuestos = [], activeTourTarget = '' }) => {
  const [formData, setFormData] = useState({
    proveedor_id: '',
    repuesto_id: '',
    documento: '',
    fecha_obtencion: todayInNicaragua(),
    cantidad: '1',
    costo_unitario: '',
    metodo_pago: '',
  });
  const [formError, setFormError] = useState('');
  const [ticketFotos, setTicketFotos] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const addTicketFotos = (files) => {
    const valid = files.filter((file) => ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) && file.size > 0 && file.size <= MAX_PHOTO_BYTES);
    if (valid.length !== files.length) setFormError(`Cada comprobante debe ser JPG, PNG, WebP o PDF y medir hasta ${PHOTO_LIMIT_LABEL}.`);
    if (valid.length) setTicketFotos((previous) => [...previous, ...valid]);
    return valid.length > 0;
  };

  const selectedRepuesto = repuestos.find((repuesto) => String(repuesto.id_repuesto) === String(formData.repuesto_id));
  const subtotal = Number(formData.cantidad || 0) * Number(formData.costo_unitario || 0);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormError('');

    if (name === 'repuesto_id') {
      const repuestoSel = repuestos.find((repuesto) => String(repuesto.id_repuesto) === String(value));
      setFormData((prev) => ({
        ...prev,
        repuesto_id: value,
        costo_unitario: repuestoSel?.costo_individual ? String(repuestoSel.costo_individual) : prev.costo_unitario,
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const cantidad = Number(formData.cantidad);
    const costo = Number(formData.costo_unitario);

    if (!formData.proveedor_id || !formData.repuesto_id) {
      setFormError('Seleccione proveedor y repuesto antes de guardar.');
      return;
    }

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setFormError('La cantidad debe ser un entero mayor que cero.');
      return;
    }

    if (!costo || costo <= 0) {
      setFormError('El costo unitario debe ser mayor que cero.');
      return;
    }

    if (!formData.metodo_pago) {
      setFormError('Seleccione un metodo de pago antes de guardar la compra.');
      return;
    }

    onSubmit({
      ...formData,
      documento: normalizeText(formData.documento),
      cantidad,
      costo_unitario: costo,
      ticketFotos,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div data-tour-target="form" className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${tourHighlightClass(activeTourTarget === 'form')}`}>
        <Select label="Proveedor" name="proveedor_id" value={formData.proveedor_id} onChange={handleChange} required>
          <option value="">Seleccione un proveedor</option>
          {proveedores.map((proveedor) => <option key={proveedor.id_proveedor} value={String(proveedor.id_proveedor)}>{proveedor.nombre}</option>)}
        </Select>

        <Select label="Repuesto" name="repuesto_id" value={formData.repuesto_id} onChange={handleChange} required>
          <option value="">Seleccione un repuesto</option>
          {repuestos.map((repuesto) => (
            <option key={repuesto.id_repuesto} value={String(repuesto.id_repuesto)}>
              {repuesto.nombre} - {repuesto.categoria?.nombre_tipo} - {repuesto.proveedor?.nombre || 'Sin proveedor'} - {money(repuesto.costo_individual)}
            </option>
          ))}
        </Select>

        <Field label="Numero de factura o recibo" name="documento" value={formData.documento} onChange={handleChange} placeholder="Factura o recibo" maxLength={80} />
        <Field label="Fecha de obtencion" name="fecha_obtencion" type="date" value={formData.fecha_obtencion} onChange={handleChange} />
      </div>

      <div data-tour-target="numbers" className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${tourHighlightClass(activeTourTarget === 'numbers')}`}>
        <Field label="Cantidad" name="cantidad" type="number" min="1" step="1" value={formData.cantidad} onChange={handleChange} required />
        <Field label="Costo unitario" name="costo_unitario" type="number" min="0.01" step="0.01" value={formData.costo_unitario} onChange={handleChange} required />
        <Select label="Metodo de pago" name="metodo_pago" value={formData.metodo_pago} onChange={handleChange} required>
          <option value="">Seleccione metodo</option>
          <option value="Efectivo">Efectivo</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Tarjeta">Tarjeta</option>
        </Select>
      </div>

      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
        <span className="font-bold">Total estimado:</span> {money(subtotal)}
        {selectedRepuesto?.costo_individual && (
          <span className="ml-2 text-xs">
            Variante actual: {selectedRepuesto.proveedor?.nombre || 'Sin proveedor'} | {money(selectedRepuesto.costo_individual)}
          </span>
        )}
        {selectedRepuesto && <div className="mt-1 text-xs">Stock actual: {selectedRepuesto.stock_actual ?? 0} · Stock mínimo: {selectedRepuesto.stock_minimo ?? 0} · Ubicación: {selectedRepuesto.ubicacion_fisica || 'No registrada'} (se editan en Repuestos).</div>}
      </div>
      <div className="space-y-2"><label className="block text-sm font-medium text-gray-700">Ticket, recibo o factura digital<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(e) => { addTicketFotos(Array.from(e.target.files || [])); e.target.value = ''; }} className="mt-1 block w-full text-xs" /><span className="mt-1 block text-xs font-normal text-slate-500">Opcional. Fotos o PDF de hasta {PHOTO_LIMIT_LABEL} por archivo; se guardan con la compra en R2 cuando está configurado.</span></label>
        <button type="button" onClick={() => setCameraOpen(true)} className="rounded border px-3 py-2 text-xs font-semibold text-indigo-700">Usar cámara de este equipo</button>
        <RemotePhotoBridge onAdd={addTicketFotos} />
        {cameraOpen && <CameraCapture onClose={() => setCameraOpen(false)} onCapture={(file) => addTicketFotos([file])} />}
        {ticketFotos.length > 0 && <ul className="space-y-1 text-xs">{ticketFotos.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded border bg-white p-2"><span className="truncate">{file.name}</span><button type="button" onClick={() => setTicketFotos((previous) => previous.filter((_, i) => i !== index))} className="text-red-700 underline">Quitar</button></li>)}</ul>}
      </div>

      {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{formError}</div>}

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancelar</button>
        <button type="submit" className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">Guardar Compra</button>
      </div>
    </form>
  );
};

const Field = ({ label, className = '', ...props }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={props.name}>{label}</label>
    <div className="relative"><input {...props} id={props.name} className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${props.type === 'date' ? 'pr-11' : ''}`} />
      {props.type === 'date' && <button type="button" aria-label={`Abrir calendario de ${label.toLowerCase()}`} onClick={(event) => event.currentTarget.previousElementSibling?.showPicker?.()} className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-indigo-700 hover:bg-indigo-50"><CalendarDays size={18} /></button>}
    </div>
  </div>
);

const Select = ({ label, children, className = '', ...props }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select {...props} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-all">
      {children}
    </select>
  </div>
);

const Compras = () => {
  const queryClient = useQueryClient();
  const [proveedores, setProveedores] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [compraSeleccionada, setCompraSeleccionada] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const comprasQuery = useInfiniteAreaList({
    queryKey: ['bodega', 'compras'],
    queryFn: getCompras,
    search: searchTerm,
    extraParams: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
  });
  const compras = comprasQuery.rows;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resP, resR] = await Promise.all([
        getProveedores({ page: 1, pageSize: 100 }),
        getRepuestos({ page: 1, pageSize: 100 }),
      ]);
      setProveedores(resP.data.data || []);
      setRepuestos(resR.data.data || []);
    } catch (err) {
      setError('Error al sincronizar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!compraSeleccionada) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setCompraSeleccionada(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [compraSeleccionada]);

  const activeTourTarget = showHelp ? tourSteps[tourStep].target : '';

  useEffect(() => {
    if (!showHelp || !activeTourTarget) return;
    const scrollTimer = window.setTimeout(() => {
      document
        .querySelector(`[data-tour-target="${activeTourTarget}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 80);

    return () => window.clearTimeout(scrollTimer);
  }, [activeTourTarget, showHelp]);

  const startTour = () => {
    setShowForm(true);
    setTourStep(0);
    setShowHelp(true);
  };

  const closeTour = () => {
    setShowHelp(false);
    setTourStep(0);
    setShowForm(false);
  };

  const handleTourNext = () => {
    if (tourStep === tourSteps.length - 1) {
      closeTour();
      return;
    }
    if (tourSteps[tourStep + 1]?.target === 'search') setShowForm(false);
    setTourStep((step) => step + 1);
  };

  const columnas = [
    { header: 'ID', accessor: 'id_compra' },
    { header: 'Proveedor', accessor: 'proveedor', render: (row) => row.proveedor?.nombre },
    { header: 'Repuesto', accessor: 'repuesto', render: (row) => (
      <div className="flex flex-col">
        <span>{row.repuesto?.nombre}</span>
        <span className="text-[10px] text-gray-400">{row.repuesto?.proveedor?.nombre || row.proveedor?.nombre || 'Sin proveedor'}</span>
      </div>
    ) },
    { header: 'Documento', accessor: 'documento', render: (row) => row.documento || '-' },
    { header: 'Fecha', accessor: 'fecha_obtencion', render: (row) => purchaseDate(row.fecha_obtencion) },
    { header: 'Cantidad', accessor: 'cantidad' },
    { header: 'Stock actual', render: (row) => row.repuesto?.stock_actual ?? 0 },
    { header: 'Stock mínimo', accessor: 'stock_minimo', render: (row) => row.repuesto?.stock_minimo ?? 0 },
    { header: 'Ubicación', accessor: 'ubicacion_fisica', render: (row) => row.repuesto?.ubicacion_fisica || '-' },
    { header: 'Costo', accessor: 'costo_unitario', render: (row) => money(row.costo_unitario) },
    { header: 'Total', render: (row) => money(Number(row.cantidad || 0) * Number(row.costo_unitario || 0)) },
    { header: 'Pago', accessor: 'metodo_pago', render: (row) => row.metodo_pago || '-' },
    { header: 'Comprobante', render: (row) => <button type="button" onClick={() => setCompraSeleccionada(row)} className="rounded border px-2 py-1 text-xs text-indigo-700">{row._count?.archivos ? `Revisar compra · ${row._count.archivos} comprobante(s)` : 'Revisar compra · agregar ticket'}</button> },
  ];

  const filteredCompras = compras;

  const handleSubmit = async (data) => {
    setLoading(true);
    setError(null);
    setNotice('');
    try {
      const { ticketFotos, ...compraData } = data;
      const response = await createCompra(compraData);
      const compraId = response.data?.data?.id_compra;
      setShowForm(false);
      setSearchTerm('');
      setFechaDesde('');
      setFechaHasta('');
      await loadData();
      let guardadas = 0;
      for (const file of ticketFotos) {
        try { await subirFotoCompra(compraId, file); guardadas += 1; }
        catch { setError(`Compra #${compraId} guardada, pero ${ticketFotos.length - guardadas} comprobante(s) del ticket quedaron pendientes. Puede agregarlas abajo.`); break; }
      }
      await queryClient.invalidateQueries({ queryKey: ['bodega', 'compras'] });
      setCompraSeleccionada(response.data?.data || null);
      if (!ticketFotos.length || guardadas === ticketFotos.length) setNotice(`Compra #${compraId} guardada${guardadas ? ` con ${guardadas} comprobante(s)` : ''}.`);
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo procesar la compra');
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="p-6 bg-gray-50 min-h-screen">
    {showHelp && (
      <GuidedTour
        steps={tourSteps}
        stepIndex={tourStep}
        onBack={() => setTourStep((step) => Math.max(step - 1, 0))}
        onClose={closeTour}
        onNext={handleTourNext}
      />
    )}

    {/* Encabezado Principal */}
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="text-left">
        <h2 className="text-3xl font-black text-gray-800 tracking-tight">Módulo de Compras</h2>
        <p className="text-sm font-medium text-gray-500 italic mt-0.5">Registro de adquisición de repuestos para inventario general.</p>
      </div>

      <div data-tour-target="create" className={`flex flex-wrap gap-3 ${tourHighlightClass(activeTourTarget === 'create')}`}>
        <button
          type="button"
          onClick={startTour}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-xs transition-all"
          title="Iniciar tutorial guiado"
        >
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <span>Ayuda</span>
        </button>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? 'Cerrar Formulario' : 'Nueva Compra'}</span>
        </button>
      </div>
    </div>

    {error && (
      <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded-r-lg flex items-center gap-2 text-left">
        <span>{error}</span>
      </div>
    )}
    {notice && <p role="status" className="mb-5 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

    {/* Formulario Modal/Desplegable */}
    {showForm && (
      <div className="mb-8 bg-white rounded-2xl shadow-xl border border-indigo-100 p-6 animate-in fade-in zoom-in duration-200 text-left">
        <h3 className="text-base font-bold mb-4 text-gray-800">Registrar Entrada de Mercancía</h3>
        <CompraForm
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          proveedores={proveedores}
          repuestos={repuestos}
          activeTourTarget={activeTourTarget}
        />
      </div>
    )}

    {/* Buscador */}
    <div data-tour-target="search" className={`mb-6 flex flex-wrap items-end gap-3 ${tourHighlightClass(activeTourTarget === 'search')}`}>
      <div className="relative min-w-64 max-w-xl flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por proveedor, repuesto, documento o pago..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      </div>
      <label className="text-xs font-medium text-slate-600">Desde<input aria-label="Compras desde" type="date" value={fechaDesde} max={fechaHasta || undefined} onChange={(event) => setFechaDesde(event.target.value)} className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2" /></label>
      <label className="text-xs font-medium text-slate-600">Hasta<input aria-label="Compras hasta" type="date" value={fechaHasta} min={fechaDesde || undefined} onChange={(event) => setFechaHasta(event.target.value)} className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2" /></label>
      {(searchTerm || fechaDesde || fechaHasta) && <button type="button" onClick={() => { setSearchTerm(''); setFechaDesde(''); setFechaHasta(''); }} className="rounded-lg border bg-white px-3 py-2 text-xs text-indigo-700">Limpiar filtros</button>}
    </div>
    {comprasQuery.isError && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">No se pudieron cargar las compras.</p>}
    {/* Tabla */}
    <div data-tour-target="table" className={`bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden ${tourHighlightClass(activeTourTarget === 'table')}`}>
      {loading || (comprasQuery.isLoading && !compras.length) ? (
        <div className="p-12 text-center text-xs font-bold text-indigo-600 flex justify-center items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Actualizando registros...</span>
        </div>
      ) : (
        <Table
          columns={columnas}
          data={filteredCompras}
          onLoadMore={() => comprasQuery.fetchNextPage()}
          hasMore={comprasQuery.hasNextPage}
          isLoadingMore={comprasQuery.isFetchingNextPage}
        />
      )}
    </div>
    {compraSeleccionada && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompraSeleccionada(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="detalle-compra-titulo" className="max-h-[90dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-indigo-100 bg-white p-5 text-left shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 id="detalle-compra-titulo" className="text-lg font-bold text-slate-800">Compra #{compraSeleccionada.id_compra}</h3><p className="text-sm text-slate-500">{purchaseDate(compraSeleccionada.fecha_obtencion)} · {compraSeleccionada.documento || 'Sin número de documento'}</p></div><button type="button" autoFocus onClick={() => setCompraSeleccionada(null)} className="rounded border px-3 py-1 text-sm text-slate-600">Cerrar</button></div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-slate-500">Proveedor</dt><dd className="font-medium">{compraSeleccionada.proveedor?.nombre || '-'}</dd></div><div><dt className="text-xs text-slate-500">Repuesto</dt><dd className="font-medium">{compraSeleccionada.repuesto?.nombre || '-'}</dd></div><div><dt className="text-xs text-slate-500">Cantidad y costo</dt><dd className="font-medium">{compraSeleccionada.cantidad} × {money(compraSeleccionada.costo_unitario)}</dd></div><div><dt className="text-xs text-slate-500">Total y pago</dt><dd className="font-medium">{money(Number(compraSeleccionada.cantidad || 0) * Number(compraSeleccionada.costo_unitario || 0))} · {compraSeleccionada.metodo_pago || '-'}</dd></div></dl>
        <FotosCompra key={compraSeleccionada.id_compra} id={compraSeleccionada.id_compra} onChanged={() => queryClient.invalidateQueries({ queryKey: ['bodega', 'compras'] })} />
      </section>
    </div>}
  </div>
);
};

export default Compras;
