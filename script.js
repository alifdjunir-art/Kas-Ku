/* script.js - Sinkronisasi Google Apps Script Live */

// URL RESMI APPS SCRIPT
const SPREADSHEET_API_URL = "https://script.google.com/macros/s/AKfycbwTzFEf92B3bV2yrxnyx6-TZllgE_GoViY3rtUX3g7jaaq7Wpa5Js6m2z-SDTbRh36f/exec"; 

// DAFTAR NIM ADMIN / BENDAHARA
const LIST_NIM_ADMIN = [
  "2506894" // Alif Djuni Rirtono (Ketua Kelas)
];

// DAFTAR PERIODE BULAN (14 BULAN: 2 BULAN 2025 + 12 BULAN 2026)
const BULAN_LIST = [
  "Oktober 2025", 
  "November 2025", 
  "Januari 2026", 
  "Februari 2026", 
  "Maret 2026", 
  "April 2026", 
  "Mei 2026", 
  "Juni 2026",
  "Juli 2026", 
  "Agustus 2026", 
  "September 2026", 
  "Oktober 2026", 
  "November 2026", 
  "Desember 2026"
];

// Database State
let dbKasSiswa = JSON.parse(localStorage.getItem('kasku_kas_siswa')) || [];
let dbRekapKas = JSON.parse(localStorage.getItem('kasku_rekap_kas')) || [];
let dbPengumuman = JSON.parse(localStorage.getItem('kasku_pengumuman')) || [];
let dbVerifikasi = JSON.parse(localStorage.getItem('kasku_verifikasi')) || [];

let currentUser = null;
let tempUploadedImageBase64 = null;

// ==================== FETCH GOOGLE APPS SCRIPT ====================
async function sinkronDataDariSPS(showNotif = false) {
  const icon = document.getElementById('btnRefreshIcon');
  if (icon) icon.classList.add('animate-spin');

  if (showNotif) {
    showToast('Menghubungkan ke Data Terbaru...', 'info');
  }

  try {
    const timeStamp = new Date().getTime();

    // 1. Ambil data Kas_Siswa
    const resSiswa = await fetch(`${SPREADSHEET_API_URL}?sheet=Kas_Siswa&t=${timeStamp}`);
    const dataSiswa = await resSiswa.json();
    if (Array.isArray(dataSiswa) && dataSiswa.length > 0) {
      dbKasSiswa = dataSiswa;
      localStorage.setItem('kasku_kas_siswa', JSON.stringify(dbKasSiswa));
    }

    // 2. Ambil data Rekap_Kas
    const resRekap = await fetch(`${SPREADSHEET_API_URL}?sheet=Rekap_Kas&t=${timeStamp}`);
    const dataRekap = await resRekap.json();
    if (Array.isArray(dataRekap) && dataRekap.length > 0) {
      dbRekapKas = dataRekap;
      localStorage.setItem('kasku_rekap_kas', JSON.stringify(dbRekapKas));
    }

    // 3. Ambil data Pengumuman
    try {
      const resInfo = await fetch(`${SPREADSHEET_API_URL}?sheet=Pengumuman&t=${timeStamp}`);
      const dataInfo = await resInfo.json();
      if (Array.isArray(dataInfo)) {
        dbPengumuman = dataInfo;
        localStorage.setItem('kasku_pengumuman', JSON.stringify(dbPengumuman));
        renderPengumuman();
      }
    } catch (eInfo) {
      console.warn("Sheet Pengumuman belum ada atau gagal dimuat:", eInfo);
    }

    if (currentUser) {
      const currentNimStr = String(currentUser.nim || '').replace(/\D/g, '');
      const updatedUser = dbKasSiswa.find(u => String(u.nim || '').replace(/\D/g, '') === currentNimStr);
      if (updatedUser) {
        currentUser = { ...currentUser, ...updatedUser };
        currentUser.isAdmin = LIST_NIM_ADMIN.includes(currentNimStr);
        localStorage.setItem('kasku_active_session', JSON.stringify(currentUser));
      }
      renderKasSaya();
      renderRincianKasKelas();
      if (currentUser.isAdmin) renderAdminPanel();
    }

    if (showNotif) {
      showToast('Data berhasil diperbarui!', 'success');
    }
  } catch (err) {
    console.error("Gagal sinkron Apps Script:", err);
    if (showNotif) {
      showToast('Gagal memuat data terbaru. Cek internet.', 'error');
    }
  } finally {
    if (icon) {
      setTimeout(() => icon.classList.remove('animate-spin'), 500);
    }
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();

  const session = localStorage.getItem('kasku_active_session');
  if (session) {
    currentUser = JSON.parse(session);
    loadDashboard();
  }

  await sinkronDataDariSPS(false);
});

