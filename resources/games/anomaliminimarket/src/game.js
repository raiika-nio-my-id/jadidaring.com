/* Anomali Mini Market — sim + rules. window.AM */
(function (root) {
'use strict';
const NAMES_M = ['Budi Santoso','Agus Wijaya','Rudi Hartono','Dedi Kurniawan','Andi Pratama','Fajar Nugroho','Hendra Saputra','Yusuf Maulana','Rizki Firmansyah','Bagus Setiawan','Eko Prasetyo','Tono Rahayu'];
const NAMES_F = ['Siti Aminah','Dewi Lestari','Rina Marlina','Ayu Puspita','Fitri Handayani','Nurul Aulia','Maya Sari','Lina Wulandari','Putri Anggraini','Anisa Rahma','Kartika Dewi','Yuli Astuti'];
const GHOST_NAMES = ['Pocong Kawin','Kuntilanak Pasar','Genderuwo Kasir','Tuyul Member','Sundel Bolong','Wewe Gombel','Leak Minimarket','Hantu Kulkas'];
const PRODUCTS = [
  { id:'indomie', icon:'🍜', name:'Indomie', price:3500 },
  { id:'tehbotol', icon:'🧋', name:'Teh Botol', price:5000 },
  { id:'chitato', icon:'🥔', name:'Chitato', price:10000 },
  { id:'beras', icon:'🍚', name:'Beras 1kg', price:15000 },
  { id:'sabun', icon:'🧼', name:'Sabun', price:8000 },
  { id:'rokok', icon:'🚬', name:'Rokok', price:25000 },
  { id:'susu', icon:'🥛', name:'Susu UHT', price:12000 },
  { id:'air', icon:'💧', name:'Air mineral', price:3000 }
];
const WEIRD = [
  { id:'tanah', icon:'🪦', name:'Tanah kuburan', price:0, weird:true },
  { id:'kepala', icon:'🐔', name:'Kepala ayam hidup', price:0, weird:true },
  { id:'dupa', icon:'🕯️', name:'Dupa aneh', price:0, weird:true },
  { id:'kuku', icon:'💅', name:'Kuku panjang', price:0, weird:true }
];
// tip = what it means; look = where to check it (glossary, touch-accessible)
const ANOMALIES = [
  { id:'nama_ktp', label:'Nama KTP aneh', tip:'Nama di KTP beda dengan nama yang dia sebut / nama hantu.', look:'Bandingkan ucapan "Saya Pak/Bu …" dengan Nama di KTP.' },
  { id:'tgl_lahir', label:'Tgl lahir aneh', tip:'Tanggal lahir mustahil (31 Februari, tahun 1899 atau 3025).', look:'Baris Tgl lahir di KTP.' },
  { id:'gender_ktp', label:'Gender KTP salah', tip:'Dia memperkenalkan diri "Pak" tapi KTP PEREMPUAN, atau "Bu" tapi KTP LAKI-LAKI.', look:'Sapaan (Pak/Bu) vs baris JK di KTP.' },
  { id:'status_ktp', label:'Status KTP aneh', tip:'Status bukan BELUM KAWIN / KAWIN / CERAI HIDUP (mis. HANTU, POCONG, —).', look:'Baris Status di KTP.' },
  { id:'foto_wajah', label:'Foto ≠ wajah', tip:'Foto KTP beda warna rambut/kulit/baju dengan orangnya.', look:'Foto KTP vs gambar pelanggan + baris "Foto KTP".' },
  { id:'uang_palsu', label:'Uang palsu', tip:'Uang tanpa benang pengaman / gambar luntur. Tolak uangnya.', look:'Baris Uang (tunai). Di panel bayar: tombol "Tolak uang".' },
  { id:'kaki_melayang', label:'Kaki melayang', tip:'Kaki tidak napak lantai.', look:'Gambar pelanggan + baris Kaki.' },
  { id:'bayangan_hilang', label:'Tanpa bayangan', tip:'Tidak ada bayangan di lantai.', look:'Bawah kaki di gambar + baris Bayangan.' },
  { id:'mata_merah', label:'Mata merah', tip:'Mata menyala merah.', look:'Wajah di gambar + baris Mata.' },
  { id:'pantulan_hilang', label:'Tanpa pantulan', tip:'Kaca kulkas tidak memantulkan dia.', look:'Strip kaca kanan gambar + baris Pantulan.' },
  { id:'keranjang_aneh', label:'Keranjang aneh', tip:'Ada barang yang tidak dijual (tanah kuburan, dupa…).', look:'Baris Keranjang.' },
  { id:'jam_mundur', label:'Jam mundur', tip:'Jam toko berjalan mundur selama dia di toko.', look:'Jam di HUD (⏪) + baris Jam toko.' },
  { id:'suhu_dingin', label:'Suhu dingin', tip:'Udara mendadak dingin di dekatnya (takut naik).', look:'Judul panel "UDARA DINGIN" + baris Suhu.' },
  { id:'harga_aneh', label:'Harga coret aneh', tip:'Label harga dicoret jadi angka aneh (Rp666…). Kalau QRIS, nominal diterima jadi beda.', look:'Baris Keranjang (label coret) + QRIS Diterima vs Harus bayar.' },
  /* Phase C folklore pack v1: ln = evidence line that carries the tell, w = the visible token (observe reads it back), lk = world/portrait look */
  { id:'pocong_wrap', folk:1, lk:'pocong', ln:'body', w:'TERBUNGKUS kain kafan, jalan melompat', label:'Pocong', tip:'Badan terbalut kain pucat, ada ikatan di ubun-ubun, jalannya melompat.', look:'Kain & lompatan di gambar + baris Postur.' },
  { id:'kunti_hair', folk:1, lk:'kunti', ln:'voice', w:'TERTAWA melengking "hihihi"', label:'Kuntilanak', tip:'Rambut panjang menutupi wajah, tawanya melengking.', look:'Wajah tertutup rambut di gambar + baris Suara.' },
  { id:'genderuwo_bulk', folk:1, lk:'besar', ln:'body', w:'RAKSASA, bayangan kebesaran', label:'Genderuwo', tip:'Badan kebesaran & gelap, sapaannya berat menggeram.', look:'Ukuran badan + bayangan di gambar + baris Postur.' },
  { id:'tuyul_coin', folk:1, lk:'tuyul', ln:'body', w:'SEUKURAN ANAK, koin lengket', label:'Tuyul', tip:'Seukuran anak, kepala plontos, bayar koin lengket; barang di rak hilang sebelum dia antri.', look:'Ukuran badan di gambar + baris Postur + rak berkurang.' },
  { id:'ktp_foto_glitch', folk:1, ln:'photo', w:'foto BERKEDIP / glitch', label:'Foto KTP glitch', tip:'Pas-foto KTP berkedip dan bergaris seperti sinyal rusak.', look:'Foto KTP (garis glitch) + baris Foto KTP.' },
  { id:'qris_ghost', folk:1, ln:'money', w:'LED EDC MERAH berkedip', label:'QRIS hantu', tip:'Lampu EDC merah berkedip; Diterima ≠ total keranjang. Tekan Nominal salah / Tolak.', look:'Baris Bayar + LED EDC + QRIS Diterima vs Harus bayar.' },
  { id:'uang_basah', folk:1, ln:'money', w:'uang BASAH, pita warna salah, seri 000000', label:'Uang basah', tip:'Uang basah dingin, pita warna salah, nomor seri mustahil. Tolak uangnya.', look:'Baris Uang (tunai). Di panel bayar: Tolak uang.' },
  { id:'sku_salah_harga', folk:1, ln:'claim', w:'BEDA dengan layar kasir', label:'Total diucap salah', tip:'Total yang dia sebut tidak sama dengan total di kasir.', look:'Baris "Dia sebut total".' },
  { id:'pocong_malam', folk:1, malam:1, lk:'pocong', ln:'smell', w:'MELATI busuk + tanah kubur', label:'Pocong Malam', tip:'Malam Anomali: kain kafan + bau melati busuk.', look:'Kain di gambar + baris Bau.' },
  { id:'kunti_malam', folk:1, malam:1, lk:'kunti', ln:'smell', w:'KAMBOJA menyengat', label:'Kunti Malam', tip:'Malam Anomali: rambut menutup wajah + wangi bunga kamboja.', look:'Rambut di wajah + baris Bau.' },
  { id:'genderuwo_malam', folk:1, malam:1, lk:'besar', ln:'smell', w:'KEMENYAN pekat', label:'Genderuwo Malam', tip:'Malam Anomali: badan raksasa + bau kemenyan.', look:'Ukuran badan + baris Bau.' },
  { id:'tuyul_malam', folk:1, malam:1, lk:'tuyul', ln:'smell', w:'KOIN BASI & lumpur', label:'Tuyul Malam', tip:'Malam Anomali: seukuran anak + bau koin basi.', look:'Ukuran badan + baris Bau.' }
];
const FOLK = ANOMALIES.filter(a => a.folk), AN = id => ANOMALIES.find(a => a.id === id) || {};
const CASHY = ['uang_palsu', 'uang_basah']; // force cash; never paired with qris_ghost (forces QRIS)
/* Phase C endings (collectible). Resolved at shift end from rep / fear / folklore outcomes; the last babak shows a cue. */
const ENDINGS = [
  { id:'bersih', icon:'🌅', name:'Shift Bersih', flavor:'Subuh datang tanpa satu hantu pun lolos. Rak rapi, KTP beres.' },
  { id:'kasir', icon:'🏅', name:'Kasir Bulan Ini', flavor:'Ada yang lolos, tapi toko tetap ramai. Fotomu dipajang di dekat kasir.' },
  { id:'disegel', icon:'🚧', name:'Toko Disegel', flavor:'Terlalu banyak yang aneh lolos. Pagi ini pintu toko disegel garis kuning.' },
  { id:'dipanggil', icon:'🕯️', name:'Dipanggil Yang Lain', flavor:'Mereka sudah hafal namamu. Dari lorong kulkas ada yang memanggil…' },
  { id:'tutup', icon:'🔒', name:'Tutup Awal', flavor:'Reputasi habis. Lampu toko dimatikan sebelum subuh.' }
];
function endingOf(G) {
  if (G.isTut) return '';
  if (!G.won) return G.loseWhy === 'takut' ? 'dipanggil' : 'tutup';
  if (G.folkMissed >= 2) return 'dipanggil';
  if (!G.missed && !G.falseReject) return 'bersih';
  return G.rep < 60 || G.missed >= 3 ? 'disegel' : 'kasir';
}
const VALID_STATUS = ['BELUM KAWIN', 'KAWIN', 'CERAI HIDUP'];
const BILLS = [20000, 50000, 100000];
const DENOMS = [500, 1000, 2000, 5000, 10000, 20000, 50000];
const WEIRD_TAGS = [666, 13, 4444, 1];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function mul(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function pick(r, arr) { return arr[(r() * arr.length) | 0]; }
function money(n) { return 'Rp' + Math.round(n).toLocaleString('id-ID'); }

/* Phase B densify: acts (babak) with per-act ghost rate, queue cap and arrival gap; clock runs by shift progress. */
const ACT = (n, key, label, ghost, ano, cap, gap) => ({ n, key, label, ghostRate: ghost, anomalies: ano, cap, gap });
const MODES = {
  latihan: { label: 'Latihan', customers: 6, ghostRate: 0.35, anomalies: [1, 1], soft: true, clockStart: 21, clockEnd: 23, patience: 90, tip: true,
    acts: [ACT(6, 'latihan', 'Latihan', 0.35, [1, 1], 3, [4, 7])] },
  biasa: { label: 'Shift Biasa', customers: 32, ghostRate: 0.4, anomalies: [1, 2], soft: false, clockStart: 22, clockEnd: 30, patience: 60, tip: false,
    acts: [ACT(8, 'buka', 'Buka', 0.3, [1, 1], 2, [3, 5]), ACT(9, 'ramai', 'Ramai', 0.38, [1, 2], 3, [1.5, 3.5]), ACT(9, 'spike', 'Anomali Spike', 0.55, [1, 2], 3, [2, 4]), ACT(6, 'tutup', 'Tutup', 0.45, [2, 2], 2, [3, 5])] },
  malam: { label: 'Malam Anomali', customers: 33, ghostRate: 0.58, anomalies: [1, 3], soft: false, clockStart: 23, clockEnd: 30, patience: 45, tip: false,
    acts: [ACT(7, 'buka', 'Buka', 0.45, [1, 2], 2, [3, 5]), ACT(10, 'ramai', 'Ramai', 0.55, [1, 3], 3, [1.2, 3]), ACT(10, 'spike', 'Anomali Spike', 0.7, [2, 3], 3, [1.5, 3.5]), ACT(6, 'tutup', 'Tutup', 0.6, [2, 3], 2, [2.5, 4.5])] },
  tut: { label: 'Tutorial', customers: 5, ghostRate: 0, anomalies: [1, 1], soft: true, restockEvery: 99, clockStart: 21, tip: true }
};

/* Scripted tutorial: every lesson is deterministic (customer spec fixed). */
const TUT_CUST = {
  A: { ghost: false, gender: 'L', pay: 'cash', basket: ['beras', 'indomie'], bill: 20000 }, // 18.500 → kembalian 1.500 (butuh Rp500)
  B: { ghost: true, anomalies: ['kaki_melayang'], pay: 'qris' },
  C: { ghost: false, gender: 'P', pay: 'qris', basket: ['susu', 'air'] },
  D: { ghost: true, anomalies: ['harga_aneh'], pay: 'qris', basket: ['chitato', 'tehbotol'] },
  E: { ghost: true, anomalies: ['gender_ktp'], pay: 'cash', basket: ['sabun'] }
};
const TUT_STEPS = [
  { id: 'move', ok: 'moved', text: 'Pelajaran 1 · Gerak: geser joystick kiri (atau WASD) untuk jalan di toko.' },
  { id: 'restock', ok: 'restocked', text: 'Pelajaran 2 · Restok: jalan ke rak yang ada label KOSONG (atau ketuk raknya). Di depan rak tekan 📦 Restok → pilih produk (mis. Teh Botol) → ketuk tiap slot kosong ＋ → Selesai restok.' },
  { id: 'inspect', cust: 'A', ok: 'passHuman', text: 'Pelajaran 3 · Inspeksi di kasir: tunggu pelanggan antri, berdiri di depan meja kasir lalu tekan 🔍 Periksa (atau ketuk pelanggan antrian depan). Sapaan cocok dengan KTP, semua baris normal → tekan ✓ Loloskan.' },
  { id: 'cash', ok: 'paidHuman', text: 'Pelajaran 4 · Tunai: tekan pecahan (ada Rp500) sampai "Kembalian kamu" = kembalian yang benar, lalu Serahkan. Salah? Panel tetap terbuka — tekan Reset lalu coba lagi. Ragu? ← Cek lagi kembali ke inspeksi (tanda tetap), bisa Tolak.' },
  { id: 'reject', cust: 'B', ok: 'caught', text: 'Pelajaran 5 · Anomali: pelanggan ini KAKI MELAYANG. Tandai chip "Kaki melayang" (bonus skor) lalu ✖ Tolak (Hantu).' },
  { id: 'meters', ok: 'ack', auto: 9, text: 'Pelajaran 6 · Meter (kiri atas): TAKUT naik kalau hantu lolos / dekat hantu dingin — 100 = kamu kabur (gagal). REPUTASI turun kalau salah tolak / rak kosong — 0 = toko tutup. Tekan "Mengerti".' },
  { id: 'qris', cust: 'C', ok: 'paidHuman', text: 'Pelajaran 7 · QRIS: periksa & loloskan. Di panel QRIS bandingkan "Harus bayar" vs "Diterima EDC". Sama → ✓ Konfirmasi QRIS.' },
  { id: 'qrisWrong', cust: 'D', ok: 'caught', text: 'Pelajaran 8 · Nominal salah: label harga di keranjang dicoret aneh. Tolak saat inspeksi, ATAU loloskan lalu di QRIS lihat "Diterima" ≠ "Harus bayar" → tekan Nominal salah.' },
  { id: 'gender', cust: 'E', ok: 'caught', text: 'Pelajaran 9 · Gender KTP: bandingkan sapaan "Saya Pak/Bu …" dengan baris JK di KTP. Tidak cocok → ✖ Tolak (Hantu).' },
  { id: 'end', ok: 'win', text: 'Selesai! Semua pelanggan dilayani = shift berakhir.' }
];

function makeShelf(r, emptyCount) {
  const slots = [];
  for (let i = 0; i < 8; i++) {
    const p = pick(r, PRODUCTS);
    slots.push({ id: i, product: p, empty: emptyCount == null ? r() < 0.15 : i < emptyCount });
  }
  return slots;
}

function faceTraits(r, gender) {
  return {
    skin: pick(r, ['#c68a5a', '#a86c43', '#d49a6a', '#8c5634', '#e0b090']),
    hair: pick(r, ['#1a1210', '#3a2418', '#5a3a20', '#0d0d0d', '#6a4a30']),
    shirt: pick(r, ['#2f6fb8', '#c0392b', '#2e8b57', '#e67e22', '#6d3fa0', '#1f2a44', '#ffffff', '#f2c14e']),
    gender: gender,
    hat: r() < 0.2
  };
}
const prod = id => PRODUCTS.find(p => p.id === id);
function strHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/* Canvas face preset: eyes/brow/nose/mouth/hair|hijab/age. Derived from a private hash, never from the shift RNG. */
/* Art-P0.3 wardrobe (owner slot names). Rolled from the same private hash as the face → shift RNG untouched. */
const WARD = { foot: ['sneaker', 'sandal', 'boots'], bottom: ['rok', 'jeans', 'pendek', 'olahraga'], top: ['olahraga', 'bikini', 'kemeja', 'polisi'],
  hair: ['panjang', 'lurus', 'keriting', 'botak', 'hijab'], glasses: ['none', 'hitam', 'kotak', 'bulat'], mask: ['off', 'on'] };
const HIJAB = ['#7a3a5a', '#2f4f7a', '#5a6a3a', '#c9a27a', '#3a2a40', '#a04a3a'];
function wpick(f, list) { return list[(f() * list.length) | 0]; }
function faceOf(key, gender, age) {
  const f = mul(strHash(key)), P = gender === 'P';
  const band = age < 30 ? 'muda' : age < 45 ? 'dewasa' : 'tua';
  const q = f();
  const hair = P ? (q < 0.3 ? 'hijab' : q < 0.55 ? 'panjang' : q < 0.8 ? 'lurus' : 'keriting')
    : (q < (band === 'tua' ? 0.35 : 0.14) ? 'botak' : q < 0.55 ? 'lurus' : q < 0.82 ? 'keriting' : 'panjang');
  // draw cut inside the slot: lurus → cepak/belah/jabrik (L) or bob (P); panjang → kuncir/gondrong
  const cut = hair === 'lurus' ? (P ? 'bob' : wpick(f, ['cepak', 'belah', 'jabrik'])) : hair === 'panjang' ? (P ? wpick(f, ['panjang', 'kuncir']) : 'gondrong') : hair === 'keriting' ? 'ikal' : hair;
  const top = wpick(f, P ? ['olahraga', 'bikini', 'kemeja', 'kemeja', 'polisi'] : ['olahraga', 'olahraga', 'kemeja', 'kemeja', 'kemeja', 'polisi']);
  const bottom = top === 'olahraga' && f() < 0.6 ? 'olahraga' : P ? wpick(f, WARD.bottom) : wpick(f, ['jeans', 'pendek', 'olahraga']);
  const foot = top === 'polisi' && f() < 0.6 ? 'boots' : wpick(f, WARD.foot);
  const g = f(), glasses = g < (band === 'tua' ? 0.4 : 0.58) ? 'none' : wpick(f, ['hitam', 'kotak', 'bulat']);
  return {
    band, hair, cut, top, bottom, foot, glasses, mask: f() < 0.22 ? 'on' : 'off',
    eye: ['bulat', 'sipit', 'lebar'][(f() * 3) | 0], brow: f() < 0.5 ? 1.6 : 2.6,
    nose: ['kecil', 'mancung', 'lebar'][(f() * 3) | 0], mouth: ['senyum', 'datar', 'tebal'][(f() * 3) | 0],
    stache: !P && band !== 'muda' && f() < 0.5, skirt: (f() * 4) | 0,
    hijabCol: HIJAB[(f() * HIJAB.length) | 0], tall: 0.92 + f() * 0.16, wide: 0.9 + f() * 0.22, blush: P && f() < 0.5
  };
}
/* shift wardrobe pass (deterministic, no RNG): every owner variant appears ≥1×, no two customers share a full wardrobe signature */
const CUT = { panjang: ['gondrong', 'panjang'], lurus: ['cepak', 'bob'], keriting: ['ikal', 'ikal'], botak: ['botak'], hijab: ['hijab', 'hijab'] };
function wardOk(c, k, v) { const P = c.gender === 'P'; return !((v === 'rok' || v === 'bikini' || v === 'hijab') && !P) && !(v === 'botak' && P); }
function dressShift(list) {
  if (list.length < 12) return;
  const F = c => c.traits.face, set = (c, k, v) => { F(c)[k] = v; if (k === 'hair') F(c).cut = CUT[v][c.gender === 'P' ? 1 : 0]; };
  const seen = new Set(), K = Object.keys(WARD), dif = (a, b) => K.filter(k => a[k] !== b[k]).length;
  list.forEach((c, j) => { // unique + ≥2 slot diffs vs the 3 customers before (side-by-side queue never reads as clones)
    const f = F(c), g0 = WARD.glasses.indexOf(f.glasses), f0 = WARD.foot.indexOf(f.foot), m0 = f.mask, near = list.slice(Math.max(0, j - 3), j).map(F);
    for (let i = 0; i < 24 && (seen.has(wardSig(f)) || near.some(b => dif(f, b) < 2)); i++) { f.glasses = WARD.glasses[(g0 + i + 1) % 4]; f.foot = WARD.foot[(f0 + ((i + 1) >> 2)) % 3]; f.mask = i >= 11 ? (m0 === 'on' ? 'off' : 'on') : m0; }
    seen.add(wardSig(f));
  });
  for (const k in WARD) for (const v of WARD[k]) {
    if (list.some(c => F(c)[k] === v)) continue;
    const n = {}; list.forEach(c => n[F(c)[k]] = (n[F(c)[k]] || 0) + 1);
    const c = list.find(c => n[F(c)[k]] > 1 && wardOk(c, k, v) && !list.some(x => F(x)[k] === v)); if (c) set(c, k, v);
  }
}
function wardSig(fc) { return [fc.foot, fc.bottom, fc.top, fc.hair, fc.glasses, fc.mask].join('|'); }
function faceSig(fc) { return [fc.band, fc.cut, fc.eye, fc.nose, fc.mouth, fc.stache, fc.glasses, fc.mask].join('|'); }

/* force (optional): { ghost, anomalies:[ids], gender:'L'|'P', pay:'cash'|'qris', basket:[product ids], bill } */
function makeCustomer(r, cfg, idx, force, mode) {
  const isGhost = force ? !!force.ghost : r() < cfg.ghostRate;
  const gender = force && force.gender ? force.gender : (r() < 0.5 ? 'L' : 'P');
  const humanName = pick(r, gender === 'L' ? NAMES_M : NAMES_F);
  const traits = faceTraits(r, gender);
  const photoTraits = Object.assign({}, traits);
  const anomalies = [];
  let name = humanName, dob = '', status = pick(r, VALID_STATUS), ktpGender = gender;
  const age = 18 + ((r() * 40) | 0);
  const year = 2026 - age;
  const mon = 1 + ((r() * 12) | 0), day = 1 + ((r() * 28) | 0);
  dob = String(day).padStart(2, '0') + '-' + String(mon).padStart(2, '0') + '-' + year;
  const spoken = humanName.split(' ')[0];
  let lk = '', floatFeet = false, noShadow = false, redEyes = false, noReflect = false, fakeMoney = false, cold = false, clockBack = false, weirdPrice = false;
  let basket = [];
  if (force && force.basket) basket = force.basket.map(prod);
  else { const nItems = 1 + ((r() * 3) | 0); for (let i = 0; i < nItems; i++) basket.push(pick(r, PRODUCTS)); }

  if (isGhost) {
    if (force && force.anomalies) force.anomalies.forEach(id => anomalies.push(id));
    else {
      const nAno = cfg.anomalies[0] + ((r() * (cfg.anomalies[1] - cfg.anomalies[0] + 1)) | 0);
      const pool = ANOMALIES.filter(a => !a.malam || mode === 'malam').map(a => a.id); // Malam-only folklore skips Latihan/Biasa
      for (let i = pool.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      for (const id of pool) { if (anomalies.length >= nAno) break; const q = id === 'qris_ghost' || anomalies.includes('qris_ghost'); if (q && (CASHY.includes(id) || anomalies.some(x => CASHY.includes(x)))) continue; anomalies.push(id); }
    }
    anomalies.forEach(id => {
      if (id === 'nama_ktp') name = pick(r, GHOST_NAMES);
      if (id === 'tgl_lahir') dob = r() < 0.5 ? '31-02-1899' : '01-01-3025';
      if (id === 'gender_ktp') ktpGender = gender === 'L' ? 'P' : 'L';
      if (id === 'status_ktp') status = pick(r, ['HANTU', '—', 'MENINGGAL', 'POCONG']);
      if (id === 'ktp_foto_glitch') photoTraits.glitch = true;
      if (id === 'foto_wajah') { photoTraits.hair = '#0ff'; photoTraits.shirt = '#111'; photoTraits.skin = '#6a2030'; photoTraits.wrong = true; }
      if (id === 'uang_palsu') fakeMoney = true;
      if (id === 'kaki_melayang') floatFeet = true;
      if (id === 'bayangan_hilang') noShadow = true;
      if (id === 'mata_merah') redEyes = true;
      if (id === 'pantulan_hilang') noReflect = true;
      if (id === 'keranjang_aneh') basket = [pick(r, WEIRD), basket[0] || pick(r, PRODUCTS)];
      if (id === 'jam_mundur') clockBack = true;
      if (id === 'suhu_dingin') cold = true;
      if (id === 'harga_aneh') weirdPrice = true;
    });
    anomalies.forEach(id => { const a = AN(id); if (a.lk && !lk) lk = a.lk; });
  }
  // price tags as the player sees them on the items
  const tags = basket.map(p => ({ id: p.id, icon: p.icon, name: p.name, price: p.price, weird: !!p.weird, tag: null }));
  if (weirdPrice) { const t = tags.find(x => !x.weird); if (t) t.tag = pick(r, WEIRD_TAGS); }
  // scanner always rings the real price → totals are multiples of Rp500
  const total = basket.reduce((s, p) => s + (p.price || 0), 0);
  let pay = force && force.pay ? force.pay : (r() < 0.55 ? 'cash' : 'qris');
  const has = id => anomalies.includes(id), wet = has('uang_basah'), qg = has('qris_ghost');
  if (fakeMoney || wet) pay = 'cash';
  if (qg) pay = 'qris';
  let bill = 0;
  if (pay === 'cash') {
    const ok = BILLS.filter(b => b >= total);
    bill = force && force.bill ? force.bill : ok[r() < 0.7 ? 0 : Math.min(1, ok.length - 1)];
  }
  // QRIS: EDC shows what the customer actually sent
  let qrisReceived = total;
  if (pay === 'qris' && weirdPrice) { const t = tags.find(x => x.tag != null); if (t) qrisReceived = total - t.price + t.tag; }
  if (qg) qrisReceived += 6000; // EDC ghost: amount never equals the cart
  const claim = has('sku_salah_harga') ? total + (total > 5000 && strHash(humanName) & 1 ? -2500 : 5000) : total;
  traits.face = faceOf(humanName + '|' + dob + '|' + idx + '|' + gender, gender, age); traits.age = age;
  photoTraits.face = traits.face; photoTraits.age = age;
  return {
    id: idx, isGhost, anomalies, name, spoken, sapaan: gender === 'L' ? 'Pak' : 'Bu', dob, status, ktpGender, gender, traits, photoTraits,
    floatFeet, noShadow, redEyes, noReflect, fakeMoney, cold, clockBack, weirdPrice, basket, tags, total, pay, bill, qrisReceived,
    lk, wet, qg, claim, thief: lk === 'tuyul', glitch: has('ktp_foto_glitch'), folk: anomalies.some(id => AN(id).folk), mm: mode === 'malam' || anomalies.some(id => AN(id).malam),
    u: 2.0, v: 4.0, state: 'queue', served: false
  };
}

/* Everything the player can see about a customer (inspection + payment panels). */
function evidence(c) {
  const e = {
    says: (c.lk === 'besar' ? 'Hrrrm… malam, saya ' : c.lk === 'kunti' ? 'Hihi… malam, saya ' : 'Malam, saya ') + c.sapaan + ' ' + c.spoken + '.',
    sapaan: c.sapaan, saysName: c.spoken,
    ktp: { name: c.name, dob: c.dob, jk: c.ktpGender === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN', status: c.status },
    photo: { skin: c.photoTraits.skin, hair: c.photoTraits.hair, shirt: c.photoTraits.shirt, gender: c.photoTraits.gender },
    face: { skin: c.traits.skin, hair: c.traits.hair, shirt: c.traits.shirt, gender: c.traits.gender },
    lines: [
      { k: 'photo', label: 'Foto KTP', v: c.photoTraits.wrong ? 'BEDA dengan wajah' : 'cocok dengan wajah', bad: !!c.photoTraits.wrong },
      { k: 'feet', label: 'Kaki', v: c.floatFeet ? 'MELAYANG' : 'napak lantai', bad: c.floatFeet },
      { k: 'shadow', label: 'Bayangan', v: c.noShadow ? 'TIDAK ADA' : 'ada', bad: c.noShadow },
      { k: 'eyes', label: 'Mata', v: c.redEyes ? 'MERAH menyala' : 'normal', bad: c.redEyes },
      { k: 'reflect', label: 'Pantulan kulkas', v: c.noReflect ? 'TIDAK ADA' : 'ada', bad: c.noReflect },
      { k: 'temp', label: 'Suhu', v: c.cold ? 'DINGIN mendadak' : 'biasa', bad: c.cold },
      { k: 'clock', label: 'Jam toko', v: c.clockBack ? 'MUNDUR ⏪' : 'normal', bad: c.clockBack },
      { k: 'money', label: c.pay === 'cash' ? 'Uang' : 'Bayar', v: c.pay === 'cash' ? (money(c.bill) + (c.fakeMoney ? ' · TANPA benang pengaman, gambar luntur' : ' · benang pengaman ada')) : 'QRIS', bad: c.fakeMoney },
      { k: 'body', label: 'Postur', v: 'biasa' }, { k: 'voice', label: 'Suara', v: 'biasa' }, { k: 'claim', label: 'Dia sebut total', v: money(c.claim == null ? c.total : c.claim) }
    ].concat(c.mm ? [{ k: 'smell', label: 'Bau', v: 'biasa' }] : []),
    basket: c.tags.map(t => ({ icon: t.icon, name: t.name, weird: t.weird, label: t.weird ? 'tidak dijual di toko' : (t.tag != null ? '~' + money(t.price) + '~ → ' + money(t.tag) : money(t.price)), oddTag: t.tag != null })),
    pay: c.pay, total: c.total, bill: c.bill, change: c.pay === 'cash' ? c.bill - c.total : 0,
    qris: c.pay === 'qris' ? { required: c.total, received: c.qrisReceived } : null
  };
  for (const id of c.anomalies) { const a = AN(id), l = a.ln && e.lines.find(x => x.k === a.ln); if (l) { l.v = l.v === 'biasa' ? a.w : l.v + ' · ' + a.w; l.bad = true; } }
  return e;
}
/* Solve a customer from visible evidence only (used by tests to prove every anomaly is observable). */
function observe(ev) {
  const out = [];
  if (ev.ktp.name.split(' ')[0] !== ev.saysName) out.push('nama_ktp');
  const m = /^(\d\d)-(\d\d)-(\d{4})$/.exec(ev.ktp.dob);
  if (!m || +m[3] < 1900 || +m[3] > 2026 || (+m[2] === 2 && +m[1] > 29)) out.push('tgl_lahir');
  if ((ev.sapaan === 'Pak') !== (ev.ktp.jk === 'LAKI-LAKI')) out.push('gender_ktp');
  if (VALID_STATUS.indexOf(ev.ktp.status) < 0) out.push('status_ktp');
  if (ev.photo.skin !== ev.face.skin || ev.photo.hair !== ev.face.hair || ev.photo.shirt !== ev.face.shirt) out.push('foto_wajah');
  const L = k => ev.lines.find(l => l.k === k).v;
  if (/TANPA benang/.test(L('money'))) out.push('uang_palsu');
  if (L('feet') === 'MELAYANG') out.push('kaki_melayang');
  if (L('shadow') === 'TIDAK ADA') out.push('bayangan_hilang');
  if (/MERAH/.test(L('eyes'))) out.push('mata_merah');
  if (L('reflect') === 'TIDAK ADA') out.push('pantulan_hilang');
  if (ev.basket.some(b => b.weird)) out.push('keranjang_aneh');
  if (/MUNDUR/.test(L('clock'))) out.push('jam_mundur');
  if (/DINGIN/.test(L('temp'))) out.push('suhu_dingin');
  if (ev.basket.some(b => b.oddTag)) out.push('harga_aneh');
  for (const a of FOLK) { const l = ev.lines.find(x => x.k === a.ln); if (l && l.v.includes(a.w)) out.push(a.id); }
  return out;
}

function create(seed, opts) {
  opts = opts || {};
  const mode = MODES[opts.mode] ? opts.mode : 'biasa';
  const cfg = MODES[mode];
  const r = mul(seed);
  const isTut = mode === 'tut';
  const shelf = makeShelf(r, isTut ? 3 : null);
  const customers = [];
  if (!isTut) cfg.acts.forEach((a, ai) => { for (let k = 0; k < a.n; k++) { const c = makeCustomer(r, a, customers.length, null, mode); c.act = ai; customers.push(c); } });
  dressShift(customers);
  const G = {
    seed, mode, cfg, r, t: 0, clock: cfg.clockStart * 3600,
    px: 3.2, py: 5.2, pFacing: 0, vx: 0, vy: 0, walked: 0,
    shelf, customers, idx: 0, active: [],
    total: cfg.customers,
    current: null, phase: 'play', // play | inspect | pay | restock | over
    fear: 0, rep: 100, score: 0, money: 0,
    stockUrge: 0, restockDue: false, milestones: {}, served: 0, caught: 0, missed: 0, falseReject: 0, correctPass: 0, payMistakes: 0,
    tip: '', tipT: 0, tut: !!opts.tut || cfg.tip, isTut,
    tutStep: 0, lessons: {}, tutSpawnAt: -1, tutCust: null, tutStepT: 0, tutRetry: 0,
    over: false, won: false, perfect: false, loseWhy: '',
    payGiven: 0, selectedProduct: PRODUCTS[0].id, restockFilled: 0, markedList: [],
    clockSkew: 0, flash: 0, flashKind: '', shake: 0, ev: [], fx: null, tipPh: 'play', edc: { s: 'idle', t: 0 }, drawer: 0, bump: false, pMoving: false, pWalk: 0,
    stats: { restocks: 0, inspects: 0, fills: 0 }, folkCaught: 0, folkMissed: 0, ending: '',
    // Phase B
    gr: mul((seed ^ 0x5bd1e995) >>> 0), actIdx: 0, actBreak: null, actDoneAt: -1, nextSpawnAt: 1.2, left: 0, vanished: 0, exiting: [],
    clockStart: cfg.clockStart * 3600, clockSpan: cfg.clockEnd ? (cfg.clockEnd - cfg.clockStart) * 3600 : 0, sinceProg: 0, lastProg: 0, restockWarned: false, maxInStore: 0
  };
  return G;
}

function tip(G, msg, sec) { G.tip = msg; G.tipT = sec == null ? 4 : sec; G.tipPh = G.phase; }
/* Playfield banner (one mute-friendly channel per event; never paired with a coach tip). Clock runs in real time. */
function fx(G, kind, text, flash) { G.fx = { kind, text, t: kind === 'act' ? 3 : 1.6 }; G.tip = ''; G.tipT = 0; if (flash) { G.flash = 0.35; G.flashKind = flash; } }
function tickFx(G, realDt) { if (G.fx) { G.fx.t -= realDt; if (G.fx.t <= 0) G.fx = null; } if (G.flash > 0) G.flash -= realDt; if (G.edc && G.edc.t > 0) { G.edc.t -= realDt; if (G.edc.t <= 0) G.edc.s = 'idle'; } if (G.drawer > 0) G.drawer -= realDt; for (const s of G.shelf) if (s.fx > 0) s.fx -= realDt; }

/* ---------- tutorial ---------- */
function tutCur(G) { return G.isTut ? TUT_STEPS[G.tutStep] : null; }
function lessonText(G) { const s = tutCur(G); return s ? s.text : ''; }
function tutEnter(G) {
  const s = tutCur(G); if (!s) return;
  G.tutStepT = 0;
  if (s.cust) G.tutSpawnAt = G.t + 1;
  if (s.id === 'end') { G.lessons.end = true; endWin(G); }
}
function tutAdvance(G, mark) {
  const s = tutCur(G); if (!s || s.id === 'end') return;
  G.lessons[s.id] = mark;
  G.tutStep++;
  tutEnter(G);
}
function tutEvent(G, name, c) {
  const s = tutCur(G); if (!s) return;
  const key = s.cust || (s.id === 'cash' ? 'A' : null);
  const mine = !!c && !!key && c.tutKey === key;
  if (s.ok === name && (!key || mine)) { tutAdvance(G, true); return; }
  // the lesson customer was handled wrong → an identical one comes back (retry route)
  if (mine && (name === 'falseReject' || name === 'ghostpay')) {
    G.tutRetry++; G.tutSpawnAt = G.t + 1.5;
    if (G.fx) { G.fx.text += ' · Pelanggan yang sama datang lagi — coba lagi'; G.fx.t = 2.8; }
    else tip(G, 'Belum tepat — pelanggan yang sama datang lagi. Coba lagi (atau tekan Lewati).', 5);
  }
}
function tutSpawn(G) {
  const s = tutCur(G); if (!s || !s.cust) return;
  const key = s.cust;
  const c = makeCustomer(mul(G.seed * 31 + key.charCodeAt(0)), G.cfg, G.customers.length, TUT_CUST[key]);
  c.tutKey = key; c.arrive = G.t; enterDoor(c, 1.5);
  G.customers.push(c); G.active.push(c); G.idx = G.customers.length;
  G.tutCust = c;
}
function tutSkip(G) {
  const s = tutCur(G); if (!s || s.id === 'end') return;
  tutAdvance(G, 'skip');
}
function tutAck(G) { const s = tutCur(G); if (s && s.ok === 'ack') tutAdvance(G, true); }
function tutComplete(G) { return TUT_STEPS.every(s => G.lessons[s.id] === true); }

/* ---------- world ---------- */
const REACH = 1.6;
const inside = c => c.u > 0.35; // past the door frame
function nearestCustomer(G) {
  let best = null, bd = 9;
  for (const c of G.active) {
    if (c.served || c.state === 'gone' || !inside(c)) continue;
    const d = Math.hypot(c.u - G.px, c.v - G.py) - (c.state === 'queue' ? 0.05 : 0); // ties → the one already queueing
    if (d < bd) { bd = d; best = c; }
  }
  return bd < REACH ? best : null;
}
function inReach(G, c) { return !!c && !c.served && inside(c) && Math.hypot(c.u - G.px, c.v - G.py) < REACH; }
/* front of the queue (or whoever is closest to it) — Periksa auto-walks here when nobody is in reach */
function frontCustomer(G) {
  const live = G.active.filter(c => !c.served && c.state !== 'gone' && inside(c));
  const q = live.filter(c => c.state === 'queue');
  return (q.length ? q : live).sort((a, b) => (a.qi || 0) - (b.qi || 0) || a.arrive - b.arrive)[0] || null;
}
/* Kasir-only checkout: serve only the front-of-queue customer, only while standing at the counter front. */
const KASIR = [2.5, 5.6], KASIR_Z = [1.1, 4.8, 3.9, 6.1]; // stand point + zone (north of the counter solid, clear of PR)
function atKasir(G) { const z = KASIR_Z; return G.px > z[0] && G.px < z[2] && G.py > z[1] && G.py < z[3]; }
function servable(G) { const f = frontCustomer(G); return f && f.state === 'queue' ? f : null; }
/* '' = ok to open the inspect sheet; 'browse' = not queueing yet; 'notfront' = someone is ahead; 'far' = walk to kasir; 'none' */
function kasirGate(G, c) {
  const f = servable(G);
  if (c && c.state !== 'queue') return 'browse';
  if (!f) return 'none';
  if (c && c !== f) return 'notfront';
  return atKasir(G) ? '' : 'far';
}

/* Walk solids (u0,v0,u1,v1) = rendered prop footprints. Walls clamp separately. */
const SOLIDS = [
  [0.3, 1.0, 1.2, 1.7], [0.3, 2.0, 1.2, 2.7], // kulkas
  [5.2, 0.8, 6.8, 1.35], [5.2, 2.0, 6.8, 2.55], // gondola rak
  [1.4, 6.2, 3.6, 7.1] // meja kasir + POS
];
const PR = 0.26; // player radius (feet ellipse; keeps the sprite body out of prop footprints)
function blocked(u, v) { for (const b of SOLIDS) if (u > b[0] - PR && u < b[2] + PR && v > b[1] - PR && v < b[3] + PR) return true; return false; }
/* axis-separated move: slides along a prop edge instead of entering it */
function moveSolid(G, du, dv) {
  let nu = clamp(G.px + du, 0.6, 7.2), nv = clamp(G.py + dv, 0.8, 7.8), hit = false;
  if (blocked(nu, G.py)) { nu = G.px; hit = true; }
  if (blocked(nu, nv)) { nv = G.py; hit = true; }
  G.px = nu; G.py = nv; G.bump = hit;
}

/* Customer AI: door (outside) → walk in → browse a rak/kulkas 3–5.5 s → walk to queue slot → queue. */
const DOOR = [-0.7, 4.6], DOOR_IN = [0.9, 4.6];
const BROWSE = [ // stand point, aisle waypoint, facing (world angle toward the fixture)
  { at: [5.9, 1.75], via: [4.7, 1.75], face: -Math.PI / 2, what: 'rak' },
  { at: [5.9, 3.0], via: null, face: -Math.PI / 2, what: 'rak' },
  { at: [0.8, 3.15], via: null, face: -Math.PI / 2, what: 'kulkas' },
  { at: [6.4, 3.0], via: null, face: -Math.PI / 2, what: 'rak' },
  { at: [0.8, 3.15], via: null, face: -Math.PI / 2, what: 'kulkas' }
];
function queueSlot(i) { return [2.3 + (i % 7) * 0.55, 4.45 + Math.floor(i / 7) * 0.5]; }
function enterDoor(c, browseFor) {
  const f = mul(strHash('b' + c.id + c.name));
  const b = BROWSE[(f() * BROWSE.length) | 0];
  c.u = DOOR[0]; c.v = DOOR[1]; c.state = 'enter'; c.browse = b; c.browseT = browseFor != null ? browseFor : 3 + f() * 2.5; // ≥3 s at the rak so a tap on a shopper is easy to land
  c.path = [DOOR_IN.slice()].concat(b.via ? [b.via.slice()] : [], [b.at.slice()]);
  c.walkPh = 0; c.moving = false; c.facing = 0; c.browsed = false;
}
function custStep(G, c, dt, qi) {
  const ou = c.u, ov = c.v, sp = 1.7;
  if (c.state === 'enter' || c.state === 'toQueue') {
    const tgt = c.path[0];
    if (tgt) {
      const du = tgt[0] - c.u, dv = tgt[1] - c.v, d = Math.hypot(du, dv);
      if (d < 0.05) c.path.shift();
      else { const k = Math.min(1, sp * dt / d); c.u += du * k; c.v += dv * k; }
    }
    if (!c.path.length) {
      if (c.state === 'enter') { c.state = 'browse'; c.facing = c.browse.face; }
      else c.state = 'queue';
    }
  } else if (c.state === 'browse') {
    c.browseT -= dt; c.browsed = true;
    if (c.browseT <= 0) {
      if (c.thief && !c.stole && !G.isTut) { c.stole = 1; const s = G.shelf.find(x => !x.empty); if (s) { s.empty = true; s.fx = 0.7; if (G.phase === 'play' && !G.fx) fx(G, 'bad', '🪙 Barang di rak hilang sendiri…'); } }
      const q = queueSlot(qi);
      c.state = 'toQueue'; c.path = (c.browse.via ? [c.browse.via.slice()] : []).concat([q]);
    }
  } else if (c.state === 'queue') {
    const q = queueSlot(qi);
    c.u += (q[0] - c.u) * Math.min(1, dt * 1.5);
    c.v += (q[1] - c.v) * Math.min(1, dt * 1.5);
  }
  const mu = c.u - ou, mv = c.v - ov, m = Math.hypot(mu, mv);
  c.moving = m > 0.15 * dt;
  if (c.moving) { c.facing = Math.atan2(mv, mu); c.walkPh = (c.walkPh || 0) + m * 9; }
  else if (c.state === 'queue') c.facing = Math.PI / 4; // face the camera / kasir
  c.qi = qi;
}

/* Physical restok: each gondola holds 4 slots; you fill only the unit you stand at. */
const UNITS = [
  { b: [5.2, 0.8, 6.8, 1.35], slots: [0, 1, 2, 3], at: [4.72, 1.08], name: 'Rak atas' },
  { b: [5.2, 2.0, 6.8, 2.55], slots: [4, 5, 6, 7], at: [6.0, 2.95], name: 'Rak bawah' }
];
const NEAR = 0.85; // max gap player→gondola edge
function unitGap(G, u) { const b = u.b, dx = Math.max(b[0] - G.px, 0, G.px - b[2]), dy = Math.max(b[1] - G.py, 0, G.py - b[3]); return Math.hypot(dx, dy); }
function unitEmpty(G, u) { return u.slots.filter(i => G.shelf[i] && G.shelf[i].empty).length; }
/* the gondola the player faces: in reach, empties first, then the closest */
function nearUnit(G, needEmpty) {
  let best = -1, bk = 9;
  UNITS.forEach((u, i) => { const d = unitGap(G, u); if (d > NEAR || (needEmpty && !unitEmpty(G, u))) return; const k = d - (unitEmpty(G, u) ? 1 : 0); if (k < bk) { bk = k; best = i; } });
  return best;
}
/* nearest gondola that still has empty slots (auto-walk target) */
function emptyUnit(G) {
  let best = -1, bd = 99;
  UNITS.forEach((u, i) => { if (!unitEmpty(G, u)) return; const d = Math.hypot(u.at[0] - G.px, u.at[1] - G.py); if (d < bd) { bd = d; best = i; } });
  return best;
}

function stockRatio(G) { const n = G.shelf.length || 1; return G.shelf.filter(s => !s.empty).length / n; }
function stockCount(G) { return G.shelf.filter(s => !s.empty).length; }

function inStore(G) { return G.active.filter(c => !c.served).length; }
function curAct(G) { return G.cfg.acts ? G.cfg.acts[Math.min(G.actIdx, G.cfg.acts.length - 1)] : null; }
function gapOf(G) { const g = curAct(G).gap; return g[0] + G.gr() * (g[1] - g[0]); }
/* Phase B spawn: queue cap per act; the next customer arrives a few seconds after a slot frees.
   Between acts: a short restok window (shelf drained, next act waits until rak penuh or the window times out). */
function spawnDue(G) {
  if (G.isTut) {
    if (G.tutSpawnAt >= 0 && G.t >= G.tutSpawnAt) { G.tutSpawnAt = -1; tutSpawn(G); }
    return;
  }
  const acts = G.cfg.acts;
  if (G.actBreak) {
    const br = G.actBreak;
    if (G.phase === 'play' && (stockCount(G) === G.shelf.length || G.t >= br.until)) {
      G.actBreak = null; G.nextSpawnAt = G.t + 1.2;
      const a = curAct(G);
      fx(G, 'act', 'BABAK ' + (G.actIdx + 1) + '/' + acts.length + ' · ' + a.label.toUpperCase() + ' · ' + clockLabel(G) + (G.actIdx === acts.length - 1 ? ' · akhir shift ditentukan sekarang' : ''));
      G.ev.push({ t: 'act' });
    }
    return;
  }
  if (G.idx >= G.customers.length) return;
  const next = G.customers[G.idx];
  if (next.act !== G.actIdx) { // act exhausted → wait for the store to empty, then open the restok window
    if (inStore(G) || G.current) { G.actDoneAt = -1; return; }
    if (G.actDoneAt < 0) { G.actDoneAt = G.t; return; }
    if (G.t - G.actDoneAt < 1.8) return; // let the last outcome banner read first
    G.actDoneAt = -1; G.actIdx = next.act;
    drainShelf(G, G.actIdx >= acts.length - 1 ? 2 : 3);
    G.actBreak = { until: G.t + 16 };
    fx(G, 'act', 'Babak ' + G.actIdx + ' selesai · RESTOK rak dulu — ' + curAct(G).label + ' segera mulai');
    G.ev.push({ t: 'restockneed' });
    return;
  }
  const act = curAct(G);
  if (inStore(G) >= act.cap || G.t < G.nextSpawnAt) return;
  const c = G.customers[G.idx++];
  c.arrive = G.t; enterDoor(c);
  G.active.push(c); G.nextSpawnAt = G.t + gapOf(G);
  G.maxInStore = Math.max(G.maxInStore, inStore(G));
  if (G.tut && G.served === 0) tip(G, 'Pelanggan datang. Biar dia belanja lalu antri — layani di meja kasir (🔍 Periksa).', 5);
}

/* empty facings: n filled slots go empty (act change / purchases) */
function drainShelf(G, n, ids) {
  let k = 0;
  if (ids) for (const id of ids) { if (k >= n) break; const s = G.shelf.find(x => !x.empty && x.product.id === id); if (s) { s.empty = true; k++; } }
  for (let i = G.shelf.length - 1; i >= 0 && k < n && !ids; i--) { const s = G.shelf[(i * 5 + G.served) % G.shelf.length]; if (!s.empty) { s.empty = true; k++; } }
  return k;
}
/* paid basket leaves the shelf: matching facings first, at least one facing per paying customer */
function buyFromShelf(G, c) {
  if (G.isTut || !G.cfg.acts) return;
  const ids = c.basket.filter(p => !p.weird).map(p => p.id);
  const got = drainShelf(G, 2, ids);
  if (!got) drainShelf(G, 1);
}

/* Screen axes (sx right+, sy down+) → world (u,v) for the dimetric projection
   x' = (u - v)·0.866, y' = (u + v)·0.5  →  pure screen-up walks straight up, diagonals keep their screen angle. */
function screenToWorld(sx, sy) {
  if (!sx && !sy) return [0, 0];
  const a = sx / 0.866, b = sy / 0.5;
  return [(a + b) / 2, (b - a) / 2];
}
function setInput(G, dx, dy) {
  const len = Math.hypot(dx, dy) || 1;
  G.vx = dx / len; G.vy = dy / len;
  if (dx || dy) G.pFacing = Math.atan2(dy, dx);
  if (!dx && !dy) { G.vx = 0; G.vy = 0; }
}

/* restok pressure: warn once per depletion; empty facings left alone cost reputation (and fear on Malam) */
function stockPressure(G, dt) {
  const empt = G.shelf.length - stockCount(G);
  if (!empt) { G.restockDue = false; G.restockWarned = false; G.stockUrge = Math.max(0, G.stockUrge - dt); return; }
  if (empt >= 3) G.restockDue = true;
  if (G.restockDue && !G.restockWarned) {
    G.restockWarned = true; G.ev.push({ t: 'restockneed' });
    if (!G.fx) tip(G, 'Waktunya restok! Jalan ke rak KOSONG (' + stockCount(G) + '/8 terisi)', 3);
  }
  G.stockUrge += dt;
  const first = G.mode === 'biasa' && G.actIdx === 0; // Biasa babak 1 soften: 1 gap is free, longer grace, slower drain
  if (G.isTut || G.stockUrge <= (first ? 20 : 12) || (first && empt < 2)) return;
  const k = G.cfg.soft ? 0.5 : first ? 0.6 : 1;
  G.rep = clamp(G.rep - dt * 0.2 * empt * k, 0, 100);
  if (G.mode === 'malam') G.fear = clamp(G.fear + dt * 0.08 * empt, 0, 100);
  if (G.tut && G.tipT <= 0 && !G.fx) tip(G, 'Rak kosong kelamaan — reputasi turun! Jalan ke rak lalu 📦 Restok.', 3);
}

/* patience (queue only; the customer at the counter never waits). Human leaves angry, ghost vanishes. */
function patienceStep(G, dt, realDt) {
  if (G.isTut || !G.cfg.patience) return;
  if (G.phase !== 'play' && realDt) dt = realDt * 0.5; // a sheet slows the shop, but the queue still gets restless (½ real time)
  for (const c of G.active.slice()) {
    if (c.served || c === G.current || c.state !== 'queue') continue;
    if (c.pat == null) { c.pat = G.cfg.patience; c.patMax = G.cfg.patience; }
    c.pat -= dt;
    if (c.pat > 0) continue;
    if (c.isGhost) { G.vanished++; G.fear = clamp(G.fear + 14, 0, 100); fx(G, 'bad', '👻 ' + c.sapaan + ' ' + c.spoken + ' menghilang… tidak diperiksa · takut naik'); G.ev.push({ t: 'ghostpay' }); }
    else { G.left++; G.rep = clamp(G.rep - (G.cfg.soft ? 4 : G.mode === 'biasa' && G.actIdx === 0 ? 6 : 9), 0, 100); fx(G, 'bad', '😤 ' + c.sapaan + ' ' + c.spoken + ' pergi — kelamaan antri · reputasi turun'); G.ev.push({ t: 'false' }); }
    finishCustomer(G, c, !c.isGhost);
  }
}

/* Clock by shift progress: start → end (06:00 Subuh) as customers finish, with small real-time drift between them. */
function clockStep(G, dt, back) {
  if (!G.clockSpan) { G.clock += dt * 60 * (back ? -2.5 : 1); return; }
  const prog = Math.min(1, (G.served + (G.current ? 0.5 : 0)) / G.total);
  if (prog !== G.lastProg) { G.lastProg = prog; G.sinceProg = 0; } else G.sinceProg += dt;
  const per = G.clockSpan / G.total, goal = G.clockStart + G.clockSpan * prog + Math.min(per * 0.45, G.sinceProg * 8);
  if (back) G.clock -= dt * 150;
  else if (goal > G.clock) G.clock += Math.min(goal - G.clock, dt * 240);
}

function step(G, dt, realDt) {
  if (G.over) return;
  G.t += dt;
  if (G.tipT > 0) G.tipT -= dt;
  if (G.shake > 0) G.shake -= dt;
  if (!realDt) tickFx(G, dt); // headless callers: fx on sim clock; the app passes its real frame time
  const back = G.active.some(c => c.clockBack && !c.served);
  G.clockSkew = back ? 1 : 0;
  clockStep(G, dt, back);
  spawnDue(G);
  if (G.isTut) {
    G.tutStepT += dt;
    const s = tutCur(G);
    if (s && s.auto && G.tutStepT >= s.auto) tutAck(G);
  }

  let qi = 0; // customers keep walking/queueing behind an open sheet (slowed clock)
  G.active.forEach(c => { if (!c.served) custStep(G, c, dt, qi++); });
  exitStep(G, dt);
  patienceStep(G, dt, realDt);
  if (G.phase === 'play') {
    const sp = 2.4;
    const ox = G.px, oy = G.py;
    moveSolid(G, G.vx * sp * dt, G.vy * sp * dt);
    const moved = Math.hypot(G.px - ox, G.py - oy);
    G.walked += moved; G.pMoving = moved > 0.2 * dt; if (G.pMoving) G.pWalk = (G.pWalk || 0) + moved * 9;
    if (G.isTut && G.walked > 0.8) tutEvent(G, 'moved');
    stockPressure(G, dt);
    for (const c of G.active) {
      if (c.cold && !c.served) {
        const d = Math.hypot(c.u - G.px, c.v - G.py);
        if (d < 1.8) G.fear = clamp(G.fear + dt * 3, 0, 100);
      }
    }
    if (G.isTut) { G.fear = Math.min(G.fear, 90); G.rep = Math.max(G.rep, 10); }
    if (G.fear >= 100) endLose(G, 'takut');
    if (G.rep <= 0) endLose(G, 'reputasi');
    if (!G.isTut && !G.over && G.idx >= G.customers.length && G.active.every(c => c.served || c.state === 'gone') && G.served >= G.total) endWin(G);
  }
}

function openInspect(G, c) {
  if (!c || G.phase !== 'play') return false;
  G.current = c; G.phase = 'inspect'; G.markedList = []; G.stats.inspects++; G.tip = ''; G.tipT = 0;
  G.ev.push({ t: 'inspect' });
  if (G.tut && !G.isTut) tip(G, 'Bandingkan sapaan & KTP, cek tiap baris bukti. Tandai anomali lalu Loloskan atau Tolak.', 5);
  return true;
}
function cancelInspect(G) { if (G.phase === 'inspect') { G.phase = 'play'; G.current = null; G.markedList = []; } }

function toggleMark(G, id) {
  if (G.phase !== 'inspect') return;
  const i = G.markedList.indexOf(id);
  if (i >= 0) G.markedList.splice(i, 1); else G.markedList.push(id);
}

function decide(G, reject) {
  const c = G.current; if (!c || G.phase !== 'inspect') return;
  if (reject) {
    if (c.isGhost) {
      const good = G.markedList.filter(id => c.anomalies.indexOf(id) >= 0).length;
      G.caught++; G.score += 120 + c.anomalies.length * 30 + good * 15; G.fear = clamp(G.fear - 8, 0, 100); if (c.folk) G.folkCaught++;
      G.ev.push({ t: 'catch' }); fx(G, 'good', '👻 HANTU TERTANGKAP!' + (good ? ' +catatan ' + good : ''), 'catch');
      finishCustomer(G, c); tutEvent(G, 'caught', c);
    } else {
      G.falseReject++; G.score = Math.max(0, G.score - 80); G.rep = clamp(G.rep - 18, 0, 100);
      G.ev.push({ t: 'false' }); fx(G, 'bad', '✖ SALAH TOLAK — dia manusia · reputasi turun');
      finishCustomer(G, c, true); tutEvent(G, 'falseReject', c);
    }
  } else {
    G.phase = 'pay'; G.payGiven = 0; G.tip = ''; G.tipT = 0; // no stale inspect/restock coach inside the pay sheet
    G.edc = { s: c.pay === 'qris' ? 'wait' : 'idle', t: 0 };
    if (!c.isGhost && !c.passed) { c.passed = true; G.correctPass++; tutEvent(G, 'passHuman', c); }
  }
}
/* ← Cek lagi: abort payment back to inspection for the SAME customer (marks kept, queue not advanced) */
function backToInspect(G) {
  const c = G.current; if (!c || G.phase !== 'pay') return false;
  G.phase = 'inspect'; G.payGiven = 0; G.edc = { s: 'idle', t: 0 }; G.tip = ''; G.tipT = 0;
  return true;
}

function finishCustomer(G, c, walkOut) {
  c.served = true; c.state = 'gone'; G.served++;
  if (c === G.current) { G.current = null; G.phase = 'play'; G.markedList = []; G.payGiven = 0; }
  G.active = G.active.filter(x => x !== c);
  if (walkOut && !G.isTut) { c.state = 'leave'; c.path = [DOOR_IN.slice(), DOOR.slice()]; G.exiting.push(c); }
  if (G.over) return;
  if (G.cfg.acts) G.nextSpawnAt = Math.max(G.nextSpawnAt, G.t + gapOf(G));
}
/* served / angry customers walk back out through the door (render only; no hits, no tag) */
function exitStep(G, dt) {
  for (const c of G.exiting) {
    const tgt = c.path[0]; if (!tgt) { c.state = 'out'; continue; }
    const du = tgt[0] - c.u, dv = tgt[1] - c.v, d = Math.hypot(du, dv);
    if (d < 0.05) { c.path.shift(); continue; }
    const k = Math.min(1, 1.9 * dt / d); c.u += du * k; c.v += dv * k; c.moving = true; c.facing = Math.atan2(dv, du); c.walkPh = (c.walkPh || 0) + d * k * 9;
  }
  G.exiting = G.exiting.filter(c => c.state !== 'out');
}

function payFail(G, msg) {
  G.payMistakes++;
  if (!G.isTut) { G.rep = clamp(G.rep - 6, 0, 100); G.score = Math.max(0, G.score - 20); }
  G.ev.push({ t: 'miss' }); // outcome is shown inside the pay sheet (#payMsg) only
  if (G.current && G.current.pay === 'qris') G.edc = { s: 'bad', t: 1.4 };
  return { done: false, good: false, msg };
}
/* accept=true: hand over change / confirm QRIS. accept=false: reject tender (cash: "Tolak uang", QRIS: "Nominal salah").
   Returns { done, good, msg }; done=false means the payment panel stays open for a retry. */
function confirmPay(G, accept) {
  const c = G.current; if (!c || G.phase !== 'pay') return { done: false, good: false, msg: '' };
  if (!accept) {
    const trap = c.pay === 'cash' ? c.fakeMoney || c.wet : c.qrisReceived !== c.total;
    if (trap) {
      G.caught++; if (c.folk) G.folkCaught++; G.score += 100; G.fear = clamp(G.fear - 8, 0, 100);
      G.ev.push({ t: 'catch' });
      const msg = c.pay === 'cash' ? (c.wet && !c.fakeMoney ? 'Uang basah' : 'Uang palsu') + ' ditolak — hantu kabur!' : 'Nominal salah ditolak — hantu kabur!';
      if (c.pay === 'qris') G.edc = { s: 'bad', t: 1.4 };
      fx(G, 'good', '👻 ' + msg, 'catch');
      finishCustomer(G, c); tutEvent(G, 'caught', c);
      return { done: true, good: true, msg };
    }
    return payFail(G, c.pay === 'cash' ? 'Uangnya asli — jangan ditolak. Hitung kembaliannya.' : 'Nominal sudah sama — tekan Konfirmasi QRIS.');
  }
  if (c.pay === 'cash') {
    const need = c.bill - c.total;
    if (G.payGiven !== need) return payFail(G, 'Kembalian salah: kamu kasih ' + money(G.payGiven) + ', harusnya ' + money(need) + '. Tekan Reset lalu coba lagi.');
  }
  if (c.isGhost) {
    G.missed++; if (c.folk) G.folkMissed++; G.fear = clamp(G.fear + (c.fakeMoney ? 28 : 32), 0, 100); G.score = Math.max(0, G.score - 50);
    G.ev.push({ t: 'ghostpay' }); G.shake = 0.6;
    const msg = c.fakeMoney ? 'Uang palsu dari hantu! Takut naik.' : 'Kamu meloloskan hantu… Takut naik.';
    fx(G, 'bad', '😱 ' + msg);
    buyFromShelf(G, c); finishCustomer(G, c, true); tutEvent(G, 'ghostpay', c);
    if (G.isTut) { G.fear = Math.min(G.fear, 90); }
    return { done: true, good: false, msg };
  }
  G.score += 80; G.money += c.total; G.rep = clamp(G.rep + 3, 0, 100);
  G.ev.push({ t: 'payok' });
  const msg = 'Pembayaran beres. +' + money(c.total);
  if (c.pay === 'qris') G.edc = { s: 'ok', t: 1.6 }; else G.drawer = 0.9;
  fx(G, 'good', '💰 ' + msg, 'pay');
  buyFromShelf(G, c); finishCustomer(G, c, true); tutEvent(G, 'paidHuman', c);
  return { done: true, good: true, msg };
}

function addChange(G, v) { if (G.phase === 'pay') G.payGiven += v; }
function clearChange(G) { G.payGiven = 0; }

/* Restock: opening is idempotent (keeps chosen product); only new fills earn points. */
function openRestock(G, unit) {
  if (G.phase === 'restock') return true;
  if (G.phase !== 'play') return false;
  const ui = unit != null && unitGap(G, UNITS[unit]) <= NEAR ? unit : nearUnit(G, true);
  if (ui < 0) return false; // far from any gondola with an empty slot
  G.restockUnit = ui; G.phase = 'restock'; G.restockFilled = 0; G.tip = ''; G.tipT = 0;
  if (!PRODUCTS.some(p => p.id === G.selectedProduct)) G.selectedProduct = PRODUCTS[0].id;
  return true;
}
function selectProduct(G, id) { if (G.phase === 'restock' && PRODUCTS.some(p => p.id === id)) G.selectedProduct = id; }
function fillSlot(G, slotId) {
  if (G.phase !== 'restock') return false;
  const s = G.shelf.find(x => x.id === slotId); if (!s || !s.empty || UNITS[G.restockUnit].slots.indexOf(slotId) < 0) return false;
  const p = PRODUCTS.find(x => x.id === G.selectedProduct) || PRODUCTS[0];
  s.product = p; s.empty = false; s.fx = 0.7; G.score += 5; G.restockFilled++; G.stats.fills++; G.ev.push({ t: 'fill' });
  return true;
}
function closeRestock(G) {
  if (G.phase !== 'restock') return { filled: 0, full: false };
  G.phase = 'play';
  const filled = G.restockFilled, full = stockCount(G) === G.shelf.length;
  G.restockFilled = 0;
  if (filled > 0) {
    G.stats.restocks++; G.stockUrge = 0;
    if (full) { G.score += 15; G.ev.push({ t: 'restock' }); fx(G, 'good', '📦 Rak penuh! +15'); }
  }
  if (full) { G.restockDue = false; tutEvent(G, 'restocked'); }
  else if (G.tut || filled) tip(G, unitEmpty(G, UNITS[G.restockUnit]) ? 'Rak ini masih ada slot kosong — isi semuanya.' : 'Rak lain masih kosong — jalan ke sana lalu 📦 Restok.', 4);
  return { filled, full };
}

function endWin(G) {
  if (G.over) return;
  G.over = true; G.won = true; G.phase = 'over';
  if (G.clockSpan) G.clock = G.clockStart + G.clockSpan; // Subuh
  G.score += Math.floor(G.rep * 0.5) + Math.floor((100 - G.fear) * 0.25) + G.caught * 25;
  G.perfect = !G.isTut && G.missed === 0 && G.falseReject === 0 && G.payMistakes === 0 && !G.left && !G.vanished && G.served > 0;
  if (G.perfect) G.score += 150;
  G.ev.push({ t: G.perfect ? 'perfect' : 'win' }); G.ending = endingOf(G);
}
function endLose(G, why) {
  if (G.over) return;
  G.over = true; G.won = false; G.loseWhy = why; G.phase = 'over'; G.ev.push({ t: 'lose' }); G.ending = endingOf(G);
}

/* Home-screen mode choice → never silently swapped. offerTut asks the player first. */
function startPlan(choice, seen, offered) {
  const mode = MODES[choice] ? choice : 'biasa';
  return { mode, offerTut: mode === 'biasa' && !seen && !offered };
}

function scoreOf(G) { return Math.max(0, Math.floor(G.score)); }
function clockLabel(G) {
  const sec = ((G.clock % 86400) + 86400) % 86400;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function payable(amount) { // greedy over visible denominations (canonical set)
  if (amount < 0) return false;
  let left = amount;
  for (let i = DENOMS.length - 1; i >= 0; i--) left -= Math.floor(left / DENOMS[i]) * DENOMS[i];
  return left === 0;
}

root.AM = {
  PRODUCTS, WEIRD, ANOMALIES, MODES, DENOMS, BILLS, TUT_STEPS, TUT_CUST, money, create, step, setInput, nearestCustomer, inReach, openInspect, cancelInspect, toggleMark, decide,
  confirmPay, addChange, clearChange, openRestock, selectProduct, closeRestock, fillSlot, scoreOf, clockLabel, stockRatio, stockCount, tip, fx, clamp,
  makeCustomer, backToInspect, mul, screenToWorld, tickFx, frontCustomer, atKasir, servable, kasirGate, KASIR, UNITS, NEAR, nearUnit, emptyUnit, unitEmpty, SOLIDS, blocked, queueSlot, DOOR, faceSig, wardSig, WARD, REACH, PR, evidence, observe, payable, startPlan, lessonText, tutSkip, tutAck, tutComplete, tutCur,
  inStore, curAct, buyFromShelf, FOLK, ENDINGS, endingOf
};
})(typeof window !== 'undefined' ? window : global);
