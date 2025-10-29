/* =========================
   Planner 365 — app.js v3.2
   Онбординг с анимацией (цель обязательна), квесты 5шт,
   задачи дня, путь героя, графики, PWA-совместимость.
========================= */

/* --- Global State --- */
let state = {
  profile: { name: "", goal: "", avatar: null },
  history: {},
  hero: { xp: 0, level: 1 },
  quests: [],
  ui: { lastDay: null }
};

/* --- Utils --- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const todayIso = () => iso(new Date());
const isYesterday = (isoStr) => iso(new Date(Date.now()-86400000)) === isoStr;

function save(){ try{ localStorage.setItem("planner365_v2", JSON.stringify(state)); }catch(e){} }
function load(){
  try{
    const s = localStorage.getItem("planner365_v2");
    if (s) state = JSON.parse(s);
  }catch(e){}
  if (!state || typeof state !== "object") state = { profile:{name:"",goal:"",avatar:null}, history:{}, hero:{xp:0,level:1}, quests:[], ui:{lastDay:null} };
  if (!Array.isArray(state.quests)) state.quests = [];
  if (!state.ui) state.ui = { lastDay: null };
}

function closeProfile() {
  const modal = document.getElementById("profileModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.style.display = "none";
}
/* --- Charts (compact impl) --- */
function drawComboChart(canvas, rows, labels){
  if(!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const L=46,R=12,T=16,B=36;
  ctx.strokeStyle="rgba(255,255,255,.12)"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(L,T); ctx.lineTo(L,h-B); ctx.lineTo(w-R,h-B); ctx.stroke();

  let maxTasks=5, maxFocus=60;
  rows.forEach(r=>{ maxTasks=Math.max(maxTasks,r.tasks); maxFocus=Math.max(maxFocus,r.focus); });

  const gap=8, avail=w-L-R, count=rows.length;
  const bw=Math.max(14, Math.floor((avail-gap*(count-1))/count));

  // bars
  rows.forEach((r,i)=>{
    const x=L+i*(bw+gap);
    const bh=Math.round(((h-T-B)*r.tasks)/maxTasks);
    const y=h-B-bh;
    const g=ctx.createLinearGradient(0,y,0,y+bh);
    g.addColorStop(0,"#7dd3fc"); g.addColorStop(1,"#a78bfa");
    ctx.fillStyle=g; ctx.fillRect(x,y,bw,bh);
  });

  // line
  ctx.lineWidth=2; ctx.strokeStyle="rgba(167,139,250,.95)"; ctx.beginPath();
  rows.forEach((r,i)=>{
    const x=L+i*(bw+gap)+Math.floor(bw/2);
    const y=h-B-Math.round(((h-T-B)*r.focus)/maxFocus);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // labels
  ctx.fillStyle="rgba(234,242,251,.9)"; ctx.font="12px Manrope,system-ui"; ctx.textAlign="center";
  rows.forEach((r,i)=>{
    const x=L+i*(bw+gap)+Math.floor(bw/2);
    ctx.fillText(labels[i] ?? (r.label || r.day || ""), x, h-12);
  });
}

function ruDays(){ return ["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"]; }
function startOfWeek(d){
  const dt=new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let k=dt.getDay(); if(k===0) k=7; dt.setDate(dt.getDate()-(k-1)); return dt;
}
function getWeekData(){
  const now=new Date(), start=startOfWeek(now);
  return [...Array(7)].map((_,i)=>{
    const dt=new Date(start); dt.setDate(start.getDate()+i);
    const key=iso(dt), rec=state.history[key]||{};
    return { label:ruDays()[i], tasks:rec.tasksDone||0, focus:rec.focusMin||0 };
  });
}
function getMonthData(){
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  const last=new Date(y,m+1,0);
  return [...Array(last.getDate())].map((_,i)=>{
    const dt=new Date(y,m,i+1), key=iso(dt), rec=state.history[key]||{};
    return { day:i+1, tasks:rec.tasksDone||0, focus:rec.focusMin||0 };
  });
}

/* --- Day (tasks) --- */
function ensureTodayRec(){
  const key=todayIso();
  if(!state.history[key]) state.history[key]={ tasks:[], tasksDone:0, focusMin:0 };
  if(!Array.isArray(state.history[key].tasks)) state.history[key].tasks=[];
  return state.history[key];
}
function renderDay(){
  const rec=ensureTodayRec();
  const list=$("#tasks"); if(!list) return;
  list.innerHTML="";
  rec.tasks.forEach((t)=>{
    const li=document.createElement("li");
    li.textContent=t.text;
    if(t.done) li.classList.add("done");
    li.addEventListener("click", ()=>{
      t.done=!t.done;
      rec.tasksDone=rec.tasks.filter(x=>x.done).length;
      state.hero.xp=Math.max(0,(state.hero.xp||0)+(t.done?10:-10));
      updateHero(); save(); renderDay(); updateBadge();
    });
    list.appendChild(li);
  });
  updateBadge();
}
function updateBadge(){
  const rec=ensureTodayRec();
  const left=rec.tasks.filter(t=>!t.done).length;
  const b=$("#dayBadge"); if(!b) return;
  b.hidden=left===0; if(!b.hidden) b.textContent=left;
}

/* --- Hero --- */
function xpNeed(lv){ return 100 + (lv-1)*50; }
function updateHero(){
  let lv=state.hero.level||1, xp=state.hero.xp||0, cap=xpNeed(lv);
  while(xp>=cap){ xp-=cap; lv++; cap=xpNeed(lv); }
  state.hero.level=lv; state.hero.xp=xp;
  $("#heroLevel") && ($("#heroLevel").textContent = String(lv));
  $("#heroBar") && ($("#heroBar").style.width = `${Math.round((xp/cap)*100)}%`);
  $("#heroMeta") && ($("#heroMeta").textContent = `${xp} / ${cap} xp`);
}

/* --- Quests (fixed 5) --- */
const QUESTS = [
  {id:1,title:"Главная задача",xp:25,icon:"✅"},
  {id:2,title:"Читать 20 минут",xp:10,icon:"📚"},
  {id:3,title:"10 000 шагов",xp:10,icon:"🚶"},
  {id:4,title:"Спорт 30 мин",xp:15,icon:"💪"},
  {id:5,title:"Учёба / проект 45 мин",xp:20,icon:"🎓"}
];
function ensureQuests(){
  if(!Array.isArray(state.quests) || state.quests.length===0){
    state.quests = QUESTS.map(q=>({ ...q, streak:0, lastDone:null, doneToday:false }));
  }
}
function resetQuestsIfNeeded(){
  const today=todayIso();
  if(state.ui.lastDay !== today){
    state.quests.forEach(q=> q.doneToday=false);
    state.ui.lastDay = today;
  }
}
function markQuestDone(id){
  const q = state.quests.find(x=>x.id===id);
  if(!q || q.doneToday) return;
  const today=todayIso();
  if(!q.lastDone) q.streak=1;
  else if(isYesterday(q.lastDone)) q.streak++;
  else if(q.lastDone!==today) q.streak=1;
  q.lastDone=today; q.doneToday=true;
  state.hero.xp += q.xp; updateHero();
  const rec=ensureTodayRec(); rec.tasksDone += 1;
  save(); renderQuests(); renderDay();
}
function renderQuests(){
  const host=$("#questsView"); if(!host) return;
  let box=host.querySelector(".quests");
  if(!box){ box=document.createElement("div"); box.className="quests"; host.appendChild(box); }
  box.innerHTML="";
  state.quests.forEach(q=>{
    const row=document.createElement("div");
    row.className="quest-card";
    row.innerHTML = `
      <div class="q-title">${q.icon} ${q.title}</div>
      <div class="q-meta muted">🔥 стрик: ${q.streak}</div>
    `;
    const btn=document.createElement("button");
    btn.className="q-btn";
    btn.textContent = q.doneToday ? "Выполнено" : "Отметить";
    btn.disabled = q.doneToday;
    btn.addEventListener("click", ()=>markQuestDone(q.id));
    row.appendChild(btn);
    box.appendChild(row);
  });
}

/* --- Profile mini --- */
function renderProfileMini(){
  $("#profNameView") && ($("#profNameView").textContent = state.profile.name || "Без имени");
  $("#profGoalView") && ($("#profGoalView").textContent = state.profile.goal || "");
  const av=$("#avatar");
  if(av){
    if(state.profile.avatar) av.src = state.profile.avatar;
    else av.removeAttribute("src");
  }
}
function attachAvatar(){
  const inp=$("#avatarInput"); if(!inp) return;
  inp.addEventListener("change", ()=>{
    const f=inp.files?.[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{ state.profile.avatar=r.result; save(); renderProfileMini(); };
    r.readAsDataURL(f);
  });
}
/* --- Tabs --- */
function switchView(v){
  $$(".view").forEach(x=>x.classList.remove("active"));
  $$(".tab").forEach(x=>x.classList.remove("active"));
  const view = document.getElementById(`${v}View`);
  const tab  = document.querySelector(`.tab[data-view="${v}"]`);
  view && view.classList.add("active");
  tab  && tab.classList.add("active");

  if(v==="day")   renderDay();
  if(v==="quests")renderQuests();
  if(v==="hero")  updateHero();
  if(v==="week")  drawComboChart($("#weekChart"), getWeekData(), ruDays());
  if(v==="month"){
    const data=getMonthData();
    const labels=data.map(x=>[1,5,10,15,20,25,data.length].includes(x.day)?x.day:"");
    drawComboChart($("#monthChart"), data, labels);
  }
  save();
}
function tabsInit(){
  $$(".tab, .icon-btn").forEach(btn=>{
    btn.addEventListener("click", ()=> switchView(btn.getAttribute("data-view")));
  });
}

/* --- Onboarding (goal required + animation) --- */
function showOnboardIfNeeded(){
function showOnboardIfNeeded(){
  if(!state.profile.name || !state.profile.goal){
    ob.classList.remove("hidden");
  }else{
    ob.classList.add("hidden");
    switchView("day");
  }
}
function bindOnboardButton(){
  const btn = $("#onbStart");
  if(!btn) return;
  // снимаем возможные старые обработчики
  const fresh = btn.cloneNode(true);
  btn.parentNode.replaceChild(fresh, btn);

  fresh.addEventListener("click", ()=>{
    const name = ($("#onbName")?.value || "").trim();
    const goal = ($("#onbGoal")?.value || "").trim();

    if(!name){ alert("Введите имя"); return; }
    if(!goal){ alert("Введите вашу главную цель"); return; } // цель обязательна

    state.profile.name = name;
    state.profile.goal = goal;
    save();

    // анимация поздравления
    playWelcomeOverlay(name, goal);

    // скрываем онбординг и стартуем «День»
    $("#onboard")?.classList.add("hidden");
    renderProfileMini();
    switchView("day");
  });
   switchView("day");
document.getElementById("dayView").classList.add("active");
}

/* --- Welcome overlay (auto-destroys) --- */
function playWelcomeOverlay(name, goal){
  const ov = document.createElement("div");
  ov.style.cssText = `
    position:fixed; inset:0; display:grid; place-items:center;
    background:rgba(5,10,25,.88); z-index:9999; transition:opacity .5s ease;
  `;
  const card = document.createElement("div");
  card.style.cssText = `
    background:#0f1938; border:1px solid rgba(255,255,255,.12);
    border-radius:18px; padding:22px; width:min(520px,92vw);
    text-align:center; box-shadow:0 30px 80px rgba(0,0,0,.5);
    font-family:Manrope, system-ui, sans-serif;
  `;
  card.innerHTML = `
    <div style="font-size:18px;opacity:.8;margin-bottom:6px">Планнер 365</div>
    <div style="font-size:24px;font-weight:800;margin-bottom:8px">Добро пожаловать, ${name}!</div>
    <div style="font-size:14px;color:#9db0c6">Главная цель: <b style="color:#eaf2fb">${goal}</b></div>
  `;
  ov.appendChild(card);
  document.body.appendChild(ov);
  // авто-скрытие
  setTimeout(()=>{ ov.style.opacity="0"; }, 1200);
  setTimeout(()=>{ ov.remove(); }, 1800);
}

/* --- Init --- */
function init(){
  load();
  ensureQuests();
  resetQuestsIfNeeded();

  tabsInit();

  // Inputs / buttons
  $("#addTask")?.addEventListener("click", ()=>{
    const v = ($("#newTask")?.value || "").trim();
    if(!v) return;
    const rec = ensureTodayRec();
    rec.tasks.push({ text:v, done:false });
    $("#newTask").value = "";
    save(); renderDay();
  });
  $("#newTask")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") $("#addTask").click(); });

  $("#profBtn")?.addEventListener("click", ()=> $("#profileModal")?.classList.remove("hidden"));
  document.getElementById("modalClose").onclick = () => {
  closeProfile();
};
  document.getElementById("saveProfile").onclick = () => {
  const name = ($("#profName")?.value || "").trim();
  const goal = ($("#profGoal")?.value || "").trim();

  if (!name) {
    alert("Введите имя");
    return;
  }
  if (!goal) {
    alert("Введите главную цель");
    return;
  }

  state.profile.name = name;
  state.profile.goal = goal;
  save();
  renderProfileMini();
  closeProfile();

  // ✅ Обновление вкладки «День»
  switchView("day");
};
  $("#shareBtn")?.addEventListener("click", ()=> alert("Поделиться добавим позже 👀"));

  attachAvatar();
  renderProfileMini();

  // Порядок важен: сначала показать экран (если нужно), потом повесить обработчик
  showOnboardIfNeeded();
  bindOnboardButton();

  // Стартовый рендер
  renderDay();
  renderQuests();
  updateHero();
}

window.addEventListener("load", init);
