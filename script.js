/* قسط‌یار — script.js */
'use strict';

var MONTH_NAMES = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
var STORE_KEY = 'ghostyar.plans.v1';
var NOTICE_DAYS = 3; // چند روز قبل از سررسید اعلان بدهیم

/* ---------- ذخیره‌سازی ---------- */
function loadPlans() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch (e) { return []; }
}
function savePlans(plans) { localStorage.setItem(STORE_KEY, JSON.stringify(plans)); }

/* ---------- ابزارهای عدد و تاریخ ---------- */
function toFa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }
function toEn(s) {
  return String(s)
    .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
    .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
    .replace(/[^\d]/g, '');
}
function fmtMoney(n) { return toFa(n.toLocaleString('en-US')); }
function fmtJalali(jy, jm, jd) { return toFa(jy) + '/' + toFa(String(jm).padStart(2, '0')) + '/' + toFa(String(jd).padStart(2, '0')); }
function jalaliMonthLen(jy, jm) { return Jalali.jalaaliMonthLength(jy, jm); }

/* امروز شمسی */
function todayJalali() {
  var now = new Date();
  // ایران حدود UTC+3:30 است؛ برای دقت روز را با آفست محلی مرورگر می‌گیریم
  var j = Jalali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return j;
}
/* فاصله روز بین دو تاریخ گregorian (d - ref) بر حسب روز */
function daysBetween(refDate, y, m, d) {
  var target = new Date(y, m - 1, d);
  var ref = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  return Math.round((target - ref) / 86400000);
}

/* تولید لیست اقساط یک وام */
function buildInstallments(plan) {
  var list = [];
  var day = plan.day, month = plan.month, year = plan.year;
  for (var i = 0; i < plan.count; i++) {
    var jy = year, jm = month, jd = Math.min(day, jalaliMonthLen(jy, jm));
    if (i > 0) {
      var total = (month - 1) + i;
      jm = (total % 12) + 1;
      jy = year + Math.floor(total / 12);
      jd = Math.min(day, jalaliMonthLen(jy, jm));
    }
    var g = Jalali.toGregorian(jy, jm, jd);
    list.push({
      n: i + 1,
      jy: jy, jm: jm, jd: jd,
      gy: g.gy, gm: g.gm, gd: g.gd,
      amount: plan.amount,
      paid: false
    });
  }
  return list;
}

/* ---------- اعلان و توست ---------- */
var toastTimer;
function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
}

/* ---------- ورودی‌های تاریخ فرم ---------- */
function initDateSelects() {
  var sdDay = document.getElementById('sdDay');
  var sdMonth = document.getElementById('sdMonth');
  var sdYear = document.getElementById('sdYear');
  for (var d = 1; d <= 31; d++) {
    var o = document.createElement('option');
    o.value = d; o.textContent = toFa(d);
    sdDay.appendChild(o);
  }
  MONTH_NAMES.forEach(function (name, idx) {
    var o = document.createElement('option');
    o.value = idx + 1; o.textContent = name;
    sdMonth.appendChild(o);
  });
  var t = todayJalali();
  for (var y = t.jy - 1; y <= t.jy + 5; y++) {
    var oy = document.createElement('option');
    oy.value = y; oy.textContent = toFa(y);
    sdYear.appendChild(oy);
  }
  sdMonth.value = t.jm;
  sdYear.value = t.jy;
  var dayLen = jalaliMonthLen(t.jy, t.jm);
  sdDay.value = Math.min(t.jd + 1, dayLen); // پیش‌فرض: فردا
  sdDay.dataset.fixedLen = dayLen;
  sdMonth.addEventListener('change', function () {
    var len = jalaliMonthLen(parseInt(sdYear.value, 10), parseInt(sdMonth.value, 10));
    if (parseInt(sdDay.value, 10) > len) sdDay.value = len;
  });
}

