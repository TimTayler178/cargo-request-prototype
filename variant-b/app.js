const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const fixes=document.createElement('link');
fixes.rel='stylesheet';
fixes.href='overrides.css';
document.head.append(fixes);
const modal=$('#routeModal');
const form=$('#routeForm');
const rows=$('#routeRows');
const openBtn=$('#routeOpen');
openBtn.before(rows);
const toast=$('#toast');
const loadingSelect=$('#loadingSelect');
const unloadingSelect=$('#unloadingSelect');
let points=[];
let editingIndex=null;
let cargoCount=1;
let signingValidationActive=false;

const note=text=>{toast.textContent=text;toast.classList.add('show');clearTimeout(window.noteTimer);window.noteTimer=setTimeout(()=>toast.classList.remove('show'),1800)};

const addressItems=[
  '620024, Свердловская область, г. Екатеринбург, ул. Монтажников, д. 16, корп. 2',
  '394030, Воронежская область, г. Воронеж, ул. Ленина, д. 73',
  '630088, Новосибирская область, г. Новосибирск, ул. Московское шоссе, 79, корп. 3',
  '109052, г. Москва, ул. Нижегородская, д. 29–33, стр. 15'
];

const addressSource=$('#pointAddress');
addressSource.id='pointAddressSource';
addressSource.hidden=true;
const combo=document.createElement('div');
combo.className='combo';
combo.innerHTML='<input id="pointAddress" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="addressMenu"><span class="combo-arrow">⌄</span><div class="combo-menu" id="addressMenu" role="listbox"></div>';
addressSource.replaceWith(combo);
combo.querySelector('.combo-arrow').textContent='';
const comboInput=$('#pointAddress');
const comboMenu=$('#addressMenu');

drawAddresses=function(){
  const query=comboInput.value.trim().toLowerCase();
  const found=addressItems.filter(address=>address.toLowerCase().includes(query));
  const options=found.length
    ? found.map(address=>`<div class="combo-option${address===comboInput.value?' selected':''}" role="option">${address}</div>`).join('')
    : '<div class="combo-empty">\u041f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0445 \u0430\u0434\u0440\u0435\u0441\u043e\u0432 \u043d\u0435\u0442</div>';
  comboMenu.innerHTML=`<div class="combo-options-scroll">${options}</div><button class="combo-manual" type="button"><span aria-hidden="true"></span>\u0412\u0432\u0435\u0441\u0442\u0438 \u0432\u0440\u0443\u0447\u043d\u0443\u044e</button>`;
  combo.classList.add('open');
  comboInput.setAttribute('aria-expanded','true');
};

const timezoneSelect=$('#timezone');
if(![...timezoneSelect.options].some(option=>option.textContent.startsWith('UTC+05'))){
  const option=document.createElement('option');
  option.textContent='UTC+05 \u2014 \u0415\u043a\u0430\u0442\u0435\u0440\u0438\u043d\u0431\u0443\u0440\u0433';
  timezoneSelect.append(option);
}

function setTimezoneFromAddress(address){
  const normalized=address.toLowerCase();
  const code=/\u043d\u043e\u0432\u043e\u0441\u0438\u0431\u0438\u0440/.test(normalized)?'UTC+07':/\u0435\u043a\u0430\u0442\u0435\u0440\u0438\u043d\u0431\u0443\u0440\u0433|\u0441\u0432\u0435\u0440\u0434\u043b\u043e\u0432/.test(normalized)?'UTC+05':'UTC+03';
  const option=[...timezoneSelect.options].find(item=>item.textContent.startsWith(code));
  if(address.trim()&&option)nativeValue('#timezone',option.value);
}

comboInput.addEventListener('input',()=>setTimezoneFromAddress(comboInput.value));
comboMenu.addEventListener('mousedown',event=>{
  const manual=event.target.closest('.combo-manual');
  if(manual){
    event.preventDefault();
    comboInput.value='';
    setFias(false);
    combo.classList.remove('open');
    comboInput.setAttribute('aria-expanded','false');
    requestAnimationFrame(()=>comboInput.focus());
    return;
  }
  if(event.target.closest('.combo-option'))requestAnimationFrame(()=>setTimezoneFromAddress(comboInput.value));
});

function drawAddresses(){
  const query=comboInput.value.trim().toLowerCase();
  const found=addressItems.filter(x=>x.toLowerCase().includes(query));
  comboMenu.innerHTML=found.length?found.map(x=>`<div class="combo-option${x===comboInput.value?' selected':''}" role="option">${x}</div>`).join(''):'<div class="combo-empty">Подходящих адресов нет — можно сохранить введённый адрес</div>';
  combo.classList.add('open');
  comboInput.setAttribute('aria-expanded','true');
}
comboInput.addEventListener('focus',drawAddresses);
comboInput.addEventListener('click',drawAddresses);
comboInput.addEventListener('input',()=>{drawAddresses();$('#fiasText').textContent=comboInput.value?'Определим после сохранения адреса':'Определим после ввода адреса';$('#fiasText').classList.add('placeholder')});
comboMenu.addEventListener('mousedown',event=>{const option=event.target.closest('.combo-option');if(!option)return;event.preventDefault();comboInput.value=option.textContent;combo.classList.remove('open');comboInput.setAttribute('aria-expanded','false');setFias(true)});

loadingSelect.classList.add('route-loading');
unloadingSelect.classList.add('route-unloading');
const cargoOriginal=$('#cargo');
cargoOriginal.id='cargo-1';
cargoOriginal.querySelector('.cargo-title .button').textContent='\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u0441 \u0440\u0430\u0437\u0434\u0435\u043b\u043e\u043c';
cargoOriginal.querySelector('.cargo-title + .toggle-row')?.remove();

