"use strict";
/**
 * nacarta application configuration
 *
 * @author Andreas Rümpel <ruempel@gmail.com>
 * @see https://developers.google.com/maps/documentation/javascript/get-api-key
 */
let basePath = "data/"; // prefix for files
let files = ["example-core", "example-extension"]; // array of data files (without .json extension)
let egoMale = true; // set to false, if ego is a woman
let mapsKey = ""; // Google Maps JS API key
let authorName = "Author unknown"; // put in your name here
let authorLocation = ""; // put in where you live