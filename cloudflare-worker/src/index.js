const ALLOWED_ORIGIN = 'https://vocabulary.click';
const FIREBASE_PROJECT_ID = 'vocabmaster-4c784';
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const ONE_SIGNAL_URL = 'https://api.onesignal.com/notifications';

let certificateCache = { expiresAt: 0, certificates: null };

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin'
    };
}

function json(body, status = 200, origin = ALLOWED_ORIGIN) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });
}

function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function decodeJson(value) {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

function pemToSpki(pem) {
    return decodeBase64Url(pem.replace(/-----(BEGIN|END) CERTIFICATE-----|\s/g, ''));
}

async function getFirebaseCertificates() {
    if (certificateCache.certificates && certificateCache.expiresAt > Date.now()) {
        return certificateCache.certificates;
    }

    const response = await fetch(FIREBASE_CERTS_URL);
    if (!response.ok) throw new Error('Unable to fetch Firebase signing certificates');

    const maxAge = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] || 3600);
    certificateCache = {
        certificates: await response.json(),
        expiresAt: Date.now() + maxAge * 1000
    };
    return certificateCache.certificates;
}

async function verifyFirebaseToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid Firebase token');

    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || !header.kid || claims.aud !== FIREBASE_PROJECT_ID ||
        claims.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
        !claims.sub || claims.exp <= now || claims.iat > now + 60) {
        throw new Error('Firebase token claims are invalid');
    }

    const certificates = await getFirebaseCertificates();
    const certificate = certificates[header.kid];
    if (!certificate) throw new Error('Unknown Firebase signing certificate');

    const key = await crypto.subtle.importKey(
        'spki', pemToSpki(certificate),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5', key, decodeBase64Url(parts[2]),
        new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) throw new Error('Firebase token signature is invalid');
    return claims;
}

function vietnamTime() {
    const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).formatToParts().filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

async function registerSubscription(request, env) {
    const origin = request.headers.get('Origin') || ALLOWED_ORIGIN;
    if (origin !== ALLOWED_ORIGIN) return json({ error: 'Origin is not allowed' }, 403, origin);

    const bearer = request.headers.get('Authorization') || '';
    if (!bearer.startsWith('Bearer ')) return json({ error: 'Sign-in is required' }, 401, origin);

    try {
        const claims = await verifyFirebaseToken(bearer.slice(7));
        const userId = claims.sub;
        const body = await request.json();
        const providedSubscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
        const reminderTime = typeof body.reminderTime === 'string' ? body.reminderTime : '';
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
            return json({ error: 'Invalid reminder settings' }, 400, origin);
        }
        const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
        // The email alias works on iOS even when OneSignal hides its subscription ID.
        const subscriptionId = providedSubscriptionId || (email ? `email:${email}` : `external:${userId}`);

        await env.REMINDERS_DB.prepare(`
            INSERT INTO reminder_subscriptions (user_id, subscription_id, enabled, reminder_time, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, subscription_id) DO UPDATE SET
              enabled = excluded.enabled,
              reminder_time = excluded.reminder_time,
              updated_at = excluded.updated_at
        `).bind(userId, subscriptionId, body.enabled === false ? 0 : 1, reminderTime, new Date().toISOString()).run();

        return json({ ok: true }, 200, origin);
    } catch (error) {
        console.error('Reminder registration failed', error);
        return json({ error: 'Unable to save reminder settings' }, 401, origin);
    }
}

async function sendPush(env, targetType, targetIds) {
    const targets = targetType === 'subscription' ? {
        include_subscription_ids: targetIds
    } : {
        include_aliases: { [targetType]: targetIds },
        target_channel: 'push'
    };
    const response = await fetch(ONE_SIGNAL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Key ${env.ONESIGNAL_API_KEY}`
        },
        body: JSON.stringify({
            app_id: env.ONESIGNAL_APP_ID,
            ...targets,
            headings: { en: 'VocabMaster' },
            contents: { en: 'Đã đến giờ ôn tập từ vựng! Hãy dành 5 phút để học nhé.' },
            url: 'https://vocabulary.click',
            ttl: 3600,
            priority: 10
        })
    });
    const payload = await response.json();
    if (!response.ok || !payload.id) throw new Error(`OneSignal rejected push: ${JSON.stringify(payload)}`);
}

async function sendDueReminders(env) {
    if (!env.ONESIGNAL_API_KEY) {
        console.warn('ONESIGNAL_API_KEY is not configured');
        return;
    }
    const { date, time } = vietnamTime();
    const { results } = await env.REMINDERS_DB.prepare(`
        SELECT user_id, subscription_id FROM reminder_subscriptions
        WHERE enabled = 1 AND reminder_time = ?
          AND (last_sent_date IS NULL OR last_sent_date != ?)
    `).bind(time, date).all();

    for (let index = 0; index < results.length; index += 1000) {
        const batch = results.slice(index, index + 1000);
        const subscriptionIds = batch
            .filter(row => !row.subscription_id.startsWith('external:') && !row.subscription_id.startsWith('email:'))
            .map(row => row.subscription_id);
        const externalIds = batch
            .filter(row => row.subscription_id.startsWith('external:'))
            .map(row => row.subscription_id.slice('external:'.length));
        const emails = batch
            .filter(row => row.subscription_id.startsWith('email:'))
            .map(row => row.subscription_id.slice('email:'.length));
        if (subscriptionIds.length > 0) await sendPush(env, 'subscription', subscriptionIds);
        if (externalIds.length > 0) await sendPush(env, 'external_id', externalIds);
        if (emails.length > 0) await sendPush(env, 'email', emails);
        await env.REMINDERS_DB.batch(batch.map(row => env.REMINDERS_DB.prepare(`
            UPDATE reminder_subscriptions SET last_sent_date = ?
            WHERE user_id = ? AND subscription_id = ?
        `).bind(date, row.user_id, row.subscription_id)));
    }
    console.log(`Reminder run ${date} ${time}: ${results.length} subscriptions`);
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request.headers.get('Origin')) });
        const pathname = new URL(request.url).pathname;
        if (request.method === 'GET' && pathname === '/health') return json({ ok: true, scheduler: 'Cloudflare Workers' });
        if (request.method === 'POST' && pathname === '/subscriptions') return registerSubscription(request, env);
        return json({ error: 'Not found' }, 404, request.headers.get('Origin'));
    },

    async scheduled(_event, env, ctx) {
        ctx.waitUntil(sendDueReminders(env));
    }
};
