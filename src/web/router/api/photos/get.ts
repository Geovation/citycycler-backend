// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// PATH
const paths = {
    get: {
        consumes: ["application/json"],
        description: "Returns a hard-coded array of strings to test UI/API communicaiton and function endpoint.",
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "A list of photo filenames",
                example: {
                    "application/json": [
                        "picture1.jpg",
                        "picture2.png",
                        "picture3.tiff",
                        "picture4.gif",
                    ],
                },
                schema: {
                    $ref: "#/definitions/StringArray",
                },
            },
            default: {
                description: "unexpected error",
                schema: {
                  $ref: "#/definitions/Error",
                },
            },
        },
        tags: [
            "photos",
        ],
    },
};

// DEFINITIONS
const definitions = {
    StringArray: {
        items: {
            type: "string",
        },
        type: "array",
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

// Handle request

/* tslint:disable only-arrow-functions */
const getPhotos = function * (next) {
    const hardCodedPhotos = [
        "Pokémon Yellow",
        "Super Metroid",
        "Mega Man X",
        "The Legend of Zelda",
        "Pac-Man",
        "Super Mario World",
        "Street Fighter II",
        "Half Life",
        "Final Fantasy VII",
        "Star Fox",
        "Tetris",
        "Donkey Kong III",
        "GoldenEye 007",
        "Doom",
        "Fallout",
        "GTA",
        "Halo",
    ];

    this.body = hardCodedPhotos;
};
/* tslint:enable only-arrow-functions */

export const get = {
    definitions,
    get: getPhotos,
    paths,
};
