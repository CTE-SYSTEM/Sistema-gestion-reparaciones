import { useCallback, useEffect, useState } from 'react';
import { DatabaseBackup, Download, ShieldCheck, RefreshCw, Clock, RotateCcw } from 'lucide-react';
import ConfigurationEditor from '../components/ConfigurationEditor';
import { administracionService, errorText, saveBlob } from '../services/administracionService';
import { AdminPage, AdminSection, AdminButton, AdminNotice, AdminDataTable, formatAdminDate, formatBytes } from '../components/AdministrationUI';
const statusNames = { COMPLETO: 'Base completa', PARCIAL: 'Copia parcial', FALLIDO: 'Fallido', EN_PROCESO: 'En proceso' };
function Status({ value }) { return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${value === 'COMPLETO' ? 'bg-emerald-100 text-emerald-800' : value === 'FALLIDO' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{statusNames[value] || value}</span>; }
export default function Respaldos() {
  const [summary, setSummary] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null), [confirmation, setConfirmation] = useState('');
  const reload = useCallback(async () => { setLoading(true); setError(''); try { const { data } = await administracionService.getBackups(); setSummary(data.data); } catch (e) { setError(await errorText(e)); } finally { setLoading(false); } }, []);
  useEffect(() => { reload(); }, [reload]);
  const create = async () => {
    setBusy('create'); setError(''); setMessage('');
    try { const { data } = await administracionService.createBackup(); setSummary(data.data); setPage(1); if (data.data.latestBackup.estado === 'COMPLETO') setMessage(data.message); else setError(data.message); }
    catch (e) { const detail = await errorText(e); await reload(); setError(detail); } finally { setBusy(''); }
  };
  const download = async (month, name) => { setBusy(name); setError(''); try {
    const { data } = await administracionService.downloadBackup(month, name);
    if (data.type?.startsWith('application/json')) {
      const signed = JSON.parse(await data.text());
      if (!signed.data?.url) throw new Error('No se pudo preparar la descarga.');
      window.location.assign(signed.data.url);
    } else saveBlob(data, name);
  } catch (e) { setError(await errorText(e)); } finally { setBusy(''); } };
  const verify = async (job) => { setBusy(job.id); setError(''); setMessage(''); try { const { data } = await administracionService.verifyBackup(job.month, job.manifest); setMessage(data.message); await reload(); } catch (e) { setError(await errorText(e)); } finally { setBusy(''); } };
  const restore = async () => {
    if (!selected || confirmation !== 'RESTAURAR') return;
    setBusy('restore'); setError(''); setMessage('');
    try {
      const { data } = await administracionService.restoreBackup(selected.month, selected.manifest, selected.id, confirmation);
      setSelected(null); setConfirmation('');
      setMessage(`${data.message} Copia previa: ${data.data.copia_previa.id}. Actualice el historial cuando finalice; quizá deba iniciar sesión otra vez.`);
    } catch (e) { setError(await errorText(e)); }
    finally { setBusy(''); }
  };
  const jobs = summary?.jobs || [], knownFiles = new Set(jobs.flatMap((j) => [j.manifest, ...j.archivos.map((f) => f.nombre)]));
  const columns = [{ accessor: 'inicio', header: 'Fecha', render: (j) => <div>{formatAdminDate(j.inicio)}<p className="mt-1 text-xs text-slate-400">{j.origen === 'programado' ? 'Programado' : j.origen === 'antes_de_restaurar' ? 'Copia previa a restauración' : 'Manual'} · {j.usuario}</p></div> },
    { accessor: 'estado', header: 'Estado', render: (j) => <div><Status value={j.estado} />{j.advertencias.map((a) => <p key={a} className="mt-2 text-xs text-amber-800">{a}</p>)}</div> },
    { accessor: 'archivos', header: 'Archivos', render: (j) => <div className="min-w-56 space-y-2">{j.archivos.map((f) => <button key={f.nombre} disabled={Boolean(busy)} onClick={() => download(j.month, f.nombre)} className="flex w-full items-start gap-2 text-left text-xs text-indigo-700 hover:underline disabled:opacity-50"><Download size={14} className="shrink-0" /><span className="break-all">{f.nombre}<span className="ml-2 text-slate-400">{formatBytes(f.bytes)}</span></span></button>)}</div> },
    { accessor: 'integridad', header: 'Comprobación', render: (j) => <div className="min-w-44"><p className="mb-2 text-xs text-slate-500">{j.integridad?.resultado === 'ARCHIVOS_VALIDOS' ? `Archivos válidos · ${formatAdminDate(j.integridad.verificada_en)}` : j.integridad?.resultado === 'ERROR' ? 'La última verificación falló.' : 'Sin verificar'}</p><AdminButton secondary disabled={Boolean(busy) || !['COMPLETO', 'PARCIAL'].includes(j.estado)} onClick={() => verify(j)}><ShieldCheck size={15} />{busy === j.id ? 'Verificando…' : 'Verificar archivos'}</AdminButton></div> },
    { accessor: 'restaurar', header: 'Recuperar', render: (j) => j.estado === 'COMPLETO' && j.archivos.some((f) => ['BASE_COMPLETA', 'BASE_NEON_SNAPSHOT'].includes(f.tipo)) ? <AdminButton secondary disabled={Boolean(busy)} onClick={() => { setSelected(j); setConfirmation(''); setError(''); }}><RotateCcw size={15} />Cargar esta versión</AdminButton> : <span className="text-xs text-slate-400">Copia no restaurable</span> }];
  return <AdminPage title="Respaldos de la base de datos" description="Genera copias, programa su ejecución y revisa los archivos disponibles." actions={<div className="flex flex-wrap gap-2"><AdminButton secondary onClick={reload} disabled={loading || Boolean(busy)}><RefreshCw size={16} />Actualizar</AdminButton><AdminButton onClick={create} disabled={loading || Boolean(busy)}><DatabaseBackup size={16} />{busy === 'create' ? 'Generando copia…' : 'Crear respaldo ahora'}</AdminButton></div>}>
    <AdminNotice error message={error} /><AdminNotice message={message} />
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{summary?.coverage || 'Los respaldos incluyen la base y el inventario. Las fotografías requieren una copia aparte.'} Cargar una versión anterior reemplaza los datos actuales de la base. El sistema comprueba la copia y guarda primero el estado actual.</p>
    {selected && <div role="dialog" aria-modal="true" aria-labelledby="restore-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
      <h2 id="restore-title" className="text-xl font-bold text-slate-900">Cargar una versión anterior</h2>
      <p className="mt-3 text-sm text-slate-700">Se reemplazarán los datos actuales por la copia del <strong>{formatAdminDate(selected.fin || selected.inicio)}</strong>. Se creará antes una copia del estado actual para poder recuperarlo.</p>
      <p className="mt-1 break-all text-xs text-slate-500">Versión: {selected.id}</p>
      <p className="mt-3 text-sm text-amber-800">Las fotografías y archivos externos no cambian con esta restauración. Evite registrar operaciones mientras se recuperan los datos.</p>
      <div className="mt-3"><AdminNotice error message={error} /></div>
      <label htmlFor="restore-confirmation" className="mt-5 block text-sm font-semibold text-slate-800">Escriba RESTAURAR para confirmar</label>
      <input id="restore-confirmation" autoFocus autoComplete="off" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <div className="mt-6 flex flex-wrap justify-end gap-2"><AdminButton secondary disabled={Boolean(busy)} onClick={() => { setSelected(null); setConfirmation(''); }}>Cancelar</AdminButton><AdminButton disabled={Boolean(busy) || confirmation !== 'RESTAURAR'} onClick={restore}><RotateCcw size={15} />{busy === 'restore' ? 'Restaurando…' : 'Cargar versión'}</AdminButton></div>
    </div></div>}
    {loading ? <p className="text-sm text-slate-500">Cargando respaldos…</p> : summary && <>
      <div className="grid gap-4 md:grid-cols-3">{[['Próxima ejecución', summary.schedule.habilitado ? formatAdminDate(summary.state?.proxima_ejecucion) : 'Programación desactivada'], ['Última copia completa', formatAdminDate(summary.latestComplete?.fin)], ['Copias registradas', jobs.length]].map(([title, value]) => <div className="rounded-2xl border border-slate-200 bg-white p-5" key={title}><Clock size={20} className="mb-3 text-indigo-500" /><p className="text-xs font-bold text-slate-500">{title}</p><p className="mt-2 text-lg font-bold text-slate-800">{value}</p></div>)}</div>
      {summary.state?.ultimo_error && <AdminNotice error message={`${summary.state.ultimo_error} Último intento: ${formatAdminDate(summary.state.ultimo_intento)}`} />}
      <AdminSection title="Historial de copias" description="Seleccione Cargar esta versión para recuperar los datos de una copia completa."><AdminDataTable rows={jobs} columns={columns} page={page} onPageChange={setPage} pageSize={10} empty="Todavía no hay copias registradas. Cree un respaldo para iniciar el historial." /></AdminSection>
      <AdminSection title="Otros archivos guardados" description="Archivos anteriores o sin un manifiesto verificable. Su presencia no confirma una copia completa."><div className="space-y-3">{summary.months.filter((m) => m.files.some((f) => !knownFiles.has(f))).map((m) => <details key={m.month} className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-bold text-slate-700">{m.month}</summary><div className="mt-3 flex flex-wrap gap-2">{m.files.filter((f) => !knownFiles.has(f)).map((f) => <button key={f} disabled={Boolean(busy)} onClick={() => download(m.month, f)} className="break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-50"><Download size={13} className="mr-1 inline" />{f}</button>)}</div></details>)}{!summary.months.some((m) => m.files.some((f) => !knownFiles.has(f))) && <p className="text-sm text-slate-500">No hay otros archivos.</p>}</div></AdminSection>
    </>}
    <ConfigurationEditor section="respaldos" title="Programación y conservación" onSaved={reload} />
    <p className="text-xs text-slate-500">La ejecución programada se realiza diariamente en Vercel o cada minuto en un servidor propio. Vercel puede iniciarla con retraso según el plan.</p>
  </AdminPage>;
}
