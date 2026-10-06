import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import ConfigurationEditor from '../components/ConfigurationEditor';
import { administracionService, errorText } from '../services/administracionService';
import { AdminPage, AdminSection, AdminNotice, AdminDataTable } from '../components/AdministrationUI';
const roles = [['administrador', 'Administrador'], ['secretaria', 'Secretaría'], ['tecnicojefe', 'Jefe técnico'], ['tecnico', 'Técnico']];
const permissions = { 'clientes:gestionar': 'Clientes', 'equipos:gestionar': 'Equipos', 'diagnosticos:gestionar': 'Recepción de diagnósticos', 'ordenes:gestionar': 'Órdenes', 'facturas:gestionar': 'Facturación', 'garantias:gestionar': 'Garantías', 'repuestos:gestionar': 'Catálogo de repuestos', 'compras:gestionar': 'Compras', 'proveedores:gestionar': 'Proveedores', 'flujo:ver': 'Ver flujo de atención', 'tecnico:trabajo': 'Trabajo técnico', 'jefe-tecnico:aprobar': 'Aprobar repuestos', 'jefe-tecnico:ver': 'Supervisión técnica', 'jefe-tecnico:asignar': 'Asignar técnicos', 'jefe-tecnico:prioridad': 'Cambiar prioridad', 'jefe-tecnico:equipo': 'Gestionar equipo técnico', 'jefe-tecnico:intervenir': 'Intervenir órdenes', 'repuestos:entregar': 'Entregar repuestos', 'admin:usuarios': 'Administrar usuarios', 'admin:reportes': 'Reportes administrativos' };
export default function ReglasNegocio() {
  const [rules, setRules] = useState(null), [error, setError] = useState('');
  useEffect(() => { let active = true; administracionService.getReglas().then(({ data }) => { if (active) setRules(data.data); }).catch(async (e) => { if (active) setError(await errorText(e)); }); return () => { active = false; }; }, []);
  return <AdminPage title="Reglas del negocio" description="Ajusta los plazos y consulta los requisitos que aplica el sistema en cada página."><AdminNotice error message={error} />
    <ConfigurationEditor section="reglas" title="Plazos y avisos" />
    <AdminSection title="Reglas por página" description="Estos requisitos protegen el proceso de recepción, reparación, cobro y entrega.">
      {!rules ? <p className="text-sm text-slate-500">Cargando reglas…</p> : <div className="grid gap-4 lg:grid-cols-2">{rules.modulos.map((m) => <article key={m.id} className="rounded-xl border border-slate-200 p-4"><Link to={m.ruta} className="flex items-center justify-between gap-2 font-bold text-indigo-700">{m.nombre}<ExternalLink size={15} /></Link><ul className="mt-3 space-y-2 text-sm text-slate-600">{m.reglas.map((r) => <li key={r} className="flex items-start gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" /><span>{r}</span></li>)}</ul>{m.estados && <div className="mt-4 flex flex-wrap gap-1">{m.estados.map((s) => <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600" key={s}>{s.replaceAll('_', ' ')}</span>)}</div>}</article>)}</div>}
    </AdminSection>
    {rules && <AdminSection title="Permisos por rol" description="Cada rol conserva sus responsabilidades. Los permisos se verifican también en el servidor."><AdminDataTable rows={Object.entries(permissions).map(([key, label]) => ({ permiso: label, ...Object.fromEntries(roles.map(([id]) => [id, rules.permisos[id]?.includes(key)])) }))} columns={[{ accessor: 'permiso', header: 'Acción' }, ...roles.map(([id, name]) => ({ accessor: id, header: name }))]} /></AdminSection>}
  </AdminPage>;
}
