// The Great Train Robbery in the terminal: how the page is laid out on the
// screen. The game is already drawn in text in the browser (its CSS is a
// text user interface), so this follows its CSS: the menu bar and the title
// on top, the town map (Ondřej's rl-display, here drawn into cells) or the
// current pane on the left, the log on the right, the status at the bottom,
// and dialogs in a double frame over it all.
/* BUILD {"files": []} */

var GAME = {
    id: "great-train-robbery",
    idleMs: 200,
    frameMs: 100,   // the townsfolk move every 40 ms; 10 frames a second show it
    usage: "great-train-robbery [--seed HEX] [--version]\n\n" +
        "The Great Train Robbery by Ondrej Zara (7DRL 2026), in the terminal. Plan a\n" +
        "train robbery, then watch it happen. The keys are shown on screen: m, o, g,\n" +
        "t, k and ? switch between the town map, the saloon, the store, the hotel,\n" +
        "the heist and help; digits pick, Enter confirms, Escape cancels, Space\n" +
        "pauses the heist. The arrows scroll the town map when it does not fit.\n" +
        "Ctrl+C or Ctrl+Q quits. Best at 130x45; plays at 100x30.\n" +
        "--seed HEX starts with that town (as ?seed= does in the browser).\n" +
        "GREAT_TRAIN_ROBBERY_LOG=debug logs every key to the state folder.\n"
};

// the page's colours (css/skin.css)
GAME.C = {
    fg: "#cb9651", bg: "#663219", highlight: "#e4c388", activeBg: "#522814",
    label: "#888888", gold: "gold", intro: "#808080", link: "#eeeeee"
};

// ------------------------------------------------------------ rl-display

// rl-display draws each thing as a positioned <div> in a shadow root;
// here the same calls keep a list of what is where, and the layout draws
// the topmost thing of each cell
GAME.defineElement = function (name, cls) {
    if (name != "rl-display") return;
    var P = cls.prototype;
    // items by id, and an index of which id is at x,y,z
    var state = function (d) {
        if (!d._rt) d._rt = { items: new Map(), pos: new Map(), grid: new Map(), version: 0 };
        return d._rt;
    };
    var key = function (x, y, z) { return x + "," + y + "," + z; };
    var at = function (d, x, y, z) { return state(d).pos.get(key(x, y, z)); };
    var place = function (st, id, it) {
        var k = key(it.x, it.y, it.z);
        if (st.pos.get(k) === undefined) st.pos.set(k, id);
    };
    // the topmost thing of a cell, kept up to date as things change
    var refresh = function (st, x, y) {
        var k = x + "," + y;
        for (var z = 9; z >= -1; z--) {
            var id = st.pos.get(key(x, y, z));
            if (id !== undefined) { st.grid.set(k, st.items.get(id)); return; }
        }
        st.grid.delete(k);
    };
    var unplace = function (st, id, it) {
        var k = key(it.x, it.y, it.z);
        if (st.pos.get(k) === id) {
            st.pos.delete(k);
            // another thing may share the cell (overlap); keep it indexed
            for (var [oid, o] of st.items) if (oid !== id && o.x == it.x && o.y == it.y && o.z == it.z) { st.pos.set(k, oid); break; }
        }
    };
    P.draw = function (x, y, visual, opts) {
        opts = opts || {};
        var id = opts.id || Math.random(), z = opts.zIndex || 0, st = state(this);
        var other = at(this, x, y, z);
        if (other !== undefined && other != id) this.delete(other);
        var it = st.items.get(id);
        if (it) { st.items.delete(id); unplace(st, id, it); refresh(st, it.x, it.y); } else it = { ch: "", fg: null, bg: null };
        it.x = x; it.y = y; it.z = z;
        if (visual.ch) it.ch = visual.ch;
        if (visual.fg) it.fg = visual.fg;
        if (visual.bg) it.bg = visual.bg;
        if (opts.part) it.part = opts.part;
        st.items.set(id, it);
        place(st, id, it);
        refresh(st, x, y);
        st.version++;
        DOM.touch();
        return id;
    };
    P.move = function (id, x, y, options) {
        var st = state(this), it = st.items.get(id);
        if (!it) return Promise.resolve();
        var other = at(this, x, y, it.z);
        if (other !== undefined && other != id) this.delete(other);
        unplace(st, id, it);
        refresh(st, it.x, it.y);
        it.x = x; it.y = y;
        place(st, id, it);
        refresh(st, x, y);
        st.version++;
        DOM.touch();
        var ms = typeof options == "number" ? options : (options && options.duration) || 150;
        return new Promise(function (r) { setTimeout(r, ms); });
    };
    P.delete = function (id) { var st = state(this), it = st.items.get(id); if (!it) return; st.items.delete(id); unplace(st, id, it); refresh(st, it.x, it.y); st.version++; DOM.touch(); };
    P.deleteAt = function (x, y, z) { var id = at(this, x, y, z || 0); if (id !== undefined) this.delete(id); };
    P.clear = function () {};
    P.fx = function (id, kf, options) {
        var ms = typeof options == "number" ? options : (options && options.duration) || 300;
        var anim = { finished: null, cancel: function () {}, commitStyles: function () {} };
        anim.finished = new Promise(function (r) { setTimeout(function () { r(anim); }, ms); });
        return anim;
    };
    P.panTo = P.panToCenter = function () { return Promise.resolve(); };
    P.connectedCallback = function () {};
    P.delegateEvent = function () { return undefined; };
};

