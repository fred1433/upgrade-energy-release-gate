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
  var FIXED = "Fixed version", BROKEN = "Broken on purpose";

  function cell(kind, v, d, diverge) {
    return '<div class="cell ' + kind + (diverge ? " diverge" : "") + '"><span class="tag">' +
      (kind === "fixed" ? "Fixed" : "Broken") + '</span><span class="v">' + esc(v) + '</span>' +
      (d ? '<span class="d">' + esc(d) + "</span>" : "") + "</div>";
  }
  function shared(v, d) {
    return '<div class="cell"><span class="tag">Both versions</span><span class="v">' + esc(v) + "</span>" +
      (d ? '<span class="d">' + esc(d) + "</span>" : "") + "</div>";
  }
  // Times stay in the data; the narration shows order only (each version is its own recorded run).
  function beatRow(label, t, cells, isShared) {
    return '<li class="beat' + (isShared ? " shared" : " split") + '"><div class="what">' + esc(label) +
      '</div><div class="cells">' + cells + "</div></li>";
  }
  function card(kind, who, num, what, foot) {
    return '<div class="out ' + kind + '"><span class="who">' + esc(who) + '</span><span class="num">' + esc(num) +
      '</span><span class="what">' + esc(what) + '</span><span class="' + (kind === "ok" ? "pass" : "fail") + '">' + esc(foot) + "</span></div>";
  }
  function verdict(ok, ko) {
    return card("ok", FIXED, ok.num, ok.what, "Test passed") + card("ko", BROKEN, ko.num, ko.what, "Test failed");
  }
  function caught(label, failure) {
    return BROKEN + ": " + esc(label) + ". Its test fails with “" + esc(failure) + "”.";
  }

  /* ---------------------------------------------------------- scenario 1: lost reply */
  var L = E.lost_reply;
  var lostLabels = ["The bench sends the measurement", "The database records it", "The reply is lost",
                    "The bench sends again", "The result comes back"];
  $("beats-lost").innerHTML = lostLabels.map(function (label, i) {
    var c = L.current.beats[i], b = L.broken.beats[i];
    if (i < 4) return beatRow(label, c.t, shared(c.shared, c.shared_detail), true);
    return beatRow(label, c.t, cell("fixed", c.value, c.detail) + cell("broken", b.value, b.detail, b.value !== c.value), false);
  }).join("");
  var nC = L.current.rows.length, nB = L.broken.rows.length;
  $("verdict-lost").innerHTML = verdict(
    { num: nC, what: (nC === 1 ? "record" : "records") + " for one test" },
    { num: nB, what: (nB === 1 ? "record" : "records") + " for one test" });
  $("caught-lost").innerHTML = caught("plain insert, no key check", firstLine(L.broken.failure));

  /* ---------------------------------------------------------- scenario 2: hold against release */
  var R = E.race;
  var raceLabels = {
    hold: ["The operator opens a hold", "Quality starts the release", "The hold commits", "The release returns"],
    release: ["Quality releases the pack", "The operator opens a hold", "The release commits", "The hold returns"]
  };
  function human(b, i) {
    if (i === 1 && b.detail.indexOf("waiting on a lock") === 0) return "waits for the pack lock";
    if (i === 1 && b.detail.indexOf("finished without waiting") === 0) return "does not wait";
    return b.value;
  }
  function stateText(s) {
    var st = { on_hold: "On hold", released: "Released", in_process: "In process", shipped: "Shipped" }[s.status] || s.status;
    return { head: st, rest: (s.release_eligible ? "still eligible to ship" : "not eligible to ship") + ", " +
      s.open_holds + " open hold" + (s.open_holds === 1 ? "" : "s") };
  }
  var raceOrder = "hold", scenario = "lost";
  function renderRace(order) {
    var sc = R[order];
    $("beats-race").innerHTML = raceLabels[order].map(function (label, i) {
      var c = sc.current.beats[i], b = sc.broken.beats[i];
      var cv = human(c, i), bv = human(b, i);
      var t = c.t - sc.current.beats[0].t;
      if (cv === bv && c.detail === b.detail) return beatRow(label, t, shared(cv, c.detail), true);
      return beatRow(label, t, cell("fixed", cv, c.detail) + cell("broken", bv, b.detail, bv !== cv), false);
    }).join("");
    var cs = stateText(sc.current.state), bs = stateText(sc.broken.state);
    $("verdict-race").innerHTML = verdict({ num: cs.head, what: cs.rest }, { num: bs.head, what: bs.rest });
    $("caught-race").innerHTML = caught(sc.variant_label, firstLine(sc.broken.failure).split(": {")[0]);
    raceOrder = order;
    setSerial();
    setSource();
  }

  /* ---------------------------------------------------------- traveler serial and barcode of the run shown */
  var C39 = { "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw", "5": "wnnwwnnnn",
    "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn", "A": "wnnnnwnnw", "B": "nnwnnwnnw",
    "C": "wnwnnwnnn", "D": "nnnnwwnnw", "E": "wnnnwwnnn", "F": "nnwnwwnnn", "M": "wnwnnnnwn", "O": "wnnnwnnwn",
    "P": "nnwnwnnwn", "S": "nnwnnnwwn", "-": "nwnnnnwnw", "*": "nwnnwnwnn" };
  function barcode(serial) {
    var text = "*" + serial + "*", x = 0, bars = "";
    for (var i = 0; i < text.length; i++) {
      var pat = C39[text[i]];
      if (!pat) continue;
      for (var j = 0; j < 9; j++) {
        var w = pat[j] === "w" ? 3 : 1;
        if (j % 2 === 0) bars += '<rect x="' + x + '" y="0" width="' + w + '" height="30"/>';
        x += w;
      }
      x += 1;
    }
    return '<svg viewBox="0 0 ' + x + ' 30" preserveAspectRatio="none" fill="#22262A">' + bars + "</svg>";
  }
  function setSerial() {
    var serial = scenario === "lost" ? L.current.serial : R[raceOrder].current.serial;
    if (!serial) return;
    $("serial").textContent = serial;
    $("barcode").innerHTML = barcode(serial);
  }

  /* ---------------------------------------------------------- source line */
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
    setSerial();
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

  /* ---------------------------------------------------------- replay: steps in order, then the verdict */
  var timers = [];
  var plays = document.querySelectorAll(".play");
  function stop() {
    timers.forEach(clearTimeout); timers = [];
    document.querySelectorAll(".beat.dim").forEach(function (el) { el.classList.remove("dim"); });
    Array.prototype.forEach.call(plays, function (b) { b.disabled = false; });
  }
  Array.prototype.forEach.call(plays, function (play) {
    play.addEventListener("click", function () {
      stop();
      if (reduce) return;
      var items = Array.prototype.slice.call(panels[scenario].querySelectorAll(".beat"));
      play.disabled = true;
      items.forEach(function (el) { el.classList.add("dim"); });
      items.forEach(function (el, i) {
        timers.push(setTimeout(function () {
          el.classList.remove("dim");
          if (i === items.length - 1) play.disabled = false;
        }, 300 + i * 650));
      });
    });
  });

  /* ---------------------------------------------------------- the other checks: one result line, one proof line */
  var F = E.lift;
  var op = F.test_operator_is_refused_with_explicit_result, an = F.test_anon_is_refused, q = F.test_quality_lifts_the_hold;
  var dw = F.direct_write.map(function (x) { return x.status; });
  var dwAll = dw.every(function (s) { return s === dw[0]; }) ? "HTTP " + dw[0] : "HTTP " + dw.join(", ");
  $("lift-line").innerHTML = "Signed out: refused. Operator: refused with a reason. Quality: allowed. Direct table changes: blocked.";
  var everyone = (F.variant_everyone.match(/HTTP \d+/) || ["refused"])[0];
  $("lift-proof").innerHTML = a(F.tests, "API tests") + ", " + a(F.pgtap, "SQL checks") + ", " + a(F.function, "the function") +
    ". Caught on purpose: a column-level revoke over a table grant let the operator lift the hold (" + a(F.variant_column, "variant") + ").";
  $("lift-more").innerHTML = "Recorded answers: signed out HTTP " + an.status + ", operator HTTP " + op.status + ", quality HTTP " + q.status +
    ", direct table changes " + dwAll + " for the operator and for quality. The operator's refusal reads “" + esc(op.message) + "”. With a column-level revoke on top of a table grant, the operator's write went through (HTTP " +
    F.column_revoke.status + ", hold " + esc(F.column_revoke.row) + "). A version that refuses everyone fails the quality case (" + everyone + ").";
  var S = F.silent;
  $("silent").innerHTML =
    "<dt>Request</dt><dd>" + esc(S.request) + ", body " + esc(JSON.stringify(S.body)) + ", as the operator</dd>" +
    "<dt>Response</dt><dd>HTTP " + S.status + ", no error" + (S.response_body ? ", " + esc(JSON.stringify(S.response_body)) : "") + "</dd>" +
    "<dt>A screen that only checks the error</dt><dd class=\"warn\">“" + esc(S.client) + "”</dd>" +
    "<dt>The row in the database</dt><dd>" + esc(S.row) + "</dd>";

  var AU = E.audit;
  var okCount = AU.tap.filter(function (l) { return l.indexOf("ok") === 0; }).length;
  var v4 = (AU.variant_line.match(/"([^"]+)"/) || [null, AU.variant_line])[1];
  $("audit-proof").innerHTML = okCount + " of " + AU.tap.length + " " + a(AU.pgtap, "SQL assertions") + " pass; " +
    a(AU.trigger, "the trigger") + ". Caught on purpose: with Supabase's default grants left on, the service key could forge an entry (" + a(AU.variant, "variant") + ").";

  var RS = E.restore;
  var n = function (x) { return Number(x).toLocaleString("en-US"); };
  var diffs = (RS.variant_line.match(/\((\d+) differences\)/) || [null, "several"])[1];
  $("restore-line").innerHTML = "A backup restored into a fresh local stack comes back with the same rows and the same rights, and behaves the same: allowed calls pass, refused calls stay refused, a resent measurement is recognised.";
  $("restore-proof").innerHTML = E.counts.restore_passed + " of " + E.counts.restore + " " + a(RS.tests, "drill checks") +
    " pass; " + a(RS.script, "the drill script") + ". Caught on purpose: a plain restore came back with Supabase's default grants (" + diffs + " differences); " +
    a(RS.fix, "the fix") + " is part of the procedure.";
  $("restore-more").innerHTML = n(RS.rows["public.packs"]) + " fictional packs, " + n(RS.rows["public.measurements"]) +
    " measurements and " + n(RS.rows["public.audit_log"]) + " audit rows, dumped as roles, schema and data (" + RS.seconds.backup +
    " s) and restored (" + RS.seconds.restore + " s) on a CI runner, PostgreSQL " + esc(RS.versions.postgres) + ", Supabase CLI " +
    esc(RS.versions.supabase_cli) + ". Those timings describe this demo dataset, not a recovery time. On the restored API, quality lifts a hold from before the backup, an operator is refused, and a measurement from before the backup sent again comes back “replayed”. This drill covers the demo database. Storage objects, Auth and project configuration, Edge Functions and secrets are excluded.";

  $("service-role").innerHTML = "<code>service_role</code> bypasses row-level security but not privileges or triggers (" +
    a(AU.service_role_test, "test") + "). Which identity each real workstation uses is something to inspect on a live system, not something assumed here.";

  $("traveler-test").href = E.traveler_test;
  var C = E.counts;
  $("counts").innerHTML = "In " + a(E.run_url, run) + ": " + C.pytest + " API and concurrency tests, " + C.pgtap_ok +
    " SQL assertions and " + C.restore_passed + " restore checks pass; " + C.variants_caught + " of " + C.variants +
    " broken variants are each caught by their own assertion.";

  renderRace("hold");
  show("lost");
})();