function formatCargoRouteLabels(cargo){
  cargo.querySelectorAll('.cargo-route > label').forEach(label=>{
    if(label.querySelector(':scope > .cargo-route-caption'))return;
    const required=label.querySelector(':scope > span');
    if(!required)return;
    const caption=document.createElement('div');
    caption.className='cargo-route-caption';
    const text=[...label.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('').trim();
    caption.textContent=text;
    caption.append(required);
    [...label.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>node.remove());
    label.prepend(caption);
  });
}

formatCargoRouteLabels(cargoOriginal);
const cargoNavTitle=$('.cargo-nav > a:first-child span:first-child');
cargoNavTitle.textContent='\u0421\u0432\u0435\u0434\u0435\u043d\u0438\u044f \u043e \u0433\u0440\u0443\u0437\u0435';
cargoNavTitle.classList.add('nav-disclosure');
const cargoTemplate=cargoOriginal.cloneNode(true);

const ownerHeading=[...form.querySelectorAll('h3')].find(heading=>heading.textContent.includes('\u0412\u043b\u0430\u0434\u0435\u043b\u0435\u0446 \u043e\u0431\u044a\u0435\u043a\u0442\u0430'));
const ownerBlock=document.createElement('div');
ownerBlock.className='owner-block';
ownerHeading.before(ownerBlock);
let ownerNode=ownerHeading;
for(let index=0;index<4&&ownerNode;index++){
  const next=ownerNode.nextElementSibling;
  ownerBlock.append(ownerNode);
  ownerNode=next;
}
function syncOwnerBlock(){
  ownerBlock.hidden=$('#pointType').value!=='\u041f\u043e\u0433\u0440\u0443\u0437\u043a\u0430';
}
syncOwnerBlock();

function enhanceSelect(native){
  native.required=false;
  native.classList.add('ds-select-native');
  const host=document.createElement('div');
  host.className='ds-select';
  const button=document.createElement('button');
  button.type='button';button.className='ds-select-button';button.setAttribute('role','combobox');button.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');
  menu.className='ds-select-menu';menu.setAttribute('role','listbox');
  native.parentNode.insertBefore(host,native);host.append(native,button,menu);
  const sync=()=>{
    const options=[...native.options];
    const current=native.selectedOptions[0];
    button.textContent=current?.textContent.trim()||'';
    button.disabled=native.disabled;
    menu.innerHTML=options.filter((option,index)=>option.textContent.trim()&&!(index===0&&/^(Не выбрано|Ничего не выбрано)$/.test(option.textContent.trim()))).map(option=>`<div class="ds-select-option${option.selected?' selected':''}" role="option" data-value="${option.value.replace(/"/g,'&quot;')}">${option.textContent}</div>`).join('');
  };
  native._syncSelect=sync;sync();
  button.addEventListener('click',()=>{if(button.disabled)return;$$('.ds-select.open').forEach(x=>{if(x!==host)x.classList.remove('open')});combo.classList.remove('open');host.classList.toggle('open');button.setAttribute('aria-expanded',host.classList.contains('open'))});
  menu.addEventListener('mousedown',event=>{const item=event.target.closest('.ds-select-option');if(!item)return;event.preventDefault();native.value=item.dataset.value;native.dispatchEvent(new Event('change',{bubbles:true}));sync();host.classList.remove('open');button.setAttribute('aria-expanded','false');button.focus()});
  new MutationObserver(sync).observe(native,{childList:true,subtree:true,attributes:true});
}

function updateSidebar(){
  $$('.cargo-nav .sub').forEach(x=>x.remove());
  const nav=$('.cargo-nav');
  const header=$('.cargo-nav > a:first-child');
  header.querySelector('span:last-child').textContent=`${cargoCount}　＋`;
  for(let i=1;i<=cargoCount;i++)nav.insertAdjacentHTML('beforeend',`<a class="sub" href="#cargo-${i}">${i} Груз №${i}</a>`);
}

function cargoSnapshot(cargo){
  return [...cargo.querySelectorAll('input,textarea,select')].filter(control=>!control.classList.contains('variant-b-count')).map(control=>({
    value:control.value,
    checked:'checked' in control?control.checked:undefined
  }));
}

function restoreCargoSnapshot(cargo,snapshot){
  [...cargo.querySelectorAll('input,textarea,select')].filter(control=>!control.classList.contains('variant-b-count')).forEach((control,index)=>{
    const saved=snapshot[index];
    if(!saved)return;
    if(control.type==='checkbox'||control.type==='radio')control.checked=saved.checked;
    else control.value=saved.value;
    if(control.tagName==='SELECT')control._syncSelect?.();
  });
}

function setupCargoRequiredControls(cargo){
  cargo.querySelectorAll('.line').forEach(line=>{
    if(!line.querySelector(':scope > label span'))return;
    line.querySelectorAll('input,textarea,select').forEach(control=>control.dataset.cargoRequired='true');
  });
  cargo.querySelectorAll('.cargo-route > label').forEach(label=>{
    if(!label.querySelector('.cargo-route-caption > span'))return;
    label.querySelectorAll('input,select').forEach(control=>control.dataset.cargoRequired='true');
  });
}

function cargoRequiredVisual(control){
  return control.tagName==='SELECT'?control.closest('.ds-select'):control;
}

function validateCargoSection(cargo){
  let valid=true;
  cargo.querySelectorAll('[data-cargo-required="true"]').forEach(control=>{
    const filled=Boolean(String(control.value).trim());
    cargoRequiredVisual(control).classList.toggle('field-invalid',!filled);
    if(!filled)valid=false;
  });
  return valid;
}

function validateRouteSection(){
  const hasLoading=points.some(point=>point.type==='\u041f\u043e\u0433\u0440\u0443\u0437\u043a\u0430');
  const hasUnloading=points.some(point=>point.type==='\u0412\u044b\u0433\u0440\u0443\u0437\u043a\u0430');
  const supplyToggle=$('#route .toggle-row input');
  const hasSupplyPoint=supplyToggle.checked||points.some(point=>point.supply);
  const pointsValid=hasLoading&&hasUnloading;
  openBtn.classList.toggle('field-invalid',!pointsValid);
  supplyToggle.closest('.toggle-row').classList.toggle('field-invalid',!hasSupplyPoint);
  return pointsValid&&hasSupplyPoint;
}

function setupCargoActions(cargo){
  setupCargoRequiredControls(cargo);
  cargo.querySelector('.side-note')?.closest('.line')?.classList.add('cargo-state-line');
  if(cargo.querySelector('.cargo-actions-menu'))return;
  const title=cargo.querySelector('.cargo-title');
  const trigger=title.querySelector('.button');
  trigger.classList.add('cargo-actions-trigger');
  trigger.setAttribute('aria-haspopup','menu');
  trigger.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');
  menu.className='cargo-actions-menu';
  menu.setAttribute('role','menu');
  menu.innerHTML=`<button type="button" data-cargo-action="delete">\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0440\u0430\u0437\u0434\u0435\u043b</button><button type="button" data-cargo-action="copy">\u041a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0440\u0430\u0437\u0434\u0435\u043b</button><button type="button" data-cargo-action="clear">\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0440\u0430\u0437\u0434\u0435\u043b</button>`;
  title.append(menu);
}

function renumberCargoBlocks(){
  const cargos=$$('.panel.cargo');
  cargoCount=cargos.length;
  cargos.forEach((cargo,index)=>{
    const number=index+1;
    cargo.id=`cargo-${number}`;
    cargo.querySelector('h2 span').textContent=`\u0413\u0440\u0443\u0437 \u2116${number}`;
    const remove=cargo.querySelector('[data-cargo-action="delete"]');
    if(remove){remove.disabled=number===1;remove.title=number===1?'\u041f\u0435\u0440\u0432\u044b\u0439 \u0440\u0430\u0437\u0434\u0435\u043b \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043d\u0435\u043b\u044c\u0437\u044f':'';}
  });
  updateSidebar();
}

function clearCargo(cargo){
  cargo.querySelectorAll('input,textarea,select').forEach(control=>{
    if(control.type==='checkbox'||control.type==='radio')control.checked=false;
    else if(control.tagName==='SELECT')control.selectedIndex=0;
    else control.value='';
    if(control.tagName==='SELECT')control._syncSelect?.();
  });
  if(document.documentElement.dataset.variant==='B')renderVariantBBlock(cargo);
}

function addCargoBlock(scroll=false,source=null){
  const snapshot=source?cargoSnapshot(source):null;
  cargoCount++;
  const clone=cargoTemplate.cloneNode(true);
  clone.id=`cargo-${cargoCount}`;
  clone.querySelector('h2 span').textContent=`Груз №${cargoCount}`;
  clone.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
  clone.querySelectorAll('input').forEach(input=>{if(input.type==='checkbox'||input.type==='radio')input.checked=false;else input.value=''});
  clone.querySelectorAll('textarea').forEach(x=>x.value='');
  clone.querySelectorAll('select').forEach(x=>x.selectedIndex=0);
  $('#cargoExtra').append(clone);
  clone.querySelectorAll('select').forEach(enhanceSelect);
  setupCargoActions(clone);
  setupVariantBCargoBlock(clone);
  updateSidebar();
  updateRouteSelects();
  if(snapshot){restoreCargoSnapshot(clone,snapshot);renderVariantBBlock(clone)}
  renumberCargoBlocks();
  if(scroll)clone.scrollIntoView({behavior:'smooth',block:'start'});
}

// В заполненном макете уже показано два груза.
updateSidebar();
$$('select').filter(select=>!select.closest('#cargoExtra')).forEach(enhanceSelect);
setupCargoActions(cargoOriginal);
renumberCargoBlocks();

function nativeValue(id,value){const select=$(id);select.value=value;select._syncSelect?.();select.dispatchEvent(new Event('change',{bubbles:true}))}
function maskDate(value){
  const digits=value.replace(/\D/g,'').slice(0,8);
  return [digits.slice(0,2),digits.slice(2,4),digits.slice(4,8)].filter(Boolean).join('.');
}
function maskTime(value){
  const digits=value.replace(/\D/g,'').slice(0,4);
  return digits.length>2?`${digits.slice(0,2)}:${digits.slice(2)}`:digits;
}
function clearModalErrors(){modal.querySelectorAll('.field-invalid').forEach(element=>element.classList.remove('field-invalid'))}
function validatePoint(point){
  const checks=[
    [Boolean(point.type),$('#pointType').closest('.ds-select')],
    [Boolean(point.address),comboInput],
    [Boolean(point.zone),$('#timezone').closest('.ds-select')],
    [/^\d{2}\.\d{2}\.\d{4}$/.test(point.date),$('#pointDate')],
    [/^\d{2}:\d{2}$/.test(point.time),$('#pointTime')]
  ];
  let firstInvalid=null;
  checks.forEach(([valid,element])=>{
    element.classList.toggle('field-invalid',!valid);
    if(!valid&&!firstInvalid)firstInvalid=element;
  });
  if(firstInvalid){
    const focusTarget=firstInvalid.matches('.ds-select')?firstInvalid.querySelector('.ds-select-button'):firstInvalid;
    focusTarget.focus();
  }
  return !firstInvalid;
}
function setFias(filled){$('#fiasText').textContent=filled?'f1c72b9d-a2d7-45b7-b9f5-2222c12d5164':'Определим после ввода адреса';$('#fiasText').classList.toggle('placeholder',!filled)}
function resetModal(){form.reset();nativeValue('#pointType','');nativeValue('#timezone','');comboInput.value='';$('#pointDate').value='';$('#pointTime').value='';$('#limitTime').value='';$('.point-supply').hidden=true;setFias(false);clearModalErrors()}
function openAddress(index=null){
  editingIndex=index;
  resetModal();
  if(index!==null){const point=points[index];nativeValue('#pointType',point.type);nativeValue('#timezone',point.zone);comboInput.value=point.address;$('#pointDate').value=point.date;$('#pointTime').value=point.time;$('#limitTime').value=point.limit;$('#supplyPoint').checked=point.supply;setFias(true)}
  modal.hidden=false;document.body.style.overflow='hidden';setTimeout(()=>$('#pointType')._syncSelect?.(),0);
}
function closeModal(){modal.hidden=true;document.body.style.overflow='';combo.classList.remove('open')}

openBtn.addEventListener('click',()=>openAddress());
$('#routeClose').addEventListener('click',closeModal);
$('#modalCancel').addEventListener('click',closeModal);
$('#pointType').addEventListener('change',event=>{$('.point-supply').hidden=event.target.value!=='Погрузка'});
$('#pointType').addEventListener('change',syncOwnerBlock);
$('#pointType').addEventListener('change',()=>{if($('#pointType').value)$('#pointType').closest('.ds-select').classList.remove('field-invalid')});
$('#timezone').addEventListener('change',()=>{if($('#timezone').value)$('#timezone').closest('.ds-select').classList.remove('field-invalid')});
comboInput.addEventListener('input',()=>{if(comboInput.value.trim())comboInput.classList.remove('field-invalid')});
$('#pointDate').addEventListener('input',event=>{event.target.value=maskDate(event.target.value);if(/^\d{2}\.\d{2}\.\d{4}$/.test(event.target.value))event.target.classList.remove('field-invalid')});
$('#pointTime').addEventListener('input',event=>{event.target.value=maskTime(event.target.value);if(/^\d{2}:\d{2}$/.test(event.target.value))event.target.classList.remove('field-invalid')});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!modal.hidden&&variantTask.hidden)closeModal();$$('.route-action.open,.ds-select.open').forEach(x=>x.classList.remove('open'))}});

