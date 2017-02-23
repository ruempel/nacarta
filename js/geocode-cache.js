"use strict";
/**
 * Geocode cache to reduce Google geocode service load and increase performance.
 *
 * @author Andreas Rümpel <ruempel@gmail.com>
 * @since 2017-01-27
 */
let geocodeCache = {
    "Berlin": {"lat": 52.52000659999999, "lng": 13.404953999999975},
    "Dublin": {"lat": 53.3498053, "lng": -6.260309699999993},
    "London": {"lat": 51.5073509, "lng": -0.12775829999998223},
    "Toronto": {"lat": 43.653226, "lng": -79.38318429999998},
    "Vancouver": {"lat": 49.2827291, "lng": -123.12073750000002}
};