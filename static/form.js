// ===== RECENT CASES (localStorage) =====
function getRecentCases(){
  try{
    return JSON.parse(localStorage.getItem('recentCases') || '[]');
  }catch(e){
    return [];
  }
}

function saveRecentCase(input, data){
  const cases = getRecentCases();
  cases.unshift({
    companyName: input.companyName,
    date: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}),
    input: input,
    data: data
  });
  const trimmed = cases.slice(0, 5);
  localStorage.setItem('recentCases', JSON.stringify(trimmed));
}

function renderRecentCases(){
  const cases = getRecentCases();
  const section = document.getElementById('recent-cases-section');
  const list = document.getElementById('recent-cases-list');
  if(!section || !list) return;

  if(cases.length === 0){
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = cases.map((c, i) => `
    <div class="recent-case-item" onclick="reopenCase(${i})">
      <span class="recent-case-name">${esc(c.companyName)}</span>
      <span class="recent-case-date mono">${esc(c.date)}</span>
    </div>
  `).join('');
}

function reopenCase(index){
  const cases = getRecentCases();
  const c = cases[index];
  if(!c) return;
  document.getElementById('intake-form').closest('.form-wrap').style.display = 'none';
  document.getElementById('progress-screen').style.display = 'none';
  document.getElementById('result-screen').style.display = 'block';
  renderReport(c.data, c.input);
}

document.addEventListener('DOMContentLoaded', renderRecentCases);

// ===== FORM SUBMIT =====
document.getElementById('intake-form').addEventListener('submit', function(e){
  e.preventDefault();
  const errorEl = document.getElementById('form-error');
  errorEl.textContent = '';

  const companyName = document.getElementById('company-name').value.trim();
  const companyDomain = document.getElementById('company-domain').value.trim();
  const competitors = [];
  for(let i=1;i<=3;i++){
    const name = document.getElementById('comp'+i+'-name').value.trim();
    const domain = document.getElementById('comp'+i+'-domain').value.trim();
    if(name) competitors.push({name, domain});
  }

  if(!companyName){
    errorEl.textContent = 'Enter your company name to open the case.';
    return;
  }
  if(competitors.length === 0){
    errorEl.textContent = 'Add at least one competitor to investigate.';
    return;
  }

  runInvestigation({companyName, companyDomain, competitors});
});

function runInvestigation(input){
  document.getElementById('intake-form').closest('.form-wrap').style.display = 'none';
  document.getElementById('recent-cases-section').style.display = 'none';
  document.getElementById('progress-screen').style.display = 'flex';

  const stepDefs = [
    'Sending case details to the backend (/api/analyze)',
    'Backend is building the research prompt',
    'Waiting on AI analysis response',
    'Parsing and validating the returned data',
    'Case file ready'
  ];

  const stepsList = document.getElementById('steps-list');
  stepsList.innerHTML = stepDefs.map((s,i) =>
    `<div class="step" id="step-${i}"><div class="mark">${i+1}</div><span>${s}</span></div>`
  ).join('');

  const statusEl = document.getElementById('progress-status');
  const fillEl = document.getElementById('progress-fill');
  const waitNoteEl = document.getElementById('wait-note');

  let stepIndex = 0;
  let fakeProgress = 4;
  let done = false;
  let elapsedSeconds = 0;

  document.getElementById('step-0').classList.add('active');
  statusEl.textContent = stepDefs[0].toUpperCase();

  function tickStep(){
    if(done || stepIndex >= stepDefs.length - 2) return;
    document.getElementById('step-'+stepIndex).classList.remove('active');
    document.getElementById('step-'+stepIndex).classList.add('done');
    stepIndex++;
    document.getElementById('step-'+stepIndex).classList.add('active');
    statusEl.textContent = stepDefs[stepIndex].toUpperCase();
  }

  const stepInterval = setInterval(tickStep, 1200);
  const fillInterval = setInterval(() => {
    if(fakeProgress < 85){
      fakeProgress += Math.random()*5;
      fillEl.style.width = Math.min(fakeProgress,85) + '%';
    }
  }, 400);

  const waitInterval = setInterval(() => {
    elapsedSeconds += 1;
    if(elapsedSeconds >= 20 && !done){
      waitNoteEl.textContent = 'Taking longer than usual — still working, hang tight...';
    }
    if(elapsedSeconds >= 45 && !done){
      waitNoteEl.textContent = 'This is unusually slow. The AI service may be under heavy load.';
    }
  }, 1000);

  fetch('/api/analyze', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(input)
  })
  .then(res => {
    if(!res.ok){
      return res.json().then(err => { throw new Error(err.error || 'Request failed with status ' + res.status); });
    }
    return res.json();
  })
  .then(data => {
    done = true;
    clearInterval(stepInterval);
    clearInterval(fillInterval);
    clearInterval(waitInterval);
    stepDefs.forEach((_,i) => {
      const el = document.getElementById('step-'+i);
      el.classList.remove('active');
      el.classList.add('done');
    });
    fillEl.style.width = '100%';
    statusEl.textContent = 'CASE FILE READY';

    saveRecentCase(input, data);

    setTimeout(() => {
      document.getElementById('progress-screen').style.display = 'none';
      document.getElementById('result-screen').style.display = 'block';
      renderReport(data, input);
    }, 500);
  })
  .catch(err => {
    done = true;
    clearInterval(stepInterval);
    clearInterval(fillInterval);
    clearInterval(waitInterval);

    document.getElementById('progress-screen').style.display = 'none';
    document.getElementById('error-screen').style.display = 'block';
    document.getElementById('error-message').textContent = err.message;

    document.getElementById('retry-btn').onclick = function(){
      document.getElementById('error-screen').style.display = 'none';
      runInvestigation(input);
    };
  });
}

