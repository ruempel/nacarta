"use strict";
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
 * typedef {Object} Nacarta.config
 * @property {string} basePath directory path of the data files
 * @property {string} files database files
 * @property {string} filterIdentifier filter expression the person identifier has to start with
 * @property {string} egoMale true, if ego is of male sex, false otherwise
 * @property {string} authorLocation address information of the data's author
 * @property {string} authorName name of the data's author
 */

/**
 * Provides application logic for nacarta chart and list views.
 *
 * @author Andreas Rümpel <ruempel@gmail.com>
 */
export default class Nacarta {
    /**
     * Handler for processing person data. Assume that the persons array is filled.
     * @callback loadPersonsCallback
     */

    /**
     * Loads persons from a set of JSON files and initiates processing and rendering.
     *
     * @param {loadPersonsCallback} callback function to execute as soon as all persons are loaded
     */
    static loadPersons(callback) {
        jQuery.getJSON("./config/app.json").then(appConfig => { // load app config
            Nacarta.config = appConfig; // application config loaded from file
            Nacarta.persons = []; // array of person objects
            Nacarta.generations = new Map(); // person array for each generation integer
            Nacarta.ego = undefined; // pointer for ego person
            Nacarta.linkCanvas = undefined; // canvas to draw SVG links on

            // offset and statistics configuration
            Nacarta.generationsOffset = 230; // offset between two generation lines
            Nacarta.globalYOffset = 30; // small margin to fit curved lines into the canvas
            Nacarta.statistics = {
                numberOfPersonsMale: 0,
                numberOfPersonsFemale: 0,
                location: Nacarta.config.authorLocation,
                author: Nacarta.config.authorName
            };

            // load persons from database
            const promises = [];
            for (const file of Nacarta.config.files)
                promises.push(jQuery.getJSON(Nacarta.config.basePath + file + ".json",
                    data => Nacarta.persons.push(...data)));
            Promise.all(promises).then(callback);
        });
    }

    /**
     * Filters persons such that the result set contains only persons leading to the filter person
     * and persons derived from the filter person.
     */
    static filterPersons() {
        const personsFiltered = [];
        for (const person of Nacarta.persons) {
            if (!Nacarta.config.filterIdentifier
                || person.id.startsWith(Nacarta.config.filterIdentifier)
                || Nacarta.config.filterIdentifier.startsWith(person.id))
                personsFiltered.push(person);
        }
        Nacarta.persons = personsFiltered;
    }

    /**
     * Renders a mixed SVG and HTML chart of the persons provided as well as relations between them.
     */
    static processDataToChart() {
        Nacarta.filterPersons();
        Nacarta.statistics.numberOfPersonsTotal = Nacarta.persons.length;
        for (const person of Nacarta.persons) {
            const generation = Nacarta.getGeneration(person);
            Nacarta.generations.get(generation) || Nacarta.generations.set(generation, []); // generation exists?
            Nacarta.generations.get(generation).push(person); // add person to proper generation
            if (person.id === "") Nacarta.ego = person;
        }
        Nacarta.statistics.numberOfGenerations = Nacarta.generations.size;

        // sort persons within each generation
        for (const [, persons] of Nacarta.generations)
            persons.sort(Nacarta.comparePersonByID);

        Nacarta.setParentLinks();
        Nacarta.setChildAndPartnerLinks();
        Nacarta.createGlobalContainers();
        Nacarta.createRowsAndBoxes();
        Nacarta.centerGenerations();
        console.info(Nacarta.statistics);
    }

    /**
     * Compares person identifiers.
     *
     * @param {Person} a first person
     * @param {Person} b second person
     * @returns {number} comparison result depending on the computed order of persons (-1, 0 or 1)
     */
    static comparePersonByID(a, b) {
        // person with prefix right, if connection via father
        if (a.id.startsWith(b.id) && a.id.substr(b.id.length).startsWith("f"))
            return -1;
        if (b.id.startsWith(a.id) && b.id.substr(a.id.length).startsWith("f"))
            return 1;
        return Nacarta.makeIDComparable(a.id).localeCompare(Nacarta.makeIDComparable(b.id));
    }

    /**
     * Rewrites an identifier to bring it in the proper order for string comparison.
     *
     * @param {string} id person identifier as specified in the database
     * @returns {string} rewritten identifier to be compared by default string comparison
     */
    static makeIDComparable(id) {
        let cid = id;
        if (cid === "") cid = "e";
        // add index 1 to non-indexed sons, daughters and spouses
        cid = cid.replace(/([sdp])(?!\d)/g, "$11");

        // target order: fsepdm
        cid = cid.replace(/f/g, "a");
        cid = cid.replace(/s/g, "b");
        cid = cid.replace(/d/g, "y");
        cid = cid.replace(/m/g, "z");
        return cid;
    }

