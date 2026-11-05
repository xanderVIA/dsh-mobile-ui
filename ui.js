/* ============================================================================
   DSH 手机端 UI 补丁 —— 运行时脚本
   由 apply.ps1 注入成 <script id="dsh-ui">，跑在插件自己的脚本之后。
   做的事：思考折叠 / 表格卡片化标签 / 顶栏自动收起 / 会话抽屉 / 新会话按钮 /
          标题上顶 / 面板打开时悬浮控件让位。
   （blockHtml 那部分属源码改动，在 apply.ps1 里做，不在这里。）
   ========================================================================== */
(function () {
  'use strict';
  var UI_BUILD = '__DSH_BUILD__';

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ---------- 1. 思考块：默认收起，只有用户点开的才展开 ---------- */
  function thinkCollapse() {
    var list = document.querySelectorAll('details.think');
    for (var i = 0; i < list.length; i += 1) {
      var d = list[i];
      if (d.getAttribute('data-user') !== '1' && d.hasAttribute('open')) d.removeAttribute('open');
    }
  }
  function bootThink() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var s = t.closest('details.think > summary');
      if (!s) return;
      var d = s.parentElement;
      d.setAttribute('data-user', d.hasAttribute('open') ? '0' : '1');
    }, true);
    thinkCollapse();
    new MutationObserver(thinkCollapse).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- 2. 表格卡片化：把表头写进每个单元格的 data-label ---------- */
  function tagTables() {
    var tables = document.querySelectorAll('.tablewrap table');
    for (var i = 0; i < tables.length; i += 1) {
      var t = tables[i];
      if (t.getAttribute('data-carded') === '1') continue;
      var ths = [];
      var thNodes = t.querySelectorAll('thead th');
      for (var k = 0; k < thNodes.length; k += 1) ths.push((thNodes[k].textContent || '').trim());
      if (ths.length === 0) continue;
      var rows = t.querySelectorAll('tbody tr');
      for (var r = 0; r < rows.length; r += 1) {
        var cells = rows[r].children;
        for (var c = 0; c < cells.length; c += 1) {
          if (ths[c] && !cells[c].getAttribute('data-label')) cells[c].setAttribute('data-label', ths[c]);
        }
      }
      t.setAttribute('data-carded', '1');
    }
  }

  /* ---------- 3. 顶栏默认收起 ---------- */
  function autoFold() {
    try {
      if (localStorage.getItem('dshm.top') === '1') return;
      var btn = document.getElementById('topToggle');
      if (!btn) return;
      localStorage.setItem('dshm.top', '1');
      btn.click();
    } catch (e) { /* 无痕模式 */ }
  }

  /* ---------- 4. 会话抽屉：☰ + 搜索框 + 遮罩 + 底部余额 ---------- */
  function buildDrawer() {
    var tabs = document.getElementById('tabs');
    if (tabs) tabs.style.display = 'none';

    if (!document.getElementById('dshMenu')) {
      var menu = document.createElement('button');
      menu.id = 'dshMenu';
      menu.type = 'button';
      menu.setAttribute('aria-label', '会话列表');
      menu.textContent = '☰';
      menu.addEventListener('click', function () {
        var b = document.getElementById('sessBtn');
        if (b) b.click();
      });
      document.body.appendChild(menu);
    }

    var scrim = document.getElementById('dshScrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.id = 'dshScrim';
      scrim.addEventListener('click', function () {
        var back = document.getElementById('sessBack');
        if (back) back.click();
      });
      document.body.appendChild(scrim);
    }

    var sheet = document.getElementById('sessopen');
    if (!sheet) return;

    if (!document.getElementById('dshSearch')) {
      var wrap = document.createElement('div');
      wrap.id = 'dshSearchWrap';
      var input = document.createElement('input');
      input.id = 'dshSearch';
      input.type = 'search';
      input.placeholder = '搜索会话标题…';
      wrap.appendChild(input);
      var bar = sheet.querySelector('.sheetbar');
      if (bar) sheet.insertBefore(wrap, bar.nextSibling);
      else sheet.insertBefore(wrap, sheet.firstChild);
      input.addEventListener('input', function () {
        var q = input.value.trim().toLowerCase();
        var rows = document.querySelectorAll('#sessList .sessrow');
        for (var i = 0; i < rows.length; i += 1) {
          var text = (rows[i].textContent || '').toLowerCase();
          rows[i].style.display = (q === '' || text.indexOf(q) >= 0) ? '' : 'none';
        }
      });
    }

    if (!document.getElementById('dshDrawerFoot')) {
      var foot = document.createElement('div');
      foot.id = 'dshDrawerFoot';
      var bill = document.createElement('button');
      bill.type = 'button';
      bill.textContent = '💰  余额';
      bill.addEventListener('click', function () {
        var back = document.getElementById('sessBack');
        if (back) back.click();
        var tab = document.querySelector('#tabs button[data-tab="bill"]');
        if (tab) tab.click();
      });
      foot.appendChild(bill);
      sheet.appendChild(foot);
    }

    var mo = new MutationObserver(function () {
      var open = sheet.style.display && sheet.style.display !== 'none';
      scrim.classList.toggle('on', Boolean(open));
    });
    mo.observe(sheet, { attributes: true, attributeFilter: ['style'] });
  }

  /* ---------- 5. 右上角 ＋ 新会话 ---------- */
  function buildNewBtn() {
    if (document.getElementById('dshNewBtn')) return;
    var plus = document.createElement('button');
    plus.id = 'dshNewBtn';
    plus.type = 'button';
    plus.setAttribute('aria-label', '新会话');
    plus.textContent = '＋';
    plus.addEventListener('click', function () {
      var sheet = document.getElementById('sessopen');
      if (sheet && sheet.style.display && sheet.style.display !== 'none') {
        var back = document.getElementById('sessBack');
        if (back) back.click();
      }
      document.body.classList.add('dsh-panel-open');
      var tab = document.querySelector('#tabs button[data-tab="new"]');
      if (tab) tab.click();
    });
    document.body.appendChild(plus);
  }

  /* ---------- 5.1 从新建页返回时恢复悬浮控件 ---------- */
  function watchNewBack() {
    var back = document.getElementById('newBack');
    if (!back || back.getAttribute('data-watched')) return;
    back.setAttribute('data-watched', '1');
    back.addEventListener('click', function () {
      document.body.classList.remove('dsh-panel-open');
    });
  }

  /* ---------- 6. 会话名上顶 ---------- */
  function buildTitle() {
    var src = document.getElementById('sessBtn');
    if (!src) return;
    var strip = function (s) { return String(s || '').replace(/▾/g, '').replace(/\s+/g, ' ').trim(); };
    var el = document.getElementById('dshTitle');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dshTitle';
      document.body.appendChild(el);
    }
    el.textContent = strip(src.textContent);
    new MutationObserver(function () { el.textContent = strip(src.textContent); })
      .observe(src, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- 7. 隐藏用不上的小方块（⌄ 收起工具键） ---------- */
  function hideFold() {
    var c = document.getElementById('composer');
    if (!c) return;
    var list = c.querySelectorAll('button, [role=button]');
    for (var i = 0; i < list.length; i += 1) {
      var t = (list[i].textContent || '').trim();
      if (t === '⌄' || t === '⌃' || t === '⋯') list[i].style.display = 'none';
    }
  }

  /* ---------- 8. 面板打开时，悬浮控件让位 ---------- */
  /* ---------- 15. 运行中：只留工具行，把「思考过程」整行隐掉（只切 class，不动 DOM，不会跳） ---------- */
  /* ---------- 16. 键盘弹出后把内容顶到卡片上方（手动滑到底时也生效） ---------- */
  function keepAboveKeyboard() {
    var log = document.getElementById('log');
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }
  function bootKeyboard() {
    document.addEventListener('focusin', function (e) {
      if (e.target && (e.target.id === 'text' || e.target.tagName === 'TEXTAREA')) {
        setTimeout(keepAboveKeyboard, 60);
        setTimeout(keepAboveKeyboard, 320);
      }
    }, true);
    window.addEventListener('resize', function () {
      setTimeout(keepAboveKeyboard, 80);
      setTimeout(keepAboveKeyboard, 360);
    });
  }


  /* ---------- 17. 运行状态：自带定时器 + 「思考中 · Ns」计时胶囊 ---------- */
  var runSince = 0;
  var lastDuration = 0;
  /* 从桥自己的统计行里读本轮已用时间（比本地计时准，和电脑端一致） */
  function turnElapsedText() {
    var txt = document.body.innerText || '';
    var pats = [/这一轮\s*(\d+):(\d+)/, /已跑\s*(\d+):(\d+)/, /本轮\s*(\d+):(\d+)/];
    for (var i = 0; i < pats.length; i += 1) {
      var m = pats[i].exec(txt);
      if (m) return m[1] + ':' + m[2];
    }
    return '';
  }
  function turnElapsed() {
    var m = /这一轮\s*(\d+):(\d+)/.exec(document.body.innerText || '');
    return m ? (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) : null;
  }
  /* ---------- 19. 版本号：让你能一眼看出页面是不是最新注入的 ---------- */
  function showBuild() {
    var sheet = document.getElementById('sessopen');
    if (!sheet || document.getElementById('dshVer')) return;
    var el = document.createElement('div');
    el.id = 'dshVer';
    el.textContent = 'UI ' + UI_BUILD;
    var bar = sheet.querySelector('.sheetbar');
    if (bar) bar.appendChild(el); else sheet.appendChild(el);
  }
  /* ---------- 20. 折叠：只切 class，不搬节点（跑完把步骤藏起来，留一条摘要） ---------- */
  /* ---------- 21. 图片查看器瘦身：只留图 + 关闭 + 翻页 ---------- */
  /* ---------- 22. 查看器：下滑关闭 + 点黑边关闭 ---------- */
  function bootViewerClose() {
    var startY = 0;
    var startX = 0;
    var movedDown = false;
    var movedSide = 0;
    function viewer() {
      var v = document.getElementById('viewer');
      if (!v || getComputedStyle(v).display === 'none') return null;
      return v;
    }
    function pager(dir) {
      var v = viewer();
      if (!v) return;
      var bs = v.querySelectorAll('button');
      for (var i = 0; i < bs.length; i += 1) {
        var t = (bs[i].textContent || '').trim();
        if (dir < 0 && (t === '‹' || t === '<' || t === '上一张')) { bs[i].click(); return; }
        if (dir > 0 && (t === '›' || t === '>' || t === '下一张')) { bs[i].click(); return; }
      }
    }
    document.addEventListener('touchstart', function (e) {
      if (!viewer()) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      movedDown = false;
      movedSide = 0;
    }, { capture: true, passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!viewer()) return;
      var dy = e.touches[0].clientY - startY;
      var dx = e.touches[0].clientX - startX;
      if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.6) movedDown = true;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) movedSide = dx > 0 ? 1 : -1;
    }, { capture: true, passive: true });
    document.addEventListener('touchend', function () {
      var v = viewer();
      if (!v) return;
      if (movedDown) {
        movedDown = false;
        var b = v.querySelector('[id$=Back], [id$=Close], .iconbtn, button');
        if (b) b.click(); else v.style.display = 'none';
        return;
      }
      if (movedSide !== 0) { pager(movedSide); movedSide = 0; }
    }, { capture: true, passive: true });
  }


  /* ---------- 23. 查看器翻页动画：换图时从左/右滑入，不再瞬间切换 ---------- */
  function bootViewerAnim() {
    var boundImg = null;
    setInterval(function () {
      try {
        var v = document.getElementById('viewer');
        if (!v || getComputedStyle(v).display === 'none') return;
        var im = v.querySelector('img');
        if (!im || im === boundImg) return;
        boundImg = im;
        im.style.willChange = 'transform, opacity';
        im.style.transition = 'transform 270ms cubic-bezier(.22,1,.36,1)';
        var lastSrc = im.src;
        new MutationObserver(function () {
          if (im.src === lastSrc) return;
          lastSrc = im.src;
          // 先落到侧面透明，再滑回正中 —— 视觉上就是"翻过去"
          im.style.transition = 'none';
          im.style.transform = 'translateX(100%)';
          im.style.opacity = '1';
          requestAnimationFrame(function () {
            im.style.transition = 'transform 270ms cubic-bezier(.22,1,.36,1)';
            im.style.transform = 'translateX(0)';
            im.style.opacity = '1';
          });
        }).observe(im, { attributes: true, attributeFilter: ['src'] });
      } catch (e) { /* 静默 */ }
    }, 500);
  }


  function tidyViewer() {
    var v = document.getElementById('viewer');
    if (!v || v.style.display === 'none') return;
    var keep = /选这张|下载|保存|另存/;
    var nodes = v.querySelectorAll('button, [role=button], a, span, div, p');
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (el.querySelector('img, video')) continue;      // 装着图片的容器不动
      var t = (el.textContent || '').trim();
      if (t.length > 30) continue;                          // 长文本是说明块，交给下面的规则
      var isButton = (el.tagName === 'BUTTON') || el.getAttribute('role') === 'button' || el.tagName === 'A';
      var junk = (t === '‹' || t === '›' || t === '<' || t === '>' || /^\d+\s*\/\s*\d+$/.test(t) ||
                  t.indexOf('新窗口打开') >= 0 || t.indexOf('钉住') >= 0 || t === '图片');
      if (isButton && !keep.test(t) && !el.querySelector('svg')) junk = true;
      if (junk) el.style.visibility = 'hidden';
    }
    // 底部提示两行也去掉
    var hints = v.querySelectorAll('p, .hint, .tip');
    for (var j = 0; j < hints.length; j += 1) {
      var ht = (hints[j].textContent || '');
      if (ht.indexOf('左右滑') >= 0 || ht.indexOf('长按图片') >= 0) hints[j].style.visibility = 'hidden';
    }
  }


  function bootFold() {
    var wasRunning = false;
    var count = 0;
    setInterval(function () {
      try {
        var log = document.getElementById('log');
        if (!log) return;
        var running = document.body.classList.contains('dsh-running');
        if (running) {
          var nodes = log.querySelectorAll('.tool, details.think');
          for (var i = 0; i < nodes.length; i += 1) {
            if (!nodes[i].classList.contains('dsh-turn')) nodes[i].classList.add('dsh-turn');
          }
          wasRunning = true;
          count = nodes.length;
        } else if (wasRunning) {
          wasRunning = false;
          document.body.classList.add('dsh-folded');
          var el = document.getElementById('dshDone');
          var host = document.getElementById('composer') || document.body;
          if (!el) {
            el = document.createElement('div');
            el.id = 'dshDone';
            el.addEventListener('click', function () { document.body.classList.toggle('dsh-folded'); });
          }
          if (el.parentNode !== host) host.appendChild(el);
          var txt = '已完成 · ' + count + ' 步 ' + (document.body.classList.contains('dsh-folded') ? '▸ 展开' : '▾ 收起');
          if (el.textContent !== txt) el.textContent = txt;
        }
      } catch (e) { /* 静默 */ }
    }, 700);
  }


  function bootRunning() {
    var log = document.getElementById('log');
    if (!log) return;
    setInterval(function () {
      try {
        var stopBtn = document.getElementById('stop');
        var running = !!(stopBtn && stopBtn.offsetParent !== null && getComputedStyle(stopBtn).display !== 'none');
        document.body.classList.toggle('dsh-running', running);
        // 运行中只留最后一条工具行
        if (running) {
          var tools = log.querySelectorAll('.tool');
          var last = tools.length ? tools[tools.length - 1] : null;
          for (var i = 0; i < tools.length; i += 1) {
            var should = tools[i] === last;
            if (tools[i].classList.contains('dsh-last-tool') !== should) tools[i].classList.toggle('dsh-last-tool', should);
          }
        }
        // 对话流里的「深度求索中，用时」——和电脑同款，不再用顶部胶囊
        var el = document.getElementById('dshInline');
        if (running) {
          if (!el) { el = document.createElement('div'); el.id = 'dshInline'; (document.getElementById('composer') || document.body).appendChild(el); }
          var host = document.getElementById('composer') || document.body; if (el.parentNode !== host) host.appendChild(el);
          var clock = turnElapsedText();
          if (!clock) {
            if (!window.__dshRunStart) window.__dshRunStart = Date.now();
            var s2 = Math.round((Date.now() - window.__dshRunStart) / 1000);
            clock = Math.floor(s2 / 60) + ':' + ('0' + (s2 % 60)).slice(-2);
          }
          var txt = '深度求索中，用时 ' + clock;
          if (el.textContent !== txt) el.textContent = txt;
        } else if (el) {
          el.remove();
          window.__dshRunStart = 0;
        }
      } catch (err) { /* 静默 */ }
    }, 500);
  }


  function markRunning() {
    var log = document.getElementById('log');
    if (!log) return;
    if (document.body.classList.contains('dsh-running')) return;   // 只认真实运行态
    document.body.classList.toggle('dsh-running', on);
    if (!on) return;
    var tools = log.querySelectorAll('.tool');
    if (!tools.length) return;
    var last = tools[tools.length - 1];
    for (var i = 0; i < tools.length; i += 1) {
      var should = tools[i] === last;
      if (tools[i].classList.contains('dsh-last-tool') !== should) {
        tools[i].classList.toggle('dsh-last-tool', should);
      }
    }
  }


  function panelAware() {
    function sync() {
      // 只要主对话区（#log）不是可见状态 —— 新建/余额页、任何浮层 —— 就让悬浮控件让位
      // 主对话区不可见，或者「新建 / 余额」这类页面自己露出来了 → 悬浮控件让位
      // 输入区（#composer）只有「任务」页才有 —— 它不在，就说明在别的页（新建/余额）
      // 用「创建任务」按钮（#createBtn，只有新建页才有）判断是不是在新建页
      var createBtn = document.getElementById('createBtn');
      var onNew = !!(createBtn && createBtn.offsetParent !== null && createBtn.getBoundingClientRect().height > 10);
      var onTask = !onNew;
      var otherPages = document.querySelectorAll('#new, #newpage, #bill, #billpage, [data-page="new"], [data-page="bill"]');
      var pageOpen = false;
      for (var q = 0; q < otherPages.length; q += 1) {
        var pg = otherPages[q];
        if (pg.offsetParent !== null && pg.getBoundingClientRect().height > 60) { pageOpen = true; break; }
      }
      var sheetOpen = false;
      var sheets = document.querySelectorAll('[id`$=open]');
      for (var i = 0; i < sheets.length; i += 1) {
        var s = sheets[i];
        if (s.id === 'sessopen' || s.id === 'viewer') continue;
        if (!s.style.display || s.style.display === 'none') continue;
        if (getComputedStyle(s).display === 'none') continue;
        if (s.offsetWidth < 40 || s.offsetHeight < 40) continue;
        sheetOpen = true;
        break;
      }
      if (sheetOpen || onNew) document.body.classList.add('dsh-panel-open');   // 只加不减：减只由「← 返回」触发
    }
    sync();
    var sheets = document.querySelectorAll('.sheet');
    var mo = new MutationObserver(sync);
    for (var i = 0; i < sheets.length; i += 1) mo.observe(sheets[i], { attributes: true, attributeFilter: ['style', 'class'] });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    setInterval(function () { try { sync(); } catch (e) {} try { markRunning(); } catch (e) {} }, 400);
  }

  /* ---------- 9. 关掉「左右滑动换页」（底部页签已去掉，滑过去只会误触） ---------- */
  function killSwipe() {
    var tracking = false;
    function insideSafe(el) {
      return !!(el && el.closest && el.closest('#composer, #sessopen, .sheet, #viewer, [id$=open], input, textarea, select'));
    }
    window.addEventListener('touchstart', function (e) {
      if (insideSafe(e.target)) return;
      tracking = true;
      e.stopPropagation();
    }, { capture: true, passive: true });
    window.addEventListener('touchmove', function (e) {
      if (!tracking) return;
      e.stopPropagation();
    }, { capture: true, passive: true });
    window.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      e.stopPropagation();
    }, { capture: true, passive: true });
  }

  /* ---------- 10. 会话行只留一个 ⋯，点开是 置顶/常用/删除 ---------- */
  /* ---------- 18. 会话列表里的状态：运行中转圈，完成打勾 ---------- */
  var runningIds = {};
  function refreshRunning() {
    try {
      fetch('api/boot', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || !d.sessions) return;
          var map = {};
          for (var i = 0; i < d.sessions.length; i += 1) {
            if (d.sessions[i].running === true) map[d.sessions[i].sessionId] = 1;
          }
          runningIds = map;
          sessStatus();
        })
        .catch(function () {});
    } catch (e) {}
  }
  function sessStatus() {
    var rows = document.querySelectorAll('#sessList .sessrow');
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var main = row.querySelector('[data-session]');
      var id = main ? main.getAttribute('data-session') : '';
      // 只用「停止按钮」这个真值判断当前会话；其它会话一律打勾
      // （桥返回的 running 字段会残留：实测有两个会话标着在跑，实际都停了）
      var running = runningIds[id] === 1;
      if (main && main.classList.contains('on')) {
        var stopBtn2 = document.getElementById('stop');
        if (stopBtn2 && stopBtn2.offsetParent !== null && getComputedStyle(stopBtn2).display !== 'none') running = true;
      }
      var dot = row.querySelector('.dsh-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'dsh-dot';
        row.insertBefore(dot, row.firstChild);
      }
      var want = running ? 'run' : 'done';
      if (dot.getAttribute('data-s') !== want) {
        dot.setAttribute('data-s', want);
        dot.className = 'dsh-dot ' + want;
        dot.textContent = running ? '' : '✓';
      }
    }
  }
  function bootStatus() {
    refreshRunning();
    setInterval(function () {
      var sheet = document.getElementById('sessopen');
      var open = sheet && sheet.style.display && sheet.style.display !== 'none';
      if (open) refreshRunning();
    }, 2000);
  }


  function sessRowMenu() {
    var sheet = document.getElementById('sessopen');
    if (!sheet) return;
    var pop = document.getElementById('dshMenuPop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'dshMenuPop';
      document.body.appendChild(pop);
      document.addEventListener('pointerdown', function (e) {
        if (pop.contains(e.target)) return;
        if (e.target.closest && e.target.closest('#sessmore')) return;
        pop.classList.remove('on');
      }, true);
    }
    function openMenu(more) {
      var row = more.parentElement;
      var pin = row.querySelector('[data-pin]');
      var star = row.querySelector('[data-star]');
      var del = row.querySelector('[data-del]');
      pop.innerHTML = '';
      var items = [];
      if (pin) items.push(['📌  置顶', pin, '']);
      if (star) items.push(['⭐  常用', star, '']);
      if (del) items.push(['🗑  删除', del, 'danger']);
      items.forEach(function (it) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = it[0];
        if (it[2]) b.className = it[2];
        b.addEventListener('pointerdown', function (ev2) { ev2.stopPropagation(); });
        b.addEventListener('click', function (ev2) {
          ev2.stopPropagation();
          pop.classList.remove('on');
          it[1].click();
        });
        pop.appendChild(b);
      });
      var r = more.getBoundingClientRect();
      pop.classList.add('on');
      var pr = pop.getBoundingClientRect();
      var top = r.bottom + 4;
      if (top + pr.height > window.innerHeight - 8) top = Math.max(8, r.top - pr.height - 4);
      var left = Math.min(window.innerWidth - pr.width - 8, Math.max(8, r.left + r.width - pr.width));
      pop.style.top = top + 'px';
      pop.style.left = left + 'px';
    }
    // 委托：列表每次重画都会换掉行里的节点，绑在按钮上会丢事件（点上去"闪一下"就是这个）
    if (!sheet.getAttribute('data-menu')) {
      sheet.setAttribute('data-menu', '1');
      sheet.addEventListener('pointerdown', function (ev) {
        var m = ev.target.closest && ev.target.closest('#sessmore');
        if (!m) return;
        ev.preventDefault();
        ev.stopPropagation();
        openMenu(m);
      }, true);
    }
    var rows = sheet.querySelectorAll('.sessrow');
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i].querySelector('#sessmore')) continue;
      var more = document.createElement('button');
      more.id = 'sessmore';
      more.type = 'button';
      more.textContent = '⋯';
      rows[i].appendChild(more);
    }
  }

  /* ---------- 11. 余额直接显示数字 ---------- */
  function showBalance() {
    var foot = document.getElementById('dshDrawerFoot');
    if (!foot || foot.getAttribute('data-done') === '1') return;
    foot.setAttribute('data-done', '1');
    foot.innerHTML = '<span class="k">余额</span><span class="v" id="dshBal">—</span><span class="u" id="dshBalUnit"></span>';
    fetch('api/balance', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var v = data.total_balance || data.balance || data.totalBalance || data.amount || (data.data && (data.data.total_balance || data.data.balance));
        var cur = data.currency || (data.data && data.data.currency) || '';
        if (v !== undefined && v !== null && v !== '') {
          var n = Number(v);
          document.getElementById('dshBal').textContent = isNaN(n) ? String(v) : ('¥ ' + n.toFixed(2).replace(/\.00$/, ''));
          if (cur && cur !== 'CNY') document.getElementById('dshBalUnit').textContent = cur;
        }
      })
      .catch(function () { /* 没装余额插件 */ })
      .then(function () {
        var v = document.getElementById('dshBal');
        if (v && (v.textContent === '—' || v.textContent === '')) {
          var f = document.getElementById('dshDrawerFoot');
          if (f) f.style.display = 'none';
        }
      });
  }


  /* ---------- 12. WebView 里没有语音合成，就把「念出来」按钮藏掉 ---------- */
  function hideSpeak() {
    if (window.speechSynthesis) return;
    var all = document.querySelectorAll('button');
    for (var i = 0; i < all.length; i += 1) {
      var label = (all[i].getAttribute('aria-label') || '') + (all[i].getAttribute('title') || '');
      if (label.indexOf('朗读') >= 0 || label.indexOf('念') >= 0 || label.toLowerCase().indexOf('speak') >= 0) {
        all[i].style.display = 'none';
      }
    }
  }

  /* ---------- 13. 把连续的「思考过程 + 工具调用」收成一条「过程」 ---------- */
  var grouping = false;
  function groupRuns() {
    if (grouping) return;
    grouping = true;
    try {
      var log = document.getElementById('log');
      if (!log) return;
    if (document.body.classList.contains('dsh-running')) return;   // 只认真实运行态
      var kids = Array.prototype.slice.call(log.children);
      var tail = ' ';
      if (kids.length) tail = kids[kids.length - 1];
      var anchor = log.scrollHeight - log.scrollTop;
      var run = [];
      var changed = false;
      function flush() {
        if (run.length < 2) { run = []; return; }
        var box = document.createElement('details');
        box.className = 'dsh-run';
        var sum = document.createElement('summary');
        var running = run.some(function (el) { return /运行中|执行中|running/i.test(el.textContent || ''); });
        sum.textContent = running ? ('⚙ 过程 · ' + run.length + ' 步（运行中）') : ('已完成，用时 ' + (lastDuration || '?') + ' 秒 · ' + run.length + ' 步');
        box.appendChild(sum);
        var inner = document.createElement('div');
        inner.className = 'dsh-run-body';
        run[0].parentNode.insertBefore(box, run[0]);
        run.forEach(function (el) { inner.appendChild(el); });
        box.appendChild(inner);
        run = [];
        changed = true;
      }
      for (var i = 0; i < kids.length; i += 1) {
        var el = kids[i];
        if (el === tail) { flush(); continue; }   // 尾巴还在长，先不动它（动了就会跳滚动）
        if (el.classList.contains('tool') || el.classList.contains('think')) { run.push(el); }
        else { flush(); }
      }
      flush();
      if (changed) {
        var nearBottom = anchor < 220;
        log.scrollTop = nearBottom ? log.scrollHeight : log.scrollHeight - anchor;
      }
    } finally {
      grouping = false;
    }
  }
  /* ---------- 14. 待发图片条挪到输入卡最上面（column-reverse 下最后一个子元素才在最上） ---------- */
  function liftThumbs() {
    var c = document.getElementById('composer');
    var th = document.getElementById('thumbs');
    if (!c || !th) return;
    if (c.lastElementChild !== th) c.appendChild(th);
  }
  onReady(function () {
    // ① 先把三个悬浮控件建出来（最要紧的，放最前面，且各自 try/catch）
    [buildNewBtn, buildDrawer, buildTitle].forEach(function (fn) {
      try { fn(); } catch (e) { console.warn('[dsh-ui]', fn.name, e); }
    });
    // ② 其余模块，出错也不互相连累
    [bootThink, killSwipe, hideFold, showBuild, bootViewerClose, bootFold, bootStatus, bootRunning, bootKeyboard, panelAware, markRunning, watchNewBack, liftThumbs, tagTables, sessRowMenu, showBalance, hideSpeak].forEach(function (fn) {
      try { fn(); } catch (e) { console.warn('[dsh-ui]', fn.name, e); }
    });
    setTimeout(function () { try { autoFold(); } catch (e) {} }, 300);
    try {
      new MutationObserver(function () {
        [hideFold, hideSpeak, tagTables, sessRowMenu, sessStatus, liftThumbs].forEach(function (fn) { try { fn(); } catch (e) {} }); 
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  });
})();