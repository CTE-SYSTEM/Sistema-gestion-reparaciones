import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Table from '../../../components/Table';
import { AuthContext } from '../../../context/AuthContext';
import { Plus, X } from 'lucide-react';
import { downloadJsonPdf } from '../utils/csvExport';
import { usuariosService } from '../services';

const ASSIGNABLE_ROLES = ['Secretaria', 'TecnicoJefe', 'Tecnico'];
const PASSWORD_ADMIN_ROLES = ['admin_pro', 'Administrador', 'Admin'];

export default function UsuariosAvanzado() {
  const { user } = useContext(AuthContext);
  const [passwordMinimum, setPasswordMinimum] = useState(8);
  const isOwnAccount = (row) => row.id_usuario === user?.id || row.nombre_usuario === user?.username;
  
  // Estados de datos y carga
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');

  // Control del despliegue del formulario de creación
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Estados de formularios
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    nombre_usuario: '',
    correo_electronico: '',
    password: '',
    rol: 'Secretaria',
    activo: true,
    especialidad: '',
    horario: '',
    contacto: '',
  });

  // Estados de edición y contraseña
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState('');

  const [passwordUsuario, setPasswordUsuario] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  const canResetPassword = PASSWORD_ADMIN_ROLES.includes(user?.rol);

  // --- API Actions ---
  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await usuariosService.getUsuarios();
      const data = response.data?.data || [];
      setPasswordMinimum(response.data?.password_minimo || 8);
      
      const formatted = data.map((u) => ({
        id_usuario: u.id_usuario,
        nombre_usuario: u.nombre_usuario,
        correo_electronico: u.correo_electronico || '-',
        rol: u.rol,
        activo: u.activo ? 'Sí' : 'No',
        raw: u
      }));
      setUsuarios(formatted);
    } catch (e) {
      setError('Error de red o servidor al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  const handleToggleUsuarioActivo = async (id_usuario, estadoActual) => {
    const activo = estadoActual === 'Sí';
    const action = activo ? 'desactivar' : 'reactivar';
    if (!window.confirm(`¿Seguro que quieres ${action} este usuario?`)) return;

    setError('');
    setSuccessMessage('');
    try {
      await usuariosService.toggleActivo(id_usuario, !activo);
      setSuccessMessage(`Usuario ${activo ? 'desactivado' : 'reactivado'} correctamente.`);
      fetchUsuarios();
    } catch (err) {
      setError(err.response?.data?.error || `No se pudo ${action} al usuario`);
    }
  };

  const handleUpdateUsuario = async (event) => {
    event.preventDefault();
    if (!selectedUsuario) return;

    setEditLoading(true);
    setEditMessage('');
    try {
      await usuariosService.updateUsuario(selectedUsuario.id_usuario, {
        nombre_usuario: selectedUsuario.nombre_usuario,
        correo_electronico: selectedUsuario.correo_electronico === '-' ? null : selectedUsuario.correo_electronico,
        rol: selectedUsuario.rol,
        activo: selectedUsuario.activo === 'Sí',
      });
      setEditMessage('Usuario actualizado correctamente.');
      fetchUsuarios();
      setTimeout(() => setSelectedUsuario(null), 1000);
    } catch (err) {
      setEditMessage(err.response?.data?.error || 'No se pudo actualizar el usuario.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    if (!passwordUsuario) return;

    if (!newPassword.trim() || newPassword.length < passwordMinimum) {
      setPasswordMessage(`La nueva contraseña debe tener al menos ${passwordMinimum} caracteres.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage('La confirmación de contraseña no coincide.');
      return;
    }

    if (!adminPassword.trim()) {
      setPasswordMessage('Ingrese la contraseña del administrador.');
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage('');
    try {
      const response = await usuariosService.updatePassword(passwordUsuario.id_usuario, {
        password: newPassword,
        admin_password: adminPassword,
      });
      setPasswordMessage(response.data?.message || 'Contraseña actualizada correctamente.');
      setNewPassword('');
      setConfirmPassword('');
      setAdminPassword('');
      setTimeout(() => setPasswordUsuario(null), 1000);
    } catch (err) {
      setPasswordMessage(err.response?.data?.error || 'No se pudo actualizar la contraseña.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCreateUsuario = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!formData.nombre_usuario.trim() || !formData.password.trim() || !formData.rol.trim()) {
      setFormError('Nombre de usuario, contraseña y rol son obligatorios.');
      return;
    }

    setCreating(true);
    try {
      const response = await usuariosService.createUsuario({
        nombre_usuario: formData.nombre_usuario.trim(),
        correo_electronico: formData.correo_electronico.trim() || null,
        rol: formData.rol,
        password: formData.password,
        activo: formData.activo,
        especialidad: formData.rol === 'Tecnico' ? formData.especialidad.trim() || null : null,
        horario: formData.rol === 'Tecnico' ? formData.horario.trim() || null : null,
        contacto: formData.rol === 'Tecnico' ? formData.contacto.trim() || formData.correo_electronico.trim() || null : null,
      });

      if (response.data?.data) {
        setSuccessMessage('Usuario creado correctamente.');
        setFormData({
          nombre_usuario: '',
          correo_electronico: '',
          password: '',
          rol: 'Secretaria',
          activo: true,
          especialidad: '',
          horario: '',
          contacto: '',
        });
        fetchUsuarios();
        setTimeout(() => setShowCreateForm(false), 1500);
      } else {
        setFormError('No se pudo crear el usuario.');
      }
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || 'Error de red');
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // --- Columnas Memoizadas ---
  const columns = useMemo(() => [
    { header: 'ID', accessor: 'id_usuario' },
    { header: 'Usuario', accessor: 'nombre_usuario' },
    { header: 'Correo', accessor: 'correo_electronico' },
    { header: 'Rol', accessor: 'rol' },
    { header: 'Activo', accessor: 'activo' },
    {
      header: 'Acciones',
      accessor: 'acciones',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isOwnAccount(row)}
            title={isOwnAccount(row) ? 'Su cuenta debe permanecer activa.' : undefined}
            onClick={() => handleToggleUsuarioActivo(row.id_usuario, row.activo)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              row.activo === 'Sí' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {row.activo === 'Sí' ? 'Desactivar' : 'Reactivar'}
          </button>
          <button
            type="button"
            disabled={isOwnAccount(row)}
            onClick={() => { setSelectedUsuario(row); setEditMessage(''); setPasswordUsuario(null); }}
            className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-900"
          >
            Editar
          </button>
          {canResetPassword && !isOwnAccount(row) && (
            <button
              type="button"
              onClick={() => { setPasswordUsuario(row); setPasswordMessage(''); setNewPassword(''); setConfirmPassword(''); setAdminPassword(''); setSelectedUsuario(null); }}
              className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-700"
            >
              Contraseña
            </button>
          )}
        </div>
      ),
    },
  ], [canResetPassword, user?.id, user?.username]);

  // --- Filtrado Frontend ---
  const filteredUsuarios = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return usuarios;
    return usuarios.filter((u) => 
      [u.id_usuario, u.nombre_usuario, u.correo_electronico, u.rol, u.activo].some((field) => 
        field?.toString().toLowerCase().includes(term)
      )
    );
  }, [usuarios, searchText]);

  const userReportColumns = columns.filter((column) => column.accessor !== 'acciones');
  const downloadGeneralReport = () => {
    downloadJsonPdf(filteredUsuarios, userReportColumns, 'usuarios_general.pdf', 'Reporte General de Usuarios');
  };

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      {/* Bloque Informativo Oscuro */}
      <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-slate-300">
          Permite editar roles, cambiar estados de cuenta y controlar perfiles en el sistema.
        </p>
        
        <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadGeneralReport}
          disabled={filteredUsuarios.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-400"
        >
          Generar Reporte General
        </button>
        <button
          type="button"
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setFormError('');
            setSuccessMessage('');
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm transition-all ${
            showCreateForm 
              ? 'bg-rose-600 text-white hover:bg-rose-700' 
              : 'bg-white text-slate-900 hover:bg-slate-100'
          }`}
        >
          {showCreateForm ? (
            <>
              <X size={14} />
              <span>Cerrar Formulario</span>
            </>
          ) : (
            <>
              <Plus size={14} />
              <span>Añadir Usuario</span>
            </>
          )}
        </button>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* 1. Formulario Desplegable Nuevo Usuario */}
        {showCreateForm && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-800">Crear nuevo usuario</h3>
                <p className="text-xs text-gray-400">Agrega usuarios y asigna el rol correcto para el acceso.</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 self-start md:self-auto">
                Rol asignado: {formData.rol}
              </span>
            </div>

            {formError && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
            {successMessage && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>}

            <form onSubmit={handleCreateUsuario} className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold text-slate-700">Nombre de usuario</span>
                <input
                  type="text"
                  name="nombre_usuario"
                  value={formData.nombre_usuario}
                  onChange={handleInputChange}
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  placeholder="ejemplo123"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-700">Correo electrónico</span>
                <input
                  type="email"
                  name="correo_electronico"
                  value={formData.correo_electronico}
                  onChange={handleInputChange}
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  placeholder="usuario@correo.com"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-700">Contraseña</span>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  placeholder="********"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-700">Rol</span>
                <select
                  name="rol"
                  value={formData.rol}
                  onChange={handleInputChange}
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                >
                  <option value="Secretaria">Secretaria</option>
                  <option value="TecnicoJefe">Tecnico Jefe</option>
                  <option value="Tecnico">Tecnico</option>
                </select>
              </label>

              {formData.rol === 'Tecnico' && (
                <>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Especialidad</span>
                    <input
                      type="text"
                      name="especialidad"
                      value={formData.especialidad}
                      onChange={handleInputChange}
                      className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      placeholder="Ej: Microelectrónica"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Horario</span>
                    <input
                      type="text"
                      name="horario"
                      value={formData.horario}
                      onChange={handleInputChange}
                      className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      placeholder="Ej: L-V 08:00-17:00"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Contacto</span>
                    <input
                      type="text"
                      name="contacto"
                      value={formData.contacto}
                      onChange={handleInputChange}
                      className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      placeholder="Teléfono o email"
                    />
                  </label>
                </>
              )}

              <div className="md:col-span-2 flex items-center gap-3 text-sm text-slate-700 py-1">
                <input
                  type="checkbox"
                  name="activo"
                  id="activo-checkbox"
                  checked={formData.activo}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="activo-checkbox" className="cursor-pointer select-none font-semibold text-xs text-slate-700">Activo</label>
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-xl bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition disabled:bg-slate-400"
                >
                  {creating ? 'Creando usuario...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. Barra de Búsqueda */}
        <div className="flex justify-end bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscador inteligente: ID, usuario, correo, rol o estado..."
            className="w-full sm:w-80 rounded-xl border border-gray-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50"
          />
        </div>

        {/* 3. Listado de Usuarios */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Listado de usuarios</h3>
          {loading ? (
            <div className="py-8 text-center text-gray-400">Cargando listado...</div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl">{error}</div>
          ) : (
            <Table columns={columns} data={filteredUsuarios} sortable />
          )}
        </div>
      </div>

      {/* MODAL PARA EDICIÓN DE USUARIO */}
      {selectedUsuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-xl p-6 shadow-2xl relative transform transition-all scale-100">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-800">Editar perfil de usuario</h3>
              <p className="text-sm text-gray-400 mt-0.5">ID de cuenta: #{selectedUsuario.id_usuario}</p>
            </div>

            <form onSubmit={handleUpdateUsuario} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Nombre de usuario</label>
                <input
                  type="text"
                  value={selectedUsuario.nombre_usuario}
                  onChange={(e) => setSelectedUsuario((prev) => ({ ...prev, nombre_usuario: e.target.value }))}
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Correo electrónico</label>
                <input
                  type="email"
                  value={selectedUsuario.correo_electronico === '-' ? '' : selectedUsuario.correo_electronico}
                  onChange={(e) => setSelectedUsuario((prev) => ({ ...prev, correo_electronico: e.target.value }))}
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Rol</label>
                <select
                  value={selectedUsuario.rol}
                  onChange={(e) => setSelectedUsuario((prev) => ({ ...prev, rol: e.target.value }))}
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50"
                >
                  {!ASSIGNABLE_ROLES.includes(selectedUsuario.rol) && (
                    <option value={selectedUsuario.rol} disabled>{selectedUsuario.rol} (no asignable)</option>
                  )}
                  <option value="Secretaria">Secretaria</option>
                  <option value="TecnicoJefe">Tecnico Jefe</option>
                  <option value="Tecnico">Tecnico</option>
                </select>
              </div>
              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="edit-activo"
                  checked={selectedUsuario.activo === 'Sí'}
                  onChange={(e) => setSelectedUsuario((prev) => ({ ...prev, activo: e.target.checked ? 'Sí' : 'No' }))}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="edit-activo" className="text-sm text-slate-700 cursor-pointer select-none font-semibold">Cuenta Activa</label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUsuario(null)}
                  className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-400 transition"
                >
                  {editLoading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
              {editMessage && <div className="text-sm font-semibold text-indigo-600 mt-2 text-center">{editMessage}</div>}
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA CAMBIO DE CONTRASEÑA */}
      {canResetPassword && passwordUsuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-md p-6 shadow-2xl relative transform transition-all scale-100">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-800">Cambiar contraseña</h3>
              <p className="text-sm text-gray-400 mt-0.5">Usuario: <span className="font-bold text-slate-700">{passwordUsuario.nombre_usuario}</span></p>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Nueva contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50"
                  minLength={passwordMinimum}
                  autoComplete="new-password"
                  required
                  placeholder={`Mínimo ${passwordMinimum} caracteres`}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50"
                  minLength={passwordMinimum}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Contraseña del administrador</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50"
                  placeholder="Confirme su contraseña"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordUsuario(null)}
                  className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:bg-slate-400 transition"
                >
                  {passwordLoading ? 'Actualizando...' : 'Confirmar'}
                </button>
              </div>
              {passwordMessage && <div className="text-sm font-semibold text-amber-600 mt-2 text-center">{passwordMessage}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
