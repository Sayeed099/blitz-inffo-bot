const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const fs = require('fs');

const bot = new Telegraf('8611408395:AAFLc5nCy5vGR72IQEmX899hITId5IEkZgw');
const adminGroupId = '-1003356128763';

/** Videoni botga yuboring — javobdagi file_id ni nusxalab shu qatorga qo‘ying (Vercelda disk yo‘q bo‘lsa shu usul ishlaydi). */
const LESSON1_VIDEO_FILE_ID = '';

const USERS_JSON = path.join(__dirname, '..', 'users.json');

function readRegisteredChatIds() {
    try {
        if (!fs.existsSync(USERS_JSON)) return [];
        const data = JSON.parse(fs.readFileSync(USERS_JSON, 'utf8'));
        return Array.isArray(data.ids) ? data.ids.map(Number) : [];
    } catch {
        return [];
    }
}

function writeRegisteredChatIds(ids) {
    const unique = [...new Set(ids.map(Number))];
    fs.writeFileSync(USERS_JSON, JSON.stringify({ ids: unique }, null, 2), 'utf8');
}

function addRegisteredChatId(chatId) {
    const id = Number(chatId);
    const ids = readRegisteredChatIds();
    if (!ids.includes(id)) {
        ids.push(id);
        writeRegisteredChatIds(ids);
    }
}

function isRegisteredChatId(chatId) {
    return readRegisteredChatIds().includes(Number(chatId));
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
    const chatId = ctx.chat.id;
    if (isRegisteredChatId(chatId)) {
        return ctx.reply(
            "Assalomu alaykum!\nBlitz nemis tili markazi botiga xush kelibsiz.\nAsosiy menyudan foydalanishingiz mumkin:",
            mainMenuKeyboard()
        );
    }
    return ctx.reply(
        "Assalomu alaykum! \nBlitz nemis tili markazi botiga xush kelibsiz.\nIltimos, xizmatlardan foydalanish uchun telefon raqamingizni yuboring:",
        Markup.keyboard([[Markup.button.contactRequest("📱 Telefon raqamni yuborish")]]).resize()
    );
});

// --- KONTAKT QABUL QILISH ---
bot.on('contact', async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id !== ctx.from.id) {
        return ctx.reply("Iltimos, o‘zingizning telefon raqamingizni 📱 tugmasi orqali yuboring.");
    }

    const phone = contact.phone_number;
    const name = ctx.from.first_name;
    const username = ctx.from.username ? `@${ctx.from.username}` : "yo'q";
    
    try {
        await bot.telegram.sendMessage(adminGroupId, 
            `🚀 <b>Yangi o'quvchi:</b>\n👤 Ismi: ${name}\n📞 Tel: ${phone}\n🔗 Username: ${username}`, { parse_mode: 'HTML' }
        );
    } catch (e) { console.error("Admin message fail"); }

    addRegisteredChatId(ctx.chat.id);

    return ctx.reply("Ma'lumotlaringiz qabul qilindi. Markazimiz xizmatlari bilan tanishishingiz mumkin.", mainMenuKeyboard());
});

function replyLessonVideoFileId(ctx, fileId, howSent) {
    const hint =
        howSent === "document"
            ? "\n\n(iPhone/Androidda «Video» sifatida emas, «Fayl» bilan yuborilgan — baribir file_id ishlaydi.)"
            : "";
    return ctx
        .reply(
            "📎 Video qabul qilindi." +
                hint +
                "\n\nQuyidagi file_id ni butunlay tanlab nusxalang va api/bot.js ichida LESSON1_VIDEO_FILE_ID = '...' ga yozing:\n\n" +
                fileId
        )
        .catch((err) => console.error("file_id javobi yuborilmadi:", err));
}

// Oddiy video xabari (kamera / «Video» tugmasi)
bot.on("video", (ctx) => {
    return replyLessonVideoFileId(ctx, ctx.message.video.file_id, "video");
});

// Ko‘pchilik telefonlarda fayl sifatida yuboriladi — bu yerda message.video bo‘lmaydi
bot.on("document", (ctx) => {
    const doc = ctx.message.document;
    const mime = doc.mime_type || "";
    if (!mime.startsWith("video/")) return;
    return replyLessonVideoFileId(ctx, doc.file_id, "document");
});

