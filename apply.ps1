# DSH 手机端 UI 补丁 —— 应用脚本
#
# 作用：往 dsh-plugin-mobile-bridge 的 lib/mobile.html 里注入 ui.css / ui.js，
#       并做 4 处源码级改动（blockHtml 块级 markdown + 去掉重复的工具条目）。
#
# 用法（插件升级覆盖 mobile.html 之后，跑一次即可）：
#   pwsh -NoProfile -File "E:\CodexXM\dsh-plugin-mobile-bridge-ui\apply.ps1"
#   然后重启 DSH（Ctrl+Shift+R）或让插件重载
#
# 幂等：重复跑不会叠加；会先把自己上次注入的块清掉再写一份。

$ErrorActionPreference = 'Stop'
$Target = 'E:\CodexXM\dsh-plugin-mobile-bridge\lib\mobile.html'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
# ---------- 0. 注入前自检：ui.js 必须能通过语法检查，否则直接中止（别再往页面里塞坏代码） ----------
$nodeExe = Join-Path $env:APPDATA 'dsh-desktop\harness\.desktop-bin\node.cmd'
if (Test-Path $nodeExe) {
  & $nodeExe --check (Join-Path $Here 'ui.js') 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Error '注入前自检: ui.js 语法错误，已中止（页面保持原样）'
    & $nodeExe --check (Join-Path $Here 'ui.js')
    exit 1
  }
  Write-Output '注入前自检: ui.js OK'
}

$Css = Get-Content (Join-Path $Here 'ui.css') -Raw
$Js = Get-Content (Join-Path $Here 'ui.js') -Raw
$Js = $Js.Replace('__DSH_BUILD__', (Get-Date -Format 'MM-dd HH:mm:ss'))

if (-not (Test-Path $Target)) { throw "找不到 $Target" }

Copy-Item $Target "$Target.bak" -Force
$html = Get-Content $Target -Raw
$notes = @()

# ---------- 1. 清掉上一次注入的内容 ----------
$before = $html.Length
for ($k = 0; $k -lt 10; $k++) {
  $t0 = $html
  $html = [regex]::Replace($html, '(?s)<style id="dsh-ui[^"]*">.*?</style>', '')
  $html = [regex]::Replace($html, '(?s)<script id="dsh-ui[^"]*">.*?</script>', '')
  if ($html -eq $t0) { break }
}
# 历史版本留下的零散块（早期是逐个插的）
$html = [regex]::Replace($html, '(?s)<style id="dsh-fit">.*?</style>', '')
$html = [regex]::Replace($html, '(?s)<script id="dsh-[a-z-]+">.*?</script>', '')
# 早期逐个插入时每插一次就多出一个 </body>
while ($html -match '</body>\s*</body>') { $html = [regex]::Replace($html, '</body>\s*</body>', '</body>') }
if ($html.Length -ne $before) { $notes += "清掉旧注入（$(($before - $html.Length)) 字节）" }

# ---------- 2. 源码级改动 ----------
# 2.1 块级 markdown 渲染器（标题/列表/分隔线/引用）
if ($html -notmatch 'function blockHtml') {
  $blockFn = @'
	/**
	 * 块级 Markdown：标题 / 列表 / 分隔线 / 引用。
	 * 原版把每行 inlineFormat + <br> 拼起来，`## 标题`、`- 项`、`---` 全是字面量。
	 */
	function blockHtml(lines) {
		const out = []
		let para = []
		let i = 0
		const flush = () => {
			if (para.length > 0) { out.push('<p>' + para.map((item) => inlineFormat(item)).join('<br>') + '</p>'); para = [] }
		}
		while (i < lines.length) {
			const t = String(lines[i] ?? '').trim()
			if (t === '') { flush(); i += 1; continue }
			const head = /^(#{1,4})\s+(.*)$/.exec(t)
			if (head !== null) {
				flush()
				const level = Math.min(head[1].length + 2, 5)
				out.push('<h' + level + ' class="mdh">' + inlineFormat(head[2]) + '</h' + level + '>')
				i += 1
				continue
			}
			if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); out.push('<hr>'); i += 1; continue }
			if (/^[-*+]\s+/.test(t)) {
				flush()
				const items = []
				while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
					items.push('<li>' + inlineFormat(String(lines[i]).replace(/^\s*[-*+]\s+/, '')) + '</li>')
					i += 1
				}
				out.push('<ul>' + items.join('') + '</ul>')
				continue
			}
			if (/^\d+[.)]\s+/.test(t)) {
				flush()
				const items = []
				while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
					items.push('<li>' + inlineFormat(String(lines[i]).replace(/^\s*\d+[.)]\s+/, '')) + '</li>')
					i += 1
				}
				out.push('<ol>' + items.join('') + '</ol>')
				continue
			}
			if (/^>\s?/.test(t)) {
				flush()
				const quote = []
				while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
					quote.push(inlineFormat(String(lines[i]).replace(/^\s*>\s?/, '')))
					i += 1
				}
				out.push('<blockquote>' + quote.join('<br>') + '</blockquote>')
				continue
			}
			para.push(lines[i])
			i += 1
		}
		flush()
		return out.join('')
	}

	function richText(raw, fold) {
'@
  $html = $html.Replace("`tfunction richText(raw, fold) {", $blockFn.TrimEnd())
  $notes += '插入 blockHtml'
}

