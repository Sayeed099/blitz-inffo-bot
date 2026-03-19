require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { Bot, Keyboard, webhookCallback, InputFile } = require("grammy");

const token = process.env.BOT_TOKEN;
const adminGroupId = process.env.ADMIN_GROUP_ID;
const lesson1VideoFileId = process.env.LESSON1_VIDEO_FILE_ID;

if (!token) throw new Error("BOT_TOKEN is missing. Set it in .env");

const bot = new Bot(token);

// Simple per-user state (serverless memory; may reset on cold start)
const pendingName = new Map(); // userId -> { phone, username }

const BUTTONS = {
  contact: "📱 Telefon raqamni yuborish",
  lesson1: "🎥 Nemis tilidan birinchi darsni olish",
  germany: "🇩🇪 Germaniya haqida ma'lumot",
  center: "🏢 Blitz markazi haqida",
  addresses: "📍 Bizning manzillar",
};

function contactKeyboard() {
  return new Keyboard().requestContact(BUTTONS.contact).resized().persistent();
}

function mainKeyboard() {
  return new Keyboard()
    .text(BUTTONS.lesson1)
    .row()
    .text(BUTTONS.germany)
    .row()
    .text(BUTTONS.center)
    .row()
    .text(BUTTONS.addresses)
    .resized()
    .persistent();
}

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Assalomu alaykum! Blitz nemis tili markazi botiga xush kelibsiz.",
    { reply_markup: contactKeyboard() }
  );
});

bot.on("message:contact", async (ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username ? `@${ctx.from.username}` : "(username yo'q)";
  const phone = ctx.message?.contact?.phone_number ?? "(telefon yo'q)";

  if (userId) pendingName.set(userId, { phone, username });

  await ctx.reply("Ismingizni yozib yuboring:");
});

bot.on("message:text", async (ctx, next) => {
  const userId = ctx.from?.id;
  const text = ctx.message?.text ?? "";
  if (!userId) return next();

  // Ignore commands
  if (text.startsWith("/")) return next();

  const pending = pendingName.get(userId);
  if (!pending) return next();

  pendingName.delete(userId);
  const name = text.trim();
  const phone = pending.phone ?? "(telefon yo'q)";
  const username = pending.username ?? "(username yo'q)";

  const adminText =
    "<b>Yangi ariza keldi:</b>\n\n" +
    `<b>Ism:</b> ${name}\n` +
    `<b>Telefon:</b> ${phone}\n` +
    `<b>Username:</b> ${username}\n`;

  if (adminGroupId) {
    try {
      await ctx.api.sendMessage(adminGroupId, adminText, { parse_mode: "HTML" });
    } catch (e) {
      console.error("Group ga yuborishda xatolik:", e);
    }
  }

  await ctx.reply("Asosiy menyu:", { reply_markup: mainKeyboard() });
});

bot.hears(BUTTONS.lesson1, async (ctx) => {
  await ctx.reply("Birinchi dars yuklanmoqda, iltimos kuting... ⏳", {
    reply_markup: mainKeyboard(),
  });

  const localPath = path.join(process.cwd(), "video.mp4");
  if (fs.existsSync(localPath)) {
    await ctx.replyWithVideo(new InputFile(localPath), { reply_markup: mainKeyboard() });
    return;
  }

  if (lesson1VideoFileId) {
    await ctx.replyWithVideo(lesson1VideoFileId, { reply_markup: mainKeyboard() });
    return;
  }

  await ctx.reply("Video hozircha sozlanmagan.", { reply_markup: mainKeyboard() });
});

const GERMANY = {
  workVisa: "1️⃣ ISHCHI VIZA",
  ausbildung: "2️⃣ AUSBILDUNG",
  studienkolleg: "3️⃣ STUDIENKOLLEG",
  bachelor: "4️⃣ BAKALAVR",
  master: "5️⃣ MAGISTR",
  sprachkurs: "6️⃣ TIL KURSI",
};

function germanyKeyboard() {
  return new Keyboard()
    .text(GERMANY.workVisa)
    .row()
    .text(GERMANY.ausbildung)
    .row()
    .text(GERMANY.studienkolleg)
    .row()
    .text(GERMANY.bachelor)
    .row()
    .text(GERMANY.master)
    .row()
    .text(GERMANY.sprachkurs)
    .resized()
    .persistent();
}

bot.hears(BUTTONS.germany, async (ctx) => {
  await ctx.reply("Kerakli bo'limni tanlang:", { reply_markup: germanyKeyboard() });
});

bot.hears(GERMANY.workVisa, async (ctx) => {
  await ctx.reply(
    "<b>Ishchi viza (Work Visa)</b>\n\n" +
      "<b>Kimlar uchun:</b>\n" +
      "• Diplomga ega bo'lganlar (kollej yoki bakalavr)\n" +
      "• Mutaxassisligi bo'yicha ishlashni istaganlar\n" +
      "• Tezroq daromad va mustaqillikni xohlaganlar\n" +
      "• Oilasini keyinchalik olib kelmoqchi bo'lganlar\n\n" +
      "<b>Talablar:</b>\n" +
      "• Diplom: kollej (3 yillik) yoki bakalavr\n" +
      "• Til sertifikati: Goethe / Telc / OSD\n" +
      "• Yosh: 20-40 yosh\n" +
      "• Harajat: 1 500$ - 2 500$\n\n" +
      "<b>Imkoniyatlar:</b>\n" +
      "• Qonuniy ishlash va yashash, ijtimoiy sug'urta\n" +
      "• Oilani chaqirish\n" +
      "• 3-5 yildan keyin doimiy yashash\n" +
      "• Schengen hududida erkin safar qilish.",
    { parse_mode: "HTML", reply_markup: germanyKeyboard() }
  );
});

