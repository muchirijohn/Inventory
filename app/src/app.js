
/* SPDX-License-Identifier: MIT */
/* SnippetCopyrightText: Copyright © 2022 peanut inventory, muchirijohn */

'use strict';

const { UUID } = require('builder-util-runtime');
const { dir } = require('console');
const { create } = require('domain');
const { string } = require('i/lib/util');
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

    const { dialogs } = require('./src/dialogs');
    const { utils } = require('./src/utils');
    const { settings } = require('./src/settings');
    const { database } = require('./src/database');
    const { Qrc, Qrc_async } = require('./src/qr');

    //var to hold app preferences
    var app_prefs = Object.create(null),
        //temp pats db -- global
        partsJsonDb = Object.create(null),
        //part ids
        partsJsonIDs = [],
        //get resources directory to fetch data from
        getResDir = (src) => {
            var a_dir = ((app_prefs.default === true) ? `${settings.appDir}\\${app_prefs.dir}` : app_prefs.dir),
                s_dir = `${a_dir}\\${src}`;
            const exists = fs.pathExistsSync(s_dir);
            if (exists === false) s_dir = `${settings.appDir}\\res\\${src}`;
            return s_dir;
        };

    /**
     * Shorten string
     * @param {Integer} len 
     * @returns String
     */
    String.prototype.shortenString = function (len) {
        if (this.length > len) return this.substring(0, len) + '...';
        else return this;
    }

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
            list_elm.css('height', (win_height - 180) + 'px');
        }

        /**
         * edit the list item content
         * @param {Object} part_data 
         */
        function listItemContent(item_data, item = null, empty = false) {
            if (item === null) item = $(`#list-panel #${item_data.id}`);
            if (empty === true) item.empty();
            item.html(`<div class="image">
            <img class="ui tiny image" src="${getResDir(`images\\${item_data.icon}`)}"></div>
            <div class="content"><a class="header hd-inv-id">${item_data.id}<br><span class="hd-manf-id">${item_data.manf_part_no}</span></a>
            <div class="description">${item_data.description/*.shortenString(60)*/}</div>
            </div>`);
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
            listItemContent(part_data, $(d_));
            //add click listener
            d_.addEventListener('click', (e) => {
                e.preventDefault();
                const cn = e.target.className,
                    par = e.target.closest('.item'),
                    id = par.id;
                //check if already selected
                if ((prevListClicked !== null && id === prevListClicked.id) ||
                    partsJsonDb[id] === undefined) return;
                //show part data
                partAddEditUi.partShowData(partsJsonDb[id]);
                //set clicked part active
                par.setAttribute("style", "background-color: rgb(60, 60, 60)");
                //set prev selected part inactive
                if (prevListClicked !== null) {
                    prevListClicked.setAttribute("style", "background-color: transparent");
                }
                prevListClicked = par;
                mainUi.showHidePartUi(true);
                //fetch logs from db
                if (partsJsonDb[id].logs === undefined) {
                    //populate logs from db
                    database.dbFetchLogs(id, partAddEditUi.createDBLogs);
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
                dialogs.notify(["Inventory", "Part(s) not found!", "error"]);
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
            prevListClicked = null;
            //init parts
            partAddEditUi.initPartShow();
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
                    dialogs.msgTimer(['', 'Part deleted succesfully!', 'success', 1500]);
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
            database.dbFetchParts(sql, generateList);
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
            //search components button event
            $('#btn-part-sc').on('click', (e) => {
                e.preventDefault();
                swal("Please Enter Search Query", {
                    title: 'Search',
                    content: "input",
                }).then((val) => {
                    if (val) {
                        //search parts - manf and description
                        database.dbSearch(true, val, generateList);
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
                dialogs.confirm({
                    title: "Clear contents",
                    text: "Are you sure you want to clear contents?",
                    icon: "warning",
                    buttons: true,
                    dangerMode: true,
                }, () => {
                    partAddEditUi.partClearFields();
                    dialogs.notify(['', "Contents cleared!", "success"]);
                });
            });
        }

        return {
            init: init,
            getWinHeight: getWinHeight,
            setListHeight: setListHeight,
            addNewPartItem: addNewPartItem,
            generateList: generateList,
            listFilterParts: listFilterParts,
            listItemContent: listItemContent,
            listDeletePart: listDeletePart
        }
    })();


    /**
     * categories
     */
    var categoriesUi = (function categoriesUi() {
        //selection element
        var cat_el = $('#sel-device'),
            selectedValue = '';

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
            var catgs = app_prefs.categories;
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
                cat_el.dropdown('change values', options);
            } else {
                //create category selection list
                cat_el.dropdown({
                    values: options,
                    onChange: function (value, text, $selectedItem) {
                        selectedValue = value;
                        /*if (value !== undefined && init_cat === true) {
                            if (init_cat) database.dbSearch(false, value);
                        }
                        if (value.length > 0) init_cat = true;*/
                    }
                });
            }
        }

        /**
         * init categories selection
         * read its selected value when changed
         */
        function init() {
            //search by category button
            $('#sel-cat-search').on('click', (e) => {
                e.preventDefault();
                if (selectedValue !== '') {
                    console.log(selectedValue);
                    if (selectedValue.toLowerCase() === 'all') {
                        //get all parts
                        listUi.listFilterParts(1);
                    } else {
                        //get parts filtered by category
                        database.dbSearch(false, selectedValue, listUi.generateList);
                    }
                }
            });
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
        var ptModal = $('#modal-part-add'),
            //parts add modal elements
            pEl = {
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
                stock_limit: $('#part-add-slimit'),
                notes: $('#part-add-notes'),
                dist: $('#part-add-distbs'),
                shelf: $('#part-add-shelf'),
                box: $('#part-add-box')
            };
        //preiovus shown id
        let selectedID = '',
            //distributors array object
            //distObj = [],
            //current vendor info
            curVendor = {},
            //manufacturers array object
            manf_type = { index: 0, manfs: [] },
            //qr code image
            qr_data = '';
        /**
         * clear modal part fields
         */
        function partClearFields() {
            var keys = Object.keys(pEl);
            keys.forEach(key => {
                if (key === 'id' && !isPartNew) return;
                pEl[key].val(key === 'stock' ? 0 : '');
            });
            pEl.type.dropdown('clear');
            pEl.package.dropdown('clear');
        }

        /**
         * get and parse distributors
         * @param {String} p_dist 
         * @returns array object
         */
        function getDistData(p_dist) {
            try {
                var d_ = [];
                if (p_dist === null || p_dist.trim() === '') return d_;
                const dists = p_dist.split('\n');
                dists.forEach(dist => {
                    var slc = dist.split(';');
                    const d_arr = { 'dist': slc[0], 'link': slc[1], 'stock': slc[2], 'cost': slc[3] };
                    d_.push(d_arr);
                });
                return d_;
            } catch (err) { return [] }
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
                dialogs.notify(['Error', 'Part ID cannot be null!', 'error']);
                return;
            }
            let storage = JSON.stringify({
                'shelf': data.shelf,
                'box': data.box
            }),
                storageDb = storage.replace(/\"/g, "\"\"");
            //console.log(storage);
            if (isPartNew === true) {
                sql = `INSERT INTO parts 
                    (id, stock, type, manf, manf_part_no, package, pins_no, datasheet, description, icon, 
                    cad, specs, images, stock_limit, notes,dist, storage) VALUES (
                        "${data.id}", "${data.stock}", "${data.type}", "${data.manf}", "${data.manf_part_no}", "${data.package}", "${data.pins_no}",
                        "${data.datasheet}", "${data.description}", "${data.icon}", "${data.cad}", "${data.specs}", "${data.images}",
                        "${data.stock_limit}", "${data.notes}", "${data.dist}", "${storageDb}")`;
            } else {
                sql = `UPDATE parts SET 
                        stock="${data.stock}", type="${data.type}", manf="${data.manf}", 
                        manf_part_no="${data.manf_part_no}", package="${data.package}", pins_no="${data.pins_no}",
                        datasheet="${data.datasheet}", description="${data.description}", icon="${data.icon}", 
                        cad="${data.cad}", specs="${data.specs}", images="${data.images}",
                        stock_limit="${data.stock_limit}", notes="${data.notes}", dist="${data.dist}", storage="${storageDb}"
                    WHERE
                        id="${data.id}"`;
                data['storage'] = storage;
                partsJsonDb[data.id] = data;
                partShowData(data);
                listUi.listItemContent(data, null, true);
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
                const t_data = `<tbody>
            <tr> <td class="two wide column">Type</td><td>${data.type}</td></tr>
            <tr><td>Manufacturer</td><td><span id="part-manf-fab">${''/*data.manf*/}</span><i class="part-manf industry icon"></i></td></tr>
            <tr><td>Package</td><td>${data.package}</td></tr>
            <tr><td>Pinouts</td><td>${data.pins_no}</td></tr>
            </tbody>`;
                pElShow.table1.html(t_data);
                //go to manufacturer website
                setManfWebsite(data.manf);
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
                var t_data = '<tbody><tr> <td class="seven wide column">',
                    specs = data.specs.split('\n'),
                    index = 0;
                specs.forEach(spec => {
                    var field = spec.split(',');
                    t_data += `${index++ > 0 ? '<tr><td>' : ''}
                        ${field[0].trim()}</td><td>${field[1].trim()}</td></tr>`;
                });
                t_data += '</tbody>';
                pElShow.table2.html(t_data);
            } catch (err) { }
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
            initDistr_ = false,
            totalStock = 0,
            //elements
            pElShow = {
                id: $('#part-show-id'),
                icon: $('#part-show-icon'),
                desc: $('#part-show-desc'),
                stock: $('#part-show-stock'),
                inStock: $('#part-show-in-stock'),
                seller: $('#part-show-seller'),
                table1: $('#part-show-table-1'),
                table2: $('#part-show-table-2')
            },
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

            /**
             * Distributor info. dist-link-cost
             * @param {String} distb 
             */
            getDistInfo = (distb) => {
                const dist_ = partsJsonDb[selectedID].distObj;
                if (dist_.length > 0) {
                    const index = dist_.findIndex((vd) => (vd.dist) === distb);
                    curVendor = dist_[index];
                    $('#part-show-dist .stock').text(curVendor.stock);
                    partShowStock(partsJsonDb[selectedID].stock);
                    $('#part-show-seller').attr('data-tooltip', `Open ${curVendor.dist} Link`);
                    //clear qr data  image
                    qr_data = '';
                }
            },
            /**
             * show distributors
             */
            partShowDistbs = (p_dist) => {
                var options = [],
                    init = true,
                    totalStock_ = 0;
                try {
                    curVendor = {};
                    $('#part-show-dist').dropdown('clear');
                    if (p_dist.length === 0 || p_dist[0].stock === undefined) return totalStock_;
                    p_dist.forEach(vd => {
                        const val = vd.dist;//.shortenString(12);
                        const item = { name: val, value: vd.dist, selected: init };
                        options.push(item);
                        totalStock_ += utils.filterInt(vd.stock);
                        init = false;
                    });
                    //init distributor list
                    if (initDistr_ === true)
                        $('#part-show-dist').dropdown('change values', options);
                    else {
                        //distributors dropdown
                        $('#part-show-dist').dropdown({
                            values: options,
                            onChange: function (value, text, $selectedItem) {
                                if (value.length > 0) {
                                    getDistInfo(value);
                                }
                            }
                        });
                        initDistr_ = false;
                    }
                    return totalStock_;
                } catch (err) {
                    console.log(err);
                    return 0;
                }
            },
            /**
             * show stock
             */
            partShowStock = (stock) => {
                // console.table(curVendor)
                pElShow.stock.html(`Stock : <i class="cart arrow down icon" style="color: #47ff56"></i>
                                    ${((curVendor.stock !== undefined) ? curVendor.stock : '0')}&nbsp;&nbsp;
                                    <i class="dollar icon" style="color: #ff2335"></i>
                                    ${((curVendor.cost !== undefined) ? curVendor.cost : '0.00')}`);
            },
            /**
             * get part data nd show/display it
             */
            partShowData = (pData, tb_update = true) => {
                try {
                    partsShowJson = Object.assign({}, pData);
                    var stock = [['In Stock', '5aff0e'], [`Low Stock - Limit is ${partsShowJson.stock_limit}`, 'ffcb22'], ['Out of Stock', 'ff0e0e']],
                        slv = 0;
                    //if (prevID === partsShowJson.id) return;
                    selectedID = partsShowJson.id;
                    //show data only once
                    if (partsShowJson.distObj === undefined) {
                        let distObj = getDistData(partsShowJson.dist); //set distributor
                        partsShowJson['distObj'] = distObj;
                        partsJsonDb[selectedID].distObj = distObj;
                    }
                    //id+manf+mNum
                    pElShow.id.html(`<span class='hd-inv-id'>${partsShowJson.id}</span><br><span class='hd-manf-id'>${partsShowJson.manf_part_no}</span`);
                    //distributors
                    $('#part-show-dist .stock').text('0'); //init original stock
                    totalStock = partShowDistbs(partsShowJson.distObj);
                    //icon
                    pElShow.icon.html(`<img src="${getResDir(`\\images\\${partsShowJson.icon}`)}" class="img-fluid" alt="${partsShowJson.id}">`);
                    //description
                    pElShow.desc.html(`<span class="column sixteen wide">${partsShowJson.description}</span>`);
                    //stock - total stock from distributors
                    partsShowJson.stock = totalStock;
                    if (partsShowJson.stock == 0) slv = 2;
                    else if (utils.filterInt(partsShowJson.stock) < utils.filterInt(partsShowJson.stock_limit)) slv = 1;
                    pElShow.inStock.html(`<span style="color:#${stock[slv][1]};animation:${(slv === 2) ? 'text-flicker 0.5s infinite alternate' : 'none'}">
                                        Total [ ${stock[slv][0]} ] Qty : ${partsShowJson.stock}</span>`);
                    //show stock
                    partShowStock(partsShowJson.stock);
                    //if updating data
                    if (tb_update === true) {
                        //table 1 info
                        partShowTable1Html(partsShowJson);
                        //table 2 specs
                        partShowTable2Html(partsShowJson);
                        //show images
                        partShowImages(partsShowJson.images);
                        //notes
                        partsShowNotes(partsShowJson.notes)
                    }
                    qr_data = '';
                } catch (err) {
                    console.log(err);
                    dialogs.notify(['', 'Failed to show part data', 'error']);
                }
            },
            /**
             * edit part data
             */
            partEditData = () => { //edit part
                if (partsShowJson === undefined) {
                    dialogs.notify(['', 'Please select part!', 'error']);
                    return false;
                }
                var keys = Object.keys(pEl),
                    pkeys = Object.keys(partsShowJson),
                    cat = categoriesUi.categories(),
                    storage = JSON.parse(partsShowJson.storage);
                //console.log(storage)
                for (var i = 0; i < keys.length; i++) {
                    if (keys[i] === 'type' || keys[i] === 'package') {
                        var val = partsShowJson[pkeys[i]];
                        pEl[keys[i]].dropdown('set exactly', [val]);
                    } else if (keys[i] == 'shelf' || keys[i] == 'box') {
                        let value = (storage !== null) ? storage[keys[i]] : '';
                        pEl[keys[i]].val(value);
                    } else {
                        pEl[keys[i]].val(partsShowJson[pkeys[i]]);
                    }
                    //show edit modal
                    showModal();
                };

            }

        var prevLogEl = null,
            selectedDistIndex = -1,
            getLogId = (id) => {
                return `log-${id.replaceAll(':', '_')}`;
            },
            logStringifyVendors = () => {
                let s_ = '';
                const dist_ = partsJsonDb[selectedID].distObj;
                dist_.forEach(vd => {
                    s_ += `${vd.dist};${vd.link};${vd.stock};${vd.cost}\n`;
                });
                return s_.trim();
            },
            /**
             * init log vendors 
             * populate dropdown
             */
            initLogVendors = (index = 0) => {
                var menuItems = [],
                    menuEl = $('#part-log-dist-dp .menu'),
                    init_ = index === 0 ? true : false,
                    cindex = 0;
                //clear menu items
                $('#part-log-dist-dp').dropdown('clear');
                //create vendors
                partsJsonDb[selectedID].distObj.forEach(vd => {
                    //item description
                    if (index === cindex) init_ = true;
                    let name_ = `
                            <i class="industry icon"></i>${vd.dist} :&nbsp
                            <i class="cart arrow down icon"></i>${vd.stock}&nbsp&nbsp
                            <i class="dollar icon"></i> ${vd.cost}`;
                    //create item object
                    var item = { name: name_, value: vd.dist, selected: init_ };
                    menuItems.push(item);
                    //select only first item
                    init_ = false;
                    cindex += 1;
                });
                $('#part-log-dist-dp').dropdown('change values', menuItems);
                //menuEl.html(menuItems);
            },
            /**
             * vendor dropdown select
             */
            logVendorChange = (value) => {
                const dist_ = partsJsonDb[selectedID].distObj;
                //find the vendor index
                const index = dist_.findIndex((dist_) => (dist_.dist === value));
                if (index !== -1) {
                    selectedDistIndex = index;
                    //console.log([value, index, dist_[index]]);
                }
            },
            /**
             * init log modal and validate fields on show
             */
            logShowCheck = () => {
                const dist_ = partsJsonDb[selectedID].distObj;
                if (dist_.length === 0 || dist_[0].stock === undefined) {
                    dialogs.msgTimer(['Log', 'Part has no vendor set!', 'error', 1500]);
                } else {
                    //init log modal fields
                    initLogVendors();
                    $('#part-log-qty').val('0');
                    $('#part-log-desc').val('');
                    //show modal
                    $('#modal-log-add').modal('show');
                }
            };
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
            //select first log
            if (partsJsonDb[selectedID].logs.length >= 1) {
                prevLogEl = null;
                var log = (partsJsonDb[selectedID].logs[0]);
                $(`#${getLogId(log.date)}`).trigger('click');
            }
        }

        /**
         * create log
         * @param {array} log 
         */
        function createlog(log, new_log = true) {
            var ttr = document.createElement('tr');
            ttr.id = getLogId(log[2]);
            ttr.innerHTML = `<td>${log[1]}</td>
                            <td>${log[2]}</td>
                            <td>${log[3]}</td>
                            <td>${log[5]}</td>`;
            //event listeners
            ttr.addEventListener('click', (e) => {
                var pel = e.target.closest('tr');
                if (prevLogEl !== null && prevLogEl.id === pel.id) return;
                pel.setAttribute('style', 'color: #bafbf8');
                if (prevLogEl != null) prevLogEl.setAttribute('style', 'color: #81a3a7');
                prevLogEl = pel;
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
                dialogs.msgTimer(['Log', 'log added succesfully', 'success', 1500]);
            }
            //init dropdown vendor list
            initLogVendors(selectedDistIndex);
        };

        /**
         * create a new log
         * @returns none
         */
        function partNewLog() {
            try {
                var uid = 'Admin',//chance.string({ length: 4, casing: 'upper', alpha: true, numeric: true }),
                    qty = chance.natural({ min: 1, max: 5000 }),
                    dt_ = moment().format(),
                    date = dt_.substring(0, dt_.lastIndexOf('+')),
                    id_ = partsShowJson.id;
                //get distributor list
                let dist_ = partsJsonDb[id_].distObj[selectedDistIndex];
                if (partsShowJson === undefined) {
                    dialogs.notify(['', 'Please select part!', 'error']);
                    return false;
                }
                var partStock = dist_.stock;
                var qty = $('#part-log-qty').val(),
                    trs = $('#part-log-tr-cbk.ui.checkbox').checkbox('is checked'),
                    desc = $('#part-log-desc').val();
                //check if quantity not empty
                if (isNaN(qty) || qty.length === 0) {
                    dialogs.notify(['', 'Quantity should be a numeric value!', 'error']);
                    return false;
                }

                qty = utils.filterInt(qty);
                if(qty <= 0){
                    dialogs.notify(['', `Quantity(${qty}) should be greater than 0!`, 'error']);
                    return false;
                }

                //console.log(partStock.length)
                //check if quantity available
                if ((partStock.length === 0 || parseInt(qty) > parseInt(partStock)) && !trs) {
                    dialogs.notify(['', `Quantity(${qty}) greater than available stock(${partStock})!`, 'error']);
                    return false;
                }
                //check if desc empty
                if (desc.length === 0) {
                    dialogs.notify(['', 'Description cannot be empty!', 'error']);
                    return false;
                }
                qty = (trs ? '+' : '-') + qty;
                let log = [id_, uid, date, qty, (trs ? 1 : 0), desc],
                    lstk = utils.filterInt(qty),
                    stock = 0;
                if (lstk !== NaN) {
                    stock = utils.filterInt(dist_.stock) + utils.filterInt(lstk);
                    dist_.stock = stock;
                    log[1] = dist_.dist;
                    partShowData(partsJsonDb[id_], false);
                }
                //createlog(log, true);
                let logObj = { part_id: log[0], user: log[1], date: log[2], quantity: utils.filterInt(log[3]), state: log[4], desc: log[5] };
                //save logs to array object
                if (partsJsonDb[selectedID].logs !== undefined) { partsJsonDb[selectedID].logs.push(logObj); }
                //get updated vendors
                let vendors = logStringifyVendors();
                partsJsonDb[id_].dist = vendors;
                partsShowJson.dist = vendors;
                //save to logs to db
                database.dbRunSaveLog(log, [stock, vendors], createlog);
            } catch (err) {
                console.log(err);
                dialogs.msgTimer(['Log', 'Error creating log!', 'error', 1500]);
            }
        }

        /**
         * delete a log
         * @returns none
         */
        var deleteLogNotify = () => {
            if (prevLogEl === null) {
                dialogs.notify(['Error', 'The part has no logs', 'error']);
                return;
            }
            //show confirmation
            dialogs.confirm({
                title: "Delete Log",
                text: "Are you sure you want to delete log?",
                icon: "warning",
                buttons: true,
                dangerMode: true,
            }, deleteLog);
        },
            deleteLog = () => {
                try {
                    var id = prevLogEl.id,
                        qr = [
                            partsShowJson.id, //part id
                            id.substring(id.indexOf('-') + 1, id.length).replaceAll('_', ':') //date
                        ],
                        callback = () => {
                            //find log to delete
                            const index = partsJsonDb[selectedID].logs.findIndex((log) => (log.date === qr[1]));
                            //if(index === -1) return;
                            //remove log from array
                            partsJsonDb[selectedID].logs.splice(index, 1);
                            //delete log from table
                            prevLogEl.remove();
                            //select next log
                            var len = partsJsonDb[selectedID].logs.length;
                            if (len > index) {
                                $(`#${getLogId(partsJsonDb[selectedID].logs[index].date)}`).trigger('click');
                            } else if (len > 0) {
                                $(`#${getLogId(partsJsonDb[selectedID].logs[index - 1].date)}`).trigger('click');
                            }
                            //remove prev selected log object
                            if (partsJsonDb[selectedID].logs.length === 0) prevLogEl = null;
                            //log delete success message
                            dialogs.msgTimer(['', 'Log deleted succesfully!', 'success', 1500]);
                        }
                    database.dbDeleteLog(qr, callback);
                } catch (err) {
                    dialogs.notify(['Error', 'Failed to delete log!', 'error']);
                }
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
                dialogs.notify(['', 'file not found', 'error']);
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
                //console.log(partsJsonIDs[0])
            }
        }

        /**
         * delete part
         */
        function deletePart() {
            dialogs.confirm({
                title: `Part  : ${selectedID}`,
                text: 'Are you sure you want to delete part?',
                icon: "warning",
                buttons: true,
                dangerMode: true
            }, listUi.listDeletePart);
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
         * set manufacturer info
         */
        function setManfWebsite(manf) {
            let manf_el = $('#part-show-table-1 #part-manf-fab');
            //get manfs
            manf_type.manfs = manf.split(',');
            manf_type.index = 1;
            //manf
            manf_el.html(manf_type.manfs[0]);
            //generate qr
            async function qr_w() {
                qr_data = await Qrc_async(curVendor.link);
                if (qr_data !== 'error') {
                    //console.log(qr_data);
                    $('#part-show-icon>img').attr("src", qr_data);
                } else {
                    dialogs.msgTimer(['', 'Failed to generate QR code! Please Set Manufacturer\'s Link', 'error', 1500]);
                }
            }

            //get a manufacturer from the manf list
            var getManf = () => {
                if (manf_type.index === 1 /*(manf_type.manfs.length - 1)*/) manf_type.index = 0;
                else manf_type.index++;
                //manf_el.html(manf_type.manfs[manf_type.index]);
                ///toggle part icon or qr code
                if (manf_type.index === 0) {
                    if (qr_data.indexOf('data:image') !== -1) $('#part-show-icon>img').attr("src", qr_data);
                    else qr_w();
                } else if (manf_type.index === 1) {
                    $('#part-show-icon>img').attr("src", getResDir(`\\images\\${partsShowJson.icon}`));
                }
            }
            // getManf();
            $('.part-manf.icon').on('click', (e) => {
                e.preventDefault();
                getManf();
                /*const manf = partsJsonDb[selectedID].manf;
                dialogs.msgTimer(['', `${manf}`, 'success', 1500]);
                //shell.openExternal(partsJsonDb[selectedID].manf_url);*/
            });
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
                    //on modal show
                },
                onDeny: function () {
                    return true;
                },
                onApprove: function () {
                    partNewLog();
                    return false;
                }
            });
            $('#part-log-dist-dp').dropdown({
                options: [],
                transition: 'horizontal flip',
                onChange: function (value, text, $selectedItem) {
                    if (value.length > 0)
                        logVendorChange(value);
                }
            });
            //init categories
            initAllSelections();
            //init modal tabs
            $('#modal-part-add .ui.tabular.menu .item').tab();
            $('#div-part-img-spec .ui.tabular.menu .item').tab();
            $('.ui.checkbox').checkbox();

            //delete part
            $('#part-show-btn-del').on('click', (e) => {
                e.preventDefault();
                deletePart();
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
                        dialogs.notify(['Datasheet', 'Datasheet File not set', 'error']);
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
                    if (curVendor.link !== undefined) {
                        shell.openExternal(curVendor.link, 'info');
                    } else {
                        dialogs.msgTimer(['', 'No distributor set!', 'error', 1500]);
                    }
                } catch (e) { }
            });

            //show part link
            $('#part-show-cad').on('click', (e) => {
                try {
                    e.preventDefault();
                    if (partsShowJson.cad.indexOf('.') === -1) {
                        dialogs.notify(['CAD', 'Cad File not set', 'error']);
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
                logShowCheck();
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
                dialogs.notify(['Preferences', 'Please set app directory', 'error']);
                return false;
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
            //create data folder
            fs.ensureDirSync(dir + '/data/');
            //write to preferencess folder
            var pref_path = settings.userPref;
            //fs.outputFileSync(pref_path, JSON.stringify(prefs));
            fs.outputFile(pref_path, JSON.stringify(prefs))
                .then(() => fs.readJson(pref_path))
                .then(pref => {
                    app_prefs = pref;
                    partAddEditUi.initAllSelections(true);
                    //copy userDb
                    settings.copyUDb(dir);
                    dialogs.notify(['Preferences', 'Saved successfully!', 'success']);
                })
                .catch(err => {
                    dialogs.notify(['Preferences', 'An error occured!', 'error']);
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
                dialogs.notify(['', 'Please select a directory', 'error']);
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
        const u_path = await fs.pathExists(settings.userPref);
        var pref_path = u_path ? settings.userPref : settings.defaultPref;
        const d_path = await fs.pathExists(pref_path);
        if (d_path === true) {
            try {
                app_prefs = await fs.readJson(pref_path);
                mainUi.init();
                //$('#div-main-load span').text('Finalizing...');  
            } catch (err) {
                $('#div-main-load span').text('Error...');
                dialogs.notify(['Error', 'Ops! Something under the hood fried!', 'error']);
            }
        } else {
            $('#div-main-load span').text('Error...');
            dialogs.notify(['Error', 'Application preferences file is missing!', 'error']);
        }
    }

    /**
     * on window load
     */
    $(function () {
        readPreferences();
    });
})({});