// the display's cells: the topmost thing in each
GAME.cells = function (d) {
    return d._rt ? d._rt.grid : new Map();
};

// ------------------------------------------------------------ HTML to lines

// A small text renderer for the page's HTML: inline text wrapped into
// lines of runs ({t, fg, bg, bold, ul}), blocks one under the other,
// tables in columns, menus spread across the width
GAME.BLOCK = { P: 1, DIV: 1, SECTION: 1, MAIN: 1, H1: 1, H2: 1, H3: 1, BLOCKQUOTE: 1, UL: 1, OL: 1, LI: 1, TABLE: 1, MENU: 1, PRE: 1, DIALOG: 1, TR: 1 };

GAME.style = function (n, st) {
    var s = { fg: st.fg, bg: st.bg, bold: st.bold, ul: st.ul };
    var t = n.tagName;
    if (t == "KBD") { s.fg = GAME.kbdPlain(n) ? s.fg : GAME.C.highlight; s.bold = true; s.ul = !GAME.kbdPlain(n); }
    if (t == "STRONG" || t == "B" || t == "H1" || t == "TH") s.bold = true;
    if (t == "A") s.fg = GAME.inIntro ? "#ffffff" : GAME.C.link;
    if (t == "H1" && GAME.inIntro) s.fg = GAME.C.fg;
    if (n.style && n.style.color) s.fg = n.style.color;
    if (n.classList && n.classList.contains("alive")) s.fg = "#0f0";
    return s;
};
// in the active menu tab a kbd is not underlined or highlighted
GAME.kbdPlain = function (n) {
    for (var p = n.parentNode; p && p.nodeType == 1; p = p.parentNode) if (p.classList.contains("active") && p.parentNode && p.parentNode.id == "nav") return true;
    return false;
};

GAME.visible = function (n) {
    if (n.nodeType != 1) return true;
    if (n.attributes && "hidden" in n.attributes) return false;
    if (n.tagName == "TEMPLATE" || n.tagName == "STYLE" || n.tagName == "SCRIPT") return false;
    if (n.tagName == "DIALOG" && !n.open) return false;
    return true;
};