# 2.2 三处调用点切到 blockHtml
$pairs = @(
  @("`t`t`tconst html = chunk.map((item) => inlineFormat(item)).join('<br>')", "`t`t`tconst html = blockHtml(chunk)"),
  @("`t`t`t`tconst head = chunk.slice(0, 8).map((item) => inlineFormat(item)).join('<br>')", "`t`t`t`tconst head = blockHtml(chunk.slice(0, 8))"),
  @("`t`t`t`tconst rest = chunk.slice(8).map((item) => inlineFormat(item)).join('<br>')", "`t`t`t`tconst rest = blockHtml(chunk.slice(8))")
)
foreach ($p in $pairs) {
  if ($html.Contains($p[0])) { $html = $html.Replace($p[0], $p[1]); $notes += '调用点 → blockHtml' }
}

# 2.3 思考块：裸 div 包进 <details>
$bare = "else if (block.type === 'reasoning') html += '<div class=""think-body"">' + escapeHtml(block.text) + '</div>'"
$wrapped = "else if (block.type === 'reasoning') html += '<details class=""think""><summary>💭 思考过程</summary><div class=""think-body"">' + escapeHtml(block.text) + '</div></details>'"
if ($html.Contains($bare)) { $html = $html.Replace($bare, $wrapped); $notes += '思考块包 details' }

# 2.4 去掉重复的工具条目 + 空结果条目
$dup = "else if (block.type === 'tool-call') html += '<div class=""note"">调用 ' + escapeHtml(block.name) + '</div>'"
if ($html.Contains($dup)) { $html = $html.Replace($dup, "else if (block.type === 'tool-call') { /* 工具卡片已经有一条 */ }"); $notes += '去掉重复「调用 X」' }
$empty = "state.items.push({ kind: 'note', text: '工具结果：' + (body.slice(0, 200) || (attachments.length > 0 ? '' : '（空）')), attachments })"
$noempty = "if (body.slice(0, 200) !== '' || attachments.length > 0) state.items.push({ kind: 'note', text: '工具结果：' + body.slice(0, 200), attachments })"
if ($html.Contains($empty)) { $html = $html.Replace($empty, $noempty); $notes += '空工具结果不再插条目' }

# ---------- 3. 注入 CSS + JS ----------
# ⚠️ 不能插在最后一个 </body> 之前：那个 </body> 很可能在页面自己的 <script> 字符串模板里
# （导出/安装页的 HTML 拼串），插进去就永远不执行 —— 直接追加到文件末尾最稳。
$inject = "`n<style id=""dsh-ui"">`n$Css`n</style>`n<script id=""dsh-ui"">`n$Js`n</script>`n"
$html = $html.TrimEnd() + $inject

Set-Content -Path $Target -Value $html -Encoding UTF8 -NoNewline

# ---------- 4. 触发插件重载（改一下 loader 里的一个无害字段） ----------
$patchFile = Join-Path $env:APPDATA 'dsh-desktop\harness\profiles\web\cordis.patch.yml'
if (Test-Path $patchFile) {
  $t = Get-Content $patchFile -Raw
  if ($t -match 'elevationMinutes: (\d+)') {
    $n = [int]$Matches[1] + 1
    $t = [regex]::Replace($t, 'elevationMinutes: \d+', "elevationMinutes: $n")
    Set-Content $patchFile -Value $t -Encoding UTF8
    $notes += "已触发插件重载（elevationMinutes=$n）"
  }
}

Write-Output '--- apply.ps1 ---'
if ($notes.Count -eq 0) { Write-Output '没有需要改的地方（可能已经是打过补丁的版本）' }
else { $notes | ForEach-Object { Write-Output "  · $_" } }
Write-Output "目标文件: $Target"
Write-Output "备份: $Target.bak"
Write-Output '完成。手机上重开 App（或点右上「刷新」）即可看到效果。'
# ---------- 5. 语法自检：ui.js 只要有一个字符错，整块 <script> 会被浏览器丢弃（今天就是这么翻车的） ----------
$nodeExe = Join-Path $env:APPDATA 'dsh-desktop\harness\.desktop-bin\node.cmd'
if (Test-Path $nodeExe) {
  & $nodeExe --check (Join-Path $Here 'ui.js') 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'ui.js 有语法错误！页面会整块跳过它（☰/＋/标题都不会出现）。先修再重跑。'
    & $nodeExe --check (Join-Path $Here 'ui.js')
  } else {
    Write-Output '语法自检: ui.js OK'
  }
}