// ==================== SISTEM LOGIN ====================
async function handleLogin(e) {
  e.preventDefault();
  const nimInput = document.getElementById('loginNim').value.trim();
  const passInput = document.getElementById('loginPassword').value.trim();

  if (!nimInput || !passInput) {
    showToast('Harap isi NIM dan Kata Sandi!', 'error');
    return;
  }

  if (!dbKasSiswa || dbKasSiswa.length === 0) {
    showToast('Sedang mengambil data kelas...', 'info');
    await sinkronDataDariSPS(false);
  }

  const cleanInputNim = nimInput.replace(/\D/g, '');
  const user = dbKasSiswa.find(u => String(u.nim || '').replace(/\D/g, '') === cleanInputNim);

  if (!user) {
    showToast('NIM tidak ditemukan di data kelas!', 'error');
    return;
  }

  if (String(user.pw || '').trim() !== passInput) {
    showToast('Kata sandi salah!', 'error');
    return;
  }

  user.isAdmin = LIST_NIM_ADMIN.includes(cleanInputNim);
  currentUser = user;
  localStorage.setItem('kasku_active_session', JSON.stringify(currentUser));
  showToast(`Selamat datang, ${currentUser.panggilan || currentUser.nama}!`, 'success');
  loadDashboard();
}

function logout() {
  localStorage.removeItem('kasku_active_session');
  currentUser = null;
  document.getElementById('viewDashboard').classList.add('hidden');
  document.getElementById('viewLogin').classList.remove('hidden');
  document.getElementById('loginNim').value = '';
  document.getElementById('loginPassword').value = '';
  showToast('Berhasil keluar.', 'info');
  lucide.createIcons();
}

// ==================== DASHBOARD UTAMA ====================
function loadDashboard() {
  const currentNimStr = String(currentUser.nim || '').replace(/\D/g, '');
  currentUser = dbKasSiswa.find(u => String(u.nim || '').replace(/\D/g, '') === currentNimStr) || currentUser;
  currentUser.isAdmin = LIST_NIM_ADMIN.includes(currentNimStr);

  document.getElementById('viewLogin').classList.add('hidden');
  document.getElementById('viewDashboard').classList.remove('hidden');

  document.getElementById('navUserName').textContent = currentUser.nama;
  document.getElementById('navUserRole').textContent = currentUser.isAdmin ? 'Admin / Ketua' : 'Mahasiswa';
  document.getElementById('heroNama').textContent = currentUser.panggilan || currentUser.nama;

  const btnAdmin = document.getElementById('tabBtn-admin');
  const btnAdminMobile = document.getElementById('tabBtnMobile-admin');
  const btnAddInfo = document.getElementById('btnAdminAddInfo');

  if (currentUser.isAdmin) {
    if (btnAdmin) btnAdmin.classList.remove('hidden');
    if (btnAdminMobile) btnAdminMobile.classList.remove('hidden');
    if (btnAddInfo) btnAddInfo.classList.remove('hidden');
  } else {
    if (btnAdmin) btnAdmin.classList.add('hidden');
    if (btnAdminMobile) btnAdminMobile.classList.add('hidden');
    if (btnAddInfo) btnAddInfo.classList.add('hidden');
  }

  renderPengumuman();
  renderKasSaya();
  renderRincianKasKelas();
  
  if (currentUser.isAdmin) {
    renderAdminPanel();
  }

  switchTab('beranda');
  lucide.createIcons();
}

