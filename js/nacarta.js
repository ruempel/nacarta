"use strict";
/**
 * Configuration and person database contaner and loader.
 *
 * @author Andreas Rümpel <ruempel@gmail.com>
 */
export default class Nacarta {
    /**
     * typedef {Object} Nacarta.config
     * @property {string} basePath directory path of the data files
     * @property {string} files database files
     * @property {string} filterIdentifier filter expression the person identifier has to start with
     * @property {string} egoMale true, if ego is of male sex, false otherwise
     * @property {string} authorLocation address information of the data's author
     * @property {string} authorName name of the data's author
     * @property {string} mapsKey Google maps auth key
     */

    /**
     * @typedef {Object} Person
     * @property {string} firstnames person's given names (space-separated)
     * @property {string} name person's family name
     * @property {string|undefined} birthname person's family name at birth
     * @property {string} id person's identifier
     * @property {string} occupation person's occupation or profession
     * @property {string} info additional information about the person
     * @property {Person} father person's father
     * @property {Person} mother person's mother
     * @property {Object} birth person's birth information
     * @property {Object} death person's death information
     * @property {Object} baptism person's baptism information
     * @property {Object} marriage person's marriage information
     */

    /**
     * Handler for processing person data. Assume that the persons array is filled.
     * @callback loadPersonsCallback
     */

    /**
     * Loads persons from a set of JSON files and initiates processing and rendering.
     *
     * @param {loadPersonsCallback} callback function to execute as soon as all persons are loaded
     */
    static init(callback) {
        jQuery.getJSON("./config/app.json").then(appConfig => { // load app config
            Nacarta.config = appConfig; // application config loaded from file
            Nacarta.persons = []; // array of person objects

            // load persons from database
            const promises = [];
            for (const file of Nacarta.config.files)
                promises.push(jQuery.getJSON(Nacarta.config.basePath + file + ".json",
                    data => Nacarta.persons.push(...data)));
            Promise.all(promises).then(callback);
        });
    }
}
