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
    const mapOptions = {
        zoom: 8,
        center: new google.maps.LatLng(51.051, 13.735),
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    const canvas = jQuery("<div>").attr({id: "map-canvas"}).appendTo("body");
    map = new google.maps.Map(canvas.get(0), mapOptions);
    bb = new google.maps.LatLngBounds();

    loadPersons();
}

/**
 * Collect locations of persons database.
 */
function loadPersons() {
    const promises = [];
    for (const file of files)
        promises.push(jQuery.getJSON(basePath + file + ".json", data => persons.push(...data)));

    Promise.all(promises).then(() => { // wait for all JSON files processed
        for (const person of persons) {
            if (person.birth && person.birth.location) locations.push(person.birth.location);
            if (person.death && person.death.location) locations.push(person.death.location);
            // TODO make birth and death locations selectable individually
        }

        const locationsUnique = Array.from(new Set(locations));
        console.info(locationsUnique);

        // try to get geo-coded address from cache
        const locationsUncached = [];
        for (const locationRaw of locationsUnique) {
            const location = locationRaw.trim().replace(/\?/, "");
            const found = geocodeCache.find(element => element.name === location);
            if (found) {
                const latlng = new google.maps.LatLng(found.lat, found.lng);
                handleLocation(latlng, location);
            }
            else locationsUncached.push(location);
        }

        // get remaining locations live and log them to add to cache
        const interval = window.setInterval(function () {
            if (locationsUncached.length < 1) {
                window.clearInterval(interval);
                return;
            }

            const location = locationsUncached.pop();
            new google.maps.Geocoder().geocode({"address": location}, (results, status) => {
                if (status === google.maps.GeocoderStatus.OK) {
                    const coordinates = results[0].geometry.location;
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
    const marker = new google.maps.Marker({
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
    const src = "https://maps.google.com/maps/api/js?key=" + mapsKey + "&callback=initMap";
    jQuery("<script/>").attr({src: src, async: "async"}).appendTo("head");
});