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
      document.getElementById('result-json').textContent = JSON.stringify(data, null, 2);
    }, 500);
  })
  .catch(err => {
    done = true;
    clearInterval(stepInterval);
    clearInterval(fillInterval);
    statusEl.textContent = 'INVESTIGATION FAILED';
    statusEl.style.color = 'var(--redact)';
    stepsList.innerHTML += `<div style="margin-top:16px; color:var(--redact); font-family:'IBM Plex Mono',monospace; font-size:13px;">Error: ${err.message}</div>`;
  });
}