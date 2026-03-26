const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabase =
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)
        ? createClient(
              process.env.SUPABASE_URL,
              process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
          )
        : null;

if (!process.env.SUPABASE_URL) {
    console.error(
        "[Supabase] SUPABASE_URL bo'sh yoki undefined — createClient ishlamaydi."
    );
}
if (!process.env.SUPABASE_KEY && !process.env.SUPABASE_ANON_KEY) {
    console.error(
        "[Supabase] SUPABASE_KEY va SUPABASE_ANON_KEY ikkalasi ham bo'sh — createClient ishlamaydi."
    );
}
/** grammY bot bilan bir ro'yxat uchun: SUPABASE_USERS_TABLE=bot_users */
const USERS_TABLE = process.env.SUPABASE_USERS_TABLE || 'users';

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'blitz-logo.png');

/** /start kirish matnlari — tahrirlash uchun asosan shu blok */
const START_GREETING =
    "Assalomu alaykum\nBlitz nemis tili o'quv markazi botiga xush kelibsiz";
const START_CAPTION_NEW_USER = `${START_GREETING}\n\nIltimos, telefon raqamingizni yuboring:`;
const START_CAPTION_RETURNING = `${START_GREETING}\n\nQaytganingizdan xursandmiz!`;

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is required (Vercel Environment Variables yoki loyiha ildizidagi .env)');
const bot = new Telegraf(token);
const adminGroupId = '-1003356128763';

bot.use((ctx, next) => {
    if (ctx.message && typeof ctx.message.text === "string") {
        ctx.message.text = ctx.message.text
            .normalize("NFC")
            .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
            .trim();
    }
    return next();
});

const LESSON1_VIDEO_FILE_ID =
    'BAACAgIAAxkBAAPQabqPHBGMF4SuezNFGDJcxtkWfFgAAk1QAAIj70BKn2_zE9DFYZ46BA';

const BLITZ_CENTER_PHOTO_FILE_ID =
    'AgACAgIAAxkBAAIBpGm-23A6fAIRdyEtDO0C8qWylMxFAAKbFmsbXaT4SYO8PIz8vO9YAQADAgADeAADOgQ';

/** Barcha filiallar uchun umumiy rasm file_id (keyin har filial uchun alohida almashtirasiz). Hozircha markaz rasmi. */
const BRANCHES_PHOTO_FILE_ID = BLITZ_CENTER_PHOTO_FILE_ID;

/** Lokal: users.json. Vercel (Redis yo‘q): /tmp — barqaror emas. Production: Upstash Redis majburiy. */
const USERS_JSON =
    process.env.VERCEL === '1'
        ? path.join('/tmp', 'blitz-bot-users.json')
        : path.join(__dirname, '..', 'users.json');

/** Supabase yo'q yoki yozuv muvaffaqiyatsiz — ro'yxatdan o'tganlar (faqat API bot) */
const REGISTERED_JSON =
    process.env.VERCEL === '1'
        ? path.join('/tmp', 'blitz-bot-registered.json')
        : path.join(__dirname, '..', 'registered-users-api.json');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USER_SET_KEY = 'blitz:unique_users';

