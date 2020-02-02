/*
 * View model for OctoPrint-Slicer
 *
 * Author: Kenneth Jiang
 * License: AGPLv3
 */
import { endsWith } from 'lodash-es';
ko.bindingHandlers.numericValue = {
    init : function(element, valueAccessor, allBindings, data, context) {
        var interceptor = ko.computed({
            read: function() {
                return ko.unwrap(valueAccessor());
            },
            write: function(value) {
                if (!isNaN(value)) {
                    valueAccessor()(parseFloat(value));
                }
            },
            disposeWhenNodeIsRemoved: element
        });

        ko.applyBindingsToNode(element, { value: interceptor }, context);
    }
};

export function OverridesViewModel(parameters, array_keys, enum_keys, item_keys, boolean_keys) {
    var self = this;
    self.slicingViewModel = parameters[0];

    var ARRAY_KEYS = [
        "print_temperature",
        "start_gcode",
        "end_gcode",
        "filament_diameter"
    ],
        ENUM_KEYS = {
            "support" : ko.observableArray(["none", "buildplate", "everywhere"]),
            "platform_adhesion" : ko.observableArray(["none", "brim", "raft"])
        },
        ITEM_KEYS = [
            "layer_height",
            "temperature",
            "bed_temperature",
            "print_bed_temperature",
            "fill_density",
            "wall_thickness",
            "print_speed",
            "solid_layer_thickness",
            "travel_speed",
            "outer_shell_speed",
            "inner_shell_speed",
            "infill_speed",
            "bottom_layer_speed",
            "filament_flow",
            "retraction_speed",
            "retraction_amount",
            "extrusion_multiplier",
            "fan_full_height",
            "fan_speed",
            "fan_speed_max",
            "first_layer_temperature",
            "first_layer_bed_temperature",
            "brim_width",
            "skirts",
            "min_skirt_length",
            "brim_line_count",
        ],
        BOOLEAN_KEYS = [
            "support_material",
            "overhangs",
            "retraction_enable",
            "fan_enabled",
            "cooling",
            "fan_always_on",
            "spiral_vase",
        ];

    // Some options, depending on their setting, can force other
    // options.  Overrides happen last so include any trailing "%" if
    // needed.
    const FORCED_SETTINGS = new Map([
        // If spiral_vase...
        ["spiral_vase", new Map([
            // ... is set to 1 ...
            [1,
             // Override all of the following.
             new Map([["ensure_vertical_shell_thickness", 0],
                      ["fill_density", "0%"],
                      ["perimeters", 1],
                      ["top_solid_layers", 0],
                      ["support_material", 0],
                     ])
            ]
        ])]
    ]);

    var ALL_KEYS = BOOLEAN_KEYS.concat(ITEM_KEYS).concat(ARRAY_KEYS).concat(Object.keys(ENUM_KEYS));

    // initialize all observables
    _.forEach(ALL_KEYS, function(k) { self["profile." + k] = ko.observable(); });

    self.optionsForKey = function(key) {
        return ENUM_KEYS[key];
    };

    self.updateOverridesFromProfile = function(profile) {
        if (self.slicingViewModel.slicer()=='PBCuraEngine') {
            var span_parent = document.getElementById('basic_overrides').children[0].children[0].children[0];
            ko.removeNode(span_parent.children[0]);
            var new_span_element = document.createElement("label");
            new_span_element.setAttribute('class','span3');
            span_parent.insertBefore(new_span_element,span_parent.children[0]);

            self.profile_dict = profile['metadata']['octoprint_settings'];
            _.forEach(profile['metadata']['octoprint_settings'], function (v,k) {
                var key = "profile." + k;
                var element_id = 'slicer_input_'+k;
                var class_id = 'slicer_class_'+k;
                var options_dom_element = document.getElementById(element_id);
                var class_dom_element = document.getElementById(class_id);


                if (key in self === true) {
                    delete self[key];
                }

                if ( options_dom_element===null && class_dom_element===null ) {
                    var parent = document.getElementById('basic_overrides').children[0].children[0].children[0].children[0];
                    var class_dom_element = document.createElement("div");
                    var options_dom_element = document.createElement("input");
                    class_dom_element.id = class_id;
                    options_dom_element.id = element_id;

                    class_dom_element.setAttribute('title',k);
                    class_dom_element.setAttribute('class','input-append');
                    class_dom_element.setAttribute('data-bind',"visible: !_.isUndefined($data['profile."+k+"'])");

                    var label_dom_element = document.createElement("label");
                    label_dom_element.setAttribute('for',element_id);
                    label_dom_element.setAttribute('class','control-label');
                    label_dom_element.setAttribute('style','overflow: auto;');
                    label_dom_element.appendChild(document.createTextNode(k));

                    var div_dom_element = document.createElement("div");
                    div_dom_element.setAttribute('class','controls');

                    options_dom_element.setAttribute('data-bind',"value: $data['profile."+k+"']");
                    options_dom_element.setAttribute('type','text');

                    div_dom_element.appendChild(options_dom_element);
                    class_dom_element.appendChild(label_dom_element);
                    class_dom_element.appendChild(div_dom_element);
                    parent.appendChild(class_dom_element);
                }
                self[key] = ko.observable();
                try {
                    $(class_id).unbind();
                    ko.cleanNode(class_dom_element);
                    ko.applyBindings(self,class_dom_element);
                    $(element_id).unbind();
                    ko.cleanNode(options_dom_element);
                    ko.applyBindings(self,options_dom_element);
                } catch (err) {
                    console.log(err);
                }
                console.log(key);
                self[key](v);
                console.log(self[key]());
            });
        } else {
            // Some options are numeric but might have a percent sign after them.
            // Remove the percent and save it to replace later.
            self.endings = {};
            var stripEndings = function(m, k) {
                if (_.isString(m[k]) && endsWith(m[k], "%")) {
                    self.endings[k] = "%";
                    return m[k].slice(0,-1);
                } else {
                    return m[k];
                }
            }

            // Some options are booleans but can be stored as 0/1 or false/true.
            // Convert to native true/false and keep track of the style.
            self.booleans = {};
            var convertBoolean = function(m, k) {
                var BOOLS = [
                    ["false", "true"],
                    ["False", "True"],
                    ["0", "1"],
                ];
                if (m[k] === undefined) {
                    return undefined;
                }
                for (var boolType = 0; boolType < BOOLS.length; boolType++) {
                    for (var b = 0; b < BOOLS[boolType].length; b++) {
                        if (m[k] === BOOLS[boolType][b]) {
                            self.booleans[k] = BOOLS[boolType];
                            return !!b;  // Convert 0 to false and 1 to true.
                        }
                    }
                }
                return !!m[k]; // Just take a guess if we can't figure it out.
            }


            // Hacky - Slic3r profiles escape new line to be string '\n'
            if (self.slicingViewModel.slicer() == 'slic3r'){
                _.forEach(['end_gcode', 'start_gcode'], function(key) {
                    profile[key] = profile[key].replace(/\\n/g, '\n');
                });
            }

            // Some options are arrays in cura but not Slic3r.  Keep track of which.
            self.isArray = [];

            _.forEach(ITEM_KEYS, function(k) { self["profile." + k]( stripEndings(profile,k) ); });
            _.forEach(BOOLEAN_KEYS, function(k) { self["profile." + k]( convertBoolean(profile,k) ); });
            _.forEach(ENUM_KEYS, function(v, k) { self["profile." + k]( profile[k] ); });
            _.forEach(ARRAY_KEYS, function(k) {
                // Some config options are arrays in cura but not in Slic3r.
                // Detect which ones are arrays and only convert those.
                if (_.isArray(profile[k])) {
                    self.isArray.push(k);  // Remember this for later.
                    self["profile." + k](profile[k][0]);
                } else {
                    self["profile." + k](profile[k]);
                }});
        }
    };


    self.onProfileChange = function(newValue) {
        if (newValue === undefined) {  // For some reason KO would fire event with newValue=undefined,
            return;  // in which case we should ignore it otherwise things get messed up
        }

        var slicing = self.slicingViewModel;

        if( !slicing.slicer() || !slicing.profile() ) {
            return;
        }

        self.fetchSlicingProfile( slicing.slicer(), slicing.profile() );
    };

    self.fetchSlicingProfile = function(slicer, profile) {
        if (self.profileAjax) {
            self.profileAjax.abort();
            self.profileAjax = undefined;
        }

        self.profileAjax = $.ajax({
            url: API_BASEURL + "slicing/" + slicer + "/profiles/" + profile,
            type: "GET",
            // On success
            success: function(data) {
                self.updateOverridesFromProfile(data.data);
            }
        });
    };

    self.slicingViewModel.profile.subscribe( self.onProfileChange );
    //
    //End of Profile-handling mess


    self.toJS = function() {
        var result$$1 = ko.mapping.toJS(self, {
            ignore: ["slicingViewModel", "updateOverridesFromProfile", "updateOverrides", "toJS", "optionsForKey", "stripEndings", "isArray", "endings"]
        });
        if (self.slicingViewModel.slicer()=='PBCuraEngine') {
            var key_start = 'profile.';
            _.forEach(self, function (v,k) {
              if (typeof k === 'string' || k instanceof String) {
                  if (k.startsWith(key_start)==true) {
                      //~ key = k.replace(key_start,'');
                      result$$1["profile." + k] = v();
                  }
              }
          });
        } else {
            _.forEach(ITEM_KEYS, function (k) {
                if (self.endings.hasOwnProperty(k)) {
                    result$$1["profile." + k] += self.endings[k];
                }
            });
            _.forEach(BOOLEAN_KEYS, function (k) {
                if (self.booleans.hasOwnProperty(k)) {
                    // Convert false/true to the correct string.
                    result$$1["profile." + k] = self.booleans[k][result$$1["profile." + k] ? 1 : 0];
                }
            });

            for (var key in result$$1) {
                var baseKey = key.replace("profile.", "");
                // Convert it back to an array if it was an array originally.
                if (_.contains(ARRAY_KEYS, baseKey) && _.contains(self.isArray, baseKey)) {
                    result$$1[key] = [result$$1[key]];
                }
            }

            _.forEach(result$$1, function (v, k) {
                // If the value is undefined, must not be valid for this slicer.
                if (k.startsWith("profile.") && result$$1[k] === undefined) {
                    delete result$$1[k];
                }
            });

            // Hacky - Slic3r profiles escape new line to be string '\n'
            if (self.slicingViewModel.slicer() == 'slic3r') {
                _.forEach(['profile.end_gcode', 'profile.start_gcode'], function (key) {
                    result$$1[key] = result$$1[key].replace(/\n/g, '\\n');
                });
            }

            // Do all the overrides.  If there are conflicting overrides,
            // it's going to behave surprisingly.
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = FORCED_SETTINGS.keys()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var _key = _step.value;

                    var profile_key = "profile." + _key;
                    if (result$$1.hasOwnProperty(profile_key)) {
                        // This key is in our overrides.
                        var _iteratorNormalCompletion2 = true;
                        var _didIteratorError2 = false;
                        var _iteratorError2 = undefined;

                        try {
                            for (var _iterator2 = FORCED_SETTINGS.get(_key).keys()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                                var value$$1 = _step2.value;

                                if (result$$1[profile_key] == value$$1) {
                                    // This value causes overriding.
                                    var overrides = FORCED_SETTINGS.get(_key).get(value$$1);
                                    var _iteratorNormalCompletion3 = true;
                                    var _didIteratorError3 = false;
                                    var _iteratorError3 = undefined;

                                    try {
                                        for (var _iterator3 = overrides.entries()[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                                            var _step3$value = slicedToArray(_step3.value, 2),
                                                overrideKey = _step3$value[0],
                                                overrideValue = _step3$value[1];

                                            var profile_overrideKey = "profile." + overrideKey;
                                            result$$1[profile_overrideKey] = overrideValue;
                                        }
                                    } catch (err) {
                                        _didIteratorError3 = true;
                                        _iteratorError3 = err;
                                    } finally {
                                        try {
                                            if (!_iteratorNormalCompletion3 && _iterator3.return) {
                                                _iterator3.return();
                                            }
                                        } finally {
                                            if (_didIteratorError3) {
                                                throw _iteratorError3;
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            _didIteratorError2 = true;
                            _iteratorError2 = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                                    _iterator2.return();
                                }
                            } finally {
                                if (_didIteratorError2) {
                                    throw _iteratorError2;
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
        }
        console.log(result$$1);
        return result$$1;
    };
}

// view model class, parameters for constructor, container to bind to
OCTOPRINT_VIEWMODELS.push([
    OverridesViewModel,
    [ "slicingViewModel" ],
    [ "#basic_overrides", "#advanced_overrides" ]
]);
