/* ===================================================================
   Chengguang Gan — site interactions
=================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    burger.addEventListener("click", function () {
      var open = navLinks.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        navLinks.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
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

  /* ---- Terminal typing rotator ---- */
  var typed = document.getElementById("typed");
  if (typed) {
    var phrases = [
      "large language models",
      "information extraction",
      "web agents",
      "the mutual reinforcement effect"
    ];
    if (reduceMotion) {
      typed.textContent = phrases[0];
    } else {
      var pi = 0, ci = 0, deleting = false;
      (function tick() {
        var word = phrases[pi];
        typed.textContent = word.slice(0, ci);
        if (!deleting) {
          if (ci < word.length) { ci++; setTimeout(tick, 55); }
          else { deleting = true; setTimeout(tick, 1500); }
        } else {
          if (ci > 0) { ci--; setTimeout(tick, 28); }
          else { deleting = false; pi = (pi + 1) % phrases.length; setTimeout(tick, 260); }
        }
      })();
    }
  }

  /* ---- Visitor map ---- */
  var visitorMap = document.getElementById("visitorMap");
  if (visitorMap) {
    var visitorApiBase = normalizeApiBase(visitorMap.getAttribute("data-api-base"));
    var visitorSiteId = visitorMap.getAttribute("data-site-id") || window.location.hostname || "local";
    var visitorStatus = document.getElementById("visitorMapStatus");
    var visitorPins = document.getElementById("visitorMapPins");
    var visitorEmpty = document.getElementById("visitorMapEmpty");
    var visitorList = document.getElementById("visitorMapList");
    var visitorTotal = document.getElementById("visitorTotal");
    var visitorLocations = document.getElementById("visitorLocations");
    var visitorRecent = document.getElementById("visitorRecent");

    if (isConfiguredVisitorApi(visitorApiBase)) {
      setVisitorText(visitorStatus, "Loading visitor map...");
      loadVisitorSummary();
      if (!isLocalPreview()) {
        trackVisit();
        window.setTimeout(loadVisitorSummary, 1200);
      }
    }

    function normalizeApiBase(value) {
      return (value || "").replace(/\/+$/, "").trim();
    }

    function isConfiguredVisitorApi(value) {
      return Boolean(value) && value.indexOf("REPLACE") === -1 && value.indexOf("<") === -1;
    }

    function isLocalPreview() {
      return !window.location.hostname || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    }

    function setVisitorText(el, value) {
      if (el) el.textContent = value;
    }

    function trackVisit() {
      var timezone = "";
      try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
      var payload = {
        site: visitorSiteId,
        path: window.location.pathname + window.location.search,
        title: document.title,
        referrer: document.referrer || "",
        language: navigator.language || "",
        timezone: timezone,
        screen: window.screen ? [window.screen.width, window.screen.height, window.screen.colorDepth].join("x") : ""
      };

      fetch(visitorApiBase + "/api/visit", {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(function () {});
    }

    function loadVisitorSummary() {
      fetch(visitorApiBase + "/api/summary?site=" + encodeURIComponent(visitorSiteId), {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Visitor summary failed");
          return res.json();
        })
        .then(renderVisitorSummary)
        .catch(function () {
          setVisitorText(visitorStatus, "Visitor map is temporarily unavailable.");
        });
    }

    function renderVisitorSummary(data) {
      var locations = Array.isArray(data.locations) ? data.locations : [];
      setVisitorText(visitorTotal, formatVisitorNumber(data.totalVisits || 0));
      setVisitorText(visitorLocations, formatVisitorNumber(data.uniqueLocations || locations.length || 0));
      setVisitorText(visitorRecent, formatRelativeTime(data.lastSeen));

      if (visitorPins) visitorPins.textContent = "";
      if (visitorList) visitorList.textContent = "";
      visitorMap.classList.toggle("has-data", locations.length > 0);
      if (visitorEmpty) {
        visitorEmpty.textContent = locations.length ? "" : "No geolocated visits yet.";
      }

      locations.slice(0, 80).forEach(function (loc) {
        var lat = Number(loc.latitude);
        var lon = Number(loc.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !visitorPins) return;
        var pin = document.createElement("span");
        var visits = Number(loc.visits || 1);
        pin.className = "visitor-map__pin";
        pin.style.left = clamp(((lon + 180) / 360) * 100, 2, 98) + "%";
        pin.style.top = clamp(((90 - lat) / 180) * 100, 4, 96) + "%";
        pin.style.setProperty("--pin-size", clamp(9 + Math.log(visits + 1) * 4, 10, 24) + "px");
        pin.title = formatLocationLabel(loc) + " - " + formatVisitorNumber(visits) + " visits";
        visitorPins.appendChild(pin);
      });

      locations.slice(0, 4).forEach(function (loc) {
        if (!visitorList) return;
        var item = document.createElement("div");
        var title = document.createElement("strong");
        var meta = document.createElement("span");
        item.className = "visitor-map__place";
        title.textContent = formatLocationLabel(loc);
        meta.textContent = formatVisitorNumber(loc.visits || 0) + " visits";
        item.appendChild(title);
        item.appendChild(meta);
        visitorList.appendChild(item);
      });

      setVisitorText(visitorStatus, locations.length ? "Updated " + formatRelativeTime(data.generatedAt) : "Waiting for the first geolocated visit.");
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function formatLocationLabel(loc) {
      var parts = [loc.city, loc.region, loc.country].filter(Boolean);
      return parts.length ? parts.join(", ") : "Unknown location";
    }

    function formatVisitorNumber(value) {
      try { return Number(value || 0).toLocaleString("en-US"); }
      catch (e) { return String(value || 0); }
    }

    function formatRelativeTime(value) {
      if (!value) return "--";
      var date = new Date(value);
      if (Number.isNaN(date.getTime())) return "--";
      var seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
      if (seconds < 60) return "now";
      var units = [
        [31536000, "y"],
        [2592000, "mo"],
        [604800, "w"],
        [86400, "d"],
        [3600, "h"],
        [60, "m"]
      ];
      for (var i = 0; i < units.length; i++) {
        if (seconds >= units[i][0]) return Math.floor(seconds / units[i][0]) + units[i][1] + " ago";
      }
      return "--";
    }
  }

  /* ---- Year in footer ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