async function switchTab(tabName) {
  if (tabName === 'admin' && (!currentUser || !currentUser.isAdmin)) {
    showToast('Akses ditolak! Menu ini khusus Admin/Bendahara.', 'error');
    tabName = 'beranda';
  }

  ['beranda', 'bayarkas', 'rekap', 'admin'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.classList.add('hidden');
    const btn = document.getElementById(`tabBtn-${t}`);
    if (btn) btn.className = 'tab-btn px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 text-teal-200/70 hover:text-white';
  });

  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.remove('hidden');

  const activeBtn = document.getElementById(`tabBtn-${tabName}`);
  if (activeBtn) {
    activeBtn.className = (tabName === 'admin')
      ? 'tab-btn px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 bg-amber-500 text-slate-900 shadow-xs'
      : 'tab-btn px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white shadow-xs';
  }
  lucide.createIcons();

  await sinkronDataDariSPS(false);
}

// ==================== 1. BERANDA & MADING INFO ====================
function renderPengumuman() {
  const container = document.getElementById('containerPengumuman');
  if (!container) return;
  container.innerHTML = '';

  if (!dbPengumuman || dbPengumuman.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center col-span-full">Belum ada pengumuman kelas terbaru.</p>';
    return;
  }

  dbPengumuman.forEach((p, idx) => {
    const adaFoto = p.foto && String(p.foto).trim().length > 10;
    const card = document.createElement('div');
    card.className = 'bg-[#0c2333] p-5 rounded-3xl border border-teal-500/20 shadow-xs flex flex-col justify-between';
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">${p.kategori || 'Info'}</span>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-slate-400">${p.tanggal || ''}</span>
            ${currentUser && currentUser.isAdmin ? `
              <button onclick="hapusInfo(${p.id || idx})" title="Hapus Pengumuman Ini" class="text-rose-400 hover:text-rose-300 transition">
                <i data-lucide="trash" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        </div>
        <h4 class="text-sm font-bold text-slate-100 mb-1">${p.judul}</h4>
        <p class="text-xs text-slate-300 line-clamp-3 leading-relaxed">${p.isi}</p>
      </div>

      <div class="pt-3 mt-3 border-t border-teal-500/10 flex items-center justify-between text-[11px] text-teal-300/60">
        <div>Oleh: <strong class="text-teal-200">${p.penulis || 'Admin'}</strong></div>
        ${adaFoto ? `
          <button type="button" onclick="bukaModalFoto('${p.foto}', '${(p.judul || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 text-cyan-300 rounded-lg text-[10px] font-bold border border-cyan-500/30 flex items-center gap-1 transition cursor-pointer">
            <i data-lucide="image" class="w-3 h-3 text-cyan-400"></i>
            <span>Lihat Foto</span>
          </button>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });
  lucide.createIcons();
}

function bukaModalFoto(urlFoto, judul) {
  const modal = document.getElementById('modalDokumentasiPengumuman');
  const img = document.getElementById('imgDokumentasiPreview');
  const labelJudul = document.getElementById('modalFotoJudul');

  if (modal && img) {
    img.src = urlFoto;
    if (labelJudul) labelJudul.textContent = judul || 'Dokumentasi';
    modal.classList.remove('hidden');
    lucide.createIcons();
  }
}

function tutupModalFoto() {
  const modal = document.getElementById('modalDokumentasiPengumuman');
  if (modal) {
    modal.classList.add('hidden');
    const img = document.getElementById('imgDokumentasiPreview');
    if (img) img.src = '';
  }
}

function openModalTambahInfo() { document.getElementById('modalTambahInfo').classList.remove('hidden'); }
function closeModalTambahInfo() { document.getElementById('modalTambahInfo').classList.add('hidden'); }

async function handleSimpanInfo(e) {
  e.preventDefault();
  showToast('Mengunggah pengumuman...', 'info');

  const fileInput = document.getElementById('infoFileFoto');
  let fotoBase64 = "";

  if (fileInput && fileInput.files && fileInput.files[0]) {
    fotoBase64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.readAsDataURL(fileInput.files[0]);
    });
  }

  const payload = {
    action: "tambah",
    id: Date.now(),
    judul: document.getElementById('infoJudul').value.trim(),
    kategori: document.getElementById('infoKategori').value,
    tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    penulis: currentUser.panggilan || currentUser.nama,
    isi: document.getElementById('infoIsi').value.trim(),
    foto: fotoBase64
  };

  try {
    await fetch(SPREADSHEET_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    closeModalTambahInfo();
    document.getElementById('infoJudul').value = '';
    document.getElementById('infoIsi').value = '';
    if (fileInput) fileInput.value = '';

    showToast('Pengumuman berhasil disebarkan ke semua!', 'success');
    await sinkronDataDariSPS(false);
  } catch (err) {
    console.error(err);
    // Fallback simpan lokal jika POST terkendala CORS
    dbPengumuman.unshift(payload);
    localStorage.setItem('kasku_pengumuman', JSON.stringify(dbPengumuman));
    closeModalTambahInfo();
    renderPengumuman();
    showToast('Pengumuman disimpan di memori.', 'info');
  }
}