function hasUpstashRedis() {
    return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

async function upstashRedis(cmd) {
    const res = await fetch(UPSTASH_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(cmd),
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(text || `Upstash HTTP ${res.status}`);
    }
    if (!res.ok) {
        throw new Error(data?.error || text || `Upstash HTTP ${res.status}`);
    }
    return data;
}

/** Vergul bilan ajratilgan Telegram user id lar — /stats ni shaxsiy chatda ham ishlatish uchun */
function parseStatsAdminIds() {
    const raw = process.env.STATS_ADMIN_IDS || '';
    return raw
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
}

function isStatsAllowed(ctx) {
    if (String(ctx.chat?.id) === adminGroupId) return true;
    const allow = parseStatsAdminIds();
    if (allow.length && ctx.from && allow.includes(Number(ctx.from.id))) return true;
    return false;
}

function readRegisteredUserIds() {
    try {
        if (!fs.existsSync(USERS_JSON)) return [];
        const data = JSON.parse(fs.readFileSync(USERS_JSON, 'utf8'));
        return Array.isArray(data.ids) ? data.ids.map(Number) : [];
    } catch {
        return [];
    }
}

function writeRegisteredUserIds(ids) {
    const unique = [...new Set(ids.map(Number))];
    fs.writeFileSync(USERS_JSON, JSON.stringify({ ids: unique }, null, 2), 'utf8');
}

function readApiRegisteredIds() {
    try {
        if (!fs.existsSync(REGISTERED_JSON)) return [];
        const data = JSON.parse(fs.readFileSync(REGISTERED_JSON, 'utf8'));
        return Array.isArray(data.ids) ? data.ids.map(Number) : [];
    } catch {
        return [];
    }
}

function writeApiRegisteredIds(ids) {
    const unique = [...new Set(ids.map(Number))];
    fs.writeFileSync(REGISTERED_JSON, JSON.stringify({ ids: unique }, null, 2), 'utf8');
}

/**
 * @returns {Promise<{ registered: boolean, supabaseFailed: boolean }>}
 * supabaseFailed: o'qishda xato — foydalanuvchi "yangi" deb telefon so'raladi
 */
async function getRegistrationState(telegramUserId) {
    const id = Number(telegramUserId);
    if (!id || Number.isNaN(id)) {
        return { registered: false, supabaseFailed: false };
    }
    if (!supabase) {
        return {
            registered: readApiRegisteredIds().includes(id),
            supabaseFailed: false,
        };
    }
    try {
        const { data, error } = await supabase
            .from(USERS_TABLE)
            .select('telegram_user_id')
            .eq('telegram_user_id', id)
            .maybeSingle();
        if (error) throw error;
        return { registered: !!data, supabaseFailed: false };
    } catch (e) {
        console.error('Supabase getRegistrationState:', e);
        return { registered: false, supabaseFailed: true };
    }
}

/**
 * AmoCRM / Kommo: faqat serverdan chaqiring. Telegram webhook /api/bot da qolsin — aks holda menyu ishlamay qoladi.
 * AMOCRM_BASE_URL=https://SUBDOMAIN.amocrm.ru yoki https://SUBDOMAIN.kommo.com
 * AMOCRM_ACCESS_TOKEN — OAuth Bearer token
 * Ixtiyoriy: AMOCRM_PIPELINE_ID, AMOCRM_STATUS_ID, AMOCRM_PHONE_FIELD_ID, AMOCRM_TELEGRAM_FIELD_ID
 */
async function sendAmoCrmNewLead({
    firstName,
    phone,
    username,
    telegramUserId,
}) {
    const base = (process.env.AMOCRM_BASE_URL || "").replace(/\/$/, "");
    const token = process.env.AMOCRM_ACCESS_TOKEN || "";
    if (!base || !token) return;

    const contactCustomFields = [];
    const phoneFieldId = process.env.AMOCRM_PHONE_FIELD_ID;
    if (phoneFieldId) {
        contactCustomFields.push({
            field_id: Number(phoneFieldId),
            values: [{ value: String(phone) }],
        });
    } else {
        contactCustomFields.push({
            field_code: "PHONE",
            values: [{ value: String(phone), enum_code: "WORK" }],
        });
    }
    const tgFieldId = process.env.AMOCRM_TELEGRAM_FIELD_ID;
    if (tgFieldId) {
        contactCustomFields.push({
            field_id: Number(tgFieldId),
            values: [{ value: String(username) }],
        });
    }

    const lead = {
        name: `${firstName || "Telegram"} · TG ${telegramUserId}`,
        _embedded: {
            contacts: [
                {
                    name: firstName || "Telegram",
                    custom_fields_values: contactCustomFields,
                },
            ],
        },
    };

    const pid = process.env.AMOCRM_PIPELINE_ID;
    const sid = process.env.AMOCRM_STATUS_ID;
    if (pid && sid) {
        lead.pipeline_id = Number(pid);
        lead.status_id = Number(sid);
    }

    try {
        const res = await fetch(`${base}/api/v4/leads/complex`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify([lead]),
        });
        if (!res.ok) {
            console.error("AmoCRM leads/complex:", res.status, await res.text());
        }
    } catch (e) {
        console.error("AmoCRM:", e);
    }
}

async function trackUniqueUser(telegramUserId) {
    const id = Number(telegramUserId);
    if (!id || Number.isNaN(id)) return;
    if (hasUpstashRedis()) {
        try {
            await upstashRedis(['SADD', USER_SET_KEY, String(id)]);
        } catch (e) {
            console.error('Upstash SADD', e);
            try {
                const ids = readRegisteredUserIds();
                if (!ids.includes(id)) {
                    ids.push(id);
                    writeRegisteredUserIds(ids);
                }
            } catch (f) {
                console.error('trackUniqueUser fallback file', f);
            }
        }
        return;
    }
    try {
        const ids = readRegisteredUserIds();
        if (!ids.includes(id)) {
            ids.push(id);
            writeRegisteredUserIds(ids);
        }
    } catch (e) {
        console.error('trackUniqueUser file', e);
    }
}

async function getUniqueUserCount() {
    if (hasUpstashRedis()) {
        try {
            const data = await upstashRedis(['SCARD', USER_SET_KEY]);
            const n = data?.result;
            return typeof n === 'number' ? n : 0;
        } catch (e) {
            console.error('Upstash SCARD', e);
        }
    }
    return readRegisteredUserIds().length;
}

/** Shaxsiy chatdagi har bir foydalanuvchini (har qanday xabar) sanash */
bot.use(async (ctx, next) => {
    const chat = ctx.chat ?? ctx.callbackQuery?.message?.chat;
    const uid = ctx.from?.id;
    if (uid && chat?.type === 'private') {
        await trackUniqueUser(uid);
    }
    return next();
});

const BUTTONS = {
    lesson1: "Nemis tilidan birinchi darsni olish",
    germany: "Germaniya haqida ma'lumot",
    center: "Blitz nemis tili markazi haqida",
    addresses: "Bizning manzillar",
    back: "⬅️ Orqaga"
};

const GERMANY = {
    workVisa: "1️⃣ Ishchi visa",
    ausbildung: "2️⃣ Ausbildung",
    studienkolleg: "3️⃣ Studienkolleg",
    bachelor: "4️⃣ Bakalavr",
    master: "5️⃣ Magistr",
    sprachkurs: "6️⃣ Til kursi",
};

/**
 * Foydalanuvchi oqimi: /start → (kontakt) → asosiy menyu → Dars / Germaniya / Markaz / Manzillar.
 * Bu kalitlar ketma-ketlikni buzmaslik uchun — matnni shu yerda o'zgartiring.
 */