function updateRouteSelects(){
  for(const [selector,type] of [['.route-loading','Погрузка'],['.route-unloading','Выгрузка']]){
    $$(selector).forEach(select=>{const old=select.value;const list=points.filter(point=>point.type===type);select.innerHTML='<option value="">Не выбрано</option>'+list.map(point=>`<option>${point.address}</option>`).join('');select.disabled=!list.length;if([...select.options].some(option=>option.value===old))select.value=old;select._syncSelect?.()});
  }
}

function renderRoutes(){
  rows.innerHTML=points.map((point,index)=>`<div class="route-row"><b>Пункт ${point.type==='Погрузка'?'погрузки':'выгрузки'}</b><span>${point.address}</span><span>${point.date}　${point.time}</span><div class="route-action"><button class="route-kebab" data-menu="${index}" aria-label="Действия">⋮</button><div class="route-action-menu"><button data-edit="${index}">Редактировать</button><button class="delete" data-delete="${index}">Удалить</button></div></div></div>`).join('');
  rows.hidden=!points.length;
  openBtn.textContent=points.length?'＋ Добавить':'Заполнить';
  openBtn.className=points.length?'add':'button';
  updateRouteSelects();
  if(signingValidationActive)validateRouteSection();
}

rows.addEventListener('click',event=>{
  const menuButton=event.target.closest('[data-menu]');
  if(menuButton){const action=menuButton.closest('.route-action');$$('.route-action.open').forEach(x=>{if(x!==action)x.classList.remove('open')});action.classList.toggle('open');return}
  const edit=event.target.closest('[data-edit]');if(edit){openAddress(+edit.dataset.edit);return}
  const remove=event.target.closest('[data-delete]');if(remove){points.splice(+remove.dataset.delete,1);renderRoutes();note('Адрес удалён')}
});

