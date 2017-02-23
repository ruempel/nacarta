"use strict";
/**
 * nacarta map application logic
 *
 * @author Andreas Rümpel <ruempel@gmail.com>
 */
let map, bb, persons = [], locations = [];

/**
 * Callback for Google Maps to initialize map.
 */
function initMap() {
    let mapOptions = {
        zoom: 8,
        center: new google.maps.LatLng(51.051, 13.735),
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    let canvas = jQuery("<div>").attr({id: "map-canvas"}).appendTo("body");
    map = new google.maps.Map(canvas.get(0), mapOptions);
    bb = new google.maps.LatLngBounds();

    loadPersons();
}

/**
 * Collect locations of persons database.
 */
function loadPersons() {
    let promises = [];
    for (let file of files)
        promises.push(jQuery.getJSON(basePath + file + ".json", data => persons.push(...data)));

    Promise.all(promises).then(() => { // wait for all JSON files processed
        for (let person of persons) {
            if (person.birth && person.birth.location) locations.push(person.birth.location);
            if (person.death && person.death.location) locations.push(person.death.location);
            // TODO make birth and death locations selectable individually
        }

        let locationsUnique = Array.from(new Set(locations));
        console.info(locationsUnique);

        // try to get geo-coded address from cache
        let locationsUncached = [];
        for (let location of locationsUnique) {
            if (geocodeCache.hasOwnProperty(location)) {
                let latlng = new google.maps.LatLng(geocodeCache[location].lat, geocodeCache[location].lng);
                handleLocation(latlng, location);
            }
            else locationsUncached.push(location);
        }

        // get remaining locations live and log them to add to cache
        let interval = window.setInterval(function () {
            if (locationsUncached.length < 1) {
                window.clearInterval(interval);
                return;
            }

            let location = locationsUncached.pop();
            new google.maps.Geocoder().geocode({"address": location}, (results, status) => {
                if (status == google.maps.GeocoderStatus.OK) {
                    let coordinates = results[0].geometry.location;
                    console.info('ADD THIS LINE TO geocode-cache.js: "' + location + '": ' + JSON.stringify(coordinates) + ",");
                    handleLocation(coordinates, location);
                } else {
                    console.warn("geocoding status = " + status + " for location: " + location);
                }
            });
        }, 2000);
    });
}

/**
 * Set marker and update bounding box.
 *
 * @param {Object} latlng coordinates as google.maps.LatLng
 * @param {string} name location name
 */
function handleLocation(latlng, name) {
    let marker = new google.maps.Marker({
        map: map,
        position: latlng
    });
    marker.addListener("click", () => {
        new google.maps.InfoWindow({
            content: name
        }).open(map, marker);
    });
    bb.extend(new google.maps.LatLng(latlng.lat(), latlng.lng()), false);
    map.fitBounds(bb);
}

/**
 * Add Google Maps dependency with appropriate API key.
 *
 * @see nacarta-config.js
 */
jQuery(() => {
    let src = "https://maps.google.com/maps/api/js?key=" + mapsKey + "&callback=initMap";
    jQuery("<script/>").attr({src: src, async: "async"}).appendTo("head");
});