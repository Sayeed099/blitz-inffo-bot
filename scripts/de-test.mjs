const samples = [
  "1\uFE0F\u20E3 Ishchi visa",
  "1\u20E3 Ishchi visa",
  "1️⃣ Ishchi visa",
];
const rx = /^1.{0,12}(?:Ishchi visa|ISHCHI VIZA)\s*$/iu;
for (const s of samples) {
  console.log(JSON.stringify(s), rx.test(s), [...s].map((c) => c.codePointAt(0).toString(16)).join(" "));
}
