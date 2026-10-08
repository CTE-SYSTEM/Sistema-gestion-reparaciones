// frontend/src/features/secretaria/pages/Facturacion.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import { ArrowLeft, ChevronDown, ChevronUp, Eye, Printer, Save, Search } from 'lucide-react';
import Table from '../../../components/Table';
import { createFactura, createFacturaDiagnostico, getDiagnosticosParaFacturar, getFacturas, getOrdenesParaFacturar, getTarifasFacturacion } from '../services/facturasService';
import { getGarantias } from '../../garantias/services/garantiasService';
import { useInfiniteAreaList } from '../../shared/hooks/useInfiniteAreaList';
import { getHistorialOrden, registrarEntregaOrden } from '../../recepcion/services/ordenesService';
import FotosServicio from '../../shared/components/FotosServicio';
import HistorialEstados from '../../shared/components/HistorialEstados';

const money = (value) => `C$ ${Number(value || 0).toFixed(2)}`;
const IVA_RATE = 0.15;

const getClienteFactura = (factura) => (factura.orden?.diagnostico || factura.diagnostico)?.equipo?.cliente?.nombre || '';
const getClienteGarantia = (garantia) => garantia.factura?.orden?.diagnostico?.equipo?.cliente?.nombre || '';
const formatBool = (value) => (value ? 'Si' : 'No');
const getGarantiaFactura = (factura) => factura?.garantias?.[0] || null;

const getEquipoFactura = (factura) => [
  (factura?.orden?.diagnostico || factura?.diagnostico)?.equipo?.tipo,
  (factura?.orden?.diagnostico || factura?.diagnostico)?.equipo?.marca,
  (factura?.orden?.diagnostico || factura?.diagnostico)?.equipo?.modelo,
].filter(Boolean).join(' ') || 'Servicio tecnico';

const getRepuestosOrden = (orden) => orden?.repuestos_facturacion || orden?.repuestos_usados || [];

const getNombreRepuesto = (detalle) =>
  detalle?.pieza_solicitada || detalle?.repuesto?.nombre || 'Pieza sin nombre';

const getPrecioUnitarioRepuesto = (detalle) => {
  if (detalle?.precio_unitario_facturado !== null && detalle?.precio_unitario_facturado !== undefined) return Number(detalle.precio_unitario_facturado);
  if (detalle?.precio_unitario !== undefined) return Number(detalle.precio_unitario || 0);
  const costo = Number(detalle?.repuesto?.costo_individual || 0);
  const ganancia = Number(detalle?.repuesto?.ganancia_cordobas || 0);
  const porcentaje = Number(detalle?.repuesto?.porcentaje_de_ganacia || 0);

  if (ganancia > 0) return costo + ganancia;
  if (porcentaje > 0) return costo + ((costo * porcentaje) / 100);
  return costo;
};

const getTotalRepuesto = (detalle) => {
  if (detalle?.total_facturado !== null && detalle?.total_facturado !== undefined) return Number(detalle.total_facturado);
  if (detalle?.total !== undefined) return Number(detalle.total || 0);
  return Number(detalle?.cantidad_usada || 0) * getPrecioUnitarioRepuesto(detalle);
};

const getTicketParts = (factura) => (factura.orden?.repuestos_usados || [])
  .filter((item) => item.estado_aprobacion === 'APROBADO' && factura.orden?.estado !== 'IRREPARABLE');

const getTicketSubtitle = (factura) => !factura.orden_id
  ? 'Servicio de diagnóstico'
  : Number(factura.monto_repuestos || 0) > 0 ? 'Reparación y repuestos' : 'Servicio de reparación';

const getTicketCharges = (factura, repuestos = getTicketParts(factura)) => {
  const montoRepuestos = Number(factura.monto_repuestos || 0);
  const detalleCompleto = repuestos.length > 0
    && repuestos.every((item) => item.precio_unitario_facturado != null)
    && Math.abs(repuestos.reduce((sum, item) => sum + getTotalRepuesto(item), 0) - montoRepuestos) < 0.01;
  return [
    ...(Number(factura.monto_diagnostico || 0) > 0 ? [['Trabajo de diagnóstico', factura.monto_diagnostico]] : []),
    ...(factura.orden_id && montoRepuestos > 0 && !detalleCompleto ? [['Repuestos', factura.monto_repuestos]] : []),
    ...(factura.orden_id && Number(factura.mano_obra || 0) > 0 ? [['Mano de obra de reparación', factura.mano_obra]] : []),
  ];
};