// inline nodes to segments
GAME.segments = function (nodes, st, out) {
    nodes.forEach(function (n) {
        if (n.nodeType == 3) { out.push({ t: n.data, s: st }); return; }
        if (n.nodeType != 1 || !GAME.visible(n)) return;
        if (n.tagName == "BR") { out.push({ br: true }); return; }
        var s = GAME.style(n, st);
        if (n.tagName == "INPUT") {
            var v = (n.value || "").toUpperCase(), w = 8, pad = Math.max(0, w - v.length);
            var t = " ".repeat(pad >> 1) + v + " ".repeat(pad - (pad >> 1));
            out.push({ t: t, s: { fg: s.fg, bg: document.activeElement == n ? GAME.C.activeBg : s.bg, bold: s.bold }, keep: true });
            return;
        }
        if (n.classList && n.classList.contains("gold")) out.push({ t: "$", s: { fg: GAME.C.gold, bg: s.bg, bold: s.bold }, keep: true });
        GAME.segments(n.childNodes, s, out);
    });
    return out;
};

// segments wrapped at w: lines of runs
GAME.wrap = function (segs, w, pre) {
    var lines = [[]], col = 0;
    var line = function () { return lines[lines.length - 1]; };
    var push = function (t, s) {
        var l = line(), last = l[l.length - 1];
        if (last && last.fg == s.fg && last.bg == s.bg && last.bold == s.bold && last.ul == s.ul) last.t += t;
        else l.push({ t: t, fg: s.fg, bg: s.bg, bold: s.bold, ul: s.ul });
        col += Array.from(t).length;
    };
    var nl = function () { lines.push([]); col = 0; };
    segs.forEach(function (g) {
        if (g.br) { nl(); return; }
        if (pre) { g.t.split("\n").forEach(function (part, i) { if (i) nl(); if (part) push(part, g.s); }); return; }
        if (g.keep) { if (col && col + g.t.length > w) nl(); push(g.t, g.s); return; }
        g.t.replace(/\s+/g, " ").split(/( )/).forEach(function (word) {
            if (!word) return;
            if (word == " ") { if (col && col < w) push(" ", g.s); return; }
            var len = Array.from(word).length;
            if (col && col + len > w) {
                // no space left dangling at the end of a line
                var l = line(), r = l[l.length - 1];
                if (r && r.t.endsWith(" ")) { r.t = r.t.slice(0, -1); }
                nl();
            }
            push(word, g.s);
        });
    });
    lines.forEach(function (l) {
        if (!pre && l.length && l[0].t.startsWith(" ")) l[0].t = l[0].t.slice(1);
        var r = l[l.length - 1];
        if (!pre && r && r.t.endsWith(" ")) r.t = r.t.replace(/ +$/, "");
    });
    while (lines.length && !lines[lines.length - 1].length) lines.pop();
    return lines;
};

GAME.len = function (l) { var n = 0; (l.runs || l).forEach(function (r) { n += Array.from(r.t).length; }); return n; };

// a block element (or a fragment) to lines; gap: blank lines between blocks
GAME.render = function (el, w, st, opts) {
    opts = opts || {};
    var out = [], inl = [];
    var flush = function () {
        if (!inl.length) return;
        var segs = GAME.segments(inl, st, []);
        inl = [];
        if (!segs.some(function (g) { return g.br || g.keep || g.t.trim(); })) return;
        var ls = GAME.wrap(segs, w, false);
        if (out.length && opts.gap) out.push([]);
        ls.forEach(function (l) { out.push(l); });
    };
    el.childNodes.forEach(function (n) {
        if (n.nodeType == 1 && !GAME.visible(n)) return;
        if (n.nodeType != 1 || !GAME.BLOCK[n.tagName]) { inl.push(n); return; }
        flush();
        var s = GAME.style(n, st), ls;
        if (n.tagName == "TABLE") ls = GAME.table(n, w, s);
        else if (n.tagName == "MENU") ls = GAME.menu(n, w, s, opts.natural);
        else if (n.tagName == "PRE") ls = GAME.wrap(GAME.segments(n.childNodes, s, []).map(function (g) { return g; }), w, true);
        else if (n.tagName == "LI" || n.tagName == "TR") ls = GAME.render(n, w, s, {});
        else ls = GAME.render(n, w, s, { gap: opts.gap, natural: opts.natural });
        if (!ls.length) return;
        if (out.length && (opts.gap || n.tagName == "MENU" || n.tagName == "TABLE" || n.tagName == "H1" || n.tagName == "BLOCKQUOTE")) out.push([]);
        // centred blocks (h1 on the intro, the "continue" line)
        // centred blocks; a <pre> as one block, the rest line by line
        if (GAME.centred(n)) {
            var bw = 0; ls.forEach(function (l) { bw = Math.max(bw, GAME.len(l)); });
            ls = ls.map(function (l) { var pad = Math.max(0, ((w - (n.tagName == "PRE" ? bw : GAME.len(l))) / 2) | 0); return pad ? [{ t: " ".repeat(pad), fg: null }].concat(l) : l; });
        }
        ls.forEach(function (l) { out.push(l); });
    });
    flush();
    return out;
};
GAME.centred = function (n) { return GAME.inIntro && (n.tagName == "H1" || n.tagName == "PRE" || (n.classList && n.classList.contains("continue"))); };

