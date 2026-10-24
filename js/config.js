/* js/config.js — Configuration Supabase (URL + clé publique) — à adapter ici uniquement */

/* ---------- Supabase (synchronisation multi-appareils) ----------
   À CONFIGURER : voir supabase-setup.sql pour créer les tables, puis
   collez ci-dessous l'URL et la clé "anon" de votre projet Supabase
   (Project Settings → API). Tant que ce n'est pas fait, l'app
   fonctionne normalement en local uniquement (comme avant).
------------------------------------------------------------------- */
const SUPABASE_URL ='https://kklqpoflddczdsdmqdbz.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_h2c4Z9enMnFrd_G7D2BKug_8Hp_2w5G';
function supabaseConfigured() { return !SUPABASE_URL.startsWith('VOTRE_') && !SUPABASE_ANON_KEY.startsWith('VOTRE_'); }
