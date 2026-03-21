const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const fs = require('fs');

const bot = new Telegraf('8611408395:AAFLc5nCy5vGR72IQEmX899hITId5IEkZgw');
const adminGroupId = '-1003356128763';

const BUTTONS = {
    lesson1: "Nemis tilidan birinchi darsni olish 🎥",
    germany: "🇩🇪 Germaniya haqida ma'lumot",
    center: "🏢 Blitz haqida",
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

// --- START ---
bot.start((ctx) => {
    return ctx.reply("Assalomu alaykum! Blitz nemis tili markazi botiga xush kelibsiz.\nIltimos, xizmatlardan foydalanish uchun telefon raqamingizni yuboring:", 
        Markup.keyboard([[Markup.button.contactRequest("📱 Telefon raqamni yuborish")]]).resize()
    );
});

// --- KONTAKT QABUL QILISH ---
bot.on('contact', async (ctx) => {
    const phone = ctx.message.contact.phone_number;
    const name = ctx.from.first_name;
    const username = ctx.from.username ? `@${ctx.from.username}` : "yo'q";
    
    try {
        await bot.telegram.sendMessage(adminGroupId, 
            `🚀 <b>Yangi o'quvchi:</b>\n👤 Ismi: ${name}\n📞 Tel: ${phone}\n🔗 Username: ${username}`, { parse_mode: 'HTML' }
        );
    } catch (e) { console.error("Admin message fail"); }
    
    return ctx.reply("Ma'lumotlaringiz qabul qilindi. Markazimiz xizmatlari bilan tanishishingiz mumkin.", 
        Markup.keyboard([
            [BUTTONS.lesson1],
            [BUTTONS.germany, BUTTONS.center],
            [BUTTONS.addresses]
        ]).resize()
    );
});

// --- VIDEO DARS ---
bot.hears(BUTTONS.lesson1, async (ctx) => {
    await ctx.reply("Birinchi dars yuklanmoqda, iltimos kuting... ⏳");
    try {
        const videoPath = path.join(__dirname, '..', 'video.mp4'); // Yo'lni aniqroq ko'rsatish
        if (fs.existsSync(videoPath)) {
            return await ctx.replyWithVideo({ source: videoPath }, { caption: "🎥 1-Dars: Ich heiße Miriam" });
        } else {
            return ctx.reply("Video fayli topilmadi (video.mp4).");
        }
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
    return ctx.reply("Asosiy menyu:", Markup.keyboard([[BUTTONS.lesson1], [BUTTONS.germany, BUTTONS.center], [BUTTONS.addresses]]).resize());
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