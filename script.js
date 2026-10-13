/* =====================================================================
   DATA SOAL TTS
   Setiap objek = satu "halaman" TTS.
   l = level (1-4), t = judul tema (ditampilkan di pita atas),
   w = daftar kata: [ [KATA, emoji_petunjuk], ... ]
   Total ada 16 halaman (4 level x 4 halaman).
   ===================================================================== */
const pages=[
{l:1,t:"Buah-buahan 🍎",w:[["MELON","🍈"],["APEL","🍎"],["ANGGUR","🍇"],["MANGGA","🥭"]]},
{l:1,t:"Hewan 🐱",w:[["HARIMAU","🐯"],["KUCING","🐱"],["GAJAH","🐘"],["KELINCI","🐰"]]},
{l:1,t:"Kendaraan 🚗",w:[["PESAWAT","✈️"],["KAPAL","🚢"],["KERETA","🚆"],["SEPEDA","🚲"]]},
{l:1,t:"Benda di Sekolah ✏️",w:[["PENGHAPUS","🧽"],["TAS","🎒"],["BUKU","📖"],["PENSIL","✏️"]]},
{l:2,t:"Makanan 🍩",w:[["NASI","🍚"],["DONAT","🍩"],["MIE","🍜"],["ROTI","🍞"],["SATE","🍢"]]},
{l:2,t:"Hewan Laut 🦀",w:[["UBURUBUR","🪼"],["KEPITING","🦀"],["CUMI","🦑"],["IKAN","🐟"],["PAUS","🐋"]]},
{l:2,t:"Benda di Rumah 🏠",w:[["LAMPU","💡"],["KURSI","🪑"],["MEJA","🍽️"],["PINTU","🚪"],["JENDELA","🪟"]]},
{l:2,t:"Alam 🌳",w:[["MATAHARI","☀️"],["POHON","🌳"],["GUNUNG","⛰️"],["AWAN","☁️"],["BULAN","🌙"]]},
{l:3,t:"Pekerjaan 👮",w:[["POLISI","👮"],["PERAWAT","👩‍⚕️"],["GURU","👩‍🏫"],["PETANI","👨‍🌾"],["KOKI","👨‍🍳"],["PILOT","👨‍✈️"]]},
{l:3,t:"Serangga 🦋",w:[["ULAT","🐛"],["NYAMUK","🦟"],["SEMUT","🐜"],["KUMBANG","🪲"],["LEBAH","🐝"],["LALAT","🪰"]]},
{l:3,t:"Anggota Tubuh 👃",w:[["HIDUNG","👃"],["RAMBUT","💇"],["TANGAN","✋"],["MATA","👁️"],["KAKI","🦶"],["TELINGA","👂"]]},
{l:3,t:"Warna 🎨",w:[["MERAH","🟥"],["COKLAT","🟫"],["HIJAU","🟩"],["BIRU","🟦"],["KUNING","🟨"],["PUTIH","⬜"]]},
{l:4,t:"Campuran 🧩",w:[["DOKTER","👨‍⚕️"],["KUCING","🐱"],["BUNGA","🌸"],["BUKU","📖"],["MOBIL","🚗"],["LAMPU","💡"],["APEL","🍎"],["IKAN","🐟"]]},
{l:4,t:"Campuran 🧩",w:[["SEPEDA","🚲"],["GUNUNG","⛰️"],["NASI","🍚"],["MATA","👁️"],["GAJAH","🐘"],["ROTI","🍞"],["PINTU","🚪"],["ULAT","🐛"]]},
{l:4,t:"Campuran 🧩",w:[["POLISI","👮"],["MANGGA","🥭"],["KURSI","🪑"],["KUMBANG","🪲"],["TAS","🎒"],["KAPAL","🚢"],["BIRU","🟦"],["AWAN","☁️"]]},
{l:4,t:"Campuran 🧩",w:[["PESAWAT","✈️"],["DONAT","🍩"],["HIDUNG","👃"],["POHON","🌳"],["GURU","👩‍🏫"],["MELON","🍈"],["SEMUT","🐜"],["TANGAN","✋"]]}
];

/* Shortcut ala jQuery: $("id") = document.getElementById("id") */
const $=id=>document.getElementById(id);