const buildTicketHtml = (factura, { autoPrint = false } = {}) => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const cliente = getClienteFactura(factura) || 'Consumidor final';
  const equipo = getEquipoFactura(factura);
  const garantia = getGarantiaFactura(factura);
  const fecha = factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleString() : new Date().toLocaleString();
  const fechaInicioGarantia = garantia?.fecha_inicio ? new Date(garantia.fecha_inicio).toLocaleDateString() : '-';
  const fechaVencimientoGarantia = garantia?.fecha_vencimiento ? new Date(garantia.fecha_vencimiento).toLocaleDateString() : '-';
  const repuestos = getTicketParts(factura);
  const lines = [
    ...getTicketCharges(factura, repuestos),
    ['Subtotal', factura.subtotal],
    ...(Number(factura.impuestos || 0) > 0 ? [['IVA', factura.impuestos]] : []),
    ['TOTAL', factura.total],
  ];

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ticket #${factura.id_factura}</title>
        <style>
          body { font-family: Consolas, monospace; margin: 0; padding: 12px; color: #111; }
          .ticket { width: 280px; margin: 0 auto; }
          .center { text-align: center; }
          .line { border-top: 1px dashed #111; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; gap: 12px; margin: 4px 0; }
          .total { font-size: 18px; font-weight: 700; }
          .small { font-size: 11px; }
          @media print { body { padding: 0; } .ticket { width: 72mm; } }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="center">
            <strong>SISTEMA DE GESTION</strong><br />
            <span class="small">${getTicketSubtitle(factura)}</span><br />
            <span class="small">Managua, Nicaragua</span>
          </div>
          <div class="line"></div>
          <div class="small">
            Ticket: #${factura.id_factura}<br />
            ${factura.orden_id ? `Orden: #${factura.orden_id}` : `Diagnóstico: #${factura.diagnostico_id}`}<br />
            Fecha: ${fecha}<br />
            Cliente: ${escapeHtml(cliente)}<br />
            Equipo: ${escapeHtml(equipo)}<br />
            Pago: ${escapeHtml(factura.metodo_pago || '-')}
          </div>
          <div class="line"></div>
          ${repuestos.map((r) => `
            <div class="small">${escapeHtml(getNombreRepuesto(r))} · ${Number(r.cantidad_usada || 0)} ${r.precio_unitario_facturado == null ? '(precio histórico no registrado)' : `× ${money(getPrecioUnitarioRepuesto(r))} = ${money(getTotalRepuesto(r))}`}</div>
          `).join('')}
          <div class="line"></div>
          ${lines.map(([label, value], index) => `
            <div class="row ${index === lines.length - 1 ? 'total' : ''}">
              <span>${label}</span>
              <span>${money(value)}</span>
            </div>
          `).join('')}
          <div class="line"></div>
          <div class="center small">
            Gracias por su visita<br />
            ${garantia ? 'Conserve este ticket para garantía.' : 'Conserve este comprobante de pago.'}
          </div>
          ${garantia ? `<div class="line"></div>
          <div class="center">
            <strong>VOUCHER DE GARANTIA</strong><br />
            <span class="small">Garantia No. #${garantia.id_garantia}</span>
          </div>
          <div class="small">
            Factura: #${factura.id_factura}<br />
            Duracion: ${garantia.duracion_meses || 3} meses<br />
            Inicio: ${fechaInicioGarantia}<br />
            Vence: ${fechaVencimientoGarantia}<br />
            Cubre: reparacion realizada y repuestos instalados por el servicio.
          </div>
          <div class="line"></div>
          <div class="small">
            ${escapeHtml(garantia.condiciones || '')}
          </div>` : ''}
        </div>
        ${autoPrint ? '<script>window.print();</script>' : ''}
      </body>
    </html>
  `;
};

const FacturacionPage = () => {
  const { user } = useContext(AuthContext);
  const canDeliver = user?.rol !== 'Contabilidad';
  const [ordenes, setOrdenes] = useState([]);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [tarifas, setTarifas] = useState({ diagnostico: [], mano_obra: [] });
  const [tipoCobro, setTipoCobro] = useState('orden');
  const [tablaActiva, setTablaActiva] = useState('facturas');
  const [entregaFactura, setEntregaFactura] = useState(null);
  const [personaRecibe, setPersonaRecibe] = useState('');
  const [observacionEntrega, setObservacionEntrega] = useState('');
  const [historialOrden, setHistorialOrden] = useState([]);
  const [historialOrdenId, setHistorialOrdenId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [ticketReciente, setTicketReciente] = useState(null);
  const [autoIva, setAutoIva] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    orden_id: '',
    diagnostico_id: '',
    monto_diagnostico: '',
    monto_repuestos: '',
    mano_obra: '',
    impuestos: '',
    metodo_pago: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const facturasQuery = useInfiniteAreaList({
    queryKey: ['contabilidad', 'facturas'],
    queryFn: getFacturas,
    search: searchTerm,
  });
  const garantiasQuery = useInfiniteAreaList({
    queryKey: ['contabilidad', 'garantias'],
    queryFn: getGarantias,
    search: searchTerm,
  });
  const facturas = facturasQuery.rows;
  const garantias = garantiasQuery.rows;

  const subtotal = useMemo(() => {
    return Number(form.monto_diagnostico || 0) + (tipoCobro === 'orden' ? Number(form.monto_repuestos || 0) + Number(form.mano_obra || 0) : 0);
  }, [form.monto_diagnostico, form.monto_repuestos, form.mano_obra, tipoCobro]);

  const total = useMemo(() => subtotal + Number(form.impuestos || 0), [subtotal, form.impuestos]);
  const ivaSugerido = useMemo(() => Math.round(subtotal * IVA_RATE * 100) / 100, [subtotal]);

  const selectedOrden = useMemo(() => (
    ordenes.find((orden) => String(orden.id_orden) === String(form.orden_id))
  ), [ordenes, form.orden_id]);
  const isDirectOrder = tipoCobro === 'orden' && selectedOrden?.diagnostico?.origen_directo;

  const ticketFactura = useMemo(() => {
    if (!selectedTicketId) return null;
    return facturas.find((factura) => String(factura.id_factura) === String(selectedTicketId))
      || (String(ticketReciente?.id_factura) === String(selectedTicketId) ? ticketReciente : null);
  }, [facturas, selectedTicketId, ticketReciente]);

  useEffect(() => {
    if (!autoIva) return;
    setForm((prev) => ({ ...prev, impuestos: ivaSugerido.toFixed(2) }));
  }, [autoIva, ivaSugerido]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordenesResponse, diagnosticosResponse, tarifasResponse] = await Promise.all([getOrdenesParaFacturar(), getDiagnosticosParaFacturar(), getTarifasFacturacion()]);
      setOrdenes(ordenesResponse.data.data || []);
      setDiagnosticos(diagnosticosResponse.data.data || []);
      setTarifas(tarifasResponse.data.data || { diagnostico: [], mano_obra: [] });
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.details || 'No se pudo cargar facturacion');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tipoCobro === 'orden' && selectedOrden?.repuestos_pendientes_count > 0) {
      setError('Esta orden tiene repuestos pendientes de aprobacion. Apruebelos o rechacelos antes de crear la factura.');
      return;
    }
    if (!form.metodo_pago) {
      setError('Seleccione un metodo de pago antes de crear la factura.');
      return;
    }
    if (tipoCobro === 'diagnostico' && !Number(form.monto_diagnostico || 0)) {
      setError('Indique un cargo mayor que cero para facturar solo el diagnóstico.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await (tipoCobro === 'orden' ? createFactura : createFacturaDiagnostico)({
        ...form,
        subtotal: subtotal.toFixed(2),
        total: total.toFixed(2),
      });
      const facturaCreada = response.data?.data;
      setForm({ orden_id: '', diagnostico_id: '', monto_diagnostico: '', monto_repuestos: '', mano_obra: '', impuestos: '', metodo_pago: '' });
      setAutoIva(true);
      setShowForm(false);
      if (facturaCreada?.id_factura) {
        setTicketReciente(facturaCreada);
        setSelectedTicketId(String(facturaCreada.id_factura));
        setTablaActiva('ticket');
      }
      await Promise.all([
        loadData(),
        facturasQuery.refetch(),
        garantiasQuery.refetch(),
      ]);
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.details || 'Error al crear la factura');
    } finally {
      setLoading(false);
    }
  };

  const handleOrdenChange = (ordenId) => {
    const orden = ordenes.find((item) => String(item.id_orden) === String(ordenId));
    const montoCalculado = Number(orden?.monto_repuestos_calculado || 0).toFixed(2);

    setForm({
      ...form,
      orden_id: ordenId,
      monto_repuestos: ordenId ? montoCalculado : '',
      monto_diagnostico: ordenId ? '0.00' : '',
    });
  };

  const handleMoneyChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleManualImpuestoChange = (value) => {
    setAutoIva(false);
    setForm({ ...form, impuestos: value });
  };

  const applyIvaSugerido = () => {
    setAutoIva(true);
    setForm({ ...form, impuestos: ivaSugerido.toFixed(2) });
  };

  const printTicket = (factura) => {
    if (!factura) return;
    const popup = window.open('', 'ticket_sgr', 'width=380,height=640');
    if (!popup) return;
    popup.document.write(buildTicketHtml(factura, { autoPrint: true }));
    popup.document.close();
  };

  const saveTicket = async (factura) => {
    if (!factura) return;
    try {
      const fileName = `ticket-sgr-${factura.id_factura}.html`;
      const html = buildTicketHtml(factura);

      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'Ticket HTML', accept: { 'text/html': ['.html'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(new Blob([html], { type: 'text/html;charset=utf-8' }));
        await writable.close();
        return;
      }

      const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError('No se pudo guardar el ticket');
      }
    }
  };

  const viewTicket = (factura) => {
    setSelectedTicketId(String(factura.id_factura));
    setTablaActiva('ticket');
  };

  const guardarEntrega = async () => {
    if (!entregaFactura || !personaRecibe.trim()) { setError('Indique quién recibió el equipo'); return; }
    try {
      await registrarEntregaOrden(entregaFactura.orden_id, { persona_recibe: personaRecibe, observacion_entrega: observacionEntrega });
      setEntregaFactura(null);
      setPersonaRecibe('');
      setObservacionEntrega('');
      await Promise.all([facturasQuery.refetch(), garantiasQuery.refetch()]);
    } catch (err) { setError(err?.response?.data?.error || 'No se pudo registrar la entrega'); }
  };

  const columnasFacturas = [
    { header: 'ID', accessor: 'id_factura' },
    { header: 'Servicio', render: (row) => row.orden_id ? `Orden #${row.orden_id}` : `Diagnóstico #${row.diagnostico_id}` },
    { header: 'Cliente', accessor: 'cliente', render: getClienteFactura },
    { header: 'Fecha', accessor: 'fecha_emision', render: (row) => row.fecha_emision ? new Date(row.fecha_emision).toLocaleDateString() : '' },
    { header: 'Repuestos', accessor: 'monto_repuestos', render: (row) => row.monto_repuestos ? money(row.monto_repuestos) : '' },
    { header: 'Trabajo diagnóstico', render: (row) => row.monto_diagnostico ? money(row.monto_diagnostico) : '' },
    { header: 'Mano obra reparación', accessor: 'mano_obra', render: (row) => row.mano_obra ? money(row.mano_obra) : '' },
    { header: 'Impuestos', accessor: 'impuestos', render: (row) => row.impuestos ? money(row.impuestos) : '' },
    { header: 'Total', accessor: 'total', render: (row) => row.total ? money(row.total) : '' },
    { header: 'Pago', accessor: 'metodo_pago' },
    {
      header: 'Acciones',
      accessor: 'acciones',
      render: (row) => (
        <div className="flex flex-wrap gap-1"><button
          type="button"
          onClick={() => viewTicket(row)}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          <Eye className="h-4 w-4" /> Ver
        </button>
        {canDeliver && row.orden_id && row.orden?.estado !== 'ENTREGADO' && <button type="button" onClick={() => setEntregaFactura(row)} className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-800">Registrar entrega</button>}
        {canDeliver && row.orden_id && <button type="button" onClick={async () => {
          try { const response = await getHistorialOrden(row.orden_id); setHistorialOrden(response.data.data || []); setHistorialOrdenId(row.orden_id); }
          catch { setError('No se pudo cargar el historial de la orden'); }
        }} className="rounded border px-2 py-1 text-xs">Historial</button>}
        </div>
      ),
    },
  ];

  const columnasGarantias = [
    { header: 'ID', accessor: 'id_garantia' },
    { header: 'Factura', accessor: 'factura_id' },
    { header: 'Cliente', accessor: 'cliente', render: getClienteGarantia },
    { header: 'Orden', accessor: 'orden', render: (row) => row.factura?.orden_id || '' },
    { header: 'Duracion', accessor: 'duracion_meses', render: (row) => row.duracion_meses ? `${row.duracion_meses} meses` : '' },
    { header: 'Inicio', accessor: 'fecha_inicio', render: (row) => row.fecha_inicio ? new Date(row.fecha_inicio).toLocaleDateString() : '' },
    { header: 'Vence', accessor: 'fecha_vencimiento', render: (row) => row.fecha_vencimiento ? new Date(row.fecha_vencimiento).toLocaleDateString() : '' },
    { header: 'Condiciones', accessor: 'condiciones', contentClassName: 'max-w-[360px] whitespace-normal break-words leading-relaxed' },
  ];

  const columnasActivas = tablaActiva === 'facturas' ? columnasFacturas : columnasGarantias;
  const datosActivos = tablaActiva === 'facturas' ? facturas : garantias;
  const activeListQuery = tablaActiva === 'facturas' ? facturasQuery : garantiasQuery;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Facturacion</h1>
        <p className="text-gray-500">Campos reales: orden finalizada, montos, impuestos, total y metodo de pago.</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      {entregaFactura && (
        <section className="mb-5 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-emerald-900">Entrega de la orden #{entregaFactura.orden_id}</h2>
          <p className="mt-1 text-sm text-gray-600">Registre la foto de salida antes de confirmar la entrega. La garantía comenzará en la fecha de entrega.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Persona que recibió el equipo
              <input value={personaRecibe} onChange={(event) => setPersonaRecibe(event.target.value)} className="mt-1 w-full rounded border p-2" required />
            </label>
            <label className="text-sm">Observaciones de entrega
              <input value={observacionEntrega} onChange={(event) => setObservacionEntrega(event.target.value)} className="mt-1 w-full rounded border p-2" />
            </label>
          </div>
          <FotosServicio kind="ordenes" id={entregaFactura.orden_id} tipoInicial="FOTO_ENTREGA" />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={guardarEntrega} className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Confirmar entrega</button>
            <button type="button" onClick={() => setEntregaFactura(null)} className="rounded border px-3 py-2 text-sm">Cerrar</button>
          </div>
        </section>
      )}
      {historialOrdenId && <section className="mb-5 rounded-xl border bg-white p-4"><h2 className="mb-2 font-semibold">Historial de la orden #{historialOrdenId}</h2><HistorialEstados rows={historialOrden} /></section>}

      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-white px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Emitir nueva factura</h2>
          <p className="text-xs text-gray-500">Abra el formulario solo cuando vaya a registrar una factura.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((visible) => !visible)}
          aria-expanded={showForm}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          {showForm ? 'Cerrar formulario' : 'Nueva factura'}
          {showForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {showForm && (
      <form onSubmit={handleSubmit} className="mb-6 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2"><button type="button" onClick={() => { setTipoCobro('orden'); setAutoIva(true); setForm({ orden_id: '', diagnostico_id: '', monto_diagnostico: '', monto_repuestos: '', mano_obra: '', impuestos: '', metodo_pago: '' }); }} className={`rounded border px-3 py-2 text-sm ${tipoCobro === 'orden' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700'}`}>Orden de trabajo</button><button type="button" onClick={() => { setTipoCobro('diagnostico'); setAutoIva(true); setForm({ orden_id: '', diagnostico_id: '', monto_diagnostico: '', monto_repuestos: '', mano_obra: '', impuestos: '', metodo_pago: '' }); }} className={`rounded border px-3 py-2 text-sm ${tipoCobro === 'diagnostico' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700'}`}>Solo diagnóstico</button></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tipoCobro === 'orden' ? <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
            <select required value={form.orden_id} onChange={(e) => handleOrdenChange(e.target.value)} className="w-full border p-2 rounded-lg">
              <option value="">Seleccione una orden</option>
              {ordenes.map((orden) => (
                <option key={orden.id_orden} value={orden.id_orden}>
                  #{orden.id_orden} · {orden.diagnostico?.origen_directo ? 'Directa, sin diagnóstico' : 'Con diagnóstico'} · {orden.diagnostico?.equipo?.cliente?.nombre || 'Sin cliente'}{Number(orden.monto_repuestos_calculado || 0) > 0 ? ` · Piezas ${money(orden.monto_repuestos_calculado)}` : ''}
                </option>
              ))}
            </select>
          </div> : <div><label className="text-sm font-medium text-gray-700">Diagnóstico completado<select required value={form.diagnostico_id} onChange={(e) => setForm({ ...form, diagnostico_id: e.target.value })} className="mt-1 w-full rounded-lg border p-2"><option value="">Seleccione un diagnóstico</option>{diagnosticos.map((d) => <option key={d.id_diagnostico} value={d.id_diagnostico}>#{d.id_diagnostico} · {d.equipo?.cliente?.nombre} · {d.equipo?.marca} {d.equipo?.modelo}</option>)}</select></label><p className="mt-1 text-xs text-slate-500">Si el cliente continuará con la reparación, facture al terminar la orden para incluir ambos trabajos en una sola factura.</p></div>}
          {isDirectOrder ? <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900"><strong>Sin diagnóstico previo</strong><p className="mt-1">Esta orden directa no lleva cargo de diagnóstico. Se cobran la mano de obra de reparación y las piezas utilizadas.</p></div> : <div><label className="mb-1 block text-sm font-medium text-gray-700">Tarifa del trabajo de diagnóstico<select className="w-full rounded-lg border p-2" onChange={(e) => handleMoneyChange('monto_diagnostico', e.target.value)} value=""><option value="">Importe manual</option>{tarifas.diagnostico.map((t) => <option key={t.nombre} value={t.monto}>{t.nombre} · {money(t.monto)}</option>)}</select></label><Field label={tipoCobro === 'orden' ? 'Diagnóstico C$ (0 si no se cobra)' : 'Mano de obra del diagnóstico C$'} value={form.monto_diagnostico} onChange={(value) => handleMoneyChange('monto_diagnostico', value)} /></div>}
          {tipoCobro === 'orden' && <>{Number(form.monto_repuestos || 0) > 0 && <Field label="Monto repuestos" value={form.monto_repuestos} onChange={(value) => setForm({ ...form, monto_repuestos: value })} readOnly />}<div><label className="mb-1 block text-sm font-medium text-gray-700">Tarifa de reparación<select className="w-full rounded-lg border p-2" onChange={(e) => handleMoneyChange('mano_obra', e.target.value)} value=""><option value="">Importe manual</option>{tarifas.mano_obra.map((t) => <option key={t.nombre} value={t.monto}>{t.nombre} · {money(t.monto)}</option>)}</select></label><Field label="Mano de obra de reparación C$" value={form.mano_obra} onChange={(value) => handleMoneyChange('mano_obra', value)} /></div></>}
          <Field label="Impuestos" value={form.impuestos} onChange={handleManualImpuestoChange} helper={`IVA sugerido 15%: ${money(ivaSugerido)}`} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metodo de pago</label>
            <select required value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })} className="w-full border p-2 rounded-lg">
              <option value="">Seleccione metodo</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Pendiente">Pendiente de pago</option>
            </select>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <div className="text-sm text-gray-500">Subtotal</div>
            <div className="font-semibold">{money(subtotal)}</div>
            <div className="text-sm text-gray-500 mt-2">Total</div>
            <div className="font-semibold">{money(total)}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <button type="button" onClick={applyIvaSugerido} className="rounded-lg border border-indigo-200 px-3 py-2 font-medium text-indigo-700 hover:bg-indigo-50">
            Aplicar IVA 15%
          </button>
          <span>{autoIva ? 'IVA automatico activo' : 'IVA editado manualmente'}</span>
          <span>Facturar no marca el equipo como entregado; registre su entrega por separado.</span>
        </div>
        {selectedOrden?.estado === 'IRREPARABLE' && <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Orden irreparable: las piezas no se cobran. Registre la mano de obra efectivamente realizada y el diagnóstico si corresponde.</p>}
        {selectedOrden && (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-950">
            <div className="font-semibold">Detalle de la orden #{selectedOrden.id_orden}</div>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <div className="rounded-md bg-white px-3 py-2">
                <div className="text-xs font-semibold uppercase text-indigo-500">Equipo</div>
                <div>{[selectedOrden.diagnostico?.equipo?.marca, selectedOrden.diagnostico?.equipo?.modelo].filter(Boolean).join(' ') || 'Sin equipo'}</div>
              </div>
              <div className="rounded-md bg-white px-3 py-2">
                <div className="text-xs font-semibold uppercase text-indigo-500">Recepcion</div>
                <div>Cargador: {selectedOrden.diagnostico?.estado_cargador || '-'} | Enciende: {selectedOrden.diagnostico?.estado_encendido || '-'}</div>
              </div>
              <div className="rounded-md bg-white px-3 py-2">
                <div className="text-xs font-semibold uppercase text-indigo-500">Corriente AC</div>
                <div>{selectedOrden.diagnostico?.estado_corriente_ac || '-'}</div>
              </div>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <div className="rounded-md bg-white px-3 py-2">
                <div className="text-xs font-semibold uppercase text-indigo-500">Resultado</div>
                <div>{selectedOrden.resultado_final || selectedOrden.estado || 'Sin cierre'}</div>
              </div>
              <div className="rounded-md bg-white px-3 py-2">
                <div className="text-xs font-semibold uppercase text-indigo-500">Enciende al salir</div>
                <div>{selectedOrden.enciende_salida === null || selectedOrden.enciende_salida === undefined ? 'No registrado' : formatBool(selectedOrden.enciende_salida)}</div>
              </div>
              <div className="rounded-md bg-white px-3 py-2">
                <div className="text-xs font-semibold uppercase text-indigo-500">AC al salir</div>
                <div>{selectedOrden.usa_corriente_ac_salida === null || selectedOrden.usa_corriente_ac_salida === undefined ? 'No registrado' : formatBool(selectedOrden.usa_corriente_ac_salida)}</div>
              </div>
            </div>
            {getRepuestosOrden(selectedOrden).length > 0 && <div className="mt-3 rounded-md bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-indigo-100 px-3 py-2">
                <div>
                  <div className="text-xs font-semibold uppercase text-indigo-500">Repuestos agregados</div>
                  {Number(selectedOrden.monto_repuestos_calculado || 0) > 0 && <div className="text-sm font-semibold text-indigo-950">
                    {money(selectedOrden.monto_repuestos_calculado)} facturable
                  </div>}
                </div>
                {selectedOrden.repuestos_pendientes_count > 0 && (
                  <span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                    {selectedOrden.repuestos_pendientes_count} pendiente(s)
                  </span>
                )}
              </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold uppercase">Pieza</th>
                        <th className="px-3 py-2 font-semibold uppercase">Estado</th>
                        <th className="px-3 py-2 text-right font-semibold uppercase">Cant.</th>
                        <th className="px-3 py-2 text-right font-semibold uppercase">Precio</th>
                        <th className="px-3 py-2 text-right font-semibold uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {getRepuestosOrden(selectedOrden).map((detalle) => {
                        const aprobado = String(detalle.estado_aprobacion || '').toUpperCase() === 'APROBADO';
                        return (
                          <tr key={detalle.id_detalle_repuesto}>
                            <td className="px-3 py-2 font-semibold text-gray-800">{getNombreRepuesto(detalle)}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded px-2 py-1 font-bold ${aprobado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                                {detalle.estado_aprobacion || 'PENDIENTE'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">{detalle.cantidad_usada || 0}</td>
                            <td className="px-3 py-2 text-right">{money(getPrecioUnitarioRepuesto(detalle))}</td>
                            <td className="px-3 py-2 text-right font-semibold">{aprobado ? money(getTotalRepuesto(detalle)) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            </div>}
          </div>
        )}
        <button type="submit" disabled={loading || !form.metodo_pago} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-60">
          Crear Factura
        </button>
      </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Historial</h2>
            <p className="text-sm text-gray-500">
              {tablaActiva === 'facturas' ? `${facturas.length} facturas registradas` : `${garantias.length} garantias registradas`}
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setTablaActiva('facturas')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${tablaActiva === 'facturas' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Facturas
            </button>
            <button
              type="button"
              onClick={() => setTablaActiva('garantias')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${tablaActiva === 'garantias' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Garantias
            </button>
          </div>
        </div>
        {tablaActiva !== 'ticket' && (
          <div className="border-b border-gray-100 p-4">
            <label className="relative block max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre del cliente..."
                className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>
        )}
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : tablaActiva === 'ticket' ? (
          <TicketTerminal
            ticketFactura={ticketFactura}
            onPrint={printTicket}
            onSave={saveTicket}
            onBack={() => {
              setSelectedTicketId('');
              setTablaActiva('facturas');
            }}
          />
        ) : (
          <Table
            columns={columnasActivas}
            data={datosActivos}
            onLoadMore={() => activeListQuery.fetchNextPage()}
            hasMore={tablaActiva !== 'ticket' && activeListQuery.hasNextPage}
            isLoadingMore={activeListQuery.isFetchingNextPage}
          />
        )}
      </div>
    </div>
  );
};

const TicketTerminal = ({ ticketFactura, onPrint, onSave, onBack }) => {
  if (!ticketFactura) return <div className="p-6 text-sm text-gray-500">No se encontró la factura. Vuelva al listado.</div>;
  const garantia = getGarantiaFactura(ticketFactura);
  const repuestos = getTicketParts(ticketFactura);
  const cargos = getTicketCharges(ticketFactura, repuestos);

  return (
    <div className="mx-auto max-w-xl p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded border px-3 py-2 text-sm"><ArrowLeft className="h-4 w-4" /> Volver</button>
        <button type="button" onClick={() => onPrint(ticketFactura)} className="inline-flex items-center gap-1 rounded border px-3 py-2 text-sm"><Printer className="h-4 w-4" /> Imprimir</button>
        <button type="button" onClick={() => onSave(ticketFactura)} className="inline-flex items-center gap-1 rounded border px-3 py-2 text-sm"><Save className="h-4 w-4" /> Guardar</button>
      </div>
      <div className="rounded border bg-white p-5 font-mono text-sm">
        <h3 className="text-center font-bold">SISTEMA DE GESTIÓN</h3>
        <p className="text-center text-xs">{getTicketSubtitle(ticketFactura)}</p>
        <TicketDivider />
        <p>Factura #{ticketFactura.id_factura} · {ticketFactura.orden_id ? `Orden #${ticketFactura.orden_id}` : `Diagnóstico #${ticketFactura.diagnostico_id}`}</p>
        <p>Cliente: {getClienteFactura(ticketFactura) || 'Consumidor final'}</p>
        <p>Equipo: {getEquipoFactura(ticketFactura)}</p>
        <p>Fecha: {ticketFactura.fecha_emision ? new Date(ticketFactura.fecha_emision).toLocaleString() : '-'}</p>
        <p>Pago: {ticketFactura.metodo_pago || '-'}</p>
        <TicketDivider />
        {repuestos.map((item) => (
          <TicketRow key={item.id_detalle_repuesto} label={`${getNombreRepuesto(item)} · ${item.cantidad_usada}`} value={item.precio_unitario_facturado == null ? 'Precio histórico no registrado' : `${money(getPrecioUnitarioRepuesto(item))} c/u · ${money(getTotalRepuesto(item))}`} />
        ))}
        {cargos.map(([label, value]) => <TicketRow key={label} label={label} value={money(value)} />)}
        <TicketRow label="Subtotal" value={money(ticketFactura.subtotal)} />
        {Number(ticketFactura.impuestos || 0) > 0 && <TicketRow label="IVA" value={money(ticketFactura.impuestos)} />}
        <TicketDivider />
        <TicketRow label="TOTAL" value={money(ticketFactura.total)} strong />
        <TicketDivider />
        {garantia && <><p className="text-center font-bold">VOUCHER DE GARANTÍA</p><p>Duración: {garantia.duracion_meses || 3} meses</p><p>Inicio: {garantia.fecha_inicio ? new Date(garantia.fecha_inicio).toLocaleDateString() : 'Pendiente de entrega'}</p><p>Vence: {garantia.fecha_vencimiento ? new Date(garantia.fecha_vencimiento).toLocaleDateString() : 'Pendiente de entrega'}</p></>}
      </div>
    </div>
  );
};
const TicketDivider = () => <div className="my-3 border-t border-dashed border-gray-400" />;

const TicketRow = ({ label, value, strong = false }) => (
  <div className={`flex items-center justify-between gap-4 ${strong ? 'text-base font-bold' : ''}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const Field = ({ label, value, onChange, readOnly = false, helper = '' }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type="number"
      min="0"
      step="0.01"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      className={`w-full border p-2 rounded-lg ${readOnly ? 'bg-gray-100 text-gray-700' : ''}`}
    />
    {helper && <div className="mt-1 text-xs text-gray-500">{helper}</div>}
  </div>
);

export default FacturacionPage;
