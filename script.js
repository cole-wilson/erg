mapboxgl.accessToken = 'pk.eyJ1IjoiY29sZXdpbHNvbiIsImEiOiJjbDV6cGdtNGoxZnZ1M2pvMWtwYmw1NDd3In0.qF5QkslC-xFbi0_jpxhxdw';

import {courses} from './courses.js'
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.17/+esm';


// const gui = new GUI();
// gui.add( document, 'title' );


const registerServiceWorker = async () => {
navigator.storage.persist()
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      if (registration.installing) {
        console.log('Service worker installing');
      } else if (registration.waiting) {
        console.log('Service worker installed');
      } else if (registration.active) {
        console.log('Service worker active');
      }
    } catch (error) {
      console.error(`Registration failed with ${error}`);
    }
  }
};

// …

registerServiceWorker();

var currentCourse = null;
var workout = {distance:2000, pace:105, split:400};
var data = {}
var interacting = false;
let ws;

const map = new mapboxgl.Map({
	container: 'map',
	center: [-122.900833, 10],
	zoom: 2.2,
	style: 'mapbox://styles/colewilson/cl612pb3v006q14ocbn49p9yz',
});

function spinGlobe() {
	if (!interacting && map.getZoom() < 5) {
		const center = map.getCenter();
		center.lng -= 5;
		map.easeTo({ center, duration: 1000, easing: (n) => n });
	}
}

let doneinteracting = () => {interacting=false;spinGlobe()}
map.on("mouseup", doneinteracting)
map.on("dragend", doneinteracting)
map.on("pitchend", doneinteracting)
map.on("rotateend", doneinteracting)
map.on("moveend", spinGlobe)
map.on('mousedown', () => {interacting = true;});
spinGlobe()



// const draw = new MapboxDraw({
// 	displayControlsDefault: false,
// 	controls: {line_string: true,},
// 	defaultMode: 'draw_line_string'
// });
// map.addControl(draw);

map.on("zoom", ()=>{
	console.log(map.getZoom())
})

map.on("load", () => {	
	map.loadImage(
'./trees.jpeg',
(err, image) => {
// Throw an error if something goes wrong.
if (err) throw err;
 
// Add the image to the map style.
map.addImage('pattern', image);
 
// Create a new layer and style it using `fill-pattern`.
	map.addLayer(
{
'id': 'add-3d-buildings',
'source': 'composite',
'source-layer': 'building',
'filter': ['==', 'extrude', 'true'],
'type': 'fill-extrusion',
'minzoom': 15,
'paint': {
'fill-extrusion-color': '#aaa',
 
// Use an 'interpolate' expression to
// add a smooth transition effect to
// the buildings as the user zooms in.
'fill-extrusion-height': [
	'interpolate',
	['linear'],
	['zoom'],
	15,
	0,
	15.05,
	['get', 'height']
],
'fill-extrusion-base': [
'interpolate',
	['linear'],
	['zoom'],
	15,
	0,
	15.05,
	['get', 'min_height']
],
'fill-extrusion-opacity': 1,
	'fill-extrusion-pattern': 'pattern'
}
},
);
}
);

	map.addLayer({
		id: 'custom_layer',
		type: 'custom',
		renderingMode: '3d',
		onAdd: function (map, gl) {
			window.tb = new Threebox(map,gl,{defaultLights: true, sky:true,});

			setUpWS();
			setUp3D();
			showCourses();
			
		},
		render: function (gl, matrix) {tb.update()}
	});
});