form.addEventListener('submit',event=>{
  event.preventDefault();
  const point={type:$('#pointType').value,address:comboInput.value.trim(),zone:$('#timezone').value,date:$('#pointDate').value,time:$('#pointTime').value,limit:$('#limitTime').value,supply:$('#supplyPoint').checked};
  if(!validatePoint(point)){note('\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043f\u043e\u043b\u044f');return}
  if(!point.type||!point.address||!point.zone||!point.date||!point.time){note('Заполните обязательные поля');return}
  if(editingIndex===null)points.push(point);else points[editingIndex]=point;
  renderRoutes();closeModal();note(editingIndex===null?'Адрес добавлен':'Адрес изменён');
});

document.addEventListener('mousedown',event=>{
  if(!combo.contains(event.target)){combo.classList.remove('open');comboInput.setAttribute('aria-expanded','false')}
  $$('.ds-select.open').forEach(x=>{if(!x.contains(event.target)){x.classList.remove('open');x.querySelector('.ds-select-button').setAttribute('aria-expanded','false')}});
  $$('.route-action.open').forEach(x=>{if(!x.contains(event.target))x.classList.remove('open')});
  $$('.cargo-title.actions-open').forEach(title=>{if(!title.contains(event.target)){title.classList.remove('actions-open');title.querySelector('.cargo-actions-trigger').setAttribute('aria-expanded','false')}});
});

document.addEventListener('click',event=>{
  const trigger=event.target.closest('.cargo-actions-trigger');
  if(trigger){
    const title=trigger.closest('.cargo-title');
    $$('.cargo-title.actions-open').forEach(item=>{if(item!==title){item.classList.remove('actions-open');item.querySelector('.cargo-actions-trigger').setAttribute('aria-expanded','false')}});
    title.classList.toggle('actions-open');
    trigger.setAttribute('aria-expanded',title.classList.contains('actions-open'));
    return;
  }
  const action=event.target.closest('[data-cargo-action]');
  if(!action||action.disabled)return;
  const cargo=action.closest('.cargo');
  const kind=action.dataset.cargoAction;
  if(kind==='delete'){
    cargo.remove();
    renumberCargoBlocks();
  }else if(kind==='copy'){
    addCargoBlock(true,cargo);
  }else if(kind==='clear'){
    clearCargo(cargo);
  }
  $$('.cargo-title.actions-open').forEach(title=>title.classList.remove('actions-open'));
});

document.addEventListener('keydown',event=>{
  if(event.key==='Escape')$$('.cargo-title.actions-open').forEach(title=>{title.classList.remove('actions-open');title.querySelector('.cargo-actions-trigger').setAttribute('aria-expanded','false')});
});

function clearCargoRequiredError(control){
  if(!control.matches?.('[data-cargo-required="true"]')||!String(control.value).trim())return;
  cargoRequiredVisual(control).classList.remove('field-invalid');
}

document.addEventListener('input',event=>clearCargoRequiredError(event.target));
document.addEventListener('change',event=>clearCargoRequiredError(event.target));
$('#route .toggle-row input').addEventListener('change',event=>{if(event.target.checked)event.target.closest('.toggle-row').classList.remove('field-invalid')});