/* ---------- STATE GLOBAL APLIKASI ---------- */
let page=1;              // nomor halaman TTS yang sedang dimainkan (1-16)
let me={name:"",id:""};  // data pemain saat ini: nama tampilan & id unik
let done={};             // { nomorHalaman: poinYangDidapat } untuk halaman yang sudah selesai
let db=null;             // referensi database bersama (jika tersedia lewat window.claude "db")
let t0=Date.now();       // waktu mulai, dipakai untuk menghitung timer berjalan
const st={};             // cache state tiap halaman: { puz, vals, hints } per nomor halaman

/* Total skor = jumlah semua poin dari halaman yang sudah selesai */
const total=()=>Object.values(done).reduce((a,b)=>a+b,0);

/* Helper baca/tulis localStorage dengan try/catch (aman jika storage diblokir browser) */
function ls(k,v){
 try{
  if(v===undefined)return localStorage.getItem(k); // mode baca: ls("key")
  localStorage.setItem(k,v);                         // mode tulis: ls("key", value)
 }catch(e){return null}
}

/* =====================================================================
   GENERATOR TEKA-TEKI SILANG (deterministik)
   Semua pemain mendapat susunan TTS yang SAMA untuk halaman yang sama,
   karena posisi kata dihasilkan dari generator angka acak (rng) yang
   "seed"-nya tetap (berdasarkan nomor halaman), bukan Math.random().
   ===================================================================== */

/* rng(a): generator angka acak semu (pseudo-random) berbasis seed "a".
   Memanggil hasilnya berulang kali akan selalu menghasilkan urutan
   angka yang sama untuk seed yang sama (mutable-xorshift style). */
function rng(a){
 return()=>{
  a|=0;a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;
  return((t^t>>>14)>>>0)/4294967296
 }
}

/* tryBuild: satu kali percobaan menyusun semua kata dalam "words" ke
   dalam satu grid saling-silang (seperti TTS asli), memakai fungsi
   acak "rand" yang sudah diseed. Mengembalikan null jika gagal
   menempatkan salah satu kata (akan dicoba ulang oleh build()). */
