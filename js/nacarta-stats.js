"use strict";
import Nacarta from "./nacarta.js";

/**
 * Provides application logic for statistics computing over person database.
 *
 * @author Andreas Rümpel <ruempel@gmail.com>
 */
export default class NacartaStats {
    static init() {
        Nacarta.init(NacartaStats.processStatistics);
    }

    /**
     * Renders statistics.
     */
    static processStatistics() {
        // iterate over persons
        for (const person of Nacarta.persons) {
            if (person.death && person.death.year && person.birth && person.birth.year) {
                const days = Math.floor(NacartaStats.computeLifeSpan(person.birth, person.death) / (1000 * 60 * 60 * 24));
                const years = Math.floor(days / 365);
                console.log(`${person.firstnames} ${person.name}: ${years} years`)
                // put lifespan and person object into histogram map
                // define group of histogram
            }
        }
    }

    /**
     * Returns number of milliseconds between birth and death events.
     *
     * @param birth
     * @param death
     * @returns {number}
     */
    static computeLifeSpan(birth, death) {
        // put raw data into date objects and compute time difference
        // take only year, if month and day not available (default day to 15, month to 6)
        // optional: introduce uncertainty to life span
        const birthDate = new Date(birth.year, birth.month || 5, birth.day || 15); // month is 0-based
        const deathDate = new Date(death.year, death.month || 5, death.day || 15);
        return deathDate.getTime() - birthDate.getTime();
    }
}