async function hapusInfo(id) {
  if (confirm('Yakin ingin menghapus pengumuman ini?')) {
    showToast('Menghapus pengumuman...', 'info');
    try {
      await fetch(SPREADSHEET_API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "hapus", id: id })
      });
      showToast('Pengumuman berhasil dihapus!', 'info');
      await sinkronDataDariSPS(false);
    } catch (err) {
      dbPengumuman = dbPengumuman.filter(p => p.id !== id);
      localStorage.setItem('kasku_pengumuman', JSON.stringify(dbPengumuman));
      renderPengumuman();
      showToast('Pengumuman dihapus dari memori.', 'info');
    }
  }
}

// ==================== 2. KAS SAYA & BAYAR KAS ====================
function renderKasSaya() {
  document.getElementById('kasAkunNama').textContent = currentUser.nama;
  document.getElementById('kasAkunNim').textContent = currentUser.nim;

  const grid = document.getElementById('gridBulanKas');
  const selectBulan = document.getElementById('selectBulanKas');
  grid.innerHTML = '';
  selectBulan.innerHTML = '';

  let totalLunas = 0;
  let totalBulanAktif = 0;

  BULAN_LIST.forEach(bln => {
    const rawStatus = (currentUser[bln] || 'Belum Bayar').trim();
    const status = rawStatus.toLowerCase();

    const isNonaktif = status === 'nonaktif';
    if (!isNonaktif) {
      totalBulanAktif++;
      if (status !== 'lunas') {
        const opt = document.createElement('option');
        opt.value = bln;
        opt.textContent = `${bln} (Rp5.000) - Status: ${rawStatus}`;
        selectBulan.appendChild(opt);
      }
    }

    let bgCard = 'bg-[#071924] border-teal-500/20 text-slate-400';
    let badge = 'bg-slate-800 text-slate-400 border border-slate-700';
    let icon = 'circle-slash';
    let label = 'Belum Bayar';
    let teksNominal = 'Rp5.000';

    if (isNonaktif) {
      bgCard = 'bg-[#051119] border-dashed border-slate-700/60 text-slate-500 opacity-60';
      badge = 'bg-slate-900 text-slate-500 border border-slate-800 font-medium';
      icon = 'slash';
      label = 'NONAKTIF';
      teksNominal = 'Bebas Tagihan';
    } else if (status === 'lunas') {
      bgCard = 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200';
      badge = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold';
      icon = 'check-circle-2';
      label = 'LUNAS';
      totalLunas++;
    } else if (status === 'menunggu') {
      bgCard = 'bg-amber-950/60 border-amber-500/40 text-amber-200';
      badge = 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold';
      icon = 'clock';
      label = 'MENUNGGU';
    } else if (status === 'gagal') {
      bgCard = 'bg-rose-950/60 border-rose-500/40 text-rose-200';
      badge = 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold';
      icon = 'alert-triangle';
      label = 'GAGAL';
    }

    const box = document.createElement('div');
    box.className = `p-3.5 rounded-2xl border text-center transition flex flex-col justify-between ${bgCard}`;
    box.innerHTML = `
      <div class="flex items-center justify-between text-xs font-bold mb-1">
        <span class="${isNonaktif ? 'line-through text-slate-500' : ''}">${bln}</span>
        <i data-lucide="${icon}" class="w-4 h-4"></i>
      </div>
      <p class="text-[11px] font-mono mt-1 ${isNonaktif ? 'text-slate-500 italic' : 'text-slate-300'}">${teksNominal}</p>
      <span class="text-[9px] uppercase px-2 py-0.5 rounded-full mt-2 inline-block ${badge}">${label}</span>
    `;
    grid.appendChild(box);
  });

  if (selectBulan.children.length === 0) {
    selectBulan.innerHTML = '<option>Semua periode aktif telah lunas! 🎉</option>';
  }

  document.getElementById('statUserLunasBadge').textContent = `${totalLunas} / ${totalBulanAktif} Bulan`;
  lucide.createIcons();
}

