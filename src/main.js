// Manuscript Editor: product site behaviour (no dependencies)
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