    /**
     * Provides an integer generation of a given person. Ego generation is 0. The generation of the parents of ego is 1.
     *
     * @param {Person} person family member
     * @returns {number} integer generation
     */
    static getGeneration(person) {
        let generationsID = person.id.replace(/\d*/g, ""); // remove index
        generationsID = generationsID.replace(/p([sd])/g, "$1"); // remove partner from son or daughter

        let generation = 0;
        while (generationsID.length > 0) {
            if (generationsID.startsWith("f") || generationsID.startsWith("m"))
                generation++;
            if (generationsID.startsWith("s") || generationsID.startsWith("d"))
                generation--;
            generationsID = generationsID.substr(1);
        }
        return generation;
    }

    /**
     * Connects person objects with parent links recursively.
     *
     * @param {Person} [person] family member to be augmented with connections
     */
    static setParentLinks(person = Nacarta.ego) {
        const parentCandidates = Nacarta.generations.get(Nacarta.getGeneration(person) + 1);
        if (parentCandidates === undefined) return; // no parent candidates to evaluate
        for (const parentCandidate of parentCandidates) {
            if (parentCandidate.id === person.id + "f") {
                person.father = parentCandidate;
                Nacarta.setParentLinks(parentCandidate);
            }
            if (parentCandidate.id === person.id + "m") {
                person.mother = parentCandidate;
                Nacarta.setParentLinks(parentCandidate);
            }
        }
    }

    /**
     * Connects person objects with child and partner links.
     */
    static setChildAndPartnerLinks() {
        for (const [, persons] of Nacarta.generations)
            for (const person of persons) {
                // handle children
                const childCandidates = Nacarta.generations.get(Nacarta.getGeneration(person) - 1);
                if (childCandidates !== undefined) {
                    const children = [];
                    for (const childCandidate of childCandidates) {
                        const re = new RegExp("^" + person.id + "(p\\d*)?[sd]\\d*$", "g");
                        if (re.test(childCandidate.id))
                            children.push(childCandidate);
                    }
                    person.children = children;
                }

                // handle partners
                const partnerCandidates = Nacarta.generations.get(Nacarta.getGeneration(person));
                const partners = [];
                for (const partnerCandidate of partnerCandidates) {
                    const re = new RegExp("^" + person.id + "p\\d*$", "g");
                    if (re.test(partnerCandidate.id)) {
                        partners.push(partnerCandidate);
                    }
                }
                person.partners = partners;
            }
    }

    /**
     * Sets up render containers as DOM elements.
     */
    static createGlobalContainers() {
        jQuery("<div/>").attr({id: "generations"}).appendTo("body");
        Nacarta.linkCanvas = jQuery("#link-canvas");
    }

    /**
     * Renders a box as DOM element for each person object. Organizes them in rows aka. generations.
     */
    static createRowsAndBoxes() {
        Nacarta.statistics.numberOfOldestGeneration = Math.max(...Array.from(Nacarta.generations.keys()));
        for (const [generation, persons] of Nacarta.generations) {
            const row = jQuery("<div>").addClass("generation").attr({id: `generation-${generation}`});
            const topOffset = Nacarta.globalYOffset
                + (Nacarta.statistics.numberOfOldestGeneration - generation) * Nacarta.generationsOffset;
            row.css("top", topOffset + "px");
            row.appendTo("#generations");

            for (const person of persons) {
                const box = jQuery("<div>").addClass("box").attr({id: `box-${person.id}`});
                Nacarta.fillBox(box, person);
                box.appendTo(row);
            }
        }
    }

    /**
     * Fills a person box with data.
     *
     * @param {jQuery} box person box
     * @param {Person} person family member
     */
    static fillBox(box, person) {
        box.data("person", person); // save reference to person in box
        // handle names
        let firstnames = person.firstnames;
        firstnames = firstnames.replace(/\[([^\]]+)]/g, "<span class='optional'>$1</span>");
        jQuery("<div/>").addClass("name").html(firstnames + " " + person.name).appendTo(box);
        let birthnameAndID = (person.birthname === undefined ? "" : "∗&nbsp;" + person.birthname + " · ");
        birthnameAndID += (person.id === "" ? "ego" : person.id); // replace ego id
        jQuery("<div/>").addClass("id").html(birthnameAndID).appendTo(box);

        box.addClass(Nacarta.determineSex(person.id)); // handle box color based on sex
        box.addClass(Nacarta.determineAliveStatus(person));

        // handle events
        const birth = Nacarta.stringifyEvent(person.birth);
        const death = Nacarta.stringifyEvent(person.death);
        const marriage = Nacarta.stringifyEvent(person.marriage);
        const baptism = Nacarta.stringifyEvent(person.baptism);
        if (birth)
            jQuery("<div/>").addClass("event").text(`∗ ${birth}`).appendTo(box);
        if (death)
            jQuery("<div/>").addClass("event").text(`✝ ${death}`).appendTo(box);
        if (marriage)
            jQuery("<div/>").addClass("event").text(`⚭ ${marriage}`).appendTo(box);
        if (baptism)
            jQuery("<div/>").addClass("event").text(`≈ ${baptism}`).appendTo(box);

