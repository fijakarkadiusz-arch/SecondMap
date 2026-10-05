const seed=[
{name:"Vintage Store",city:"Warszawa",type:"Vintage",lat:52.2297,lng:21.0122,info:"Przykładowe miejsce"},
{name:"Second Hand Centrum",city:"Kraków",type:"Second hand",lat:50.0647,lng:19.9450,info:"Przykładowe miejsce"},
{name:"Lump na Jeżycach",city:"Poznań",type:"Second hand",lat:52.4100,lng:16.9000,info:"Przykładowe miejsce"},
{name:"Szafa Vintage",city:"Wrocław",type:"Vintage",lat:51.1079,lng:17.0385,info:"Przykładowe miejsce"},
{name:"Second Look",city:"Gdańsk",type:"Second hand",lat:54.3520,lng:18.6466,info:"Przykładowe miejsce"},
{name:"Retro Szafa",city:"Łódź",type:"Vintage",lat:51.7592,lng:19.4560,info:"Przykładowe miejsce"},
{name:"Lump Silesia",city:"Katowice",type:"Second hand",lat:50.2649,lng:19.0238,info:"Przykładowe miejsce"},
{name:"Outlet Mix",city:"Lublin",type:"Outlet",lat:51.2465,lng:22.5684,info:"Przykładowe miejsce"},
{name:"Druga Szansa",city:"Szczecin",type:"Second hand",lat:53.4285,lng:14.5528,info:"Przykładowe miejsce"},
{name:"Vintage Bydgoszcz",city:"Bydgoszcz",type:"Vintage",lat:53.1235,lng:18.0084,info:"Przykładowe miejsce"}
];

let places=[...seed,...JSON.parse(localStorage.getItem("lumpPlaces")||"[]")];
let filter="all", query="", markers=[], osmCache=new Map(), favorites=new Set(JSON.parse(localStorage.getItem("favorites")||"[]"));
let loading=false, lastQueryKey="";

const map=L.map("map",{zoomControl:false}).setView([52.05,19.2],6);
L.control.zoom({position:"bottomright"}).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);

// Szary świat + kolorowa Polska. Maska ma otwór w kształcie Polski,
// dzięki czemu szczegółowa mapa pozostaje kolorowa tylko w granicach kraju.
const polandRing=[[51.10667409932158,15.01699588385867],[51.745188096719964,14.607098422919535],[52.0899474147552,14.685026482815688],[52.62485016540838,14.4375997250022],[52.98126251892543,14.074521111719491],[53.24817129171297,14.353315463934138],[53.75702912049103,14.119686313542587],[54.05070628520575,14.802900424873458],[54.513158677785725,16.36347700365573],[54.85153595643291,17.622831658608675],[54.68260569927078,18.62085859546164],[54.43871877706929,18.696254510175464],[54.42608388937393,19.660640089606403],[54.31252492941253,20.892244500418624],[54.327536932993326,22.731098667092652],[54.22056671814914,23.24398725758951],[53.91249766704114,23.48412763844985],[53.470121568406555,23.527535845575002],[53.089731350306074,23.80493493011778],[52.69109935160657,23.799198846133375],[52.486977444053664,23.199493849386187],[52.02364655212473,23.508002150168693],[51.57845408793023,23.52707075368437],[50.70540660257518,24.029985792748903],[50.42488108987875,23.922757195743262],[50.30850576435745,23.426508416444392],[49.47677358661974,22.518450148211603],[49.02739533140962,22.776418898212626],[49.085738023467144,22.558137648211755],[49.47010732685409,21.607808058364213],[49.32877228453583,20.887955356538413],[49.43145335549977,20.41583947111985],[49.21712535256923,19.825022820726872],[49.571574001659194,19.320712517990472],[49.435845852244576,18.909574822676316],[49.49622915837764,18.853144158613617],[49.98862864847075,18.392913852622172],[50.049038397819956,17.64944502123899],[50.36214590107641,17.55456709155112],[50.47397370055603,16.868769158605655],[50.21574665239354,16.719475945714436],[50.42260732685791,16.176253289462267],[50.69773265237984,16.23862674323857],[50.78472992614321,15.490972120839727],[51.10667409932158,15.01699588385867]];
const worldRing=[[-89,-179],[-89,179],[89,179],[89,-179],[-89,-179]];
L.polygon([worldRing,polandRing],{
  stroke:false,fillColor:'#68717a',fillOpacity:.14,fillRule:'evenodd',interactive:false,className:'world-mask'
}).addTo(map);