$('#signButton').addEventListener('click',event=>{
  signingValidationActive=true;
  let valid=true;
  $$('.panel.cargo').forEach(cargo=>{if(!validateCargoSection(cargo))valid=false});
  if(valid){event.stopImmediatePropagation();openVariantBComplete();return;}
  event.stopImmediatePropagation();
  note('\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043f\u043e\u043b\u044f');
  const firstInvalid=$('#routeOpen.field-invalid,#route .toggle-row.field-invalid,.cargo .field-invalid');
  firstInvalid?.scrollIntoView({behavior:'smooth',block:'center'});
  const focusTarget=firstInvalid?.matches('.ds-select')?firstInvalid.querySelector('.ds-select-button'):firstInvalid;
  focusTarget?.focus();
},true);

// Variant A test shell. It is isolated from the application form so it can sit
// above every existing modal without changing their behavior.
document.documentElement.dataset.variant='B';
const variantAUi=document.createElement('div');
variantAUi.id='variantAUi';
variantAUi.innerHTML=`
  <button class="variant-a-guide-button" id="variantGuideButton" type="button" aria-label="Открыть задание" title="Задание"><img src="assets/kontur-diadoc-logistics.svg" alt=""></button>
  <div class="variant-a-overlay variant-a-welcome" id="variantWelcome" role="dialog" aria-modal="true" aria-labelledby="variantWelcomeTitle" hidden>
    <div class="variant-a-dialog variant-a-welcome-dialog">
      <div class="variant-a-dialog-icon"><img src="assets/kontur-diadoc-logistics.svg" alt=""></div>
      <h2 id="variantWelcomeTitle">Заказ-заявка</h2>
      <div class="variant-a-assignment">
        <p><strong>Вам необходимо отправить 2 груза:</strong></p>
        <p><strong>1. Холодильник «Бирюса»</strong><br><strong>Габариты коробки:</strong> 450x500x1700<br><strong>Вес брутто:</strong> 32 кг<br><strong>Погрузка:</strong> г. Москва, ул. Нижегородская, д. 29-33, стр. 15<br>22.08.2026 12:00—14:00<br><strong>Выгрузка:</strong> г. Воронеж, ул. Ленина, д. 73<br>22.08.2026 22:00—00:00</p>
        <p><strong>2. Холодильник «Индезит»</strong><br><strong>Габариты коробки:</strong> 450x500x1700<br><strong>Вес брутто:</strong> 32 кг<br><strong>Погрузка:</strong> г. Москва, ул. Нижегородская, д. 29-33, стр. 15<br>22.08.2026 12:00—14:00<br><strong>Выгрузка:</strong> г. Екатеринбург, ул. Монтажников, д. 16, корп. 2<br>23.08.2026 13:00—15:00</p>
        <p>Необходимо заполнить только разделы «Маршрут» и «Сведения о грузе», остальные разделы заполнять не нужно</p>
        <p>Для повторного открытия задания нажми на кнопку с иконкой карты в правом верхнем углу страницы</p>
      </div>
      <button class="primary variant-a-start" id="variantStart" type="button">Начать тест A</button>
    </div>
  </div>
  <div class="variant-a-overlay variant-a-task" id="variantTask" role="dialog" aria-modal="true" aria-labelledby="variantTaskTitle" hidden>
    <div class="variant-a-dialog variant-a-task-dialog">
      <div class="variant-a-dialog-icon"><img src="assets/kontur-diadoc-logistics.svg" alt=""></div>
      <h2 id="variantTaskTitle">Задание</h2>
      <div class="variant-a-assignment">
        <p><strong>Вам необходимо отправить 2 груза:</strong></p>
        <p><strong>1. Холодильник «Бирюса»</strong><br><strong>Габариты коробки:</strong> 450x500x1700<br><strong>Вес брутто:</strong> 32 кг<br><strong>Погрузка:</strong> г. Москва, ул. Нижегородская, д. 29-33, стр. 15<br>22.08.2026 12:00—14:00<br><strong>Выгрузка:</strong> г. Воронеж, ул. Ленина, д. 73<br>22.08.2026 22:00—00:00</p>
        <p><strong>2. Холодильник «Индезит»</strong><br><strong>Габариты коробки:</strong> 450x500x1700<br><strong>Вес брутто:</strong> 32 кг<br><strong>Погрузка:</strong> г. Москва, ул. Нижегородская, д. 29-33, стр. 15<br>22.08.2026 12:00—14:00<br><strong>Выгрузка:</strong> г. Екатеринбург, ул. Монтажников, д. 16, корп. 2<br>23.08.2026 13:00—15:00</p>
        <p>Необходимо заполнить только разделы «Маршрут» и «Сведения о грузе», остальные разделы заполнять не нужно</p>
      </div>
      <button class="button" id="variantTaskDone" type="button">Закрыть</button>
    </div>
  </div>
  <div class="variant-a-overlay variant-a-complete" id="variantComplete" role="dialog" aria-modal="true" aria-labelledby="variantCompleteTitle" hidden>
    <div class="variant-a-dialog variant-a-complete-dialog">
      <div class="variant-a-dialog-icon"><img src="assets/kontur-diadoc-logistics.svg" alt=""></div>
      <h2 id="variantCompleteTitle">Тест A успешно пройден!</h2>
      <p class="variant-a-complete-lead"><strong>Теперь давай пройдем тест B</strong></p>
      <p class="variant-a-complete-copy">Задание тоже, для открытия задания нажми на кнопку<br>с иконкой карты в правом верхнем углу страницы</p>
      <button class="primary" id="variantStartB" type="button">Начать тест B</button>
    </div>
  </div>`;
document.body.append(variantAUi);

