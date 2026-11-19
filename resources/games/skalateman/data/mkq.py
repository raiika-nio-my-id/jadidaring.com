import json,sys,os
sys.path.insert(0,os.path.dirname(__file__))
from q_scale import CORE, EXTRA, L
from named import named
for row in CORE: assert len(row)==9, row
out={l:[row[i] for row in CORE] for i,l in enumerate(L)}
for id_,en,zh in EXTRA: out['id'].append(id_); out['en'].append(en); out['zh'].append(zh)
out={l:[named(l,x) for x in out[l]] for l in L}
for l in L: assert len(set(out[l]))==len(out[l]), l
json.dump(out,open(os.path.join(os.path.dirname(__file__),'..','src','questions.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=0)
print({l:len(out[l]) for l in L})
