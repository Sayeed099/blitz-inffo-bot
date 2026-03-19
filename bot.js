require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { Bot, Keyboard } = require("grammy");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const token = process.env.BOT_TOKEN;
const adminGroupId = process.env.ADMIN_GROUP_ID;
const lesson1VideoFileId = process.env.LESSON1_VIDEO_FILE_ID;
const adminId = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;
const googleSheetId = process.env.GOOGLE_SHEET_ID;
const googleSheetTab = process.env.GOOGLE_SHEET_TAB || "Sheet1";

if (!token) throw new Error("BOT_TOKEN is missing. Set it in .env");
if (!adminGroupId) throw new Error("ADMIN_GROUP_ID is missing. Set it in .env");

const bot = new Bot(token);

const USERS_PATH = path.join(__dirname, "users.json");
let cachedGoogleSheet = null;

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getGoogleSheet() {
  if (cachedGoogleSheet) return cachedGoogleSheet;
  if (!googleSheetId) return null;

  const doc = new GoogleSpreadsheet(googleSheetId);

  const credsPath = process.env.GOOGLE_CREDENTIALS_PATH;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;

  if (email && privateKeyRaw) {
    const private_key = privateKeyRaw.replace(/\\n/g, "\n");
    await doc.useServiceAccountAuth({ client_email: email, private_key });
  } else if (credsPath) {
    const resolved = path.isAbsolute(credsPath)
      ? credsPath
      : path.join(__dirname, credsPath);
    const raw = fs.readFileSync(resolved, "utf8");
    const creds = JSON.parse(raw);
    await doc.useServiceAccountAuth({
      client_email: creds.client_email,
      private_key: String(creds.private_key || "").replace(/\\n/g, "\n"),
    });
  } else {
    return null;
  }

  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[googleSheetTab] ?? doc.sheetsByIndex[0];
  cachedGoogleSheet = sheet;
  return sheet;
}

// ADMIN PANEL: video file_id olish (oddiy va forward videolar)
bot.on("message:video", async (ctx) => {
  if (!adminId || ctx.from?.id !== adminId) return;
  const fileId = ctx.message.video.file_id;

  console.log("--- ADMIN UCHUN VIDEO MA'LUMOTI ---");
  console.log("Video File ID:", fileId);
  console.log("-----------------------------------");

  await ctx.reply(
    "Hurmatli Admin, videoning ID raqami terminalda chiqdi.\n\nNusxalab olib, kodga joylashingiz mumkin.",
    { reply_markup: mainMenuKeyboard() }
  );
});

// Ba'zan video "document" sifatida yuboriladi (oddiy yoki forward)
bot.on("message:document", async (ctx) => {
  if (!adminId || ctx.from?.id !== adminId) return;
  const doc = ctx.message.document;
  if (!doc?.mime_type?.startsWith("video/")) return;

  console.log("--- ADMIN UCHUN VIDEO MA'LUMOTI ---");
  console.log("Video File ID:", doc.file_id);
  console.log("-----------------------------------");

  await ctx.reply(
    "Hurmatli Admin, videoning ID raqami terminalda chiqdi.\n\nNusxalab olib, kodga joylashingiz mumkin.",
    { reply_markup: mainMenuKeyboard() }
  );
});

const BUTTONS = {
  contact: "Kontaktni yuborish",
  lesson1: "Nemis tilidan birinchi darsni olish",
  germany: "Germaniya haqida ma'lumot olish",
  center: "Blitz nemis tili markazi haqida ma'lumot olish",
  addresses: "Blitz nemis tili markazi manzillarini olish",
};

const GERMANY_MENU = {
  general: "Germaniya haqida umumiy ma'lumotlar",
  students: "Talabar uchun ma'lumotlar",
  workers: "Ishchilar va mutaxasislar uchun ma'lumotlar",
  travelers: "Sayotahchilar uchun ma'lumotlar",
  residents: 'Yashovchilar uchun "Oltin qoida"',
  hoff: "Hoff Consulting",
};