        // handle occupation and info
        let occupation = person.occupation;
        if (occupation)
            jQuery("<div/>").addClass("info").text(occupation).appendTo(box);
        const info = person.info;
        if (info)
            jQuery("<div/>").addClass("info").text(info).appendTo(box);

        // decoration
        if (Nacarta.isLinear(person)) box.addClass("linear");
    }

    /**
     * Renders all persons into a table with one row for each person.
     */
    static processDataToTable() {
        for (const item of Nacarta.persons) {
            // handle id and row color
            const row = jQuery("<tr/>").appendTo("#persons tbody").addClass(Nacarta.determineSex(item.id));
            jQuery(".male").addClass("table-primary");
            jQuery(".female").addClass("table-danger");

            // append id
            jQuery("<td/>").appendTo(row).text(item.id);

            // handle names
            let firstnames = item.firstnames;
            firstnames = firstnames.replace(/\[([^\]]+)]/g, "<span class='optional'>$1</span>");
            jQuery("<td/>").appendTo(row).html(firstnames);
            let name = item.name;
            if (item.birthname !== undefined) name += " <span class='optional'>(*&nbsp;" + item.birthname + ")</span>";
            jQuery("<td/>").appendTo(row).html(name);

            // handle events
            jQuery("<td/>").appendTo(row).text(Nacarta.stringifyEvent(item.birth));
            jQuery("<td/>").appendTo(row).text(Nacarta.stringifyEvent(item.death));

            // handle misc
            jQuery("<td/>").appendTo(row).text(item.occupation);
            jQuery("<td/>").appendTo(row).text(item.info);
        }
        jQuery("#persons").DataTable({paging: false});
        jQuery("#persons_filter").find("input").addClass("form-control form-control-sm");
    }

    /**
     * Determines whether a person is male, female or a partner with no relevance to determine sex.
     *
     * @param {string} id person's id
     * @returns {string} "male", "female" or ""
     */
    static determineSex(id) {
        let sex = ""; // default: neither male nor female aka. partner
        id = id.replace(/\d*/g, ""); // remove indices from id
        if (id.endsWith("f") || id.endsWith("s") || (id === "" && Nacarta.config.egoMale)) {
            sex = "male";
            Nacarta.statistics.numberOfPersonsMale++;
        }
        if (id.endsWith("m") || id.endsWith("d") || (id === "" && !Nacarta.config.egoMale)) {
            sex = "female";
            Nacarta.statistics.numberOfPersonsFemale++;
        }
        return sex;
    }

    /**
     * Determines whether a person is alive or dead. The decision is based on a present or missing death event.
     *
     * @param {Person} person person to determine the alive status of
     * @returns {string} "alive" or "dead"
     */
    static determineAliveStatus(person) {
        if (person.death !== undefined) return "dead";
        return "alive";
    }

    /**
     * Stringifies a given event object (birth, death, baptism or marriage).
     *
     * @param {Object} event object specifying the event's time and location
     * @param {string} event.day day of the month in which the event happened
     * @param {string} event.month month of the year in which the event happened
     * @param {string} event.year year in which the event happened
     * @param {string} event.location location of the event
     * @returns {string|null} string representing the event
     */
    static stringifyEvent(event) {
        if (event === undefined) return null;
        let eventString = (event.year || "____");
        eventString += "-" + addLeadingZero(event.month) + "-" + addLeadingZero(event.day);
        const location = event.location;
        if (location !== undefined)
            eventString += " · " + location;
        return eventString;

        function addLeadingZero(number) {
            if (isNaN(number)) return "__"; // return default
            if (number > 0 && number < 10) return "0" + number; // add leading zero
            return number; // keep untouched
        }
    }

    /**
     * Determines whether the given person is linearly related to ego.
     *
     * @param {Person} person person to evaluate
     * @returns {boolean} true, if person is ancestor or descendant of ego or ego itself
     */
    static isLinear(person) {
        if (person.id.replace(/[mf]/g, "") === "") return true;
        return person.id.replace(/[sd]\d*/g, "") === "";
    }

    /**
     * Centers the whole diagram by animating the x offset for each row aka. generation.
     */
    static centerGenerations() {
        const generationWidths = new Map();
        for (const [generation,] of Nacarta.generations) {
            generationWidths.set(generation, jQuery("#generation-" + generation).outerWidth());
        }
        const generationWidthMax = Math.max(...Array.from(generationWidths.values())); // compute maximum width
        const padding = Math.max(jQuery(window).width() - generationWidthMax, 0); // center if chart narrower than viewport
        // TODO recompute padding and animate again, if viewport width changes
        const containerStyle = {
            height: Nacarta.generations.size * Nacarta.generationsOffset + "px",
            width: Math.floor(generationWidthMax) + padding + 10 + "px"
        };
        jQuery("#generations, #link-canvas").css(containerStyle);

        const promises = [];
        for (const [generation,] of Nacarta.generations) {
            const offset = (generationWidthMax - generationWidths.get(generation)) / 2 + padding / 2;
            const row = jQuery("#generation-" + generation);
            promises.push(row.animate({"marginLeft": "+=" + offset}).promise());
        }

        Promise.all(promises).then(() => { // wait for shifting rows
            Nacarta.renderParentLinksNaive();
            Nacarta.renderChildAndPartnerLinks();
            jQuery(Nacarta.linkCanvas).html(jQuery(Nacarta.linkCanvas).html());
            // TODO better do it like: http://stackoverflow.com/a/3642265
        });
    }

    /**
     * Renders links to ancestors recursively.
     *
     * @param {Person} person seed person, defaults to ego
     */
    static renderParentLinks(person = Nacarta.ego) {
        if (person.father) {
            Nacarta.drawPath(jQuery(`#box-${person.father.id}`), jQuery(`#box-${person.id}`));
            Nacarta.renderParentLinks(person.father);
        }
        if (person.mother) {
            Nacarta.drawPath(jQuery(`#box-${person.mother.id}`), jQuery(`#box-${person.id}`));
            Nacarta.renderParentLinks(person.mother);
        }
    }

    /**
     * Renders links to ancestors for each person in each generation.
     */
    static renderParentLinksNaive() {
        for (const [, personsInGeneration] of Nacarta.generations)
            for (const person of personsInGeneration) {
                if (person.father) {
                    Nacarta.drawPath(jQuery(`#box-${person.father.id}`), jQuery(`#box-${person.id}`));
                }
                if (person.mother) {
                    Nacarta.drawPath(jQuery(`#box-${person.mother.id}`), jQuery(`#box-${person.id}`));
                }
            }
    }

    /**
     * Draws an SVG (Scalable Vector Graphics) curve.
     *
     * @param {jQuery} upper parent object
     * @param {jQuery} lower child object
     * @param {string} style css class, defaults to "link-parent", may also be "link-child"
     * @see renderParentLinks
     * @see renderChildAndPartnerLinks
     */
    static drawPath(upper, lower, style = "link-parent") {
        // set start coordinates to middle bottom of upper
        const x0 = Math.round(upper.offset().left + (upper.outerWidth() / 2));
        const y0 = Math.round(upper.offset().top + upper.outerHeight());

        // set end coordinates to middle top of lower
        const x1 = Math.round(lower.offset().left + (lower.outerWidth() / 2));
        const y1 = Math.round(lower.offset().top);

        // draw connector line as SVG path
        jQuery("<path/>").addClass(style).attr({d: Nacarta.getCubicPath(x0, x1, y0, y1)})
            .appendTo(Nacarta.linkCanvas);
    }

    static getCubicPath(x0, x1, y0, y1) {
        const offset = 90; // control point vertical offset
        return `M${x0},${y0} C${x0},${y0 + offset} ${x1},${y1 - offset} ${x1},${y1}`;
    }

    /**
     * Renders links to all children and partners.
     */
    static renderChildAndPartnerLinks() {
        for (const [, persons] of Nacarta.generations)
            for (const person of persons) {
                const personBox = jQuery(`#box-${person.id}`);
                if (person.children)
                    for (const child of person.children)
                        Nacarta.drawPath(personBox, jQuery(`#box-${child.id}`), "link-child");
                if (person.partners)
                    for (const partner of person.partners)
                        Nacarta.drawPartnerPath(personBox, jQuery(`#box-${partner.id}`));
            }
    }

    /**
     * Draws an SVG curve.
     *
     * @param {jQuery} person relative having a partner
     * @param {jQuery} partner partner of the relative
     * @see renderChildAndPartnerLinks
     */
    static drawPartnerPath(person, partner) {
        const x0 = Math.round(person.offset().left + (person.outerWidth() / 2)) + 20;
        const x1 = Math.round(partner.offset().left + (partner.outerWidth() / 2)) - 20;
        const y = Math.round(person.offset().top);

        // draw curve as SVG path, https://www.w3.org/TR/SVG/paths.html
        const offset = 3;
        const path = `M ${x0},${y} v-${offset} q${(x1 - x0) / 2},-${offset * 4} ${x1 - x0},0 v${offset}`;
        jQuery("<path/>").addClass("link-partner").attr({d: path}).appendTo(Nacarta.linkCanvas);
    }
}
