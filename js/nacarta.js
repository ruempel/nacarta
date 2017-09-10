"use strict";
/**
 * nacarta application logic for chart and list views
 *
 * @author Andreas Rümpel <ruempel@gmail.com>
 */
let persons = []; // array of person objects
let generations = new Map(); // person array for each generation integer
let ego; // pointer for ego person
let linkCanvas; // canvas to draw SVG links on

// offset and statistics configuration
let generationsOffset = 230; // offset between two generation lines
let globalYOffset = 30; // small margin to fit curved lines into the canvas
let statistics = {numberOfPersonsMale: 0, numberOfPersonsFemale: 0, location: authorLocation, author: authorName};

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
 */

/**
 * Handler for processing person data. Assume that the persons array is filled.
 * @callback loadPersonsCallback
 */

/**
 * Load persons from a number of JSON files and initiate processing and rendering.
 * @param {loadPersonsCallback} callback function to execute as soon as all persons are loaded
 */
function loadPersons(callback) {
    let promises = [];
    for (let file of files)
        promises.push(jQuery.getJSON(basePath + file + ".json", data => persons.push(...data)));
    Promise.all(promises).then(callback);
}

function processDataToChart() {
    statistics.numberOfPersonsTotal = persons.length;
    for (let person of persons) {
        let generation = getGeneration(person);
        generations.get(generation) || generations.set(generation, []); // generation exists?
        generations.get(generation).push(person); // add person to proper generation
        if (person.id === "") ego = person;
    }
    statistics.numberOfGenerations = generations.size;

    // sort persons within each generation
    for (let [, persons] of generations)
        persons.sort(comparePersonByID);

    setParentLinks();
    setChildAndPartnerLinks();
    createGlobalContainers();
    createRowsAndBoxes();
    centerGenerations();
    console.info(statistics);
}

/**
 * Compare person identifiers.
 *
 * @param {Person} a first person
 * @param {Person} b second person
 * @returns {number} comparison result depending on the computed order of persons (-1, 0 or 1)
 */
function comparePersonByID(a, b) {
    // person with prefix right, if connection via father
    if (a.id.startsWith(b.id) && a.id.substr(b.id.length).startsWith("f"))
        return -1;
    if (b.id.startsWith(a.id) && b.id.substr(a.id.length).startsWith("f"))
        return 1;
    return makeIDComparable(a.id).localeCompare(makeIDComparable(b.id));
}

/**
 * Rewrite an identifier to bring it in the proper order for string comparison.
 *
 * @param {string} id person identifier as specified in the database
 * @returns {string} rewritten identifier to be compared by default string comparison
 */
