"""Repair double-encoded text in assets/js/data.js.

Two layers stacked up:
  1. Kay's own Shopify data already stores `&nbsp;` (UTF-8 C2 A0) mis-decoded as
     Latin-1, i.e. the two characters 'Â' + NBSP. That is upstream, on their store.
  2. My extractor called json.load(open('prods.json')) with no encoding. On Windows
     open() defaults to cp1252, so every non-ASCII byte was mis-decoded a second
     time, turning 'Â'+NBSP into 'Ã' '‚' 'Â' NBSP.

Reversing is just: encode back to cp1252, decode as utf-8, repeat until stable.
Strings holding genuinely non-cp1252 characters (₹, em dash) raise on encode and
are returned untouched, so the pass is safe to run over everything.
"""
import io, json, re, sys, os

os.chdir(r'd:/Harish/ksi/kay-redesign')
PATH = 'assets/js/data.js'

MOJI = re.compile(r'[ÃÂ][\u0080-\u00bf\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u20ac\u0161\u0153]')


def unmojibake(s):
    cur = s
    for _ in range(4):
        try:
            cand = cur.encode('cp1252').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            break
        if cand == cur:
            break
        cur = cand
    # The round-trip stalls where 'Â' is followed by a byte that is not a valid
    # UTF-8 continuation (a space, ':' or end of string). Every survivor is a
    # leftover from '&nbsp;' — verified none precede a letter — so drop them.
    cur = re.sub('Â(?=[\\s:;,.]|$)', '', cur)
    return cur


def tidy(s):
    s = s.replace('\u00a0', ' ')          # nbsp -> plain space
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\s+([:;,.])', r'\1', s)  # " :" -> ":"
    s = re.sub(r'([.:])(?=[A-Z])', r'\1 ', s)  # "work.Neck:" -> "work. Neck:"
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


src = io.open(PATH, encoding='utf8').read()
head = src[:src.index('[')]
data = json.loads(src[src.index('['):src.rindex(';')])

changed, samples = 0, []
for p in data:
    for k, v in list(p.items()):
        if not isinstance(v, str):
            continue
        fixed = unmojibake(v)
        if k == 'desc':
            fixed = tidy(fixed)
        if fixed != v:
            changed += 1
            if len(samples) < 4 and k == 'desc':
                samples.append((p['handle'], v[:90], fixed[:90]))
            p[k] = fixed

print('fields repaired:', changed)
for h, before, after in samples:
    print('\n ', h)
    print('   before:', repr(before))
    print('   after :', repr(after))

# residual check
left = [(p['handle'], k) for p in data for k, v in p.items()
        if isinstance(v, str) and MOJI.search(v)]
print('\nresidual mojibake fields:', len(left), left[:5])

if '--write' in sys.argv:
    with io.open(PATH, 'w', encoding='utf8') as f:
        f.write(head)
        json.dump(data, f, ensure_ascii=False, indent=0)
        f.write(';\n')
    print('\ndata.js rewritten')
