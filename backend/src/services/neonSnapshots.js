const idPattern = /^[a-z0-9-]{1,60}$/;

const config = () => {
  const { NEON_API_KEY, NEON_PROJECT_ID, NEON_BRANCH_ID } = process.env;
  if (!NEON_API_KEY || !idPattern.test(NEON_PROJECT_ID || '') || !idPattern.test(NEON_BRANCH_ID || '')) {
    const error = new Error('Configure NEON_API_KEY, NEON_PROJECT_ID y NEON_BRANCH_ID para respaldos en Vercel.');
    error.status = 503;
    throw error;
  }
  return { token: NEON_API_KEY, project: NEON_PROJECT_ID, branch: NEON_BRANCH_ID };
};

const callNeon = async (method, path) => {
  const { token } = config();
  const response = await fetch(`https://console.neon.tech/api/v2${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const error = new Error(`Neon rechazó la operación de respaldo (${response.status}). Revise el plan, los permisos y los identificadores.`);
    error.status = response.status === 401 || response.status === 403 ? 503 : 502;
    throw error;
  }
  const body = await response.text();
  return body ? JSON.parse(body) : {};
};

export const createNeonSnapshot = async (name) => {
  const { project, branch } = config();
  const query = new URLSearchParams({ name });
  const result = await callNeon('POST', `/projects/${project}/branches/${branch}/snapshot?${query}`);
  const snapshot = result.snapshot || result;
  if (!idPattern.test(snapshot.id || '')) throw new Error('Neon no devolvió el identificador de la instantánea.');
  return { id: snapshot.id, project, branch, name, created_at: snapshot.created_at || new Date().toISOString() };
};

export const neonSnapshotExists = async (id) => {
  if (!idPattern.test(id || '')) return false;
  const { project, branch } = config();
  const result = await callNeon('GET', `/projects/${project}/snapshots`);
  const snapshots = Array.isArray(result) ? result : result.snapshots || [];
  return snapshots.some((snapshot) => snapshot.id === id && (!snapshot.source_branch_id || snapshot.source_branch_id === branch));
};

export const deleteNeonSnapshot = async (id) => {
  if (!idPattern.test(id || '')) throw new Error('Instantánea de Neon inválida.');
  const { project } = config();
  await callNeon('DELETE', `/projects/${project}/snapshots/${id}`);
};
