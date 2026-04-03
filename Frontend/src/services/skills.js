import { api as apiRequest } from './api';

const DEFAULT_CATEGORY = 'General';

function normalizeSkillName(name) {
  return String(name || '').trim();
}

function toCatalogMap(habilidades) {
  const map = new Map();
  for (const item of habilidades || []) {
    if (typeof item?.nombre !== 'string' || !Number.isInteger(item?.id)) continue;
    map.set(item.nombre.trim().toLowerCase(), item.id);
  }
  return map;
}

export async function ensureSkillIds(apiBase, skillNames, token = null) {
  const cleaned = Array.from(new Set((skillNames || [])
    .map(normalizeSkillName)
    .filter(Boolean)));

  if (!cleaned.length) return [];

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // Obtenemos el catálogo completo de habilidades permitidas
  const response = await apiRequest(apiBase, '/habilidades', { headers });
  const idByName = toCatalogMap(response.habilidades);

  const ids = [];
  for (const name of cleaned) {
    const key = name.toLowerCase();
    const id = idByName.get(key);

    if (Number.isInteger(id)) {
      ids.push(id);
    } else {
      console.warn(`La habilidad "${name}" no existe en el catálogo y no puede ser creada.`);
    }
  }

  return ids;
}
