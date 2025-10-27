/* === State init === */
let state = {
  profile: { name: "", goal: "", avatar: null },
  history: {},
  hero: { xp: 0, level: 1 },
  quests: [],
  ui: { lastDay: null }
};

/* === Helpers === */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function todayIso(){return iso(new Date())}
function isYesterday(dateIso){return dateIso===iso(new Date(Date.now()-86400000))}

function save(){localStorage.setItem("planner365_v2",JSON.stringify(state))}
function load(){
  const s = localStorage.getItem("planner365_v2");
  if(!s) return;
  try{
    state = JSON.parse(s);
  }catch(e){}
}

/* === Default quests === */
const QUESTS = [
  {id:1,title:"Главная задача",xp:25,icon:"✅"},
  {id:2,title:"Читать 20 минут",xp:10,icon:"📚"},
  {id:3,title:"10 000 шагов",xp:10,icon:"🚶"},
  {id:4,title:"Спорт 30 мин",xp:15,icon:"💪"},
  {id:5,title:"Учёба 45 мин",xp:20,icon:"🎓"}
];

function ensureQuests(){
  if(!Array.isArray(state.quests) || state.quests.length===0){
    state.quests=QUESTS.map(q=>({...q,streak:0,lastDone:null,doneToday:false}));
  }
}

/* === Daily tasks === */
function ensureTodayRec(){
  const key = todayIso();
  if(!state.history[key]) state.history[key]={tasks:[],tasksDone:0,focusMin:0};
  return state.history[key];
}
function renderDay(){
  const rec = ensureTodayRec();
  const list=$("#tasks");
  list.innerHTML="";
  rec.tasks.forEach((t,i)=>{
    const li=document.createElement("li");
    li.textContent=t.text;
    if(t.done) li.classList.add("done");
    li.onclick=()=>{
      t.done=!t.done;
      rec.tasksDone = rec.tasks.filter(x=>x.done).length;
      if(t.done) state.hero.xp+=10;
      else state.hero.xp=Math.max(0,state.hero.xp-10);
      updateHero(); save(); renderDay(); updateBadge();
    }
    list.appendChild(li);
  });
  updateBadge();
}
function updateBadge(){
  const rec=ensureTodayRec();
  const left=rec.tasks.filter(t=>!t.done).length;
  $("#dayBadge").hidden=left===0;
  if(left>0) $("#dayBadge").textContent=left;
}

/* === Hero === */
function xpNeed(level){return 100+(level-1)*50}
function updateHero(){
  let lvl=state.hero.level||1;
  let xp=state.hero.xp||0;
  let cap=xpNeed(lvl);
  while(xp>=cap){xp-=cap;lvl++;cap=xpNeed(lvl);}
  state.hero.level=lvl;
  state.hero.xp=xp;
  $("#heroLevel").textContent=lvl;
  $("#heroBar").style.width=Math.round((xp/cap)*100)+"%";
  $("#heroMeta").textContent=`${xp} / ${cap} xp`;
}

/* === Quests === */
function resetQuestsIfNeeded(){
  const today=todayIso();
  if(state.ui.lastDay!==today){
    state.quests.forEach(q=>q.doneToday=false);
    state.ui.lastDay=today;
  }
}
function markQuestDone(id){
  const q=state.quests.find(x=>x.id===id);
  if(!q || q.doneToday) return;
  
  const today=todayIso();
  if(!q.lastDone) q.streak=1;
  else if(isYesterday(q.lastDone)) q.streak++;
  else if(q.lastDone!==today) q.streak=1;

  q.lastDone=today;
  q.doneToday=true;

  state.hero.xp+=q.xp;
  updateHero();

  const rec=ensureTodayRec();
  rec.tasksDone+=1;

  save(); renderQuests(); renderDay();
}
function renderQuests(){
  const box=$("#questsView .quests") || (()=>{const d=document.createElement("div");d.className="quests";$("#questsView").appendChild(d);return d})();
  box.innerHTML="";
  state.quests.forEach(q=>{
    const row=document.createElement("div");
    row.className="quest-card";
    row.innerHTML=`
      <div class="q-title">${q.icon} ${q.title}</div>
      <div class="q-meta muted">🔥 стрик: ${q.streak}</div>
    `;
    const btn=document.createElement("button");
    btn.className="q-btn";
    btn.textContent=q.doneToday?"Выполнено":"Отметить";
    btn.disabled=q.doneToday;
    btn.onclick=()=>markQuestDone(q.id);
    row.appendChild(btn);
    box.appendChild(row);
  });
}

/* === Profile === */
function renderProfileMini(){
  $("#profNameView").textContent=state.profile.name||"Без имени";
  $("#profGoalView").textContent=state.profile.goal||"";
  const av=$("#avatar");
  if(state.profile.avatar) av.src=state.profile.avatar;
  else av.removeAttribute("src");
}
function attachAvatar(){
  $("#avatarInput").onchange=e=>{
    const f=e.target.files[0];
    if(!f) return;
    const r=new FileReader();
    r.onload=()=>{state.profile.avatar=r.result;save();renderProfileMini();}
    r.readAsDataURL(f);
  }
}
function closeProfile(){
  $("#profileModal").classList.add("hidden");
}

/* === Charts (placeholder working) === */
function drawComboChart(){}

/* === Tabs === */
function switchView(v){
  $$(".view").forEach(x=>x.classList.remove("active"));
  $$(".tab").forEach(x=>x.classList.remove("active"));
  $("#"+v+"View").classList.add("active");
  document.querySelector(`.tab[data-view="${v}"]`).classList.add("active");
  if(v==="day") renderDay();
  if(v==="quests") renderQuests();
  if(v==="hero") updateHero();
  save();
}
function tabsInit(){
  $$(".tab, .icon-btn").forEach(btn=>{
    btn.onclick=()=>switchView(btn.getAttribute("data-view"));
  });
}

/* === Onboarding — fixed === */
function handleStart(){
  const name=$("#onbName").value.trim();
  const goal=$("#onbGoal").value.trim();
  if(!name){alert("Введите имя");return;}
  state.profile.name=name;
  state.profile.goal=goal;
  save();
  $("#onboard").classList.add("hidden");
  renderProfileMini();
  switchView("day");
}
function setupOnboard(){
  const btn=$("#onbStart");
  if(btn) btn.onclick=handleStart;
}
function showOnboardIfNeeded(){
  if(!state.profile.name){
    $("#onboard").classList.remove("hidden");
  }else{
    $("#onboard").classList.add("hidden");
  }
}

/* === Init === */
function init(){
  load();
  ensureQuests();
  resetQuestsIfNeeded();
  tabsInit();
  setupOnboard();
  
  $("#addTask").onclick=()=>{
    const v=$("#newTask").value.trim();
    if(!v) return;
    const rec=ensureTodayRec();
    rec.tasks.push({text:v,done:false});
    $("#newTask").value="";
    save();renderDay();
  }
  $("#modalClose").onclick=closeProfile;
  $("#profBtn").onclick=()=>$("#profileModal").classList.remove("hidden");
  $("#saveProfile").onclick=()=>{
    state.profile.name=$("#profName").value||"";
    state.profile.goal=$("#profGoal").value||"";
    save();renderProfileMini();closeProfile();
  }

  attachAvatar();
  renderProfileMini();
  renderDay();
  renderQuests();
  updateHero();
  showOnboardIfNeeded();
}
document.addEventListener("DOMContentLoaded",init);