function makeIDComparable(id) {
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
 * Provide an integer generation of a given person. Ego generation is 0.
 *
 * @param {Person} person family member
 * @returns {number} integer generation
 */
function getGeneration(person) {
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
 * Connect person objects with parent links recursively.
 *
 * @param {Person} [person] family member to be augmented with connections
 */
function setParentLinks(person = ego) {
    let parentCandidates = generations.get(getGeneration(person) + 1);
    if (parentCandidates === undefined) return; // no parent candidates to evaluate
    for (let parentCandidate of parentCandidates) {
        if (parentCandidate.id === person.id + "f") {
            person.father = parentCandidate;
            setParentLinks(parentCandidate);
        }
        if (parentCandidate.id === person.id + "m") {
            person.mother = parentCandidate;
            setParentLinks(parentCandidate);
        }
    }
}

/**
 * Connect person objects with child and partner links.
 */
function setChildAndPartnerLinks() {
    for (let [, persons] of generations)
        for (let person of persons) {
            // handle children
            let childCandidates = generations.get(getGeneration(person) - 1);
            if (childCandidates !== undefined) {
                let children = [];
                for (let childCandidate of childCandidates) {
                    let re = new RegExp("^" + person.id + "(p\\d*)?[sd]\\d*$", "g");
                    if (re.test(childCandidate.id))
                        children.push(childCandidate);
                }
                person.children = children;
            }

            // handle partners
            let partnerCandidates = generations.get(getGeneration(person));
            let partners = [];
            for (let partnerCandidate of partnerCandidates) {
                let re = new RegExp("^" + person.id + "p\\d*$", "g");
                if (re.test(partnerCandidate.id)) {
                    partners.push(partnerCandidate);
                }
            }
            person.partners = partners;
        }
}

/**
 * Set up render containers as DOM elements.
 */
function createGlobalContainers() {
    jQuery("<div/>").attr("id", "generations").appendTo("body");
    linkCanvas = jQuery("#link-canvas");
}

/**
 * Render a box as DOM element for each person object. Organize them in rows = generations.
 */
function createRowsAndBoxes() {
    statistics.numberOfOldestGeneration = Math.max(...Array.from(generations.keys()));
    for (let [generation, persons] of generations) {
        let row = jQuery("<div>").addClass("generation").attr("id", "generation-" + generation);
        let topOffset = globalYOffset + (statistics.numberOfOldestGeneration - generation) * generationsOffset;
        row.css("top", topOffset + "px");
        row.appendTo("#generations");

        for (let person of persons) {
            let box = jQuery("<div>").addClass("box").attr("id", "box-" + person.id);
            fillBox(box, person);
            box.appendTo(row);
        }
    }
}

/**
 * Fill a person box with data.
 *
 * @param {jQuery} box person box
 * @param {Person} person family member
 */
function fillBox(box, person) {
    // handle names
    let firstnames = person.firstnames;
    firstnames = firstnames.replace(/\[([^\]]+)]/g, "<span class='optional'>$1</span>");
    jQuery("<div/>").addClass("name").html(firstnames + " " + person.name).appendTo(box);
    let birthnameAndID = (person.birthname === undefined ? "" : "*&nbsp;" + person.birthname + " · ");
    birthnameAndID += (person.id === "" ? "ego" : person.id); // replace ego id
    jQuery("<div/>").addClass("id").html(birthnameAndID).appendTo(box);

    box.addClass(determineSex(person.id)); // handle box color based on sex

    // handle events
    let birth = stringifyEvent(person.birth);
    let death = stringifyEvent(person.death);
    if (birth)
        jQuery("<div/>").addClass("event").text("* " + birth).appendTo(box);
    if (death)
        jQuery("<div/>").addClass("event").text("† " + death).appendTo(box);

    // handle occupation and info
    let occupation = person.occupation;
    if (occupation)
        jQuery("<div/>").addClass("info").text(occupation).appendTo(box);
    let info = person.info;
    if (info)
        jQuery("<div/>").addClass("info").text(info).appendTo(box);

    // decoration
    if (isLinear(person)) box.addClass("linear");
}

/**
 * Render all persons into a table with one line for each person.
 */
function processDataToTable() {
    for (let item of persons) {
        // handle id and row color
        let row = jQuery("<tr/>").appendTo("#persons tbody").addClass(determineSex(item.id));
        jQuery(".male").addClass("info");
        jQuery(".female").addClass("danger");

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
        jQuery("<td/>").appendTo(row).text(stringifyEvent(item.birth));
        jQuery("<td/>").appendTo(row).text(stringifyEvent(item.death));

        // handle misc
        jQuery("<td/>").appendTo(row).text(item.occupation);
        jQuery("<td/>").appendTo(row).text(item.info);
    }
    jQuery('#persons').DataTable({paging: false});
}

/**
 * Determine whether a person is male, female or a partner with no need to determine sex.
 *
 * @param {string} id person's id
 * @returns {string} "male", "female" or ""
 */
function determineSex(id) {
    let sex = ""; // default: neither male nor female aka. partner
    id = id.replace(/\d*/g, ""); // remove indices from id
    if (id.endsWith("f") || id.endsWith("s") || (id === "" && egoMale)) {
        sex = "male";
        statistics.numberOfPersonsMale++;
    }
    if (id.endsWith("m") || id.endsWith("d") || (id === "" && !egoMale)) {
        sex = "female";
        statistics.numberOfPersonsFemale++;
    }
    return sex;
}

/**
 * Stringify a given event object (birth or death).
 *
 * @param {Object} event object specifying the event's time and location
 * @param {string} event.day day of the month in which the event happened
 * @param {string} event.month month of the year in which the event happened
 * @param {string} event.year year in which the event happened
 * @param {string} event.location location of the event
 * @returns {string|null} string representing the event
 */
function stringifyEvent(event) {
    if (event === undefined) return null;
    let eventString = (event.year || "____");
    eventString += "-" + addLeadingZero(event.month) + "-" + addLeadingZero(event.day);
    let location = event.location;
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
 * Determine whether person is linearly related to ego.
 *
 * @param {Person} person person to evaluate
 * @returns {boolean} true, if person is ancestor or descendant of ego or ego itself
 */
function isLinear(person) {
    if (person.id.replace(/[mf]/g, "") === "") return true;
    return person.id.replace(/[sd]\d*/g, "") === "";
}

/**
 * Center whole diagram by animating x offset for each row.
 */
function centerGenerations() {
    let globalOffset = 0;
    let generationWidths = new Map();
    for (let [generation,] of generations) {
        generationWidths.set(generation, jQuery("#generation-" + generation).outerWidth());
    }
    let generationWidthMax = Math.max(...Array.from(generationWidths.values())); // compute maximum width
    let containerStyle = {
        height: generations.size * generationsOffset + "px",
        width: Math.floor(generationWidthMax) + 800 + "px"
    };
    jQuery("#generations, #link-canvas").css(containerStyle);

    let promises = [];
    for (let [generation,] of generations) {
        let offset = (generationWidthMax - generationWidths.get(generation)) / 2 + globalOffset;
        let row = jQuery("#generation-" + generation);
        promises.push(row.animate({"marginLeft": "+=" + offset}).promise());
    }

    Promise.all(promises).then(() => { // wait for shifting rows
        renderParentLinks();
        renderChildAndPartnerLinks();
        jQuery(linkCanvas).html(jQuery(linkCanvas).html()); // TODO better do it like: http://stackoverflow.com/a/3642265
    });
}

/**
 * Render links to ancestors recursively.
 *
 * @param {Person} person seed person, defaults to ego
 */
function renderParentLinks(person = ego) {
    if (person.father) {
        drawPath(jQuery("#box-" + person.father.id), jQuery("#box-" + person.id));
        renderParentLinks(person.father);
    }
    if (person.mother) {
        drawPath(jQuery("#box-" + person.mother.id), jQuery("#box-" + person.id));
        renderParentLinks(person.mother);
    }
}

/**
 * Draw SVG curve.
 *
 * @param {jQuery} upper parent object
 * @param {jQuery} lower child object
 * @param {string} style css class, defaults to "link-parent", may also be "link-child"
 * @see renderParentLinks
 * @see renderChildAndPartnerLinks
 */
function drawPath(upper, lower, style = "link-parent") {
    let verticalIndent = 100;

    // set start coordinates to middle bottom of upper
    let x0 = Math.round(upper.offset().left + (upper.outerWidth() / 2));
    let y0 = Math.round(upper.offset().top + upper.outerHeight());

    // set end coordinates to middle top of lower
    let x1 = Math.round(lower.offset().left + (lower.outerWidth() / 2));
    let y1 = Math.round(lower.offset().top);

    // draw curve as SVG path
    let path = "M" + x0 + "," + y0 + " C" + x0 + "," + (y0 + verticalIndent);
    path += " " + x1 + "," + (y1 - verticalIndent) + " " + x1 + "," + y1;
    jQuery("<path/>").addClass(style).attr("d", path).appendTo(linkCanvas);
}

/**
 * Render links to all children and partners.
 */
function renderChildAndPartnerLinks() {
    for (let [, persons] of generations)
        for (let person of persons) {
            let personBox = jQuery("#box-" + person.id);
            if (person.children)
                for (let child of person.children)
                    drawPath(personBox, jQuery("#box-" + child.id), "link-child");
            if (person.partners)
                for (let partner of person.partners)
                    drawPartnerPath(personBox, jQuery("#box-" + partner.id));
        }
}

/**
 * Draw SVG curve.
 *
 * @param {jQuery} person relative having a partner
 * @param {jQuery} partner partner of the relative
 * @see renderChildAndPartnerLinks
 */
function drawPartnerPath(person, partner) {
    let x0 = Math.round(person.offset().left + (person.outerWidth() / 2)) + 20;
    let x1 = Math.round(partner.offset().left + (partner.outerWidth() / 2)) - 20;
    let y = Math.round(person.offset().top);

    // draw curve as SVG path, https://www.w3.org/TR/SVG/paths.html
    let verticalOffset = 6;
    let path = "M" + x0 + "," + y + " v-" + verticalOffset;
    path += " q" + (x1 - x0) / 2 + ",-" + verticalOffset * 4 + " " + (x1 - x0) + ",0 v" + verticalOffset;
    jQuery("<path/>").addClass("link-partner").attr("d", path).appendTo(linkCanvas);
}