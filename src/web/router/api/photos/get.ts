// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// PATH
const swaggerPath = {
    get: {
        consumes: ["application/json"],
        description: "be greeted by the API",
        parameters: [
            {
                in: "query",
                name: "name",
                type: "string",
            },
        ],
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
const swaggerDefs = {
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

const getPhotos = async (ctx, next): Promise<any> => {
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

    ctx.body = hardCodedPhotos;
};

export const get = {
    get: getPhotos,
    swaggerPath,
    swaggerDefs,
};
