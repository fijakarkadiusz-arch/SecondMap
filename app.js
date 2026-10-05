const seed=[
{name:"Vintage Store",city:"Warszawa",type:"Vintage",lat:52.2297,lng:21.0122,info:"Wyselekcjonowana odzież vintage"},
{name:"Second Hand Centrum",city:"Kraków",type:"Second hand",lat:50.0647,lng:19.9450,info:"Odzież używana • dostawy co tydzień"},
{name:"Lump na Jeżycach",city:"Poznań",type:"Second hand",lat:52.4100,lng:16.9000,info:"Duży wybór • sprzedaż na sztuki"},
{name:"Szafa Vintage",city:"Wrocław",type:"Vintage",lat:51.1079,lng:17.0385,info:"Vintage • streetwear"},
{name:"Second Look",city:"Gdańsk",type:"Second hand",lat:54.3520,lng:18.6466,info:"Odzież damska i męska"},
{name:"Retro Szafa",city:"Łódź",type:"Vintage",lat:51.7592,lng:19.4560,info:"Moda retro • akcesoria"},
{name:"Lump Silesia",city:"Katowice",type:"Second hand",lat:50.2649,lng:19.0238,info:"Odzież na wagę"},
{name:"Outlet Mix",city:"Lublin",type:"Outlet",lat:51.2465,lng:22.5684,info:"Końcówki kolekcji • outlet"},
{name:"Druga Szansa",city:"Szczecin",type:"Second hand",lat:53.4285,lng:14.5528,info:"Second hand • akcesoria"},
{name:"Vintage Bydgoszcz",city:"Bydgoszcz",type:"Vintage",lat:53.1235,lng:18.0084,info:"Vintage i denim"}
];
let places=[...seed,...JSON.parse(localStorage.getItem("lumpPlaces")||"[]")];
const map=L.map("map",{zoomControl:false}).setView([52.05,19.2],6);
L.control.zoom({position:"bottomright"}).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
let markers=[]; let filter="all"; let query="";
const icon=()=>L.divIcon({className:"",html:'<div class="marker"><span>L</span></div>',iconSize:[30,30],iconAnchor:[15,29]});
function visible(p){return (filter==="all"||p.type.toLowerCase()===filter)&&(`${p.name} ${p.city}`.toLowerCase().includes(query))}
function render(){
 markers.forEach(m=>map.removeLayer(m)); markers=[];
 const list=document.getElementById("list"); list.innerHTML="";
 const shown=places.filter(visible); document.getElementById("count").textContent=`${shown.length} ${shown.length===1?"miejsce":"miejsc"}`;
 shown.forEach(p=>{
   const m=L.marker([p.lat,p.lng],{icon:icon()}).addTo(map).bindPopup(`<div class="popup"><h3>${p.name}</h3><p>${p.city} • ${p.type}</p><p>${p.info||"Lumpeks / sklep z odzieżą używaną"}</p></div>`); markers.push(m);
   const el=document.createElement("article"); el.className="card"; el.innerHTML=`<div class="cardTop"><div><h3>${p.name}</h3><p>${p.city}</p></div><span class="badge">${p.type}</span></div><p class="meta">${p.info||"Sklep z odzieżą używaną"}</p>`;
   el.onclick=()=>{map.setView([p.lat,p.lng],14);m.openPopup()}; list.appendChild(el);
 });
}
render();
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;render()});
document.getElementById("search").oninput=e=>{query=e.target.value.trim().toLowerCase();render()};
document.getElementById("reset").onclick=()=>map.setView([52.05,19.2],6);
document.getElementById("locate").onclick=()=>navigator.geolocation?.getCurrentPosition(pos=>map.setView([pos.coords.latitude,pos.coords.longitude],13),()=>alert("Nie udało się pobrać lokalizacji."));
const dialog=document.getElementById("dialog"); document.getElementById("addBtn").onclick=()=>dialog.showModal();
document.getElementById("placeForm").onsubmit=e=>{
 e.preventDefault();
 const p={name:document.getElementById("name").value,city:document.getElementById("city").value,type:document.getElementById("type").value,lat:+document.getElementById("lat").value,lng:+document.getElementById("lng").value,info:"Dodane przez użytkownika"};
 const custom=JSON.parse(localStorage.getItem("lumpPlaces")||"[]");custom.push(p);localStorage.setItem("lumpPlaces",JSON.stringify(custom));places.push(p);render();dialog.close();e.target.reset();map.setView([p.lat,p.lng],14);
};