const BOT_FLOW = {
    MAIN_MENU: "Asosiy menyu:",
    ADDRESSES_PROMPT: "Kerakli filialni tanlang:",
    GERMANY_SECTION_PROMPT: "Kerakli bo'limni tanlang:",
    GERMANY_INTRO:
        "Germaniya — Yevropaning markazida joylashgan, iqtisodiy jihatdan rivojlangan davlatlardan biri. Yuqori turmush darajasi, sifatli ta'lim va kuchli sanoati bilan dunyoga mashhur. Quyida mamlakat haqida batafsilroq ma'lumot olishingiz mumkin:",
    LESSON_WAIT: "Birinchi dars yuklanmoqda, iltimos kuting... ⏳",
    CONTACT_INVALID:
        "Iltimos, o'zingizning telefon raqamingizni 📱 tugmasi orqali yuboring.",
    CONTACT_ALREADY: "Siz allaqachon ro'yxatdan o'tgansiz.",
    THANKS_REGISTER: "Rahmat, ro'yxatdan o'tdingiz!",
    CENTER_CAPTION:
        "<b>Blitz Nemis Tili Markazi</b>\nGermaniyada muvaffaqiyatli karyera qurishingiz uchun ishonchli ko'prik!",
    LESSON_CAPTION: "1-Dars: Ich heiße Miriam",
    VIDEO_MISSING:
        "Dars videosi hozircha mavjud emas. Keyinroq urinib ko'ring yoki markaz bilan bog'laning.",
    VIDEO_ERROR: "Video yuklashda xatolik yuz berdi.",
};

