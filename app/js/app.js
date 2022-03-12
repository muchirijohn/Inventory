
/* SPDX-License-Identifier: MIT */
/* SnippetCopyrightText: Copyright © 2022 peanut inventory, muchirijohn */

'use strict';

const { UUID } = require('builder-util-runtime');
const { dir } = require('console');
const { create } = require('domain');
const { each, data } = require('jquery');
const { off } = require('process');
const internal = require('stream');

(function () {
    const { electron, shell, ipcRenderer } = require('electron');
    const path = require('path'),
        fs = require('fs-extra'),
        dialog = require('@electron/remote').dialog,
        //{ ipcRenderer } = require('electron'),
        swal = require('sweetalert'),
        moment = require('moment');

    //app dir
    const app_dir = __dirname,
        pref_default_path = `${app_dir}/res/data/pref_default.json`,
        pref_user_path = `${app_dir}/res/data/pref_user.json`;
    //var to hold app preferences
    var app_prefs = Object.create(null),
        //temp pats db -- global
        partsJsonDb = Object.create(null),
        //part ids
        partsJsonIDs = [],
        //parse ints
        filterInt = (value) => {
            if (/^[-+]?(\d+|Infinity)$/.test(value)) {
                return Number(value)
            } else {
                return NaN
            }
        },
        trimDesc = (desc) => {
            if (desc.length > 60) return desc.substring(0, 60) + '...';
            else return desc;
        },
        getResDir = (src) => {
            var a_dir = ((app_prefs.default === true) ? `${app_dir}\\${app_prefs.dir}` : app_prefs.dir),
                s_dir = `${a_dir}\\${src}`;
            const exists = fs.pathExistsSync(s_dir);
            if (exists === false) s_dir = `${app_dir}\\res\\${src}`;
            return s_dir;
        };

    var dialogs = (function dialogs() {


        function showTimerMsg(msg) {
            swal({
                title: msg[0],
                text: msg[1],
                icon: msg[2],
                timer: msg[3],
                showConfirmButton: false,
                allowOutsideClick: true,
                buttons: false
            })
        }

        return {
            showTimerMsg: showTimerMsg
        }
    })();

    /**
     * database
     */
    var database = (function database() {
        var sqlite3 = require('sqlite3').verbose();
        //{ open } = require('sqlite');
        var db = null,
            db_name = 'phi_inventory.db';

        /**
         * connect database
         */
        function dbConnect() {
            //check if to switch to user db
            var db_url = `${app_dir}/res/data/${db_name}`;
            var file = `${app_dir}/res/data/phi_inventory_user.db`;
            const exists = fs.pathExistsSync(file);
            if (exists) db_url = file;
            //connect db
            db = new sqlite3.Database(db_url, (err) => {
                if (err) {
                    console.error(err.message);
                    return false;
                }
                //console.log('Connected to the database successfully');
                return true;
            });
        }

        /**
         * fetch all parts from the database
         * @param {String} sql 
         */
        function dbFetchParts(sql) {
            if (db === null) dbConnect();
            db.serialize(function () {
                db.all(sql, [], (err, rows) => {
                    if (!err) {
                        listUi.generateList(rows);
                    }
                });
            });
        }

        /**
         * find/search parts
         * @param {manufacturer part number} manf 
         */
        function dbSearch(part, key) {
            var sql = "";
            if (db === null) dbConnect();
            db.serialize(function () {
                //search part number and description
                if (part) sql = `SELECT * FROM parts WHERE manf_part_no LIKE '%${key}%' OR description LIKE '%${key}%' OR specs LIKE '%${key}%'`;
                else sql = `SELECT * FROM parts WHERE type='${key}'`;
                db.all(sql, [], (err, rows) => {
                    if (!err) {
                        //console.log(rows);
                        listUi.generateList(rows);
                    }
                });
            });
        }

        /**
         * execute sql statement
         * @param {string} sql 
         */
        function dbRunSavePartQuery(sql, isNew) {
            if (db === null) dbConnect();
            db.serialize(function () {
                db.run(sql, [], (err) => {
                    if (err) {
                        swal("Error", "Failed to save Part. Please verify all the fields", "error");
                    } else {
                        swal("Success", `Successfully ${isNew ? 'added' : 'edited'} part`, "success");
                    }
                });
            });
        }


        /**
         * fetch log from db matching the given id
         * @param {string} id 
         */
        function dbFetchLogs(id) {
            if (db === null) dbConnect();
            db.serialize(function () {
                let sql = `SELECT * FROM logs WHERE part_id='${id}'`;
                db.all(sql, [], (err, rows) => {
                    if (!err) {
                        partAddEditUi.createDBLogs(rows);
                    }
                });
            });
        }

        /**
         * save part log
         * @param {sql statement} sql 
         */
        function dbRunSaveLog(log, stock = -1) {
            if (db === null) dbConnect();
            var sql = `INSERT INTO logs
                (part_id,user,date,quantity,state,desc)
                VALUES
                ('${log[0]}','${log[1]}','${log[2]}','${log[3]}','${log[4]}','${log[5]}')`;
            db.serialize(function () {
                db.run(sql, [], (err) => {
                    if (err) {
                        swal("Error", "Failed to save log.", "error");
                    } else {
                        partAddEditUi.createlog(log);
                    }
                });
                if (stock !== -1) {
                    sql = `UPDATE parts SET stock='${stock}' WHERE id='${log[0]}'`;
                    db.run(sql, [], (err) => {
                        if (err) {
                            swal("Error", "Failed to update stock.", "error");
                        }
                    });
                }
            });
        }

        /**
         * delete a log from part logs
         * @param {array} qry 
         * @param {function} callback 
         */
        function dbDeleteLog(qry, callback) {
            if (db === null) dbConnect();
            var sql = `DELETE FROM logs WHERE
            part_id='${qry[0]}' AND date='${qry[1]}'`;
            db.serialize(function () {
                db.run(sql, [], (err) => {
                    if (err) {
                        swal("Error", "Failed to delete log.", "error");
                    } else {
                        callback();
                    }
                });
            });
        }

        /**
         * delete part from db
         * @param {string} id 
         * @param {function} callback 
         */
        function dbDeletePart(id, callback) {
            if (db === null) dbConnect();
            //delete part
            var sql = `DELETE FROM parts WHERE id='${id}'`;
            db.serialize(function () {
                db.run(sql, [], (err) => {
                    if (err) {
                        swal("Error", "Failed to delete part.", "error");
                    } else {
                        //delete logs
                        var sql = `DELETE FROM logs WHERE part_id='${id}'`;
                        db.serialize(function () {
                            db.run(sql, [], (err) => {
                                if (err) {
                                    swal("Error", "Failed to delete logs.", "error");
                                } else {
                                    callback();
                                }
                            });
                        });
                    }
                });


            });
        }

        /**
         * close db
         */
        function dbClose() {
            if (db !== null) {
                db.close((err) => {
                    if (err) {
                        return console.error(err.message);
                    }
                    console.log('Database closed.');
                    db = null;
                });
            }
        }

        /**
         * create user db
         */
        async function createUserDb() {
            var file = `${app_dir}/res/data/phi_inventory_user.db`;
            const exists = await fs.pathExists(file);
            if (exists !== true) {
                await fs.copy(`${app_dir}/res/data/phi_inventory.db`, `${app_dir}/res/data/phi_inventory_user.db`);
                db_name = 'phi_inventory_user.db';
                db = null;
            }
        }

        function init() {
            createUserDb();
        }

        return {
            init: init,
            dbConnect: dbConnect,
            dbFetchParts: dbFetchParts,
            dbSearch: dbSearch,
            dbRunSavePartQuery: dbRunSavePartQuery,
            dbDeletePart: dbDeletePart,
            dbFetchLogs: dbFetchLogs,
            dbRunSaveLog: dbRunSaveLog,
            dbDeleteLog: dbDeleteLog,
            dbClose: dbClose
        }
    })();

    /**
     * components list ui
     */
    var listUi = (function listUi() {
        var list_elm = $('#list-panel');
        //windows height
        var win_height = 0,
            prevListClicked = null,
            filter = { 'All Parts': 1, 'In Stock': 2, 'Low Stock': 3, 'No Stock': 4 }

        /**
         * return win height
         */
        var getWinHeight = () => {
            return win_height;
        }

        /**
         * set list ui height
         */
        function setListHeight() {
            if (win_height != $(window).height()) {
                win_height = $(window).height();
            }
            list_elm.css('height', (win_height - 175) + 'px');
        }

        /**
         * add a new part item
         * @param {array} part_data 
         */
        function addNewPartItem(part_data) {
            //create item
            var d_ = document.createElement('div');
            d_.className = 'item';
            d_.setAttribute("id", part_data.id);
            //add content
            d_.innerHTML = `<div class="image">
            <img class="ui tiny image" src="${getResDir(`images\\${part_data.icon}`)}"></div>
            <div class="content"><a class="header">${part_data.id}<br>${part_data.manf_part_no}</a>
            <div class="description">${trimDesc(part_data.description)}</div>
            </div>`
            //add click listener
            d_.addEventListener('click', (e) => {
                e.preventDefault();
                var cn = e.target.className,
                    par = e.target,
                    id = '';
                //get ID
                if (cn === 'content') par = par.parentElement;
                else if (cn === 'description' || cn === 'header' || cn.indexOf('image') !== -1)
                    par = par.parentElement.parentNode;
                id = par.id;
                if (prevListClicked !== null && id === prevListClicked.id) return;
                if (partsJsonDb !== null) {
                    partAddEditUi.partShowData(partsJsonDb[id]);
                }
                par.setAttribute("style", "background-color: rgb(60, 60, 60)");
                if (prevListClicked !== null) {
                    prevListClicked.setAttribute("style", "background-color: transparent");
                }
                prevListClicked = par;
                mainUi.showHidePartUi(true);
                //fetch logs from db
                if (partsJsonDb[id].logs === undefined) {
                    //populate logs from db
                    database.dbFetchLogs(id);
                } else {
                    //populate logs from array object
                    partAddEditUi.createDBLogs(partsJsonDb[id].logs);
                }
            });
            //mouse over listener
            d_.addEventListener('mouseover', (e) => {
                if (prevListClicked !== null && d_.id !== prevListClicked.id) {
                    d_.setAttribute("style", "background-color: rgb(55, 55, 55");
                }
            });
            //mouse leave listener
            d_.addEventListener('mouseleave', (e) => {
                if (prevListClicked !== null && d_.id != prevListClicked.id) {
                    d_.setAttribute("style", "background-color: transparent");
                }
            });
            //append child
            list_elm.append(d_);
            //add to temp database
            partsJsonDb[part_data.id] = part_data;
            partsJsonIDs.push(part_data.id);
        }

        /**
         * generate part list item elements
         * @param {data from database} list_data 
         * @returns 
         */
        function generateList(list_data) {
            if (list_data.length == 0) {
                swal("Inventory", "Part(s) not found!", "error");
                return;
            }
            //clear list if any
            list_elm.empty();
            //clear temp db
            partsJsonDb = {};
            partsJsonIDs = [];
            list_data.forEach(part_data => {
                addNewPartItem(part_data);
            });
            partAddEditUi.initPartShow();
        }

        /**
         * edit the list item content
         * @param {Object} part_data 
         */
        function editListItem(part_data) {
            $(`#list-panel #${part_data.id}`).empty().html(`<img class="ui avatar image" src="${getResDir(`\\images\\${part_data.icon}`)}">
            <div class="content"><a class="header">${part_data.id} | ${part_data.manf_part_no}</a>
            <div class="description">${trimDesc(part_data.description)}</div>
            </div>`);
        }

        /**
         * delete part
         * @returns none
         */
        function listDeletePart() {
            if (prevListClicked === null) return;
            //get id
            var id = prevListClicked.id,
                //delete callback
                fnDelete = () => {
                    var index = partsJsonIDs.indexOf(id);
                    if (index === -1) return;
                    //remove from arrays
                    partsJsonIDs.splice(index, 1);
                    delete partsJsonDb[id];
                    //remove list element
                    $(`#list-panel #${id}`).remove();
                    //slect next remaining part
                    if (partsJsonIDs.length > index) {
                        $(`#list-panel #${partsJsonIDs[index]}`).trigger('click');
                    } else {
                        $(`#list-panel #${partsJsonIDs[index - 1]}`).trigger('click');
                    }
                    //if last part
                    if (partsJsonIDs.length === 0) {
                        mainUi.showHidePartUi();
                        $('#part-log-table tbody').empty();
                        prevListClicked = null;
                    }
                    //complete dialog
                    dialogs.showTimerMsg(['', 'Part deleted succesfully!', 'success', 1500]);
                };
            //delete part
            database.dbDeletePart(id, fnDelete);

        }

        /**
         * filter parts list
         * @param {Integer} val 
         */
        function listFilterParts(val) {
            var sql = '';
            switch (val) {
                case filter['All Parts']:
                    sql = 'SELECT * FROM parts';
                    break;
                case filter['In Stock']:
                    sql = 'SELECT * FROM parts WHERE stock > stock_limit';
                    break;
                case filter['Low Stock']:
                    sql = 'SELECT * FROM parts WHERE stock > 0 AND stock <= stock_limit';
                    break;
                case filter['No Stock']:
                    sql = 'SELECT * FROM parts WHERE stock = 0';
                    break;
            }
            //fetch parts, filter.
            database.dbFetchParts(sql);
        }

        /**
         * init list ui
         */
        function init() {
            //adjust height
            win_height = $(window).height();
            //set list height
            setListHeight();
            //generate list
            listFilterParts(filter['All Parts']);
            //filter dropdown
            $('#btn-part-filter').dropdown({
                //values: options,
                onChange: function (value, text, $selectedItem) {
                    //filter parts
                    var ft = $selectedItem[0].innerText.trim();
                    listFilterParts(filter[ft]);
                }
            });
            //$('#btn-part-filter').dropdown('set exactly', 'All Parts');
            //search components button event
            $('#btn-part-sc').on('click', (e) => {
                e.preventDefault();
                prevListClicked = null;
                swal("Please Enter Search Query", {
                    content: "input",
                }).then((val) => {
                    if (val) {
                        //search parts - manf and description
                        database.dbSearch(true, val);
                    }
                });

            });

            //add part
            $('#btn-part-add').on('click', (e) => {
                e.preventDefault();
                partAddEditUi.showModal(true);
            });

            $('#btn-part-clear').on('click', (e) => {
                e.preventDefault();
                swal({
                    title: "Clear contents",
                    text: "Are you sure you want to clear contents?",
                    icon: "warning",
                    buttons: true,
                    dangerMode: true,
                }).then((willDelete) => {
                    if (willDelete) {
                        partAddEditUi.partClearFields();
                        swal("Contents cleared!", {
                            icon: "success",
                        });
                    }
                });
            });

        }

        return {
            init: init,
            getWinHeight: getWinHeight,
            setListHeight: setListHeight,
            addNewPartItem: addNewPartItem,
            generateList: generateList,
            editListItem: editListItem,
            listDeletePart: listDeletePart
        }
    })();


    /**
     * categories
     */
    var categoriesUi = (function categoriesUi() {
        //selection element
        var cat_el = $('#sel-device'),
            init_cat = false;

        /**
         * get categpry selection value
         */
        var catValue = () => {
            return cat_el.val();
        }

        /**
         * get categories
         * @returns categories json object ID - Value
         */
        var categories = () => {
            return app_prefs.categories;
        }

        /**
         * create categories
         * @returns none
         */
        var createCategoriesOptions = (init = false) => {
            var parent = $('#sel-device'),
                catgs = app_prefs.categories;
            if (catgs === undefined || catgs.length === 0) return;
            var options = [];
            var all = true;
            //get categories and format to selection values
            catgs.forEach(cts => {
                var item = { name: cts, value: cts, selected: all };
                options.push(item);
                all = false;
            });

            if (init === true) {
                parent.dropdown('change values', options);
            } else {
                //create category selection list
                parent.dropdown({
                    values: options,
                    onChange: function (value, text, $selectedItem) {
                        //console.log(value)
                        if (value !== undefined && init_cat === true) {
                            if (init_cat) database.dbSearch(false, value);
                        }
                        if (value.length > 0) init_cat = true;
                    }
                });
            }
        }

        /**
         * init categories selection
         * read its selected value when changed
         */
        function init() {
            //read and create categories
            //createCategoriesOptions();
        }

        return {
            init: init,
            categories: categories,
            createCategoriesOptions: createCategoriesOptions
        };
    })();

    /**
     * part add/edit
     */
    var partAddEditUi = (function partAddEditUi() {
        var packages = [],
            partImages = [],
            partImagesIndex = 0,
            cat_pkg = [false, false],
            isPartNew = true;
        //modal elemnt
        var ptModal = $('#modal-part-add');
        //parts add modal elements
        var pEl = {
            id: $('#part-add-id'),
            stock: $('#part-add-stock'),
            type: $('#part-add-cat'),
            manf: $('#part-add-manf'),
            manf_part_no: $('#part-add-num'),
            package: $('#part-add-pkg'),
            pins_no: $('#part-add-pins'),
            datasheet: $('#part-add-dsheet'),
            description: $('#part-add-desc'),
            icon: $('#part-add-icon'),
            cad: $('#part-add-cad'),
            specs: $('#part-add-spec'),
            images: $('#part-add-images'),
            seller: $('#part-add-dist'),
            link: $('#part-add-link'),
            cost: $('#part-add-cost'),
            stock_limit: $('#part-add-slimit'),
            notes: $('#part-add-notes')
        };
        //preiovus shown id
        var selectedID = '';
        /**
         * clear modal part fields
         */
        function partClearFields() {
            var keys = Object.keys(pEl);
            keys.forEach(key => {
                if (key === 'id' && !isPartNew) return;
                pEl[key].val('');
            });
            pEl.type.dropdown('clear');
            pEl.package.dropdown('clear');
        }
        /**
         * get part modal fields values
         * @returns array
         */
        function getPartModalFieldsData() {
            var fields = Object.create(null),
                keys = Object.keys(pEl);
            keys.forEach(key => {
                if (key === 'id' || key === 'manf_part_no') fields[key] = (pEl[key].val().toUpperCase());
                else fields[key] = (pEl[key].val());
            });
            return fields;
        }
        /**
         * save part data
         */
        function partSaveData() {
            var data = getPartModalFieldsData(),
                sql = '';
            //updateFields = ()=>{}
            if (data.id.length == 0) {
                swal('Error', 'Part ID cannot be null!', 'error');
                return;
            }
            if (isPartNew === true) {
                sql = `INSERT INTO parts 
                    (id, stock, type, manf, manf_part_no, package, pins_no, datasheet, description, icon, 
                    cad, specs, images, seller, link, cost, stock_limit, notes) VALUES (
                        "${data.id}", "${data.stock}", "${data.type}", "${data.manf}", "${data.manf_part_no}", "${data.package}", "${data.pins_no}",
                        "${data.datasheet}", "${data.description}", "${data.icon}", "${data.cad}", "${data.specs}", "${data.images}",
                        "${data.seller}", "${data.link}", "${data.cost}", "${data.stock_limit}", "${data.notes}")`;
            } else {
                sql = `UPDATE parts SET 
                        stock="${data.stock}", type="${data.type}", manf="${data.manf}", 
                        manf_part_no="${data.manf_part_no}", package="${data.package}", pins_no="${data.pins_no}",
                        datasheet="${data.datasheet}", description="${data.description}", icon="${data.icon}", 
                        cad="${data.cad}", specs="${data.specs}", images="${data.images}",
                        seller="${data.seller}", link="${data.link}", cost="${data.cost}", 
                        stock_limit="${data.stock_limit}", notes="${data.notes}"
                    WHERE
                        id="${data.id}"`;
                partsJsonDb[data.id] = data;
                partShowData(data);
                listUi.editListItem(data);
            }
            //show edits
            /*partsJsonDb[data.id] = data;
            partsJsonIDs.push(data.id);*/
            if (isPartNew === true) {
                listUi.addNewPartItem(data);
                if (partsJsonIDs.length === 1) initPartShow();
            }
            database.dbRunSavePartQuery(sql, isPartNew);
        }

        /**
         * part categories
         * @param {Boolean} init_ 
         * @returns 
         */
        function partCategoriesInit() {
            //if (cat_pkg[0] === true) return;
            var catg = app_prefs.categories;
            if (catg.length === 0) return;
            var parent = $('#part-add-cat');
            parent.empty();
            catg.forEach(cts => {
                parent.append($("<option></option>")
                    .attr("value", cts)
                    .text(cts));
            });
            //cat_pkg[0] = true;
        }

        /**
         * get packages
         * @param {Boolean} init_ 
         * @returns 
         */
        function partPackagesInit() {
            //if (cat_pkg[1] === true) return;
            packages = app_prefs.packages;
            if (packages.length === 0) return;
            var parent = $('#part-add-pkg');
            parent.empty();
            packages.forEach(pkg => {
                parent.append($("<option></option>")
                    .attr("value", pkg)
                    .text(pkg));
            });
            //cat_pkg[1] = true
        }

        //show modal
        var showModal = (init = false) => {
            isPartNew = init;
            if (init === true) {
                partClearFields();
            }
            ptModal.modal('show');
        }

        /**
         * get tehe file names from dialog filepaths
         * @param {array} filepaths 
         * @returns filenames
         */
        var getFilesNames = (filepaths) => {
            var files = [];
            filepaths.forEach(filepath => {
                files.push(filepath.substring(filepath.lastIndexOf('\\') + 1, filepath.length));
            });
            return files;
        }

        /**
         * get filename - helper function
         * @param {element} el 
         */
        function getFilename(el, fts, msel = false) {
            var props = ['openFile'];
            if (msel) props.push('multiSelections');
            var filepaths = dialog.showOpenDialogSync({
                title: 'Select file',
                filters: fts,
                properties: props
            });
            if (filepaths !== undefined) {
                var filenames = getFilesNames(filepaths);
                if (msel) el.val(filenames);
                else el.val(filenames[0]);
            }
        }

        var unique_ids = [];
        //get unique id for new image
        function getUniqueName() {
            var min = 15,
                max = 2045000,
                num = 0,
                id = '';
            min = Math.ceil(min);
            max = Math.floor(max);
            while (true) {
                num = Math.floor(Math.random() * (max - min + 1)) + min;
                id = 'PL' + num.toString(16);
                if (unique_ids.indexOf(id) === -1) {
                    unique_ids.push(id);
                    break;
                }
            }
            return id.toUpperCase();
        }

        /**
         * return html for part info table 1
         * @param {json} data 
         * @returns 
         */
        var partShowTable1Html = (data) => {
            try {
                return `<tbody>
            <tr> <td class="two wide column">Type</td><td>${data.type}</td></tr>
            <tr><td>Manufacturer</td><td>${data.manf}</td></tr>
            <tr><td>Package</td><td>${data.package}</td></tr>
            <tr><td>Pinouts</td><td>${data.pins_no}</td></tr>
            </tbody>`;
            } catch (err) { }
        }

        /**
         * return html for part table specifications
         * @param {json} data 
         * @returns html string
         */
        var partShowTable2Html = (data) => {
            try {
                //check if specs available
                if (data.specs === undefined || data.specs.trim().length === 0) {
                    return '';
                }
                //create specs table
                var html = '<tbody><tr> <td class="seven wide column">';
                var specs = data.specs.split('\n'),
                    index = 0;
                specs.forEach(spec => {
                    var field = spec.split(',');
                    html += `${index++ > 0 ? '<tr><td>' : ''}
                        ${field[0].trim()}</td><td>${field[1].trim()}</td></tr>`;
                });
                html += '</tbody>';
                return html;
            } catch (err) {
                return '';
            }
        }

        /**
         * show notes
         * @param {String} notes 
         */
        function partsShowNotes(notes) {
            try {
                var parent = $('#part-show-notes');
                parent.empty();
                if (notes === undefined || notes.trim().length === 0) return;
                notes = notes.split('\n');
                notes.forEach(note => {
                    parent.append($(`<div></div>`)
                        .addClass('item')
                        .html(`<i class="caret right icon"></i> ${note}`));
                });
            } catch (err) { }
        }

        /**
         * show part info - view port
         */
        var partsShowJson = Object.null,
            //append image to view element
            appendPartImage = (src) => {
                var imgEl = $('#part-show-images img');
                var url = getResDir(`\\images\\${src}`);
                imgEl.attr('src', `${url}`);
            },
            //navigate images
            partShowImageNav = (nav) => {
                var len = partImages.length - 1,
                    index = partImagesIndex;

                if (nav === 'next') {
                    //index++;
                    (index >= len) ? index = 0 : index += 1;
                } else if (nav === 'prev') {
                    //index--;
                    (index <= 0) ? index = len : index -= 1;
                }
                partImagesIndex = index;
                appendPartImage(partImages[index]);
            },
            /*show images*/
            partShowImages = (images_info) => {
                if (images_info.length === 0) {
                    $('#part-show-images-info').hide();
                    return;
                }
                partImages = images_info.split(',');
                partImagesIndex = 0;
                $('#part-show-images-info').show();
                var img = partImages[partImagesIndex].trim();
                if (img.length > 0) {
                    appendPartImage(img);
                }
            },
            /*show part info*/
            partShowData = (pData, tb_update = true) => {
                partsShowJson = Object.assign({}, pData);
                var stock = [['In Stock', '5aff0e'], [`Low Stock - Limit is ${partsShowJson.stock_limit}`, 'ffcb22'], ['Out of Stock', 'ff0e0e']],
                    slv = 0;
                //show data only once
                //if (prevID === partsShowJson.id) return;
                selectedID = partsShowJson.id;
                //elements
                var pElShow = {
                    id: $('#part-show-id'),
                    icon: $('#part-show-icon'),
                    desc: $('#part-show-desc'),
                    stock: $('#part-show-stock'),
                    inStock: $('#part-show-in-stock'),
                    seller: $('#part-show-seller'),
                    table1: $('#part-show-table-1'),
                    table2: $('#part-show-table-2')
                };
                //id+manf+mNum
                pElShow.id.html(`<span data-tooltip="Part ID" data-position="right center">${partsShowJson.id} </span><br><span data-tooltip="Part Number" data-position="right center"> ${partsShowJson.manf_part_no}</span>`);
                //seller
                pElShow.seller.html(`<i class="cart icon"></i> ${partsShowJson.seller}`);
                //icon
                pElShow.icon.html(`<img src="${getResDir(`\\images\\${partsShowJson.icon}`)}" class="img-fluid" alt="${partsShowJson.id}">`);
                //description
                pElShow.desc.html(`<span class="column sixteen wide">${partsShowJson.description}</span>`);
                //stock
                if (partsShowJson.stock == 0) slv = 2;
                else if (filterInt(partsShowJson.stock) < filterInt(partsShowJson.stock_limit)) slv = 1;
                pElShow.inStock.html(`<span style="color:#${stock[slv][1]};animation:${(slv === 3) ? 'text-flicker 0.5s infinite alternate' : 'none'}">${stock[slv][0]}</span>`);
                pElShow.stock.html(`Stock : <i class="cart arrow down icon" style="color: #47ff56"></i>${partsShowJson.stock}&nbsp;&nbsp;
                                        <i class="dollar icon" style="color: #ff2335"></i>${partsShowJson.cost}`);
                if (tb_update === true) {
                    //table 1 info
                    pElShow.table1.html(partShowTable1Html(partsShowJson));
                    //table 2 specs
                    pElShow.table2.html(partShowTable2Html(partsShowJson));
                    //show images
                    partShowImages(partsShowJson.images);
                    //notes
                    partsShowNotes(partsShowJson.notes)
                }
            },
            //edit part data - show edit modal
            partEditData = () => { //edit part
                if (partsShowJson === undefined) {
                    swal('', 'Please select part!', 'error');
                    return false;
                }
                var keys = Object.keys(pEl),
                    pkeys = Object.keys(partsShowJson),
                    cat = categoriesUi.categories();
                for (var i = 0; i < keys.length; i++) {
                    if (keys[i] === 'type' || keys[i] === 'package') {
                        var val = partsShowJson[pkeys[i]];
                        pEl[keys[i]].dropdown('set exactly', [val]);
                    } else {
                        pEl[keys[i]].val(partsShowJson[pkeys[i]]);
                    }
                    //show edit modal
                    showModal();
                };

            }

        /**
         * show/create log data
         */
        function createDBLogs(logs) {
            // if (logs.length > 0) 
            $('#part-log-table tbody').empty();
            //save to parts array object
            if (partsJsonDb[selectedID].logs === undefined) {
                partsJsonDb[selectedID].logs = logs;
            }
            //create log
            logs.forEach(log => {
                var data = [
                    log.part_id,
                    log.user,
                    log.date,
                    (log.state === 1 ? '+' : '') + log.quantity,
                    log.state,
                    log.desc
                ];
                createlog(data, false);
            });
        }
        var prevLogEl = null;

        /**
         * create log
         * @param {array} log 
         */
        function createlog(log, new_log = true) {
            var ttr = document.createElement('tr');
            ttr.id = 'log-' + log[2];
            ttr.innerHTML = `<td>${log[1]}</td>
                            <td>${log[2]}</td>
                            <td>${log[3]}</td>
                            <td>${log[5]}</td>`;
            //event listeners
            ttr.addEventListener('click', (e) => {
                var pel = e.target.parentNode;
                pel.setAttribute('style', 'color: #bafbf8');
                if (prevLogEl !== null && prevLogEl.id === pel.id) prevLogEl = null;
                if (prevLogEl != null) prevLogEl.setAttribute('style', 'color: #81a3a7');
                prevLogEl = pel;
                $('#part-log-table tr:nth-child(1)').css( "color", "#81a3a7" );//reset first row to initial color
            });
            ttr.addEventListener('mouseover', (e) => {
                if (prevLogEl !== null && ttr.id != prevLogEl.id)
                    ttr.setAttribute("style", "color: #a7d0d4");
            });
            ttr.addEventListener('mouseleave', (e) => {
                if (prevLogEl !== null && ttr.id != prevLogEl.id)
                    ttr.setAttribute("style", "color: #81a3a7");
            });
            $('#part-log-table tbody').append(ttr);
            //edit part stock
            if (new_log === true) {
                //ttr.scrollIntoView();
                dialogs.showTimerMsg(['Log', 'log added succesfully', 'success', 1500]);
            }
            //highlight firstrow
            $('#part-log-table tr:nth-child(1)').css( "color", "#bafbf8" );
        };

        /**
         * create a new log
         * @returns none
         */
        function partNewLog() {
            var uid = 'Admin',//chance.string({ length: 4, casing: 'upper', alpha: true, numeric: true }),
                qty = chance.natural({ min: 1, max: 5000 }),
                dt_ = moment().format(),
                date = dt_.substring(0, dt_.lastIndexOf('+'));

            if (partsShowJson === undefined) {
                swal('', 'Please select part!', 'error');
                return false;
            }
            var partStock = partsShowJson.stock;
            var qty = $('#part-log-qty').val(),
                trs = $('#part-log-tr-cbk.ui.checkbox').checkbox('is checked'),
                desc = $('#part-log-desc').val();
            //check if quantity not empty
            if (isNaN(qty) || qty.length === 0) {
                swal('', 'Quantity should be a numeric value!', 'error');
                return false;
            }
            //console.log(partStock.length)
            //check if quantity available
            if ((partStock.length === 0 || parseInt(qty) > parseInt(partStock)) && !trs) {
                swal('', `Quantity(${qty}) greater than available stock(${partStock})!`, 'error');
                return false;
            }
            //check if desc empty
            if (desc.length === 0) {
                swal('', 'Description cannot be empty!', 'error');
                return false;
            }
            qty = (trs ? '+' : '-') + qty;
            var id_ = partsShowJson.id,
                log = [id_, uid, date, qty, (trs ? 1 : 0), desc],
                lstk = filterInt(qty);
            if (lstk !== NaN) {
                var stock = partsJsonDb[id_].stock;
                stock = filterInt(stock) + filterInt(lstk);
                partsJsonDb[id_].stock = stock;
                partShowData(partsJsonDb[id_], false);
            }
            //createlog(log, true);
            var logObj = { part_id: log[0], user: log[1], date: log[2], quantity: filterInt(log[3]), state: log[4], desc: log[5] };
            //save logs to array object
            if (partsJsonDb[selectedID].logs !== undefined) { partsJsonDb[selectedID].logs.push(logObj); }
            //save to logs to db
            database.dbRunSaveLog(log, stock);
        }

        /**
         * delete a log
         * @returns none
         */
        var deleteLogNotify = () => {
            if (prevLogEl === null) {
                swal('Error', 'Select log to delete', 'error');
                return;
            }
            //show confirmation
            swal({
                title: "Delete Log",
                text: "Are you sure you want to delete log?",
                icon: "warning",
                buttons: true,
                dangerMode: true,
            }).then((willDelete) => {
                if (willDelete) {
                    deleteLog();
                }
            });
        },
            deleteLog = () => {
                var id = prevLogEl.id,
                    qr = [
                        partsShowJson.id, //part id
                        id.substring(id.indexOf('-') + 1, id.length) //date
                    ],
                    callback = () => {
                        //find log to delete
                        const index = partsJsonDb[selectedID].logs.findIndex((log) => ('log-' + log.date) === prevLogEl.id);
                        partsJsonDb[selectedID].logs.splice(index, 1);
                        //remove element
                        prevLogEl.remove();
                        dialogs.showTimerMsg(['', 'Log deleted succesfully!', 'success', 1500]);
                    }
                database.dbDeleteLog(qr, callback);
            }

        /**
         * open datasheet or cad file
         * @param {string} file filename to open
         * @param {boolean} cad open cad file or datasheet
         */
        async function checkIfFileExists(file, cad = false) {
            const exists = await fs.pathExists(file);
            if (exists === true) {
                (cad === false) ? shell.openPath(file) : shell.openExternal(file);
            } else {
                swal('', 'file not found', 'error');
            }
        }

        /**
         * enable or disable part add ID field - on new or edit
         */
        function showHidePartId() {
            var btn_auto = $('#part-add-id-auto');
            if (isPartNew == true) {
                pEl.id.removeAttr("disabled");
                btn_auto.removeClass("disabled");
            } else {
                pEl.id.attr("disabled", "");
                btn_auto.addClass("disabled");
            }
        }

        /**
         * init parts show fields
         * @returns none
         */
        function initPartShow() {
            if (partsJsonDb === null) return;
            //partsJsonIDs = Object.keys(partsJsonDb);
            if (partsJsonIDs.length > 0) {
                //partShowData(partsJsonDb[partsIds[0]]);
                $(`#list-panel #${partsJsonIDs[0]}`).trigger('click');
            }
        }

        /**
         * delete part
         */
        function deletePart() {
            swal({
                title: "Delete part",
                text: "Are you sure you want to delete part?",
                icon: "warning",
                buttons: true,
                dangerMode: true,
            }).then((willDelete) => {
                if (willDelete) {
                    listUi.listDeletePart();
                }
            });
        }

        /**
         * init categories and packages
         */
        function initAllSelections(_default = false) {
            categoriesUi.createCategoriesOptions(_default);
            partCategoriesInit();
            partPackagesInit();
        }
        /**
         * init
         */
        function init() {
            //add new part modal
            $('#modal-part-add.ui.modal').modal({
                //blurring: true,
                closable: false,
                onShow: () => {
                    showHidePartId();
                },
                onDeny: function () {
                    return true;
                },
                onApprove: function () {
                    partSaveData();
                    return false;
                }
            });
            //new log modal
            $('#modal-log-add.ui.modal').modal({
                //blurring: true,
                closable: false,
                onShow: () => {
                    $('#part-log-qty').val('');
                    $('#part-log-desc').val('');
                },
                onDeny: function () {
                    return true;
                },
                onApprove: function () {
                    partNewLog();
                    return false;
                }
            });
            //init categories
            initAllSelections();
            //init part selection modal fields
            $('#part-add-cat.dropdown').dropdown();
            $('#part-add-pkg.dropdown').dropdown();
            //init modal tabs
            $('#modal-part-add .ui.tabular.menu .item').tab();
            $('#div-part-img-spec .ui.tabular.menu .item').tab();
            $('.ui.checkbox').checkbox();

            //delete part
            $('#part-show-btn-del').on('click', (e) => {
                e.preventDefault();
                deletePart();
                //swal('Delete', 'Not yet!! A cup of coffee and it\'ll be implemented :-)', 'info');
            });
            //edit part
            $('#part-show-btn-edit').on('click', (e) => {
                e.preventDefault();
                partEditData();
            });

            //get datasheet from local file
            pEl.datasheet.on('dblclick', (e) => {
                e.preventDefault();
                getFilename(pEl.datasheet, [{ name: 'PDF', extensions: ['pdf'] }]);
            });
            //get image/icon from local file
            pEl.icon.on('dblclick', (e) => {
                e.preventDefault();
                getFilename(pEl.icon, [{ name: 'Images', extensions: ['png', 'jpg', 'bmp'] }]);
            });
            //get image/icon from local file
            pEl.cad.on('dblclick', (e) => {
                e.preventDefault();
                getFilename(pEl.cad, [{ name: 'CAD', extensions: ['obj', 'sldprt', 'ipt', 'stp'] }]);
            });
            //get images from local file
            pEl.images.on('dblclick', (e) => {
                e.preventDefault();
                getFilename(pEl.images, [{ name: 'Images', extensions: ['png', 'jpg', 'bmp'] }], true);
            });
            //auto generate file name
            $('#part-add-id-auto').on('click', (e) => {
                e.preventDefault();
                pEl.id.val(getUniqueName());
            });
            //show pdf file
            $('#part-show-dsheet').on('click', (e) => {
                try {
                    e.preventDefault();
                    if (partsShowJson.datasheet.indexOf('.') === -1) {
                        swal('Datasheet', 'Datasheet File not set', 'error');
                        return;
                    }
                    var url = getResDir(`\\datasheets\\${partsShowJson.datasheet}`);
                    checkIfFileExists(url);
                } catch (e) { }
            });
            //show part link
            $('#part-show-seller').on('click', (e) => {
                try {
                    e.preventDefault();
                    if (partsShowJson !== undefined && partsShowJson.link.length > 0) {
                        shell.openExternal(partsShowJson.link);
                    }
                } catch (e) { }
            });

            //show part link
            $('#part-show-cad').on('click', (e) => {
                try {
                    e.preventDefault();
                    if (partsShowJson.cad.indexOf('.') === -1) {
                        swal('CAD', 'Cad File not set', 'error');
                        return;
                    }
                    var url = getResDir(`\\cad\\${partsShowJson.cad}`);
                    checkIfFileExists(url, true);
                } catch (e) { }
            });
            //delete a log
            $('#part-log-btn-del').on('click', (e) => {
                e.preventDefault();
                deleteLogNotify();
            });
            //show add log modal
            $('#part-log-btn-add').on('click', (e) => {
                e.preventDefault();
                $('#modal-log-add').modal('show');
            });
            //image van prev
            $('#part-show-images-prev').on('click', (e) => {
                e.preventDefault();
                partShowImageNav('prev');
            });
            //image van next
            $('#part-show-images-next').on('click', (e) => {
                e.preventDefault();
                partShowImageNav('next');
            });
        }

        return {
            init: init,
            showModal: showModal,
            partClearFields: partClearFields,
            partSaveData: partSaveData,
            partShowData: partShowData,
            createlog: createlog,
            createDBLogs: createDBLogs,
            initPartShow: initPartShow,
            initAllSelections: initAllSelections
        }
    })();

    /**
     * initializr main ui
     */
    var mainUi = (function mainUi() {

        /**
         * validatre and create app folders
         * @returns boolean 
         * return true is validation and folder crreation succesful
         */
        function validatePref() {
            var dir = $('#app-config-dir').val(), //app directory
                cats = $('#app-config-cat').val(), //categories
                pkgs = $('#app-config-pkg').val(); //packages
            var prefs = Object.create(null),
                categories = [],
                packages = [];
            //check if directory valid
            const exists = fs.pathExistsSync(dir);
            if (exists === false) {
                swal('Preferences', 'Please set app directory', 'error');
                return false
            }
            //dir
            prefs["dir"] = dir;
            //get categories
            if (cats.length > 0) {
                var catgs = cats.trim().split(',');
                catgs.forEach(catg => {
                    categories.push(catg.trim());
                });
            }
            prefs["categories"] = categories;
            //get packages
            if (pkgs.length > 0) {
                var packs = pkgs.trim().split(',');
                packs.forEach(pck => {
                    packages.push(pck.trim());
                });
            }
            prefs["packages"] = packages;
            prefs['default'] = false;
            //create datasheet folder
            fs.ensureDirSync(dir + '/datasheets/');
            //create images folder
            fs.ensureDirSync(dir + '/images/');
            //create cad folder
            fs.ensureDirSync(dir + '/cad/');
            //write to preferencess folder
            var pref_path = pref_user_path;
            //fs.outputFileSync(pref_path, JSON.stringify(prefs));
            fs.outputFile(pref_path, JSON.stringify(prefs))
                .then(() => fs.readJson(pref_path))
                .then(pref => {
                    app_prefs = pref;
                    partAddEditUi.initAllSelections(true);
                    swal('Preferences', 'Saved successfully!', 'success');
                })
                .catch(err => {
                    swal('Preferences', 'An error occured!', 'error');
                });
            //close dialog
            return true;
        }
        /**
         * create app directory
         */
        function getAppDir() {
            var dg = dialog.showOpenDialogSync({
                title: 'Select App Directory',
                properties: ['openDirectory']
            });
            if (dg === undefined) {
                swal('', 'Please select a directory', 'error');
            } else {
                $('#app-config-dir').val(dg[0]);
            }
        }

        /**
         * init preferences modal fields
         */
        function initPrefsFields() {
            $('#app-config-dir').val(app_prefs.dir); //app directory
            $('#app-config-cat').val(app_prefs.categories); //categories
            $('#app-config-pkg').val(app_prefs.packages); //packages
        }

        /**
         * show or hide part desc and log ui
         * @param {boolean} show 
         */
        function showHidePartUi(show = false) {
            if (show) {
                $('.column.dev-desc .column').show();
                $('.column.dev-logs .column').show();
            } else {
                $('.column.dev-desc .column').hide();
                $('.column.dev-logs .column').hide();
            }
        }

        /**
         * init ui heights
         */
        function initHeights() {
            //log table height
            $('.dev-desc .part-extra-info').css('height', ($(window).height() - 138) + 'px');
            $('.log-table tbody').css('height', ($(window).height() - 175) + 'px');
        }
        /**
         * init ui
         */
        function init() {
            showHidePartUi(false);
            //modal preferences
            $('#modal-app-pref.ui.modal').modal({
                blurring: false,
                closable: false,
                onShow: () => {
                    initPrefsFields();
                },
                onDeny: function () {
                    return true;
                },
                onApprove: function () {
                    var vd_ = validatePref();
                    return vd_;
                }
            });

            //edit part
            $('#part-show-btn-pref').on('click', (e) => {
                e.preventDefault();
                $('#modal-app-pref').modal('show');
            });
            //app directory
            $('#app-config-dir').on('dblclick', (e) => {
                e.preventDefault();
                getAppDir();
            });
            $('#div-main-load .with-love').on('click', (e) => {
                e.preventDefault();
                shell.openExternal('https://github.com/muchirijohn');
            });
            //on window resize
            $(window).on('resize', function () {
                if ($(window).height() < 650) $(window).height('50px');
                //list height
                listUi.setListHeight();
                initHeights();
            });

            //on window closing try to close db
            $(window).on('unload', function () {
                database.dbClose();
            });
            database.init();
            //init main categories
            categoriesUi.init();
            //init categories ui
            listUi.init();
            //init modals
            partAddEditUi.init();
            //init heights
            initHeights();
            //enables a shadow on scroll parts specs
            var scr = false;
            $('.dev-desc .part-extra-info').on('scroll', (e) => {
                var scroll = e.target.scrollTop;
                if (scroll === 0 && scr) {
                    $('#part-stock-files').css('box-shadow', 'none');
                    scr = false;
                }
                else if (scroll > 26 && !scr) {
                    $('#part-stock-files').css('box-shadow', '0px 6px 10px -6px rgba(133, 229, 253, 0.45)');
                    scr = true;
                }
            });
            //load main ui on success
            setTimeout(() => {
                $('#div-main-load').empty().hide();
                $('#div-main-ui').show();
                $('#div-main-ui').animate({
                    opacity: 1
                }, 2000);
            }, 1500);
        }

        return {
            init: init,
            showHidePartUi: showHidePartUi
        }
    })();

    /**
     * read user preferences
     */
    async function readPreferences() {
        const u_path = await fs.pathExists(pref_user_path);
        var pref_path = u_path ? pref_user_path : pref_default_path;
        const d_path = await fs.pathExists(pref_path);
        if (d_path === true) {
            try {
                app_prefs = await fs.readJson(pref_path);
                mainUi.init();
                //$('#div-main-load span').text('Finalizing...');  
            } catch (err) {
                $('#div-main-load span').text('Error...');
                swal('Error', 'Ops! Something under the hood fried!', 'error');
            }
        } else {
            $('#div-main-load span').text('Error...');
            swal('Error', 'Application preferences file is missing!', 'error');
        }
    }

    /**
     * on window load
     */
    $(function () {
        readPreferences();
    });
})({});