const GLUCOSE_MG_PER_MMOL = 18.018;
const TG_MG_PER_MMOL = 88.57;
const HDL_MG_PER_MMOL = 38.67;

const state = {
  units: "mmol",
  tab: "homa",
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function $all(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

function num(id) {
  const raw = $(id)?.value;
  if (raw === undefined || String(raw).trim() === "") return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function toGlucoseMg(value) {
  if (value === null || Number.isNaN(value)) return value;
  return state.units === "mmol" ? value * GLUCOSE_MG_PER_MMOL : value;
}

function toGlucoseMmol(value) {
  if (value === null || Number.isNaN(value)) return value;
  return state.units === "mmol" ? value : value / GLUCOSE_MG_PER_MMOL;
}

function toTgMg(value) {
  if (value === null || Number.isNaN(value)) return value;
  return state.units === "mmol" ? value * TG_MG_PER_MMOL : value;
}

function toHdlMg(value) {
  if (value === null || Number.isNaN(value)) return value;
  return state.units === "mmol" ? value * HDL_MG_PER_MMOL : value;
}

function setHidden(el, hide) {
  if (!el) return;
  el.hidden = hide;
}

function showError(box, message) {
  box.innerHTML = `<p class="calc-error">${message}</p>`;
}

function invalidRange(value, min, max, label) {
  if (value === null) return `Заполните поле «${label}».`;
  if (Number.isNaN(value) || value <= 0) return `В «${label}» нужно положительное число.`;
  if (value < min || value > max) return `Значение «${label}» выглядит неправдоподобно. Проверьте бланк и единицы.`;
  return null;
}

function glucoseBounds() {
  return state.units === "mmol"
    ? { min: 1.5, max: 25, label: "глюкоза" }
    : { min: 27, max: 450, label: "глюкоза" };
}

function lipidBounds(kind) {
  if (kind === "tg") {
    return state.units === "mmol"
      ? { min: 0.2, max: 20, label: "триглицериды" }
      : { min: 18, max: 1770, label: "триглицериды" };
  }
  return state.units === "mmol"
    ? { min: 0.2, max: 5, label: "ЛПВП" }
    : { min: 8, max: 193, label: "ЛПВП" };
}

function homaIndex(insulin, glucose) {
  if (state.units === "mmol") return (insulin * glucose) / 22.5;
  return (insulin * glucose) / 405;
}

function tygIndex(tgMg, glucoseMg) {
  return Math.log((tgMg * glucoseMg) / 2);
}

function metsIrIndex(glucoseMg, tgMg, bmi, hdlMg) {
  // Bello-Chavolla 2018: (ln(2·G0 + TG0) × BMI) / ln(HDL). G, TG, HDL в мг/дл.
  // Скобки как в работе с порогом ~50,4; иначе индекс не совпадает с опубликованными значениями.
  return (Math.log(2 * glucoseMg + tgMg) * bmi) / Math.log(hdlMg);
}

function homaBasket(value) {
  if (value < 2) {
    return "Часто в этом диапазоне говорят о более низкой оценке HOMA-IR. Это не «норма на всю жизнь»: метод инсулина и лаборатория меняют цифру.";
  }
  if (value < 2.7) {
    return "Серая зона многих ориентиров. Пример Хеликс для 20–60 лет — около 2,7; это не международный порог и не диагноз.";
  }
  return "Выше типичных лабораторных ориентиров в РФ (часто около 2,7 у взрослых 20–60 лет). Обсудите бланк с врачом: метод инсулина, возраст и клиника важнее одного числа.";
}

function tygBasket(value) {
  if (value < 8.5) {
    return "В исследованиях более низкий TyG чаще встречался у людей с меньшим метаболическим риском. Это суррогат, не личный прогноз.";
  }
  if (value <= 9) {
    return "Промежуточный диапазон по популяционным работам. Высокий TyG ассоциировали с диабетом 2 типа и сосудистыми исходами — ассоциация, не приговор.";
  }
  return "В обзорах более высокий TyG чаще шёл вместе с метаболическим и сосудистым риском. Калькулятор не предсказывает ваш исход.";
}

function metsBasket(value) {
  if (value < 40) {
    return "Ниже значений, которые в исходной работе METS-IR чаще относили к повышенному риску диабета. Другая популяция — другие цифры.";
  }
  if (value < 50.39) {
    return "Ниже порога ~50,4 из когорты Bello-Chavolla и соавт. (2018). Это исследовательский ориентир, не диагноз.";
  }
  return "Выше исследовательского ориентира ~50,4 из работы 2018 года. Имеет смысл смотреть липиды, талию и гликемию с врачом, а не «лечить индекс».";
}

function findriscScore(data) {
  let score = 0;
  const { age, bmi, waist, sex, activity, veg, glucoseHx, family, htnMeds } = data;

  if (age < 45) score += 0;
  else if (age <= 54) score += 2;
  else if (age <= 64) score += 3;
  else score += 4;

  if (bmi < 25) score += 0;
  else if (bmi < 30) score += 1;
  else score += 3;

  if (sex === "female") {
    if (waist < 80) score += 0;
    else if (waist <= 88) score += 3;
    else score += 4;
  } else {
    if (waist < 94) score += 0;
    else if (waist <= 102) score += 3;
    else score += 4;
  }

  score += activity === "yes" ? 0 : 2;
  score += veg === "yes" ? 0 : 1;
  score += glucoseHx === "yes" ? 5 : 0;
  score += htnMeds === "yes" ? 2 : 0;

  if (family === "first") score += 5;
  else if (family === "second") score += 3;

  return score;
}

function findriscBasket(score) {
  if (score < 7) {
    return { title: "Низкий", text: "В исходной шкале FINDRISC около 1% новых случаев диабета 2 типа за 10 лет в этой корзине. Это оценка риска диабета, не диагноз инсулинорезистентности." };
  }
  if (score <= 11) {
    return { title: "Слегка повышенный", text: "Ориентир исходной шкалы — около 4% за 10 лет. Образ жизни всё ещё меняет траекторию." };
  }
  if (score <= 14) {
    return { title: "Умеренный", text: "Ориентир — около 17% за 10 лет. Имеет смысл обсудить гликемию и профилактику с врачом." };
  }
  if (score <= 20) {
    return { title: "Высокий", text: "Ориентир исходной шкалы — около 33% за 10 лет. Это не диагноз ИР и не приговор." };
  }
  return { title: "Очень высокий", text: "Ориентир — около 50% за 10 лет. Калькулятор не заменяет обследования." };
}

function clinicalWarning(glucoseMmol, flags) {
  if (flags.t1 || flags.insulinRx) {
    return "HOMA-IR и похожие суррогаты плохо читаются при диабете 1 типа и на инсулинотерапии. Калькулятор не для подбора дозы инсулина. Решения — только с врачом.";
  }
  if (glucoseMmol !== null && glucoseMmol >= 7) {
    return "Глюкоза натощак ≥ 7,0 ммоль/л по критериям ADA относится к диапазону диабета и требует очной оценки. HOMA в этой ситуации малоинформативен.";
  }
  return "";
}

function renderResult({ title, value, digits, note, extra = "" }) {
  const formatted = Number(value).toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `
    <p class="result-kicker">${title}</p>
    <p class="result-number">${formatted}</p>
    <p class="result-tag">Ориентир, не диагноз</p>
    <p>${note}</p>
    ${extra}
  `;
}

function switchTab(name) {
  state.tab = name;
  $all("[data-tab]").forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  $all("[data-panel]").forEach((panel) => {
    setHidden(panel, panel.dataset.panel !== name);
  });
  const result = $("#calc-result");
  if (result) result.innerHTML = "<p class=\"result-placeholder\">Заполните поля и нажмите «Посчитать». Цифры остаются в браузере, никуда не отправляются.</p>";
}

function switchUnits(next) {
  state.units = next;
  $all("[data-units]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.units === next ? "true" : "false");
  });
  const suffix = next === "mmol" ? "ммоль/л" : "мг/дл";
  $all("[data-unit-label]").forEach((el) => {
    el.textContent = suffix;
  });
}

function runHoma() {
  const box = $("#calc-result");
  const insulin = num("#insulin");
  const glucose = num("#glucose-homa");
  const g = glucoseBounds();
  const err =
    invalidRange(insulin, 0.5, 300, "инсулин") ||
    invalidRange(glucose, g.min, g.max, g.label);
  if (err) return showError(box, err);

  const glucoseMmol = toGlucoseMmol(glucose);
  const warn = clinicalWarning(glucoseMmol, {
    t1: $("#flag-t1").checked,
    insulinRx: $("#flag-insulin-rx").checked,
  });
  const value = homaIndex(insulin, glucose);
  box.innerHTML = renderResult({
    title: "HOMA-IR",
    value,
    digits: 2,
    note: homaBasket(value),
    extra: `<p class="result-foot">Формула Matthews 1985. Инсулин в мкЕд/мл (мкМЕ/мл). ${warn ? `<strong>${warn}</strong>` : ""}</p>`,
  });
}

function runTyg() {
  const box = $("#calc-result");
  const glucose = num("#glucose-tyg");
  const tg = num("#tg-tyg");
  const g = glucoseBounds();
  const t = lipidBounds("tg");
  const err = invalidRange(glucose, g.min, g.max, g.label) || invalidRange(tg, t.min, t.max, t.label);
  if (err) return showError(box, err);

  const value = tygIndex(toTgMg(tg), toGlucoseMg(glucose));
  const glucoseMmol = toGlucoseMmol(glucose);
  const warn = clinicalWarning(glucoseMmol, {
    t1: $("#flag-t1").checked,
    insulinRx: $("#flag-insulin-rx").checked,
  });
  box.innerHTML = renderResult({
    title: "TyG-индекс",
    value,
    digits: 2,
    note: tygBasket(value),
    extra: `<p class="result-foot">Суррогат без инсулина: ln(триглицериды мг/дл × глюкоза мг/дл / 2). ${warn ? `<strong>${warn}</strong>` : ""}</p>`,
  });
}

function runMets() {
  const box = $("#calc-result");
  const glucose = num("#glucose-mets");
  const tg = num("#tg-mets");
  const hdl = num("#hdl-mets");
  const heightCm = num("#height-mets");
  const weight = num("#weight-mets");
  const g = glucoseBounds();
  const t = lipidBounds("tg");
  const h = lipidBounds("hdl");
  const err =
    invalidRange(glucose, g.min, g.max, g.label) ||
    invalidRange(tg, t.min, t.max, t.label) ||
    invalidRange(hdl, h.min, h.max, h.label) ||
    invalidRange(heightCm, 120, 230, "рост") ||
    invalidRange(weight, 30, 300, "вес");
  if (err) return showError(box, err);

  const bmi = weight / (heightCm / 100) ** 2;
  const hdlMg = toHdlMg(hdl);
  if (hdlMg <= 1) return showError(box, "ЛПВП слишком низкий для логарифма в формуле METS-IR. Проверьте бланк.");

  const value = metsIrIndex(toGlucoseMg(glucose), toTgMg(tg), bmi, hdlMg);
  const glucoseMmol = toGlucoseMmol(glucose);
  const warn = clinicalWarning(glucoseMmol, {
    t1: $("#flag-t1").checked,
    insulinRx: $("#flag-insulin-rx").checked,
  });
  box.innerHTML = renderResult({
    title: "METS-IR",
    value,
    digits: 1,
    note: metsBasket(value),
    extra: `<p class="result-foot">ИМТ в этой формуле — ${bmi.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг/м², служебная величина, не оценка внешности. ${warn ? `<strong>${warn}</strong>` : ""}</p>`,
  });
}

function runFindrisc() {
  const box = $("#calc-result");
  const age = num("#age");
  const heightCm = num("#height-find");
  const weight = num("#weight-find");
  const waist = num("#waist");
  const sex = $("input[name='sex']:checked")?.value;
  if (!sex) return showError(box, "Укажите, для какого порога талии считать баллы: женского или мужского.");
  const err =
    invalidRange(age, 18, 110, "возраст") ||
    invalidRange(heightCm, 120, 230, "рост") ||
    invalidRange(weight, 30, 300, "вес") ||
    invalidRange(waist, 40, 200, "окружность талии");
  if (err) return showError(box, err);

  const bmi = weight / (heightCm / 100) ** 2;
  const score = findriscScore({
    age,
    bmi,
    waist,
    sex,
    activity: $("#activity").value,
    veg: $("#veg").value,
    glucoseHx: $("#glucose-hx").value,
    family: $("#family").value,
    htnMeds: $("#htn-meds").value,
  });
  const basket = findriscBasket(score);
  box.innerHTML = renderResult({
    title: "FINDRISC, баллы",
    value: score,
    digits: 0,
    note: `${basket.title}. ${basket.text}`,
    extra: `<p class="result-foot">ИМТ ${bmi.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг/м² использован только для шкалы. FINDRISC оценивает риск диабета 2 типа, не ставит диагноз инсулинорезистентности.</p>`,
  });
}

const runners = {
  homa: runHoma,
  tyg: runTyg,
  mets: runMets,
  findrisc: runFindrisc,
};

document.addEventListener("DOMContentLoaded", () => {
  $all("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  $all("[data-units]").forEach((btn) => {
    btn.addEventListener("click", () => switchUnits(btn.dataset.units));
  });
  $("#calc-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    runners[state.tab]?.();
    $("#calc-result")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  const hash = window.location.hash.replace("#", "");
  if (hash === "no-labs") switchTab("findrisc");
  else if (hash === "calculator") switchTab("homa");
});