// a menu: its items spread across the width, 3ch apart at the least
GAME.menu = function (n, w, st, natural) {
    var items = n.children.filter(GAME.visible).map(function (li) { return GAME.wrap(GAME.segments(li.childNodes, GAME.style(li, st), []), 1000, false)[0] || []; });
    if (!items.length) return [];
    var total = 0;
    items.forEach(function (l) { total += GAME.len(l); });
    var inner = natural ? total + 3 * (items.length - 1) + 2 : Math.max(total + 3 * (items.length - 1), w - 2);
    var line = [{ t: " ", fg: null }];
    if (items.length == 1) {
        var pad = Math.max(0, ((inner - total) / 2) | 0);
        line.push({ t: " ".repeat(pad), fg: null });
        line = line.concat(items[0]);
        return [line];
    }
    var gaps = items.length - 1, space = inner - total, used = 0;
    items.forEach(function (l, i) {
        line = line.concat(l);
        if (i < gaps) { var g = Math.round(space * (i + 1) / gaps) - used; used += g; line.push({ t: " ".repeat(Math.max(1, g)), fg: null }); }
    });
    return [line];
};

// a table: columns as wide as their widest cell, 1ch of padding each side;
// in the item tables the chosen row is marked with » « on a darker ground
GAME.table = function (t, w, st) {
    var rows = t.rows.filter(GAME.visible);
    var item = t.classList.contains("item-table"), over = t.classList.contains("game-over");
    var cells = rows.map(function (r) {
        return r.cells.map(function (c) { return GAME.wrap(GAME.segments(c.childNodes, GAME.style(c, GAME.style(r, st)), []), 1000, false)[0] || []; });
    });
    var widths = [];
    cells.forEach(function (r) { r.forEach(function (c, i) { widths[i] = Math.max(widths[i] || 0, GAME.len(c)); }); });
    var out = [];
    rows.forEach(function (r, j) {
        var active = item && r.classList.contains("active"), bg = active ? GAME.C.activeBg : null;
        var total = over && r.classList.contains("total");
        if (total) {
            var lw = 0; widths.forEach(function (x) { lw += x + 2; });
            out.push([{ t: "─".repeat(lw), fg: GAME.C.fg }]);
        }
        var line = [];
        cells[j].forEach(function (c, i) {
            var first = i == 0, last = i == cells[j].length - 1;
            var padL = item && first ? (active ? 1 : 3) : 1, padR = item && last ? (active ? 1 : 3) : 1;
            var content = c.map(function (r) { return { t: r.t, fg: r.fg || (over && first ? GAME.C.label : null), bg: bg, bold: r.bold || total, ul: r.ul }; });
            var len = GAME.len(c), fill = widths[i] - len;
            line.push({ t: " ".repeat(padL), fg: null, bg: bg });
            if (active && first) line.push({ t: "» ", fg: GAME.C.highlight, bg: bg });
            if (over && first) { line.push({ t: " ".repeat(fill), fg: null, bg: bg }); line = line.concat(content); }
            else { line = line.concat(content); line.push({ t: " ".repeat(fill), fg: null, bg: bg }); }
            if (active && last) line.push({ t: " «", fg: GAME.C.highlight, bg: bg });
            line.push({ t: " ".repeat(padR), fg: null, bg: bg });
        });
        out.push(line);
    });
    return out;
};

