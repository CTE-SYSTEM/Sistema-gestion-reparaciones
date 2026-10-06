import { Link } from 'react-router-dom';
import { UserRound, Users, Building2, SlidersHorizontal, DatabaseBackup, History } from 'lucide-react';
import { AdminPage } from '../components/AdministrationUI';
const sections = [
  ['Mi cuenta', 'Perfil, contraseña y cierre de sesiones.', '/admin/mi-cuenta', UserRound],
  ['Usuarios y acceso', 'Cuentas del personal, roles y estado de acceso.', '/admin/usuarios', Users],
  ['Negocio', 'Datos del taller, garantías y margen inicial de repuestos.', '/admin/configuracion', Building2],
  ['Reglas del negocio', 'Plazos, avisos y requisitos de cada página.', '/admin/reglas', SlidersHorizontal],
  ['Respaldos', 'Copias de la base, programación e integridad de archivos.', '/admin/respaldos', DatabaseBackup],
  ['Auditoría', 'Consultar quién modificó los datos y por qué.', '/admin/auditoria', History],
];
export default function Administracion() {
  return <AdminPage title="Administración" description="Gestiona la cuenta, las reglas y la continuidad del taller desde un mismo lugar."><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sections.map(([name, description, path, Icon]) => <Link key={path} to={path} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-300 hover:shadow-md"><Icon className="mb-5 h-8 w-8 text-indigo-600" /><h2 className="font-bold text-slate-800 group-hover:text-indigo-600">{name}</h2><p className="mt-2 text-sm text-slate-500">{description}</p></Link>)}</div></AdminPage>;
}
