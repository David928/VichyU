// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

webpush.setVapidDetails(
  'mailto:contact@vichyu.fr',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req) => {
  const { title, body, url } = await req.json();
  if (!title || !body) return new Response('Paramètres manquants', { status: 400 });

  // Récupérer tous les abonnés
  const { data: subs, error } = await supabase.from('push_subscriptions').select('*');
  if (error) return new Response('Erreur Supabase', { status: 500 });

  const expiredIds: string[] = [];
  let sent = 0;

  await Promise.allSettled(
    (subs || []).map(async (sub) => {
      try {
        const keys = typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys;
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys },
          JSON.stringify({ title, body, url: url || '/' })
        );
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredIds.push(sub.id);
        }
      }
    })
  );

  // Nettoyer les abonnements expirés
  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds);
  }

  return new Response(JSON.stringify({ sent, cleaned: expiredIds.length }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