function previewBukti(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      tempUploadedImageBase64 = e.target.result;
      document.getElementById('imgBuktiPreview').src = tempUploadedImageBase64;
      document.getElementById('previewBuktiWrap').classList.remove('hidden');
      document.getElementById('placeholderBuktiWrap').classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }
}

function handleKirimKas(e) {
  e.preventDefault();
  const bulan = document.getElementById('selectBulanKas').value;
  if (!bulan || bulan.includes('telah lunas')) {
    showToast('Tidak ada tagihan yang dipilih.', 'error');
    return;
  }

  const metode = document.getElementById('selectMetodeKas').value;
  const catatan = document.getElementById('inputCatatanKas').value.trim() || 'Pembayaran via web';

  const transaksiBaru = {
    id: Date.now(),
    nim: currentUser.nim,
    nama: currentUser.nama,
    bulan: bulan,
    nominal: 5000,
    metode: metode,
    catatan: catatan,
    tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    fotoBukti: tempUploadedImageBase64 || ""
  };

  dbVerifikasi.push(transaksiBaru);
  currentUser[bulan] = "Menunggu";

  const userIdx = dbKasSiswa.findIndex(u => String(u.nim).trim() === String(currentUser.nim).trim());
  if (userIdx !== -1) dbKasSiswa[userIdx] = currentUser;

  localStorage.setItem('kasku_verifikasi', JSON.stringify(dbVerifikasi));
  localStorage.setItem('kasku_kas_siswa', JSON.stringify(dbKasSiswa));

  showToast(`Bukti pembayaran ${bulan} berhasil dikirim ke Admin!`, 'success');
  tempUploadedImageBase64 = null;
  document.getElementById('inputCatatanKas').value = '';
  document.getElementById('fileBuktiKas').value = '';
  document.getElementById('previewBuktiWrap').classList.add('hidden');
  document.getElementById('placeholderBuktiWrap').classList.remove('hidden');

  renderKasSaya();
  if (currentUser.isAdmin) renderAdminPanel();
}