// ===== REPORT RENDERING =====
function esc(s){
  if(s === undefined || s === null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function genCaseId(){
  const n = Math.floor(1000 + Math.random()*8999);
  const y = new Date().getFullYear();
  return 'CI-' + y + '-' + n;
}

function logoUrl(domain){
  if(!domain) return '';
  return `https://logo.clearbit.com/${domain}`;
}

function buildProfileCard(c, isYou){
  const threat = ['Low','Medium','High'].includes(c.threat_level) ? c.threat_level : 'Medium';
  const strengths = (c.strengths || []).slice(0,3);
  const weaknesses = (c.weaknesses || []).slice(0,3);
  const moves = (c.recent_moves || []).slice(0,3);
  const domain = c.domain || '';
  const logo = domain ? `<img class="profile-logo" src="${logoUrl(domain)}" onerror="this.style.display='none'" alt="">` : '';

  return `
    <div class="profile-card${isYou ? ' you-card' : ''}">
      <div class="profile-top">
        <div class="profile-name-row">
          ${logo}
          <div>
            <div class="profile-name">${esc(c.name)}</div>
            <div class="profile-domain mono">${esc(domain)}</div>
          </div>
        </div>
        <div class="threat-stamp threat-${threat}">Threat: ${threat}</div>
      </div>
      <div class="positioning">${esc(c.positioning || '')}</div>
      <div class="two-col">
        <div>
          <div class="mini-label">Strengths</div>
          <ul class="mini-list strengths">${strengths.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
        </div>
        <div>
          <div class="mini-label">Weaknesses</div>
          <ul class="mini-list weaknesses">${weaknesses.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
        </div>
      </div>
      ${moves.length ? `<div style="margin-bottom:20px;">
        <div class="mini-label">Recent moves</div>
        <ul class="mini-list moves">${moves.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
      </div>` : ''}
      ${c.pricing_signal ? `<div class="pricing-line"><span class="mono-tag mono">PRICING SIGNAL —</span> ${esc(c.pricing_signal)}</div>` : ''}
    </div>
  `;
}

function renderReport(data, input){
  const caseId = genCaseId();
  const company = data.company || {name: input.companyName, summary: ''};
  const competitors = data.competitors || [];
  const matrix = data.comparison_matrix || {dimensions: [], rows: {}};
  const recs = data.recommendations || [];
  const advice = data.strategic_advice || '';

  const today = new Date().toLocaleDateString('en-US', {year:'numeric', month:'long', day:'numeric'});

  let html = '';

  html += `
    <div class="report-head">
      <div>
        <div class="case-id mono">${esc(caseId)} — CASE FILE COMPLETE</div>
        <h2>${esc(company.name)} vs. ${competitors.length} ${competitors.length===1?'competitor':'competitors'}</h2>
      </div>
      <div class="stamp-date">Filed ${today}<br>Status: Closed</div>
    </div>
  `;

  html += `
    <div class="summary-panel">
      <span class="card-label mono">Executive summary</span>
      <p>${esc(company.summary || 'No summary available.')}</p>
    </div>
  `;

  html += `<div class="section-title">Head-to-head profiles</div>`;
  html += `<div class="profiles">`;
  html += buildProfileCard({...company, domain: company.domain || input.companyDomain}, true);
  competitors.forEach(c => {
    html += buildProfileCard(c, false);
  });
  html += `</div>`;

  html += `
    <div class="charts-grid">
      <div class="chart-card">
        <div class="card-label mono">Threat distribution</div>
        <canvas id="chart-threat-pie"></canvas>
      </div>
      <div class="chart-card">
        <div class="card-label mono">Threat level by competitor</div>
        <canvas id="chart-threat-bar"></canvas>
      </div>
      <div class="chart-card full-width">
        <div class="card-label mono">Strengths vs weaknesses</div>
        <canvas id="chart-sw-bar"></canvas>
      </div>
    </div>
  `;

  if(matrix.dimensions && matrix.dimensions.length){
    html += `<div class="section-title">Comparison matrix</div>`;
    html += `<div class="matrix-wrap"><table class="matrix"><thead><tr><th></th>`;
    matrix.dimensions.forEach(d => html += `<th>${esc(d)}</th>`);
    html += `</tr></thead><tbody>`;

    const rowNames = Object.keys(matrix.rows || {});
    rowNames.forEach(name => {
      const isYou = name.toLowerCase() === (company.name||'').toLowerCase();
      html += `<tr class="${isYou ? 'you':''}"><td class="rowhead">${esc(name)}${isYou ? ' (you)' : ''}</td>`;
      (matrix.rows[name]||[]).forEach(v => html += `<td>${esc(v)}</td>`);
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;
  }

  if(advice){
    html += `
      <div class="advice-panel">
        <span class="card-label mono">Strategic advice</span>
        <p>${esc(advice)}</p>
      </div>
    `;
  }

  if(recs.length){
    html += `
      <div class="memo">
        <div class="memo-badge">Analyst recommends</div>
        <span class="card-label mono">Recommendations</span>
        <ol>${recs.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
      </div>
    `;
  }

  html += `
    <div class="report-actions">
      <a href="/form" class="btn-primary">Open a new case →</a>
      <button class="btn-secondary" onclick="copyReport()">Copy briefing as text</button>
    </div>
    <div class="export-buttons">
      <button class="btn-export" onclick="downloadExport('pdf')">Download PDF</button>
      <button class="btn-export" onclick="downloadExport('docx')">Download Word</button>
    </div>
    <div id="copy-confirm" class="mono" style="margin-top:14px;font-size:12px;color:var(--slate-dim);"></div>
  `;

  document.getElementById('report-body').innerHTML = html;
  window.__lastReportData = data;
  renderCharts(company, competitors);
}

function renderCharts(company, competitors){
  if(typeof Chart === 'undefined' || competitors.length === 0) return;

  const threatMap = {Low: 1, Medium: 2, High: 3};
  const colors = {Low: '#8593A6', Medium: '#E8A33D', High: '#C0392B'};

  const names = competitors.map(c => c.name);
  const threatCounts = {Low: 0, Medium: 0, High: 0};
  competitors.forEach(c => {
    const t = ['Low','Medium','High'].includes(c.threat_level) ? c.threat_level : 'Medium';
    threatCounts[t]++;
  });

  const commonOpts = { responsive: true, maintainAspectRatio: false };

  const pieCtx = document.getElementById('chart-threat-pie');
  if(pieCtx){
    new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: ['Low', 'Medium', 'High'],
        datasets: [{
          data: [threatCounts.Low, threatCounts.Medium, threatCounts.High],
          backgroundColor: [colors.Low, colors.Medium, colors.High]
        }]
      },
      options: {
        ...commonOpts,
        plugins: { legend: { labels: { color: '#F2EDE1' } } }
      }
    });
  }

  const barCtx = document.getElementById('chart-threat-bar');
  if(barCtx){
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: names,
        datasets: [{
          label: 'Threat Level',
          data: competitors.map(c => threatMap[c.threat_level] || 2),
          backgroundColor: competitors.map(c => colors[c.threat_level] || colors.Medium)
        }]
      },
      options: {
        ...commonOpts,
        scales: {
          y: { min: 0, max: 3, ticks: { color: '#8593A6', stepSize: 1, callback: v => ['','Low','Medium','High'][v] } },
          x: { ticks: { color: '#8593A6' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  const swCtx = document.getElementById('chart-sw-bar');
  if(swCtx){
    new Chart(swCtx, {
      type: 'bar',
      data: {
        labels: names,
        datasets: [
          {
            label: 'Strengths',
            data: competitors.map(c => (c.strengths || []).length),
            backgroundColor: '#E8A33D'
          },
          {
            label: 'Weaknesses',
            data: competitors.map(c => (c.weaknesses || []).length),
            backgroundColor: '#C0392B'
          }
        ]
      },
      options: {
        ...commonOpts,
        scales: {
          y: { ticks: { color: '#8593A6', stepSize: 1 } },
          x: { ticks: { color: '#8593A6' } }
        },
        plugins: { legend: { labels: { color: '#F2EDE1' } } }
      }
    });
  }
}

// ===== COPY AS TEXT =====
function copyReport(){
  const data = window.__lastReportData;
  if(!data) return;
  let text = `CASE FILE — ${data.company.name}\n\n${data.company.summary}\n\n`;
  (data.competitors||[]).forEach(c => {
    text += `--- ${c.name} (${c.domain||''}) — Threat: ${c.threat_level} ---\n`;
    text += `Positioning: ${c.positioning}\n`;
    text += `Strengths: ${(c.strengths||[]).join('; ')}\n`;
    text += `Weaknesses: ${(c.weaknesses||[]).join('; ')}\n`;
    text += `Recent moves: ${(c.recent_moves||[]).join('; ')}\n`;
    text += `Pricing: ${c.pricing_signal}\n\n`;
  });
  if(data.strategic_advice){
    text += `Strategic Advice:\n${data.strategic_advice}\n\n`;
  }
  text += `Recommendations:\n` + (data.recommendations||[]).map((r,i)=>`${i+1}. ${r}`).join('\n');

  navigator.clipboard.writeText(text).then(()=>{
    document.getElementById('copy-confirm').textContent = 'Copied to clipboard.';
  }).catch(()=>{
    document.getElementById('copy-confirm').textContent = 'Could not copy — select and copy manually.';
  });
}

// ===== PDF / DOCX DOWNLOAD =====
function downloadExport(type){
  const data = window.__lastReportData;
  if(!data) return;

  fetch(`/api/export/${type}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data)
  })
  .then(res => {
    if(!res.ok) throw new Error('Export failed');
    return res.blob();
  })
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'pdf' ? 'case_file.pdf' : 'case_file.docx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  })
  .catch(err => {
    document.getElementById('copy-confirm').textContent = 'Download failed: ' + err.message;
  });
      }
