require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const path = require("node:path");
const fs = require("node:fs");

const token = process.env.BOT_TOKEN;
const adminGroupId = process.env.ADMIN_GROUP_ID;

if (!token) throw new Error("BOT_TOKEN is missing. Set it in .env / Vercel env vars.");
if (!adminGroupId) throw new Error("ADMIN_GROUP_ID is missing. Set it in .env / Vercel env vars.");

const bot = new Telegraf(token);

// Asosiy tugmalar nomlari
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

// 1. START - Kontakt so'rash
bot.start((ctx) => {
    ctx.reply("Assalomu alaykum! Blitz nemis tili markazi botiga xush kelibsiz.\nIltimos, xizmatlardan foydalanish uchun telefon raqamingizni yuboring:", 
        Markup.keyboard([
            [Markup.button.contactRequest("📱 Telefon raqamni yuborish")]
        ]).resize()
    );
});

// 2. Kontaktni qabul qilish va Adminga yuborish
bot.on('contact', async (ctx) => {
    const phone = ctx.message.contact.phone_number;
    const name = ctx.from.first_name;
    const username = ctx.from.username ? `@${ctx.from.username}` : "Mavjud emas";
    
    // Adminga hisobot
    await bot.telegram.sendMessage(adminGroupId, 
        `🚀 <b>Yangi o'quvchi:</b>\n\n👤 <b>Ismi:</b> ${name}\n📞 <b>Tel:</b> ${phone}\n🔗 <b>Username:</b> ${username}`, 
        { parse_mode: 'HTML' }
    );
    
    // Asosiy menyuni ochish
    ctx.reply("Rahmat! Ma'lumotlaringiz qabul qilindi. Markazimiz xizmatlari bilan tanishishingiz mumkin.", 
        Markup.keyboard([
            [BUTTONS.lesson1],
            [BUTTONS.germany, BUTTONS.center],
            [BUTTONS.addresses]
        ]).resize()
    );
});

// 3. Birinchi dars (Video)
bot.hears(BUTTONS.lesson1, async (ctx) => {
    await ctx.reply("Birinchi dars yuklanmoqda, iltimos kuting... ⏳");
    try {
        const localPath = path.join(process.cwd(), "video.mp4");
        if (fs.existsSync(localPath)) {
            await ctx.replyWithVideo({ source: localPath }, {
                caption: "🎥 1-Dars: Ich heiße Miriam\n\nMuvaffaqiyatli o'rganish tilaymiz!"
            });
        } else {
            ctx.reply("Video fayli topilmadi (video.mp4). Iltimos, administratorga murojaat qiling.");
        }
    } catch (e) {
        ctx.reply("Video yuklashda xatolik yuz berdi.");
    }
});

// 4. Germaniya menyusi
bot.hears(BUTTONS.germany, (ctx) => {
    ctx.reply("Viza turlaridan birini tanlang:", 
        Markup.keyboard([
            [GERMANY.workVisa, GERMANY.ausbildung],
            [GERMANY.studienkolleg, GERMANY.bachelor],
            [GERMANY.master, GERMANY.sprachkurs],
            [BUTTONS.back]
        ]).resize()
    );
});

// 5. Orqaga qaytish
bot.hears(BUTTONS.back, (ctx) => {
    ctx.reply("Asosiy menyu:", 
        Markup.keyboard([
            [BUTTONS.lesson1],
            [BUTTONS.germany, BUTTONS.center],
            [BUTTONS.addresses]
        ]).resize()
    );
});

// 6. Germaniya Viza ma'lumotlari
bot.hears(GERMANY.workVisa, (ctx) => {
    ctx.reply("<b>Ishchi viza (Work Visa)</b>\n\n<b>Kimlar uchun:</b>\n• Diplomga ega bo'lganlar (kollej yoki bakalavr)\n• Mutaxassisligi bo'yicha ishlashni istaganlar\n\n<b>Talablar:</b>\n• Diplom: kollej (3 yillik) yoki bakalavr\n• Til sertifikati: Goethe / Telc / OSD\n• Yosh: 20-40 yosh\n• Harajat: 1 500$ - 2 500$", { parse_mode: 'HTML' });
});

bot.hears(GERMANY.ausbildung, (ctx) => {
    ctx.reply("<b>Ausbildung (Kasbiy ta'lim)</b>\n\n<b>Kimlar uchun:</b>\n• 11 yillik ta'lim bitirganlar\n• Universitet o'qimasdan kasb egallamoqchilar\n\n<b>Talablar:</b>\n• 11 yillik ta'lim hujjati\n• Nemis tili B1\n• Yosh: odatda 30 yoshgacha\n• Harajat: 1 500$ - 2 000$", { parse_mode: 'HTML' });
});

bot.hears(GERMANY.studienkolleg, (ctx) => {
    ctx.reply("<b>Studienkolleg (Tayyorlov bosqichi)</b>\n\n<b>Kimlar uchun:</b>\n• 11 yillik maktab bitirganlar\n\n<b>Talablar:</b>\n• Nemis tili B1-B2\n• Kirish imtihoni va moliyaviy kafolat", { parse_mode: 'HTML' });
});

bot.hears(GERMANY.bachelor, (ctx) => {
    ctx.reply("<b>Bakalavr (Bachelor)</b>\n\n<b>Talablar:</b>\n• 12 yillik ta'lim\n• Nemis tili C1 (yoki B2)\n• Harajat: Oyiga 1 091 euro bloklangan hisob", { parse_mode: 'HTML' });
});

bot.hears(GERMANY.master, (ctx) => {
    ctx.reply("<b>Magistr (Master)</b>\n\n<b>Talablar:</b>\n• Tan olingan bakalavr diplomi\n• Nemis tili C1 yoki Ingliz tili (IELTS 6.5+)", { parse_mode: 'HTML' });
});

bot.hears(GERMANY.sprachkurs, (ctx) => {
    ctx.reply("<b>Til kursi (Sprachkurs visasi)</b>\n\n<b>Talablar:</b>\n• Nemis tili kamida A2 daraja\n• Moliyaviy kafolat (Bloklangan hisob)", { parse_mode: 'HTML' });
});

// Qolgan tugmalar
bot.hears(BUTTONS.center, (ctx) => ctx.reply("🏢 Blitz Nemis Tili Markazi — Germaniyada o'qish va ishlash bo'yicha sizning ishonchli hamkoringiz!"));
bot.hears(BUTTONS.addresses, (ctx) => ctx.reply("📍 Bizning manzillarimiz:\n1. Toshkent shahri...\n2. Farg'ona filiali..."));

// Vercel uchun eksport
module.exports = async (req, res) => {
    // Telegraf webhook handler: parses request body itself (works on Vercel)
    return bot.webhookCallback("/api/bot")(req, res);
};