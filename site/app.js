(function () {
  "use strict";
  var E = window.EVIDENCE;
  if (!E) return;
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function a(href, text) { return '<a href="' + esc(href) + '">' + esc(text) + "</a>"; }
  function firstLine(s) { return String(s || "").split("\n")[0]; }
  function ms(t) { return "at " + Number(t).toFixed(0) + " ms"; }

  function cell(kind, v, d, diverge) {
    return '<div class="cell ' + kind + (diverge ? " diverge" : "") + '"><span class="tag">' +
      (kind === "current" ? "Current" : "Broken") + '</span><span class="v">' + esc(v) + '</span>' +
      (d ? '<span class="d">' + esc(d) + "</span>" : "") + "</div>";
  }
  function beatRow(label, t, cur, brk) {
    return '<li class="beat"><div class="what">' + esc(label) + '<span class="t">' + esc(ms(t)) + "</span></div>" + cur + brk + "</li>";
  }

  /* ---------------------------------------------------------- scenario 1: lost reply */
  var L = E.lost_reply;
  var lostLabels = ["The bench sends the measurement", "The database records it", "The reply is lost",
                    "The bench sends again", "The result comes back"];
  $("beats-lost").innerHTML = lostLabels.map(function (label, i) {
    var c = L.current.beats[i], b = L.broken.beats[i];
    return beatRow(label, c.t, cell("current", c.value, c.detail), cell("broken", b.value, b.detail, i === 4 && b.value !== c.value));
  }).join("");

  function rowsText(rows) {
    return rows.map(function (r) { return "measurement " + r.id + ", key " + r.key + "…, " + r.acir + " mΩ"; }).join("; ");
  }
  $("verdict-lost").innerHTML =
    '<div class="label">Rows for this one test, read back from the database</div>' +
    '<div class="out ok"><span class="num">' + L.current.rows.length + '</span><span class="what">' +
      (L.current.rows.length === 1 ? "one test, one record" : L.current.rows.length + " records") +
      '</span><span class="rows">' + esc(rowsText(L.current.rows)) + '</span><span class="rows">Test passed</span></div>' +
    '<div class="out ko"><span class="num">' + L.broken.rows.length + '</span><span class="what">one test, ' +
      L.broken.rows.length + ' records</span><span class="rows">' + esc(rowsText(L.broken.rows)) +
      '</span><span class="fail">Test failed: ' + esc(firstLine(L.broken.failure)) + "</span></div>";

  /* ---------------------------------------------------------- scenario 2: hold against release */
  var R = E.race;
  var raceLabels = {
    hold: ["The operator opens a hold", "Quality starts the release", "The hold commits", "The release returns"],
    release: ["Quality releases the pack", "The operator opens a hold", "The release commits", "The hold returns"]
  };
  function human(b, i, order) {
    if (i === 1) return b.detail.indexOf("waiting on a lock") === 0 ? "waits for the pack lock" : "does not wait";
    if (i === 3) return b.value;
    return b.value;
  }
  function stateText(s) {
    var st = { on_hold: "On hold", released: "Released", in_process: "In process", shipped: "Shipped" }[s.status] || s.status;
    return { head: st, rest: (s.release_eligible ? "still eligible to ship" : "not eligible to ship") + ", " +
      s.open_holds + " open hold" + (s.open_holds === 1 ? "" : "s") };
  }
  function renderRace(order) {
    var sc = R[order];
    $("race-broken-label").textContent = "Broken on purpose: " + sc.variant_label;
    $("beats-race").innerHTML = raceLabels[order].map(function (label, i) {
      var c = sc.current.beats[i], b = sc.broken.beats[i];
      var cv = human(c, i, order), bv = human(b, i, order);
      return beatRow(label, c.t - sc.current.beats[0].t, cell("current", cv, c.detail), cell("broken", bv, b.detail, bv !== cv));
    }).join("");
    var cs = stateText(sc.current.state), bs = stateText(sc.broken.state);
    $("verdict-race").innerHTML =
      '<div class="label">Pack state read back from the database</div>' +
      '<div class="out ok"><span class="num">' + esc(cs.head) + '</span><span class="what">' + esc(cs.rest) +
        '</span><span class="rows">Test passed</span></div>' +
      '<div class="out ko"><span class="num">' + esc(bs.head) + '</span><span class="what">' + esc(bs.rest) +
        '</span><span class="fail">Test failed: ' + esc(firstLine(sc.broken.failure).split(": {")[0]) + "</span></div>";
    raceOrder = order;
    setSource();
  }

  /* ---------------------------------------------------------- source line */
  var scenario = "lost", raceOrder = "hold";
  var run = "CI run #" + E.run_number;
  function setSource() {
    var head = "Recorded in " + a(E.run_url, run) + " on commit " + a(E.repo + "/commit/" + E.commit, E.commit_short) + ". ";
    var links = scenario === "lost"
      ? "Sources: " + a(L.test, "the test") + ", " + a(L.variant, "the broken variant") + ", " +
        a(L.function, "the database function") + ", " + a(L.station, "the bench client") + ", " + a(L.proxy, "the proxy that drops the reply") + "."
      : "Sources: " + a(R[raceOrder].test, "the test") + ", " + a(R[raceOrder].variant, "the broken variant") + ", " +
        a(R.function, "the release function") + ".";
    $("src").innerHTML = head + links;
  }

  /* ---------------------------------------------------------- scenario switching */
  var tabs = { lost: $("tab-lost"), race: $("tab-race") };
  var panels = { lost: $("sc-lost"), race: $("sc-race") };
  var rows = document.querySelectorAll("#route li[data-scenario]");
  function show(name, focusTab) {
    scenario = name;
    Object.keys(tabs).forEach(function (k) {
      tabs[k].setAttribute("aria-selected", k === name ? "true" : "false");
      tabs[k].tabIndex = k === name ? 0 : -1;
      panels[k].hidden = k !== name;
    });
    Array.prototype.forEach.call(rows, function (li) { li.classList.toggle("active", li.getAttribute("data-scenario") === name); });
    if (focusTab) tabs[name].focus();
    stop();
    setSource();
  }
  tabs.lost.addEventListener("click", function () { show("lost"); });
  tabs.race.addEventListener("click", function () { show("race"); });
  document.querySelector(".tabs").addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { show(scenario === "lost" ? "race" : "lost", true); e.preventDefault(); }
  });
  Array.prototype.forEach.call(rows, function (li) {
    li.querySelector("button").addEventListener("click", function () {
      show(li.getAttribute("data-scenario"));
      if (window.innerWidth <= 1080) $("record").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".order button"), function (btn) {
    btn.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".order button"), function (b) {
        b.setAttribute("aria-checked", b === btn ? "true" : "false");
      });
      stop();
      renderRace(btn.getAttribute("data-order"));
    });
  });

  /* ---------------------------------------------------------- replay */
  var timers = [];
  var play = $("play");
  function stop() {
    timers.forEach(clearTimeout); timers = [];
    document.querySelectorAll(".beat.dim, .verdict.dim").forEach(function (el) { el.classList.remove("dim"); });
    play.disabled = false;
  }
  play.addEventListener("click", function () {
    stop();
    var panel = panels[scenario];
    var items = Array.prototype.slice.call(panel.querySelectorAll(".beat")).concat([panel.querySelector(".verdict")]);
    if (reduce) return;
    play.disabled = true;
    items.forEach(function (el) { el.classList.add("dim"); });
    items.forEach(function (el, i) {
      timers.push(setTimeout(function () {
        el.classList.remove("dim");
        if (i === items.length - 1) play.disabled = false;
      }, 350 + i * 750));
    });
  });

  /* ---------------------------------------------------------- the other checks */
  var F = E.lift;
  var op = F.test_operator_is_refused_with_explicit_result, an = F.test_anon_is_refused, q = F.test_quality_lifts_the_hold;
  var dw = F.direct_write.map(function (x) { return x.status; });
  var dwAll = dw.every(function (s) { return s === dw[0]; }) ? "HTTP " + dw[0] : "HTTP " + dw.join(", ");
  $("lift-line").innerHTML = "Signed out: refused, HTTP " + an.status + ". Operator: refused with “" + esc(op.message) +
    "”, HTTP " + op.status + ". Quality: lifted, HTTP " + q.status + ". Writing the row directly: refused, " + dwAll +
    ", for the operator and for quality.";
  var everyone = (F.variant_everyone.match(/HTTP \d+/) || ["refused"])[0];
  $("lift-proof").innerHTML = a(F.tests, "API tests") + ", " + a(F.pgtap, "SQL checks") + ", " + a(F.function, "the function") +
    ". Caught on purpose: with a column-level revoke on top of a table grant, the operator's write went through (HTTP " +
    F.column_revoke.status + ", hold " + esc(F.column_revoke.row) + "; " + a(F.variant_column, "variant") +
    "). A version that refuses everyone fails the quality case (" + everyone + ").";
  var S = F.silent;
  $("silent").innerHTML =
    "<dt>Request</dt><dd>" + esc(S.request) + ", body " + esc(JSON.stringify(S.body)) + ", as the operator</dd>" +
    "<dt>Response</dt><dd>HTTP " + S.status + ", no error" + (S.response_body ? ", " + esc(JSON.stringify(S.response_body)) : "") + "</dd>" +
    "<dt>A screen that only checks the error</dt><dd class=\"warn\">“" + esc(S.client) + "”</dd>" +
    "<dt>The row in the database</dt><dd>" + esc(S.row) + "</dd>";

  var AU = E.audit;
  var okCount = AU.tap.filter(function (l) { return l.indexOf("ok") === 0; }).length;
  var v4 = (AU.variant_line.match(/"([^"]+)"/) || [null, AU.variant_line])[1];
  $("audit-proof").innerHTML = okCount + " of " + AU.tap.length + " " + a(AU.pgtap, "SQL assertions") + " passed; " +
    a(AU.trigger, "the trigger") + ". Caught on purpose: left with Supabase's default grants, the check “" + esc(v4) +
    "” fails (" + a(AU.variant, "variant") + ").";

  var RS = E.restore;
  var n = function (x) { return Number(x).toLocaleString("en-US"); };
  var diffs = (RS.variant_line.match(/\((\d+) differences\)/) || [null, "several"])[1];
  $("restore-line").innerHTML = n(RS.rows["public.packs"]) + " fictional packs, " + n(RS.rows["public.measurements"]) +
    " measurements and " + n(RS.rows["public.audit_log"]) + " audit rows: dumped as roles, schema and data (" +
    RS.seconds.backup + " s), restored into a fresh local stack (" + RS.seconds.restore +
    " s), inspected before any migration. On the restored API, quality lifts a pre-backup hold, an operator is refused, and a pre-backup measurement sent again comes back “replayed”. " +
    "The first drill found that a plain restore re-applied Supabase's default grants to every table and function: same rows, different rights. " +
    a(RS.fix, "The fixed procedure") + " matches the source. Timings are for this demo dataset on a CI runner, not a recovery time. Storage files and project configuration are not covered.";
  $("restore-proof").innerHTML = E.counts.restore_passed + " of " + E.counts.restore + " " + a(RS.tests, "drill checks") +
    " passed on PostgreSQL " + esc(RS.versions.postgres) + " with Supabase CLI " + esc(RS.versions.supabase_cli) + "; " + a(RS.script, "the drill script") + ". Caught on purpose: the plain restore fails the rights check (" + diffs + " differences).";

  $("service-role").innerHTML = "<code>service_role</code> bypasses row-level security but not privileges or triggers, and every change records the identity that made it (" +
    a(AU.service_role_test, "test") + "). Which identity each real workstation uses is something to inspect on a live system, not something assumed here.";

  $("traveler-test").href = E.traveler_test;
  var C = E.counts;
  document.querySelector(".limits").insertAdjacentHTML("beforebegin",
    '<p class="aside">In ' + a(E.run_url, run) + ": " + C.pytest + " API and concurrency tests, " + C.pgtap_ok +
    " SQL assertions and " + C.restore_passed + " restore checks pass; " + C.variants_caught + " of " + C.variants +
    " broken variants are each caught by their own assertion.</p>");

  /* ---------------------------------------------------------- Code 39 barcode of the demo serial */
  (function () {
    var T = { "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw", "5": "wnnwwnnnn",
      "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn", "D": "nnnnwwnnw", "E": "wnnnwwnnn",
      "M": "wnwnnnnwn", "O": "wnnnwnnwn", "P": "nnwnwnnwn", "S": "nnwnnnwwn", "-": "nwnnnnwnw", "*": "nwnnwnwnn" };
    var text = "*DEMO-6S1P-0417*", x = 0, bars = "";
    for (var i = 0; i < text.length; i++) {
      var pat = T[text[i]];
      for (var j = 0; j < 9; j++) {
        var w = pat[j] === "w" ? 3 : 1;
        if (j % 2 === 0) bars += '<rect x="' + x + '" y="0" width="' + w + '" height="30"/>';
        x += w;
      }
      x += 1;
    }
    $("barcode").innerHTML = '<svg viewBox="0 0 ' + x + ' 30" preserveAspectRatio="none" fill="#22262A">' + bars + "</svg>";
  })();

  renderRace("hold");
  show("lost");
})();
