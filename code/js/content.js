var $ = require('jquery');
var faker = require('faker/locale/en_US');
var Vue = require('vue');
var CssSelectorGeneratorConst = require('css-selector-generator');
Vue.config.devtools = false;

var getElSelector = function( element ) {

    var selector = null;

    if($(element).attr("name")) {
        selector = $(element).attr("name");
    } else if($(element).attr('id')) {
        selector = '#' + $(element).attr('id');
    } else {
        var classes =  $(element).attr('class');
        if(classes) {
            selector = '.' + classes.replace(/\s+/g, '.');
        }
    }
    return selector;
};

var App = new Vue({

    data: {
        steps: [],
        recording: false
    },

    created: function () {
        var self = this;

        chrome.storage.local.get(null, function (items) {
            self.recording = items.recording || false;

            if (items.steps) {
                self.steps = items.steps;
            }
            self.initializeEvents();
        });
    },

    methods: {
        initializeEvents: function () {
            var self = this;

            if (self.recording === true) {
                if (this.steps.length === 0 || this.steps[this.steps.length - 1].method !== 'click') {
                    this.steps.push({
                        'method': 'amOnPage',
                        'args': [window.location.pathname]
                    });
                }
            }

            $(document.body).on('change', 'textarea, input[type!="checkbox"][type!="file"][type!="submit"]', function () {
                if (self.recording === true) {
                    var name = getElSelector( $(this) ),
                        value = $(this).val();

                    self.steps.push({
                        'method': 'fillField',
                        'args': [name, value]
                    });
                }
            });


            $(document.body).on('change', 'input[type="file"]', function () {
                if (self.recording === true) {
                    var name = getElSelector( $(this) ),
                        value = 'absolutePathToFile';
                    self.steps.push({
                        'method': 'attachFile',
                        'args': [name, value]
                    });
                }
            });

            $(document.body).on('change', 'input[type="checkbox"]', function () {
                if (self.recording === true) {
                    var name = getElSelector( $(this) );

                    self.steps.push({
                        'method': 'checkOption',
                        'args': [name]
                    });
                }
            });

            $(document.body).on('click', function (e) {
                if (self.recording === true) {

                    var mySelector = new CssSelectorGenerator;
                    var selector = mySelector.getSelector(e.target);

                    self.steps.push({
                        'method': 'click',
                        'args': [selector]
                    });
                }
            });

            $(document.body).on('change', 'select', function (e) {
                if (self.recording === true) {

                    var mySelector = new CssSelectorGenerator;
                    var selector = mySelector.getSelector(e.target);
                    console.log( selector );

                    var name = getElSelector( $(this) ),
                        value = $(this).val();
                    self.steps.push({
                        'method': 'selectOption',
                        'args': [name, value]
                    });
                }
            });
        }
    },

    watch: {
        'steps': function (val) {
            var self = this;
            chrome.storage.local.set({'steps': val, 'preserveSteps': self.preserveSteps});
            chrome.extension.sendMessage({
                'steps': val
            });
        }
    },

});


var clickedEl = null;

document.addEventListener("mousedown", function (event) {
    if (event.button === 2) {
        clickedEl = event.target;
    }
}, true);

chrome.extension.onRequest.addListener(function (request) {

    var method = request.method || false;
    if (method === "see") {
        App.steps.push({
            'method': 'see',
            'args': [request.text]
        });
    }
    if (method === "seeElement") {
        var mySelector = new CssSelectorGenerator;
        var selector = mySelector.getSelector(clickedEl);
        App.steps.push({
           'method': 'seeElement',
           'args': [selector]
       });
    }

    if (method === "click") {
        var name = $(clickedEl).attr("name") || $(clickedEl).text().trim();
        if (name === '') {
            name = $(clickedEl).val();
        }
        App.steps.push({
            'method': 'click',
            'args': [name]
        });
    }
    if (method === "amOnPage") {
        App.steps.push({
            'method': 'amOnPage',
            'args': [window.location.pathname]
        });
    }
    if (method === "seeCurrentUrlEquals") {
        App.steps.push({
            'method': 'seeCurrentUrlEquals',
            'args': [window.location.pathname]
        });
    }
    if (method === "recording") {
        App.recording = request.value;
        chrome.storage.local.set({'steps': App.steps, 'recording': App.recording});
        if (App.recording === true && App.steps.length === 0) {
            App.steps.push({
                'method': 'resizeWindow',
                'args': [window.outerWidth, window.outerHeight]
            });
            App.steps.push({
                'method': 'amOnPage',
                'args': [window.location.pathname]
            });
        }
    }
    if (method === "clear") {
        App.recording = request.value;
        App.steps = [];
    }

    if (method === "undo") {
        App.steps.pop();
    }

    if (method === "fake") {
        var fakeData = "";

        switch (request.type) {
            case "email":
                fakeData = faker.internet.email();
                break;
            case "name":
                fakeData = faker.name.findName();
                break;
            case "firstname":
                fakeData = faker.name.firstName();
                break;
            case "lastname":
                fakeData = faker.name.lastName();
                break;
            case "word":
                fakeData = faker.lorem.words();
                break;
            case "url":
                fakeData = faker.internet.url();
                break;
        }
        $(clickedEl).val(fakeData);

        App.steps.push({
            'method': 'type',
            'faker': true,
            'args': [$(clickedEl).attr("name"), '$this->faker->' + request.type]
        });
    }
    if( method === "pushStep") {
        console.log('pushStep', request);
        App.steps.push({
           'method': request.value,
           'args': [request.args]
        });
    }
    if (method === "getSteps") {
        chrome.extension.sendMessage({
            'steps': App.steps
        });
    }
});