/** Telegram klaviaturasi ba'zan ma'lumot ichidagi ' ni Unicode (') qilib yuboradi; shuningdek eski deploy tugmalari */
const GERMANY_OPEN_TRIGGERS = [
    BUTTONS.germany,
    "Germaniya haqida ma'lumot olish",
    "🇩🇪 Germaniya haqida ma\u2019lumot",
    /^🇩🇪\s*Germaniya haqida ma['\u2019\u02BC]lumot(\s+olish)?$/u,
];

/**
 * Raqam tugmalari: klientlar turli keycap ketma-ketligi yuboradi; .{0,18} oralig'i emoji + bo'sh joyni qamrab oladi.
 */
const GERMANY_RX = {
    workVisa: /^1.{0,28}(?:Ishchi visa|ISHCHI VIZA)\s*$/iu,
    ausbildung: /^2.{0,28}(?:Ausbildung|AUSBILDUNG|Ausb)\s*$/iu,
    studienkolleg: /^3.{0,28}(?:Studienkolleg|STUDIENKOLLEG)\s*$/iu,
    bachelor: /^4.{0,28}(?:Bakalavr|BAKALAVR)\s*$/iu,
    master: /^5.{0,28}(?:Magistartura|MAGISTR|Magistr)\s*$/iu,
    sprachkurs: /^6.{0,28}(?:Til kursi|TIL KURSI)\s*$/iu,
};

function replyGermanyHtml(ctx, html) {
    const extra = { parse_mode: "HTML", ...germanySubmenuKeyboard() };
    return ctx
        .reply(html, extra)
        .catch(() =>
            ctx.reply(html.replace(/<[^>]+>/g, ""), germanySubmenuKeyboard())
        );
}

const GERMANY_DETAIL_HTML = {
    workVisa:
        "<b>1️⃣ Ishchi visa (Work Visa)</b>\n\n" +
        "<b>👤 Kimlar uchun?</b>\n\n" +
        "– Diplomga ega bo‘lganlar (kollej yoki bakalavr)\n" +
        "– Mutaxassisligi bo‘yicha ishlashni istaganlar\n" +
        "– Tezroq daromad va mustaqillikni xohlaganlar\n" +
        "– Oilasini keyinchalik olib kelmoqchi bo‘lganlar\n\n" +
        "<b>✅ Talablar:</b>\n\n" +
        "Diplom: kollej (3 yillik) yoki bakalavr\n" +
        "Til sertifikati: Goethe / Telc / ÖSD\n" +
        "Yosh: 20–40 yosh\n\n" +
        "<b>💰 Harajat:</b>\n\n" +
        "1 500$ – 2 500$\n\n" +
        "<b>🚀 Imkoniyatlar:</b>\n\n" +
        "✔️ Qonuniy ishlash va yashash\n" +
        "✔️ Yashash ruxsati\n" +
        "✔️ Ijtimoiy sug‘urta\n" +
        "✔️ Oilani chaqirish (daromad va uy yetarli bo‘lsa)\n" +
        "✔️ Bolalar bepul maktabga boradi\n" +
        "✔️ 3–5 yildan keyin doimiy yashash\n" +
        "✔️ Blue Card bo‘lsa muddat qisqaradi\n" +
        "✔️ Schengen hududida erkin safar\n\n" +
        "<b>Murojaat uchun : @Hoff_admin</b>",

    ausbildung:
        "<b>2️⃣ Ausbildung (Kasbiy ta’lim)</b>\n\n" +
        "<b>👤 Kimlar uchun?</b>\n\n" +
        "– 11 yillik ta’lim bitirganlar\n" +
        "– Universitet o‘qimasdan kasb egallamoqchilar\n" +
        "– O‘qish bilan birga maosh olishni xohlaganlar\n" +
        "– Yoshlar (odatda 18–30 yosh)\n\n" +
        "<b>✅ Talablar:</b>\n\n" +
        "11 yillik ta’lim\n" +
        "Nemis tili B1 (ba’zi sohalarga B2)\n" +
        "Yosh: odatda 30 yoshgacha\n\n" +
        "<b>💰 Harajat:</b>\n\n" +
        "1 500$ – 2 000$\n\n" +
        "<b>🚀 Imkoniyatlar:</b>\n\n" +
        "✔️ O‘qish davomida maosh\n" +
        "✔️ Rasmiy ish tajribasi\n" +
        "✔️ Sug‘urta va ijtimoiy tizim\n" +
        "✔️ Tugatgach ishga qolish\n" +
        "✔️ Keyinchalik ishchi vizaga o‘tish\n" +
        "✔️ Doimiy yashash imkoniyati\n" +
        "⚠️ Oila olib kelish paytida daromad talabi sababli qiyin bo‘lishi mumkin\n\n" +
        "<b>Murojaat uchun : @Hoff_admin</b>",

    studienkolleg:
        "<b>3️⃣ Studienkolleg (Tayyorlov bosqichi)</b>\n\n" +
        "<b>👤 Kimlar uchun?</b>\n\n" +
        "– 11 yillik maktab bitirganlar\n" +
        "– Diplomi Germaniya bakalavriga to‘g‘ri kelmaganlar\n\n" +
        "<b>✅ Talablar:</b>\n\n" +
        "Nemis tili B1–B2\n" +
        "Kirish imtihoni\n" +
        "Moliyaviy kafolat\n\n" +
        "<b>🚀 Imkoniyatlar:</b>\n\n" +
        "✔️ 1 yillik tayyorlov\n" +
        "✔️ Oxirida universitetga kirish huquqi\n" +
        "✔️ Bakalavrga ko‘prik\n" +
        "⚠️ Oila olib kelish deyarli mumkin emas.\n\n" +
        "<b>Murojaat uchun : @Hoff_admin</b>",

    bachelor:
        "<b>4️⃣ Bakalavr (Bachelor)</b>\n\n" +
        "<b>👤 Kimlar uchun?</b>\n\n" +
        "– Oliy ta’lim olishni istaganlar\n" +
        "– Akademik karyera rejasidagilar\n\n" +
        "<b>✅ Talablar:</b>\n\n" +
        "12 yillik ta’lim (11 yillik bo‘lsa Studienkolleg)\n" +
        "Nemis tili C1 (ba’zi yo‘nalishlarga B2)\n\n" +
        "<b>💰 Harajat:</b>\n\n" +
        "Oyiga 1 091 € bloklangan hisob\n" +
        "Chiqib ketguncha 1 500$ – 2 000$\n\n" +
        "<b>🚀 Imkoniyatlar:</b>\n\n" +
        "✔️ Haftasiga 20 soatgacha ishlash\n" +
        "✔️ Bitirgandan keyin 18 oy ish qidirish vizasi\n" +
        "✔️ Ish topsa ishchi vizaga o‘tish\n" +
        "✔️ Doimiy yashash imkoniyati\n\n" +
        "<b>Murojaat uchun : @Hoff_admin</b>",

    master:
        "<b>5️⃣ Magistr (Master)</b>\n\n" +
        "<b>👤 Kimlar uchun?</b>\n\n" +
        "– Bakalavrni tugatganlar\n" +
        "– Yuqori malaka va karyera istaganlar\n\n" +
        "<b>✅ Talablar:</b>\n\n" +
        "Tan olingan bakalavr diplomi\n" +
        "Nemis tili C1\n" +
        "Ingliz tili: IELTS kamida 6.5\n" +
        "Ba’zan motivatsion xat va tajriba\n\n" +
        "<b>🚀 Imkoniyatlar:</b>\n\n" +
        "✔️ Akademik daraja yuqori\n" +
        "✔️ Ish topish ehtimoli ko‘proq\n" +
        "✔️ 18 oy ish qidirish vizasi\n" +
        "✔️ Ishga o‘tgach doimiy yashash imkoniyati\n\n" +
        "<b>Murojaat uchun : @Hoff_admin</b>",

    sprachkurs:
        "<b>6️⃣ Til kursi (Sprachkurs Visasi)</b>\n\n" +
        "<b>👤 Kimlar uchun?</b>\n\n" +
        "– Nemis tilini Germaniyada o‘rganmoqchi bo‘lganlar\n" +
        "– Keyinchalik Ausbildung yoki universitetga kirishni rejalayotganlar\n" +
        "– Hozircha til darajasi yetarli bo‘lmaganlar\n\n" +
        "<b>✅ Talablar:</b>\n\n" +
        "– Nemis tili kamida A2 darajadan boshlanishi kerak\n" +
        "– Til kursiga qabul hujjati\n" +
        "– Moliyaviy kafolat\n\n" +
        "<b>💰 Harajat:</b>\n\n" +
        "– Oyiga 1 091 € bloklangan hisob\n" +
        "– Chiqib ketguncha taxminan 1 500$ – 2 000$ xizmat harajatlari\n\n" +
        "<b>🚀 Imkoniyatlar:</b>\n\n" +
        "✔️ Germaniyada tilni tez va muhitda o‘rganish\n" +
        "✔️ Keyinchalik Ausbildung yoki universitetga o‘tish imkoniyati\n" +
        "✔️ Yevropa muhitida yashab tilni rivojlantirish\n" +
        "✔️ Haftasiga 20 soatgacha ishlash imkoniyati\n\n" +
        "<b>Murojaat uchun : @Hoff_admin</b>",
};

function mainMenuKeyboard() {
    return Markup.keyboard([
        [BUTTONS.lesson1],
        [BUTTONS.germany],
        [BUTTONS.center],
        [BUTTONS.addresses]
    ]).resize();
}

function germanySubmenuKeyboard() {
    return Markup.keyboard([
        [GERMANY.workVisa, GERMANY.ausbildung],
        [GERMANY.studienkolleg, GERMANY.bachelor],
        [GERMANY.master, GERMANY.sprachkurs],
        [BUTTONS.back],
    ]).resize();
}

function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BRANCHES = [
    {
        titleLine: "Blitz nemis tili markazi | Mirzo Ulug'bek filiali",
        address: "Shoh, Bunyodkor shoh ko'chasi, 100003, Toshkent, Toshkent, Uzbekistan",
        directionsPrefix: "Metro",
        directionsText: "Mirzo Ulug'bek",
        bus: "150 | 2 | 94 | 98 | 33 | 114 | 150 | 9T | 56 | 23 | 146",
        phone: "+9987811377161",
        yandexUrl:
            "https://yandex.uz/maps/org/155558165926/?ll=69.213441%2C41.283964&z=16.63",
        googleUrl:
            "https://www.google.com/maps/place/Blitz+nemis+tili+markazi/@41.2839105,69.2136383,213m/data=!3m1!1e3!4m6!3m5!1s0x38ae8b411b649a3b:0xb94da3066cbfead7!8m2!3d41.2839583!4d69.2133769!16s%2Fg%2F11ssrrr592?entry=ttu&g_ep=EgoyMDI1MTEyMy4xIKXMDSoASAFQAw%3D%3D",
        telegramUrl: "https://t.me/Blitz_admin1",
    },
    {
        titleLine: "Blitz nemis tili markazi | Integro filiali",
        address: "Bunyodkor Avenue 52, 765625, Tashkent, Uzbekistan",
        directionsPrefix: "Metro",
        directionsText: "Chilonzor",
        bus: "114 | 116 | 41 | 70 | 131 | 135 | 69 | 99 | 41 | 139 | 48",
        phone: "+9987811377161",
        yandexUrl:
            "https://yandex.uz/maps/org/183021158302/?ll=69.205131%2C41.277337&z=16.63",
        googleUrl:
            "https://www.google.com/maps/@41.2771047,69.2059998,39m/data=!3m1!1e3?entry=ttu&g_ep=EgoyMDI2MDMxOC4xIKXMDSoASAFQAw%3D%3D",
        telegramUrl: "https://t.me/blitz_integro",
    },
    {
        titleLine: "Blitz nemis tili markazi | Alisher Navoiy filiali",
        address: "Navoi Avenue 27, 100030, Tashkent, Uzbekistan",
        directionsPrefix: "Metro",
        directionsText: "Alisher navoiy",
        bus: "100 | 115 | 152 | 17 | 28 | 29 | 64 | 65 | 89 | 91 | 35 | 43 | 46 | 68 | 123",
        phone: "+9987811377161",
        yandexUrl:
            "https://yandex.uz/maps/org/60328673317/?ll=69.250512%2C41.320802&z=16.67",
        googleUrl:
            "https://www.google.com/maps/place/GSR+Logistics/@41.3209419,69.2526813,39m/data=!3m1!1e3!4m6!3m5!1s0x2d89e769398f9903:0xc9bbc362df8d867f!8m2!3d41.3209165!4d69.2527776!16s%2Fg%2F11xzs9sdtx?entry=ttu&g_ep=EgoyMDI2MDMxOC4xIKXMDSoASAFQAw%3D%3D",
        telegramUrl: "https://t.me/blitz_navoiy2",
    },
    {
        titleLine: "Blitz nemis tili markazi | Bodomzor filiali",
        address: "Amir Temur Avenue 100-A, 100021, Tashkent, Uzbekistan",
        directionsPrefix: "Metro",
        directionsText: "Bodomzor",
        bus: "115 | 140 | 19 | 24 | 67 | 91 | 93 | 95 | 51",
        phone: "+9987811377161",
        yandexUrl:
            "https://yandex.uz/maps/10335/tashkent/house/YkAYdA9lQUECQFprfX9yeX9gZw==/?ll=69.285891%2C41.338149&mode=search&sctx=ZAAAAAgBEAAaKAoSCR%2BF61G4VFFAEYekFkompURAEhIJDQBV3LjF4j8Rn5RJDW0A0T8iBgABAgMEBSgKOABAo58GSAFqAnV6nQHNzMw9oAEAqAEAvQEsHQp6ggIFQmxpdHqKAgCSAgCaAgxkZXNrdG9wLW1hcHM%3D&sll=69.285891%2C41.338149&sspn=0.001154%2C0.000522&text=Blitz&z=20.24",
        googleUrl:
            "https://www.google.com/maps/place/Makro/@41.3382182,69.2855019,78m/data=!3m1!1e3!4m9!1m2!2m1!1sBodomzor+metro!3m5!1s0x38ae8bc7af1eec55:0xf2aa8a864c42b3e0!8m2!3d41.3382119!4d69.2857387!16s%2Fg%2F11vl4ks0z4?entry=ttu&g_ep=EgoyMDI2MDMxOC4xIKXMDSoASAFQAw%3D%3D",
        telegramUrl: "https://t.me/Blitz_Bodomzor",
    },
    {
        titleLine: "Blitz nemis tili markazi | Samarqand filiali",
        address: "Mirzo Ulugbek St 11, Samarkand, Samarqand Region, Uzbekistan",
        directionsPrefix: "Mo'ljal",
        directionsText:
            "Mirzo Ulug'bek ko'chasi, Makon Mall savdo markazining ro'parasida",
        bus: "6 | 3 | T3 | 87 | 77 | M1 | 22 | 52 | 87 | 66 | 77 | 64",
        phone: "+9987811377161",
        yandexUrl:
            "https://yandex.uz/maps/org/165906105443/?indoorLevel=1&ll=66.958908%2C39.655430&mode=search&sctx=ZAAAAAgBEAAaKAoSCddOlIREvVBAEe8a9KW300NAEhIJNBE2PL1SZj8Rtr5IaMu5VD8iBgABAgMEBSgKOABA3lBIAWoCdXqdAc3MzD2gAQCoAQC9ASwdCnrCAQbjiJmG6gSCAgVibGl0eooCAJICAJoCDGRlc2t0b3AtbWFwcw%3D%3D&sll=66.958908%2C39.655430&sspn=0.005085%2C0.002360&text=blitz&z=18.1",
        googleUrl:
            "https://www.google.com/maps/@39.6555682,66.9589968,40m/data=!3m1!1e3!5m1!1e2?entry=ttu&g_ep=EgoyMDI2MDMxOC4xIKXMDSoASAFQAw%3D%3D",
        telegramUrl: "https://t.me/Blitz_Samarqand",
    },
    {
        titleLine: "Blitz nemis tili markazi | Narpay filiali",
        address: "WWQJ+5R8, Galyakasab, Samarqand Region, Uzbekistan",
        directionsPrefix: "Mo'ljal",
        directionsText: "Narpay tuman 2-Kasb hunar maktabi",
        bus: null,
        phone: "+9987811377161",
        yandexUrl:
            "https://yandex.uz/maps/org/185342332981/?ll=65.923495%2C39.962811&z=16.88",
        googleUrl:
            "https://www.google.com/maps/search/+Samarqand+viloyati,+Narpay+tumani,+Mirbozor+shaharchasi/@39.9619432,65.9197767,318m/data=!3m1!1e3!5m1!1e2?entry=ttu&g_ep=EgoyMDI2MDMxOC4xIKXMDSoASAFQAw%3D%3D",
        telegramUrl: "https://t.me/Blitz_Narpay",
    },
    {
        titleLine: "Blitz nemis tili markazi | Farg'ona filiali",
        address: "Komus Street 51, Fergana, Fergana Region, Uzbekistan",
        directionsPrefix: "Mo'ljal",
        directionsText: "Yuksalish ko'chasi, Beeline ofisining ro'parasida",
        bus: "1 | 4 | 6",
        phone: "+9987811377161",
        yandexUrl: "https://yandex.uz/maps/-/CHT5FNMx",
        googleUrl:
            "https://www.google.com/maps/place/MeHnuD/@40.3858724,71.7909068,39m/data=!3m1!1e3!4m9!1m2!2m1!1z0KTQtdGA0LPQsNC90LAgbWFoaW16YWRlIGthZmU!3m5!1s0x38bb830037afa8e9:0xe4a9210a25dd10df!8m2!3d40.3858671!4d71.7910764!16s%2Fg%2F11vwdxz6gl?entry=ttu&g_ep=EgoyMDI2MDMxOC4xIKXMDSoASAFQAw%3D%3D",
        telegramUrl: "https://t.me/blitz_fargona",
    },
    {
        titleLine: "Blitz nemis tili markazi | Andijon filiali",
        address: "149A, Milliy Tiklanish koʻchasi, Andijon Region, Uzbekistan",
        directionsPrefix: "Mo'ljal",
        directionsText:
            "Amir Temur Shoh ko'chasi, Bobur haykali yon tarafida",
        bus: null,
        phone: "+9987811377161",
        yandexUrl:
            "https://yandex.uz/maps/10329/andijan/?ll=72.352922%2C40.762585&mode=poi&poi%5Bpoint%5D=72.352885%2C40.762563&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D107270238555&z=21",
        googleUrl:
            "https://www.google.com/maps/@40.7625097,72.3527565,45m/data=!3m1!1e3!5m1!1e2?entry=ttu&g_ep=EgoyMDI2MDMxOC4xIKXMDSoASAFQAw%3D%3D",
        telegramUrl: "https://t.me/Blitz_Andijon",
    },
];

const BRANCH_MENU_LABELS = [
    "Mirzo Ulug'bek",
    "Integro",
    "Alisher Navoiy",
    "Bodomzor",
    "Samarqand",
    "Narpay",
    "Farg'ona",
    "Andijon",
];

const BRANCH_PICKER_BACK = "⬅️ Asosiy menyu";

function branchesReplyKeyboard() {
    const rows = [];
    for (let i = 0; i < BRANCH_MENU_LABELS.length; i += 2) {
        rows.push([BRANCH_MENU_LABELS[i], BRANCH_MENU_LABELS[i + 1]]);
    }
    rows.push([BRANCH_PICKER_BACK]);
    return Markup.keyboard(rows).resize();
}

/** 3-rasmdagi tartib: blockquote manzil, bo'sh qatorlar, havolalar matn ichida */
function formatBranchCaptionHtml(b) {
    const titleDisplay = b.titleLine.replace(/\s*\|\s*/g, " ");
    const addr = escapeHtml(b.address);
    const dirP = escapeHtml(b.directionsPrefix);
    const dirT = escapeHtml(b.directionsText);
    const ph = escapeHtml(b.phone);

    const head = `📍 <b>${escapeHtml(titleDisplay)}</b>`;
    const quote = `<blockquote>${addr}</blockquote>`;
    const maps =
        `🌍 <a href="${b.yandexUrl}">Yandex Map</a>\n\n` +
        `🌍 <a href="${b.googleUrl}">Google Map</a>`;
    let body = `🚇 ${dirP}: ${dirT}`;
    if (b.bus) body += `\n\n🚌 Bus: ${escapeHtml(b.bus)}`;
    const phoneLine = `☎️ ${ph}`;
    const tgLine = `📩 <a href="${b.telegramUrl}">Telegram</a>`;

    return [head + "\n\n" + quote, maps, body, phoneLine, tgLine].join("\n\n");
}

async function replyBranchCard(ctx, b) {
    const caption = formatBranchCaptionHtml(b);
    const photoId = BRANCHES_PHOTO_FILE_ID || BLITZ_CENTER_PHOTO_FILE_ID;
    const branchKb = branchesReplyKeyboard();
    try {
        if (photoId) {
            return await ctx.replyWithPhoto(photoId, {
                caption,
                parse_mode: "HTML",
                ...branchKb,
            });
        }
        return await ctx.reply(caption, { parse_mode: "HTML", ...branchKb });
    } catch (e) {
        console.error("Filial rasm/xabar yuborishda xato", e);
        return ctx.reply(caption, { parse_mode: "HTML", ...branchKb });
    }
}

/*
 * =====================================================================
 * HANDLER TARTIBI (Telegraf ro‘yxati bo‘yicha — /start → Manzillar → admin)
 * 1. /start        2. contact        3. 1-dars
 * 4. Germaniya ochish (BOT_FLOW.GERMANY_INTRO + ichki menyu)
 * 5. Germaniya ←   6. Markaz        7. Manzillar ro‘yxati
 * 8. Manzillar ←   9. Filial kartasi 10. /stats   11. Germaniya batafsil (regex)
 * Bu ketma-ketlikni buzmang: avval ro‘yxatdan o‘tish, keyin asosiy menyu.
 * =====================================================================
 */
// --- 1. /start ---
bot.start(async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    const userId = ctx.from?.id;
    if (!userId) return;

    const { registered } = await getRegistrationState(userId);
    const contactKb = Markup.keyboard([
        [Markup.button.contactRequest("📱 Telefon raqamni yuborish")],
    ]).resize();

    if (registered) {
        if (fs.existsSync(LOGO_PATH)) {
            return ctx.replyWithPhoto(
                { source: LOGO_PATH },
                { caption: START_CAPTION_RETURNING, ...mainMenuKeyboard() }
            );
        }
        return ctx.reply(START_CAPTION_RETURNING, mainMenuKeyboard());
    }

    if (fs.existsSync(LOGO_PATH)) {
        return ctx.replyWithPhoto(
            { source: LOGO_PATH },
            { caption: START_CAPTION_NEW_USER, ...contactKb }
        );
    }
    return ctx.reply(START_CAPTION_NEW_USER, contactKb);
});

