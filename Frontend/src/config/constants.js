const rawApiBase = import.meta.env.VITE_API_BASE || "https://ing-soft-5shh.onrender.com";
export const API_BASE = rawApiBase.replace(/\/$/, "");

export const dbKeySession = "skillswap_session";
export const dbKeyEmail = "skillswap_email";
export const dbKeyToken = "skillswap_token";
export const dbKeyProfilePrefix = "skillswap_profile_";

export const skillsCatalog = {
  All: [],
  "Creative & Arts": ["Graphic Design", "UI/UX Design", "Illustration", "Animation", "Photography"],
  "Tech & Development": ["Python", "JavaScript", "React", "SQL", "Data Analysis"],
  "Language & Communication": ["English", "Spanish", "Public Speaking", "Writing", "French"],
  "Business & Marketing": ["Marketing", "Branding", "Sales", "SEO", "Storytelling"],
  "Career & Soft Skills": ["Leadership", "Productivity", "Interview Prep", "Negotiation", "Teamwork"],
  "Lifestyle, Games & Hobbies": ["Cooking", "Fitness", "Guitar", "Gardening", "Chess"],
};

export const languagesCatalog = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Russian", "Japanese"];

export let skillsMap = {};
export let skillsByCategory = {};
export let categoriesList = [];

export async function loadSkillsCatalog(api) {
  try {
    const result = await api("/habilidades");
    const habilidades = result.habilidades || [];

    skillsMap = {};
    skillsByCategory = {};
    categoriesList = ["All"];

    habilidades.forEach((hab) => {
      skillsMap[hab.nombre.toLowerCase()] = hab.id;

      const cat = hab.categoria || "Otros";
      if (!skillsByCategory[cat]) {
        skillsByCategory[cat] = [];
        categoriesList.push(cat);
      }
      skillsByCategory[cat].push(hab.nombre);
    });

    categoriesList.sort((a, b) => {
      if (a === "All") return -1;
      if (b === "All") return 1;
      return a.localeCompare(b);
    });
  } catch (error) {
    console.warn("[SkillSwap] No se pudo cargar el catalogo de habilidades:", error.message);
    skillsMap = {};
    skillsByCategory = {};
    categoriesList = ["All"];
  }
}

export function getSkillIdByName(name) {
  return skillsMap[name.toLowerCase()] || null;
}

export function getSkillNameById(id) {
  for (const [name, skillId] of Object.entries(skillsMap)) {
    if (skillId === id) return name;
  }
  return null;
}
