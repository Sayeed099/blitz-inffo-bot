const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const fs = require('fs');

const bot = new Telegraf('8611408395:AAFLc5nCy5vGR72IQEmX899hITId5IEkZgw');
const adminGroupId = '-1003356128763';

const LESSON1_VIDEO_FILE_ID =
    'BAACAgIAAxkBAAPQabqPHBGMF4SuezNFGDJcxtkWfFgAAk1QAAIj70BKn2_zE9DFYZ46BA';

const BLITZ_CENTER_PHOTO_FILE_ID =
    'AgACAgIAAxkBAAIBpGm-23A6fAIRdyEtDO0C8qWylMxFAAKbFmsbXaT4SYO8PIz8vO9YAQADAgADeAADOgQ';

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
    addresses: "📍 Bizning manzillar",
    back: "⬅️ Orqaga"
};

const GERMANY = {
    workVisa: "1️⃣ ISHCHI VIZA",
    ausbildung: "2️⃣ AUSBILDUNG",
    studienkolleg: "3️⃣ STUDIENKOLLEG",
    bachelor: "4️⃣ BAKALAVR",
    master: "5️⃣ MAGISTR",
    sprachkurs: "6️⃣ TIL KURSI",
};

function mainMenuKeyboard() {
    return Markup.keyboard([
        [BUTTONS.lesson1],
        [BUTTONS.germany],
        [BUTTONS.center],
        [BUTTONS.addresses]
    ]).resize();
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
    const caption = "🎥 1-Dars: Ich heiße Miriam";
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
bot.hears(BUTTONS.germany, (ctx) => {
    return ctx.reply("Kerakli bo'limni tanlang:", 
        Markup.keyboard([
            [GERMANY.workVisa, GERMANY.ausbildung],
            [GERMANY.studienkolleg, GERMANY.bachelor],
            [GERMANY.master, GERMANY.sprachkurs],
            [BUTTONS.back]
        ]).resize()
    );
});

bot.hears(GERMANY.workVisa, (ctx) => ctx.reply("<b>1️⃣ Ishchi visa (Work Visa)</b>\n\n<b>👤 Kimlar uchun?</b>\n– Diplomga ega bo‘lganlar\n– Mutaxassisligi bo‘yicha ishlashni istaganlar\n\n<b>✅ Talablar:</b>\nDiplom: kollej yoki bakalavr\nTil sertifikati: Goethe / Telc / ÖSD\nYosh: 20–40 yosh\n\n<b>💰 Harajat:</b> 1 500$ – 2 500$\n\n<b>🚀 Imkoniyatlar:</b> Qonuniy ishlash, oilani chaqirish, 3–5 yilda doimiy yashash.\n\n<b>Murojaat uchun : @Hoff_admin.", { parse_mode: 'HTML' }));
bot.hears(GERMANY.ausbildung, (ctx) => ctx.reply("<b>2️⃣ Ausbildung (Kasbiy ta’lim)</b>\n\n<b>👤 Kimlar uchun?</b>\n– 11 yillik ta’lim bitirganlar\n– O‘qish bilan birga maosh olishni xohlaganlar\n\n<b>✅ Talablar:</b>\nTil: Nemis tili B1\nYosh: odatda 30 yoshgacha\n\n<b>💰 Harajat:</b> 1 500$ – 2 000$\n\n<b>🚀 Imkoniyatlar:</b> O‘qish davomida maosh, tugatgach ishga qolish.\n\n<b>Murojaat uchun : @Hoff_admin.", { parse_mode: 'HTML' }));
bot.hears(GERMANY.studienkolleg, (ctx) => ctx.reply("<b>3️⃣ Studienkolleg (Tayyorlov)</b>\n\n<b>✅ Talablar:</b>\nNemis tili B1–B2, Kirish imtihoni, Moliyaviy kafolat.\n\n<b>🚀 Imkoniyatlar:</b> 1 yillik tayyorlovdan so'ng universitetga kirish huquqi.\n\n<b>Murojaat uchun : @Hoff_admin.", { parse_mode: 'HTML' }));
bot.hears(GERMANY.bachelor, (ctx) => ctx.reply("<b>4️⃣ Bakalavr (Bachelor)</b>\n\n<b>✅ Talablar:</b>\n12 yillik ta’lim, Nemis tili C1.\n\n<b>💰 Harajat:</b> Oyiga 1 091 € bloklangan hisob.\n\n<b>🚀 Imkoniyatlar:</b> Haftasiga 20 soat ishlash, bitirgach 18 oy ish qidirish vizasi.\n\n<b>Murojaat uchun : @Hoff_admin.", { parse_mode: 'HTML' }));
bot.hears(GERMANY.master, (ctx) => ctx.reply("<b>5️⃣ Magistr (Master)</b>\n\n<b>✅ Talablar:</b>\nBakalavr diplomi, Nemis tili C1 yoki Ingliz tili (IELTS 6.5).\n\n<b>🚀 Imkoniyatlar:</b> Yuqori akademik daraja va oson ish topish.\n\n<b>Murojaat uchun : @Hoff_admin.", { parse_mode: 'HTML' }));
bot.hears(GERMANY.sprachkurs, (ctx) => ctx.reply("<b>6️⃣ Til kursi (Sprachkurs)</b>\n\n<b>✅ Talablar:</b>\nKamida A2 daraja, Til kursiga qabul, Moliyaviy kafolat.\n\n<b>🚀 Imkoniyatlar:</b> Germaniyada tilni tez o'rganish va keyin Ausbildungga o'tish.\n\n<b>Murojaat uchun : @Hoff_admin.", { parse_mode: 'HTML' }));

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
bot.hears(BUTTONS.addresses, (ctx) => ctx.reply("📍 <b>Manzilimiz:</b> Toshkent shahri, Blitz markazi.\n📞 Aloqa: +998...", { parse_mode: 'HTML' }));

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