function tryBuild(words,rand){
 const L=new Map();      // peta koordinat "baris,kolom" -> huruf yang sudah ditempati
 const A=new Set();      // set koordinat yang sudah dipakai kata MENDATAR (Across)
 const D=new Set();      // set koordinat yang sudah dipakai kata MENURUN (Down)
 const k=(r,c)=>r+","+c; // helper bikin kunci koordinat
 const pl=[];            // daftar kata yang berhasil ditempatkan: {word,r,c,d,clue}

 // urutkan kata dari yang terpanjang -> mempermudah penempatan awal
 const ord=[...words].sort((a,b)=>b[0].length-a[0].length);

 // put(): benar-benar menuliskan huruf kata w ke grid mulai (r,c), arah d (0=mendatar,1=menurun)
 const put=(w,r,c,d)=>{
  for(let i=0;i<w.length;i++){
   const y=r+(d?i:0),x=c+(d?0:i);
   L.set(k(y,x),w[i]);
   (d?D:A).add(k(y,x))
  }
 };

 // ok(): cek apakah kata w BOLEH ditempatkan di (r,c) arah d, dengan aturan:
 // - tidak boleh nempel langsung di depan/belakang kata lain (harus ada jarak)
 // - kalau bertumpuk dengan huruf yang sudah ada, hurufnya harus SAMA
 // - tidak boleh dua kata dengan arah sama saling menempel di sisi (harus lewat silangan)
 // - minimal harus ada satu persilangan (cross>0) dengan kata yang sudah ada
 const ok=(w,r,c,d)=>{
  let cross=0;
  const dr=d?1:0,dc=d?0:1; // arah pergerakan per huruf
  // cek sel tepat sebelum & sesudah kata tidak terisi (mencegah kata jadi lebih panjang secara tak sengaja)
  if(L.has(k(r-dr,c-dc))||L.has(k(r+dr*w.length,c+dc*w.length)))return false;
  for(let i=0;i<w.length;i++){
   const y=r+dr*i,x=c+dc*i,e=L.get(k(y,x));
   if(e){
    // sudah ada huruf di sini: harus sama, dan tidak boleh arah yang sama (baru persilangan valid)
    if(e!==w[i]||(d?D:A).has(k(y,x)))return false;
    cross++
   }else if(L.has(k(y+dc,x+dr))||L.has(k(y-dc,x-dr))){
    // sel kosong tapi bertetangga langsung (tegak lurus arah) dengan huruf lain -> tidak valid
    return false
   }
  }
  return cross>0 // wajib minimal 1 persilangan dengan kata sebelumnya
 };

 // Tempatkan kata pertama secara acak di posisi (0,0), arah mendatar
 let rest=ord.slice();
 const first=rest.splice(Math.floor(rand()*rest.length),1)[0];
 put(first[0],0,0,0);
 pl.push({word:first[0],r:0,c:0,d:0,clue:first[1]});

 // Tempatkan sisa kata satu per satu, mencari titik persilangan yang valid
 while(rest.length){
  let placed=false;
  // acak urutan kata yang dicoba supaya hasil susunan bervariasi
  for(const idx of rest.map((_,i)=>i).sort(()=>rand()-.5)){
   const w=rest[idx][0],cand=[]; // cand = daftar kandidat posisi valid untuk kata w
   // coba tiap arah (mendatar/menurun), cari huruf w yang cocok dengan huruf yang sudah ada di grid
   for(let d=0;d<2;d++)
    for(const[key,ch]of L){
     const[y,x]=key.split(",").map(Number);
     for(let i=0;i<w.length;i++)
      if(w[i]===ch){
       const r=y-(d?i:0),c=x-(d?0:i);
       if(ok(w,r,c,d))cand.push([r,c,d])
      }
    }
   if(cand.length){
    // pilih satu kandidat posisi secara acak, lalu tempatkan
    const[r,c,d]=cand[Math.floor(rand()*cand.length)];
    put(w,r,c,d);
    pl.push({word:w,r,c,d,clue:rest[idx][1]});
    rest.splice(idx,1);
    placed=true;
    break
   }
  }
  if(!placed)return null // tidak ada kata yang bisa ditempatkan -> percobaan ini gagal
 }

 // Hitung batas grid (bounding box) dari semua koordinat yang terisi,
 // lalu geser semua koordinat supaya mulai dari (0,0)
 const ys=[...L.keys()].map(s=>+s.split(",")[0]),xs=[...L.keys()].map(s=>+s.split(",")[1]);
 const r0=Math.min(...ys),c0=Math.min(...xs),H=Math.max(...ys)-r0+1,W=Math.max(...xs)-c0+1;
 const grid=Array.from({length:H},()=>Array(W).fill(null));
 L.forEach((v,key)=>{const[y,x]=key.split(",").map(Number);grid[y-r0][x-c0]=v});
 pl.forEach(p=>{p.r-=r0;p.c-=c0});

 // Beri nomor urut pada setiap kata (dibaca dari kiri-atas ke kanan-bawah),
 // sel yang jadi titik awal >1 kata akan punya lebih dari satu nomor (mis. "3/5")
 pl.sort((a,b)=>a.r-b.r||a.c-b.c||a.d-b.d);
 const nums={};let n=0;
 pl.forEach(p=>{
  const key=p.r+","+p.c;
  (nums[key]=nums[key]||[]).push(p.num=++n)
 });

 return{grid,pl,nums}
}

/* build(p): mencoba tryBuild() sampai 600 kali dengan seed berbeda-beda,
   lalu memilih hasil dengan "skor kerapian" terbaik (sc), supaya bentuk
   grid TTS tidak terlalu memanjang/aneh dan persilangan kata cukup merata. */
function build(p){
 let best=null,bs=-1e9;
 for(let s=0;s<600;s++){
  const r=tryBuild(pages[p-1].w,rng(p*1000+s)); // seed unik per halaman & percobaan
  if(!r)continue;
  const P=r.pl;
  // set koordinat sel yang ditempati tiap kata, untuk menghitung persilangan antar kata
  const cells=P.map(w=>new Set(Array.from({length:w.word.length},(_,i)=>(w.r+(w.d?i:0))+","+(w.c+(w.d?0:i)))));
  // deg[i] = berapa banyak kata lain yang bersilangan dengan kata ke-i
  const deg=P.map((_,i)=>P.reduce((a,_,j)=>a+(i!==j&&[...cells[i]].some(k=>cells[j].has(k))?1:0),0));
  const nA=P.filter(w=>!w.d).length,nD=P.length-nA; // jumlah kata mendatar vs menurun
  const H=r.grid.length,W=r.grid[0].length,ratio=Math.max(H,W)/Math.min(H,W); // rasio panjang:lebar grid
  // Rumus skor: makin seimbang mendatar/menurun, makin banyak persilangan merata,
  // makin kecil & makin persegi grid-nya -> skor makin tinggi (lebih baik)
  const sc=-Math.abs(nA-nD)*5-Math.max(...deg)*4+deg.filter(x=>x>=2).length*2-H*W/20-ratio*2;
  if(sc>bs){bs=sc;best=r}
 }
 return best
}

