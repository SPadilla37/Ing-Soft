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

export async function ensureSkillIds(apiBase, skillNames) {
  const cleaned = Array.from(new Set((skillNames || [])
    .map(normalizeSkillName)
    .filter(Boolean)));

  if (!cleaned.length) return [];

  const initial = await apiRequest(apiBase, '/habilidades');
  let idByName = toCatalogMap(initial.habilidades);

  const ids = [];
  for (const name of cleaned) {
    const key = name.toLowerCase();
    let id = idByName.get(key);

    if (!Number.isInteger(id)) {
      try {
        const created = await apiRequest(apiBase, '/habilidades', {
          method: 'POST',
          body: JSON.stringify({
            nombre: name,
            categoria: DEFAULT_CATEGORY,
          }),
        });
        id = created?.habilidad?.id;
      } catch (error) {
        // If backend reports duplicate, refresh catalog and resolve by name.
        const message = String(error?.message || '').toLowerCase();
        if (!message.includes('existe')) throw error;
      }

      if (!Number.isInteger(id)) {
        const refreshed = await apiRequest(apiBase, '/habilidades');
        idByName = toCatalogMap(refreshed.habilidades);
        id = idByName.get(key);
      }
    }

    if (Number.isInteger(id)) {
      ids.push(id);
      idByName.set(key, id);
    }
  }

  return ids;
}
