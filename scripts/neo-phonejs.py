"""Estrae lo <script> di PHONE_PAGE da main.rs e lo valida con node --check."""
import pathlib, re, subprocess

src = pathlib.Path("src-tauri/src/main.rs").read_text(encoding="utf-8")
m = re.search(r"const PHONE_PAGE: &str = r#\"(.*?)\"#;", src, re.S)
assert m, "PHONE_PAGE non trovata"
html = m.group(1)
print("HTML:", len(html), "caratteri")
js = re.search(r"<script>(.*)</script>", html, re.S).group(1)
pathlib.Path("site-lab/_phone.js").write_text(js, encoding="utf-8")
r = subprocess.run(["node", "--check", "site-lab/_phone.js"],
                   capture_output=True, text=True)
print("node --check exit:", r.returncode)
print(r.stderr.strip() or "JS-OK")
assert '"#' not in html.replace('r#"', ''), "sospetto terminatore raw-string"
print("RAW-OK")