/* S(p): ambil (atau buat baru bila belum ada) state halaman p, berisi:
   - puz: hasil build() (grid + daftar kata + nomor)
   - vals: jawaban yang sudah diketik pemain di halaman ini (belum tentu benar)
   - hints: jumlah petunjuk yang sudah dipakai di halaman ini */
const S=p=>st[p]||(st[p]={puz:build(p),vals:{},hints:0});

/* =====================================================================
   NAVIGASI LAYAR & HALAMAN
   ===================================================================== */

/* Tampilkan satu layar (id="home" atau id="game"), sembunyikan yang lain */
function show(id){
 document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));
 $(id).classList.add("active")
}

/* Kembali ke beranda: hentikan timer & perbarui progres level sebelum ditampilkan */
function home(){stopTimer();prog();show("home")}

/* Tombol "Sebelumnya": hanya aktif jika bukan halaman pertama dalam level (page%4!==1) */
function pv(){if(page%4!==1)go(page-1)}
/* Tombol "Berikutnya": jika halaman ke-4 (terakhir) dalam level, kembali ke beranda; selain itu lanjut */
function nx(){if(page%4===0)home();else go(page+1)}

/* unlocked(l): level 1 selalu terbuka; level lain terbuka hanya jika
   SEMUA 4 halaman level sebelumnya sudah selesai (done) */
const unlocked=l=>l===1||[1,2,3,4].every(i=>done[(l-2)*4+i]);

/* prog(): perbarui tampilan status tiap level di beranda
   (kunci/tidak terkunci, jumlah halaman yang sudah selesai) */
function prog(){
 for(let l=1;l<=4;l++){
  let n=0;
  for(let i=1;i<=4;i++)if(done[(l-1)*4+i])n++;
  const u=unlocked(l);
  document.querySelector(".level.l"+l).classList.toggle("locked",!u);
  $("lp"+l).textContent=u
   ?n+"/4 selesai • "+[4,5,6,8][l-1]+" gambar"
   :"🔒 Terkunci • selesaikan Level "+(l-1)
 }
}

/* Tampilkan notifikasi kecil (toast) selama 3.5 detik lalu hilang otomatis */
function toast(m){
 const t=$("toast");
 t.textContent=m;
 t.classList.add("show");
 clearTimeout(toast.t);
 toast.t=setTimeout(()=>t.classList.remove("show"),3500)
}

/* start(): dipanggil saat tombol "Mulai Bermain" ditekan.
   - Validasi nama tidak kosong
   - Buat id unik dari nama (huruf kecil, tanpa spasi/simbol)
   - Muat progres (done) dari localStorage, digabung dengan data server bila ada
   - Mulai timer & masuk ke halaman pertama yang belum diselesaikan */
async function start(){
 const n=$("nameIn").value.trim().slice(0,16);
 if(!n){$("nameIn").focus();return}
 me.name=n;
 me.id="p_"+(n.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,24)||"anon");
 ls("lc_name",n); // ingat nama untuk kunjungan berikutnya
 $("who").textContent=n;

 done={};
 try{done=JSON.parse(ls("lc_done_"+me.id)||"{}")}catch(e){}

 // Jika ada koneksi database bersama, gabungkan progres dari server (data lokal tetap diutamakan)
 if(db){
  try{
   const s=await db.doc("scores/"+me.id).get(),d=s.data();
   if(d&&d.pages)done={...d.pages,...done}
  }catch(e){}
 }

 t0=Date.now();
 $("score").textContent=total();
 prog();
 // masuk ke halaman pertama yang belum selesai (kecuali semua 16 sudah selesai -> mulai dari 1)
 enter(Object.keys(done).length<16?firstOpen():1)
}

/* Cari nomor halaman pertama (1-16) yang belum ditandai selesai */
function firstOpen(){for(let i=1;i<=16;i++)if(!done[i])return i;return 1}

/* enter(n): dipanggil saat pemain klik kartu level atau titik halaman.
   Cek nama sudah diisi & level sudah terbuka sebelum benar-benar masuk. */
function enter(n){
 if(!me.name){$("nameIn").focus();$("mode").textContent="Isi nama dulu ya 🙂";return}
 const L=Math.floor((n-1)/4)+1;
 if(!unlocked(L)){toast("🔒 Selesaikan Level "+(L-1)+" dulu untuk membuka Level "+L+"!");return}
 startTimer();
 go(n)
}