GAME.drawLine = function (l, x, y, w, fg, bg) {
    var cx = x;
    l.forEach(function (r) {
        Array.from(r.t).forEach(function (ch) {
            if (cx < x + w) TERM.put(cx, y, ch, r.fg || fg, r.bg || bg || null, r.ul, r.bold);
            cx++;
        });
    });
};
GAME.drawLines = function (ls, x, y, w, h, fg, bg) {
    ls.slice(0, h).forEach(function (l, j) { GAME.drawLine(l, x, y + j, w, fg, bg); });
};

// ------------------------------------------------------------ screens

GAME.intro = function (node) {
    var W = TERM.w, H = TERM.h;
    GAME.inIntro = true;
    var w = Math.min(W - 4, 84), x = ((W - w) / 2) | 0, ls = [];
    node.children.filter(GAME.visible).forEach(function (sec) {
        var part = GAME.render(sec, w, { fg: GAME.C.intro }, { gap: true });
        if (ls.length && part.length) ls.push([]);
        ls = ls.concat(part);
    });
    GAME.inIntro = false;
    // the quotation and the rest centred as a column, cut from the bottom if need be
    var y = Math.max(0, Math.min(1, H - ls.length));
    // every line of a paragraph starts at the column's left; short ones as they are
    GAME.drawLines(ls, x, y, w, H - y, GAME.C.intro);
};

GAME.mapView = { x: 0, y: 0, manual: 0 };

