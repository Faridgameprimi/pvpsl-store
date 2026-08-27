const DEFAULT_DATA={
  settings:{siteName:"FaridSmp Network",discord:"https://discord.gg/TUhjeUTvhh",donate:"https://sociabuzz.com/faridsmp/tribe"},
  stores:[
    {id:"broken-anarchy",name:"Broken Anarchy",badge:"ANARCHY SERVER",desc:"No rules, no limits. Survival murni tanpa batasan.",items:[
      {id:"plus",name:"Weekly Plus Pass",price:1.50,unit:"/ minggu",desc:"50k Money, 100 Shards, dan 7 Plus Key."},
      {id:"amethyst",name:"Amethyst Key",price:3.50,unit:"/ key",desc:"Crate key untuk Broken Anarchy."},
      {id:"farid",name:"Farid Key",price:3.50,unit:"/ key",desc:"Exclusive key FaridSmp."}
    ]}
  ]
};
const DATA_KEY="faridsmp_store_data_v2";
const ADMIN_USER="admin";
const ADMIN_PASS="CHANGE_ME_123"; // Ganti di sini sebelum upload GitHub.

function getData(){try{return JSON.parse(localStorage.getItem(DATA_KEY))||structuredClone(DEFAULT_DATA)}catch{return structuredClone(DEFAULT_DATA)}}
function saveData(d){localStorage.setItem(DATA_KEY,JSON.stringify(d))}
function money(n){return "RM "+Number(n).toFixed(2)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function applySettings(){
 const d=getData(); document.querySelectorAll(".brand").forEach(x=>{x.innerHTML=`${esc(d.settings.siteName).toUpperCase()} <span>STORE</span>`});
 document.querySelectorAll(".nav-cta").forEach(x=>x.href=d.settings.donate);
 document.querySelectorAll('a[href*="discord.gg"]').forEach(x=>x.href=d.settings.discord);
}
function renderHome(){
 const el=document.getElementById("storeGrid"); if(!el)return;
 el.innerHTML=getData().stores.map(s=>`<a class="store-card glass" href="${s.id}/index.html"><span class="store-badge">${esc(s.badge||"STORE")}</span><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p><span class="store-arrow">Open Store →</span></a>`).join("");
}
let activeOrder=null;
function openOrder(item,storeName){
 activeOrder={...item,storeName}; document.getElementById("orderModal").hidden=false;
 document.getElementById("modalTitle").textContent=item.name; document.getElementById("modalPrice").textContent=`${money(item.price)} ${item.unit||""}`;
 document.getElementById("orderItem").value=item.name; document.getElementById("orderQty").value=1; document.getElementById("orderForm").hidden=false; document.getElementById("paymentStep").hidden=true; updateTotal();
}
function updateTotal(){if(activeOrder)document.getElementById("orderTotal").textContent=money(activeOrder.price*Number(document.getElementById("orderQty").value||1))}
function setupModal(){
 const m=document.getElementById("orderModal");if(!m)return;
 document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>m.hidden=true);
 document.getElementById("orderQty").addEventListener("input",updateTotal);
 document.getElementById("orderForm").addEventListener("submit",e=>{
   e.preventDefault(); const name=document.getElementById("mcName").value.trim(), edition=document.getElementById("mcEdition").value, qty=Number(document.getElementById("orderQty").value||1);
   if(!name||!edition)return; activeOrder.customer=name;activeOrder.edition=edition;activeOrder.qty=qty;activeOrder.total=activeOrder.price*qty;
   document.getElementById("orderForm").hidden=true;document.getElementById("paymentStep").hidden=false;
 });
 document.getElementById("copyOrder").onclick=async()=>{
   const o=activeOrder;const text=`FaridSmp Order\nStore: ${o.storeName}\nItem: ${o.name}\nJumlah: ${o.qty}x\nMinecraft: ${o.customer}\nEdition: ${o.edition}\nTotal: ${money(o.total)}`;
   try{await navigator.clipboard.writeText(text);document.getElementById("copyOrder").textContent="Copied ✓"}catch{alert(text)}
 };
}
function renderItems(){
 const el=document.getElementById("storeItems");if(!el)return;
 const store=getData().stores.find(s=>s.id==="broken-anarchy")||getData().stores[0]; if(!store){el.innerHTML="<p>No items.</p>";return}
 el.innerHTML=store.items.map(i=>`<div class="item-card glass"><span class="store-badge">${esc(store.badge)}</span><h3>${esc(i.name)}</h3><p>${esc(i.desc)}</p><div class="item-price">${money(i.price)} <span>${esc(i.unit||"")}</span></div><button class="btn primary buy-item" data-id="${esc(i.id)}">Buy Now →</button></div>`).join("");
 el.querySelectorAll(".buy-item").forEach(b=>b.onclick=()=>{const item=store.items.find(i=>i.id===b.dataset.id);openOrder(item,store.name)})
 setupModal();
}
function setupCopy(){document.querySelectorAll(".copy-btn").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent="Copied ✓";setTimeout(()=>b.textContent="Copy IP",1200)}catch{}})}
function adminInit(){
 const login=document.getElementById("loginPanel");if(!login)return;
 const dashboard=document.getElementById("dashboard");
 document.getElementById("loginBtn").onclick=()=>{
   if(document.getElementById("adminUser").value===ADMIN_USER&&document.getElementById("adminPass").value===ADMIN_PASS){sessionStorage.admin="1";showDash()}else document.getElementById("loginError").textContent="Username atau password salah.";
 };
 document.getElementById("logoutBtn").onclick=()=>{sessionStorage.removeItem("admin");location.reload()};
 function showDash(){login.hidden=true;dashboard.hidden=false;loadAdmin()}
 if(sessionStorage.admin==="1")showDash();
 document.getElementById("saveSettings").onclick=()=>{const d=getData();d.settings.siteName=document.getElementById("siteName").value;d.settings.discord=document.getElementById("discordUrl").value;d.settings.donate=document.getElementById("donateUrl").value;saveData(d);alert("Settings tersimpan di browser ini.")};
 document.getElementById("storeForm").onsubmit=e=>{e.preventDefault();const d=getData();const id=document.getElementById("storeName").value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-");d.stores.push({id,name:document.getElementById("storeName").value,badge:document.getElementById("storeBadge").value||"STORE",desc:document.getElementById("storeDesc").value,items:[]});saveData(d);e.target.reset();loadAdmin()};
 document.getElementById("resetData").onclick=()=>{if(confirm("Reset semua data ke demo?")){localStorage.removeItem(DATA_KEY);loadAdmin()}};
 document.getElementById("exportData").onclick=()=>{const blob=new Blob([JSON.stringify(getData(),null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="faridsmp-store-data.json";a.click()};
 document.getElementById("importData").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);saveData(d);loadAdmin();alert("Import berhasil")}catch{alert("JSON tidak valid")}};r.readAsText(f)}
 function loadAdmin(){
   const d=getData();document.getElementById("siteName").value=d.settings.siteName;document.getElementById("discordUrl").value=d.settings.discord;document.getElementById("donateUrl").value=d.settings.donate;
   document.getElementById("adminStores").innerHTML=d.stores.map(s=>`<div class="admin-st"><div class="manager-head"><h3>${esc(s.name)}</h3><button class="danger-btn del-store" data-id="${esc(s.id)}">Delete Store</button></div><p>${esc(s.desc)}</p><div>${s.items.map(i=>`<div class="admin-item"><input class="i-name" data-store="${esc(s.id)}" data-id="${esc(i.id)}" value="${esc(i.name)}"><input class="i-price" type="number" step=".01" data-store="${esc(s.id)}" data-id="${esc(i.id)}" value="${i.price}"><input class="i-unit" data-store="${esc(s.id)}" data-id="${esc(i.id)}" value="${esc(i.unit||"")}"><button class="small-btn save-item" data-store="${esc(s.id)}" data-id="${esc(i.id)}">Save</button><button class="small-btn delete-item" data-store="${esc(s.id)}" data-id="${esc(i.id)}">Delete</button></div>`).join("")}</div><button class="small-btn add-item" data-store="${esc(s.id)}">+ Add Item</button></div>`).join("");
   document.querySelectorAll(".del-store").forEach(b=>b.onclick=()=>{const d=getData();d.stores=d.stores.filter(s=>s.id!==b.dataset.id);saveData(d);loadAdmin()});
   document.querySelectorAll(".add-item").forEach(b=>b.onclick=()=>{const d=getData(),s=d.stores.find(x=>x.id===b.dataset.store);s.items.push({id:"item-"+Date.now(),name:"New Item",price:1,unit:"",desc:"New item"});saveData(d);loadAdmin()});
   document.querySelectorAll(".save-item").forEach(b=>b.onclick=()=>{const d=getData(),s=d.stores.find(x=>x.id===b.dataset.store),i=s.items.find(x=>x.id===b.dataset.id),root=b.parentElement;i.name=root.querySelector(".i-name").value;i.price=Number(root.querySelector(".i-price").value);i.unit=root.querySelector(".i-unit").value;saveData(d);alert("Item tersimpan")});
   document.querySelectorAll(".delete-item").forEach(b=>b.onclick=()=>{const d=getData(),s=d.stores.find(x=>x.id===b.dataset.store);s.items=s.items.filter(i=>i.id!==b.dataset.id);saveData(d);loadAdmin()});
 }
}
document.addEventListener("DOMContentLoaded",()=>{applySettings();renderHome();renderItems();setupCopy();adminInit()});