// --- 2. Ro‘yxat: kontakt ---
bot.on("contact", async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id !== ctx.from.id) {
        return ctx.reply(BOT_FLOW.CONTACT_INVALID);
    }

    const userId = ctx.from.id;
    const phone = contact.phone_number;
    const name = ctx.from.first_name;
    const username = ctx.from.username ? `@${ctx.from.username}` : "yo'q";

    const state = await getRegistrationState(userId);
    if (state.registered) {
        return ctx.reply(BOT_FLOW.CONTACT_ALREADY, mainMenuKeyboard());
    }

    const payload = {
        telegram_user_id: userId,
        first_name: name,
        phone,
        username,
        registered_at: new Date().toISOString(),
    };

    let firstTimeSaved = false;
    if (supabase) {
        try {
            const { error } = await supabase
                .from(USERS_TABLE)
                .upsert(payload, { onConflict: 'telegram_user_id' });
            if (error) throw error;
            firstTimeSaved = true;
        } catch (e) {
            console.error('Supabase (contact upsert):', e);
            firstTimeSaved = false;
        }
    } else {
        const ids = readApiRegisteredIds();
        if (!ids.includes(userId)) {
            writeApiRegisteredIds([...ids, userId]);
            firstTimeSaved = true;
        }
    }

    if (firstTimeSaved) {
        try {
            await bot.telegram.sendMessage(
                adminGroupId,
                `🚀 <b>Yangi o'quvchi:</b>\n👤 Ismi: ${escapeHtml(name)}\n📞 Tel: ${escapeHtml(phone)}\n🔗 Username: ${escapeHtml(username)}`,
                { parse_mode: "HTML" }
            );
        } catch (e) {
            console.error("Admin message fail", e);
        }
        await sendAmoCrmNewLead({
            firstName: name,
            phone,
            username,
            telegramUserId: userId,
        });
    }

    return ctx.reply(BOT_FLOW.THANKS_REGISTER, mainMenuKeyboard());
});

