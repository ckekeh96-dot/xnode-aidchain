
// Optional online adapter: ethers is fetched only when a testnet control is used.
const $t=id=>document.getElementById(id);
const $=id=>document.getElementById(id);
// Supported networks. Anything else is refused at connect time so a valueless demo
// token can never be signed onto a network that holds real funds.
const NETWORKS={
  '0xaa36a7':{key:'0xaa36a7',id:11155111n,name:'Ethereum Sepolia',label:'Sepolia',rpc:'https://ethereum-sepolia-rpc.publicnode.com',explorer:'https://sepolia.etherscan.io',slug:'sepolia'},
  '0x7a69':{key:'0x7a69',id:31337n,name:'local anvil test chain',label:'Local chain 31337',rpc:'http://127.0.0.1:8546',explorer:'',slug:'local'}
};
let net=NETWORKS['0xaa36a7'];
const UNITS=1000000n; // dUSDC uses 6 decimals
const STORE='xnode_aidchain_chain_v1';
const escrowABI=[
 'function token() view returns (address)',
 'function nextProjectId() view returns (uint256)',
 'function createProject(address reviewer,uint256 target,uint256[] allocations) returns (uint256)',
 'function donate(uint256 id,uint256 amount)',
 'function submitEvidence(uint256 id,uint256 milestoneId,bytes32 evidenceHash)',
 'function approveMilestone(uint256 id,uint256 milestoneId)',
 'function rejectMilestone(uint256 id,uint256 milestoneId)',
 'function releaseFunds(uint256 id,uint256 milestoneId)',
 'function refund(uint256 id,uint256 amount)',
 'function available(uint256 id) view returns (uint256)',
 'function refundable(uint256 id,address donor) view returns (uint256)',
 'function contributed(uint256 id,address donor) view returns (uint256)',
 'function refunded(uint256 id,address donor) view returns (uint256)',
 'function projects(uint256 id) view returns (address ngo,address reviewer,uint256 target,uint256 raised,uint256 released,uint256 refunded,uint256 milestoneCount,bool exists)',
 'function milestones(uint256 id,uint256 m) view returns (uint256 amount,bytes32 evidenceHash,bool submitted,bool rejected,bool approved,bool paid)',
 'function milestoneStatus(uint256 id,uint256 m) view returns (uint256 amount,bytes32 evidenceHash,string state)',
 'event ProjectCreated(uint256 indexed projectId,address indexed ngo,address indexed reviewer,uint256 target)',
 'event Donated(uint256 indexed projectId,address indexed donor,uint256 amount)',
 'event EvidenceSubmitted(uint256 indexed projectId,uint256 indexed milestoneId,bytes32 evidenceHash)',
 'event MilestoneApproved(uint256 indexed projectId,uint256 indexed milestoneId,address indexed reviewer)',
 'event MilestoneRejected(uint256 indexed projectId,uint256 indexed milestoneId,address indexed reviewer)',
 'event FundsReleased(uint256 indexed projectId,uint256 indexed milestoneId,address indexed ngo,uint256 amount)',
 'event Refunded(uint256 indexed projectId,address indexed donor,uint256 amount)'
];
const tokenABI=['function mint(address to,uint256 amount)','function approve(address spender,uint256 amount) returns (bool)','function allowance(address owner,address spender) view returns (uint256)','function decimals() view returns (uint8)','function symbol() view returns (string)','function balanceOf(address owner) view returns (uint256)'];
let ethersLib, provider, publicProvider, publicProviderKey='', signer, walletAddress='', escrow, token, busy=false, chainReady=false, receipts=[], audit=[], addressSource='none';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=a=>String(a).slice(0,6)+'…'+String(a).slice(-4);
const fmt=u=>(Number(u)/1e6).toLocaleString('en-US',{maximumFractionDigits:2});
const fmtEth=w=>(Number(w)/1e18).toFixed(4);
// Local chains have no public explorer, so the hash is printed as text instead of a dead link.
const txLink=(hash,text)=>net.explorer?'<a href="'+esc(net.explorer+'/tx/'+hash)+'" target="_blank" rel="noopener noreferrer">'+esc(text)+'</a>':'<span class="hash">'+esc(text)+'</span>';
function log(message,tx){
  const item=document.createElement('p');item.textContent=new Date().toLocaleTimeString()+' · '+message+' ';
  if(tx){
    if(net.explorer){const a=document.createElement('a');a.href=net.explorer+'/tx/'+tx;a.target='_blank';a.rel='noopener noreferrer';a.textContent=tx.slice(0,12)+'… (explorer)';item.append(a)}
    else{const c=document.createElement('code');c.textContent=tx.slice(0,18)+'…';item.append(c)}
  }
  $t('chainLog').prepend(item);
}
function fail(e){const m=String(e?.shortMessage||e?.reason||e?.message||e).slice(0,260);log('Error: '+m);setStatus('Last action failed — '+m)}
async function loadEthers(){if(!ethersLib){const m=await import('https://cdn.jsdelivr.net/npm/ethers@6.13.5/+esm');ethersLib=m.ethers||m}return ethersLib}
async function getPublicProvider(){if(!publicProvider||publicProviderKey!==net.key){publicProvider=new (await loadEthers()).JsonRpcProvider(net.rpc);publicProviderKey=net.key}return publicProvider}
const escrowAddr=()=>$t('escrowAddress').value.trim();
const tokenAddr=()=>$t('tokenAddress').value.trim();
function setStatus(text){$t('walletStatus').textContent=text}

