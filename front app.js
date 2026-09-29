const API = localStorage.getItem("apiUrl") || "http://localhost:8000";
const $ = id => document.getElementById(id);
let online = false;

// Demo data + rules used only when the backend is unreachable
const demo = { animals: [
  {id:1,tag:"COW-101",species:"Cow",status:"normal"},
  {id:2,tag:"COW-102",species:"Cow",status:"normal"},
  {id:3,tag:"GOAT-201",species:"Goat",status:"normal"}], alerts: [] };

function assess(temp, activity, symptoms) {
  const reasons = []; let score = 0;
  if (temp >= 40.5) { score += 3; reasons.push("very high temperature"); }
  else if (temp >= 39.5) { score += 2; reasons.push("high temperature"); }
  else if (temp < 37.5) { score += 2; reasons.push("low temperature"); }
  if (activity < 30) { score += 2; reasons.push("very low activity"); }
  else if (activity < 50) { score += 1; reasons.push("low activity"); }
  if (symptoms.length) { score += symptoms.length; reasons.push("symptoms: " + symptoms.join(", ")); }
  return { level: score >= 4 ? "critical" : score >= 2 ? "warning" : "normal", reasons };
}

async function api(path, opts) {
  const r = await fetch(API + path, opts);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

async function load() {
  let animals, alerts, summary;
  try {
    [animals, alerts, summary] = await Promise.all([api("/animals"), api("/alerts"), api("/dashboard")]);
    online = true;
  } catch {
    online = false; animals = demo.animals; alerts = demo.alerts;
    const bad = animals.filter(a => a.status !== "normal").length;
    summary = { total: animals.length, at_risk: bad, open_alerts: alerts.length, outbreak: bad >= 3 };
  }
  $("mode").textContent = online ? "Connected to server" : "Demo mode (server not reachable)";
  render(animals, alerts, summary);
}

function render(animals, alerts, s) {
  $("summary").innerHTML =
    `<div><b>${s.total}</b><span>Animals</span></div>
     <div><b>${s.at_risk}</b><span>Need attention</span></div>
     <div><b>${s.open_alerts}</b><span>Alerts</span></div>`;
  $("outbreak").hidden = !s.outbreak;
  $("outbreak").textContent = "Possible outbreak: several animals show risk signs. Call your veterinarian.";
  $("herd").innerHTML = animals.map(a =>
    `<li class="${a.status}"><span>${a.tag}<small>${a.species}</small></span><span class="pill">${a.status}</span></li>`).join("");
  $("animal").innerHTML = animals.map(a => `<option value="${a.id}">${a.tag}</option>`).join("");
  $("alerts").innerHTML = alerts.length
    ? alerts.map(a => `<li class="${a.level}"><strong>${a.tag}</strong>: ${a.message}<br><time>${new Date(a.created_at).toLocaleString()}</time></li>`).join("")
    : `<li class="empty">No alerts yet. Log a health check to get started.</li>`;
}

$("form").addEventListener("submit", async e => {
  e.preventDefault();
  const id = +$("animal").value, temp = +$("temp").value, activity = +$("activity").value;
  const symptoms = [...document.querySelectorAll(".chk input:checked")].map(c => c.value);
  let res;
  if (online) {
    try {
      res = await api("/readings", { method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ animal_id: id, temperature: temp, activity, symptoms }) });
    } catch { $("result").textContent = "Could not save the reading. Check the server and try again."; return; }
  } else {
    res = assess(temp, activity, symptoms);
    const a = demo.animals.find(x => x.id === id); a.status = res.level;
    if (res.level !== "normal") demo.alerts.unshift({ tag: a.tag, level: res.level,
      message: res.reasons.join("; "), created_at: new Date().toISOString() });
  }
  $("result").textContent = res.level === "normal" ? "Normal. No action needed."
    : `${res.level.toUpperCase()}: ${res.reasons.join("; ")}. Contact a veterinarian.`;
  load();
});

load();