const icon=()=>L.divIcon({className:"",html:'<div class="marker"><span>L</span></div>',iconSize:[30,30],iconAnchor:[15,29]});
const status=document.getElementById("status");

function saveFavorites(){localStorage.setItem("favorites",JSON.stringify([...favorites]));}
function keyFor(p){return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;}
function isFavorite(p){return favorites.has(keyFor(p));}
function mapsUrl(p){return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;}

function normalizeOSM(e){
  const t=e.tags||{};
  const lat=e.lat ?? e.center?.lat, lng=e.lon ?? e.center?.lon;
  if(lat==null||lng==null) return null;
  let type="Second hand";
  if(t.shop==="vintage" || /vintage/i.test(t.name||"")) type="Vintage";
  if(t.shop==="outlet" || /outlet/i.test(t.name||"")) type="Outlet";
  if(t.shop==="charity") type="Charity";
  const address=[t["addr:street"],t["addr:housenumber"],t["addr:postcode"],t["addr:city"]].filter(Boolean).join(" ");
  return {
    name:t.name||"Second hand",
    city:t["addr:city"]||t["addr:town"]||t["addr:village"]||"",
    type, lat, lng,
    info: address || "Dane z OpenStreetMap",
    address,
    website:t.website||t["contact:website"]||"",
    phone:t.phone||t["contact:phone"]||"",
    hours:t.opening_hours||""
  };
}

async function loadRealPlaces(){
  // Ładujemy cały obszar województwa śląskiego z OpenStreetMap.
  // Relacja administracyjna Śląskiego: 224462 -> area 3600224462.
  // Dzięki temu nie trzeba przesuwać mapy po kawałku, żeby odkrywać sklepy.
  if(map.getZoom()<7){
    status.textContent="Przybliż mapę, aby zobaczyć wszystkie lumpeksy na Śląsku.";
    return;
  }

  const key="slaskie-all-v1";
  if(osmCache.has(key)){
    mergeOSM(osmCache.get(key));
    return;
  }
  if(loading || lastQueryKey===key) return;

  loading=true;
  lastQueryKey=key;
  status.textContent="Pobieram lumpeksy ze Śląska…";

  const q=`[out:json][timeout:60];
area(3600224462)->.slaskie;
(
  nwr["shop"="second_hand"](area.slaskie);
  nwr["second_hand"="yes"](area.slaskie);
  nwr["second_hand"="only"](area.slaskie);
  nwr["shop"="clothes"]["second_hand"="yes"](area.slaskie);
  nwr["shop"="clothes"]["second_hand"="only"](area.slaskie);
  nwr["shop"="vintage"](area.slaskie);
  nwr["shop"="charity"](area.slaskie);
  nwr["shop"="clothes"]["name"~"second hand|secondhand|lumpeks|lump|ciucholand|odzież używana|odziez uzywana|szmateks|tania odzież|tania odziez|komis odzież|komis odziez|vintage",i](area.slaskie);
);
out center tags;`;

  try{
    const endpoints=[
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter"
    ];
    let data=null;
    for(const endpoint of endpoints){
      try{
        const r=await fetch(endpoint,{
          method:"POST",
          headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
          body:"data="+encodeURIComponent(q)
        });
        if(r.ok){ data=await r.json(); break; }
      }catch(_){}
    }
    if(!data) throw new Error("Overpass error");

    const real=data.elements.map(normalizeOSM).filter(Boolean);
    osmCache.set(key,real);
    mergeOSM(real);
    status.textContent=`Znaleziono ${real.length} miejsc ze Śląska. Kliknij punkt, aby zobaczyć szczegóły.`;
  }catch(err){
    status.textContent="Nie udało się pobrać danych Śląska. Spróbuj ponownie za chwilę.";
  }finally{
    loading=false;
  }
}

