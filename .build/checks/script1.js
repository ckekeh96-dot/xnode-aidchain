
(function(){
'use strict';
const by=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n)+' demo USDC';
const safe=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pending=null,lastReceipt=null;
function updatePreview(){
 const p=project(by('donationProject').value),a=Number(by('donationAmount').value),valid=Number.isSafeInteger(a)&&a>=1&&a<=1000000;
 by('donationPreview').innerHTML='<div class="preview-line"><span>Selected cause</span><strong>'+safe(p?.name||'Select a project')+'</strong></div><div class="preview-line"><span>Contribution</span><strong>'+ (valid?fmt(a):'Enter a whole amount')+'</strong></div><div class="preview-line"><span>Network</span><strong>Local simulation · no fees</strong></div>';
 document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('selected',Number(b.dataset.amount)===a));
}
function show(id){window._dialogFocus=document.activeElement;by(id).hidden=false;document.body.classList.add('has-dialog');by(id).querySelector('button').focus()}
function hide(id){by(id).hidden=true;if(!document.querySelector('.modal-backdrop:not([hidden])')){document.body.classList.remove('has-dialog');if(window._dialogFocus?.isConnected)window._dialogFocus.focus()}}
function details(items){return items.map(([a,b])=>'<div class="detail"><span>'+safe(a)+'</span><strong>'+safe(b)+'</strong></div>').join('')}
function contribution(){const id=by('donationProject').value,p=project(id),amount=Number(by('donationAmount').value),donor=by('donorName').value.trim()||'Anonymous';if(!p||!Number.isSafeInteger(amount)||amount<1||amount>1000000){toast('Enter a whole amount between 1 and 1,000,000 USDC');return}pending={id,amount,donor};resetProof();by('modalSummary').innerHTML=details([['Project',p.name],['Donor',donor],['Amount',fmt(amount)],['Processing','Browser-only simulated contribution']]);show('donationModal')}
by('donateBtn').onclick=contribution;
by('proofAttachment').addEventListener('change',()=>{const f=by('proofAttachment').files[0];by('proofFileStatus').textContent=f?f.name+' · '+Math.ceil(f.size/1024)+' KB · local only':'No file selected'});
function proofError(message,focusId){const box=by('proofError');box.textContent=message;box.hidden=false;toast(message);if(focusId)by(focusId)?.focus()}
function clearProofError(){const box=by('proofError');box.hidden=true;box.textContent=''}
by('proofReference').addEventListener('input',clearProofError);
by('proofAttachment').addEventListener('change',clearProofError);
by('proofAttest').addEventListener('change',clearProofError);
by('confirmDonation').onclick=()=>{if(by('confirmDonation').disabled)return;try{if(!pending){proofError('Donation session expired. Close and start again.');return}if(by('proofStep').hidden){by('proofStep').hidden=false;clearProofError();by('modalTitle').textContent='Step 2 · Demonstrate payment proof';by('confirmDonation').textContent='Record proof & issue demo receipt →';by('proofReference').focus();return}const reference=by('proofReference').value.trim(),method=by('proofMethod').value,note=by('proofNote').value.trim();if(!/^DEMO[-_A-Z0-9]{6,}$/i.test(reference)){proofError('Enter a demo reference such as DEMO-2026-0001.','proofReference');return}const proofFile=by('proofAttachment').files[0];if(!proofFile){proofError('Please attach a sample PDF, PNG or JPG before issuing a receipt.','proofAttachment');return}const extension=(proofFile.name.split('.').pop()||'').toLowerCase(),mime=proofFile.type;if(!['pdf','png','jpg','jpeg'].includes(extension)||(mime&&!['application/pdf','image/png','image/jpeg'].includes(mime))){proofError('Only PDF, PNG, and JPG files are accepted.','proofAttachment');return}if(proofFile.size===0||proofFile.size>5*1024*1024){proofError('Choose a non-empty file no larger than 5 MB.','proofAttachment');return}if(!by('proofAttest').checked){proofError('Tick the demo-payment confirmation checkbox.','proofAttest');return}if(state.events.some(e=>e.type==='DONATION'&&e.detail.includes('Reference: '+reference))){proofError('This demo reference was used already. Enter a different one.','proofReference');return}const proofFileName=proofFile.name.replace(/[<>\r\n]/g,'').slice(0,100),proofFileSize=proofFile.size;const {id,amount,donor}=pending,p=project(id);if(!p){hide('donationModal');return}by('confirmDonation').disabled=true;entry('PAYMENT_PROOF_DEMO',id,0,'Fictional reference: '+reference+' · '+method+' · Local sample attachment: '+proofFileName+' ('+proofFileSize+' bytes, not uploaded or retained)'+(note?' · '+note.slice(0,100):''));entry('DONATION',id,amount,'Demo donor: '+donor.slice(0,50)+' · Reference: '+reference+' · '+method);const ev=state.events[state.events.length-1];lastReceipt={project:p.name,donor,amount,reference,method,attachment:proofFileName,attachmentBytes:proofFileSize,proofStatus:'SIMULATED — NOT EXTERNALLY VERIFIED',sequence:ev.seq,hash:ev.hash,time:ev.time,mode:'LOCAL DEMO ONLY — NO REAL TOKENS TRANSFERRED'};pending=null;hide('donationModal');resetProof();render();updatePreview();by('receiptSummary').innerHTML=details([['Project',p.name],['Donor',donor],['Amount',fmt(amount)],['Demo reference',reference],['Attachment',proofFileName+' ('+Math.ceil(proofFileSize/1024)+' KB; not stored)'],['Proof status','Fictional / unverified'],['Ledger entry','#'+ev.seq],['Local audit hash',ev.hash.slice(0,20)+'…']]);show('receiptModal');toast('Demo evidence recorded and simulated receipt issued')}catch(err){console.error('Donation confirmation failed:',err);proofError('Unable to issue receipt: '+(err?.message||'unexpected error')+'. Please try again.')}finally{by('confirmDonation').disabled=false} };function resetProof(){by('proofStep').hidden=true;by('modalTitle').textContent='Step 1 · Review your contribution';by('confirmDonation').textContent='Continue to payment proof →';by('proofReference').value='';by('proofNote').value='';by('proofAttest').checked=false;by('proofAttachment').value='';by('proofFileStatus').textContent='No file selected';clearProofError()}
by('cancelDonation').onclick=by('closeDonation').onclick=()=>{pending=null;hide('donationModal');resetProof()};
by('closeReceipt').onclick=()=>hide('receiptModal');
by('receiptLedger').onclick=()=>{hide('receiptModal');go('ledger')};
function download(name,body,type){const blob=new Blob([body],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
by('downloadReceipt').onclick=()=>{if(!lastReceipt)return;download('aidchain-demo-receipt-'+lastReceipt.sequence+'.txt','XNODE AIDCHAIN · SIMULATED DONATION RECEIPT\n'+Object.entries(lastReceipt).map(([k,v])=>k.toUpperCase()+': '+v).join('\n')+'\n', 'text/plain;charset=utf-8')};
by('exportLedger').onclick=()=>{const rows=[['Sequence','Timestamp','Event','Project','Amount Demo USDC','Detail','Previous Hash','Hash'],...state.events.map(e=>[e.seq,e.time,e.type,project(e.pid)?.name||'',e.amount,e.detail,e.prev,e.hash])];const csv=rows.map(r=>r.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\r\n');download('aidchain-audit-ledger.csv',csv,'text/csv;charset=utf-8');toast('Audit ledger exported')};
function filterProjects(){const q=by('projectSearch').value.trim().toLowerCase();const arr=state.projects.filter(p=>(p.name+' '+p.description+' '+(p.location||'')+' '+(p.category||'')+' '+(p.owner||'')).toLowerCase().includes(q));by('projectList').innerHTML=arr.length?arr.map(card).join(''):'<div class="panel empty">No matching projects. Try a different search.</div>'}
by('projectSearch').addEventListener('input',filterProjects);
by('clearSearch').onclick=()=>{by('projectSearch').value='';filterProjects();by('projectSearch').focus()};
by('donationAmount').addEventListener('input',updatePreview);
by('donationProject').addEventListener('change',updatePreview);
document.addEventListener('click',e=>{const b=e.target.closest('[data-amount]');if(b){by('donationAmount').value=b.dataset.amount;updatePreview()}if(e.target.classList.contains('modal-backdrop')){hide(e.target.id);if(e.target.id==='donationModal'){pending=null;resetProof()}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){pending=null;hide('donationModal');hide('receiptModal');resetProof()}});
document.addEventListener('keydown',e=>{
 if(e.key!=='Tab')return;
 const modal=document.querySelector('.modal-backdrop:not([hidden]) .modal');
 if(!modal)return;
 const items=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter(el=>el.offsetParent!==null);
 if(!items.length)return;
 if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus()}
 else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus()}
});
const baseRender=render;render=function(){baseRender();updatePreview();if(by('projectSearch').value.trim())filterProjects()};
updatePreview();
})();
