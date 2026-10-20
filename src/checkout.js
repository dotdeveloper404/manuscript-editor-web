// Checkout: plan + billing summary and PayPal subscription buttons (no dependencies besides PayPal's own script).
//
// Settings come from config.js (site.config.json → paypal):
//   paypal.clientId        the PayPal app's Client ID (public; sandbox or live)
//   paypal.sandbox         true while testing: shows "Test mode"
//   paypal.plans.{plan}.{monthly|yearly}   PayPal plan IDs ("P-…"), one per plan and billing period
// Without a PayPal plan for the choice, an external checkout link (buy.{plan}.{period}) or the sales email is offered.
(function () {
  var root = document.documentElement;
  var cfg = window.SITE_CONFIG || {};
  var paypal = cfg.paypal || {};

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
  el("co-test").hidden = !(paypal.sandbox && paypal.clientId);

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
    el("co-renew").textContent = c.period === "yearly"
      ? "Renews every year at " + money(c.total) + ". Cancel any time."
      : "Renews every month at " + money(c.total) + ". Cancel any time.";
    store("billing", c.period);
    history.replaceState(null, "", "?plan=" + c.plan + "&billing=" + c.period);
  }

  function planId(c) {
    var p = (paypal.plans || {})[c.plan];
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

  // PayPal's script is loaded once, only when there is a Client ID.
  var sdk = null;
  function loadPayPal() {
    if (sdk) return sdk;
    sdk = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(paypal.clientId) +
        "&vault=true&intent=subscription&currency=USD";
      s.setAttribute("data-sdk-integration-source", "button-factory");
      s.onload = function () { resolve(window.paypal); };
      s.onerror = function () { sdk = null; reject(new Error("PayPal didn't load")); };
      document.head.appendChild(s);
    });
    return sdk;
  }

  var buttons = null;
  function showPayment() {
    var c = choice(), id = planId(c), box = el("paypal-buttons"), alt = el("co-alt");
    showError("");
    if (buttons) { try { buttons.close(); } catch (e) { /* already gone */ } buttons = null; }
    box.textContent = "";
    box.hidden = false;
    alt.hidden = true;
    alt.textContent = "";

    if (paypal.clientId && id) {
      box.innerHTML = '<p class="co-loading">Loading secure payment…</p>';
      loadPayPal().then(function (pp) {
        if (planId(choice()) !== id) return;           // the choice changed while loading
        box.textContent = "";
        buttons = pp.Buttons({
          style: { shape: "pill", color: "gold", layout: "vertical", label: "subscribe" },
          createSubscription: function (data, actions) {
            return actions.subscription.create({ plan_id: id });
          },
          onApprove: function (data) { done(data.subscriptionID, c); },
          onCancel: function () { showError("Payment cancelled. You can try again whenever you're ready."); },
          onError: function () {
            showError("Something went wrong with PayPal. Please try again, or use a different card.");
          },
        });
        buttons.render(box);
      }).catch(function () {
        box.textContent = "";
        showError("Secure payment couldn't load. Please check your internet connection and refresh the page.");
      });
      return;
    }

    box.hidden = true;
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

  function done(subscriptionId, c) {
    el("co-form").hidden = true;
    el("co-done").hidden = false;
    el("done-id").textContent = subscriptionId || "(see your PayPal receipt)";
    el("step-pay").className = "done";
    el("step-start").className = "current";
    if (contact) {
      var a = document.createElement("a");
      a.href = "mailto:" + contact + "?subject=" + encodeURIComponent("Licence code: " + PLANS[c.plan].name +
        " (" + c.period + "), subscription " + subscriptionId) +
        "&body=" + encodeURIComponent("Subscription: " + subscriptionId + "\nComputer code: ");
      a.textContent = contact;
      el("done-send").appendChild(document.createTextNode(" Email: "));
      el("done-send").appendChild(a);
    } else {
      el("done-send").appendChild(document.createTextNode(" Just reply to your PayPal receipt email."));
    }
    var dl = document.querySelector("#co-done [data-download]");
    if (cfg.downloadUrl) dl.href = cfg.downloadUrl;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  planSel.addEventListener("change", function () { showSummary(); showPayment(); });
  billSel.addEventListener("change", function () { showSummary(); showPayment(); });
  showSummary();
  showPayment();
})();