// ==================== 3. TRANSPARANSI KAS KELAS ====================
function renderRincianKasKelas() {
  let totalMasuk = 0;
  let totalKeluar = 0;

  const tbody = document.getElementById('tbodyRincianKas');
  tbody.innerHTML = '';

  dbRekapKas.forEach(item => {
    const nominalAngka = parseInt(String(item.nominal).replace(/[^0-9]/g, ''), 10) || 0;
    const isMasuk = String(item.jenis).trim().toLowerCase() === 'pemasukan';

    if (isMasuk) totalMasuk += nominalAngka;
    else totalKeluar += nominalAngka;

    let keteranganPublik = item.keterangan;
    if (!currentUser.isAdmin && keteranganPublik.includes('-')) {
      keteranganPublik = keteranganPublik.split('-')[0].trim();
    }

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-teal-950/20 transition';
    tr.innerHTML = `
      <td class="p-4 text-slate-400 whitespace-nowrap">${item.tanggal}</td>
      <td class="p-4">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
          isMasuk ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
        }">${isMasuk ? 'Pemasukan' : 'Pengeluaran'}</span>
      </td>
      <td class="p-4 font-bold text-slate-100">${keteranganPublik}</td>
      <td class="p-4 text-right font-mono font-bold ${isMasuk ? 'text-emerald-400' : 'text-rose-400'}">
        ${isMasuk ? '+' : '-'} Rp${nominalAngka.toLocaleString('id-ID')}
      </td>
      <td class="p-4 text-slate-400">${item.penanggung_jawab}</td>
    `;
    tbody.appendChild(tr);
  });

  const sisaSaldo = totalMasuk - totalKeluar;
  document.getElementById('statTotalPemasukan').textContent = `Rp${totalMasuk.toLocaleString('id-ID')}`;
  document.getElementById('statTotalPengeluaran').textContent = `Rp${totalKeluar.toLocaleString('id-ID')}`;
  document.getElementById('statSisaSaldo').textContent = `Rp${sisaSaldo.toLocaleString('id-ID')}`;
  document.getElementById('heroTotalKasSaldo').textContent = `Rp${sisaSaldo.toLocaleString('id-ID')}`;
}

// ==================== 4. PANEL ADMIN ====================
function renderAdminPanel() {
  if (!currentUser || !currentUser.isAdmin) return;

  const container = document.getElementById('containerAdminVerifikasi');
  const badge = document.getElementById('badgePendingTotal');
  if (container) {
    container.innerHTML = '';
    badge.textContent = `${dbVerifikasi.length} Menunggu`;

    if (dbVerifikasi.length === 0) {
      container.innerHTML = '<p class="text-xs text-amber-200/60 py-4 text-center">Tidak ada pembayaran yang menunggu verifikasi saat ini.</p>';
    } else {
      dbVerifikasi.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-[#0c2333] p-4 rounded-2xl border border-amber-500/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-xs';
        card.innerHTML = `
          <div>
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-sm text-slate-100">${item.nama}</span>
              <span class="text-[11px] text-slate-400">(${item.nim})</span>
              <span class="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">Periode: ${item.bulan}</span>
            </div>
            <p class="text-xs text-slate-300 mt-1">Metode: <strong class="text-teal-300">${item.metode}</strong> • Catatan: "<em>${item.catatan}</em>"</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            ${item.fotoBukti ? `
              <button onclick="bukaModalBukti(${item.id})" class="px-3 py-1.5 bg-[#071924] hover:bg-teal-950 text-teal-200 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-teal-500/30">
                <i data-lucide="image" class="w-3.5 h-3.5 text-cyan-400"></i> Lihat Bukti
              </button>
            ` : ''}
            <button onclick="approveKas(${item.id})" class="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm">
              <i data-lucide="check" class="w-3.5 h-3.5"></i> Setujui
            </button>
            <button onclick="rejectKas(${item.id})" class="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition border border-rose-500/30">
              Tolak
            </button>
          </div>
        `;
        container.appendChild(card);
      });
    }
  }

  const tbody = document.getElementById('tbodyAdminKasSiswa');
  if (tbody) {
    tbody.innerHTML = '';
    dbKasSiswa.forEach(siswa => {
      let totalLunas = 0;
      let totalAktif = 0;
      let kolomBulanHTML = '';

      BULAN_LIST.forEach(bln => {
        const st = String(siswa[bln] || 'Belum Bayar').trim().toLowerCase();
        let badge = 'text-slate-500';
        let icon = '•';

        if (st === 'nonaktif') {
          badge = 'text-slate-600';
          icon = '-';
        } else {
          totalAktif++;
          if (st === 'lunas') {
            badge = 'text-emerald-400 font-black';
            icon = '✓';
            totalLunas++;
          } else if (st === 'menunggu') {
            badge = 'text-amber-400 font-bold';
            icon = '⌛';
          } else if (st === 'gagal') {
            badge = 'text-rose-400 font-bold';
            icon = '✕';
          }
        }

        kolomBulanHTML += `<td class="p-2.5 text-center ${badge}" title="${bln}: ${siswa[bln]}">${icon}</td>`;
      });

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-teal-950/20';
      tr.innerHTML = `
        <td class="p-3 font-mono text-slate-400 whitespace-nowrap">${siswa.nim}</td>
        <td class="p-3 font-bold text-slate-100 whitespace-nowrap">${siswa.nama}</td>
        ${kolomBulanHTML}
        <td class="p-3 text-center font-bold text-emerald-400 whitespace-nowrap">${totalLunas} / ${totalAktif}</td>
      `;
      tbody.appendChild(tr);
    });
  }
  lucide.createIcons();
}

