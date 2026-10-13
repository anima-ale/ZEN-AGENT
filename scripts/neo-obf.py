"""Roundtrip offuscamento (stesso algoritmo di main.rs)."""
KEY = b"ZEN-LAB-obili-7-nebula-titan"
d = '{"t":123,"r":"ciao mamma \\u00e8"}'.encode("utf-8")
e = "".join("%02x" % (b ^ KEY[i % len(KEY)]) for i, b in enumerate(d))
raw = bytes(int(e[i:i + 2], 16) for i in range(0, len(e), 2))
o = bytes(b ^ KEY[i % len(KEY)] for i, b in enumerate(raw))
print("ROTONDO:", o == d)
print(e[:60])
