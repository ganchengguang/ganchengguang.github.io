/* ===================================================================
   Chengguang Gan — site interactions
=================================================================== */
(function () {
  "use strict";

  /* ---- Theme (dark / light) ---- */
  var root = document.documentElement;
  var themeToggle = document.getElementById("themeToggle");
  var stored = null;
  try { stored = localStorage.getItem("theme"); } catch (e) {}
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var theme = stored || (prefersDark ? "dark" : "light");
  applyTheme(theme);

  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    var icon = themeToggle && themeToggle.querySelector("i");
    if (icon) icon.className = t === "dark" ? "fas fa-sun" : "fas fa-moon";
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
      themeToggle.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
  }
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      theme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(theme);
      try { localStorage.setItem("theme", theme); } catch (e) {}
    });
  }

  /* ---- Mobile nav ---- */
  var burger = document.getElementById("navBurger");
  var navLinks = document.getElementById("navLinks");
  if (burger && navLinks) {
    function closeMenu(returnFocus) {
      navLinks.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      if (returnFocus) burger.focus();
    }
    burger.addEventListener("click", function () {
      var open = navLinks.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu(false);
    });
    document.addEventListener("click", function (e) {
      if (!navLinks.contains(e.target) && !burger.contains(e.target)) closeMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navLinks.classList.contains("is-open")) closeMenu(true);
    });
    window.matchMedia("(max-width: 900px)").addEventListener("change", function () {
      closeMenu(false);
    });
  }

  /* ---- Navbar border on scroll ---- */
  var nav = document.getElementById("nav");
  function onScroll() { if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Publication filters ---- */
  var filterBar = document.getElementById("filters");
  var pubs = Array.prototype.slice.call(document.querySelectorAll("#pubs .pub"));
  if (filterBar) {
    var filterBtns = filterBar.querySelectorAll(".filter");
    filterBtns.forEach(function (b) { b.setAttribute("aria-pressed", b.classList.contains("is-active") ? "true" : "false"); });
    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter");
      if (!btn) return;
      filterBtns.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      var f = btn.getAttribute("data-filter");
      pubs.forEach(function (p) {
        var show = f === "all" || p.getAttribute("data-type") === f;
        p.classList.toggle("is-hidden", !show);
      });
    });
  }

  /* ---- Reveal on scroll ---- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---- Scroll-spy nav highlight ---- */
  var sections = document.querySelectorAll("main section[id]");
  var linkMap = {};
  document.querySelectorAll(".nav__links a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (href && href.charAt(0) === "#") linkMap[href.slice(1)] = a;
  });
  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.getAttribute("id");
          Object.keys(linkMap).forEach(function (k) {
            var on = k === id;
            linkMap[k].classList.toggle("is-active", on);
            if (on) linkMap[k].setAttribute("aria-current", "location");
            else linkMap[k].removeAttribute("aria-current");
          });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---- Year in footer ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
