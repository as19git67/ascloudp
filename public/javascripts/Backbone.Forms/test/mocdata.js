var formDescription1 = {
    "forms": [{
        "data": {
            "36321_2": "Ferdinand Prantl",
            "36321_12": [{
                "36321_12_x_13": "Nice Alley",
                "36321_12_x_14": 12,
                "36321_12_x_15": "Heaven",
                "36321_12_x_16": "Paradise"
            }],
            "36321_3": "2014-08-03T00:00:00",
            "36321_4": false,
            "36321_7": null,
            "36321_6": null,
            "36321_8": "Employee",
            "36321_5": null,
            "36321_9": null,
            "36321_10": [null],
            "36321_11": null,
            "36321_12_1": null
        },
        "options": {
            "fields": {
                "36321_2": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Name",
                    "readonly": false,
                    "type": "text"
                },
                "36321_12": {
                    "fields": {
                        "item": {
                            "fields": {
                                "36321_12_x_13": {
                                    "hidden": false,
                                    "hideInitValidationError": true,
                                    "label": "Street",
                                    "readonly": false,
                                    "type": "text"
                                },
                                "36321_12_x_14": {
                                    "hidden": false,
                                    "hideInitValidationError": true,
                                    "label": "Number",
                                    "readonly": false,
                                    "type": "integer"
                                },
                                "36321_12_x_15": {
                                    "hidden": false,
                                    "hideInitValidationError": true,
                                    "label": "Town",
                                    "readonly": false,
                                    "type": "text"
                                },
                                "36321_12_x_16": {
                                    "hidden": false,
                                    "hideInitValidationError": true,
                                    "label": "Country",
                                    "readonly": false,
                                    "type": "text"
                                }
                            }, "type": "object"
                        }
                    },
                    "hideInitValidationError": true,
                    "items": {"showMoveDownItemButton": false, "showMoveUpItemButton": false},
                    "label": "Address",
                    "toolbarSticky": true
                },
                "36321_3": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Birth date",
                    "readonly": false,
                    "type": "date"
                },
                "36321_4": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Married",
                    "readonly": false,
                    "type": "checkbox"
                },
                "36321_7": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Wife count",
                    "readonly": false,
                    "type": "radio"
                },
                "36321_6": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Child count",
                    "readonly": false,
                    "type": "integer"
                },
                "36321_8": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Employment",
                    "readonly": false,
                    "type": "radio"
                },
                "36321_5": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Retirement estimation",
                    "optionLabels": ["2020-01-01", "2030-01-01", "2040-01-01", "2050-01-01"],
                    "readonly": false,
                    "type": "select"
                },
                "36321_9": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Deputy",
                    "readonly": false,
                    "type": "otcs_user_picker",
                    "type_control": {
                        "action": "api\/v1\/members",
                        "method": "GET",
                        "name": "",
                        "parameters": {"filter_types": [0], "select_types": [0]}
                    }
                },
                "36321_10": {
                    "fields": {
                        "item": {
                            "type": "otcs_member_picker",
                            "type_control": {
                                "?": {
                                    "action": "api\/v1\/members",
                                    "method": "GET",
                                    "name": "",
                                    "parameters": {"filter_types": [0, 1], "select_types": [0, 1]}
                                }
                            }
                        }
                    },
                    "hidden": false,
                    "hideInitValidationError": true,
                    "items": {"showMoveDownItemButton": false, "showMoveUpItemButton": false},
                    "label": "Relations",
                    "readonly": false,
                    "toolbarSticky": true
                },
                "36321_11": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Comment",
                    "readonly": false,
                    "type": "textarea"
                },
                "36321_12_1": {"hidden": true}
            },
            "form": {
                "attributes": {"action": "api\/v1\/nodes\/69434\/categories\/36321", "method": "PUT"},
                "renderForm": true
            }
        },
        "schema": {
            "properties": {
                "36321_2": {
                    "maxLength": 50,
                    "readonly": false,
                    "required": true,
                    "title": "Name",
                    "type": "string"
                },
                "36321_12": {
                    "items": {
                        "maxItems": 2,
                        "minItems": 1,
                        "properties": {
                            "36321_12_x_13": {
                                "maxLength": 30,
                                "readonly": false,
                                "required": true,
                                "title": "Street",
                                "type": "string"
                            },
                            "36321_12_x_14": {
                                "readonly": false,
                                "required": true,
                                "title": "Number",
                                "type": "integer"
                            },
                            "36321_12_x_15": {
                                "maxLength": 20,
                                "readonly": false,
                                "required": true,
                                "title": "Town",
                                "type": "string"
                            },
                            "36321_12_x_16": {
                                "maxLength": 30,
                                "readonly": false,
                                "required": true,
                                "title": "Country",
                                "type": "string"
                            }
                        },
                        "type": "object"
                    }, "title": "Address", "type": "array"
                },
                "36321_3": {"readonly": false, "required": true, "title": "Birth date", "type": "string"},
                "36321_4": {"readonly": false, "required": false, "title": "Married", "type": "boolean"},
                "36321_7": {
                    "enum": [1, 2, 3],
                    "readonly": false,
                    "required": false,
                    "title": "Wife count",
                    "type": "integer"
                },
                "36321_6": {"readonly": false, "required": false, "title": "Child count", "type": "integer"},
                "36321_8": {
                    "enum": ["Unemployed", "Employee", "Contractor"],
                    "readonly": false,
                    "required": true,
                    "title": "Employment",
                    "type": "string"
                },
                "36321_5": {
                    "enum": ["2020-01-01T00:00:00", "2030-01-01T00:00:00", "2040-01-01T00:00:00", "2050-01-01T00:00:00"],
                    "readonly": false,
                    "required": false,
                    "title": "Retirement estimation",
                    "type": "string"
                },
                "36321_9": {"readonly": false, "required": false, "title": "Deputy", "type": "integer"},
                "36321_10": {
                    "items": {"maxItems": 5, "minItems": 1, "type": "integer"},
                    "readonly": false,
                    "required": false,
                    "title": "Relations",
                    "type": "array"
                },
                "36321_11": {"readonly": false, "required": false, "title": "Comment", "type": "string"},
                "36321_12_1": {"type": "string"}
            }, "type": "object"
        }
    }]
};

