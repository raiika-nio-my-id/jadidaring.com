# Strict-dictionary expansion: keeps the bot lists from words.json and widens the accept-only "more" lists
# ID: every KBBI root in kata-dasar.txt + affixed forms seen in id_50k that reduce to a root by regular
#     Indonesian morphology (meN-/peN- nasal rules, ber-/ter-/di-/ke-/se-/per-, -kan/-an/-i, ke-an, per-an...).
#     Particles/possessives (-nya -lah -kah -ku -mu) are not dictionary entries and are not accepted.
# EN: en_lower.txt (~25k common English word forms) + the existing lists.
import re,json
alpha=re.compile(r'^[a-z]{3,24}$')
def ok(w): return bool(alpha.match(w)) and re.search('[aeiouy]',w) and not re.search(r'(.)\1\1',w)
bad=set('bitch bitches tits tit boob boobs boobies horny bastard bastards crap piss pissed dickhead pussy cunt fag faggot whores whore slut sexual sexually naked nude porn penis vagina anal nigger nigga ass dick cock rape fuck fucking fucked shit damn sex sexy bangsat kontol memek ngentot entot goblok tolol bego bajingan brengsek keparat jancok perek lonte pelacur pantat tetek peler pepek titit coli sange bokep'.split())
cur=json.load(open('words.before-strict.json'))  # the original (loose) lists; bot lists are kept as-is
kd=set(w for w in (l.strip().lower() for l in open('kata-dasar.txt')) if ok(w))
def roots_of_men(b, nasal):
  # b = stem after me/pe ; returns candidate roots
  out=[b]
  if b.startswith('ng'): out+=[b[2:], 'k'+b[2:]]
  if b.startswith('ny'): out+=['s'+b[2:], 'c'+b[2:]]
  if b.startswith('m'): out+=[b[1:], 'p'+b[1:]]
  if b.startswith('n'): out+=[b[1:], 't'+b[1:]]
  if b.startswith('nge'): out+=[b[3:]]
  return out
SUF=['', 'kan', 'an', 'i']
def idok(w):
  if w in kd: return True
  for s in SUF:
    if s and not w.endswith(s): continue
    b=w[:len(w)-len(s)] if s else w
    cands=[]
    if s: cands.append(b)
    for p in ['me','pe']:
      if b.startswith(p): cands+=roots_of_men(b[2:],1)
    for p in ['memper','diper','ber','be','ter','te','di','ke','se','per','pel','pem','pen','peng','peny','mem','men','meng','meny','pember','pember','keber','kese','keter','berke','ber','bel']:
      if b.startswith(p): cands.append(b[len(p):])
    for r in cands:
      if len(r)>=3 and r in kd and r!=w: return True
  return False
idf=[l.split()[0].lower() for l in open('id_50k.txt',encoding='utf-8')]
part=re.compile(r'(nya|lah|kah|ku|mu|pun|tah)$')
en_lower=set(l.strip() for l in open('en_lower.txt'))
idbot=cur['id']['bot'].split(); idmore=cur['id']['more'].split()
add=set()
for w in idf:
  if not ok(w) or w in bad: continue
  if w in kd: add.add(w); continue
  if part.search(w): continue
  if idok(w): add.add(w)
idacc=(kd|add|set(idmore))-bad-set(idbot)
# drop old loose-list entries that are particle forms (e.g. "rumahnya") so strict really means dictionary entries
idacc=set(w for w in idacc if w in kd or not part.search(w) or w in kd)
enbot=cur['en']['bot'].split(); enmore=cur['en']['more'].split()
enacc=(set(w for w in en_lower if ok(w))|set(enmore))-bad-set(enbot)
def fc(ws):
  # front coding: each entry = chr(48 + shared prefix length with previous word) + rest (lowercase); decoded in rules.js loadWords
  out=[]; prev=''
  for x in sorted(set(ws)):
    k=0
    while k<min(len(x),len(prev),40) and x[k]==prev[k]: k+=1
    out.append(chr(48+k)+x[k:]); prev=x
  return ''.join(out)
out={'id':{'bot':' '.join(idbot),'fc':fc(idacc)},'en':{'bot':' '.join(enbot),'fc':fc(enacc)}}
js=json.dumps(out,separators=(',',':'))
open('words.json','w').write(js)
print('id bot',len(idbot),'id more',len(idacc),'(affixed from corpus',len(add-kd),') en bot',len(enbot),'en more',len(enacc),'bytes',len(js))
