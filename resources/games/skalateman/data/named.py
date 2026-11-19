# Convert 2nd-person prompts into 3rd-person prompts about {name} (the hot seat).
import re
def _id(s):
    s=s.replace('kamarmu','kamar {name}').replace('ketawamu','ketawa {name}').replace('HP-mu','HP {name}')
    return re.sub(r'\bkamu\b','{name}',s)
def _ms(s): return re.sub(r'\bkamu\b','{name}',s)
def _en(s):
    s=s.replace('How often are you late','How often is {name} late')
    s=re.sub(r'\b(How [a-z]+) is your\b',r"\1 is {name}'s",s)
    s=re.sub(r'\bdo you\b','does {name}',s)
    s=re.sub(r'\bare you\b','is {name}',s)
    s=s.replace('your ','their ') if '{name}' in s else s.replace('your ',"{name}'s ")
    return s
def _zh(s): return s.replace('你','{name}',1).replace('你','TA')
JA={'今、部屋はどれくらい散らかってる？':'今、{name}の部屋はどれくらい散らかってる？','方向感覚はどれくらいいい？':'{name}の方向感覚はどれくらいいい？','笑い声はどれくらい大きい？':'{name}の笑い声はどれくらい大きい？',
    'スマホの写真フォルダはどれくらい整理されてる？':'{name}のスマホの写真フォルダはどれくらい整理されてる？','クローゼットはどれくらい片付いてる？':'{name}のクローゼットはどれくらい片付いてる？'}
def _ja(s):
    if s in JA: return JA[s]
    m=re.match(r'^(.+?)は(どれくらい(好き|得意)？)$',s)
    if m: return '{name}は'+m.group(1)+'が'+m.group(2)
    return '{name}は、'+s
def _ko(s):
    if '네 방' in s: return s.replace('네 방','{name}의 방')
    if s.startswith('네 '): return '{name}의 '+s[2:]
    return '{name}은(는) '+s
ES=[(r'¿Cuánto te gusta ',r'¿Cuánto le gusta a {name} '),(r'¿Cuánto te gustan ',r'¿Cuánto le gustan a {name} '),(r'¿Cuánto disfrutas ',r'¿Cuánto disfruta {name} '),
    (r' eres\b',r' es {name}'),(r'tu cuarto ahora mismo',r'el cuarto de {name} ahora mismo'),(r'es tu sentido de la orientación',r'es el sentido de la orientación de {name}'),
    (r'es tu risa',r'es la risa de {name}'),(r'frecuencia miras',r'frecuencia mira {name}'),(r'frecuencia llegas',r'frecuencia llega {name}'),(r'fácil lloras',r'fácil llora {name}'),
    (r'frecuencia picas',r'frecuencia pica {name}'),(r'cosquillas tienes',r'cosquillas tiene {name}'),(r'hacerte',r'hacerse'),(r'cuando juegas',r'cuando juega'),
    (r'¿Cuánto te gustaría ',r'¿Cuánto le gustaría a {name} '),(r'miedo te dan ',r'miedo le dan a {name} '),(r'¿Cuánto necesitas ',r'¿Cuánto necesita {name} '),
    (r'de tu móvil',r'del móvil de {name}'),(r'tu armario',r'el armario de {name}'),(r'fácil te ríes',r'fácil se ríe {name}'),
    (r'frecuencia te duermes',r'frecuencia se duerme {name}'),(r'frecuencia te desahogas',r'frecuencia se desahoga {name}')]
def _es(s):
    for a,b in ES: s=re.sub(a,b,s)
    # generic 2nd -> 3rd person after 'frecuencia' (comes -> come {name}, pides -> pide {name}); only if nothing matched yet
    if '{name}' not in s: s=re.sub(r'frecuencia (\w+)s ',r'frecuencia \1 {name} ',s)
    return s
PT=[('do seu celular','do celular de {name}'),('seu guarda-roupa','o guarda-roupa de {name}'),('seu quarto','o quarto de {name}'),('é seu senso de direção','é o senso de direção de {name}'),('é sua risada','é a risada de {name}')]
def _pt(s):
    for a,b in PT: s=s.replace(a,b)
    return s.replace('você','{name}')
def _th(s): return s.replace('คุณ',' {name} ').replace('  ',' ').strip()
F={'id':_id,'en':_en,'zh':_zh,'ja':_ja,'ko':_ko,'ms':_ms,'es':_es,'pt':_pt,'th':_th}
def named(lang,s):
    out=F[lang](s)
    assert '{name}' in out,(lang,s,out)
    return out