// --- 3. Asosiy menyu: 1-dars ---
bot.hears(BUTTONS.lesson1, async (ctx) => {
    await ctx.reply(BOT_FLOW.LESSON_WAIT);
    try {
        if (LESSON1_VIDEO_FILE_ID) {
            return await ctx.replyWithVideo(LESSON1_VIDEO_FILE_ID, {
                caption: BOT_FLOW.LESSON_CAPTION,
                ...mainMenuKeyboard(),
            });
        }
        const videoPath = path.join(__dirname, '..', 'video.mp4');
        if (fs.existsSync(videoPath)) {
            return await ctx.replyWithVideo(
                { source: videoPath },
                { caption: BOT_FLOW.LESSON_CAPTION, ...mainMenuKeyboard() }
            );
        }
        return ctx.reply(BOT_FLOW.VIDEO_MISSING, mainMenuKeyboard());
    } catch (e) {
        return ctx.reply(BOT_FLOW.VIDEO_ERROR, mainMenuKeyboard());
    }
});

// --- 5–8. Germaniya → orqaga; Markaz; Manzillar; manzillardan chiqish ---
function openGermanySubmenu(ctx) {
    const caption = `${BOT_FLOW.GERMANY_INTRO}\n\n${BOT_FLOW.GERMANY_SECTION_PROMPT}`;
    return ctx.reply(caption, germanySubmenuKeyboard());
}