// ---- deployment registry: the config file may carry one entry per network ----
function registeredDeployments(){
  const d=window.AIDCHAIN_DEPLOYMENT||{},out=[];
  if(d.local&&(d.local.escrow||d.local.token))out.push(Object.assign({chainKey:'0x7a69'},d.local));
  if(d.escrow||d.token)out.push({chainKey:'0xaa36a7',escrow:d.escrow,token:d.token,fromBlock:d.fromBlock,network:d.network,deployedAt:d.deployedAt,verifiedOn:d.escrowVerifiedOn});
  return out;
}
const deploymentFor=key=>registeredDeployments().find(x=>x.chainKey===key)||null;
const networkForEscrow=a=>{const m=registeredDeployments().find(x=>String(x.escrow||'').toLowerCase()===String(a||'').toLowerCase());return m?NETWORKS[m.chainKey]:null};
const registeredAddresses=()=>registeredDeployments().flatMap(x=>[String(x.escrow||'').toLowerCase(),String(x.token||'').toLowerCase()]).filter(Boolean);
function setAddresses(d,label){
  $t('escrowAddress').value=d.escrow||'';$t('tokenAddress').value=d.token||'';
  if(d.fromBlock!==undefined&&d.fromBlock!==null&&d.fromBlock!=='')$t('auditFrom').value=String(d.fromBlock);
  $t('deploymentSource').textContent=label;
}
// Fills the address fields for whichever supported network the wallet landed on, without
// ever overwriting addresses the user typed themselves.
function applyDeploymentForCurrentChain(){
  if(addressSource==='prefs'){$t('deploymentSource').textContent='Addresses: restored from this browser (your last manual entry)';return}
  const d=deploymentFor(net.key),current=(escrowAddr()||'').toLowerCase();
  if(d){
    setAddresses(d,'Addresses: auto-loaded for '+net.label+(d.network?' · '+d.network:'')+(d.fromBlock!==undefined&&d.fromBlock!==null&&d.fromBlock!==''?' · scans from block '+d.fromBlock:''));
    addressSource='auto:'+net.key;
  }else if(registeredAddresses().includes(current)){
    setAddresses({escrow:'',token:'',fromBlock:''},'Addresses: the loaded contracts belong to another chain, so they were cleared for '+net.label+'. Deploy on this network, paste its addresses, or switch networks.');
    addressSource='none';
  }
}

function updateChip(){
  const chip=$t('modeChip'),foot=$t('modeFoot'),sub=$t('modeFootSub');
  if(chainReady&&signer){
    chip.className='tag blue';chip.textContent='⬢ Blockchain mode · '+net.label+' · '+short(walletAddress||'wallet');
    foot.textContent='⬢ BLOCKCHAIN MODE';sub.textContent='Donations, approvals and releases on this page are sent to '+net.name+' contracts you deployed. Valueless demo tokens only.';
  }else if(signer){
    chip.className='tag amber';chip.textContent='⬢ Wallet connected · contracts not validated';
    foot.textContent='● DEMO MODE';sub.textContent='Wallet detected on '+net.name+'. Validate deployed contract addresses before any transaction is sent.';
  }else{
    chip.className='tag amber';chip.textContent='● Demo mode · offline simulation';
    foot.textContent='● DEMO MODE';sub.textContent='Simulated USDC, transactions, and approval roles. No real blockchain connection or payments.';
  }
}

