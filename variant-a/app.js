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
  return [...cargo.querySelectorAll('input,textarea,select')].map(control=>({
    value:control.value,
    checked:'checked' in control?control.checked:undefined
  }));
}

function restoreCargoSnapshot(cargo,snapshot){
  [...cargo.querySelectorAll('input,textarea,select')].forEach((control,index)=>{
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
  updateSidebar();
  updateRouteSelects();
  if(snapshot)restoreCargoSnapshot(clone,snapshot);
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
  let valid=validateRouteSection();
  $$('.panel.cargo').forEach(cargo=>{if(!validateCargoSection(cargo))valid=false});
  if(valid){
    event.stopImmediatePropagation();
    openVariantComplete();
    return;
  }
  event.stopImmediatePropagation();
  note('\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043f\u043e\u043b\u044f');
  const firstInvalid=$('#routeOpen.field-invalid,#route .toggle-row.field-invalid,.cargo .field-invalid');
  firstInvalid?.scrollIntoView({behavior:'smooth',block:'center'});
  const focusTarget=firstInvalid?.matches('.ds-select')?firstInvalid.querySelector('.ds-select-button'):firstInvalid;
  focusTarget?.focus();
},true);

// Variant A test shell. It is isolated from the application form so it can sit
// above every existing modal without changing their behavior.
document.documentElement.dataset.variant='A';
const variantAUi=document.createElement('div');
variantAUi.id='variantAUi';
variantAUi.innerHTML=`
  <button class="variant-a-guide-button" id="variantGuideButton" type="button" aria-label="Открыть задание" title="Задание"><img src="assets/kontur-diadoc-logistics.svg" alt=""></button>
  <div class="variant-a-overlay variant-a-welcome" id="variantWelcome" role="dialog" aria-modal="true" aria-labelledby="variantWelcomeTitle">
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
let variantATestStartedAt=null;
let variantADuration=0;
let variantASessionId='';
function syncVariantPageScroll(){document.body.style.overflow=(!variantWelcome.hidden||!variantTask.hidden||!variantComplete.hidden||!modal.hidden)?'hidden':''}
function openVariantTask(){variantTask.hidden=false;syncVariantPageScroll();$('#variantTaskDone').focus()}
function closeVariantTask(){variantTask.hidden=true;syncVariantPageScroll();$('#variantGuideButton').focus()}
function openVariantComplete(){variantADuration=Math.max(1000,Date.now()-(variantATestStartedAt||Date.now()));variantComplete.hidden=false;syncVariantPageScroll();$('#variantStartB').focus()}
$('#variantStart').addEventListener('click',()=>{variantATestStartedAt=Date.now();variantASessionId=globalThis.crypto?.randomUUID?.()||`${variantATestStartedAt}-${Math.random().toString(36).slice(2)}`;variantWelcome.hidden=true;syncVariantPageScroll()});
$('#variantGuideButton').addEventListener('click',openVariantTask);
$('#variantTaskDone').addEventListener('click',closeVariantTask);
$('#variantStartB').addEventListener('click',()=>{window.location.href=`../variant-b/index.html?a=${variantADuration}&bStart=${Date.now()}&start=${variantATestStartedAt}&session=${encodeURIComponent(variantASessionId)}`});
syncVariantPageScroll();

$('#addCargo').addEventListener('click',()=>addCargoBlock(true));
$('#signButton').addEventListener('click',()=>note('Заявка готова к подписанию'));
$('#cancelButton').addEventListener('click',()=>note('Действие отменено'));
renderRoutes();