bot.hears(GERMANY_OPEN_TRIGGERS, openGermanySubmenu);

bot.hears(BUTTONS.back, (ctx) => {
    return ctx.reply(BOT_FLOW.MAIN_MENU, mainMenuKeyboard());
});

bot.hears(BUTTONS.center, async (ctx) => {
    try {
        return await ctx.replyWithPhoto(BLITZ_CENTER_PHOTO_FILE_ID, {
            caption: BOT_FLOW.CENTER_CAPTION,
            parse_mode: "HTML",
            ...mainMenuKeyboard(),
        });
    } catch (e) {
        return ctx.reply(BOT_FLOW.CENTER_CAPTION, {
            parse_mode: "HTML",
            ...mainMenuKeyboard(),
        });
    }
});
bot.hears(BUTTONS.addresses, (ctx) => {
    return ctx.reply(BOT_FLOW.ADDRESSES_PROMPT, branchesReplyKeyboard());
});

bot.hears(BRANCH_PICKER_BACK, (ctx) => {
    return ctx.reply(BOT_FLOW.MAIN_MENU, mainMenuKeyboard());
});

// --- 9. Filial (manzil) kartasi ---
BRANCH_MENU_LABELS.forEach((label, idx) => {
    bot.hears(label, (ctx) => replyBranchCard(ctx, BRANCHES[idx]));
});