/* go(n): pindah ke halaman n (dibatasi 1-16), tampilkan layar game, lalu render ulang */
function go(n){page=Math.max(1,Math.min(16,n));show("game");render()}

/* =====================================================================
   RENDER TAMPILAN HALAMAN TTS
   Fungsi ini membangun ulang seluruh isi layar game: judul, tema warna,
   dekorasi, titik navigasi halaman, grid kotak TTS, dan kartu petunjuk.
   ===================================================================== */
function render(){
 const d=pages[page-1],s=S(page),g=s.puz.grid;

 // Label level & nomor halaman di kotak nama
 $("levelLabel").textContent=["","🟢 Level 1","🔵 Level 2","🟠 Level 3","🟣 Level 4"][d.l]+" • Halaman "+((page-1)%4+1)+"/4";
 $("prevBtn").disabled=page%4===1; // tombol "Sebelumnya" nonaktif di halaman pertama level
 $("nextBtn").textContent=page%4===0?"⌂ Selesai":"Berikutnya →"; // ganti label di halaman terakhir level
 $("title").textContent=d.t;

 // Palet warna tema (per level), diterapkan lewat CSS variable --th/--th2/--th3
 const th=[0,
  ["#bff0e4","#8edcc9","#2f9c82"], // level 1: hijau mint
  ["#c8e2ff","#8fc0f5","#3f86d0"], // level 2: biru
  ["#ffdcb8","#f5b877","#d9782a"], // level 3: oranye
  ["#dccbff","#b99af0","#7f55c9"]  // level 4: ungu
 ][d.l];
 const sh=$("sheet");
 sh.style.setProperty("--th",th[0]);
 sh.style.setProperty("--th2",th[1]);
 sh.style.setProperty("--th3",th[2]);
 $("pname").textContent=me.name||"........";

 // Posisi (persen) 8 titik dekorasi di sekeliling lembar kertas
 const P=[[-3,-3],[90,-3],[-3,45],[91,44],[-3,91],[90,91],[45,93],[47,-4]];
 $("decor").replaceChildren(...P.map((q,i)=>{
  const e=document.createElement("span");
  // emoji dekorasi diambil dari daftar petunjuk gambar (diulang jika jumlah kata < 8)
  e.textContent=s.puz.pl[i%s.puz.pl.length].clue;
  e.style.cssText=`left:${q[0]}%;top:${q[1]}%;transform:rotate(${(i*37%40)-20}deg)`;
  return e
 }));

 // Titik-titik navigasi 4 halaman dalam level ini (hijau=selesai, ungu=aktif)
 $("dots").replaceChildren(...Array.from({length:4},(_,i)=>{
  const n=Math.floor((page-1)/4)*4+i+1;
  const b=document.createElement("button");
  b.className="dot"+(n===page?" on":"")+(done[n]?" done":"");
  b.textContent=i+1;
  b.onclick=()=>go(n);
  return b
 }));

 // Hitung ukuran sel (--cs) berdasarkan lebar layar yang tersedia, supaya grid tidak melebar keluar layar
 const cr=$("cross");
 const av=innerWidth<=900?Math.min(innerWidth-80,560):470;
 cr.style.setProperty("--cs",Math.max(26,Math.min(52,Math.floor(av/g[0].length)))+"px");
 cr.style.gridTemplateColumns=`repeat(${g[0].length},var(--cs))`;
 cr.replaceChildren();

 // Bangun setiap sel grid TTS
 g.forEach((row,r)=>row.forEach((ch,c)=>{
  const cell=document.createElement("div");
  cell.className="cell";
  if(!ch){
   // sel kosong/tidak dipakai kata manapun -> jadi sel "blok" gelap
   cell.className="cell block"
  }else{
   const key=r+","+c,inp=document.createElement("input");
   inp.maxLength=1;
   inp.dataset.a=ch;          // jawaban benar untuk sel ini (huruf), dipakai saat check()/hint()
   inp.dataset.k=key;         // kunci koordinat, dipakai untuk menyimpan nilai ke s.vals
   inp.dataset.r=r;inp.dataset.c=c;
   inp.autocomplete="off";inp.inputMode="text";
   // isi otomatis dengan jawaban benar jika halaman sudah selesai, kalau belum pakai isian tersimpan
   inp.value=done[page]?ch:(s.vals[key]||"");
   if(done[page])inp.style.background="#e5faef"; // hijau muda: halaman sudah tuntas

   // Saat mengetik: hanya terima huruf, otomatis huruf besar, simpan ke state, lalu pindah ke sel berikut
   inp.oninput=e=>{
    const v=e.target.value.replace(/[^a-zA-Z]/g,"").toUpperCase();
    e.target.value=v.slice(-1);
    s.vals[key]=e.target.value;
    if(v)advance(r,c)
   };
   inp.onkeydown=e=>arrow(e,r,c); // navigasi pakai tombol panah/backspace/enter
   inp.onfocus=()=>{setDir(r,c);hl(r,c);inp.select()}; // saat fokus: tentukan arah kata & sorot
   // deteksi klik ulang pada sel yang sama -> dipakai untuk mengganti arah (mendatar<->menurun)
   inp.onpointerdown=()=>{lastK=document.activeElement===inp?r+","+c:null};
   inp.onclick=()=>{
    if(lastK===r+","+c&&wordAt(r,c,0)&&wordAt(r,c,1)){dir^=1;hl(r,c)}
   };

   // tampilkan nomor kata di pojok sel bila sel ini adalah awal satu/lebih kata
   if(s.puz.nums[key]){
    const n=document.createElement("span");
    n.className="num";
    n.textContent=s.puz.nums[key].join("/"); // contoh "3/5" jika 2 kata mulai di sel yang sama
    cell.appendChild(n)
   }
   cell.appendChild(inp)
  }
  cr.appendChild(cell)
 }));

 // Bangun kartu-kartu petunjuk gambar, dibagi rata ke kolom kiri & kanan
 const cL=$("cluesL"),cR=$("cluesR");
 cL.replaceChildren();cR.replaceChildren();
 const arr=s.puz.pl.slice().sort((a,b)=>a.num-b.num||a.d-b.d);
 arr.forEach((p,i)=>{
  const c=document.createElement("div");
  c.className="pic";
  c.dataset.k=p.num+"_"+p.d; // kunci untuk mencocokkan dengan sorot sel (hl())
  const b=document.createElement("span");
  b.className="b";
  b.textContent=p.num+(p.d?"⬇":"➡"); // badge nomor + arah kata
  const e=document.createElement("div");
  e.className="e";
  e.textContent=p.clue; // emoji petunjuk gambar
  const m=document.createElement("small");
  m.textContent=p.word.length+" huruf";
  c.append(b,e,m);
  (i<Math.ceil(arr.length/2)?cL:cR).appendChild(c) // separuh pertama -> kiri, sisanya -> kanan
 });

 // Tampilkan pesan "sudah selesai" jika halaman ini sudah pernah dituntaskan
 fb(done[page]?"🎉 TTS ini sudah selesai! (+"+done[page]+" poin)":"","success")
}

