import re,json
alpha=re.compile(r'^[a-z]{3,12}$')
V=set('aeiouy')
def ok(w): return alpha.match(w) and any(c in V for c in w) and not re.search(r'(.)\1\1',w)
kd=set(l.strip().lower() for l in open('kata-dasar.txt'))
idf=[l.split()[0] for l in open('id_50k.txt',encoding='utf-8')]
enf=[l.split()[0] for l in open('en_50k.txt',encoding='utf-8')]
walpha=set(l.strip() for l in open('en_lower.txt'))
g10=[l.strip() for l in open('google-10000-english-no-swears.txt')]
en_common=set(g10)|set(enf[:20000])
bad=set('bitch bitches tits tit boob boobs boobies horny bastard bastards crap piss pissed dickhead pussy cunt fag faggot whores sexual sexually naked nude don didn isn wasn couldn wouldn shouldn haven aren ain hasn weren doesn bangsat kontol memek ngentot goblok tolol bego bajingan brengsek keparat jancok perek lonte pelacur fuck shit damn bitch sex sexy porn penis vagina anal nigger nigga ass dick cock slut whore rape gay kill dead die suicide drug drugs nazi'.split())
# Indonesian: frequency order, must be root or simple affixed root, exclude english-common words that are not roots
pre=['meng','meny','mem','men','me','ber','be','ter','di','pe','pem','pen','peng','ke','se']
suf=['kan','an','nya','lah','i']
def idok(w):
  if w in kd: return 'r'
  for s in ['']+suf:
    if s and not w.endswith(s): continue
    b=w[:len(w)-len(s)] if s else w
    for p in ['']+pre:
      if p and not b.startswith(p): continue
      r=b[len(p):]
      if len(r)>=3 and r in kd and (p or s): return 'd'
  return None
idbad=bad|set('the and you that this what for with have not are was but your can all just know get yes okay come look well here there want they was will right like how out now one see think going good tell time why who back who oh mr ok'.split())
idroot=[];idall=[];seen=set()
for w in idf:
  w=w.lower()
  if w in seen or not ok(w) or w in idbad: continue
  seen.add(w)
  k=idok(w)
  if not k: continue
  if w in en_common and k=='d': continue
  if w in en_common and w not in kd: continue
  idall.append(w)
  if k=='r': idroot.append(w)
# add remaining kata dasar common-ish? keep frequency only
enall=[];seen=set()
for w in enf[:30000]+g10:
  w=w.lower()
  if w in seen or not ok(w) or w in bad or w not in walpha: continue
  seen.add(w);enall.append(w)
# filter english: remove id-only? no.
ID_BOT=idroot[:3500]; b=set(ID_BOT); ID_ALL=ID_BOT+[w for w in idall[:7000] if w not in b]
EN_BOT=enall[:3500]; EN_ALL=enall[:6500]
print(len(idroot),len(idall),len(enall),len(ID_ALL),len(EN_ALL))
print(ID_BOT[:80]);print(ID_BOT[3400:3500]);print(EN_BOT[:60]);print(EN_BOT[3400:3500])
ix=[w for w in ID_ALL if w not in set(ID_BOT)]; ex=EN_ALL[3500:]
js='{"id":{"bot":"%s","more":"%s"},"en":{"bot":"%s","more":"%s"}}'%(' '.join(ID_BOT),' '.join(ix),' '.join(EN_BOT),' '.join(ex))
open('words.json','w').write(js); print(len(js), len(ID_BOT),len(ix),len(EN_BOT),len(ex))