// --- 10. /stats (faqat ruxsat berilganlar) ---
bot.command("stats", async (ctx) => {
    if (!isStatsAllowed(ctx)) {
        if (ctx.chat?.type === "private") {
            return ctx.reply(
                "Bu buyruq uchun ruxsat yo'q.\n\n" +
                    "Variantlar: admin guruhida /stats yuboring yoki Vercelda STATS_ADMIN_IDS ga o‘z Telegram raqamingiz emas, <b>Telegram user ID</b>ingizni qo‘shing (masalan @userinfobot dan).",
                { parse_mode: "HTML" }
            );
        }
        return;
    }
    const n = await getUniqueUserCount();
    return ctx.reply(
        `📊 <b>Bot Statistikasi</b>\n\n` +
            `👥 Jami o'quvchilar: <b>${n}</b> ta\n` +
            `📈 Holat: Real vaqt rejimida (Supabase)\n\n` +
            `Hisoblash: Faqat botga start bosgan va ro'yxatdan o'tgan noyob foydalanuvchilar.`,
        { parse_mode: "HTML" }
    );
});

/** --- 11. Germaniya: raqamli tugmalar matni barcha variantlarda --- */
bot.use((ctx, next) => {
    const t = ctx.message?.text;
    if (typeof t !== "string") return next();
    if (GERMANY_RX.workVisa.test(t)) return replyGermanyHtml(ctx, GERMANY_DETAIL_HTML.workVisa);
    if (GERMANY_RX.ausbildung.test(t)) return replyGermanyHtml(ctx, GERMANY_DETAIL_HTML.ausbildung);
    if (GERMANY_RX.studienkolleg.test(t)) return replyGermanyHtml(ctx, GERMANY_DETAIL_HTML.studienkolleg);
    if (GERMANY_RX.bachelor.test(t)) return replyGermanyHtml(ctx, GERMANY_DETAIL_HTML.bachelor);
    if (GERMANY_RX.master.test(t)) return replyGermanyHtml(ctx, GERMANY_DETAIL_HTML.master);
    if (GERMANY_RX.sprachkurs.test(t)) return replyGermanyHtml(ctx, GERMANY_DETAIL_HTML.sprachkurs);
    return next();
});

// --- VERCEL EXPORT ---
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body);
            res.status(200).send('OK');
        } else {
            res.status(200).send('Blitz Bot is alive!');
        }
    } catch (e) {
        console.error("Webhook Error:", e);
        res.status(200).send('OK'); // Telegramga doim 200 qaytargan ma'qul, aks holda u spam qiladi
    }
};