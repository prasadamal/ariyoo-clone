"""Is a button above the on-screen keyboard? Reads a uiautomator dump and `dumpsys window` output.

Usage: python3 keyboard_check.py ui.xml window.txt "Button text regex" "label"
Prints PASS/FAIL with the numbers and exits 0 (the summary collects the verdicts).
"""
import re, sys, xml.etree.ElementTree as ET

ui, win, pattern, label = sys.argv[1:5]
rx = re.compile(pattern)
nodes = []
for n in ET.parse(ui).iter('node'):
    text = (n.get('text') or '') + ' ' + (n.get('content-desc') or '')
    if rx.search(text.strip()):
        b = re.findall(r'\d+', n.get('bounds', ''))
        if len(b) == 4:
            nodes.append(tuple(map(int, b)))
dump = open(win, errors='ignore').read()
# Screen size and the keyboard window's frame.
size = re.search(r'(?:mDisplayFrame|DisplayFrames.*?w=|init=)(\d+)x(\d+)', dump)
frames = []
R1 = r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]'           # [l,t][r,b]
R2 = r'Rect\((\d+), (\d+) - (\d+), (\d+)\)'      # Rect(l, t - r, b)
# Android 11+ lists the keyboard as an "ime" insets source; older dumps as the InputMethod window.
for m in re.finditer(r'(?:type=ime|ITYPE_IME|InputMethod)', dump):
    seg = dump[m.start(): m.start() + 600]
    for rx_ in (R1, R2):
        f = re.search(rx_, seg)
        if f:
            frames.append(tuple(map(int, f.groups())))
            break
frames = [f for f in frames if f[3] > f[1] and f[1] > 300 and (f[3] - f[1]) < 2000]
ime_top = min((f[1] for f in frames), default=None)
shown = 'mInputShown=true' in dump or 'isInputMethodShown=true' in dump or bool(frames)
if not nodes:
    print(f'KEYBOARD {label}: FAIL button /{pattern}/ not found on screen'); sys.exit(0)
bottom = max(n[3] for n in nodes)  # the bottom-most match (the sheet's button)
if ime_top is None:
    print(f'KEYBOARD {label}: UNKNOWN keyboard frame not found (shown={shown}); button bottom {bottom}'); sys.exit(0)
verdict = 'PASS' if bottom <= ime_top else 'FAIL'
print(f'KEYBOARD {label}: {verdict} button bottom y={bottom}, keyboard top y={ime_top}')