/* Set teks & jenis (success/error/kosong) pada area feedback */
const fb=(t,c)=>{$("feedback").textContent=t;$("feedback").className="feedback "+(c||"")};

/* Cari elemen <input> pada koordinat (r,c) tertentu di grid */
const cellAt=(r,c)=>document.querySelector(`#cross input[data-r="${r}"][data-c="${c}"]`);

let dir=0;      // arah kata yang sedang aktif: 0 = mendatar, 1 = menurun
let lastK=null; // koordinat sel yang terakhir diklik (untuk deteksi klik ganda -> ganti arah)

/* wordAt(r,c,d): cari objek kata (dari puzzle) yang melewati sel (r,c) pada arah d */
const wordAt=(r,c,d)=>S(page).puz.pl.find(p=>
 p.d===d&&(d
  ?p.c===c&&r>=p.r&&r<p.r+p.word.length   // kata menurun: kolom sama, baris dalam rentang panjang kata
  :p.r===r&&c>=p.c&&c<p.c+p.word.length)  // kata mendatar: baris sama, kolom dalam rentang panjang kata
);

/* Tentukan arah default saat sel difokus: kalau sel hanya bagian dari
   satu arah (mendatar saja / menurun saja), pakai arah itu */
function setDir(r,c){
 const a=wordAt(r,c,0),b=wordAt(r,c,1);
 if(a&&!b)dir=0;else if(b&&!a)dir=1
}

/* Sorot (highlight) semua sel & kartu petunjuk milik kata yang sedang aktif */
function hl(r,c){
 document.querySelectorAll(".cell.hl,.pic.hl").forEach(x=>x.classList.remove("hl"));
 const w=wordAt(r,c,dir);
 if(!w)return;
 for(let i=0;i<w.word.length;i++){
  const n=cellAt(w.r+(dir?i:0),w.c+(dir?0:i));
  if(n)n.parentElement.classList.add("hl")
 }
 document.querySelectorAll(".pic").forEach(p=>{
  if(p.dataset.k===w.num+"_"+w.d)p.classList.add("hl")
 })
}

