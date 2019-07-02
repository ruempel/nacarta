"use strict";

/**
 * Provides nacarta map application logic.
 *
 * @author Andreas Rümpel <ruempel@gmail.com>
 */
export default class NacartaMap {
    /**
     * Initializes Google map.
     */
    static init() {
        const mapOptions = {
            zoom: 8,
            center: new google.maps.LatLng(51.051, 13.735),
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        const canvas = jQuery("<div>").attr({id: "map-canvas"}).appendTo("body");
        this.map = new google.maps.Map(canvas.get(0), mapOptions);
        this.bb = new google.maps.LatLngBounds();
        this.persons = [];
        this.locations = [];

        NacartaMap.loadPersons();
    }

    /**
     * Collects locations of persons database.
     */
    static loadPersons() {
        const promises = [];
        for (const file of NacartaMap.config.files)
            promises.push(jQuery.getJSON(NacartaMap.config.basePath + file + ".json",
                data => this.persons.push(...data)));

        Promise.all(promises).then(() => { // wait for all JSON files processed
            for (const person of this.persons) {
                if (person.birth && person.birth.location) this.locations.push(person.birth.location);
                if (person.death && person.death.location) this.locations.push(person.death.location);
                // TODO make birth and death locations selectable individually
            }

            const locationsUnique = Array.from(new Set(this.locations));
            console.info(locationsUnique);

            // try to get geo-coded address from cache
            const locationsUncached = [];
            for (const locationRaw of locationsUnique) {
                const location = locationRaw.trim().replace(/\?/, "");
                const found = NacartaMap.geocodeCache.find(element => element.name === location);
                if (found) {
                    const latlng = new google.maps.LatLng(found.lat, found.lng);
                    NacartaMap.handleLocation(latlng, location);
                } else locationsUncached.push(location);
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
                        console.info('ADD THIS ENTRY TO config/geocode-cache.json: "'
                            + location + '": ' + JSON.stringify(coordinates) + ",");
                        handleLocation(coordinates, location);
                    } else {
                        console.warn("geocoding status = " + status + " for location: " + location);
                    }
                });
            }, 2000);
        });
    }

    /**
     * Sets marker and updates viewport bounding box.
     *
     * @param {Object} latlng coordinates as google.maps.LatLng
     * @param {string} name location name
     */
    static handleLocation(latlng, name) {
        const marker = new google.maps.Marker({
            map: this.map,
            position: latlng
        });
        marker.addListener("click", () => {
            new google.maps.InfoWindow({
                content: name
            }).open(this.map, marker);
        });
        this.bb.extend(new google.maps.LatLng(latlng.lat(), latlng.lng()), false);
        this.map.fitBounds(this.bb);
    }
}