/* ---------- رندر ---------- */
function render() {
  var plans = loadPlans();
  var wrap = document.getElementById('plans');
  var empty = document.getElementById('emptyState');
  wrap.innerHTML = '';
  empty.style.display = plans.length ? 'none' : 'block';

  var now = new Date();
  plans.forEach(function (plan) {
    var card = document.createElement('section');
    card.className = 'card';

    var head = document.createElement('div');
    head.className = 'plan-head';
    var title = document.createElement('div');
    title.className = 'plan-title';
    title.textContent = plan.bank;
    var actions = document.createElement('div');
    actions.className = 'plan-actions';
    actions.appendChild(makeCalAllBtn(plan));
    actions.appendChild(makeDelBtn(plan));
    head.appendChild(title);
    head.appendChild(actions);

    var meta = document.createElement('div');
    meta.className = 'plan-meta';
    meta.textContent = 'قسط ' + toFa(plan.count) + ' ماهه × ' + fmtMoney(plan.amount) + ' تومان — شروع از ' +
      fmtJalali(plan.year, plan.month, Math.min(plan.day, jalaliMonthLen(plan.year, plan.month)));
    head.appendChild(meta);
    card.appendChild(head);

    var table = document.createElement('table');
    table.className = 'inst';
    table.innerHTML = '<thead><tr>' +
      '<th class="num">#</th><th>مبلغ (تومان)</th><th>تاریخ سررسید</th><th></th><th class="act"></th>' +
      '</tr></thead>';
    var tbody = document.createElement('tbody');

    plan.installments.forEach(function (inst) {
      var tr = document.createElement('tr');
      var dLeft = daysBetween(now, inst.gy, inst.gm, inst.gd);

      var badge;
      if (inst.paid) badge = '<span class="badge paid">پرداخت شد</span>';
      else if (dLeft < 0) badge = '<span class="badge past">گذشته</span>';
      else if (dLeft <= NOTICE_DAYS) badge = '<span class="badge due-soon">' + (dLeft === 0 ? 'سررسید امروز' : toFa(dLeft) + ' روز مانده') + '</span>';
      else badge = '<span class="badge future">' + toFa(dLeft) + ' روز مانده</span>';

      tr.innerHTML =
        '<td class="num">' + toFa(inst.n) + '</td>' +
        '<td class="amount">' + fmtMoney(inst.amount) + '</td>' +
        '<td class="date-cell"><b>' + fmtJalali(inst.jy, inst.jm, inst.jd) + '</b><span>' + MONTH_NAMES[inst.jm - 1] + '</span></td>' +
        '<td>' + badge + '</td>';

      var tdAct = document.createElement('td');
      tdAct.className = 'act';
      var chk = document.createElement('button');
      chk.className = 'check-btn';
      chk.title = 'علامت‌زدن پرداخت';
      chk.setAttribute('aria-label', 'قسط ' + toFa(inst.n) + ' پرداخت شد');
      chk.textContent = inst.paid ? '✓' : '';
      chk.addEventListener('click', function () {
        var plans2 = loadPlans();
        var p = plans2.find(function (x) { return x.id === plan.id; });
        var it = p.installments.find(function (x) { return x.n === inst.n; });
        it.paid = !it.paid;
        savePlans(plans2);
        render();
      });
      tdAct.appendChild(chk);
      tr.appendChild(tdAct);
      if (inst.paid) tr.classList.add('paid');
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    card.appendChild(table);
    wrap.appendChild(card);
  });
}

/* ---------- دکمه‌های تقویم ---------- */
function makeCalAllBtn(plan) {
  var btn = document.createElement('button');
  btn.className = 'btn small';
  btn.textContent = 'افزودن همه به تقویم';
  btn.addEventListener('click', function () {
    var n = 0;
    plan.installments.forEach(function (inst) {
      addEventsToCalendar(plan, inst);
      n++;
    });
    toast(n + ' رویداد تقویم ساخته شد — در صفحه Google Calendar بررسی و ذخیره کنید');
  });
  return btn;
}
function makeDelBtn(plan) {
  var btn = document.createElement('button');
  btn.className = 'btn small danger';
  btn.textContent = 'حذف وام';
  btn.addEventListener('click', function () {
    if (!confirm('این وام و همه اقساطش حذف شود؟')) return;
    var plans2 = loadPlans().filter(function (x) { return x.id !== plan.id; });
    savePlans(plans2);
    render();
    toast('وام حذف شد');
  });
  return btn;
}

/* ساخت رویداد سررسید + یادآوری ۳ روز قبل در Google Calendar */
function addEventsToCalendar(plan, inst) {
  var titleDue = 'قسط ' + plan.bank + ' — ' + fmtMoney(inst.amount) + ' تومان';
  var titleRem = 'یادآوری: قسط ' + plan.bank + ' تا ۳ روز دیگر';
  var date = inst.gy + String(inst.gm).padStart(2, '0') + String(inst.gd).padStart(2, '0');

  // رویداد سررسید
  var due = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(titleDue) +
    '&dates=' + date + '/' + date +
    '&recur=' + encodeURIComponent('RRULE:FREQ=MONTHLY;COUNT=' + plan.count) +
    '&details=' + encodeURIComponent('قسط ماهانه وام ' + plan.bank + ' — مبلغ ' + fmtMoney(inst.amount) + ' تومان');
  window.open(due, '_blank');

  // یادآوری ۳ روز قبل
  var ref = new Date(inst.gy, inst.gm - 1, inst.gd);
  ref.setDate(ref.getDate() - NOTICE_DAYS);
  var ry = ref.getFullYear(), rm = ref.getMonth() + 1, rd = ref.getDate();
  var rdate = ry + String(rm).padStart(2, '0') + String(rd).padStart(2, '0');
  var rem = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(titleRem) +
    '&dates=' + rdate + '/' + rdate +
    '&recur=' + encodeURIComponent('RRULE:FREQ=MONTHLY;COUNT=' + plan.count) +
    '&details=' + encodeURIComponent('سررسید قسط ' + plan.bank + ' در ' + toFa(NOTICE_DAYS) + ' روز آینده — مبلغ ' + fmtMoney(inst.amount) + ' تومان');
  window.open(rem, '_blank');
}

/* ---------- فرم ---------- */
function initForm() {
  document.getElementById('loanForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var bank = document.getElementById('bank').value.trim();
    var amount = parseInt(toEn(document.getElementById('amount').value), 10);
    var count = parseInt(toEn(document.getElementById('count').value), 10);
    var day = parseInt(document.getElementById('sdDay').value, 10);
    var month = parseInt(document.getElementById('sdMonth').value, 10);
    var year = parseInt(document.getElementById('sdYear').value, 10);

    if (!bank) { toast('نام بانک را وارد کنید'); return; }
    if (!amount || amount < 1000) { toast('مبلغ قسط را درست وارد کنید'); return; }
    if (!count || count < 1 || count > 120) { toast('تعداد اقساط بین ۱ تا ۱۲۰ باشد'); return; }
    if (day > jalaliMonthLen(year, month)) { toast('این ماه فقط ' + toFa(jalaliMonthLen(year, month)) + ' روز دارد'); return; }

    var plans = loadPlans();
    plans.push({
      id: Date.now(),
      bank: bank, amount: amount, count: count,
      day: day, month: month, year: year,
      installments: buildInstallments({ day: day, month: month, year: year, amount: amount, count: count })
    });
    savePlans(plans);
    render();
    e.target.reset();
    initDateSelects();
    toast('اقساط ثبت شد — برای اعلان، دکمه «افزودن همه به تقویم» را بزنید');
  });
}

/* ---------- شروع ---------- */
(function init() {
  try {
    if (typeof Jalali === 'undefined') throw new Error('jalali not loaded');
  } catch (err) {
    document.getElementById('emptyState').innerHTML =
      '<p>خطا در بارگذاری صفحه. لطفاً صفحه را نوسازی کنید.</p>';
    setTimeout(function () { location.reload(true); }, 1500);
    return;
  }
  var t = todayJalali();
  document.getElementById('todayLabel').textContent = 'امروز ' + toFa(t.jd) + ' ' + MONTH_NAMES[t.jm - 1] + ' ' + toFa(t.jy);
  initDateSelects();
  initForm();
  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