function mergeOSM(real){
  const custom=places.filter(p=>p.source==="custom");
  const byKey=new Map();
  [...seed,...real,...custom].forEach(p=>byKey.set(keyFor(p),p));
  places=[...byKey.values()];
  render();
}

function visible(p){
  const matchesFilter=filter==="all"||p.type.toLowerCase()===filter;
  const text=`${p.name} ${p.city} ${p.info} ${p.address||""}`.toLowerCase();
  return matchesFilter && text.includes(query);
}

function render(){
  markers.forEach(m=>map.removeLayer(m)); markers=[];
  const list=document.getElementById("list"); list.innerHTML="";
  const shown=places.filter(visible);
  document.getElementById("count").textContent=`${shown.length} ${shown.length===1?"miejsce":"miejsc"}`;
  shown.forEach(p=>{
    const m=L.marker([p.lat,p.lng],{icon:icon()}).addTo(map);
    const directions=`<a href="${mapsUrl(p)}" target="_blank" rel="noopener">Nawiguj</a>`;
    const website=p.website?`<a href="${p.website}" target="_blank" rel="noopener">Strona</a>`:"";
    const phone=p.phone?`<p>📞 ${escapeHtml(p.phone)}</p>`:"";
    const hours=p.hours?`<p>🕒 ${escapeHtml(p.hours)}</p>`:"";
    m.bindPopup(`<div class="popup"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.city)} • ${escapeHtml(p.type)}</p><p>${escapeHtml(p.address||p.info||"")}</p>${phone}${hours}<div class="actions">${directions}${website}</div></div>`);
    markers.push(m);
    const el=document.createElement("article"); el.className="card";
    const fav=isFavorite(p);
    el.innerHTML=`<div class="cardTop"><div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.city)}</p></div><button class="favorite ${fav?"on":""}" title="Ulubione">${fav?"★":"☆"}</button></div>
      <p class="meta">${escapeHtml(p.address||p.info||"Second hand")}</p>
      <div class="cardActions"><button class="smallBtn nav">Nawiguj</button><span class="badge">${escapeHtml(p.type)}</span></div>`;
    el.querySelector(".favorite").onclick=e=>{e.stopPropagation();toggleFavorite(p)};
    el.querySelector(".nav").onclick=e=>{e.stopPropagation();window.open(mapsUrl(p),"_blank")};
    el.onclick=()=>{map.setView([p.lat,p.lng],15);m.openPopup()};
    list.appendChild(el);
  });
}

function toggleFavorite(p){
  const k=keyFor(p); favorites.has(k)?favorites.delete(k):favorites.add(k); saveFavorites(); render();
}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

render();
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;render()});
document.getElementById("search").oninput=e=>{query=e.target.value.trim().toLowerCase();render()};
document.getElementById("reset").onclick=()=>map.setView([52.05,19.2],6);
document.getElementById("locate").onclick=()=>navigator.geolocation?.getCurrentPosition(pos=>map.setView([pos.coords.latitude,pos.coords.longitude],14),()=>alert("Nie udało się pobrać lokalizacji."));
document.getElementById("addBtn").onclick=()=>document.getElementById("dialog").showModal();

document.getElementById("placeForm").onsubmit=e=>{
  e.preventDefault();
  const p={name:document.getElementById("name").value,city:document.getElementById("city").value,type:document.getElementById("type").value,
    lat:+document.getElementById("lat").value,lng:+document.getElementById("lng").value,info:"Dodane przez użytkownika",source:"custom"};
  const custom=JSON.parse(localStorage.getItem("lumpPlaces")||"[]");custom.push(p);localStorage.setItem("lumpPlaces",JSON.stringify(custom));
  places.push(p);render();document.getElementById("dialog").close();e.target.reset();map.setView([p.lat,p.lng],15);
};

let timer;
map.on("moveend",()=>{clearTimeout(timer);timer=setTimeout(loadRealPlaces,500)});
loadRealPlaces();