var formDescription2 = {
    "forms": [{
        "data": {
            "69437_9": 6401,
            "69437_3": "2000-04-04T00:00:00",
            "69437_17": false,
            "69437_12": {
                "69437_12_1_13": "Werner-von-Siemens Ring",
                "69437_12_1_14": 20,
                "69437_12_1_15": "Grasbrunn",
                "69437_12_1_16": "Deutschland"
            }
        },
        "options": {
            "fields": {
                "69437_9": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Login",
                    "readonly": false,
                    "type": "otcs_user_picker",
                    "type_control": {
                        "action": "api\/v1\/members",
                        "method": "GET",
                        "name": "ferdipr",
                        "parameters": {"filter_types": [0], "select_types": [0]}
                    }
                },
                "69437_3": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Employed since",
                    "readonly": false,
                    "type": "datetime"
                },
                "69437_17": {
                    "hidden": false,
                    "hideInitValidationError": true,
                    "label": "Part-time",
                    "readonly": false,
                    "type": "checkbox"
                },
                "69437_12": {
                    "fields": {
                        "69437_12_1_13": {
                            "hidden": false,
                            "hideInitValidationError": true,
                            "label": "Street",
                            "readonly": false,
                            "type": "text"
                        },
                        "69437_12_1_14": {
                            "hidden": false,
                            "hideInitValidationError": true,
                            "label": "Number",
                            "readonly": false,
                            "type": "integer"
                        },
                        "69437_12_1_15": {
                            "hidden": false,
                            "hideInitValidationError": true,
                            "label": "Town",
                            "readonly": false,
                            "type": "text"
                        },
                        "69437_12_1_16": {
                            "hidden": false,
                            "hideInitValidationError": true,
                            "label": "Country",
                            "readonly": false,
                            "type": "text"
                        }
                    }, "hideInitValidationError": true, "label": "Office", "type": "object"
                }
            },
            "form": {
                "attributes": {"action": "api\/v1\/nodes\/69434\/categories\/69437", "method": "PUT"},
                "renderForm": true
            }
        },
        "schema": {
            "properties": {
                "69437_9": {"readonly": false, "required": false, "title": "Login", "type": "integer"},
                "69437_3": {"readonly": false, "required": false, "title": "Employed since", "type": "string"},
                "69437_17": {"readonly": false, "required": false, "title": "Part-time", "type": "boolean"},
                "69437_12": {
                    "properties": {
                        "69437_12_1_13": {
                            "maxLength": 30,
                            "readonly": false,
                            "required": false,
                            "title": "Street",
                            "type": "string"
                        },
                        "69437_12_1_14": {"readonly": false, "required": false, "title": "Number", "type": "integer"},
                        "69437_12_1_15": {
                            "maxLength": 20,
                            "readonly": false,
                            "required": false,
                            "title": "Town",
                            "type": "string"
                        },
                        "69437_12_1_16": {
                            "maxLength": 30,
                            "readonly": false,
                            "required": false,
                            "title": "Country",
                            "type": "string"
                        }
                    }, "title": "Office", "type": "object"
                }
            }, "type": "object"
        }
    }]
};