const API = "https://api.mymemory.translated.net/get";
const $ = (id) => document.getElementById(id);

const input = $("input");
const errorBox = $("error");
const wordBox = $("wordBox");

// الاتجاه الحالي
let from = "ar";
let to = "en";

const NAMES = { ar: "العربية", en: "English" };

function updateLangUI() {
  $("fromLang").textContent = NAMES[from];
  $("toLang").textContent = NAMES[to];
  input.placeholder = from === "ar" ? "اكتب كلمة أو جملة بالعربي..." : "Type a word or sentence...";
}

// تبديل اللغتين
$("swapBtn").addEventListener("click", () => {
  [from, to] = [to, from];
  updateLangUI();
  $("result").classList.add("hidden");
});

// اكتشاف اللغة تلقائيًا أثناء الكتابة
input.addEventListener("input", () => {
  const t = input.value.trim();
  if (!t) return;
  const isArabic = /[\u0600-\u06FF]/.test(t);
  const newFrom = isArabic ? "ar" : "en";
  if (newFrom !== from && /[\p{L}]/u.test(t)) {
    from = newFrom;
    to = isArabic ? "en" : "ar";
    updateLangUI();
  }
});

// طلب ترجمة من الـ API
async function translate(text, f = from, t = to) {
  const url = `${API}?q=${encodeURIComponent(text)}&langpair=${f}|${t}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("network");
  return res.json();
}

// إزالة علامات الترقيم من الكلمة
function cleanWord(w) {
  return w.replace(/[^\p{L}\p{N}'’-]/gu, "").trim();
}

// تقسيم نص لكلمات للمقارنة
function tokens(s) {
  return s.toLowerCase().split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean);
}

// هل المعنى موجود داخل ترجمة الجملة؟
function appearsIn(meaning, sentence) {
  const m = tokens(meaning);
  if (!m.length) return false;
  const s = tokens(sentence);
  const joined = " " + s.join(" ") + " ";
  return joined.includes(" " + m.join(" ") + " ");
}

// جمع المعاني بدون تكرار
function collectMeanings(data) {
  const all = [data.responseData.translatedText];
  (data.matches || []).forEach((m) => all.push(m.translation));
  return [...new Set(all.map((t) => t.trim().toLowerCase()))]
    .filter((t) => t && t.length < 40);
}

// الزرار الرئيسي
async function run() {
  const text = input.value.trim();
  errorBox.classList.add("hidden");
  wordBox.classList.add("hidden");

  if (!text) return showError("من فضلك اكتب كلمة أو جملة أولاً");

  const btn = $("translateBtn");
  btn.textContent = "جارٍ الترجمة...";
  try {
    const data = await translate(text);
    const isSingle = tokens(text).length === 1;

    $("sentenceTranslation").textContent = data.responseData.translatedText;
    $("result").classList.remove("hidden");

    if (isSingle) {
      // كلمة منفردة: اعرض كل معانيها مباشرة
      $("wordsSection").classList.add("hidden");
      showMeanings(text, data, null);
    } else {
      // جملة: اعرض الكلمات القابلة للضغط
      $("wordsSection").classList.remove("hidden");
      renderWords(text);
    }
  } catch (e) {
    showError("حدث خطأ، تأكد من اتصال الإنترنت وحاول مرة أخرى");
  } finally {
    btn.textContent = "ترجمة";
  }
}

function renderWords(text) {
  const box = $("words");
  box.innerHTML = "";
  text.split(/\s+/).forEach((raw) => {
    const w = cleanWord(raw);
    if (!w) return;
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = w;
    span.addEventListener("click", () => onWordClick(w, span));
    box.appendChild(span);
  });
}

async function onWordClick(word, el) {
  document.querySelectorAll(".word").forEach((x) => x.classList.remove("active"));
  el.classList.add("active");

  $("wordTitle").textContent = word;
  $("wordMain").textContent = "...";
  $("wordOthers").innerHTML = "";
  wordBox.classList.remove("hidden");

  try {
    const data = await translate(word);
    showMeanings(word, data, $("sentenceTranslation").textContent);
  } catch (e) {
    $("wordMain").textContent = "تعذر جلب المعنى";
  }
}

// عرض معاني الكلمة (والمعنى الأنسب حسب السياق لو فيه جملة)
function showMeanings(word, data, sentenceTranslation) {
  const meanings = collectMeanings(data);

  let best = meanings[0] || "لا يوجد معنى";
  if (sentenceTranslation) {
    best = meanings.find((m) => appearsIn(m, sentenceTranslation)) || best;
  }

  $("wordTitle").textContent = word;
  $("wordMain").textContent = best;
  $("wordBox").classList.remove("hidden");

  const list = $("wordOthers");
  list.innerHTML = "";
  meanings.filter((m) => m !== best).slice(0, 8).forEach((m) => {
    const li = document.createElement("li");
    li.textContent = m;
    list.appendChild(li);
  });
  $("othersLabel").classList.toggle("hidden", list.children.length === 0);
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

$("translateBtn").addEventListener("click", run);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    run();
  }
});

updateLangUI();