/* Setelah mengetik satu huruf, otomatis pindah fokus ke sel berikutnya dalam kata yang sama */
function advance(r,c){
 const w=wordAt(r,c,dir);
 if(!w)return;
 const i=dir?r-w.r:c-w.c;
 if(i<w.word.length-1){
  const n=cellAt(r+(dir?1:0),c+(dir?0:1));
  if(n)n.focus()
 }
}

/* Navigasi keyboard: panah untuk pindah sel (sekaligus menentukan arah),
   Backspace pada sel kosong mundur ke sel sebelumnya dalam kata yang sama,
   Enter langsung memicu pemeriksaan jawaban (check()) */
function arrow(e,r,c){
 const m={ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0]}[e.key];
 if(m){
  const n=cellAt(r+m[0],c+m[1]);
  dir=m[0]?1:0; // panah atas/bawah -> arah menurun, kiri/kanan -> arah mendatar
  if(n){n.focus();e.preventDefault()}else hl(r,c)
 }else if(e.key==="Backspace"&&!e.target.value){
  const w=wordAt(r,c,dir);
  if(w&&(dir?r>w.r:c>w.c)){
   const n=cellAt(r-(dir?1:0),c-(dir?0:1));
   if(n){n.focus();e.preventDefault()}
  }
 }else if(e.key==="Enter")check()
}

/* =====================================================================
   AKSI PEMAIN: PERIKSA, PETUNJUK, ULANG, TIMER
   ===================================================================== */

/* check(): periksa semua isian di grid.
   - Jika ada kotak kosong -> tampilkan pesan error jumlah kotak kosong
   - Jika ada huruf salah -> tandai merah & tampilkan pesan error
   - Jika semua benar & halaman belum pernah selesai -> hitung poin,
     simpan progres, tampilkan efek confetti, cek apakah level selesai */
function check(){
 const ins=[...document.querySelectorAll("#cross input")];
 let w=0,e=0; // w = jumlah huruf salah, e = jumlah kotak kosong
 ins.forEach(i=>{
  const v=i.value.toUpperCase();
  if(!v)e++;
  else if(v!==i.dataset.a){w++;i.style.background="#ffe7e7"} // merah muda: salah
  else i.style.background="#e5faef" // hijau muda: benar
 });
 if(e)return fb(`Masih ada ${e} kotak kosong. Coba lagi!`,"error");
 if(w)return fb(`Ada ${w} huruf yang belum tepat. Periksa petunjuknya!`,"error");

 if(!done[page]){
  // poin dasar 10, dikurangi 2 untuk tiap petunjuk yang dipakai, minimal 4
  const pts=Math.max(4,10-2*S(page).hints);
  done[page]=pts;
  $("score").textContent=total();
  save();
  celebrate();
  // cek apakah 4 halaman dalam level ini baru saja lengkap semua -> beri notifikasi level terbuka
  const L0=Math.floor((page-1)/4)*4;
  if(page<16&&[1,2,3,4].every(i=>done[L0+i]))
   toast("🎉 Level "+(L0/4+1)+" selesai! Level "+(L0/4+2)+" terbuka!")
 }
 render() // render ulang untuk menampilkan status "selesai"
}

/* hint(): buka satu huruf yang masih salah/kosong secara otomatis.
   Tidak bisa dipakai jika halaman sudah selesai. Menambah hitungan
   hints (mengurangi poin maksimal yang bisa didapat di halaman ini). */
function hint(){
 if(done[page])return;
 const s=S(page);
 const t=[...document.querySelectorAll("#cross input")].find(i=>i.value.toUpperCase()!==i.dataset.a);
 if(!t)return fb("Semua huruf sudah benar!","success");
 t.value=t.dataset.a;
 s.vals[t.dataset.k]=t.value;
 s.hints++;
 t.style.background="#fff4c7"; // kuning: sel hasil petunjuk
 t.focus();
 fb("💡 Satu huruf dibantu (−2 poin di halaman ini).","")
}

/* reset(): kosongkan semua isian di halaman ini (tidak bisa dipakai
   jika halaman sudah pernah diselesaikan) */
function reset(){
 if(done[page])return;
 const s=S(page);
 s.vals={};
 render()
}