function bukaModalBukti(id) {
  const item = dbVerifikasi.find(v => v.id === id);
  if (!item) return;

  document.getElementById('modalBuktiNama').textContent = `Bukti Transfer - ${item.nama} (${item.nim})`;
  document.getElementById('modalBuktiKet').textContent = `Periode: ${item.bulan} • Metode: ${item.metode} • Rp${item.nominal.toLocaleString('id-ID')}`;
  document.getElementById('modalBuktiGambar').src = item.fotoBukti;

  document.getElementById('modalLihatBukti').classList.remove('hidden');
}

function closeModalLihatBukti() {
  document.getElementById('modalLihatBukti').classList.add('hidden');
}

function approveKas(id) {
  const item = dbVerifikasi.find(v => v.id === id);
  if (!item) return;

  const targetUser = dbKasSiswa.find(u => String(u.nim).trim() === String(item.nim).trim());
  if (targetUser) {
    targetUser[item.bulan] = "Lunas";
  }

  dbRekapKas.unshift({
    id: String(Date.now()),
    tanggal: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    jenis: "Pemasukan",
    keterangan: `Iuran Kas ${item.bulan} (Terverifikasi)`,
    nominal: String(item.nominal),
    penanggung_jawab: "Bendahara Alif"
  });

  dbVerifikasi = dbVerifikasi.filter(v => v.id !== id);

  localStorage.setItem('kasku_kas_siswa', JSON.stringify(dbKasSiswa));
  localStorage.setItem('kasku_rekap_kas', JSON.stringify(dbRekapKas));
  localStorage.setItem('kasku_verifikasi', JSON.stringify(dbVerifikasi));

  showToast(`Pembayaran kas ${item.nama} resmi LUNAS!`, 'success');
  loadDashboard();
}

function rejectKas(id) {
  const item = dbVerifikasi.find(v => v.id === id);
  if (!item) return;

  const targetUser = dbKasSiswa.find(u => String(u.nim).trim() === String(item.nim).trim());
  if (targetUser) {
    targetUser[item.bulan] = "Gagal";
  }

  dbVerifikasi = dbVerifikasi.filter(v => v.id !== id);
  localStorage.setItem('kasku_kas_siswa', JSON.stringify(dbKasSiswa));
  localStorage.setItem('kasku_verifikasi', JSON.stringify(dbVerifikasi));

  showToast(`Pembayaran kas ${item.nama} ditolak.`, 'info');
  loadDashboard();
}

// ==================== UTILITAS ====================
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toastMsg');
  const icon = document.getElementById('toastIcon');

  msg.textContent = message;
  icon.className = (type === 'error') ? 'w-5 h-5 text-rose-400' : 'w-5 h-5 text-emerald-400';
  icon.setAttribute('data-lucide', (type === 'error') ? 'alert-circle' : 'check-circle');
  lucide.createIcons();

  toast.classList.remove('translate-y-[-150%]', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.add('translate-y-[-150%]', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 3000);
}

function salin(text) {
  navigator.clipboard.writeText(text);
  showToast('Disalin ke clipboard!', 'success');
}

function togglePasswordVisibility(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}