const HOFF_MENU = {
  workVisa: "1. Ishchi viza (Work Visa)",
  ausbildung: "2. Ausbildung (Kasbiy ta'lim)",
  studienkolleg: "3. Studienkolleg (Tayyorlov bosqichi)",
  bachelor: "4. Bakalavr (Bachelor)",
  master: "5. Magistr (Master)",
  sprachkurs: "6. Til kursi (Sprachkurs visasi)",
};

function ensureUsersFile() {
  if (!fs.existsSync(USERS_PATH)) fs.writeFileSync(USERS_PATH, "[]", "utf8");
}

function loadUserIds() {
  ensureUsersFile();
  try {
    const raw = fs.readFileSync(USERS_PATH, "utf8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUserIds(ids) {
  ensureUsersFile();
  const tmpPath = `${USERS_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(ids, null, 2), "utf8");
  fs.renameSync(tmpPath, USERS_PATH);
}

function isRegistered(userId) {
  const ids = loadUserIds();
  return ids.includes(userId);
}

function registerUser(userId) {
  const ids = loadUserIds();
  if (!ids.includes(userId)) {
    ids.push(userId);
    saveUserIds(ids);
  }
}

function contactKeyboard() {
  return new Keyboard().requestContact(BUTTONS.contact).resized().persistent();
}

function mainMenuKeyboard() {
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

const NAV_BACK = "◁ Orqaga";
const NAV_HOME = "🏛 Asosiy menyu";

function germanyKeyboard() {
  return new Keyboard()
    .text(GERMANY_MENU.general)
    .row()
    .text(GERMANY_MENU.students)
    .row()
    .text(GERMANY_MENU.workers)
    .row()
    .text(GERMANY_MENU.travelers)
    .row()
    .text(GERMANY_MENU.residents)
    .row()
    .text(GERMANY_MENU.hoff)
    .row()
    .text(NAV_BACK)
    .text(NAV_HOME)
    .resized()
    .persistent();
}

function hoffKeyboard() {
  return new Keyboard()
    .text(HOFF_MENU.workVisa)
    .row()
    .text(HOFF_MENU.ausbildung)
    .row()
    .text(HOFF_MENU.studienkolleg)
    .row()
    .text(HOFF_MENU.bachelor)
    .row()
    .text(HOFF_MENU.master)
    .row()
    .text(HOFF_MENU.sprachkurs)
    .row()
    .text(NAV_BACK)
    .text(NAV_HOME)
    .resized()
    .persistent();
}

bot.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!isRegistered(userId)) {
    await ctx.reply("Assalomu alaykum! Iltimos, telefon raqamingizni yuboring:", {
      reply_markup: contactKeyboard(),
    });
    return;
  }

  await ctx.reply("Asosiy menyu:", { reply_markup: mainMenuKeyboard() });
});

bot.on("message:contact", async (ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username ? `@${ctx.from.username}` : "(username yo'q)";
  const firstName = ctx.from?.first_name ?? "";
  const phone = ctx.message?.contact?.phone_number ?? "(telefon yo'q)";

  if (userId && isRegistered(userId)) {
    await ctx.reply("Siz ro'yxatdan o'tgansiz.", { reply_markup: mainMenuKeyboard() });
    return;
  }

  console.log("Yangi kontakt:", { firstName, phone, username, userId });

  const applicationText =
    "<b>Yangi ariza keldi:</b>\n\n" +
    `<b>Ism:</b> ${escapeHtml(firstName)}\n` +
    `<b>Telefon:</b> ${escapeHtml(phone)}\n` +
    `<b>Username:</b> ${escapeHtml(username)}\n`;

  try {
    await ctx.api.sendMessage(adminGroupId, applicationText, { parse_mode: "HTML" });
  } catch (e) {
    console.error("ADMIN_GROUP_ID ga xabar yuborishda xatolik:", e);
  }

  try {
    const sheet = await getGoogleSheet();
    if (sheet) {
      await sheet.addRow({
        Ism: firstName,
        Telefon: phone,
        Username: username,
        Sana: new Date().toISOString(),
      });
    } else {
      console.warn("Google Sheets sozlanmagan: GOOGLE_SHEET_ID/creds yo'q.");
    }
  } catch (e) {
    console.error("Google Sheetsga yozishda xatolik:", e);
  }

  if (userId) registerUser(userId);

  await ctx.reply("Muvaffaqiyatli ro'yxatdan o'tdingiz!", {
    reply_markup: mainMenuKeyboard(),
  });
});

bot.hears(BUTTONS.lesson1, async (ctx) => {
  if (!lesson1VideoFileId) {
    await ctx.reply("Video hozircha sozlanmagan.", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }

  await ctx.replyWithVideo(lesson1VideoFileId, {
    caption: "Nemis tili: 1-dars",
    reply_markup: mainMenuKeyboard(),
  });
});

bot.hears(BUTTONS.germany, async (ctx) => {
  await ctx.reply(
    "Germaniya — Yevropaning markazida joylashgan, iqtisodiy jihatdan rivojlangan davlatlardan biri. Yuqori turmush darajasi, sifatli ta'lim va kuchli sanoati bilan dunyoga mashhur. Quyida mamlakat haqida batafsilroq ma'lumot olishingiz mumkin:",
    { reply_markup: germanyKeyboard() }
  );
});

bot.hears([NAV_BACK, NAV_HOME], async (ctx) => {
  await ctx.reply("Asosiy menyu:", { reply_markup: mainMenuKeyboard() });
});

bot.hears("Asosiy menyu", async (ctx) => {
  await ctx.reply("Asosiy menyu:", { reply_markup: mainMenuKeyboard() });
});

bot.hears(GERMANY_MENU.general, async (ctx) => {
  await ctx.reply(
    "<b>Germaniya haqida umumiy ma'lumotlar</b>\n\nGermaniya — Yevropaning markazida joylashgan, iqtisodiy jihatdan rivojlangan davlatlardan biri. Yuqori turmush darajasi, sifatli ta'lim va kuchli sanoati bilan dunyoga mashhur.",
    { parse_mode: "HTML", reply_markup: germanyKeyboard() }
  );
});

bot.hears(GERMANY_MENU.students, async (ctx) => {
  await ctx.reply(
    "<b>Germaniyada bepul ta'lim va Ausbildung imkoniyatlari</b>\n\n" +
      "Davlat universitetlari: Aksar hollarda o'qish bepul (faqat semestr badali — 200-400€ to'lanadi).\n\n" +
      "Ausbildung: Ham o'qish, ham ishlash tizimi. Nazariy bilim bilan birga korxonada ishlab, oyiga 800€–1200€ maosh olasiz.\n\n" +
      "Sperrkonto (Bloklangan hisob): Viza uchun Germaniya bankida yashash xarajatlarini qoplaydigan mablag' (yiliga taxminan 11,000€+) bo'lishi shart.\n\n" +
      "Til talabi: Nemis tilini (B2/C1) bilish bepul ta'lim eshiklarini ochadi. Ingliz tilidagi dasturlar asosan pullik.",
    { parse_mode: "HTML", reply_markup: germanyKeyboard() }
  );
});

bot.hears(GERMANY_MENU.workers, async (ctx) => {
  await ctx.reply(
    "<b>Malakali mutaxassislar uchun ishchi vizalari va soliq tizimi</b>\n\n" +
      "Chance Karte (Imkoniyat kartasi): Germaniyaga borib ish qidirish uchun balli tizim asosida beriladigan yangi turdagi viza.\n\n" +
      "Blue Card (Moviy karta): IT, muhandislik va tibbiyot kabi sohalardagi yuqori maoshli mutaxassislar uchun tezlashtirilgan rezidentlik yo'li.\n\n" +
      "Byurokratiya va Termin: Har bir rasmiy qadam uchun oldindan Termin (uchrashuv) olish shart. Pochta orqali muloqotga tayyor turing.\n\n" +
      "Soliq va Sug'urta: Maoshning 35–42% qismi soliq va sug'urtalarga ketsada, bu sizga kuchli ijtimoiy himoya kafolatini beradi.",
    { parse_mode: "HTML", reply_markup: germanyKeyboard() }
  );
});

bot.hears(GERMANY_MENU.travelers, async (ctx) => {
  await ctx.reply(
    "<b>Germaniya bo'ylab sayohat va foydali maslahatlar</b>\n\n" +
      "Deutschlandticket: Oyiga 49€ evaziga barcha shahar va shaharlararo mahalliy transportlardan (avtobus, tramvay, RE poyezdlar) cheksiz foydalanish imkoniyati.\n\n" +
      "Naqd pul faktori: Germaniya konservativ davlat — kichik kafelar va do'konlarda karta o'tmasligi mumkin. Doim yoningizda naqd yevro olib yuring.\n\n" +
      "Yakshanba qoidasi: Yakshanba kuni hamma do'kon va supermarketlar yopiq bo'ladi. Xaridlarni shanba kuni yakunlang!",
    { parse_mode: "HTML", reply_markup: germanyKeyboard() }
  );
});

bot.hears(GERMANY_MENU.residents, async (ctx) => {
  await ctx.reply(
    '<b>Nemis madaniyati, tartib-intizom va kundalik hayot</b>\n\n' +
      "Tinchlik soatlari: Yakshanba kuni va soat 22:00 dan keyin shovqin qilish (hatto uyda baland ovozda gapirish) qat'iyan man etiladi.\n\n" +
      "Punctuality: Kechikish — hurmatsizlik. Uchrashuvlarga 5 daqiqa vaqtliroq kelish nemislar uchun odat.\n\n" +
      "Majburiy sug'urta: Tibbiy sug'urtasiz yashash mumkin emas. U qimmat, lekin eng murakkab operatsiyalarni ham to'liq qoplaydi.\n\n" +
      "Chiqindi madaniyati: Chiqindini saralash — bu majburiyat. Noto'g'ri tashlangan chiqindi uchun katta jarimalar mavjud.",
    { parse_mode: "HTML", reply_markup: germanyKeyboard() }
  );
});

bot.hears(GERMANY_MENU.hoff, async (ctx) => {
  await ctx.reply("Hoff Consulting — kerakli yo'nalishni tanlang:", {
    reply_markup: hoffKeyboard(),
  });
});

bot.hears(HOFF_MENU.ausbildung, async (ctx) => {
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
      "• Tugatgach ishga qolish va doimiy yashash imkoniyati\n\n" +
      "Eslatma: Oila olib kelishda daromad talabi sababli qiyinchilik bo'lishi mumkin.",
    { parse_mode: "HTML", reply_markup: hoffKeyboard() }
  );
});

bot.hears(HOFF_MENU.workVisa, async (ctx) => {
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
      "• Qonuniy ishlash va yashash\n" +
      "• Ijtimoiy sug'urta\n" +
      "• Oilani chaqirish\n" +
      "• 3-5 yildan keyin doimiy yashash\n" +
      "• Schengen hududida erkin safar qilish",
    { parse_mode: "HTML", reply_markup: hoffKeyboard() }
  );
});

bot.hears(HOFF_MENU.studienkolleg, async (ctx) => {
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
      "• Oxirida universitetga kirish huquqi\n\n" +
      "Eslatma: Oila olib kelish deyarli mumkin emas.",
    { parse_mode: "HTML", reply_markup: hoffKeyboard() }
  );
});

bot.hears(HOFF_MENU.bachelor, async (ctx) => {
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
      "• Doimiy yashash imkoniyati",
    { parse_mode: "HTML", reply_markup: hoffKeyboard() }
  );
});

bot.hears(HOFF_MENU.master, async (ctx) => {
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
      "• Doimiy yashash imkoniyati",
    { parse_mode: "HTML", reply_markup: hoffKeyboard() }
  );
});

bot.hears(HOFF_MENU.sprachkurs, async (ctx) => {
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
      "• Keyinchalik boshqa viza turlariga o'tish imkoniyati",
    { parse_mode: "HTML", reply_markup: hoffKeyboard() }
  );
});

bot.hears([BUTTONS.center, BUTTONS.addresses], async (ctx) => {
  await ctx.reply("Ma'lumot tez kunda yuklanadi...", {
    reply_markup: mainMenuKeyboard(),
  });
});

bot.catch((err) => {
  console.error("Bot error:", err?.error ?? err);
});

bot.start();

