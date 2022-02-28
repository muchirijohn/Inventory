'use strict';

const { UUID } = require('builder-util-runtime');
const { dir } = require('console');
const { each, data } = require('jquery');
const { off } = require('process');

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
    var app_prefs = Object.create(null);

    /**
     * database
     */
    var database = (function database() {
        var sqlite3 = require('sqlite3').verbose();
        //{ open } = require('sqlite');
        var db = null,
            db_url = `${app_dir}/res/data/phi_inventory.db`;

        /**
         * connect database
         */
        function dbConnect() {
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
         */
        function dbFetchAllParts() {
            //console.log('opening db..');
            if (db === null) dbConnect();
            db.serialize(function () {
                let sql = `select * from parts`;
                db.all(sql, [], (err, rows) => {
                    if (!err) {
                        //console.log(rows);
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
                if (part) sql = `SELECT * FROM parts WHERE manf_part_no LIKE '%${key}%' OR description  LIKE '%${key}%'`;
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
         * @param {sql statement} sql 
         */
        function dbRunSavePartQuery(sql, error) {
            db.serialize(function () {
                db.run(sql, [], (err) => {
                    if (err) {
                        swal("Error", "Failed to save new Part. Please verify all the fields", "error");
                    } else {
                        swal("Success", "Successfully added new part", "success");
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

        function init() { }

        return {
            init: init,
            dbConnect: dbConnect,
            dbFetchAllParts: dbFetchAllParts,
            dbSearch: dbSearch,
            dbRunSavePartQuery: dbRunSavePartQuery,
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
            //temp pats db -- global
            partsJsonDb = Object.create(null),
            prevListClicked = null;

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
            list_elm.css('height', (win_height - 160) + 'px');
        }

        /**
         * generate part list item elements
         * @param {data from database} list_data 
         * @returns 
         */
        function generateList(list_data) {
            if (list_data.length == 0) {
                swal("Search", "Part(s) not found!", "error");
                return;
            }
            //clear list if any
            list_elm.empty();
            //clear temp db
            partsJsonDb = {};
            list_data.forEach(part_data => {
                //create item
                var d_ = document.createElement('div');
                d_.className = 'item';
                d_.setAttribute("id", part_data.id);
                //add content
                d_.innerHTML = `<img class="ui avatar image" src="${part_data.icon}">
                <div class="content"><a class="header">${part_data.id} | ${part_data.manf_part_no}</a>
                <div class="description">${part_data.description}</div>
                </div>`
                //add click listener
                d_.addEventListener('click', (e) => {
                    e.preventDefault();
                    var cn = e.target.className,
                        par = par = e.target,
                        id = '';
                    //get ID
                    if (cn === 'description' || cn === 'header') par = par.parentElement.parentNode;
                    else if (cn.indexOf('image') !== -1) par = par.parentElement;
                    id = par.id;
                    if (partsJsonDb !== null) {
                        partAddEditUi.partShowData(partsJsonDb[id]);
                    }
                    par.setAttribute("style", "background-color: rgb(60, 60, 60)");
                    if (prevListClicked !== null) {
                        prevListClicked.setAttribute("style", "background-color: transparent");
                    }
                    prevListClicked = par;
                    mainUi.showUi(true);

                });

                d_.addEventListener('mouseover', (e) => {
                    if (prevListClicked !== null && d_.id != prevListClicked.id) {
                        d_.setAttribute("style", "background-color: rgb(55, 55, 55");
                    }
                });
                d_.addEventListener('mouseleave', (e) => {
                    if (prevListClicked !== null && d_.id != prevListClicked.id) {
                        d_.setAttribute("style", "background-color: transparent");
                    }
                });
                //append child
                list_elm.append(d_);
                //add to temp database
                partsJsonDb[part_data.id] = part_data;
                //console.log(part_data.id);
            });
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
            database.dbFetchAllParts();
        }

        return {
            init: init,
            getWinHeight: getWinHeight,
            setListHeight: setListHeight,
            generateList: generateList
        }
    })();


    /**
     * categories
     */
    var categoriesUi = (function categoriesUi() {
        //selection element
        var cat_el = $('#sel-device');

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
         * @param {*} options 
         * @returns none
         */
        var createCategoriesOptions = (catgs) => {
            var parent = $('#sel-device');
            parent.empty();
            catgs.forEach(cts => {
                var opt = document.createElement('option');
                opt.setAttribute('value', cts);
                opt.innerText = cts;
                parent.append(opt);
            });
            partAddEditUi.partCategoriesInit();
        }

        /**
         * read categories
         */
        var readCategories = () => {
            var cats = app_prefs.categories;
            if (cats === undefined) return;
            createCategoriesOptions(cats);
        }

        /**
         * init categories selection
         * read its selected value when changed
         */
        function init() {
            //init selection element
            $('select.dropdown').dropdown();
            $('select.dropdown').dropdown({
                on: 'hover'
            });
            //create change event
            cat_el.on('change', (e) => {
                e.preventDefault();
                var val = catValue();
                if (val != undefined) {
                    //console.log(val + ':' + catJson[val]);
                    //search parts - category
                    database.dbSearch(false, val);
                }
            });
            //read categories
            readCategories();
        }

        return {
            init: init,
            categories: categories
        };
    })();

    /**
     * part add/edit
     */
    var partAddEditUi = (function partAddEditUi() {
        var packages = [];
        var cat_pkg = [false, false];
        //modal elemnt
        var ptModal = $('#modal-part-add');
        //parts add modal elements
        var pEl = {
            id: $('#part-add-id'),
            stock: $('#part-add-stock'),
            cat: $('#part-add-cat'),
            manf: $('#part-add-manf'),
            mNum: $('#part-add-num'),
            pkg: $('#part-add-pkg'),
            pins: $('#part-add-pins'),
            dSheet: $('#part-add-dsheet'),
            desc: $('#part-add-desc'),
            icon: $('#part-add-icon'),
            cad: $('#part-add-cad'),
            specs: $('#part-add-spec'),
            images: $('#part-add-images'),
            dist: $('#part-add-dist'),
            link: $('#part-add-link'),
            cost: $('#part-add-cost'),
            slimit: $('#part-add-slimit')
        };
        //preiovus shown id
        var prevID = '';

        /**
         * clear modal part fields
         */
        function partClearFields() {
            var keys = Object.keys(pEl);
            keys.forEach(key => {
                pEl[key].val('');
            });
            pEl.cat.dropdown('clear');
            pEl.pkg.dropdown('clear');
        }


        /**
         * get part modal fields values
         * @returns array
         */
        function getPartModalFieldsData() {
            var fields = Object.create(null),
                keys = Object.keys(pEl);
            keys.forEach(key => {
                if (key === 'id' || key === 'mNum') fields[key] = (pEl[key].val().toUpperCase());
                else fields[key] = (pEl[key].val());
            });
            return fields;
        }

        /**
         * save part data
         */
        function partSaveData() {
            var data = getPartModalFieldsData();
            if (data.id.length == 0) {
                swal('Error', 'Part ID cannot be null!', 'error');
                return;
            }
            var sql = `INSERT INTO parts 
            (id, stock, type, manf, manf_part_no, package, pins_no, datasheet, description, icon, 
            cad, specs, images, seller, link, cost, stock_limit) VALUES (
                "${data.id}", "${data.stock}", "${data.cat}", "${data.manf}", "${data.mNum}", "${data.pkg}", "${data.pins}",
                "${data.dSheet}", "${data.desc}", "${data.icon}", "${data.cad}", "${data.specs}", "${data.images}",
                "${data.dist}", "${data.link}", "${data.cost}")`
            database.dbRunSavePartQuery(sql);
        }

        /**
         * part categories
         * @returns none 
         */
        function partCategoriesInit() {
            if (cat_pkg[0] === true) return;
            var cat = app_prefs.categories;
            if (cat.length === 0) return;
            var parent = $('#part-add-cat');
            parent.empty();
            var cts = Object.keys(cat);
            cts.forEach(cts => {
                //console.log(cts);
                var opt = document.createElement('option');
                opt.setAttribute('value', cts);
                opt.innerText = cat[cts];
                parent.append(opt);
            });
            cat_pkg[0] = true;
        }

        /**
         * get packages
         */
        function partPackagesInit() {
            if (cat_pkg[1] === true) return;
            packages = app_prefs.packages;
            if (packages.length === 0) return;
            var parent = $('#part-add-pkg');
            parent.empty();
            packages.forEach(pkg => {
                var opt = document.createElement('option');
                opt.setAttribute('value', pkg);
                opt.innerText = pkg;
                parent.append(opt);
            });
            cat_pkg[1] = true
        }

        //show modal
        var showModal = (init = false) => {
            if (init === true) partClearFields();
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
                if (msel) el.val(JSON.stringify(filenames));
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
            return `<tbody>
            <tr> <td class="two wide column">Type</td><td>${data.type}</td></tr>
            <tr><td>Manufacturer</td><td>${data.manf}</td></tr>
            <tr><td>Package</td><td>${data.package}</td></tr>
            <tr><td>Pinouts</td><td>${data.pins_no}</td></tr>
            </tbody>`
        }

        /**
         * return html for part table specifications
         * @param {json} data 
         * @returns html string
         */
        var partShowTable2Html = (data) => {
            //check if specs available
            if (data.specs.length == 0) {
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
        }

        /**
         * show part info - view port
         */
        var partsShowJson = Object.null,
            partShowData = (pData) => {
                partsShowJson = Object.assign({}, pData);
                var stock = [['In Stock', '5aff0e'], [`Low Stock - Limit is ${partsShowJson.stock_limit}`, 'ffcb22'], ['Out of Stock', 'ff0e0e']],
                    slv = 0;
                //show data only once
                if (prevID === partsShowJson.id) return;
                else prevID = partsShowJson.id;
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
                pElShow.id.text(`${partsShowJson.id} | ${partsShowJson.manf_part_no}`);
                //seller
                pElShow.seller.html(`<i class="cart icon"></i> ${partsShowJson.seller}`);
                //icon
                pElShow.icon.html(`<img src="${partsShowJson.icon}" class="img-fluid" alt="${partsShowJson.id}">`);
                //description
                pElShow.desc.html(`<span class="column sixteen wide">${partsShowJson.description}</span>`);
                //stock
                if (partsShowJson.stock == 0) slv = 2;
                else if (partsShowJson.stock < partsShowJson.stock_limit) slv = 1;
                pElShow.inStock.html(`<span style="color:#${stock[slv][1]}">${stock[slv][0]}</span>`);
                pElShow.stock.html(`Stock : <i class="cart arrow down icon" style="color: #47ff56"></i>${partsShowJson.stock}&nbsp;&nbsp;
                                        <i class="dollar icon" style="color: #ff2335"></i>${partsShowJson.cost}`);
                //table 1 info
                pElShow.table1.html(partShowTable1Html(partsShowJson));
                //table 2 specs
                pElShow.table2.html(partShowTable2Html(partsShowJson));
            },
            partEditData = () => { //edit part
                if (partsShowJson === undefined) {
                    swal('', 'Please select part!', 'error');
                    return false;
                }
                var keys = Object.keys(pEl),
                    pkeys = Object.keys(partsShowJson),
                    cat = categoriesUi.categories();
                for (var i = 0; i < keys.length; i++) {
                    if (keys[i] === 'cat' || keys[i] === 'pkg') {
                        var val = keys[i] === 'cat' ? cat[partsShowJson[pkeys[i]]] : partsShowJson[pkeys[i]];
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
        var prevLogEl = null;
        /**
         * create new log - modal elements
         */
        function createlog(log) {
            var uid = chance.string({ length: 4, casing: 'upper', alpha: true, numeric: true }),
                qty = chance.natural({ min: 1, max: 5000 }),
                ttr = document.createElement('tr'),
                dt_ = new Date().toJSON(),
                date = dt_.substring(0, dt_.lastIndexOf(':'));
            ttr.id = uid;
            ttr.innerHTML = `<td>${uid}</td>
                            <td>${date}</td>
                            <td>${log[0]}</td>
                            <td>${log[1]}</td>`
            ttr.addEventListener('click', (e) => {
                var pel = e.target.parentNode;
                pel.setAttribute('style', 'color: #bafbf8');
                if (prevLogEl !== null && prevLogEl.id === pel.id) prevLogEl = null;
                if (prevLogEl != null) prevLogEl.setAttribute('style', 'color: #81a3a7');
                prevLogEl = pel;
            });
            ttr.addEventListener('mouseover', (e) => {
                if (ttr.id != prevLogEl.id)
                    ttr.setAttribute("style", "color: #a7d0d4");
            });
            ttr.addEventListener('mouseleave', (e) => {
                if (ttr.id != prevLogEl.id)
                    ttr.setAttribute("style", "color: #81a3a7");
            });
            return ttr;
        };

        /**
         * create a new log
         * @returns none
         */
        function partNewLog() {
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
            var ltr = createlog([qty, desc]);
            $('#part-log-table tbody').append(ltr);
            ltr.scrollIntoView();
            return true;
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
                swal('', name + ' not found', 'error');
            }
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
                    //partCategoriesInit();
                    //partPackagesInit();
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
                    return partNewLog();
                }
            });
            //partCategoriesInit();
            partPackagesInit();

            $('.ui.dropdown').dropdown();

            $('#modal-part-add .ui.tabular.menu .item').tab();
            $('#div-part-img-spec .ui.tabular.menu .item').tab();
            $('.ui.checkbox').checkbox();

            //edit part
            $('#part-show-btn-edit').on('click', (e) => {
                e.preventDefault();
                partEditData();
            });

            //get datasheet from local file
            pEl.dSheet.on('dblclick', (e) => {
                e.preventDefault();
                getFilename(pEl.dSheet, [{ name: 'PDF', extensions: ['pdf'] }]);
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
                    checkIfFileExists(partsShowJson.datasheet);
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
                    checkIfFileExists(partsShowJson.cad, true);
                } catch (e) { }
            });
            //delete a log
            $('#part-log-btn-del').on('click', (e) => {
                e.preventDefault();
                if (prevLogEl === null) { return; }
                swal({
                    title: "Delete Log",
                    text: "Are you sure you want to delete log?",
                    icon: "warning",
                    buttons: true,
                    dangerMode: true,
                }).then((willDelete) => {
                    if (willDelete) {
                        prevLogEl.remove();
                        swal(`Log : ${prevLogEl.id}`, 'Deleted succesfully!', 'success');
                        swal("Log Deleted!", {
                            icon: "success",
                        });
                    }
                });
            });
            //show add log modal
            $('#part-log-btn-add').on('click', (e) => {
                e.preventDefault();
                $('#modal-log-add').modal('show');
            });
        }

        return {
            init: init,
            partCategoriesInit: partCategoriesInit,
            showModal: showModal,
            partClearFields: partClearFields,
            partSaveData: partSaveData,
            partShowData: partShowData
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

            const exists = fs.pathExistsSync(dir);
            if (exists === false) {
                swal('Preferences', 'Please set app directory', 'error');
                return false
            }
            //dir
            prefs["dir"] = dir;
            //categories
            if (cats.length > 0) {
                /* var ctgs = cats.trim().split('\n');
                 ctgs.forEach(ctg => {
                     var in_ = ctg.split(',');
                     categories[in_[0].trim()] = in_[1].trim();
                 });*/
                var catgs = cats.trim().split(',');
                catgs.forEach(catg => {
                    categories.push(catg.trim());
                });
            }
            prefs["categories"] = categories;
            //packages
            if (pkgs.length > 0) {
                var packs = pkgs.trim().split(',');
                packs.forEach(pck => {
                    packages.push(pck.trim());
                });
            }
            prefs["packages"] = packages;

            console.log(prefs);
            //create datasheet folder
            fs.ensureDirSync(dir + '/datasheets/');
            //create images folder
            fs.ensureDirSync(dir + '/images/');
            //create preferences file
            fs.ensureFileSync(dir + '/pref.json');
            //write to preferencess folder
            var pref_path = __dirname + '/res/data/pref.json';
            fs.outputFileSync(pref_path, JSON.stringify(prefs));
            swal('Preferences', 'Successful', 'success');
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
                console.log(dg[0]);
            }
        }

        /**
         * init preferences modal fields
         */
        function initPrefsFields() {
            $('#app-config-dir').val(''); //app directory
            $('#app-config-cat').val(''); //categories
            $('#app-config-pkg').val(''); //packages
        }

        /**
         * show or hide ui
         * @param {boolean} show 
         */
        function showUi(show) {
            if (show) {
                $('.column.dev-desc .column').show();
                $('.column.dev-logs .column').show();
            } else {
                $('.column.dev-desc .column').hide();
                $('.column.dev-logs .column').hide();
            }
        }
        /**
         * init ui
         */
        function init() {
            showUi(false);
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

            //fetch all parts button event
            $('#btn-part-all').on('click', (e) => {
                database.dbFetchAllParts();
            });

            //search components button event
            $('#btn-part-sc').on('click', (e) => {
                swal("Enter Manufacturer Part Number", {
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
                partAddEditUi.showModal(true);
            });

            $('#btn-part-clear').on('click', (e) => {
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

            //on window resize
            $(window).on('resize', function () {
                if ($(window).height() < 650) $(window).height('50px');
                //list height
                listUi.setListHeight();
                //log table height
                $('.log-table tbody').css('height', ($(window).height() - 170) + 'px');
            });

            //on window closing try to close db
            $(window).on('unload', function () {
                database.dbClose();
                console.log("Handler for .unload() called.");
            });

            //init main categories
            categoriesUi.init();

            //init categories ui
            listUi.init();
            //init modals
            partAddEditUi.init();
            //loading complete
            swal("Inventory", "Loaded!", "success");
        }

        return {
            init: init,
            showUi: showUi
        }
    })();

    async function readPreferences() {
        const exists = await fs.pathExists(pref_default_path);
        if (exists === true) {
            try {
                app_prefs = await fs.readJson(pref_default_path);
                app_prefs['default'] = true;
                console.log(app_prefs);
                mainUi.init();
            } catch (err) {
                console.error(err);
            }
        }
    }

    /**
     * on window load
     */
    $(function () {
        readPreferences();
    });
})({});