// Dumaloq video — file_id boshqa tur; dars uchun imkon qadar oddiy video yuboring
bot.on("video_note", (ctx) => {
    const id = ctx.message.video_note.file_id;
    return ctx
        .reply(
            "📎 Dumaloq video (video note) file_id:\n\n" +
                id +
                "\n\n⚠️ Dars menyusida ko‘rinishi uchun odatda oddiy video (yoki .mp4 fayl) yuborilgan file_id ishlatiladi."
        )
        .catch((err) => console.error("file_id javobi yuborilmadi:", err));
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
        return ctx.reply(
            "Video hozircha ulangan emas.\n\n" +
                "1) Dars videosini shu botga yuboring — file_id chiqadi.\n" +
                "2) O‘sha matnni LESSON1_VIDEO_FILE_ID ga yozing yoki loyihaga video.mp4 qo‘ying."
        );
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

bot.hears(GERMANY.workVisa, (ctx) => ctx.reply("<b>1️⃣ ISHCHI VIZA (Work Visa)</b>\n\n<b>👤 Kimlar uchun?</b>\n– Diplomga ega bo‘lganlar\n– Mutaxassisligi bo‘yicha ishlashni istaganlar\n\n<b>✅ Talablar:</b>\nDiplom: kollej yoki bakalavr\nTil sertifikati: Goethe / Telc / ÖSD\nYosh: 20–40 yosh\n\n<b>💰 Harajat:</b> 1 500$ – 2 500$\n\n<b>🚀 Imkoniyatlar:</b> Qonuniy ishlash, oilani chaqirish, 3–5 yilda doimiy yashash.", { parse_mode: 'HTML' }));
bot.hears(GERMANY.ausbildung, (ctx) => ctx.reply("<b>2️⃣ AUSBILDUNG (Kasbiy ta’lim)</b>\n\n<b>👤 Kimlar uchun?</b>\n– 11 yillik ta’lim bitirganlar\n– O‘qish bilan birga maosh olishni xohlaganlar\n\n<b>✅ Talablar:</b>\nTil: Nemis tili B1\nYosh: odatda 30 yoshgacha\n\n<b>💰 Harajat:</b> 1 500$ – 2 000$\n\n<b>🚀 Imkoniyatlar:</b> O‘qish davomida maosh, tugatgach ishga qolish.", { parse_mode: 'HTML' }));
bot.hears(GERMANY.studienkolleg, (ctx) => ctx.reply("<b>3️⃣ STUDIENKOLLEG (Tayyorlov)</b>\n\n<b>✅ Talablar:</b>\nNemis tili B1–B2, Kirish imtihoni, Moliyaviy kafolat.\n\n<b>🚀 Imkoniyatlar:</b> 1 yillik tayyorlovdan so'ng universitetga kirish huquqi.", { parse_mode: 'HTML' }));
bot.hears(GERMANY.bachelor, (ctx) => ctx.reply("<b>4️⃣ BAKALAVR (Bachelor)</b>\n\n<b>✅ Talablar:</b>\n12 yillik ta’lim, Nemis tili C1.\n\n<b>💰 Harajat:</b> Oyiga 1 091 € bloklangan hisob.\n\n<b>🚀 Imkoniyatlar:</b> Haftasiga 20 soat ishlash, bitirgach 18 oy ish qidirish vizasi.", { parse_mode: 'HTML' }));
bot.hears(GERMANY.master, (ctx) => ctx.reply("<b>5️⃣ MAGISTR (Master)</b>\n\n<b>✅ Talablar:</b>\nBakalavr diplomi, Nemis tili C1 yoki Ingliz tili (IELTS 6.5).\n\n<b>🚀 Imkoniyatlar:</b> Yuqori akademik daraja va oson ish topish.", { parse_mode: 'HTML' }));
bot.hears(GERMANY.sprachkurs, (ctx) => ctx.reply("<b>6️⃣ TIL KURSI (Sprachkurs)</b>\n\n<b>✅ Talablar:</b>\nKamida A2 daraja, Til kursiga qabul, Moliyaviy kafolat.\n\n<b>🚀 Imkoniyatlar:</b> Germaniyada tilni tez o'rganish va keyin Ausbildungga o'tish.", { parse_mode: 'HTML' }));

bot.hears(BUTTONS.back, (ctx) => {
    return ctx.reply("Asosiy menyu:", mainMenuKeyboard());
});

bot.hears(BUTTONS.center, (ctx) => ctx.reply("🏢 <b>Blitz Nemis Tili Markazi</b>\nGermaniyada muvaffaqiyatli karyera qurishingiz uchun ishonchli ko'prik!", { parse_mode: 'HTML' }));
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