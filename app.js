/* eslint-disable no-alert */
(function () {
  const STORAGE_KEY = 'bp_records_v1';
  /** @typedef {{ id: string; dateTime: string; systolic: number; diastolic: number; pulse?: number|null; note?: string }} BPRecord */

  // Elements
  const dateTimeEl = document.getElementById('dateTime');
  const systolicEl = document.getElementById('systolic');
  const diastolicEl = document.getElementById('diastolic');
  const pulseEl = document.getElementById('pulse');
  const noteEl = document.getElementById('note');
  const formEl = document.getElementById('entryForm');
  const resetBtn = document.getElementById('resetBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const installBtn = document.getElementById('installBtn');
  const entryListEl = document.getElementById('entryList');
  const statCountEl = document.getElementById('statCount');
  const statAvgSysEl = document.getElementById('statAvgSys');
  const statAvgDiaEl = document.getElementById('statAvgDia');
  const statLastCatEl = document.getElementById('statLastCat');

  /** @type {BPRecord|null} */
  let editing = null;
  /** @type {BPRecord[]} */
  let records = [];

  // Init default datetime
  function setDefaultNow() {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - tzOffset * 60 * 1000)
      .toISOString()
      .slice(0, 16);
    dateTimeEl.value = local;
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      records = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error(e);
      records = [];
    }
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function toCategory(systolic, diastolic) {
    // Korean guidelines simplified
    if (systolic >= 180 || diastolic >= 120) return { label: '위기', cls: 'danger' };
    if (systolic >= 140 || diastolic >= 90) return { label: '고혈압 2기', cls: 'danger' };
    if (systolic >= 130 || diastolic >= 80) return { label: '고혈압 1기', cls: 'warn' };
    if (systolic >= 120 || diastolic >= 80) return { label: '주의', cls: 'warn' };
    return { label: '정상', cls: 'success' };
  }

  function renderList() {
    entryListEl.innerHTML = '';
    const sorted = [...records].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    for (const r of sorted) {
      const li = document.createElement('li');
      li.className = 'entry-item';

      const meta = document.createElement('div');
      meta.className = 'entry-meta';
      const d = new Date(r.dateTime);
      meta.innerHTML = `<strong>${d.toLocaleString()}</strong><small class="muted">${r.note ? r.note : ''}</small>`;

      const bp = document.createElement('div');
      bp.textContent = `${r.systolic}/${r.diastolic} mmHg`;

      const pulse = document.createElement('div');
      pulse.textContent = r.pulse ? `${r.pulse} bpm` : '-';

      const cat = document.createElement('div');
      const { label, cls } = toCategory(r.systolic, r.diastolic);
      cat.innerHTML = `<span class="badge ${cls}">${label}</span>`;

      const actions = document.createElement('div');
      actions.className = 'entry-actions';
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary';
      editBtn.textContent = '수정';
      editBtn.onclick = () => beginEdit(r.id);
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger';
      delBtn.textContent = '삭제';
      delBtn.onclick = () => deleteRecord(r.id);
      actions.append(editBtn, delBtn);

      li.append(meta, bp, pulse, cat, actions);
      entryListEl.appendChild(li);
    }
  }

  function calcStats() {
    const count = records.length;
    statCountEl.textContent = String(count);
    if (count === 0) {
      statAvgSysEl.textContent = '-';
      statAvgDiaEl.textContent = '-';
      statLastCatEl.textContent = '-';
      return;
    }
    const avg = records.reduce(
      (acc, r) => {
        acc.s += r.systolic;
        acc.d += r.diastolic;
        return acc;
      },
      { s: 0, d: 0 }
    );
    const avgS = Math.round((avg.s / count) * 10) / 10;
    const avgD = Math.round((avg.d / count) * 10) / 10;
    statAvgSysEl.textContent = `${avgS}`;
    statAvgDiaEl.textContent = `${avgD}`;
    const last = [...records].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))[0];
    statLastCatEl.textContent = toCategory(last.systolic, last.diastolic).label;
  }



  function refreshUI() {
    renderList();
    calcStats();
  }

  function uuid() {
    return (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)) + Date.now().toString(36);
  }

  function parseNumber(el) {
    const v = Number(el.value);
    return Number.isFinite(v) ? v : null;
  }

  function clearForm() {
    editing = null;
    setDefaultNow();
    systolicEl.value = '';
    diastolicEl.value = '';
    pulseEl.value = '';
    noteEl.value = '';
  }

  function beginEdit(id) {
    const r = records.find((x) => x.id === id);
    if (!r) return;
    editing = r;
    dateTimeEl.value = r.dateTime.slice(0, 16);
    systolicEl.value = String(r.systolic);
    diastolicEl.value = String(r.diastolic);
    pulseEl.value = r.pulse != null ? String(r.pulse) : '';
    noteEl.value = r.note || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function deleteRecord(id) {
    if (!confirm('삭제하시겠어요?')) return;
    records = records.filter((x) => x.id !== id);
    saveRecords();
    refreshUI();
  }

  function onSubmit(e) {
    e.preventDefault();
    const sys = parseNumber(systolicEl);
    const dia = parseNumber(diastolicEl);
    if (sys == null || dia == null) {
      alert('수축기/이완기를 정확히 입력해주세요.');
      return;
    }
    if (sys < 50 || sys > 250 || dia < 30 || dia > 150) {
      if (!confirm('비정상 범위의 값입니다. 그래도 저장할까요?')) return;
    }
    const dt = dateTimeEl.value ? new Date(dateTimeEl.value) : new Date();
    const iso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60 * 1000).toISOString();
    const rec = {
      id: editing ? editing.id : uuid(),
      dateTime: iso,
      systolic: sys,
      diastolic: dia,
      pulse: parseNumber(pulseEl),
      note: noteEl.value.trim() || undefined,
    };
    if (editing) {
      records = records.map((x) => (x.id === editing.id ? rec : x));
    } else {
      records.push(rec);
    }
    saveRecords();
    clearForm();
    refreshUI();
  }

  function onReset() {
    clearForm();
  }

  function onClearAll() {
    if (!records.length) return;
    if (!confirm('모든 기록을 삭제하시겠어요?')) return;
    records = [];
    saveRecords();
    refreshUI();
  }

  function toExcelData(rows) {
    // 헤더 행
    const headers = ['날짜/시간', '수축기(mmHg)', '이완기(mmHg)', '맥박(bpm)', '범주', '메모'];
    
    // 데이터 행들
    const dataRows = rows.map(r => {
      const date = new Date(r.dateTime);
      const { label } = toCategory(r.systolic, r.diastolic);
      return [
        date.toLocaleString('ko-KR'),
        r.systolic,
        r.diastolic,
        r.pulse || '',
        label,
        r.note || ''
      ];
    });
    
    return [headers, ...dataRows];
  }

  function onExportCsv() {
    if (!window.XLSX) {
      alert('엑셀 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const data = toExcelData(records);
    
    // 워크북 생성
    const wb = XLSX.utils.book_new();
    
    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // 열 너비 설정
    ws['!cols'] = [
      { width: 20 }, // 날짜/시간
      { width: 12 }, // 수축기
      { width: 12 }, // 이완기
      { width: 10 }, // 맥박
      { width: 12 }, // 범주
      { width: 30 }  // 메모
    ];
    
    // 워크시트를 워크북에 추가
    XLSX.utils.book_append_sheet(wb, ws, '혈압기록');
    
    // 파일 다운로드
    const fileName = `혈압기록_${new Date().toLocaleDateString('ko-KR').replace(/\./g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // PWA install
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });

  // Service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(console.error);
    });
  }

  // Wire events
  formEl.addEventListener('submit', onSubmit);
  resetBtn.addEventListener('click', onReset);
  clearAllBtn.addEventListener('click', onClearAll);
  exportCsvBtn.addEventListener('click', onExportCsv);

  // Boot
  setDefaultNow();
  loadRecords();
  refreshUI();
})();