bot.hears(GERMANY.ausbildung, async (ctx) => {
  await ctx.reply(
    "<b>Ausbildung (Kasbiy ta'lim)</b>\n\n" +
      "<b>Kimlar uchun:</b>\n" +
      "• 11 yillik ta'lim bitirganlar\n" +
      "• Universitet o'qimasdan kasb egallamoqchilar\n" +
      "• O'qish bilan birga maosh olishni xohlaganlar\n\n" +
      "<b>Talablar:</b>\n" +
      "• 11 yillik ta'lim hujjati\n" +
      "• Nemis tili B1 (ba'zi sohalarga B2)\n" +
      "• Yosh: odatda 30 yoshgacha\n" +
      "• Harajat: 1 500$ - 2 000$\n\n" +
      "<b>Imkoniyatlar:</b>\n" +
      "• O'qish davomida maosh\n" +
      "• Rasmiy ish tajribasi\n" +
      "• Tugatgach ishga qolish va doimiy yashash imkoniyati.\n\n" +
      "Eslatma: Oila olib kelishda daromad talabi sababli qiyinchilik bo'lishi mumkin.",
    { parse_mode: "HTML", reply_markup: germanyKeyboard() }
  );
});

bot.hears(GERMANY.studienkolleg, async (ctx) => {
  await ctx.reply(
    "<b>Studienkolleg (Tayyorlov bosqichi)</b>\n\n" +
      "<b>Kimlar uchun:</b>\n" +
      "• 11 yillik maktab bitirganlar\n" +
      "• Diplomi Germaniya bakalavriga to'g'ri kelmaganlar\n\n" +
      "<b>Talablar:</b>\n" +
      "• Nemis tili B1-B2\n" +
      "• Kirish imtihoni va moliyaviy kafolat\n\n" +
      "<b>Imkoniyatlar:</b>\n" +
      "• 1 yillik tayyorlov bosqichi\n" +
      "• Oxirida universitetga kirish huquqi.\n\n" +
      "Eslatma: Oila olib kelish deyarli mumkin emas.",
    { parse_mode: "HTML", reply_markup: germanyKeyboard() }
  );
});

bot.hears(GERMANY.bachelor, async (ctx) => {
  await ctx.reply(
    "<b>Bakalavr (Bachelor)</b>\n\n" +
      "<b>Kimlar uchun:</b>\n" +
      "• Oliy ta'lim olishni istaganlar\n" +
      "• Akademik karyera rejasidagilar\n\n" +
      "<b>Talablar:</b>\n" +
      "• 12 yillik ta'lim (11 yillik bo'lsa Studienkolleg)\n" +
      "• Nemis tili C1 (ba'zi yo'nalishlarga B2)\n" +
      "• Harajat: Oyiga 1 091 euro bloklangan hisob va chiqib ketguncha 1 500$ - 2 000$ xizmat haqi\n\n" +
      "<b>Imkoniyatlar:</b>\n" +
      "• Haftasiga 20 soatgacha ishlash\n" +
      "• Bitirgandan keyin 18 oy ish qidirish vizasi\n" +
      "• Doimiy yashash imkoniyati.",
    { parse_mode: "HTML", reply_markup: germanyKeyboard() }
  );
});

bot.hears(GERMANY.master, async (ctx) => {
  await ctx.reply(
    "<b>Magistr (Master)</b>\n\n" +
      "<b>Kimlar uchun:</b>\n" +
      "• Bakalavrni tugatganlar\n" +
      "• Yuqori malaka va karyera istaganlar\n\n" +
      "<b>Talablar:</b>\n" +
      "• Tan olingan bakalavr diplomi\n" +
      "• Nemis tili C1 yoki Ingliz tili (IELTS 6.5+)\n\n" +
      "<b>Imkoniyatlar:</b>\n" +
      "• Yuqori akademik daraja\n" +
      "• Ish topish ehtimoli ko'proq\n" +
      "• 18 oy ish qidirish vizasi\n" +
      "• Doimiy yashash imkoniyati.",
    { parse_mode: "HTML", reply_markup: germanyKeyboard() }
  );
});

bot.hears(GERMANY.sprachkurs, async (ctx) => {
  await ctx.reply(
    "<b>Til kursi (Sprachkurs visasi)</b>\n\n" +
      "<b>Kimlar uchun:</b>\n" +
      "• Nemis tilini Germaniyada o'rganmoqchi bo'lganlar\n" +
      "• Keyinchalik Ausbildung yoki universitetga kirishni rejalayotganlar\n\n" +
      "<b>Talablar:</b>\n" +
      "• Nemis tili kamida A2 daraja\n" +
      "• Til kursiga qabul hujjati va moliyaviy kafolat\n" +
      "• Harajat: Oyiga 1 091 euro bloklangan hisob va 1 500$ - 2 000$ xizmat haqi\n\n" +
      "<b>Imkoniyatlar:</b>\n" +
      "• Tilni muhitda tez o'rganish\n" +
      "• Haftasiga 20 soatgacha ishlash\n" +
      "• Keyinchalik boshqa viza turlariga o'tish imkoniyati.",
    { parse_mode: "HTML", reply_markup: germanyKeyboard() }
  );
});

bot.hears(BUTTONS.center, async (ctx) => {
  await ctx.reply("Ma'lumot tez kunda yuklanadi...", { reply_markup: mainKeyboard() });
});

bot.hears(BUTTONS.addresses, async (ctx) => {
  await ctx.reply("Ma'lumot tez kunda yuklanadi...", { reply_markup: mainKeyboard() });
});

bot.catch((err) => {
  console.error("Bot error:", err?.error ?? err);
});

module.exports = webhookCallback(bot, "http");

