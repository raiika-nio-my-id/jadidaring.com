# Skala Teman UI copy (new 1-10 loop). Merged over the reused generic strings in old/text_*.py by mkcfg.py.
N = {}
N['id'] = dict(
 title='Skala Teman', tagline='Tebak skala 1–10 temanmu · 2–8 pemain', heroKicker='Party game santai · 2–8 pemain · 9 bahasa',
 heroTitle='Seberapa kenal kamu sama temanmu?', heroSub='Tiap ronde satu orang duduk di kursi panas dan jujur kasih nilai 1–10: “Seberapa suka JadiDaring nonton film?”. Yang lain menebak angkanya. Tebakan paling dekat menang, lalu ngobrol dan ketawa dulu sebelum lanjut!',
 facts=['2–8 pemain, online atau latihan lawan bot', 'Kursi panas bergiliran, semua kebagian ditebak', 'Indonesia, English, 中文 + 6 bahasa lain'],
 how=['Buat room dan bagikan link undangan (minimal 2 pemain, maksimal 8).', 'Tiap ronde ada satu pemain di kursi panas, bergiliran. Dia diam-diam menjawab pertanyaan dengan angka 1–10 (1 = nggak sama sekali, 10 = banget).', 'Pemain lain menebak: “Kira-kira berapa angkanya?” lalu pilih 1–10 sebelum waktu habis.', 'Hasil dibuka: angka asli, semua tebakan, dan siapa yang paling dekat. Layar berhenti di sini, silakan ngobrol, protes, atau ketawa dulu.', 'Kalau sudah puas, host klik Lanjut. Kursi panas pindah ke orang berikutnya dengan pertanyaan baru.'],
 scoreTitle='Poin', scoreRules=['Tepat: +100 · selisih 1: +60 · selisih 2: +30 · selisih 3: +10', 'Tebakan paling dekat (boleh seri): bonus +50', 'Kursi panas: +40 kalau ada yang menebak dengan selisih maksimal 1', 'Tujuannya kenalan sambil bercanda, poin cuma bumbu!'],
 footerNote='Game santai buat kenalan lebih dekat dengan teman, keluarga dan pasangan.', timer='Waktu jawab', setNote='Kursi panas bergiliran tiap ronde. Setelah hasil dibuka, host klik Lanjut.',
 hotSeat='Kursi panas', hotYou='Giliranmu! Jawab jujur 1–10, yang lain bakal nebak.', hotAsk='Tebak angka jujur {name}!', hotWait='{name} lagi jawab…', allIn='Semua sudah menjawab!',
 scaleLo='nggak sama sekali', scaleHi='banget!', revealAns='Jawaban jujur {name}:', voidHot='{name} nggak sempat jawab, ronde ini dilewati.', noGuess='Nggak ada yang menebak.', closest='Paling dekat', exact='Tepat!', off='selisih {d}', noPick='Tidak menjawab', hotBonus='bonus kursi panas', yourGuess='Tebakanmu: {v}',
 nextBtn='Lanjut ➜ giliran {name}', endBtn='Lihat hasil akhir ➜', endEarly='Akhiri game', waitNext='Ngobrol dulu! Host akan klik Lanjut kalau sudah siap.', hostHint='Kamu host: klik Lanjut kalau obrolannya sudah selesai.', talkTip='Kenapa segitu? Ceritain dong 😄', nextUp='Berikutnya: {name}',
 recapTitle='Kenalan lebih dekat', closeTitle='Paling kenal teman', closeLine='{name} · {n}× nyaris tepat', noClose='Belum ada yang nyaris tepat.', endConfirm='Akhiri game sekarang dan lihat hasil?',
)
N['en'] = dict(
 title='Friend Scale', tagline="Guess your friends' 1–10 · 2–8 players", heroKicker='Chill party game · 2–8 players · 9 languages',
 heroTitle='How well do you really know your friends?', heroSub='Each round one person takes the hot seat and honestly rates a question from 1 to 10: “How much does JadiDaring like watching movies?”. Everyone else guesses the number. Closest guess wins, then chat and laugh about it before moving on!',
 facts=['2–8 players, online or practice vs bots', 'The hot seat rotates, so everyone gets guessed', 'Indonesian, English, 中文 + 6 more languages'],
 how=['Create a room and share the invite link (at least 2 players, up to 8).', 'Each round one player is in the hot seat, taking turns. They secretly answer the question with a number from 1 to 10 (1 = not at all, 10 = totally).', 'Everyone else guesses: “What number did they pick?” and taps 1–10 before time runs out.', 'The reveal shows the real number, every guess and who was closest. It stays on screen, so talk, protest and laugh as long as you like.', 'When you are ready, the host presses Next. The hot seat moves to the next person with a new question.'],
 scoreTitle='Points', scoreRules=['Exact: +100 · off by 1: +60 · off by 2: +30 · off by 3: +10', 'Closest guess (ties share): +50 bonus', 'Hot seat: +40 if anyone guesses within 1', 'The goal is getting to know each other; points are just the seasoning!'],
 footerNote='A chill party game for getting to know friends, family and partners better.', timer='Answer time', setNote='The hot seat rotates every round. After the reveal, the host presses Next.',
 hotSeat='Hot seat', hotYou="Your turn! Answer 1–10 honestly, the others will guess.", hotAsk="Guess {name}'s honest number!", hotWait='{name} is answering…', allIn='Everyone has answered!',
 scaleLo='not at all', scaleHi='totally!', revealAns="{name}'s honest answer:", voidHot="{name} didn't answer in time, this round is skipped.", noGuess='Nobody guessed.', closest='Closest', exact='Exact!', off='off by {d}', noPick='No answer', hotBonus='hot seat bonus', yourGuess='Your guess: {v}',
 nextBtn="Next ➜ {name}'s turn", endBtn='See final results ➜', endEarly='End game', waitNext='Chat away! The host will press Next when everyone is ready.', hostHint="You're the host: press Next when the chat is done.", talkTip='Why that number? Tell us 😄', nextUp='Up next: {name}',
 recapTitle='Getting to know you', closeTitle='Knows friends best', closeLine='{name} · {n}× almost spot on', noClose='Nobody was close yet.', endConfirm='End the game now and see the results?',
)
N['zh'] = dict(
 title='默契量表', tagline='猜朋友的1–10分 · 2–8人', heroKicker='轻松派对游戏 · 2–8人 · 9种语言',
 heroTitle='你真的了解你的朋友吗？', heroSub='每回合一人坐上“热座”，诚实地给问题打1–10分：“JadiDaring有多喜欢看电影？”。其他人猜这个分数，最接近的人获胜。先聊聊、笑一笑，再进入下一题！',
 facts=['2–8人，在线或与机器人练习', '热座轮流坐，每个人都会被猜', '印尼语、英语、中文 + 另外6种语言'],
 how=['创建房间并分享邀请链接（至少2人，最多8人）。', '每回合有一位玩家轮流坐热座，悄悄用1–10分回答问题（1 = 完全不，10 = 超级）。', '其他人来猜：“TA打了几分？”在时间结束前选1–10。', '揭晓真实分数、所有人的猜测和谁最接近。画面会停在这里，尽情聊天、吐槽、大笑。', '大家聊够了，由房主点“下一题”。热座换到下一位，换一道新问题。'],
 scoreTitle='计分', scoreRules=['猜中：+100 · 差1：+60 · 差2：+30 · 差3：+10', '最接近的猜测（并列共享）：额外+50', '热座：有人猜得差距不超过1时+40', '目的是互相了解、开心玩，分数只是调味！'],
 footerNote='和朋友、家人、伴侣增进了解的轻松派对游戏。', timer='作答时间', setNote='热座每回合轮换。揭晓后由房主点“下一题”。',
 hotSeat='热座', hotYou='轮到你了！诚实打1–10分，其他人会来猜。', hotAsk='猜猜{name}的真实分数！', hotWait='{name}正在作答…', allIn='大家都答完了！',
 scaleLo='完全不', scaleHi='超级！', revealAns='{name}的真实答案：', voidHot='{name}没来得及作答，本回合跳过。', noGuess='没有人猜。', closest='最接近', exact='猜中！', off='差{d}', noPick='未作答', hotBonus='热座奖励', yourGuess='你的猜测：{v}',
 nextBtn='下一题 ➜ 轮到{name}', endBtn='查看最终结果 ➜', endEarly='结束游戏', waitNext='先聊聊吧！房主准备好后会点“下一题”。', hostHint='你是房主：聊完了就点“下一题”。', talkTip='为什么是这个分数？说说看 😄', nextUp='下一位：{name}',
 recapTitle='更了解彼此', closeTitle='最懂朋友', closeLine='{name} · {n}次几乎猜中', noClose='还没有人猜得很接近。', endConfirm='现在结束游戏并查看结果？',
)
N['ja'] = dict(
 title='フレンドスケール', tagline='友だちの1〜10を当てよう · 2〜8人', heroKicker='ゆるいパーティーゲーム · 2〜8人 · 9言語',
 heroTitle='友だちのこと、本当にわかってる？', heroSub='毎ラウンド1人が「ホットシート」に座り、お題に1〜10で正直に答えます：「JadiDaringは映画を観るのがどれくらい好き？」。ほかのみんなはその数字を予想。いちばん近い人の勝ち！ワイワイ話してから次へ。',
 facts=['2〜8人、オンラインでもボット練習でも', 'ホットシートは順番に回るので全員が当てられる側に', 'インドネシア語・英語・中国語 + ほか6言語'],
 how=['ルームを作って招待リンクを共有（2人以上、最大8人）。', '毎ラウンド1人が順番にホットシートへ。お題に1〜10でこっそり答えます（1 = まったく、10 = 超）。', 'ほかの人は「何点だと思う？」と予想して、時間内に1〜10をタップ。', '本当の数字、全員の予想、いちばん近かった人を発表。画面はそのまま止まるので、好きなだけ話して笑おう。', 'みんなの準備ができたらホストが「次へ」を押します。ホットシートは次の人へ、新しいお題で。'],
 scoreTitle='ポイント', scoreRules=['ぴったり：+100 · 1差：+60 · 2差：+30 · 3差：+10', 'いちばん近い予想（同点は全員）：+50ボーナス', 'ホットシート：誰かが1差以内なら+40', '目的はお互いを知ること。ポイントはおまけ！'],
 footerNote='友だち・家族・パートナーともっと仲良くなれるゆるいパーティーゲーム。', timer='回答時間', setNote='ホットシートは毎ラウンド交代。発表のあと、ホストが「次へ」を押します。',
 hotSeat='ホットシート', hotYou='あなたの番！1〜10で正直に答えてね。みんなが予想するよ。', hotAsk='{name}の本音の数字を当てよう！', hotWait='{name}が回答中…', allIn='全員回答しました！',
 scaleLo='まったく', scaleHi='超！', revealAns='{name}の本音：', voidHot='{name}が時間内に答えなかったので、このラウンドはスキップ。', noGuess='誰も予想しませんでした。', closest='いちばん近い', exact='ぴったり！', off='{d}差', noPick='未回答', hotBonus='ホットシートボーナス', yourGuess='あなたの予想：{v}',
 nextBtn='次へ ➜ {name}の番', endBtn='最終結果を見る ➜', endEarly='ゲーム終了', waitNext='まずはおしゃべり！準備ができたらホストが「次へ」を押します。', hostHint='あなたはホスト：話が終わったら「次へ」を押してね。', talkTip='なんでその数字？教えて 😄', nextUp='次：{name}',
 recapTitle='もっと知り合おう', closeTitle='いちばんの理解者', closeLine='{name} · ほぼ正解 {n}回', noClose='まだ近い予想はありません。', endConfirm='今ゲームを終了して結果を見ますか？',
)
N['ko'] = dict(
 title='친구 스케일', tagline='친구의 1~10점 맞히기 · 2~8명', heroKicker='편안한 파티 게임 · 2~8명 · 9개 언어',
 heroTitle='친구를 얼마나 잘 알고 있어?', heroSub='매 라운드 한 명이 핫시트에 앉아 질문에 1~10점으로 솔직하게 답해요: “JadiDaring은(는) 영화 보는 거 얼마나 좋아해?”. 나머지는 그 숫자를 맞혀요. 가장 가까운 사람이 승리! 수다 떨고 웃은 다음 넘어가요.',
 facts=['2~8명, 온라인 또는 봇과 연습', '핫시트가 돌아가서 모두가 한 번씩 맞혀져요', '인도네시아어, 영어, 중국어 + 6개 언어'],
 how=['방을 만들고 초대 링크를 공유해요 (최소 2명, 최대 8명).', '매 라운드 한 명이 돌아가며 핫시트에 앉아요. 질문에 1~10으로 몰래 답해요 (1 = 전혀, 10 = 완전).', '다른 사람들은 “몇 점일까?” 추측해서 시간 안에 1~10을 눌러요.', '진짜 점수, 모든 추측, 가장 가까운 사람이 공개돼요. 화면이 그대로 멈추니까 마음껏 이야기하고 웃어요.', '준비되면 방장이 다음을 눌러요. 핫시트는 다음 사람에게, 새 질문과 함께.'],
 scoreTitle='점수', scoreRules=['정확: +100 · 1 차이: +60 · 2 차이: +30 · 3 차이: +10', '가장 가까운 추측 (동점은 모두): 보너스 +50', '핫시트: 누군가 1 차이 이내로 맞히면 +40', '목표는 서로 알아가기, 점수는 양념일 뿐!'],
 footerNote='친구, 가족, 연인과 더 가까워지는 편안한 파티 게임.', timer='답변 시간', setNote='핫시트는 매 라운드 바뀌어요. 공개 후 방장이 다음을 눌러요.',
 hotSeat='핫시트', hotYou='네 차례! 1~10으로 솔직하게 답해줘. 다른 사람들이 맞힐 거야.', hotAsk='{name}의 솔직한 점수를 맞혀봐!', hotWait='{name}이(가) 답하는 중…', allIn='모두 답했어요!',
 scaleLo='전혀', scaleHi='완전!', revealAns='{name}의 솔직한 답:', voidHot='{name}이(가) 시간 안에 답하지 않아 이번 라운드는 넘어가요.', noGuess='아무도 추측하지 않았어요.', closest='가장 가까움', exact='정확!', off='{d} 차이', noPick='답 없음', hotBonus='핫시트 보너스', yourGuess='내 추측: {v}',
 nextBtn='다음 ➜ {name} 차례', endBtn='최종 결과 보기 ➜', endEarly='게임 끝내기', waitNext='수다 타임! 준비되면 방장이 다음을 눌러요.', hostHint='당신은 방장: 이야기가 끝나면 다음을 눌러요.', talkTip='왜 그 점수야? 얘기해줘 😄', nextUp='다음: {name}',
 recapTitle='서로 더 알아가기', closeTitle='친구를 가장 잘 아는 사람', closeLine='{name} · 거의 정답 {n}번', noClose='아직 가까운 추측이 없어요.', endConfirm='지금 게임을 끝내고 결과를 볼까요?',
)
N['ms'] = dict(
 title='Skala Kawan', tagline='Teka skala 1–10 kawan · 2–8 pemain', heroKicker='Permainan parti santai · 2–8 pemain · 9 bahasa',
 heroTitle='Sejauh mana kamu kenal kawan-kawanmu?', heroSub='Setiap pusingan seorang duduk di kerusi panas dan jujur beri nilai 1–10: “Sejauh mana JadiDaring suka menonton filem?”. Yang lain teka nombornya. Tekaan paling hampir menang, kemudian berbual dan ketawa dulu sebelum teruskan!',
 facts=['2–8 pemain, dalam talian atau latihan dengan bot', 'Kerusi panas bergilir, semua orang dapat giliran diteka', 'Bahasa Indonesia, English, 中文 + 6 bahasa lain'],
 how=['Cipta bilik dan kongsi pautan jemputan (sekurang-kurangnya 2 pemain, maksimum 8).', 'Setiap pusingan seorang pemain duduk di kerusi panas secara bergilir. Dia diam-diam menjawab dengan nombor 1–10 (1 = langsung tidak, 10 = sangat).', 'Pemain lain meneka: “Agaknya berapa?” lalu pilih 1–10 sebelum masa tamat.', 'Keputusan didedahkan: nombor sebenar, semua tekaan dan siapa paling hampir. Skrin kekal di situ, berbual dan ketawalah sepuas-puasnya.', 'Bila sudah sedia, hos tekan Seterusnya. Kerusi panas beralih kepada orang seterusnya dengan soalan baharu.'],
 scoreTitle='Mata', scoreRules=['Tepat: +100 · beza 1: +60 · beza 2: +30 · beza 3: +10', 'Tekaan paling hampir (seri dikongsi): bonus +50', 'Kerusi panas: +40 jika ada yang teka dengan beza maksimum 1', 'Matlamatnya berkenalan sambil bergurau, mata cuma perisa!'],
 footerNote='Permainan santai untuk lebih mengenali kawan, keluarga dan pasangan.', timer='Masa menjawab', setNote='Kerusi panas bertukar setiap pusingan. Selepas keputusan, hos tekan Seterusnya.',
 hotSeat='Kerusi panas', hotYou='Giliran kamu! Jawab jujur 1–10, yang lain akan meneka.', hotAsk='Teka nombor jujur {name}!', hotWait='{name} sedang menjawab…', allIn='Semua sudah menjawab!',
 scaleLo='langsung tidak', scaleHi='sangat!', revealAns='Jawapan jujur {name}:', voidHot='{name} tidak sempat menjawab, pusingan ini dilangkau.', noGuess='Tiada siapa meneka.', closest='Paling hampir', exact='Tepat!', off='beza {d}', noPick='Tidak menjawab', hotBonus='bonus kerusi panas', yourGuess='Tekaan kamu: {v}',
 nextBtn='Seterusnya ➜ giliran {name}', endBtn='Lihat keputusan akhir ➜', endEarly='Tamatkan permainan', waitNext='Berbual dulu! Hos akan tekan Seterusnya bila semua sedia.', hostHint='Kamu hos: tekan Seterusnya bila sembang sudah selesai.', talkTip='Kenapa nombor itu? Ceritalah 😄', nextUp='Seterusnya: {name}',
 recapTitle='Lebih mengenali', closeTitle='Paling kenal kawan', closeLine='{name} · {n}× hampir tepat', noClose='Belum ada yang hampir tepat.', endConfirm='Tamatkan permainan sekarang dan lihat keputusan?',
)
N['es'] = dict(
 title='Escala de Amigos', tagline='Adivina el 1–10 de tus amigos · 2–8 jugadores', heroKicker='Juego de fiesta relajado · 2–8 jugadores · 9 idiomas',
 heroTitle='¿Qué tan bien conoces a tus amigos?', heroSub='En cada ronda alguien se sienta en la silla caliente y puntúa con sinceridad del 1 al 10: “¿Cuánto le gusta a JadiDaring ver películas?”. Los demás adivinan el número. Gana quien más se acerque, ¡y luego a charlar y reír antes de seguir!',
 facts=['2–8 jugadores, online o práctica contra bots', 'La silla caliente rota: a todos les toca ser adivinados', 'Indonesio, inglés, chino + 6 idiomas más'],
 how=['Crea una sala y comparte el enlace de invitación (mínimo 2 jugadores, máximo 8).', 'En cada ronda un jugador ocupa la silla caliente, por turnos. Responde en secreto con un número del 1 al 10 (1 = nada, 10 = muchísimo).', 'Los demás adivinan: “¿Qué número habrá puesto?” y tocan 1–10 antes de que acabe el tiempo.', 'Se revela el número real, todas las apuestas y quién se acercó más. La pantalla se queda ahí: charlad, protestad y reíd lo que queráis.', 'Cuando estéis listos, el anfitrión pulsa Siguiente. La silla caliente pasa a la siguiente persona con una pregunta nueva.'],
 scoreTitle='Puntos', scoreRules=['Exacto: +100 · a 1: +60 · a 2: +30 · a 3: +10', 'La apuesta más cercana (empates comparten): +50 extra', 'Silla caliente: +40 si alguien acierta a 1 o menos', 'El objetivo es conocerse; ¡los puntos son solo el condimento!'],
 footerNote='Un juego de fiesta relajado para conocer mejor a amigos, familia y pareja.', timer='Tiempo para responder', setNote='La silla caliente cambia cada ronda. Tras la revelación, el anfitrión pulsa Siguiente.',
 hotSeat='Silla caliente', hotYou='¡Tu turno! Responde del 1 al 10 con sinceridad; los demás adivinarán.', hotAsk='¡Adivina el número sincero de {name}!', hotWait='{name} está respondiendo…', allIn='¡Todos han respondido!',
 scaleLo='nada', scaleHi='¡muchísimo!', revealAns='Respuesta sincera de {name}:', voidHot='{name} no respondió a tiempo; esta ronda se salta.', noGuess='Nadie adivinó.', closest='Más cerca', exact='¡Exacto!', off='a {d}', noPick='Sin respuesta', hotBonus='bonus de silla caliente', yourGuess='Tu apuesta: {v}',
 nextBtn='Siguiente ➜ turno de {name}', endBtn='Ver resultados finales ➜', endEarly='Terminar partida', waitNext='¡A charlar! El anfitrión pulsará Siguiente cuando estéis listos.', hostHint='Eres el anfitrión: pulsa Siguiente cuando acabe la charla.', talkTip='¿Por qué ese número? Cuéntanos 😄', nextUp='Siguiente: {name}',
 recapTitle='Conociéndonos mejor', closeTitle='Quien mejor conoce a sus amigos', closeLine='{name} · {n}× casi exacto', noClose='Nadie se ha acercado todavía.', endConfirm='¿Terminar la partida ahora y ver los resultados?',
)
N['pt'] = dict(
 title='Escala dos Amigos', tagline='Adivinhe o 1–10 dos amigos · 2–8 jogadores', heroKicker='Jogo de festa tranquilo · 2–8 jogadores · 9 idiomas',
 heroTitle='Quão bem você conhece seus amigos?', heroSub='A cada rodada alguém senta na cadeira quente e dá uma nota sincera de 1 a 10: “Quanto JadiDaring gosta de assistir filmes?”. Os outros tentam adivinhar o número. Quem chegar mais perto vence, e aí é hora de conversar e rir antes de seguir!',
 facts=['2–8 jogadores, online ou treino contra bots', 'A cadeira quente gira, todo mundo é adivinhado', 'Indonésio, inglês, chinês + mais 6 idiomas'],
 how=['Crie uma sala e compartilhe o link de convite (mínimo 2 jogadores, máximo 8).', 'A cada rodada um jogador fica na cadeira quente, em revezamento. Ele responde em segredo com um número de 1 a 10 (1 = nada, 10 = demais).', 'Os outros chutam: “Que número será?” e tocam em 1–10 antes do tempo acabar.', 'A revelação mostra o número real, todos os chutes e quem chegou mais perto. A tela fica parada: conversem, reclamem e riam à vontade.', 'Quando estiverem prontos, o anfitrião aperta Próxima. A cadeira quente passa para a próxima pessoa com uma pergunta nova.'],
 scoreTitle='Pontos', scoreRules=['Exato: +100 · diferença 1: +60 · diferença 2: +30 · diferença 3: +10', 'Chute mais próximo (empates dividem): bônus +50', 'Cadeira quente: +40 se alguém chutar com diferença de até 1', 'O objetivo é se conhecer; os pontos são só o tempero!'],
 footerNote='Um jogo de festa tranquilo para conhecer melhor amigos, família e parceiros.', timer='Tempo de resposta', setNote='A cadeira quente muda a cada rodada. Depois da revelação, o anfitrião aperta Próxima.',
 hotSeat='Cadeira quente', hotYou='Sua vez! Responda de 1 a 10 com sinceridade, os outros vão chutar.', hotAsk='Adivinhe o número sincero de {name}!', hotWait='{name} está respondendo…', allIn='Todos responderam!',
 scaleLo='nada', scaleHi='demais!', revealAns='Resposta sincera de {name}:', voidHot='{name} não respondeu a tempo, esta rodada foi pulada.', noGuess='Ninguém chutou.', closest='Mais perto', exact='Exato!', off='diferença {d}', noPick='Sem resposta', hotBonus='bônus da cadeira quente', yourGuess='Seu chute: {v}',
 nextBtn='Próxima ➜ vez de {name}', endBtn='Ver resultado final ➜', endEarly='Encerrar jogo', waitNext='Hora do papo! O anfitrião aperta Próxima quando todos estiverem prontos.', hostHint='Você é o anfitrião: aperte Próxima quando o papo acabar.', talkTip='Por que esse número? Conta aí 😄', nextUp='A seguir: {name}',
 recapTitle='Conhecendo melhor', closeTitle='Quem mais conhece os amigos', closeLine='{name} · {n}× quase exato', noClose='Ninguém chegou perto ainda.', endConfirm='Encerrar o jogo agora e ver o resultado?',
)
N['th'] = dict(
 title='สเกลเพื่อน', tagline='ทายคะแนน 1–10 ของเพื่อน · 2–8 คน', heroKicker='ปาร์ตี้เกมชิล ๆ · 2–8 คน · 9 ภาษา',
 heroTitle='คุณรู้จักเพื่อนดีแค่ไหน?', heroSub='แต่ละรอบจะมีคนหนึ่งนั่งเก้าอี้ร้อนและให้คะแนนคำถามอย่างจริงใจ 1–10: “JadiDaring ชอบดูหนังแค่ไหน?” คนอื่นทายตัวเลข ใครทายใกล้ที่สุดชนะ แล้วคุยกันขำ ๆ ก่อนไปต่อ!',
 facts=['2–8 คน เล่นออนไลน์หรือฝึกกับบอท', 'เก้าอี้ร้อนหมุนเวียน ทุกคนได้ถูกทาย', 'อินโดนีเซีย อังกฤษ จีน + อีก 6 ภาษา'],
 how=['สร้างห้องแล้วแชร์ลิงก์เชิญ (อย่างน้อย 2 คน สูงสุด 8 คน)', 'แต่ละรอบจะมีผู้เล่นหนึ่งคนนั่งเก้าอี้ร้อนผลัดกันไป เขาตอบคำถามอย่างลับ ๆ ด้วยเลข 1–10 (1 = ไม่เลย, 10 = สุด ๆ)', 'คนอื่นทายว่า “น่าจะกี่คะแนน?” แล้วแตะ 1–10 ก่อนหมดเวลา', 'เฉลยตัวเลขจริง คำทายทั้งหมด และใครทายใกล้ที่สุด หน้าจอจะค้างไว้ คุยกัน แซวกัน หัวเราะกันได้เต็มที่', 'พร้อมแล้วโฮสต์กดถัดไป เก้าอี้ร้อนย้ายไปคนถัดไปพร้อมคำถามใหม่'],
 scoreTitle='คะแนน', scoreRules=['ตรงเป๊ะ: +100 · ห่าง 1: +60 · ห่าง 2: +30 · ห่าง 3: +10', 'คำทายที่ใกล้ที่สุด (เสมอได้ทุกคน): โบนัส +50', 'เก้าอี้ร้อน: +40 ถ้ามีคนทายห่างไม่เกิน 1', 'เป้าหมายคือทำความรู้จักกัน คะแนนเป็นแค่เครื่องปรุง!'],
 footerNote='ปาร์ตี้เกมชิล ๆ เพื่อรู้จักเพื่อน ครอบครัว และแฟนมากขึ้น', timer='เวลาตอบ', setNote='เก้าอี้ร้อนเปลี่ยนทุกรอบ หลังเฉลย โฮสต์กดถัดไป',
 hotSeat='เก้าอี้ร้อน', hotYou='ตาคุณแล้ว! ตอบ 1–10 ตามจริง คนอื่นจะทาย', hotAsk='ทายตัวเลขจริงใจของ {name}!', hotWait='{name} กำลังตอบ…', allIn='ทุกคนตอบแล้ว!',
 scaleLo='ไม่เลย', scaleHi='สุด ๆ!', revealAns='คำตอบจริงใจของ {name}:', voidHot='{name} ตอบไม่ทัน ข้ามรอบนี้', noGuess='ไม่มีใครทาย', closest='ใกล้ที่สุด', exact='ตรงเป๊ะ!', off='ห่าง {d}', noPick='ไม่ได้ตอบ', hotBonus='โบนัสเก้าอี้ร้อน', yourGuess='คุณทาย: {v}',
 nextBtn='ถัดไป ➜ ตาของ {name}', endBtn='ดูผลสุดท้าย ➜', endEarly='จบเกม', waitNext='คุยกันก่อน! โฮสต์จะกดถัดไปเมื่อทุกคนพร้อม', hostHint='คุณเป็นโฮสต์: คุยเสร็จแล้วกดถัดไป', talkTip='ทำไมให้เลขนี้? เล่าหน่อย 😄', nextUp='คนถัดไป: {name}',
 recapTitle='รู้จักกันมากขึ้น', closeTitle='รู้ใจเพื่อนที่สุด', closeLine='{name} · เกือบตรง {n} ครั้ง', noClose='ยังไม่มีใครทายใกล้', endConfirm='จบเกมตอนนี้และดูผลเลยไหม?',
)
# open chat during play (always open, next to / below the stage). Wording follows Sambung Coret's slideshow chat.
CHAT = {
 'id': dict(chatTitle='💬 Obrolan', chatPh='Tulis pesan…', chatSend='Kirim', chatWho='Pengirim', chatEmpty='Belum ada obrolan. Ayo ramaikan!', chatSlow='Pelan-pelan, tunggu sebentar ya.'),
 'en': dict(chatTitle='💬 Chat', chatPh='Write a message…', chatSend='Send', chatWho='Sender', chatEmpty='No messages yet. Say something!', chatSlow='Easy there, wait a moment.'),
 'zh': dict(chatTitle='💬 聊天', chatPh='说点什么…', chatSend='发送', chatWho='发送者', chatEmpty='还没有消息，来聊两句吧！', chatSlow='慢一点，稍等一下。'),
 'ja': dict(chatTitle='💬 チャット', chatPh='メッセージを入力…', chatSend='送信', chatWho='送信者', chatEmpty='まだメッセージはありません。話しかけてみよう！', chatSlow='少し待ってから送ってね。'),
 'ko': dict(chatTitle='💬 채팅', chatPh='메시지를 입력하세요…', chatSend='보내기', chatWho='보내는 사람', chatEmpty='아직 메시지가 없어요. 한마디 해 봐요!', chatSlow='천천히, 잠깐만 기다려 주세요.'),
 'ms': dict(chatTitle='💬 Sembang', chatPh='Tulis mesej…', chatSend='Hantar', chatWho='Pengirim', chatEmpty='Belum ada mesej. Jom bersembang!', chatSlow='Perlahan-lahan, tunggu sekejap ya.'),
 'es': dict(chatTitle='💬 Chat', chatPh='Escribe un mensaje…', chatSend='Enviar', chatWho='Remitente', chatEmpty='Aún no hay mensajes. ¡Di algo!', chatSlow='Tranquilo, espera un momento.'),
 'pt': dict(chatTitle='💬 Chat', chatPh='Escreva uma mensagem…', chatSend='Enviar', chatWho='Remetente', chatEmpty='Nenhuma mensagem ainda. Diga algo!', chatSlow='Calma, espere um pouco.'),
 'th': dict(chatTitle='💬 แชท', chatPh='พิมพ์ข้อความ…', chatSend='ส่ง', chatWho='ผู้ส่ง', chatEmpty='ยังไม่มีข้อความ มาคุยกันเลย!', chatSlow='ช้าลงหน่อย รอสักครู่นะ'),
}
for _l, _d in CHAT.items(): N[_l].update(_d)
