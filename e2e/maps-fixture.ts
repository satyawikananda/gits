// A deterministic DOM fixture, not a claim about the live Google Maps UI.
export const mapsFixture = `<!doctype html><html lang="en"><body>
<input id="searchboxinput" name="q"><button id="searchbox-searchbutton">Search</button>
<div id="results" role="feed"></div><div id="details"></div>
<script>
const entries = [
 {id:'fixture-one', name:'Coffee With Website', website:true},
 {id:'fixture-two', name:'Coffee Two', website:false},
 {id:'fixture-three', name:'Coffee Three', website:false}
];
function renderResults() {
 document.getElementById('details').innerHTML = '';
 document.getElementById('results').innerHTML = entries.map(e => '<a aria-label="'+e.name+'" href="https://www.google.com/maps/place/'+e.name.replaceAll(' ','+')+'/data=!1s'+e.id+'!8m2">'+e.name+'</a>').join('');
 document.querySelectorAll('#results a').forEach((a,i) => a.onclick = event => {
  event.preventDefault(); history.pushState({}, '', a.href);
  const e=entries[i];
  document.getElementById('details').innerHTML = '<div role="main"><button aria-label="Back to results">Back</button><h1>'+e.name+'</h1><button jsaction="pane.category">Coffee shop</button><button data-item-id="address" aria-label="Address: Denpasar, Bali"></button><span role="img" aria-label="4.7 stars"></span><button aria-label="123 reviews"></button><button data-item-id="phone:tel:+621234" aria-label="Phone: +621234"></button><p>Open · Closes 9 PM</p>'+(e.website?'<a data-item-id="authority" href="https://coffee.example">Website</a>':'')+'</div>';
  document.querySelector('[aria-label="Back to results"]').onclick = () => { history.pushState({}, '', '/maps/search/Coffee+Bali'); renderResults(); };
 });
}
document.getElementById('searchbox-searchbutton').onclick = () => { history.pushState({}, '', '/maps/search/Coffee+Bali'); renderResults(); };
renderResults();
</script></body></html>`