function setUpWS() {
	ws = new WebSocket("ws://localhost:8765")
	ws.onmessage = (e) => {
		window.data = JSON.parse(e.data)
		document.getElementById("data").innerHTML = `
			<div title="time">${Math.floor(window.data.time/60)}:${Math.floor(window.data.time%60)}</div>
			<div title="distance">${Math.round(window.data.distance)}</div>
			<div title="pace">${Math.floor(window.data.pace/60)}:${Math.floor(window.data.pace%60)}</div>
			<div title="rate">${window.data.spm}</div>
		`
		window.data.distance = workout.distance - window.data.distance
	}
}
function setUp3D() {
	var geometry = new THREE.BoxGeometry(7.3, 0.3, 15.7);
	let boat = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: 0x660000 }));
	boat = tb.Object3D({ obj: boat, units: 'meters' });
	tb.add(boat);

	function animate() {
		requestAnimationFrame(animate);

		let course=currentCourse
		console.log(course, window.data.distance)
		if (course == null || window.data.distance > workout.distance)
			return
		course = course.coordinates

		let newCoords = turf.along(turf.lineString(course), window.data.distance, {units:'meters'}).geometry.coordinates;
		if (newCoords[0] == boat.coordinates[0] && newCoords[1] == boat.coordinates[1])
			return
		console.log(9)
		let bearing = turf.bearing(boat.coordinates, turf.point(newCoords),)

		boat.setCoords(newCoords);
		boat.setRotation(-bearing-90 || 360)

		let options = {
			center: boat.coordinates,
		}
		map.jumpTo(options)
		map.easeTo({bearing: bearing+180, duration: 100})
	}
	animate();
}

function showCourses() {
	var courseLines = [];

	for (var courseName in courses) {
		var course = courses[courseName];

		courseLines.push(course.coordinates);
		course.marker = new mapboxgl.Popup({ closeOnClick: false, closeButton: false})
		course.marker.setLngLat(course.coordinates[0])
		course.marker.setHTML(`<strong>${course.name}</strong>`)
		course.marker.addTo(map);

		let listItem = document.createElement("li");
		listItem.classList.add("course")
		listItem.dataset.id = courseName;
		listItem.innerHTML = `<h2>${course.name}</h2><span>${Math.round(turf.length(turf.lineString(course.coordinates),{units:'meters'}))}m</span>`;
		listItem.onclick = (e) => {newWorkout(listItem.dataset.id)}
		document.getElementById("courselist").appendChild(listItem)
	}

	document.getElementById("courseSearch").oninput = (e) => {
		let text = e.target.value;
		let items = document.querySelectorAll("#courselist li");
		for (var i=0;i<items.length;i++) {
			console.log(items[i], items[i].innerText)
			if (items[i].innerText.toLowerCase().includes(text) || text == "")
				items[i].style.display = "block";
			else
				items[i].style.display = "none";
		}
	}

	map.addSource('courses',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:courseLines}}});
	map.addLayer({id:'courses',type:'line',source:'courses',layout:{'line-join':'round',"line-cap":'round'},paint:{'line-color':'#ff0','line-width':3}});
}
function newWorkout(courseName) {
	let course = courses[courseName]
	document.getElementById("setup").style.display = "none";
	let settings = document.getElementById("workout");
	settings.style.display = "block";

	map.flyTo({
		center: course.coordinates[0],
		zoom: 12,
		pitch: 0,
		bearing: 0
	})

	let gui = new GUI({container:settings, width: "100%", title: "Workout Options"})
	// let typeController = gui.add(workout, 'type', ['distance',])
	// gui.add(workout, "hours",)
	// gui.add(workout, "minutes",)
	// gui.add(workout, "seconds",)
	gui.add(workout, 'pace')
	gui.add(workout, 'split')
	gui.add(workout, "distance", 100, 20000, 100)	

	// typeController.onChange((d)=>{
		// if (d == "distance") {
		// 	distanceFolder
		// }
	// })

	gui.add({async start(){
		ws.send(JSON.stringify(workout))
		document.documentElement.requestFullscreen();
		map.flyTo({
			center: course.coordinates[0],
			pitch: 80,
			bearing: turf.bearing(turf.along(turf.lineString(course.coordinates), 0.1, {units:'meters'}), course.coordinates[0]),
			zoom: 20
		})
		document.getElementById("workout").style.display = "none"
		document.getElementById("data").style.display = "block";
		await map.once('moveend')
		course.marker.remove();
		currentCourse = course;
	}}, 'start').name("Start Workout")

	settings.querySelector("a").onclick = () => {
		document.getElementById("setup").style.display = "block";
		settings.style.display = "none"
		map.flyTo({zoom:2.2})
		gui.destroy()
	}

}

window.map = map
window.data = data