const variantWelcome=$('#variantWelcome');
const variantTask=$('#variantTask');
const variantComplete=$('#variantComplete');
function syncVariantPageScroll(){const bModal=$('#variantBAddressModal');document.body.style.overflow=(!variantWelcome.hidden||!variantTask.hidden||!variantComplete.hidden||!modal.hidden||(bModal&&!bModal.hidden))?'hidden':''}
function openVariantTask(){variantTask.hidden=false;syncVariantPageScroll();$('#variantTaskDone').focus()}
function closeVariantTask(){variantTask.hidden=true;syncVariantPageScroll();$('#variantGuideButton').focus()}
function openVariantComplete(){variantComplete.hidden=false;syncVariantPageScroll();$('#variantStartB').focus()}
$('#variantStart').addEventListener('click',()=>{variantWelcome.hidden=true;syncVariantPageScroll()});
$('#variantGuideButton').addEventListener('click',openVariantTask);
$('#variantTaskDone').addEventListener('click',closeVariantTask);
$('#variantStartB').addEventListener('click',()=>{window.location.href='../variant-b/index.html'});
syncVariantPageScroll();

$('#addCargo').addEventListener('click',()=>addCargoBlock(true));
$('#signButton').addEventListener('click',()=>note('Заявка готова к подписанию'));
$('#cancelButton').addEventListener('click',()=>note('Действие отменено'));
renderRoutes();

const variantBTiming=new URLSearchParams(window.location.search);
const variantAElapsed=Math.max(0,Number(variantBTiming.get('a'))||0);
const variantBStartedAt=Math.max(0,Number(variantBTiming.get('bStart'))||Date.now());
let variantBElapsed=null;

const variantBCompleteUi=document.createElement('div');
variantBCompleteUi.className='variant-b-final-overlay';
variantBCompleteUi.id='variantBComplete';
variantBCompleteUi.hidden=true;
variantBCompleteUi.innerHTML=`
  <div class="variant-b-final-dialog" role="dialog" aria-modal="true" aria-labelledby="variantBCompleteTitle">
    <div class="variant-b-final-header">
      <img src="assets/kontur-diadoc-logistics.svg" alt="">
      <h2 id="variantBCompleteTitle">Тест B успешно пройден!</h2>
      <p><strong>Спасибо за участие</strong></p>
    </div>
    <div class="variant-b-result-row" data-result="a"><div><strong>Тест A</strong><span class="variant-b-result-bar"><i></i></span></div><time>0:00</time></div>
    <div class="variant-b-result-row" data-result="b"><div><strong>Тест B</strong><span class="variant-b-result-bar"><i></i></span></div><time>0:00</time></div>
    <button class="primary" id="variantBRestart" type="button">Начать с начала</button>
  </div>`;
document.body.append(variantBCompleteUi);

