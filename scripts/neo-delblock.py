"""Rimuove il blocco hotkey/drop-hidden da main.rs (righe note, verificate)."""
import pathlib

P = pathlib.Path("src-tauri/src/main.rs")
lines = P.read_text(encoding="utf-8").splitlines(keepends=True)
# 1-based 822..946 compresi, verifica marcatori prima di tagliare
assert lines[821].startswith("/// Scorciatoia universale"), lines[821]
assert lines[945].strip() == "}", lines[945]
assert lines[946].strip() == "", repr(lines[946])
del lines[821:946]
P.write_text("".join(lines), encoding="utf-8")
print("BLOCCO-RIMOSSO")
