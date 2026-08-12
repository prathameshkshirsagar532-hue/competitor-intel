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

  // Phase 3 checkpoint: just confirm the data is captured correctly.
  // Phase 5 will replace this with the real progress screen + backend call.
  alert('Form looks good!\\n\\nCompany: ' + companyName + '\\nCompetitors: ' + competitors.map(c => c.name).join(', '));
});