GAME.layout = function () {
    var W = TERM.w, H = TERM.h, C = GAME.C;
    var intro = document.getElementById("intro"), game = document.getElementById("game");
    if (intro && !intro.hidden) { GAME.intro(intro); return; }
    if (!game || game.hidden) return;
    TERM.fillRect(0, 0, W, H, C.bg);

    var logW = Math.max(28, Math.min(60, Math.round(W * 0.36)));
    var lx = W - logW, mainW = lx - 1;
    var top = 2, bottom = H - 3;   // the rows between the two lines

    // the menu bar, and the title over the log when there is room for it
    var nav = document.getElementById("nav"), x = 1;
    if (nav) {
        var dis = nav.classList.contains("disabled");
        nav.children.forEach(function (span) {
            var act = span.classList.contains("active");
            var l = GAME.wrap(GAME.segments(span.childNodes, { fg: C.fg, bold: act }, []), 100, false)[0] || [];
            var w = GAME.len(l) + (act ? 4 : 0) + 2;
            if (act) {
                TERM.fillRect(x, 0, w, 1, C.activeBg);
                l = [{ t: "» ", fg: C.highlight }].concat(l, [{ t: " «", fg: C.highlight }]);
            }
            GAME.drawLine(l, x + 1, 0, w, C.fg, act ? C.activeBg : null);
            if (dis) for (var i = x; i < x + w; i++) { var c = TERM.cells[i]; if (c) c.fg = TERM.mix(c.fg, TERM.color(C.bg), 0.5); }
            x += w + 1;
        });
    }
    var heading = document.getElementById("heading");
    if (heading) {
        var ht = heading.textContent.trim(), hx = lx + Math.max(0, ((logW - ht.length) / 2) | 0);
        if (hx < x + 1) hx = W - ht.length - 1;
        if (hx >= x + 1) for (var i = 0; i < ht.length; i++) TERM.put(hx + i, 0, ht[i], C.fg, null, false, true);
    }

    // the frame: lines above and below the map and the log, one between
    for (var i = 0; i < W; i++) { TERM.put(i, top - 1, "─", C.highlight, null); TERM.put(i, bottom, "─", C.highlight, null); }
    for (var j = top; j < bottom; j++) TERM.put(lx - 1, j, "│", C.highlight, null);
    TERM.put(lx - 1, top - 1, "┬", C.highlight, null); TERM.put(lx - 1, bottom, "┴", C.highlight, null);

    // the left: the map or a pane
    var mh = bottom - top;
    var map = document.getElementById("map");
    if (map && !map.hidden) GAME.drawMap(map, 0, top, mainW, mh);
    ["saloon", "store", "hotel", "action", "help"].forEach(function (id) {
        var pane = document.getElementById(id);
        if (!pane || pane.hidden) return;
        var ls = GAME.render(pane, mainW - 2, { fg: C.fg }, { gap: true });
        GAME.drawLines(ls, 1, top, mainW - 2, mh, C.fg);
    });

    // the log, the latest at the bottom
    var log = document.getElementById("log");
    if (log) {
        var ls = GAME.render(log, logW - 2, { fg: C.fg }, { gap: true });
        if (ls.length > mh) ls = ls.slice(ls.length - mh);
        GAME.drawLines(ls, lx + 1, top, logW - 2, mh, C.fg);
    }

    // the status: two columns, labels in grey
    var status = document.getElementById("status");
    if (status) {
        var cols = status.querySelectorAll(".col"), labels = { status: "Status: ", money: "Money: ", party: "Party members: ", hp: "Health: " };
        cols.forEach(function (col, ci) {
            col.children.forEach(function (span, ri) {
                var lab = labels[span.className] || "";
                var l = [{ t: lab, fg: C.label }].concat(GAME.wrap(GAME.segments(span.childNodes, { fg: C.fg }, []), W, false)[0] || []);
                if (span.className == "money") l.splice(1, 0, { t: " ", fg: null });
                var len = GAME.len(l), y = bottom + 1 + ri;
                if (ci == 0) GAME.drawLine(l, 1, y, W - 2, C.fg);
                else GAME.drawLine(l, W - 1 - len, y, len, C.fg);
            });
        });
    }

    // a dialog over it all, the rest darkened
    var dlg = DOM.query(game, "dialog", false).filter(function (d) { return d.open; }).pop();
    if (dlg) GAME.dialog(dlg);
};

// the town, centred when it fits; else it follows the train in the heist
// and the arrows scroll it
GAME.drawMap = function (map, x0, y0, w, h) {
    var d = DOM.query(map, "rl-display", true);
    if (!d) return;
    var cols = d.cols, rows = d.rows, v = GAME.mapView;
    var grid = GAME.cells(d);
    var vw = Math.min(w, cols), vh = Math.min(h, rows);
    if (Date.now() - v.manual > 4000) {
        // follow the train when there is one on the map
        var tx = 0, ty = 0, n = 0;
        grid.forEach(function (it) { if (it.part == "train") { tx += it.x; ty += it.y; n++; } });
        if (n) { v.x = Math.round(tx / n - vw / 2); v.y = Math.round(ty / n - vh / 2); }
        else if (!v.set) { v.x = (cols - vw) >> 1; v.y = (rows - vh) >> 1; v.set = true; }
    }
    v.x = Math.max(0, Math.min(cols - vw, v.x)); v.y = Math.max(0, Math.min(rows - vh, v.y));
    v.vw = vw; v.vh = vh; v.cols = cols; v.rows = rows;
    var ox = x0 + ((w - vw) >> 1), oy = y0 + ((h - vh) >> 1);
    TERM.fillRect(ox, oy, vw, vh, "#000");
    grid.forEach(function (it) {
        var sx = it.x - v.x, sy = it.y - v.y;
        if (sx < 0 || sy < 0 || sx >= vw || sy >= vh) return;
        TERM.put(ox + sx, oy + sy, it.ch || " ", it.fg || "gray", it.bg || "#000", false, it.part == "train");
    });
    // where more of the town is, a mark on the frame
    if (v.y > 0) TERM.put(ox + (vw >> 1), y0 - 1, "▲", GAME.C.highlight, null);
    if (v.y + vh < rows) TERM.put(ox + (vw >> 1), y0 + h, "▼", GAME.C.highlight, null);
};