function formatVariantTime(milliseconds){
  const seconds=Math.max(0,Math.floor(milliseconds/1000));
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
function openVariantBComplete(){
  if(variantBElapsed===null)variantBElapsed=Math.max(1000,Date.now()-variantBStartedAt);
  const maximum=Math.max(variantAElapsed,variantBElapsed,1);
  const aRow=variantBCompleteUi.querySelector('[data-result="a"]');
  const bRow=variantBCompleteUi.querySelector('[data-result="b"]');
  aRow.querySelector('time').textContent=formatVariantTime(variantAElapsed);
  bRow.querySelector('time').textContent=formatVariantTime(variantBElapsed);
  aRow.querySelector('i').style.width=`${variantAElapsed/maximum*100}%`;
  bRow.querySelector('i').style.width=`${variantBElapsed/maximum*100}%`;
  const aSlower=variantAElapsed>=variantBElapsed;
  aRow.classList.toggle('is-slower',aSlower);aRow.classList.toggle('is-faster',!aSlower);
  bRow.classList.toggle('is-slower',!aSlower);bRow.classList.toggle('is-faster',aSlower);
  variantBCompleteUi.hidden=false;
  document.body.style.overflow='hidden';
  $('#variantBRestart').focus();
}
$('#variantBRestart').addEventListener('click',()=>{window.location.href='../variant-a/index.html'});

const variantBModal=document.createElement('div');
variantBModal.className='variant-b-overlay';
variantBModal.id='variantBAddressModal';
variantBModal.hidden=true;
variantBModal.innerHTML=`
  <div class="variant-b-address-modal" role="dialog" aria-modal="true" aria-labelledby="variantBModalTitle">
    <button class="variant-b-modal-close" type="button" aria-label="Закрыть">×</button>
    <h2 id="variantBModalTitle">Адреса погрузки и выгрузки</h2>
    <form id="variantBAddressForm">
      <section class="variant-b-address-section" data-kind="loading">
        <h3>Погрузка</h3>
        <div class="variant-b-form-row"><label>Адрес<span>*</span> ⓘ</label><div class="variant-b-combo"><input name="loadingAddress" autocomplete="off"><span class="variant-b-combo-arrow"></span><div class="variant-b-combo-menu"></div></div></div>
        <div class="variant-b-form-row"><label>Код ФИАС ⓘ</label><div class="variant-b-fias placeholder">Определим после ввода адреса</div></div>
        <button class="button variant-b-other" type="button">＋ Добавить другие сведения</button>
        <div class="variant-b-form-row"><label>Дата подачи ТС<span>*</span></label><input class="variant-b-date" name="loadingDate" placeholder="дд.мм.гггг"></div>
        <div class="variant-b-form-row"><label>Время подачи ТС<span>*</span></label><div class="variant-b-time"><input name="loadingTimeFrom" placeholder="00:00"><span>—</span><input name="loadingTimeTo" placeholder="00:00"><select name="loadingZone"><option>UTC+03 — Москва, Санкт-Петербург</option><option>UTC+05 — Екатеринбург</option><option>UTC+07 — Новосибирск</option></select></div></div>
        <label class="toggle-row"><input name="loadingSupply" type="checkbox"><i></i> Является адресом пункта подачи ТС</label>
        <label class="toggle-row"><input name="loadingReturn" type="checkbox"><i></i> Является адресом пункта возврата контейнера или оборудования</label>
        <label class="toggle-row"><input name="loadingOwner" type="checkbox" checked><i></i> Пунктом владеет грузоотправитель</label>
      </section>
      <section class="variant-b-address-section" data-kind="unloading">
        <h3>Выгрузка</h3>
        <div class="variant-b-form-row"><label>Адрес<span>*</span> ⓘ</label><div class="variant-b-combo"><input name="unloadingAddress" autocomplete="off"><span class="variant-b-combo-arrow"></span><div class="variant-b-combo-menu"></div></div></div>
        <div class="variant-b-form-row"><label>Код ФИАС ⓘ</label><div class="variant-b-fias placeholder">Определим после ввода адреса</div></div>
        <button class="button variant-b-other" type="button">＋ Добавить другие сведения</button>
        <div class="variant-b-form-row"><label>Дата подачи ТС<span>*</span></label><input class="variant-b-date" name="unloadingDate" placeholder="дд.мм.гггг"></div>
        <div class="variant-b-form-row"><label>Время подачи ТС<span>*</span></label><div class="variant-b-time"><input name="unloadingTimeFrom" placeholder="00:00"><span>—</span><input name="unloadingTimeTo" placeholder="00:00"><select name="unloadingZone"><option>UTC+03 — Москва, Санкт-Петербург</option><option>UTC+05 — Екатеринбург</option><option>UTC+07 — Новосибирск</option></select></div></div>
        <label class="toggle-row"><input name="unloadingReturn" type="checkbox"><i></i> Является адресом пункта возврата контейнера или оборудования</label>
      </section>
      <div class="variant-b-modal-actions"><button class="primary" type="submit">Сохранить</button><button class="button variant-b-cancel" type="button">Отменить</button></div>
    </form>
  </div>`;
document.body.append(variantBModal);

const variantBForm=variantBModal.querySelector('form');
let variantBActiveCargo=null;
let variantBEditingIndex=null;

function variantBEscape(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function variantBRows(cargo){
  try{return JSON.parse(cargo.querySelector('.variant-b-route-state')?.value||'[]')}catch{return []}
}
function variantBTime(row,prefix){return [row[`${prefix}TimeFrom`],row[`${prefix}TimeTo`]].filter(Boolean).join('—')}

function renderVariantBBlock(cargo){
  const block=cargo.querySelector('.variant-b-route-block');
  if(!block)return;
  const rows=variantBRows(cargo);
  const body=block.querySelector('.variant-b-route-body');
  body.innerHTML=rows.length?rows.map((row,index)=>`
    <div class="variant-b-route-row" data-b-row="${index}">
      <div class="variant-b-address-copy">${variantBEscape(row.loadingAddress)}<small>${row.loadingSupply?'Пункт подачи ТС':''}</small></div>
      <div class="variant-b-date-copy">${variantBEscape(row.loadingDate)}<br>${variantBEscape(variantBTime(row,'loading'))}</div>
      <span class="variant-b-direction">→</span>
      <div class="variant-b-address-copy">${variantBEscape(row.unloadingAddress)}<small>${row.unloadingReturn?'Пункт возврата контейнера<br>или оборудования':''}</small></div>
      <div class="variant-b-date-copy">${variantBEscape(row.unloadingDate)}<br>${variantBEscape(variantBTime(row,'unloading'))}</div>
      <input class="variant-b-count" type="number" min="1" data-cargo-required="true" value="${variantBEscape(row.count)}" aria-label="Количество грузовых мест">
      <div class="variant-b-row-menu"><button type="button" data-b-menu aria-label="Действия">⋮</button><div><button type="button" data-b-edit="${index}">Редактировать</button><button type="button" data-b-delete="${index}">Удалить</button></div></div>
    </div>`).join(''):`
    <div class="variant-b-route-row variant-b-route-empty">
      <div><button class="button" type="button" data-b-open>Заполнить</button></div><div></div><span></span><div class="variant-b-empty-mark">—</div><div></div><div class="variant-b-empty-mark">—</div><div></div>
    </div>`;
  block.classList.toggle('is-filled',rows.length>0);
}

function setupVariantBCargoBlock(cargo){
  if(cargo.querySelector('.variant-b-route-block'))return;
  const oldTitle=[...cargo.querySelectorAll(':scope > h3')].find(item=>item.textContent.trim()==='Пункты погрузки и выгрузки');
  if(!oldTitle)return;
  const oldDescription=oldTitle.nextElementSibling;
  const oldRoute=oldDescription?.nextElementSibling;
  const oldAdd=oldRoute?.nextElementSibling;
  const block=document.createElement('div');
  block.className='variant-b-route-block';
  block.innerHTML=`<h3>Погрузка и выгрузка</h3><input class="variant-b-route-state" type="hidden" value="[]"><div class="variant-b-route-head"><span>Погрузка<span>*</span></span><span>Выгрузка<span>*</span></span><span>Количество<br>грузовых мест<span>*</span></span></div><div class="variant-b-route-body"></div><button class="add variant-b-add" type="button">＋ Добавить</button>`;
  oldTitle.replaceWith(block);
  oldDescription?.remove();oldRoute?.remove();oldAdd?.remove();
  renderVariantBBlock(cargo);
}

function variantBSetFias(section,address){
  const fias=section.querySelector('.variant-b-fias');
  fias.textContent=address?'f1c72b9d-a2d7-45b7-b9f5-22222c12d5164':'Определим после ввода адреса';
  fias.classList.toggle('placeholder',!address);
}
function variantBSetZone(section,address){
  const select=section.querySelector('select');
  const value=/новосибир/i.test(address)?'UTC+07':/екатерин|свердлов/i.test(address)?'UTC+05':'UTC+03';
  select.selectedIndex=[...select.options].findIndex(option=>option.textContent.startsWith(value));
}
function openVariantBModal(cargo,index=null){
  variantBActiveCargo=cargo;variantBEditingIndex=index;
  variantBForm.reset();
  variantBForm.querySelector('[name="loadingOwner"]').checked=true;
  const row=index===null?null:variantBRows(cargo)[index];
  if(row)Object.entries(row).forEach(([key,value])=>{const control=variantBForm.elements.namedItem(key);if(!control)return;if(control.type==='checkbox')control.checked=Boolean(value);else control.value=value});
  variantBForm.querySelectorAll('.variant-b-address-section').forEach(section=>{
    const prefix=section.dataset.kind;
    const address=variantBForm.elements.namedItem(`${prefix}Address`).value;
    variantBSetFias(section,address);
  });
  variantBModal.querySelectorAll('.field-invalid').forEach(item=>item.classList.remove('field-invalid'));
  variantBModal.hidden=false;document.body.style.overflow='hidden';
  variantBForm.elements.namedItem('loadingAddress').focus();
}
function closeVariantBModal(){variantBModal.hidden=true;document.body.style.overflow=''}

variantBModal.querySelectorAll('.variant-b-combo').forEach(comboBox=>{
  const input=comboBox.querySelector('input');
  const menu=comboBox.querySelector('.variant-b-combo-menu');
  const section=comboBox.closest('.variant-b-address-section');
  const draw=()=>{menu.innerHTML=`<div class="variant-b-combo-options">${addressItems.map(address=>`<button type="button">${variantBEscape(address)}</button>`).join('')}</div><button class="variant-b-combo-manual" type="button"><span aria-hidden="true"></span>Выбрать вручную</button>`;comboBox.classList.add('open')};
  input.addEventListener('focus',draw);input.addEventListener('click',draw);
  input.addEventListener('input',()=>{variantBSetFias(section,input.value);variantBSetZone(section,input.value)});
  menu.addEventListener('mousedown',event=>{const option=event.target.closest('button');if(!option)return;event.preventDefault();if(option.classList.contains('variant-b-combo-manual')){input.value='';comboBox.classList.remove('open');variantBSetFias(section,'');requestAnimationFrame(()=>input.focus());return}input.value=option.textContent;comboBox.classList.remove('open');variantBSetFias(section,input.value);variantBSetZone(section,input.value)});
});
variantBForm.querySelectorAll('.variant-b-date').forEach(input=>input.addEventListener('input',()=>{input.value=maskDate(input.value)}));
variantBForm.querySelectorAll('.variant-b-time input').forEach(input=>input.addEventListener('input',()=>{input.value=maskTime(input.value)}));

document.addEventListener('mousedown',event=>{
  if(!event.target.closest('.variant-b-combo'))document.querySelectorAll('.variant-b-combo.open').forEach(item=>item.classList.remove('open'));
  if(!event.target.closest('.variant-b-row-menu'))document.querySelectorAll('.variant-b-row-menu.open').forEach(item=>item.classList.remove('open'));
});
document.addEventListener('click',event=>{
  const cargo=event.target.closest('.panel.cargo');
  if(event.target.closest('[data-b-open],.variant-b-add')){openVariantBModal(cargo);return}
  const menu=event.target.closest('[data-b-menu]');if(menu){menu.closest('.variant-b-row-menu').classList.toggle('open');return}
  const edit=event.target.closest('[data-b-edit]');if(edit){openVariantBModal(cargo,+edit.dataset.bEdit);return}
  const remove=event.target.closest('[data-b-delete]');if(remove){const state=cargo.querySelector('.variant-b-route-state');const rows=variantBRows(cargo);rows.splice(+remove.dataset.bDelete,1);state.value=JSON.stringify(rows);renderVariantBBlock(cargo);return}
  const count=event.target.closest('.variant-b-count');if(count){const state=cargo.querySelector('.variant-b-route-state');const rows=variantBRows(cargo);rows[+count.closest('[data-b-row]').dataset.bRow].count=count.value;state.value=JSON.stringify(rows)}
});
document.addEventListener('input',event=>{
  const count=event.target.closest('.variant-b-count');
  if(!count)return;
  const cargo=count.closest('.panel.cargo');const state=cargo.querySelector('.variant-b-route-state');const rows=variantBRows(cargo);
  rows[+count.closest('[data-b-row]').dataset.bRow].count=count.value;state.value=JSON.stringify(rows);
});
variantBForm.addEventListener('submit',event=>{
  event.preventDefault();
  const required=['loadingAddress','loadingDate','loadingTimeFrom','unloadingAddress','unloadingDate','unloadingTimeFrom'];
  let valid=true;required.forEach(name=>{const control=variantBForm.elements.namedItem(name);const ok=Boolean(control.value.trim());control.classList.toggle('field-invalid',!ok);if(!ok)valid=false});
  if(!valid)return;
  const data=Object.fromEntries(new FormData(variantBForm).entries());
  ['loadingSupply','loadingReturn','loadingOwner','unloadingReturn'].forEach(name=>data[name]=variantBForm.elements.namedItem(name).checked);
  data.count=variantBEditingIndex===null?'':variantBRows(variantBActiveCargo)[variantBEditingIndex]?.count||'';
  const state=variantBActiveCargo.querySelector('.variant-b-route-state');const rows=variantBRows(variantBActiveCargo);
  if(variantBEditingIndex===null)rows.push(data);else rows[variantBEditingIndex]=data;
  state.value=JSON.stringify(rows);renderVariantBBlock(variantBActiveCargo);closeVariantBModal();
});
variantBModal.querySelector('.variant-b-modal-close').addEventListener('click',closeVariantBModal);
variantBModal.querySelector('.variant-b-cancel').addEventListener('click',closeVariantBModal);

const baseValidateCargoSection=validateCargoSection;
validateCargoSection=function(cargo){
  let valid=baseValidateCargoSection(cargo);
  const block=cargo.querySelector('.variant-b-route-block');
  const addressesValid=variantBRows(cargo).length>0;
  block?.classList.toggle('field-invalid',!addressesValid);
  if(!addressesValid)valid=false;
  return valid;
};

document.querySelector('#route')?.remove();
document.querySelector('#routeModal')?.remove();
document.querySelector('.section-nav a[href="#route"]')?.remove();
document.querySelectorAll('.panel.cargo').forEach(setupVariantBCargoBlock);
variantTask.querySelector('.variant-a-assignment p:last-child').textContent='Необходимо заполнить только раздел «Сведения о грузе», остальные разделы заполнять не нужно';
variantWelcome.hidden=true;
variantWelcome.remove();
variantComplete.remove();
syncVariantPageScroll();
