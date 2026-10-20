// Checkout: plan + billing summary and Paddle's inline checkout (no dependencies besides Paddle.js).
//
// Settings come from config.js (site.config.json → paddle):
//   paddle.clientToken     Paddle client-side token (public): "test_…" = sandbox (shows "Test mode"), "live_…" = live
//   paddle.prices.{plan}.{monthly|yearly}   Paddle price IDs ("pri_…"), one per plan and billing period
//   licenceDelivery        "auto" once the webhook emails licence keys, else "manual" (buyer sends their computer code)
// Without a Paddle price for the choice, an external checkout link (buy.{plan}.{period}), the sales email, or the free
// trial is offered instead.
(function () {
  var root = document.documentElement;
  var cfg = window.SITE_CONFIG || {};
  var paddle = cfg.paddle || {};
  var token = (paddle.clientToken || "").trim();
  var sandbox = token.indexOf("test_") === 0;

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }
  var saved = store("theme");
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  function theme() {
    return root.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  document.getElementById("theme-toggle").addEventListener("click", function () {
    var next = theme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store("theme", next);
    if (opened) { opened = false; showPayment(); }      // Paddle's form takes its colours when it opens
  });
  document.getElementById("year").textContent = new Date().getFullYear();

  var PLANS = {
    writer: { name: "Writer", for: "For writers with a finished draft", features: [
      "Unlimited proofreading, all 4 editing passes", "Book formatting and print-ready Word book",
      "Book cover studio", "2 computers", "All updates and new features"] },
    pro: { name: "Author Pro", for: "For authors who write by voice too", features: [
      "Everything in Writer", "Audiobook studio, ready for Audible (ACX)", "Unlimited audio to manuscript",
      "Ghostwriting with a local AI", "2 computers"] },
    studio: { name: "Studio", for: "For editors, ghostwriters and small presses", features: [
      "Everything in Author Pro", "5 computers", "A separate account for each writer or client",
      "All updates and new features"] },
  };
  var DEFAULT_PRICES = { writer: 10, pro: 20, studio: 40 };
  var prices = cfg.prices || DEFAULT_PRICES;
  var discount = typeof cfg.yearlyDiscount === "number" ? cfg.yearlyDiscount : 10;
  var contact = (cfg.contactEmail || "").trim();

  function money(n) { return "$" + n.toFixed(2); }
  function el(id) { return document.getElementById(id); }

  // Start from ?plan=…&billing=… (the Choose buttons), else the last choice, else Author Pro monthly.
  var q = new URLSearchParams(location.search);
  var planSel = el("co-plan"), billSel = el("co-billing");
  planSel.value = PLANS[q.get("plan")] ? q.get("plan") : "pro";
  var b = q.get("billing") || store("billing");
  billSel.value = b === "yearly" ? "yearly" : "monthly";
  billSel.querySelector('option[value="yearly"]').textContent = "Yearly (save " + discount + "%)";
  el("co-test").hidden = !sandbox;

  function choice() {
    var plan = planSel.value, period = billSel.value;
    var monthly = Number(prices[plan] || DEFAULT_PRICES[plan]);
    var base = period === "yearly" ? monthly * 12 : monthly;
    var cut = period === "yearly" ? base * discount / 100 : 0;
    return { plan: plan, period: period, base: base, cut: cut, total: base - cut };
  }

  function showSummary() {
    var c = choice(), p = PLANS[c.plan];
    el("co-for").textContent = p.for;
    var list = el("co-features");
    list.textContent = "";
    p.features.forEach(function (f) {
      var li = document.createElement("li");
      li.textContent = f;
      list.appendChild(li);
    });
    el("sum-label").textContent = p.name + (c.period === "yearly" ? ", 12 months" : ", 1 month");
    el("sum-base").textContent = money(c.base);
    el("sum-disc-row").hidden = c.period !== "yearly";
    el("sum-disc-label").textContent = "Yearly discount (" + discount + "%)";
    el("sum-disc").textContent = "−" + money(c.cut);
    el("sum-total").textContent = money(c.total);
    el("co-renew").textContent = (c.period === "yearly"
      ? "Renews every year at " + money(c.total) : "Renews every month at " + money(c.total)) +
      " plus any tax. Cancel any time.";
    store("billing", c.period);
    history.replaceState(null, "", "?plan=" + c.plan + "&billing=" + c.period);
  }

  function priceId(c) {
    var p = (paddle.prices || {})[c.plan];
    return ((p && p[c.period]) || "").trim();
  }
  function buyLink(c) {
    var entry = (cfg.buy || {})[c.plan];
    return ((typeof entry === "string" ? entry : entry && entry[c.period]) || "").trim();
  }

  function showError(text) {
    var e = el("co-error");
    e.textContent = text || "";
    e.hidden = !text;
  }

  // Paddle.js is loaded once, only when there is a client-side token.
  var sdk = null, opened = false, current = null;
  function loadPaddle() {
    if (sdk) return sdk;
    sdk = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      s.onload = function () {
        try {
          if (sandbox) window.Paddle.Environment.set("sandbox");
          window.Paddle.Initialize({ token: token, eventCallback: onPaddleEvent });
          resolve(window.Paddle);
        } catch (e) { reject(e); }
      };
      s.onerror = function () { sdk = null; reject(new Error("Paddle didn't load")); };
      document.head.appendChild(s);
    });
    return sdk;
  }

  function onPaddleEvent(ev) {
    if (!ev || !ev.name) return;
    if (ev.name === "checkout.completed") {
      var d = ev.data || {};
      done(d.transaction_id || d.id, (d.customer && d.customer.email) || "", current);
    } else if (ev.name === "checkout.error") {
      showError("Something went wrong with the payment form. Please refresh the page and try again.");
    } else if (ev.name === "checkout.payment.failed") {
      showError("The payment didn't go through. Please check your details or try another card.");
    }
  }

  function showPayment() {
    var c = choice(), id = priceId(c), box = el("paddle-checkout"), alt = el("co-alt");
    showError("");
    alt.hidden = true;
    alt.textContent = "";

    if (token && id) {
      box.hidden = false;
      el("co-intro").hidden = false;
      current = c;
      if (!opened) box.innerHTML = '<p class="co-loading">Loading secure checkout…</p>';
      loadPaddle().then(function (P) {
        if (priceId(choice()) !== id) return;            // the choice changed while loading
        var items = [{ priceId: id, quantity: 1 }];
        var data = { plan: c.plan, period: c.period, source: "website" };
        if (opened) {
          if (P.Checkout.updateCheckout) P.Checkout.updateCheckout({ items: items, customData: data });
          else P.Checkout.updateItems(items);
          return;
        }
        box.textContent = "";
        P.Checkout.open({
          items: items,
          customData: data,
          settings: {
            displayMode: "inline",
            frameTarget: "paddle-checkout-frame",
            frameInitialHeight: 450,
            frameStyle: "width: 100%; min-width: 312px; background-color: transparent; border: none;",
            theme: theme(),
            locale: "en",
            variant: "one-page",
          },
        });
        opened = true;
      }).catch(function () {
        box.textContent = "";
        showError("Secure checkout couldn't load. Please check your internet connection and refresh the page.");
      });
      return;
    }

    box.hidden = true;
    el("co-intro").hidden = true;
    alt.hidden = false;
    var link = buyLink(c);
    if (link) {
      alt.innerHTML = '<a class="btn btn-primary btn-lg" rel="noopener"></a>';
      alt.firstChild.href = link;
      alt.firstChild.textContent = "Continue to secure payment";
    } else if (contact) {
      alt.innerHTML = '<p class="co-muted">Online card payment is opening soon. Email us and we\'ll send you a payment link today.</p>' +
        '<a class="btn btn-primary btn-lg"></a>';
      alt.lastChild.href = "mailto:" + contact + "?subject=" + encodeURIComponent(
        "Subscribe: " + PLANS[c.plan].name + " (" + c.period + ")");
      alt.lastChild.textContent = "Email us to subscribe";
    } else {
      alt.innerHTML = '<p class="co-muted">Online payment is being set up and opens very soon. Meanwhile, try every feature free for 7 days.</p>' +
        '<a class="btn btn-primary btn-lg" href="index.html#download">Start the free trial</a>';
    }
  }

  function done(orderId, email, c) {
    c = c || choice();
    el("co-form").hidden = true;
    el("co-done").hidden = false;
    el("done-id").textContent = orderId || "(see your receipt)";
    if (email) el("done-email").textContent = email;
    el("step-pay").className = "done";
    el("step-start").className = "current";
    var auto = cfg.licenceDelivery === "auto";
    el("done-auto").hidden = !auto;
    el("done-manual").hidden = auto;
    if (!auto) {
      if (contact) {
        var a = document.createElement("a");
        a.href = "mailto:" + contact + "?subject=" + encodeURIComponent("Licence code: " + PLANS[c.plan].name +
          " (" + c.period + "), order " + orderId) +
          "&body=" + encodeURIComponent("Order: " + orderId + "\nComputer code: ");
        a.textContent = contact;
        el("done-send").appendChild(document.createTextNode(" Email: "));
        el("done-send").appendChild(a);
      } else {
        el("done-send").appendChild(document.createTextNode(" Just reply to your receipt email."));
      }
    }
    document.querySelectorAll("#co-done [data-download]").forEach(function (dl) {
      if (cfg.downloadUrl) dl.href = cfg.downloadUrl;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  planSel.addEventListener("change", function () { showSummary(); showPayment(); });
  billSel.addEventListener("change", function () { showSummary(); showPayment(); });
  showSummary();
  showPayment();
})();