GAME.dialog = function (dlg) {
    var W = TERM.w, H = TERM.h, C = GAME.C;
    // ::backdrop, rgba(0 0 0 / 0.5)
    for (var i = 0; i < TERM.cells.length; i++) { var c = TERM.cells[i]; c.fg = TERM.mix(c.fg, [0, 0, 0], 0.5); c.bg = TERM.mix(c.bg, [0, 0, 0], 0.5); }
    var maxw = Math.min(W - 8, 76);
    var nat = GAME.render(dlg, maxw, { fg: C.fg }, { natural: true });
    var cw = 0;
    nat.forEach(function (l) { cw = Math.max(cw, GAME.len(l)); });
    cw = Math.max(cw, 20);
    var ls = GAME.render(dlg, cw, { fg: C.fg }, {});
    // padding 2lh 2ch, a double frame half a line and half a character in
    var bw = cw + 6, bh = Math.min(H - 2, ls.length + 4);
    var bx = ((W - bw) / 2) | 0, by = ((H - bh) / 2) | 0;
    TERM.fillRect(bx, by, bw, bh, C.bg);
    for (var x = bx + 1; x < bx + bw - 1; x++) { TERM.put(x, by, "═", C.highlight, null); TERM.put(x, by + bh - 1, "═", C.highlight, null); }
    for (var y = by + 1; y < by + bh - 1; y++) { TERM.put(bx, y, "║", C.highlight, null); TERM.put(bx + bw - 1, y, "║", C.highlight, null); }
    TERM.put(bx, by, "╔", C.highlight, null); TERM.put(bx + bw - 1, by, "╗", C.highlight, null);
    TERM.put(bx, by + bh - 1, "╚", C.highlight, null); TERM.put(bx + bw - 1, by + bh - 1, "╝", C.highlight, null);
    GAME.drawLines(ls, bx + 3, by + 2, cw, bh - 4, C.fg, C.bg);
};

// the arrows scroll the town map when it is shown and does not fit
GAME.onKey = function (e) {
    var map = document.getElementById("map"), v = GAME.mapView;
    if (!map || map.hidden || !v.vw) return;
    var hotel = document.getElementById("hotel");
    var dlg = DOM.query(document, "dialog", false).some(function (d) { return d.open; });
    if (dlg || (hotel && !hotel.hidden)) return;
    var dy = { 38: -3, 40: 3, 33: -v.vh, 34: v.vh }[e.keyCode], dx = { 37: -6, 39: 6 }[e.keyCode];
    if (dy === undefined && dx === undefined) return;
    if (dy && v.rows <= v.vh) return;
    if (dx && v.cols <= v.vw) return;
    v.x += dx || 0; v.y += dy || 0; v.manual = Date.now();
    DOM.touch();
    return false;
};

GAME.snapshot = function () {
    var st = document.querySelector("#status .status");
    var d = document.querySelector("rl-display");
    return "status=" + JSON.stringify(st ? st.textContent : "") + " map=" + (d ? d.cols + "x" + d.rows : "-") +
        " view=" + GAME.mapView.x + "," + GAME.mapView.y + " focus=" + (document.activeElement && document.activeElement.tagName);
};

// --seed HEX: the town of that seed, as the page's ?seed= gives it
GAME.arg = function (a, b) {
    if (a == "--seed" && b) { document.location.href = "file:///index.html?seed=" + encodeURIComponent(b); return true; }
    return false;
};

// "GitHub" on the game over dialog opens the source in a new tab; there is
// no browser here, so it does nothing