async function connect(){
  if(!window.ethereum)throw Error('No injected wallet found. Install MetaMask, then reload this page over http://localhost:8080 (extensions do not inject into file:// pages by default).');
  const E=await loadEthers();
  await window.ethereum.request({method:'eth_requestAccounts'});
  const raw=String(await window.ethereum.request({method:'eth_chainId'})).toLowerCase();
  const found=NETWORKS[raw];
  if(!found)throw Error('Your wallet is on chain '+parseInt(raw,16)+'. This dashboard signs only on Ethereum Sepolia (11155111) or the local anvil chain (31337); other networks, including mainnet, are refused so a valueless demo token can never touch real funds. Switch network in MetaMask, or add the local chain with .build/add-local-chain.html.');
  net=found;
  provider=new E.BrowserProvider(window.ethereum);signer=await provider.getSigner();
  publicProvider=null;publicProviderKey='';
  applyDeploymentForCurrentChain();
  walletAddress=await signer.getAddress();
  attachWalletEvents();
  setStatus('Connected to '+net.name+': '+walletAddress);updateChip();log('Wallet connected on '+net.name+' (chain '+net.id+')');
  await refresh();
}
async function validate(){
  if(!signer)await connect();
  const E=await loadEthers();const e=escrowAddr(),t=tokenAddr();
  if(!E.isAddress(e)||!E.isAddress(t))throw Error('Enter valid deployed escrow and demo token addresses.');
  if((await provider.getCode(e))==='0x'||(await provider.getCode(t))==='0x')throw Error('No deployed code at one or both addresses on '+net.name+'. '+(net.key==='0x7a69'?'Start anvil and run .build/deploy_local.sh (anvil restarting wipes the contracts).':'Deploy them with DEPLOY_SEPOLIA.md, then paste the two addresses here.'));
  escrow=new E.Contract(e,escrowABI,signer);token=new E.Contract(t,tokenABI,signer);
  if((await escrow.token()).toLowerCase()!==t.toLowerCase())throw Error('Escrow contract token does not match the supplied demo token.');
  if(Number(await token.decimals())!==6)throw Error('Demo token must have 6 decimals.');
  chainReady=true;updateChip();savePrefs();
  log('Contracts verified on '+net.name+'. Escrow '+short(e)+' · token '+short(t));
  await refresh();
}
async function ready(){if(!escrow||!token)await validate();const now=(await provider.getNetwork()).chainId;if(now!==net.id)throw Error('Your wallet is now on chain '+now+' but the page is bound to '+net.name+'. Reconnect to re-bind before sending anything.')}

// Each metric is read independently; an unreadable metric is named instead of showing a stale or blank value.
async function refresh(){
  if(!signer){setStatus('Wallet not connected');return}
  const who=await signer.getAddress();walletAddress=who;const missing=[];
  let gas='—',bal='—',allow='—',held='—',detail='';
  try{gas=fmtEth(await provider.getBalance(who))+' ETH'}catch{missing.push('gas balance')}
  if(chainReady){
    try{bal=fmt(await token.balanceOf(who))}catch{missing.push('demo balance')}
    try{allow=fmt(await token.allowance(who,escrowAddr()))+' approved'}catch{missing.push('allowance')}
    try{
      const id=projectId(),p=await escrow.projects(id);
      if(!p.exists)throw Error('project not found');
      held=fmt(await escrow.available(id));
      detail='Project #'+id+' · target '+fmt(p.target)+' · raised '+fmt(p.raised)+' · released '+fmt(p.released)+' · refunded '+fmt(p.refunded)+' · '+Number(p.milestoneCount)+' milestone(s)';
    }catch{missing.push('project state')}
  }
  $t('chainReadout').innerHTML='<div class="grid2">'
    +'<div class="metric"><small>Wallet</small><strong>'+esc(short(who))+'</strong><em>gas '+esc(gas)+'</em></div>'
    +'<div class="metric"><small>Demo balance</small><strong>'+esc(bal)+' dUSDC</strong><em>'+esc(allow)+'</em></div>'
    +'<div class="metric"><small>Escrow holds</small><strong>'+esc(held)+' dUSDC</strong><em>releasable now</em></div></div>'
    +(detail?'<p class="small">'+esc(detail)+'</p>':'')
    +(missing.length?'<p class="small notice">Not readable this refresh: '+esc(missing.join(', '))+'</p>':'');
}

