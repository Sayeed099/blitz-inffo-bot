const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const fs = require('fs');

const bot = new Telegraf('8611408395:AAFLc5nCy5vGR72IQEmX899hITId5IEkZgw');
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

const USERS_JSON = path.join(__dirname, '..', 'users.json');

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

function addRegisteredChatId(chatId) {
    const id = Number(chatId);
    const ids = readRegisteredUserIds();
    if (!ids.includes(id)) {
        ids.push(id);
        writeRegisteredUserIds(ids);
    }
}

const BUTTONS = {
    lesson1: "Nemis tilidan birinchi darsni olish",
    germany: "🇩🇪 Germaniya haqida ma'lumot",
    center: "Blitz nemis tili markazi haqida",
    addresses: "Bizning manzillar",
    back: "⬅️ Orqaga"
};

const GERMANY = {
    workVisa: "1️⃣ Ishchi visa",
    ausbildung: "2️⃣ Ausbilding",
    studienkolleg: "3️⃣ Studienkolleg",
    bachelor: "4️⃣ Bakalavr",
    master: "5️⃣ Magistr",
    sprachkurs: "6️⃣ Til kursi",
};

/** Telegram klaviaturasi ba'zan ma'lumot ichidagi ' ni Unicode (') qilib yuboradi; shuningdek eski deploy tugmalari */
const GERMANY_OPEN_TRIGGERS = [
    BUTTONS.germany,
    "🇩🇪 Germaniya haqida ma\u2019lumot",
    /^🇩🇪\s*Germaniya haqida ma['\u2019\u02BC]lumot$/u,
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
    return ctx.reply(html, { parse_mode: "HTML" }).catch(() => ctx.reply(html.replace(/<[^>]+>/g, "")));
}

const GERMANY_DETAIL_HTML = {
    workVisa:
        "<b>1️⃣ Ishchi visa (Work Visa)</b>\n\n<b>👤 Kimlar uchun?</b>\n– Diplomga ega bo‘lganlar\n– Mutaxassisligi bo‘yicha ishlashni istaganlar\n\n<b>✅ Talablar:</b>\nDiplom: kollej yoki bakalavr\nTil sertifikati: Goethe / Telc / ÖSD\nYosh: 20–40 yosh\n\n<b>💰 Harajat:</b> 1 500$ – 2 500$\n\n<b>🚀 Imkoniyatlar:</b> Qonuniy ishlash, oilani chaqirish, 3–5 yilda doimiy yashash.\n\n<b>Murojaat uchun : @Hoff_admin.",
    ausbildung:
        "<b>2️⃣ Ausbildung (Kasbiy ta’lim)</b>\n\n<b>👤 Kimlar uchun?</b>\n– 11 yillik ta’lim bitirganlar\n– O‘qish bilan birga maosh olishni xohlaganlar\n\n<b>✅ Talablar:</b>\nTil: Nemis tili B1\nYosh: odatda 30 yoshgacha\n\n<b>💰 Harajat:</b> 1 500$ – 2 000$\n\n<b>🚀 Imkoniyatlar:</b> O‘qish davomida maosh, tugatgach ishga qolish.\n\n<b>Murojaat uchun : @Hoff_admin.",
    studienkolleg:
        "<b>3️⃣ Studienkolleg (Tayyorlov)</b>\n\n<b>✅ Talablar:</b>\nNemis tili B1–B2, Kirish imtihoni, Moliyaviy kafolat.\n\n<b>🚀 Imkoniyatlar:</b> 1 yillik tayyorlovdan so'ng universitetga kirish huquqi.\n\n<b>Murojaat uchun : @Hoff_admin.",
    bachelor:
        "<b>4️⃣ Bakalavr (Bachelor)</b>\n\n<b>✅ Talablar:</b>\n12 yillik ta’lim, Nemis tili C1.\n\n<b>💰 Harajat:</b> Oyiga 1 091 € bloklangan hisob.\n\n<b>🚀 Imkoniyatlar:</b> Haftasiga 20 soat ishlash, bitirgach 18 oy ish qidirish vizasi.\n\n<b>Murojaat uchun : @Hoff_admin.",
    master:
        "<b>5️⃣ Magistr (Master)</b>\n\n<b>✅ Talablar:</b>\nBakalavr diplomi, Nemis tili C1 yoki Ingliz tili (IELTS 6.5).\n\n<b>🚀 Imkoniyatlar:</b> Yuqori akademik daraja va oson ish topish.\n\n<b>Murojaat uchun : @Hoff_admin.",
    sprachkurs:
        "<b>6️⃣ Til kursi (Sprachkurs)</b>\n\n<b>✅ Talablar:</b>\nKamida A2 daraja, Til kursiga qabul, Moliyaviy kafolat.\n\n<b>🚀 Imkoniyatlar:</b> Germaniyada tilni tez o'rganish va keyin Ausbildungga o'tish.\n\n<b>Murojaat uchun : @Hoff_admin.",
};

function mainMenuKeyboard() {
    return Markup.keyboard([
        [BUTTONS.lesson1],
        [BUTTONS.germany],
        [BUTTONS.center],
        [BUTTONS.addresses]
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
            "Amir Temur Shoh ko'chasi, Bobour haykali yon tarafida",
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
    try {
        if (photoId) {
            return await ctx.replyWithPhoto(photoId, {
                caption,
                parse_mode: "HTML",
            });
        }
        return await ctx.reply(caption, { parse_mode: "HTML" });
    } catch (e) {
        console.error("Filial rasm/xabar yuborishda xato", e);
        return ctx.reply(caption, { parse_mode: "HTML" });
    }
}

// --- START ---
bot.start((ctx) => {
    return ctx.reply(
        "Assalomu alaykum!\nBlitz nemis tili markazi botiga xush kelibsiz.",
        Markup.keyboard([[Markup.button.contactRequest("📱 Telefon raqamni yuborish")]]).resize()
    );
});

// --- KONTAKT ---
bot.on("contact", async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id !== ctx.from.id) {
        return ctx.reply("Iltimos, o‘zingizning telefon raqamingizni 📱 tugmasi orqali yuboring.");
    }

    const phone = contact.phone_number;
    const name = ctx.from.first_name;
    const username = ctx.from.username ? `@${ctx.from.username}` : "yo'q";

    try {
        await bot.telegram.sendMessage(
            adminGroupId,
            `🚀 <b>Yangi o'quvchi:</b>\n👤 Ismi: ${name}\n📞 Tel: ${phone}\n🔗 Username: ${username}`,
            { parse_mode: "HTML" }
        );
    } catch (e) {
        console.error("Admin message fail", e);
    }

    try {
        addRegisteredChatId(ctx.chat.id);
    } catch (e) {
        console.error("users.json yozishda xato", e);
    }

    return ctx.reply("Rahmat, ro'yxatdan o'tdingiz!", mainMenuKeyboard());
});

bot.command('stats', (ctx) => {
    if (String(ctx.chat.id) !== adminGroupId) return;
    const n = readRegisteredUserIds().length;
    return ctx.reply(`📊 Bot statistikasi:\nJami foydalanuvchilar: ${n} ta`);
});

// --- VIDEO DARS ---
bot.hears(BUTTONS.lesson1, async (ctx) => {
    await ctx.reply("Birinchi dars yuklanmoqda, iltimos kuting... ⏳");
    const caption = "1-Dars: Ich heiße Miriam";
    try {
        if (LESSON1_VIDEO_FILE_ID) {
            return await ctx.replyWithVideo(LESSON1_VIDEO_FILE_ID, { caption });
        }
        const videoPath = path.join(__dirname, '..', 'video.mp4');
        if (fs.existsSync(videoPath)) {
            return await ctx.replyWithVideo({ source: videoPath }, { caption });
        }
        return ctx.reply("Dars videosi hozircha mavjud emas. Keyinroq urinib ko‘ring yoki markaz bilan bog‘laning.");
    } catch (e) {
        return ctx.reply("Video yuklashda xatolik yuz berdi.");
    }
});

// --- GERMANIYA MENYULARI (MATNLAR) ---
function openGermanySubmenu(ctx) {
    return ctx.reply(
        "Kerakli bo'limni tanlang:",
        Markup.keyboard([
            [GERMANY.workVisa, GERMANY.ausbildung],
            [GERMANY.studienkolleg, GERMANY.bachelor],
            [GERMANY.master, GERMANY.sprachkurs],
            [BUTTONS.back],
        ]).resize()
    );
}

bot.hears(GERMANY_OPEN_TRIGGERS, openGermanySubmenu);

bot.hears(BUTTONS.back, (ctx) => {
    return ctx.reply("Asosiy menyu:", mainMenuKeyboard());
});

bot.hears(BUTTONS.center, async (ctx) => {
    const caption =
        "<b>Blitz Nemis Tili Markazi</b>\nGermaniyada muvaffaqiyatli karyera qurishingiz uchun ishonchli ko'prik!";
    try {
        return await ctx.replyWithPhoto(BLITZ_CENTER_PHOTO_FILE_ID, {
            caption,
            parse_mode: 'HTML',
        });
    } catch (e) {
        return ctx.reply(caption, { parse_mode: 'HTML' });
    }
});
bot.hears(BUTTONS.addresses, (ctx) => {
    return ctx.reply("Kerakli filialni tanlang:", branchesReplyKeyboard());
});

bot.hears(BRANCH_PICKER_BACK, (ctx) => {
    return ctx.reply("Asosiy menyu:", mainMenuKeyboard());
});

BRANCH_MENU_LABELS.forEach((label, idx) => {
    bot.hears(label, (ctx) => replyBranchCard(ctx, BRANCHES[idx]));
});

/** hears zanjirida emoji mos kelmasa ham ishlashi uchun (oxirgi use — ichki next chaqirilgach ishlaydi) */
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