/* ---------- TIMER BERMAIN ---------- */
let tmr=null;
function tick(){
 const s=Math.floor((Date.now()-t0)/1000);
 $("timer").textContent=String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")
}
function startTimer(){t0=Date.now();clearInterval(tmr);tmr=setInterval(tick,1000);tick()}
function stopTimer(){clearInterval(tmr);tmr=null}

/* celebrate(): efek confetti — membuat 26 emoji jatuh dari atas layar
   dengan posisi & delay acak, lalu menghapusnya setelah animasi selesai */
function celebrate(){
 for(let i=0;i<26;i++){
  const s=document.createElement("span");
  s.className="cf";
  s.textContent=["🎉","⭐","🎈","✨","🌟"][i%5];
  s.style.left=Math.random()*95+"%";
  s.style.animationDelay=Math.random()*.8+"s";
  document.body.appendChild(s);
  setTimeout(()=>s.remove(),3500)
 }
}

/* =====================================================================
   PENYIMPANAN SKOR
   Skor disimpan bersama lewat database (jika tersedia lewat window.claude),
   jika tidak tersedia/izin ditolak, disimpan lokal di perangkat (localStorage)
   ===================================================================== */

/* save(): simpan progres halaman & skor total, baik ke localStorage
   (selalu) maupun ke database bersama (jika ada koneksi db) */
async function save(){
 ls("lc_done_"+me.id,JSON.stringify(done)); // progres per-halaman disimpan lokal

 const rec={name:me.name,score:total(),solved:Object.keys(done).length,pages:done,updated:Date.now()};

 if(db){
  try{
   await db.doc("scores/"+me.id).set(rec) // simpan ke papan skor bersama
  }catch(e){
   $("mode").textContent="Skor hanya tersimpan di perangkat ini (tidak punya izin menulis papan skor bersama)."
  }
 }else{
  // tanpa db: simpan papan skor gabungan semua pemain (di perangkat ini saja) ke localStorage
  let b={};
  try{b=JSON.parse(ls("lc_board")||"{}")}catch(e){}
  b[me.id]=rec;
  ls("lc_board",JSON.stringify(b));
  drawBoard(Object.values(b))
 }
}

/* drawBoard(rows): render tabel papan skor, urut skor tertinggi dulu
   (jika skor sama, yang lebih dulu update yang di atas), maksimal 20 baris */
function drawBoard(rows){
 rows=rows.sort((a,b)=>b.score-a.score||a.updated-b.updated).slice(0,20);
 const tb=$("board");
 tb.replaceChildren();
 if(!rows.length){
  tb.innerHTML='<tr><td colspan="4" class="note">Belum ada skor. Jadilah yang pertama!</td></tr>';
  return
 }
 rows.forEach((r,i)=>{
  const tr=document.createElement("tr");
  if(r.name===me.name)tr.className="me"; // sorot baris milik pemain saat ini
  [i+1,r.name,r.score,(r.solved||0)+"/16"].forEach(v=>{
   const td=document.createElement("td");
   td.textContent=v;
   tr.appendChild(td)
  });
  tb.appendChild(tr)
 })
}

/* =====================================================================
   INISIALISASI SAAT HALAMAN DIMUAT (Immediately Invoked Function)
   - Isi kembali nama pemain terakhir (jika ada) ke input nama
   - Gambar papan skor dari localStorage sebagai tampilan awal
   - Coba sambungkan ke database bersama ("db") lewat window.claude;
     jika berhasil, papan skor akan live-update untuk semua pemain;
     jika gagal/tidak tersedia, tetap pakai mode lokal per perangkat
   ===================================================================== */
(async()=>{
 const n=ls("lc_name");
 if(n)$("nameIn").value=n;

 let b=[];
 try{b=Object.values(JSON.parse(ls("lc_board")||"{}"))}catch(e){}
 drawBoard(b);

 try{
  const c=window.claude&&await window.claude.use("db");
  if(c){
   db=c;
   // dengarkan perubahan papan skor bersama secara real-time (onSnapshot)
   db.collection("scores").orderBy("score","desc").limit(20)
    .onSnapshot(s=>drawBoard(s.docs.map(d=>d.data())),()=>{db=null});
   $("mode").textContent="🌐 Papan skor bersama aktif — semua pemain terlihat langsung."
  }else{
   $("mode").textContent="Mode perangkat ini: papan skor tersimpan di browser."
  }
 }catch(e){
  $("mode").textContent="Mode perangkat ini: papan skor tersimpan di browser."
 }
})();

prog(); // tampilkan status level (terkunci/terbuka) segera saat halaman dimuat