function amount(id){const v=$(id).value.trim();if(!/^[1-9]\d*$/.test(v)||BigInt(v)>1000000n)throw Error('Enter a positive whole demo-token amount (maximum 1,000,000).');return BigInt(v)*UNITS}
function projectId(){const v=$t('chainProject').value.trim();if(!/^[1-9]\d*$/.test(v))throw Error('Enter a valid on-chain project ID.');return BigInt(v)}
function milestoneId(){const v=$t('chainMilestone').value.trim();if(!/^(0|[1-9]\d*)$/.test(v))throw Error('Enter a valid milestone ID starting at 0.');return BigInt(v)}
async function tx(label,fn){const t=await fn();log(label+' submitted',t.hash);const r=await t.wait();if(r.status!==1)throw Error(label+' reverted on-chain in block '+r.blockNumber+' — no receipt issued.');log(label+' confirmed',t.hash);return r}
async function action(fn){if(busy)return;busy=true;try{await fn()}catch(e){fail(e)}finally{busy=false;for(const b of ['chainDonate','chainRefund','chainRelease'])if($(b))$(b).disabled=false}}

// ---- on-chain receipts: built only from a mined, successful transaction ----
async function issueReceipt(kind,id,receipt,amountValue,who){
  // ethers v6 exposes confirmations as an async getter method, not a number.
  let conf='1+';try{const c=await receipt.confirmations();if(c!==null&&c!==undefined)conf=String(c)}catch{}
  lastReceipt={
    kind,project:String(id),amountDUSDC:fmt(amountValue),wallet:who,
    network:net.name,chainId:String(net.id),
    escrowContract:escrowAddr(),tokenContract:tokenAddr(),
    transactionHash:receipt.hash,blockNumber:Number(receipt.blockNumber),
    confirmations:conf,status:receipt.status===1?'success':'reverted',
    gasUsed:receipt.gasUsed?.toString()??'',explorer:net.explorer?net.explorer+'/tx/'+receipt.hash:'',
    recordedAt:new Date().toISOString(),
    note:'Valueless demonstration token on '+net.name+'. The confirmed transaction is the payment proof.'
  };
  receipts.unshift(lastReceipt);if(receipts.length>40)receipts.pop();
  renderReceipts();showReceipt(lastReceipt);
  try{localStorage.setItem(STORE+'.receipts',JSON.stringify(receipts))}catch{log('Receipts kept in this session only; browser storage unavailable.')}
}
let lastReceipt=null;
function showReceipt(r){
  lastReceipt=r;
  $t('chainReceiptKicker').textContent=(r.network||net.label).toUpperCase()+' · CONFIRMED TRANSACTION';
  $t('chainReceiptSummary').innerHTML='<div class="milestone"><div class="row"><b>'+esc(r.kind)+'</b><span class="tag blue">'+esc(r.amountDUSDC)+' dUSDC</span></div>'
    +'<p class="hash">'+esc(r.transactionHash)+'</p>'
    +'<p class="small">Block '+esc(r.blockNumber)+' · '+esc(r.confirmations)+' confirmation(s) · status '+esc(r.status)+' · gas used '+esc(r.gasUsed)+'</p>'
    +'<p class="small">Network: '+esc(r.network||net.name)+' (chain '+esc(r.chainId||net.id)+')<br/>Wallet: '+esc(r.wallet)+'<br/>Escrow: '+esc(r.escrowContract)+'<br/>Token: '+esc(r.tokenContract)+'</p>'
    +'<p class="small">Project #'+esc(r.project)+' · recorded '+esc(r.recordedAt)+'</p>'
    +'<p class="small muted">'+esc(r.note)+'</p></div>'
    +(r.explorer?'<p class="small"><a href="'+esc(r.explorer)+'" target="_blank" rel="noopener noreferrer">Open this transaction on the '+esc(r.network||net.label)+' explorer ↗</a></p>':'<p class="small muted">Local test chain: there is no public explorer, so the transaction hash above is the record.</p>');
  $t('chainReceiptModal').hidden=false;document.body.style.overflow='hidden';$t('closeChainReceipt').focus();
}
function closeReceipt(){$t('chainReceiptModal').hidden=true;document.body.style.overflow='';$t('chainDonate').focus()}
function renderReceipts(){
  if(!receipts.length){$t('receiptList').textContent='No on-chain receipts issued yet.';return}
  $t('receiptList').innerHTML=receipts.map((r,i)=>'<div class="event"><span class="dot"></span><div><strong>'+esc(r.kind)+' · '+esc(r.amountDUSDC)+' dUSDC · project #'+esc(r.project)+'</strong><p>'+esc(r.network||'network not recorded')+' · block '+esc(r.blockNumber)+' · '+(r.explorer?'<a href="'+esc(r.explorer)+'" target="_blank" rel="noopener noreferrer">'+esc(String(r.transactionHash).slice(0,14))+'…</a>':'<span class="hash">'+esc(String(r.transactionHash).slice(0,18))+'…</span>')+' <button class="btn ghost" data-showreceipt="'+i+'" type="button">view</button></p></div></div>').join('');
}

