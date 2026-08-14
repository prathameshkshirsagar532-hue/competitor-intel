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
  // Hide the form, show the progress screen
  document.getElementById('intake-form').closest('.form-wrap').style.display = 'none';
  document.getElementById('progress-screen').style.display = 'flex';

  // These messages describe what's actually happening on the backend right now —
  // so if something breaks, you know exactly which stage to debug.
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

  let stepIndex = 0;
  let fakeProgress = 4;
  let done = false;

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
    stepDefs.forEach((_,i) => {
      const el = document.getElementById('step-'+i);
      el.classList.remove('active');
      el.classList.add('done');
    });
    fillEl.style.width = '100%';
    statusEl.textContent = 'CASE FILE READY';

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

    document.getElementById('progress-screen').style.display = 'none';
    document.getElementById('error-screen').style.display = 'block';
    document.getElementById('error-message').textContent = err.message;

    document.getElementById('retry-btn').onclick = function(){
      document.getElementById('error-screen').style.display = 'none';
      runInvestigation(input);
    };
  });
}
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

function renderReport(data, input){
  const caseId = genCaseId();
  const company = data.company || {name: input.companyName, summary: ''};
  const competitors = data.competitors || [];
  const matrix = data.comparison_matrix || {dimensions: [], rows: {}};
  const recs = data.recommendations || [];

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

  html += `<div class="section-title">Competitor profiles</div>`;
  html += `<div class="profiles">`;
  competitors.forEach(c => {
    const threat = ['Low','Medium','High'].includes(c.threat_level) ? c.threat_level : 'Medium';
    const strengths = (c.strengths || []).slice(0,3);
    const weaknesses = (c.weaknesses || []).slice(0,3);
    const moves = (c.recent_moves || []).slice(0,3);
    html += `
      <div class="profile-card">
        <div class="profile-top">
          <div>
            <div class="profile-name">${esc(c.name)}</div>
            <div class="profile-domain mono">${esc(c.domain || '')}</div>
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
        <div class="pricing-line"><span class="mono-tag mono">PRICING SIGNAL —</span> ${esc(c.pricing_signal || 'Not available')}</div>
      </div>
    `;
  });
  html += `</div>`;

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
    <div id="copy-confirm" class="mono" style="margin-top:14px;font-size:12px;color:var(--slate-dim);"></div>
  `;

  document.getElementById('report-body').innerHTML = html;
  window.__lastReportData = data;
}

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
  text += `Recommendations:\n` + (data.recommendations||[]).map((r,i)=>`${i+1}. ${r}`).join('\n');

  navigator.clipboard.writeText(text).then(()=>{
    document.getElementById('copy-confirm').textContent = 'Copied to clipboard.';
  }).catch(()=>{
    document.getElementById('copy-confirm').textContent = 'Could not copy — select and copy manually.';
  });
}
