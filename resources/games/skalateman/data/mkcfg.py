import json,os,sys
d=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,d); sys.path.insert(0,os.path.join(d,'old'))
from text_a import T as A
from text_b import T as B
from text_c import T as C
from text_new import N
OLD={**A,**B,**C}
# generic strings reused from v1 (no game-specific wording)
KEEP=['langName','setupTitle','name','namePh','avatar','playTitle','practice','bots','practiceSub','onlineTitle','createPrivate','createPublic','quickMatch','codeLabel','codePh','join',
 'howTitle','terms','uiLang','lobbyTitle','roomCode','invite','players','addBot','settings','rounds','qlang','start','waitingHost','needTwo','spectators','host','bot','remove','priv','pub','practiceRoom',
 'round','picked','waitOthers','watching','locked','scores','endTitle','winner','tie','rematch','menu','out','left','exitConfirm','exit','mute','react','pts','you_','player','youTag',
 'conn_online','conn_reconnecting','conn_connecting','roomGone','errName','errNet','errBusy','errMissing','errFull','errGeneric','errTooLarge','copied','onlineOff','onlineReady','onlineChecking','onlineDisabled',
 'gmTitle','gmRefresh','gmLoading','gmEmpty','gmCount','gmErr','gmPrivate','gmPublic','gmWaiting','gmPlaying','gmPlayers','gmJoin','gmWatch','hub','skip']
L=['id','en','zh','ja','ko','ms','es','pt','th']
T={l:{**{k:OLD[l][k] for k in KEEP},**N[l]} for l in L}
# client-side language: everyone picks their own (🌐), even mid-game; same round = same topic in each player's language
LN={'id':('Bahasa dipilih masing-masing (🌐), bisa diganti kapan saja, bahkan saat main. Satu room bisa campur bahasa: pertanyaannya sama, tampil di bahasa tiap pemain.','Tiap pemain pilih bahasanya sendiri: main bareng teman luar negeri tanpa batas bahasa'),
'en':('Everyone picks their own language (🌐) and can switch anytime, even mid-game. One room can mix languages: same question, shown in each player\'s language.','Each player picks their own language, so you can play with friends abroad'),
'zh':('每位玩家自选语言（🌐），游戏中也可随时切换。同一房间可混用语言：题目相同，各自以自己的语言显示。','每人自选语言，和外国朋友一起玩毫无语言障碍'),
'ja':('言語は各自で選べます（🌐）。プレイ中でもいつでも切り替えOK。同じルームで言語が混ざっても、お題は同じで各自の言語で表示されます。','言語は各自で選択、海外の友達とも言葉の壁なく遊べる'),
'ko':('언어는 각자 선택해요 (🌐). 게임 중에도 언제든 바꿀 수 있어요. 한 방에서 언어가 달라도 질문은 같고, 각자의 언어로 보여요.','언어는 각자 선택, 외국 친구와도 언어 장벽 없이'),
'ms':('Setiap pemain pilih bahasa sendiri (🌐) dan boleh tukar bila-bila masa, walaupun semasa bermain. Satu bilik boleh campur bahasa: soalan sama, dipaparkan dalam bahasa setiap pemain.','Setiap pemain pilih bahasa sendiri, main dengan kawan luar negara tanpa halangan bahasa'),
'es':('Cada jugador elige su idioma (🌐) y puede cambiarlo cuando quiera, incluso en plena partida. Una sala puede mezclar idiomas: la misma pregunta, en el idioma de cada uno.','Cada jugador elige su idioma: juega con amigos de otros países sin barreras'),
'pt':('Cada jogador escolhe seu idioma (🌐) e pode trocar a qualquer momento, até no meio do jogo. Uma sala pode misturar idiomas: a mesma pergunta, no idioma de cada um.','Cada jogador escolhe seu idioma: jogue com amigos de fora sem barreira de idioma'),
'th':('ผู้เล่นแต่ละคนเลือกภาษาเอง (🌐) และเปลี่ยนได้ตลอด แม้ระหว่างเล่น ห้องเดียวกันใช้หลายภาษาได้: คำถามเดียวกัน แสดงเป็นภาษาของแต่ละคน','แต่ละคนเลือกภาษาเอง เล่นกับเพื่อนต่างชาติได้ไม่มีกำแพงภาษา')}
for l in L:
  T[l]['how']=list(T[l]['how'])+[LN[l][0]]
  f=list(T[l]['facts']); f[-1]=LN[l][1]; T[l]['facts']=f
keys=set(T['id'])
for l in L: assert set(T[l])==keys,(l,keys^set(T[l]))
q=json.load(open(os.path.join(d,'..','src','questions.json'),encoding='utf-8'))
cfg={"site":{"name":"Skala Teman","slug":"skalateman"},
 "langs":L,
 "avatars":["🦊","🐼","🐸","🐯","🐨","🐵","🦄","🐙","🐧","🦁","🐰","🐻","🐱","🐶","🦉","🐢"],
 "botAvatars":["🤖","👾","🎃","👽","🧸","🦖","🐲"],
 "react":["😂","🔥","😱","👏","🤣","❤️","🙈","🤔"],
 "text":{l:T[l] for l in L},"q":q}
json.dump(cfg,open(os.path.join(d,'..','src','config.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(keys),'keys', {l:len(q[l]) for l in L})