// ---- audit ledger read from chain events ----
async function syncAudit(){
  const E=await loadEthers();const e=escrowAddr();
  if(!E.isAddress(e))throw Error('Enter the escrow contract address first.');
  if(!provider){const reg=networkForEscrow(e);if(reg)net=reg}          // no wallet: follow the chain the typed address was deployed on
  const rp=provider||await getPublicProvider();
  const source=provider?('the connected wallet provider on '+net.name):('read-only RPC '+net.rpc.replace(/^https?:\/\//,'')+' on '+net.name);
  const view=new E.Contract(e,escrowABI,rp);
  const to=await rp.getBlockNumber();
  const manual=$t('auditFrom').value.trim();
  const from=manual===''?Math.max(0,to-4999):Number(manual);
  if(!Number.isSafeInteger(from)||from<0)throw Error('Enter a from-block of 0 or more.');
  if(from>to)throw Error('From block '+from+' is ahead of the current block '+to+'.');
  $t('auditSummary').textContent='Scanning blocks '+from+'–'+to+' …';
  let logs=[];
  // getLogs + the manual parseLog loop below instead of queryFilter(null,…): the v6
  // queryFilter throws on a null fragment, and this form is stable across ethers releases.
  try{logs=await rp.getLogs({address:e,fromBlock:from,toBlock:to})}
  catch(err){
    audit=[];$t('auditRows').innerHTML='<tr><td colspan="5">Event scan failed — see the note above.</td></tr>';
    $t('auditSummary').innerHTML='<p class="notice">Could not read events from '+esc(net.name)+': '+esc(String(err?.shortMessage||err?.message||err).slice(0,240))+'. This is a read failure, not evidence of zero activity. Try a smaller block range or another RPC.</p>';
    return;
  }
  const parsed=[];let undecodable=0;
  for(const l of logs){
    try{const p=view.interface.parseLog(l);parsed.push({block:l.blockNumber,tx:l.transactionHash,name:p.name,args:p.args,logIndex:Number(l.logIndex??l.index??0)})}
    catch{undecodable++}
  }
  parsed.sort((a,b)=>b.block-a.block||a.logIndex-b.logIndex);
  audit=parsed;
  $t('auditSummary').innerHTML='<p>Found <b>'+parsed.length+'</b> AidChain event(s) in <b>'+logs.length+'</b> log(s) across blocks <b>'+from+'–'+to+'</b> ('+(to-from+1).toLocaleString()+' blocks) via '+esc(source)+'. Undecodable logs: '+undecodable+'.</p><p class="small muted">Last sync '+new Date().toLocaleString()+'. A window starting at block '+from+' cannot show earlier activity — set an earlier from-block to cover history before it.</p>';
  renderAudit();
  log('Audit sync complete: '+parsed.length+' event(s) scanned from block '+from+' on '+net.name);
}
function renderAudit(){
  const filter=$t('auditProjectFilter').value.trim();
  const shown=filter===''?audit:audit.filter(p=>{const a=p.args||{};return String(a.projectId??a.id??'')===filter});
  $t('auditRows').innerHTML=shown.length?shown.map(p=>{
    const a=p.args||{};
    const id=a.projectId??a.id??'—';
    const raw=a.amount??(a.target!==undefined&&p.name==='ProjectCreated'?a.target:null);
    const amt=raw==null?'—':fmt(BigInt(raw));
    const actor=a.donor||a.ngo||a.reviewer||'—';
    return '<tr><td>'+p.block+'<br>'+txLink(p.tx,p.tx.slice(0,12)+'…')+'</td>'
      +'<td><b>'+esc(p.name.replaceAll('_',' '))+'</b>'+(a.milestoneId!==undefined?'<br><span class="muted small">milestone '+esc(a.milestoneId)+'</span>':'')+'</td>'
      +'<td>#'+esc(id)+'</td><td>'+esc(amt)+'</td><td class="hash">'+esc(typeof actor==='string'?short(actor):'—')+'</td></tr>';
  }).join(''):'<tr><td colspan="5">No AidChain events matched this range'+(filter?' and project #'+esc(filter):'')+'.</td></tr>';
}
function csvCell(v){const s=String(v??'');return '"'+(s.startsWith('=')||s.startsWith('+')||s.startsWith('-')||s.startsWith('@')?"'"+s:s).replaceAll('"','""')+'"'}
function exportAudit(){
  if(!audit.length){log('Nothing to export — sync events from the chain first');return}
  const head=['block','transactionHash','event','projectId','milestoneId','amountDUSDC','amountRaw','actor','evidenceHash'];
  const lines=[head.join(',')].concat(audit.map(p=>{
    const a=p.args||{};const raw=a.amount??a.target??'';
    return [p.block,p.tx,p.name,(a.projectId??a.id??''),(a.milestoneId??''),raw===''?'':fmt(BigInt(raw)),raw,(a.donor||a.ngo||a.reviewer||''),(a.evidenceHash??'')].map(csvCell).join(',');
  }));
  download(lines.join('\r\n'),'text/csv;charset=utf-8','aidchain-'+net.slug+'-audit-'+Date.now()+'.csv');
  log('Exported '+audit.length+' on-chain event(s) to CSV');
}
function download(content,type,name){
  const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function savePrefs(){try{localStorage.setItem(STORE,JSON.stringify({escrow:escrowAddr(),token:tokenAddr(),from:$t('auditFrom').value.trim()}))}catch{}}
function loadPrefs(){try{return JSON.parse(localStorage.getItem(STORE))||{}}catch{return {}}}
function initAddresses(){
  const d=window.AIDCHAIN_DEPLOYMENT||{},p=loadPrefs();
  if(p.escrow||p.token){
    setAddresses(p,'Addresses: restored from this browser (your last manual entry)');
    addressSource='prefs';
  }else if(d.escrow||d.token){
    setAddresses({escrow:d.escrow,token:d.token,fromBlock:d.fromBlock},'Addresses: auto-loaded from deployments/sepolia.config.js'
      +(d.network?' · network '+d.network:'')+(d.escrowVerifiedOn?' · escrow verified on explorer '+d.escrowVerifiedOn:''));
    addressSource='auto:0xaa36a7';
  }else if(d.local&&(d.local.escrow||d.local.token)){
    setAddresses(d.local,'Addresses: pre-filled for the local anvil chain (31337) · '+((d.local.network)?d.local.network+' · ':'')+'they apply when your wallet is on that network. For the public demo, deploy on Sepolia with DEPLOY_SEPOLIA.md.');
    addressSource='auto:0x7a69';
  }else $t('deploymentSource').textContent='Addresses: none loaded — deploy with the Remix guide (Sepolia) or run .build/deploy_local.sh (local chain)';
  try{const r=JSON.parse(localStorage.getItem(STORE+'.receipts')||'[]');if(Array.isArray(r)){receipts=r;renderReceipts()}}catch{}
}

// ---- contract actions ----
$t('connectWallet').onclick=()=>action(connect);
$t('checkContracts').onclick=()=>action(validate);
$t('refreshChain').onclick=()=>action(refresh);
$t('escrowAddress').onchange=savePrefs;$t('tokenAddress').onchange=savePrefs;$t('auditFrom').onchange=savePrefs;
$t('chainCreate').onclick=()=>action(async()=>{
  await ready();const E=await loadEthers();
  const reviewer=$t('chainReviewer').value.trim();
  if(!E.isAddress(reviewer))throw Error('Enter a valid independent reviewer address.');
  const target=amount('chainTarget');
  if(target%4n!==0n)throw Error('Choose a target divisible by 4 for the 25/50/25 allocation.');
  const id=await escrow.nextProjectId();
  await tx('Create project #'+id,()=>escrow.createProject(reviewer,target,[target/4n,target/2n,target/4n]));
  $t('chainProject').value=String(id);await refresh();
});
$t('chainMint').onclick=()=>action(async()=>{await ready();const who=await signer.getAddress();await tx('Mint demonstration tokens',()=>token.mint(who,amount('chainAmount')));await refresh()});
$t('chainDonate').onclick=()=>action(async()=>{
  await ready();const a=amount('chainAmount'),id=projectId();
  const p=await escrow.projects(id);
  if(!p.exists)throw Error('Project does not exist on '+net.name+'.');
  if(p.raised+a>p.target)throw Error('Contribution exceeds project target.');
  $t('chainDonate').disabled=true;
  await tx('Approve dUSDC allowance',()=>token.approve(escrowAddr(),a));
  const r=await tx('Donate to project #'+id,()=>escrow.donate(id,a));
  await issueReceipt('Donation',id,r,a,await signer.getAddress());
  await refresh();
});
$t('chainSubmit').onclick=()=>action(async()=>{
  await ready();const E=await loadEthers(),ev=$t('chainEvidence').value.trim();
  if(ev.length<8||ev.length>300)throw Error('Evidence reference must be 8–300 characters.');
  await tx('Submit evidence hash',()=>escrow.submitEvidence(projectId(),milestoneId(),E.keccak256(E.toUtf8Bytes(ev))));
  await refresh();
});
$t('chainApprove').onclick=()=>action(async()=>{await ready();await tx('Approve milestone',()=>escrow.approveMilestone(projectId(),milestoneId()));await refresh()});
$t('chainReject').onclick=()=>action(async()=>{await ready();await tx('Reject milestone evidence',()=>escrow.rejectMilestone(projectId(),milestoneId()));await refresh()});
$t('chainRelease').onclick=()=>action(async()=>{
  await ready();const id=projectId(),m=milestoneId();
  const ms=await escrow.milestones(id,m);
  $t('chainRelease').disabled=true;
  const r=await tx('Release approved milestone',()=>escrow.releaseFunds(id,m));
  await issueReceipt('Milestone release',id,r,ms.amount,await signer.getAddress());
  await refresh();
});
$t('chainReadState').onclick=()=>action(async()=>{
  await ready();const id=projectId(),m=milestoneId();
  const s=await escrow.milestoneStatus(id,m),p=await escrow.projects(id);
  $t('chainState').innerHTML='<b>Project #'+id+' · milestone '+m+'</b><br/>Contract state: <b>'+esc(s.state)+'</b> · allocation '+fmt(s.amount)+' dUSDC<br/>Evidence hash: <span class="hash">'+esc(s.evidenceHash)+'</span><br/>Project: raised '+fmt(p.raised)+' · released '+fmt(p.released)+' · refunded '+fmt(p.refunded)+' · available '+fmt(await escrow.available(id))+' dUSDC';
});
$t('chainReadRefundable').onclick=()=>action(async()=>{
  await ready();const id=projectId(),who=await signer.getAddress();
  const r=await escrow.refundable(id,who);
  $t('refundOut').innerHTML='Refundable for '+esc(short(who))+' on project #'+id+': <b>'+fmt(r)+' dUSDC</b> (contributed '+fmt(await escrow.contributed(id,who))+', already refunded '+fmt(await escrow.refunded(id,who))+')';
});
$t('chainRefund').onclick=()=>action(async()=>{
  await ready();const id=projectId(),who=await signer.getAddress();
  const cap=await escrow.refundable(id,who);
  const manual=$t('refundAmount').value.trim();
  if(manual!==''&&!/^[1-9]\d*$/.test(manual))throw Error('Enter a whole dUSDC amount, or leave blank for the maximum.');
  const a=manual===''?cap:BigInt(manual)*UNITS;
  if(cap<=0n)throw Error('Nothing refundable for this wallet on that project.');
  if(a>cap)throw Error('Requested refund exceeds refundable ('+fmt(cap)+' dUSDC).');
  $t('chainRefund').disabled=true;
  const r=await tx('Claim donor refund',()=>escrow.refund(id,a));
  await issueReceipt('Donor refund',id,r,a,who);
  await refresh();
});
$t('clearChainLog').onclick=()=>{$t('chainLog').textContent='No transactions sent.'};
$t('closeChainReceipt').onclick=closeReceipt;
$t('chainReceiptModal').addEventListener('click',e=>{if(e.target===$t('chainReceiptModal'))closeReceipt()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$t('chainReceiptModal').hidden)closeReceipt()});
$t('downloadChainReceipt').onclick=()=>{if(!lastReceipt)return;download(JSON.stringify(lastReceipt,null,2),'application/json','aidchain-receipt-'+String(lastReceipt.transactionHash).slice(0,10)+'.json')};
$t('chainReceiptAudit').onclick=()=>{closeReceipt();document.querySelector('#nav button[data-view="audit"]')?.click()};
$t('auditSync').onclick=()=>action(syncAudit);
$t('auditExport').onclick=()=>action(exportAudit);
$t('auditProjectFilter').onchange=renderAudit;
$t('receiptList').addEventListener('click',e=>{const b=e.target.closest('button[data-showreceipt]');if(b)showReceipt(receipts[Number(b.dataset.showreceipt)])});

// ---- one-click local demo: probe the local chain, install the demo wallet, auto-connect ----
const LOCAL_RPC='http://127.0.0.1:8546';
const DEMO_NAMES=['deployer (contract owner)','NGO','independent reviewer','donor'];
let localDemoOn=false;
async function probeLocalChain(){
  try{
    const r=await fetch(LOCAL_RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})});
    const j=await r.json();return j&&j.result==='0x7a69'?'0x7a69':null;
  }catch{return null}
}
function setLocalDemoState(label,cls,html){const s=$t('localDemoState');s.textContent=label;s.className='tag '+cls;if(html!==undefined)$t('localDemoStatus').innerHTML=html}
async function refreshLocalDemoStatus(){
  if(localDemoOn)return;
  if(location.protocol==='file:')return setLocalDemoState('needs localhost','amber','The one-click demo needs this page served over <b>http://localhost:8080</b> — a file:// page cannot load the demo-wallet script or reach the chain.');
  const id=await probeLocalChain();
  if(localDemoOn)return;
  if(id)setLocalDemoState('chain detected','blue','Local anvil chain detected at 127.0.0.1:8546 (chain 31337). One click installs the demo wallet, connects it and validates the deployed contracts — no MetaMask needed.');
  else setLocalDemoState('chain not found','amber','No local chain answered at 127.0.0.1:8546 yet. Start it in the <b>aidchain-v6</b> folder: <code>anvil --port 8546</code> in one terminal, then <code>bash .build/deploy_local.sh</code> once to deploy the contracts. This panel re-checks automatically.');
}
function loadDemoWalletScript(){
  if(window.demoWallet)return Promise.resolve();
  return new Promise((res,rej)=>{
    const s=document.createElement('script');s.src='.build/demo-wallet.js';
    s.onload=()=>window.demoWallet?res():rej(Error('.build/demo-wallet.js loaded but did not install the demo wallet.'));
    s.onerror=()=>rej(Error('Could not load .build/demo-wallet.js — keep the .build folder next to index.html (it ships with the package).'));
    document.head.append(s);
  });
}
function showLocalDemoStatusLine(i){
  setLocalDemoState('demo wallet active','blue','Demo wallet connected as '+DEMO_NAMES[i]+' '+short(walletAddress)+' on the local chain. Switch roles below — each switch reconnects and re-validates automatically.');
}
async function launchLocalDemo(){
  if(location.protocol==='file:')throw Error('Serve this page over http://localhost:8080 first — a file:// page cannot load the demo wallet.');
  if(!await probeLocalChain())throw Error('No local chain answered at 127.0.0.1:8546 yet. Start anvil --port 8546, run bash .build/deploy_local.sh once, then click again (the status above re-checks automatically).');
  await loadDemoWalletScript();
  const replaced=!!window.demoWallet.previous;
  await connect();
  await validate();
  localDemoOn=true;
  if(!$t('chainReviewer').value.trim())$t('chainReviewer').value=window.demoWallet.accounts[2];
  $t('localDemoRole').disabled=false;
  $t('localDemoRole').value='0';
  $t('localDemoGuide').hidden=false;
  $t('localDemoLaunch').textContent='Reconnect demo wallet';
  showLocalDemoStatusLine(0);
  if(replaced)$t('localDemoStatus').innerHTML+=' A browser wallet was present; the demo wallet takes precedence for this page until reload (or call demoWallet.restore() in the console).';
  log('One-click demo wallet active as '+DEMO_NAMES[0]+' '+walletAddress);
}
async function switchLocalRole(){
  if(!localDemoOn)return;
  const i=Number($t('localDemoRole').value);
  if(window.demoWallet.current()!==window.demoWallet.accounts[i]){window.demoWallet.setAccount(i);log('Demo wallet acting account switched to '+DEMO_NAMES[i])}
  await connect();
  await validate();
  showLocalDemoStatusLine(i);
}
$t('localDemoLaunch').onclick=()=>action(launchLocalDemo);
$t('localDemoRole').onchange=()=>action(switchLocalRole);
refreshLocalDemoStatus();
setInterval(()=>{if(!localDemoOn)refreshLocalDemoStatus()},5000);

// Attached at load when a wallet is present, and again at the end of every successful
// connect() so a wallet installed after load (e.g. the one-click demo wallet) still
// gets the account/network change hooks.
let walletEventsOn=false;
function attachWalletEvents(){
  if(walletEventsOn||!window.ethereum?.on)return;
  walletEventsOn=true;
  window.ethereum.on('accountsChanged',()=>{signer=null;escrow=null;token=null;chainReady=false;provider=null;walletAddress='';setStatus('Wallet changed — reconnect and validate again');updateChip()});
  window.ethereum.on('chainChanged',()=>{signer=null;escrow=null;token=null;chainReady=false;provider=null;setStatus('Network changed — reconnect and validate again');updateChip()});
}
attachWalletEvents();
initAddresses();updateChip();
