// ==== Chat functionality ====
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const messages = document.getElementById("messages");

// Handle form submission
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;

  addMessage("user", question);
  input.value = "";
  addMessage("bot", "🔍 Searching...");

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: question, user_id: "anon" }),
    });

    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();
    const a = data.answer || {};

    // 🔹 Structured answer
    const structuredAnswer = `
<b>[Intent: ${a.intent || "Unknown"}]</b><br>
Confidence: ${a.confidence || "N/A"}<br><br>
<b>1. TL;DR</b> — ${a.tldr || "N/A"}<br><br>
<b>2. Short Answer</b> — ${a.short || "N/A"}<br><br>
<b>3. Why this is true</b> — ${a.why || "N/A"}<br><br>
<b>4. Implementation</b><pre>${a.implementation || "N/A"}</pre><br>
<b>5. Quick test / verification</b><pre>${a.test || "N/A"}</pre><br>
<b>6. Alternatives & tradeoffs</b><ul>${(a.alternatives || []).map(x => `<li>${x}</li>`).join("")}</ul>
<b>7. Caveats & risks</b><ul>${(a.caveats || []).map(x => `<li>${x}</li>`).join("")}</ul>
<b>8. Performance / cost impact</b> — ${a.cost || "N/A"}<br><br>
<b>9. Sources</b><ul>${(a.sources || []).map(s => `<li><a href="${s.url}" target="_blank">${s.title}</a> — ${s.note}</li>`).join("")}</ul>
<b>10. Next steps</b><ul>${(a.nextSteps || []).map(x => `<li>${x}</li>`).join("")}</ul>
`;

    const formattedResults = formatResults(data.results);
    updateLastBotMessage(structuredAnswer + "<br><br>" + formattedResults);

  } catch (err) {
    console.error("Error:", err);
    updateLastBotMessage("❌ Error fetching results. Please try again.");
  }
});

function addMessage(sender, text) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.innerHTML = `<span class="${sender}">${sender === "user" ? "You" : "AI"}:</span> ${text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function updateLastBotMessage(text) {
  const botMessages = [...messages.querySelectorAll(".bot")];
  if (botMessages.length > 0) {
    botMessages[botMessages.length - 1].parentElement.innerHTML = `<span class="bot">AI:</span> ${text}`;
  }
}

function formatResults(results) {
  if (!results || results.length === 0) return "No results found.";
  return results
    .map(r => `🔗 <a href="${r.url}" target="_blank">${r.title}</a><br/>${r.content?.slice(0, 500) || ""}...`)
    .join("<br/><br/>");
}

// ==== Auto-suggest ====
const suggestionsBox = document.createElement('div');
suggestionsBox.id = 'suggestions-box';
Object.assign(suggestionsBox.style, {
  position: 'absolute', background: '#fff', color: '#000',
  fontFamily: 'Arial, sans-serif', border: '1px solid #ccc',
  borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
  padding: '2px 0', width: `${input.offsetWidth}px`,
  top: `${input.offsetTop + input.offsetHeight}px`,
  left: `${input.offsetLeft}px`, zIndex: '9999', display: 'none',
});
input.parentNode.appendChild(suggestionsBox);

let questions = [];
fetch('questions.json').then(res => res.json()).then(data => { questions = data; });

input.addEventListener('input', () => {
  const query = input.value.toLowerCase();
  suggestionsBox.innerHTML = '';
  if (!query) return (suggestionsBox.style.display = 'none');
  const filtered = questions.filter(q => q.toLowerCase().includes(query)).slice(0, 2);
  if (!filtered.length) return (suggestionsBox.style.display = 'none');
  filtered.forEach(q => {
    const div = document.createElement('div');
    div.textContent = q;
    Object.assign(div.style, { padding: '4px 8px', cursor: 'pointer', color: '#000', background: '#fff' });
    div.addEventListener('mouseover', () => div.style.background = '#e0f0ff');
    div.addEventListener('mouseout', () => div.style.background = '#fff');
    div.addEventListener('click', () => { input.value = q; suggestionsBox.style.display = 'none'; input.focus(); });
    suggestionsBox.appendChild(div);
  });
  suggestionsBox.style.display = 'block';
});
document.addEventListener('click', (e) => {
  if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) suggestionsBox.style.display = 'none';
});

// ==== Constellation canvas ====
const canvas = document.getElementById('constellation');
if (canvas) {
  const ctx = canvas.getContext('2d');
  function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resizeCanvas(); window.addEventListener('resize', resizeCanvas);

  const stars = [], numStars = 80, maxDist = 120;
  class Star {
    constructor() { this.x=Math.random()*canvas.width; this.y=Math.random()*canvas.height; this.vx=(Math.random()-0.5)*0.3; this.vy=(Math.random()-0.5)*0.3; this.radius=Math.random()*2.5+1.5; }
    move() { this.x+=this.vx; this.y+=this.vy; if(this.x<0||this.x>canvas.width)this.vx*=-1; if(this.y<0||this.y>canvas.height)this.vy*=-1; }
    draw() { ctx.beginPath(); ctx.arc(this.x,this.y,this.radius,0,Math.PI*2); ctx.fillStyle='rgba(0,150,255,0.8)'; ctx.fill(); }
  }
  function connectStars() {
    for(let i=0;i<stars.length;i++) for(let j=i+1;j<stars.length;j++){
      const dx=stars[i].x-stars[j].x, dy=stars[i].y-stars[j].y, dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<maxDist){ ctx.beginPath(); ctx.moveTo(stars[i].x,stars[i].y); ctx.lineTo(stars[j].x,stars[j].y); ctx.lineWidth=1.2; ctx.strokeStyle='rgba(0,150,255,0.4)'; ctx.stroke(); }
    }
  }
  function animateConstellation() { ctx.clearRect(0,0,canvas.width,canvas.height); stars.forEach(s=>{s.move();s.draw();}); connectStars(); requestAnimationFrame(animateConstellation); }
  for(let i=0;i<numStars;i++) stars.push(new Star());
  animateConstellation();
}

// ==== Intro Modal "Don't show again" ====
function setCookie(name,value,days){ const d=new Date(); d.setTime(d.getTime()+(days*24*60*60*1000)); document.cookie=`${name}=${value};expires=${d.toUTCString()};path=/`; }
function getCookie(name){ const match=document.cookie.match(new RegExp('(^| )'+name+'=([^;]+)')); return match?match[2]:null; }

window.addEventListener('load', ()=>{
  const modal=document.getElementById('intro-modal');
  const closeBtn=document.getElementById('close-modal');
  const dontShowCheckbox=document.getElementById('dont-show-again');
  if(!modal||!closeBtn) return;
  if(getCookie('hideIntroModal')==='true') return;
  modal.style.display='block';
  closeBtn.onclick=()=>{
    if(dontShowCheckbox?.checked) setCookie('hideIntroModal','true',365);
    modal.style.display='none';
  };
  window.onclick=(event)=>{
    if(event.target===modal){ if(dontShowCheckbox?.checked) setCookie('hideIntroModal','true',365); modal.style.display='none'; }
  };
});











