// 🧩 Плагины Rabbit AI: живые данные из интернета и точные инструменты, которые ИИ использует в ответах.
// Все сервисы бесплатные и без ключей.
const crypto = require("crypto");
const cache = new Map();
async function getJSON(url, ttl = 120e3, opt = {}) {
  const c = cache.get(url); if (c && Date.now() - c.t < ttl) return c.v;
  const r = await fetch(url, { headers: { "User-Agent": "RabbitAI/1.0 (plugins)", Accept: "application/json", ...(opt.headers || {}) }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(url + " " + r.status);
  const v = opt.text ? await r.text() : await r.json();
  cache.set(url, { t: Date.now(), v }); if (cache.size > 500) cache.delete(cache.keys().next().value);
  return v;
}
const cyr = s => /[а-яё]/i.test(s);

module.exports = ({ ask1 }) => {
  // город из сообщения (ИИ приводит к именительному падежу, иначе — регулярка)
  async function cityOf(text) {
    const ai = await ask1(null, [{ role: "system", content: 'Extract the city or place name the user asks about. Reply with JSON only: {"city":"<name in nominative case in the original language or English>"} or {"city":""} if none.' }, { role: "user", content: text.slice(0, 400) }], 40, { json: true }).catch(() => "");
    try { const c = JSON.parse(ai.match(/\{[\s\S]*\}/)?.[0] || "{}").city; if (c) return String(c).slice(0, 60); } catch {}
    return (text.match(/(?:в|во|на|in|for|at)\s+([A-ZА-ЯЁ][\p{L}-]+(?:[\s-][A-ZА-ЯЁ][\p{L}-]+)?)/u) || [])[1] || "";
  }
  async function geo(city) {
    const lang = cyr(city) ? "ru" : "en";
    const d = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=${lang}&format=json`, 864e5);
    return d.results?.[0] || null;
  }
  const WMO = { 0: "ясно ☀️", 1: "преимущественно ясно 🌤", 2: "переменная облачность ⛅", 3: "пасмурно ☁️", 45: "туман 🌫", 48: "изморозь 🌫", 51: "морось", 53: "морось", 55: "сильная морось", 61: "небольшой дождь 🌦", 63: "дождь 🌧", 65: "сильный дождь 🌧", 66: "ледяной дождь", 67: "ледяной дождь", 71: "небольшой снег 🌨", 73: "снег ❄️", 75: "сильный снег ❄️", 77: "снежные зёрна", 80: "ливень 🌦", 81: "ливни 🌧", 82: "сильные ливни ⛈", 85: "снегопад", 86: "сильный снегопад", 95: "гроза ⛈", 96: "гроза с градом", 99: "гроза с градом" };

  // 🧮 безопасный калькулятор (без eval)
  function calc(src) {
    const s = src.replace(/[×xх]/g, "*").replace(/[÷:]/g, "/").replace(/,(?=\d)/g, ".").replace(/\s+/g, "").replace(/\*\*/g, "^");
    let i = 0;
    const peek = () => s[i], eat = c => s[i] === c && ++i;
    const num = () => { const m = s.slice(i).match(/^\d+(\.\d+)?(e[+-]?\d+)?/i); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
    const prim = () => { if (eat("(")) { const v = expr(); if (!eat(")")) throw 0; return v; } if (eat("√")) return Math.sqrt(unary()); if (s.slice(i, i + 4) === "sqrt") { i += 4; return Math.sqrt(prim()); } return num(); };
    const unary = () => eat("-") ? -unary() : eat("+") ? unary() : prim();
    const pow = () => { let b = unary(); if (eat("%")) b /= 100; if (eat("^")) b = Math.pow(b, pow()); return b; };
    const term = () => { let v = pow(); for (;;) { if (eat("*")) v *= pow(); else if (eat("/")) v /= pow(); else return v; } };
    const expr = () => { let v = term(); for (;;) { if (eat("+")) v += term(); else if (eat("-")) v -= term(); else return v; } };
    const v = expr(); if (i !== s.length || !isFinite(v)) throw 0; return v;
  }

  const PLUGINS = [
    { id: "weather", e: "🌦", name: "Погода", desc: "Точная погода и прогноз на 3 дня в любом городе мира",
      test: /погод|weather|прогноз|температур|градус|дожд|снег|зонтик|forecast/i,
      async run(text) {
        const city = await cityOf(text); if (!city) return null;
        const g = await geo(city); if (!g) return null;
        const w = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3&wind_speed_unit=ms`, 600e3);
        const c = w.current, d = w.daily;
        return `Погода сейчас в ${g.name}${g.country ? ", " + g.country : ""} (местное время ${c.time.replace("T", " ")}): ${Math.round(c.temperature_2m)}°C, ощущается как ${Math.round(c.apparent_temperature)}°C, ${WMO[c.weather_code] || ""}, влажность ${c.relative_humidity_2m}%, ветер ${c.wind_speed_10m} м/с.\nПрогноз:\n` + d.time.map((t, k) => `- ${t}: ${Math.round(d.temperature_2m_min[k])}…${Math.round(d.temperature_2m_max[k])}°C, ${WMO[d.weather_code[k]] || ""}, вероятность осадков ${d.precipitation_probability_max[k] ?? "?"}%`).join("\n") + "\nИсточник: Open-Meteo.";
      } },
    { id: "time", e: "🕐", name: "Мировое время", desc: "Который час сейчас в любом городе",
      test: /который час|сколько (сейчас )?времени|врем(я|ени) в |часовой пояс|time in|what time|timezone/i,
      async run(text) {
        const city = await cityOf(text); if (!city) return null;
        const g = await geo(city); if (!g?.timezone) return null;
        const now = new Date().toLocaleString("ru-RU", { timeZone: g.timezone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
        return `Точное время сейчас в ${g.name}${g.country ? ", " + g.country : ""}: ${now} (часовой пояс ${g.timezone}).`;
      } },
    { id: "currency", e: "💱", name: "Курсы валют", desc: "Актуальные курсы и конвертация валют",
      test: /курс|доллар|евро|тенге|рубл|юан|лир[аыу]|сум\b|сом\b|гривн|валют|обмен|exchange rate|usd|eur|kzt|rub|convert/i,
      async run() {
        const d = await getJSON("https://open.er-api.com/v6/latest/USD", 1800e3);
        if (d.result !== "success") return null;
        const R = d.rates, list = ["KZT", "RUB", "EUR", "GBP", "CNY", "TRY", "UZS", "KGS", "UAH", "BYN", "AED", "JPY", "INR"];
        return `Актуальные курсы (обновлено ${d.time_last_update_utc}), за 1 USD:\n` + list.map(c => `${c}: ${R[c]}`).join(", ") + `\nКросс-курсы: 1 EUR = ${(R.KZT / R.EUR).toFixed(2)} KZT = ${(R.RUB / R.EUR).toFixed(2)} RUB; 1 RUB = ${(R.KZT / R.RUB).toFixed(3)} KZT. Считай конвертацию точно по этим числам. Источник: ExchangeRate-API.`;
      } },
    { id: "crypto", e: "₿", name: "Криптовалюты", desc: "Цены Bitcoin, Ethereum, TON и других монет",
      test: /биткоин|bitcoin|btc|эфириум|ethereum|\beth\b|криптовалют|крипт[аеуы]\b|крипто\b|crypto|toncoin|\bton\b|тон ?коин|solana|\bsol\b|dogecoin|доге|usdt|tether|bnb|xrp/i,
      async run() {
        const d = await getJSON("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,the-open-network,solana,tether,binancecoin,ripple,dogecoin&vs_currencies=usd,rub&include_24hr_change=true", 120e3);
        let kzt = 0; try { kzt = (await getJSON("https://open.er-api.com/v6/latest/USD", 1800e3)).rates.KZT; } catch {}
        const N = { bitcoin: "Bitcoin (BTC)", ethereum: "Ethereum (ETH)", "the-open-network": "Toncoin (TON)", solana: "Solana (SOL)", tether: "Tether (USDT)", binancecoin: "BNB", ripple: "XRP", dogecoin: "Dogecoin (DOGE)" };
        return "Цены криптовалют прямо сейчас:\n" + Object.entries(d).map(([k, v]) => `- ${N[k] || k}: $${v.usd} / ${kzt ? Math.round(v.usd * kzt).toLocaleString("ru") : "?"} ₸ / ${Math.round(v.rub).toLocaleString("ru")} ₽ (24ч: ${v.usd_24h_change?.toFixed(2)}%)`).join("\n") + "\nИсточник: CoinGecko. Напомни, что это не финансовый совет.";
      } },
    { id: "wiki", e: "📖", name: "Википедия", desc: "Проверенные факты о людях, местах и событиях",
      test: /кто так(ой|ая|ие)|что так(ое|ие)|расскажи (мне )?(про|о|об)\s|биографи|википеди|who (is|was)|what is|tell me about|wiki/i,
      async run(text) {
        const q = (text.match(/(?:кто так(?:ой|ая|ие)|что так(?:ое|ие)|расскажи (?:мне )?(?:про|о|об)|биография|who (?:is|was)|what is|tell me about)\s+([^?.!\n]{2,80})/i) || [])[1];
        if (!q) return null;
        const lang = cyr(q) ? "ru" : "en";
        const s = await getJSON(`https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q.trim())}&limit=1&namespace=0&format=json`, 864e5);
        const title = s?.[1]?.[0]; if (!title) return null;
        const p = await getJSON(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, 864e5);
        return p.extract ? `Википедия — «${p.title}»: ${p.extract.slice(0, 2500)}\nСсылка: ${p.content_urls?.desktop?.page || ""}` : null;
      } },
    { id: "calc", e: "🧮", name: "Калькулятор", desc: "Точно считает примеры — без ошибок в арифметике",
      test: /\d\s*[-+*/×÷^%]\s*[\d(√]|√\s*\d|sqrt/i,
      async run(text) {
        const exprs = (text.match(/[\d(√][\d\s.,+\-*/×÷^%()√]*[\d)%]/g) || []).filter(x => /[-+*/×÷^√%]/.test(x) && !/^\d{1,4}[-./]\d{1,2}[-./]\d{1,4}$/.test(x.trim())).slice(0, 5);
        const out = []; for (const x of exprs) { try { const v = calc(x); out.push(`${x.trim()} = ${+v.toPrecision(15)}`); } catch {} }
        return out.length ? "Точный расчёт калькулятором (используй эти числа):\n" + out.join("\n") : null;
      } },
    { id: "holidays", e: "📅", name: "Праздники", desc: "Ближайшие государственные праздники и выходные в твоей стране",
      test: /праздник|выходн(ые|ой)|holiday|день независимости|наурыз|новый год/i,
      async run(text, ctx) {
        const cc = (await ctx.cc?.()) || "KZ";
        const d = await getJSON(`https://date.nager.at/api/v3/NextPublicHolidays/${cc}`, 864e5);
        return Array.isArray(d) && d.length ? `Ближайшие официальные праздники (страна ${cc}):\n` + d.slice(0, 8).map(h => `- ${h.date}: ${h.localName}${h.name !== h.localName ? " (" + h.name + ")" : ""}`).join("\n") : null;
      } },
    { id: "dict", e: "🔤", name: "Английский словарь", desc: "Значение, произношение и примеры английских слов",
      test: /(слово|word|define|definition|meaning|значит|значение|переводится)\s*["«]?[a-z]{2,}/i,
      async run(text) {
        const w = (text.match(/(?:слово|word|define|definition of|meaning of|значит|значение слова|переводится)\s*["«]?([a-zA-Z-]{2,30})/i) || [])[1]; if (!w) return null;
        const d = await getJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w.toLowerCase())}`, 864e5);
        const e = d?.[0]; if (!e) return null;
        return `Словарь (англ.) — «${e.word}» ${e.phonetic || ""}:\n` + e.meanings.slice(0, 4).map(m => `- ${m.partOfSpeech}: ${m.definitions.slice(0, 2).map(x => x.definition + (x.example ? ` (пример: ${x.example})` : "")).join("; ")}`).join("\n");
      } },
    { id: "github", e: "🐙", name: "GitHub", desc: "Читает репозитории: описание, звёзды, README",
      test: /github\.com\/[\w.-]+\/[\w.-]+/i,
      async run(text) {
        const m = text.match(/github\.com\/([\w.-]+)\/([\w.-]+)/i); if (!m) return null;
        const repo = m[2].replace(/\.git$/, "");
        const r = await getJSON(`https://api.github.com/repos/${m[1]}/${repo}`, 600e3);
        let readme = ""; try { readme = await getJSON(`https://raw.githubusercontent.com/${m[1]}/${repo}/HEAD/README.md`, 600e3, { text: true }); } catch {}
        return `GitHub-репозиторий ${r.full_name}: ${r.description || "без описания"}. ⭐ ${r.stargazers_count}, форков ${r.forks_count}, язык ${r.language || "—"}, лицензия ${r.license?.spdx_id || "—"}, обновлён ${r.pushed_at}.\nREADME (начало):\n${readme.slice(0, 6000)}`;
      } },
    { id: "password", e: "🔐", name: "Генератор паролей", desc: "Надёжные случайные пароли (криптографически стойкие)",
      test: /(парол|password|passphrase)/i, test2: /(генер|придума|созда|сделай|дай|надёжн|надежн|generate|create|strong|random|случайн)/i,
      async run() {
        const pick = (set, n) => Array.from({ length: n }, () => set[crypto.randomInt(set.length)]).join("");
        const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", S = "!@#$%^&*-_=+?";
        const list = [16, 16, 20, 24].map(n => pick(A + S, n));
        const words = ["кролик", "луна", "ракета", "тигр", "облако", "кактус", "пицца", "гитара", "звезда", "лимон", "rabbit", "nova", "pixel", "turbo"];
        return "Сгенерированные случайные пароли (crypto.randomInt) — выдай их пользователю как есть, в блоке кода:\n" + list.join("\n") + `\nЗапоминаемая фраза-пароль: ${pick(words.map(w => w + "-"), 1)}${pick(words.map(w => w + "-"), 1)}${pick(words, 1)}-${crypto.randomInt(10, 99)}\nПосоветуй менеджер паролей и двухфакторную защиту.`;
      } },
    { id: "random", e: "🎲", name: "Случайность", desc: "Кубик, монетка, случайное число — честно и случайно",
      test: /(брось|кинь|подбрось)\s+(кубик|кости|кость|монет)|орё?е?л или решка|случайн[а-яёa-z]* (числ|номер)|random number|roll (a )?dic?e|flip a coin|выбери случайно/i,
      async run(text) {
        const r = text.match(/от\s*(-?\d+)\s*до\s*(-?\d+)|from\s*(-?\d+)\s*to\s*(-?\d+)/i);
        const a = r ? +(r[1] ?? r[3]) : 1, b = r ? +(r[2] ?? r[4]) : 100;
        return `Честный случайный результат (crypto): кубик 🎲 = ${crypto.randomInt(1, 7)}, второй кубик = ${crypto.randomInt(1, 7)}, монетка = ${crypto.randomInt(2) ? "орёл" : "решка"}, случайное число от ${Math.min(a, b)} до ${Math.max(a, b)} = ${crypto.randomInt(Math.min(a, b), Math.max(a, b) + 1)}. Используй тот результат, который просили.`;
      } },
    { id: "qr", e: "🔳", name: "QR-код", desc: "Делает QR-код для ссылки или текста", direct: true,
      test: /(qr|кьюар|куар)/i, test2: /(сделай|создай|сгенер|нарисуй|make|create|generate|для)/i,
      async run(text) {
        const data = (text.match(/https?:\/\/\S+/) || text.match(/[:：]\s*(.+)$/s) || text.match(/["«](.+?)["»]/) || text.match(/(?:для|for)\s+(.+)$/i) || [])[1] || (text.match(/https?:\/\/\S+/) || [])[0];
        if (!data || data.length > 900) return null;
        const src = `/api/qr?d=${encodeURIComponent(data.trim())}`;
        return `🔳 Готово! QR-код для: \`${data.trim().slice(0, 120)}\`\n\n![QR-код](${src})\n\nНаведи камеру телефона — и откроется ссылка/текст 📱`;
      } },

    { id: "news", e: "📰", name: "Новости", desc: "Свежие новости по любой теме с источниками",
      test: /новост|что нового|что случилось|последние события|headlines|news/i,
      async run(text) {
        const q = (text.replace(/(какие|последние|свежие|главные|новости|новость|что нового|расскажи|покажи|про|о|об|сегодня|news|latest|about|\?)/gi, " ").replace(/\s+/g, " ").trim() || "главное").slice(0, 80);
        const ru = cyr(text);
        const xml = await getJSON(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${ru ? "ru" : "en"}&gl=${ru ? "KZ" : "US"}&ceid=${ru ? "KZ:ru" : "US:en"}`, 600e3, { text: true });
        const items = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/g)].slice(0, 8);
        const un = t => t.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        return items.length ? `Свежие новости по запросу «${q}» (Google News):\n` + items.map(m => `- ${un(m[1])} (${new Date(m[3]).toLocaleString("ru-RU")}) — ${un(m[2])}`).join("\n") + "\nПерескажи главное и дай ссылки." : null;
      } },
    { id: "maps", e: "🗺", name: "Карты и адреса", desc: "Находит места, адреса и координаты (OpenStreetMap)",
      test: /где находится|адрес|как добраться|координат|на карте|где это|where is|address|location of/i,
      async run(text) {
        const q = (text.match(/(?:где находится|адрес|координаты|на карте|как добраться до|where is|address of|location of)\s+([^?\n]{2,100})/i) || [])[1]; if (!q) return null;
        const d = await getJSON(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3&addressdetails=0&accept-language=ru`, 864e5, { headers: { "User-Agent": "RabbitAI/1.0 (rabbit-ai.onrender.com)" } });
        return d.length ? `Найдено на карте (OpenStreetMap) по запросу «${q}»:\n` + d.map(x => `- ${x.display_name} — координаты ${(+x.lat).toFixed(5)}, ${(+x.lon).toFixed(5)}; карта: https://www.openstreetmap.org/?mlat=${x.lat}&mlon=${x.lon}#map=17/${x.lat}/${x.lon} ; 2ГИС: https://2gis.kz/search/${encodeURIComponent(q)}`).join("\n") : null;
      } },
    { id: "youtube", e: "▶️", name: "YouTube", desc: "Узнаёт название, автора и описание видео по ссылке",
      test: /(youtube\.com\/(watch|shorts)|youtu\.be\/)/i,
      async run(text) {
        const u = (text.match(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[\w-]{6,}[^\s]*/i) || [])[0]; if (!u) return null;
        const d = await getJSON(`https://noembed.com/embed?url=${encodeURIComponent(u)}`, 864e5);
        if (!d.title) return null;
        let descr = ""; try { const html = await getJSON(u, 864e5, { text: true, headers: { "Accept-Language": "ru,en" } }); descr = (html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/) || [])[1] || ""; descr = JSON.parse('"' + descr + '"'); } catch {}
        return `YouTube-видео: «${d.title}», автор: ${d.author_name} (${d.author_url}).${descr ? "\nОписание видео:\n" + descr.slice(0, 3000) : ""}\nПолной расшифровки нет — честно скажи, что отвечаешь по названию и описанию.`;
      } },
    { id: "itunes", e: "🎵", name: "Музыка, фильмы, приложения", desc: "Ищет песни, альбомы, фильмы и приложения в Apple",
      test: /(песн|трек|альбом|исполнител|певец|певица|музык|фильм|кино|приложени|song|album|track|movie|app)[а-яёa-z]*/i, test2: /(найди|какие|какой|лучшие|топ|посоветуй|кто поёт|кто поет|search|find|recommend|info|информаци)/i,
      async run(text) {
        const kind = /фильм|кино|movie/i.test(text) ? "movie" : /приложени|app\b/i.test(text) ? "software" : "music";
        const q = (text.replace(/(найди|покажи|какие|какой|лучшие|топ|посоветуй|песни|песню|трек[и]?|альбом[ы]?|фильм[ы]?|кино|приложени[ея]|музык[ау]|исполнителя|группы|search|find|songs?|album|movies?|apps?|\?)/gi, " ").replace(/\s+/g, " ").trim()).slice(0, 60);
        if (q.length < 2) return null;
        const d = await getJSON(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=${kind}&limit=6&country=KZ`, 864e5);
        return d.results?.length ? `Результаты Apple (${kind}) по запросу «${q}»:\n` + d.results.map(r => `- ${r.trackName || r.collectionName} — ${r.artistName || r.sellerName || ""}${r.primaryGenreName ? ", " + r.primaryGenreName : ""}${r.releaseDate ? ", " + r.releaseDate.slice(0, 4) : ""}${r.averageUserRating ? ", рейтинг " + r.averageUserRating.toFixed(1) : ""} — ${r.trackViewUrl || r.collectionViewUrl || ""}`).join("\n") : null;
      } },
    { id: "books", e: "📚", name: "Книги", desc: "Ищет книги: авторы, год, описание (Open Library)",
      test: /книг|автор|роман|book|novel/i, test2: /(найди|кто написал|какие|посоветуй|о чём|о чем|search|find|who wrote|about)/i,
      async run(text) {
        const q = (text.match(/[«"](.+?)[»"]/) || [])[1] || text.replace(/(найди|посоветуй|кто написал|какие|книг[иау]?|роман[ы]?|автор[а]?|о чём|о чем|book[s]?|who wrote|find|\?)/gi, " ").replace(/\s+/g, " ").trim();
        if (!q || q.length < 2) return null;
        const d = await getJSON(`https://openlibrary.org/search.json?q=${encodeURIComponent(q.slice(0, 80))}&limit=5&fields=title,author_name,first_publish_year,number_of_pages_median,key,subject`, 864e5);
        return d.docs?.length ? `Книги (Open Library) по запросу «${q.slice(0, 80)}»:\n` + d.docs.map(b => `- «${b.title}» — ${(b.author_name || []).slice(0, 2).join(", ")}${b.first_publish_year ? ", " + b.first_publish_year : ""}${b.number_of_pages_median ? ", ~" + b.number_of_pages_median + " стр." : ""} — https://openlibrary.org${b.key}`).join("\n") : null;
      } },
    { id: "recipes", e: "🍝", name: "Рецепты мира", desc: "Настоящие рецепты блюд с ингредиентами (TheMealDB)",
      test: /рецепт|как приготовить|как готовить|recipe|how to cook/i,
      async run(text) {
        const dish = await ask1(null, [{ role: "system", content: 'Translate the dish name from the user message to a short English dish name. JSON only: {"dish":"..."} or {"dish":""}.' }, { role: "user", content: text.slice(0, 300) }], 30, { json: true }).catch(() => "");
        let q = ""; try { q = JSON.parse(dish.match(/\{[\s\S]*\}/)?.[0] || "{}").dish || ""; } catch {}
        if (!q) q = (text.match(/(?:recipe for|how to cook)\s+([a-z ]{3,40})/i) || [])[1] || ""; if (!q) return null;
        const d = await getJSON(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`, 864e5);
        const m = d.meals?.[0]; if (!m) return null;
        const ing = Array.from({ length: 20 }, (_, i) => m["strIngredient" + (i + 1)] ? `${m["strIngredient" + (i + 1)]} — ${m["strMeasure" + (i + 1)] || ""}` : "").filter(Boolean);
        return `Рецепт из TheMealDB: «${m.strMeal}» (${m.strArea}, ${m.strCategory}).\nИнгредиенты: ${ing.join("; ")}\nПриготовление: ${m.strInstructions.slice(0, 2500)}\n${m.strYoutube ? "Видео: " + m.strYoutube : ""}\nПереведи на язык пользователя, единицы — в граммы/мл.`;
      } },
    { id: "science", e: "🔬", name: "Научные статьи", desc: "Свежие научные работы с arXiv",
      test: /научн[а-яёa-z]* (стат|работ|исследован)|arxiv|исследовани[яе] (про|о|по)|research paper|scientific paper|papers? (on|about)/i,
      async run(text) {
        const q = await ask1(null, [{ role: "system", content: 'Give 2-5 English search keywords for scientific papers on the user topic. JSON only: {"q":"..."}' }, { role: "user", content: text.slice(0, 300) }], 30, { json: true }).catch(() => "");
        let k = ""; try { k = JSON.parse(q.match(/\{[\s\S]*\}/)?.[0] || "{}").q || ""; } catch {}
        if (!k) k = text.replace(/[^a-zA-Z ]/g, " ").trim(); if (!k) return null;
        const xml = await getJSON(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(k)}&sortBy=relevance&max_results=5`, 864e5, { text: true });
        const es = [...xml.matchAll(/<entry>[\s\S]*?<id>(.*?)<\/id>[\s\S]*?<published>(.*?)<\/published>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<summary>([\s\S]*?)<\/summary>/g)];
        return es.length ? `Научные статьи arXiv по запросу «${k}»:\n` + es.map(e => `- ${e[3].replace(/\s+/g, " ").trim()} (${e[2].slice(0, 10)}) — ${e[1]}\n  Кратко: ${e[4].replace(/\s+/g, " ").trim().slice(0, 350)}`).join("\n") : null;
      } },
    { id: "quakes", e: "🌋", name: "Землетрясения", desc: "Последние землетрясения в мире и рядом (USGS)",
      test: /землетрясен|трясло|толчк|сейсм|earthquake/i,
      async run(text) {
        const d = await getJSON("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson", 300e3);
        const near = /казах|алмат|астан|kazakh|almaty|кыргыз|бишкек|узбек|ташкент/i.test(text);
        let f = d.features; if (near) f = f.filter(x => /kazakh|kyrgyz|uzbek|tajik|china|almaty|xinjiang/i.test(x.properties.place));
        f = f.sort((a, b) => b.properties.time - a.properties.time).slice(0, 10);
        return f.length ? `Землетрясения за последние сутки${near ? " в Центральной Азии" : " (магнитуда 2.5+)"} по данным USGS:\n` + f.map(x => `- M${x.properties.mag} — ${x.properties.place}, ${new Date(x.properties.time).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })} (время Алматы)`).join("\n") : `По данным USGS за последние сутки${near ? " в Центральной Азии" : ""} заметных землетрясений (M2.5+) не зафиксировано.`;
      } },
    { id: "stocks", e: "📈", name: "Акции", desc: "Цены акций: Apple, Tesla, Nvidia, Kaspi и др.",
      test: /акци[ия]|котировк|stock|share price|\$[A-Z]{1,5}\b|nasdaq|биржа/i,
      async run(text) {
        const MAP = { apple: "AAPL", эппл: "AAPL", эпл: "AAPL", tesla: "TSLA", тесл: "TSLA", nvidia: "NVDA", нвидиа: "NVDA", microsoft: "MSFT", майкрософт: "MSFT", google: "GOOGL", гугл: "GOOGL", amazon: "AMZN", амазон: "AMZN", meta: "META", facebook: "META", kaspi: "KSPI", каспи: "KSPI", netflix: "NFLX", нетфликс: "NFLX", яндекс: "YNDX", amd: "AMD", intel: "INTC", samsung: "005930.KS", самсунг: "005930.KS", alibaba: "BABA", алибаба: "BABA", coca: "KO", кока: "KO", disney: "DIS", дисней: "DIS", bitcoin: "BTC-USD" };
        const low = text.toLowerCase(); const syms = new Set((text.match(/\$([A-Z]{1,5})\b/g) || []).map(x => x.slice(1)));
        for (const [k, v] of Object.entries(MAP)) if (low.includes(k)) syms.add(v);
        (text.match(/\b[A-Z]{2,5}\b/g) || []).filter(x => !/USD|EUR|KZT|RUB|AI|OK|CEO|IT|PDF/.test(x)).forEach(x => syms.add(x));
        if (!syms.size) return null;
        const out = [];
        for (const sym of [...syms].slice(0, 4)) { try { const d = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`, 300e3, { headers: { "User-Agent": "Mozilla/5.0" } }); const m = d.chart.result[0].meta; out.push(`- ${m.symbol} (${m.longName || m.shortName || m.fullExchangeName}): ${m.regularMarketPrice} ${m.currency}, закрытие прошлого дня ${m.chartPreviousClose} (${((m.regularMarketPrice / m.chartPreviousClose - 1) * 100).toFixed(2)}%), диапазон дня ${m.regularMarketDayLow}–${m.regularMarketDayHigh}`); } catch {} }
        return out.length ? "Котировки акций (Yahoo Finance, с задержкой):\n" + out.join("\n") + "\nНапомни, что это не инвестиционный совет." : null;
      } },
    { id: "air", e: "🌫", name: "Качество воздуха", desc: "Смог, PM2.5 и индекс качества воздуха в городе",
      test: /качеств[а-яёa-z]* воздуха|смог|загрязнени[а-яёa-z]* воздуха|pm ?2[.,]5|air quality|aqi/i,
      async run(text) {
        const city = await cityOf(text); if (!city) return null; const g = await geo(city); if (!g) return null;
        const d = await getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${g.latitude}&longitude=${g.longitude}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&timezone=auto`, 900e3);
        const c = d.current, a = c.us_aqi; const lvl = a <= 50 ? "хорошее 🟢" : a <= 100 ? "умеренное 🟡" : a <= 150 ? "вредно для чувствительных 🟠" : a <= 200 ? "вредное 🔴" : "очень вредное 🟣";
        return `Качество воздуха в ${g.name} сейчас: индекс US AQI ${a} — ${lvl}. PM2.5: ${c.pm2_5} мкг/м³, PM10: ${c.pm10} мкг/м³, NO₂: ${c.nitrogen_dioxide}, озон: ${c.ozone}. Источник: Open-Meteo (CAMS). Дай советы (маска, проветривание, прогулки).`;
      } },
    { id: "units", e: "📏", name: "Конвертер единиц", desc: "Километры, мили, фунты, градусы, литры и др. — точно",
      test: /\d[\d.,]*\s*(км|километр|миль|mile|метр|фут|feet|ft|дюйм|inch|кг|килограмм|фунт|lb|унци|oz|°?[cf]\b|градус|литр|галлон|gallon|см|сантиметр|мм|ярд|yard|mph|км\/ч|узл)/i, test2: /(в|to|in|сколько|переведи|convert|=)/i,
      async run(text) {
        const U = { km: [1000, "m"], км: [1000, "m"], километр: [1000, "m"], m: [1, "m"], м: [1, "m"], метр: [1, "m"], см: [0.01, "m"], сантиметр: [0.01, "m"], мм: [0.001, "m"], mile: [1609.344, "m"], миль: [1609.344, "m"], миля: [1609.344, "m"], фут: [0.3048, "m"], feet: [0.3048, "m"], ft: [0.3048, "m"], дюйм: [0.0254, "m"], inch: [0.0254, "m"], ярд: [0.9144, "m"], yard: [0.9144, "m"],
          кг: [1, "kg"], килограмм: [1, "kg"], kg: [1, "kg"], г: [0.001, "kg"], грамм: [0.001, "kg"], фунт: [0.45359237, "kg"], lb: [0.45359237, "kg"], унци: [0.028349523, "kg"], oz: [0.028349523, "kg"], тонн: [1000, "kg"],
          литр: [1, "l"], л: [1, "l"], l: [1, "l"], мл: [0.001, "l"], галлон: [3.785411784, "l"], gallon: [3.785411784, "l"], пинт: [0.473176, "l"],
          "км/ч": [1, "kmh"], mph: [1.609344, "kmh"], "миль/ч": [1.609344, "kmh"], узл: [1.852, "kmh"], "м/с": [3.6, "kmh"] };
        const m = text.match(/(-?\d[\d\s.,]*)\s*(км\/ч|миль\/ч|м\/с|°?\s?[CcFfСсФф]\b|[a-zа-яё]+)/i); if (!m) return null;
        const val = parseFloat(m[1].replace(/\s/g, "").replace(",", ".")); const unit = m[2].toLowerCase().replace(/^°\s?/, "");
        if (/^[cс]$|^[fф]$|градус/.test(unit)) { const f = /^[fф]$/.test(unit); return f ? `${val}°F = ${((val - 32) * 5 / 9).toFixed(2)}°C` : `${val}°C = ${(val * 9 / 5 + 32).toFixed(2)}°F = ${(val + 273.15).toFixed(2)} K`; }
        const key = Object.keys(U).sort((a, b) => b.length - a.length).find(k => unit.startsWith(k)); if (!key) return null;
        const [k, base] = U[key], v = val * k;
        const outs = Object.entries(U).filter(([n, [, b]]) => b === base && /^[a-z]|^(км|см|мм|м|кг|г|л|мл|миль|фут|дюйм|фунт|унци|галлон|узл)$/.test(n)).map(([n, [kk]]) => `${+(v / kk).toPrecision(8)} ${n}`);
        return `Точная конвертация ${val} ${m[2]}: ` + [...new Set(outs)].join(" = ");
      } },
    { id: "days", e: "🗓", name: "Счётчик дней", desc: "Сколько дней до даты или между датами",
      test: /сколько (дней|недель|осталось)|дней до|days (until|till|to|between)|how many days/i,
      async run(text, ctx) {
        const MON = { январ: 0, феврал: 1, март: 2, апрел: 3, ма: 4, июн: 5, июл: 6, август: 7, сентябр: 8, октябр: 9, ноябр: 10, декабр: 11, jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Almaty" })); now.setHours(0, 0, 0, 0);
        const dates = [];
        for (const m of text.matchAll(/(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?/g)) dates.push(new Date(m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : now.getFullYear(), +m[2] - 1, +m[1]));
        for (const m of text.matchAll(/(\d{1,2})\s+([а-яёa-z]{3,})\s*(\d{4})?/gi)) { const k = Object.keys(MON).sort((a, b) => b.length - a.length).find(k => m[2].toLowerCase().startsWith(k)); if (k) dates.push(new Date(m[3] ? +m[3] : now.getFullYear(), MON[k], +m[1])); }
        if (/нов[а-яёa-z]* год|new year/i.test(text)) dates.push(new Date(now.getFullYear() + 1, 0, 1));
        if (/лет[оа]|summer/i.test(text) && !dates.length) dates.push(new Date(now.getMonth() >= 5 ? now.getFullYear() + 1 : now.getFullYear(), 5, 1));
        if (!dates.length) return null;
        const fix = d => { if (dates.length === 1 && d < now && !/\d{4}/.test(text)) d.setFullYear(d.getFullYear() + 1); return d; };
        const day = 864e5, fmt = d => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
        if (dates.length >= 2) { const n = Math.round(Math.abs(dates[1] - dates[0]) / day); return `Между ${fmt(dates[0])} и ${fmt(dates[1])}: ${n} дн. (${(n / 7).toFixed(1)} нед.).`; }
        const d = fix(dates[0]), n = Math.round((d - now) / day);
        return `Сегодня ${fmt(now)}. До ${fmt(d)}: ${n} дн. (≈ ${(n / 7).toFixed(1)} нед., ≈ ${(n / 30.44).toFixed(1)} мес.). Точный расчёт — используй эти числа.`;
      } },
    { id: "sitecheck", e: "🌐", name: "Проверка сайта", desc: "Работает ли сайт сейчас и как быстро отвечает",
      test: /(работает ли|не открывается|упал ли|доступен ли|лежит ли|is .* down|site status)/i,
      async run(text) {
        let host = (text.match(/https?:\/\/[^\s]+/) || text.match(/\b([a-z0-9-]+\.)+[a-z]{2,}\b/i) || [])[0]; if (!host) return null;
        if (!/^https?:/.test(host)) host = "https://" + host;
        const t0 = Date.now(); let st = "";
        try { const r = await fetch(host, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 RabbitAI-check" } }); st = `ответил кодом ${r.status} ${r.ok ? "✅ (работает)" : "⚠️"} за ${Date.now() - t0} мс`; } catch (e) { st = `не ответил за 8 секунд ❌ (${e.name === "TimeoutError" ? "таймаут" : "ошибка соединения"})`; }
        return `Проверка ${host} с сервера Rabbit AI (Европа/США): ${st}. Учти, что сайт может быть заблокирован или недоступен только в стране пользователя.`;
      } },
  ];

  async function runPlugins(text, off = [], ctx = {}) {
    const q = text.slice(0, 1500);
    const hit = PLUGINS.filter(p => !off.includes(p.id) && p.test.test(q) && (!p.test2 || p.test2.test(q))).slice(0, 5);
    const direct = hit.find(p => p.direct);
    if (direct) { try { const t = await direct.run(q, ctx); if (t) return { direct: t, used: [direct.id] }; } catch (e) { console.error("Плагин", direct.id, e.message); } }
    const res = await Promise.all(hit.filter(p => !p.direct).map(async p => { try { const t = await Promise.race([p.run(q, ctx), new Promise(r => setTimeout(() => r(null), 10000))]); return t ? { id: p.id, text: `🧩 Плагин «${p.name}» (живые данные; используй, только если они относятся к вопросу пользователя):\n${t}` } : null; } catch (e) { console.error("Плагин", p.id, e.message); return null; } }));
    const ok = res.filter(Boolean);
    return { blocks: ok.map(r => r.text), used: ok.map(r => r.id) };
  }
  async function qrImage(data) {
    const r = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&format=png&data=${encodeURIComponent(data)}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error("qr " + r.status);
    return Buffer.from(await r.arrayBuffer());
  }
  const list = () => PLUGINS.map(({ id, e, name, desc }) => ({ id, e, name, desc }));
  return { PLUGINS, runPlugins, qrImage, list, calc };
};
