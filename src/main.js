// Manuscript Editor & Formatter: product site behaviour (no dependencies)
(function () {
  var root = document.documentElement;
  root.classList.add("js");

  // Theme: remembers the visitor's choice, otherwise follows the system setting.
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }
  var saved = store("theme");
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  document.getElementById("theme-toggle").addEventListener("click", function () {
    var current = root.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store("theme", next);
  });

  // Mobile menu
  var menuBtn = document.getElementById("menu-btn");
  var links = document.getElementById("nav-links");
  function closeMenu() { links.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
  menuBtn.addEventListener("click", function () {
    var open = links.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", function (e) { if (e.target.tagName === "A") closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  // Nav border once the page scrolls
  var nav = document.querySelector(".nav");
  function onScroll() { nav.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Download buttons, filled from config.js (written at build time)
  var cfg = window.SITE_CONFIG || {};
  var url = (cfg.downloadUrl || "").trim();
  var metaText = ["Windows 10 / 11 · 64-bit", cfg.version && "Version " + cfg.version, cfg.size]
    .filter(Boolean).join(" · ");
  document.querySelectorAll("[data-download-meta]").forEach(function (el) { el.textContent = metaText; });

  // With a link, every Download button starts the download; without one they scroll to the download section.
  var finalButton = document.querySelector("#download [data-download]");
  if (url) {
    document.querySelectorAll("[data-download]").forEach(function (a) {
      a.setAttribute("href", url);
      a.setAttribute("rel", "noopener");
    });
  } else {
    finalButton.classList.add("is-disabled");
    finalButton.setAttribute("aria-disabled", "true");
    document.querySelector("[data-download-label]").textContent = "Download coming soon";
    finalButton.addEventListener("click", function (e) { e.preventDefault(); });
  }

  // Prices: monthly price per plan (config.js, else the page), yearly = 12 months less the yearly discount.
  var prices = cfg.prices || {};
  var discount = typeof cfg.yearlyDiscount === "number" ? cfg.yearlyDiscount : 10;
  function money(n) { return "$" + (Math.round(n * 100) % 100 ? n.toFixed(2) : String(Math.round(n))); }

  // Buy buttons: a checkout link per plan and billing period, else an email to the seller, else "coming soon".
  var buy = cfg.buy || {};
  var contact = (cfg.contactEmail || "").trim();
  var planNames = { writer: "Writer", pro: "Author Pro", studio: "Studio" };
  function buyLink(plan, period) {
    var entry = buy[plan];
    return ((typeof entry === "string" ? entry : entry && entry[period]) || "").trim();
  }

  var billing = document.getElementById("billing");
  function showBilling() {
    var period = billing.value;
    document.querySelectorAll("[data-price]").forEach(function (el) {
      var plan = el.getAttribute("data-price");
      var monthly = Number(prices[plan] || el.getAttribute("data-monthly"));
      var billed = document.querySelector('[data-billed="' + plan + '"]');
      if (period === "yearly") {
        var year = monthly * 12 * (1 - discount / 100);
        el.querySelector("b").textContent = money(year / 12);
        el.querySelector("span").textContent = "per month";
        billed.textContent = money(year) + " billed yearly. You save " + money(monthly * 12 - year) + ".";
      } else {
        el.querySelector("b").textContent = money(monthly);
        el.querySelector("span").textContent = "per month";
        billed.textContent = "Billed monthly. Cancel any time.";
      }
    });
    document.querySelectorAll("[data-buy]").forEach(function (a) {
      var plan = a.getAttribute("data-buy");
      var link = buyLink(plan, period);
      if (!a.getAttribute("data-label")) a.setAttribute("data-label", a.textContent);
      a.classList.remove("is-disabled");
      a.removeAttribute("aria-disabled");
      a.textContent = a.getAttribute("data-label");
      if (link) {
        a.setAttribute("href", link);
        a.setAttribute("rel", "noopener");
      } else if (contact) {
        a.setAttribute("href", "mailto:" + contact + "?subject=" + encodeURIComponent(
          "Buy Manuscript Editor & Formatter: " + planNames[plan] + " (" + period + ")"));
      } else {
        a.setAttribute("href", "#pricing");
        a.textContent = "Available soon";
        a.classList.add("is-disabled");
        a.setAttribute("aria-disabled", "true");
      }
    });
    store("billing", period);
  }
  document.querySelectorAll("[data-buy]").forEach(function (a) {
    a.addEventListener("click", function (e) { if (a.classList.contains("is-disabled")) e.preventDefault(); });
  });
  if (store("billing") === "yearly") billing.value = "yearly";
  billing.addEventListener("change", showBilling);
  showBilling();
  var discountText = "Yearly (save " + discount + "%)";
  billing.querySelector('option[value="yearly"]').textContent = discountText;
  var offer = (cfg.launchOffer || "").trim();
  if (offer) {
    var offerEl = document.getElementById("launch-offer");
    offerEl.textContent = offer;
    offerEl.hidden = false;
  }

  // Visitors not on Windows get a note
  var ua = navigator.userAgent || "";
  if (!/Windows/i.test(ua)) document.getElementById("os-note").hidden = false;

  // Reveal sections as they scroll into view
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + "ms";
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // Highlight the nav link of the section on screen
  var navLinks = Array.prototype.slice.call(links.querySelectorAll("a"));
  var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute("href")); });
  function markActive() {
    var y = window.scrollY + 120;
    var active = -1;
    sections.forEach(function (s, i) { if (s && s.offsetTop <= y) active = i; });
    navLinks.forEach(function (a, i) { a.classList.toggle("active", i === active); });
  }
  window.addEventListener("scroll", markActive, { passive: true });
  markActive();

  document.getElementById("year").textContent = new Date().getFullYear();
})();
