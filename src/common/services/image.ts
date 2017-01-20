const imageMetadata: { url: string }[] = [
    { url: "http://timepix.com/images/Pokémon Yellow" },
    { url: "http://timepix.com/images/Super Metroid" },
    { url: "http://timepix.com/images/Mega Man X" },
    { url: "http://timepix.com/images/The Legend of Zelda" },
    { url: "http://timepix.com/images/Pac-Man" },
    { url: "http://timepix.com/images/Super Mario World" },
    { url: "http://timepix.com/images/Street Fighter II" },
    { url: "http://timepix.com/images/Half Life" },
    { url: "http://timepix.com/images/Final Fantasy VII" },
    { url: "http://timepix.com/images/Star Fox" },
    { url: "http://timepix.com/images/Tetris" },
    { url: "http://timepix.com/images/Donkey Kong III" },
    { url: "http://timepix.com/images/GoldenEye 007" },
    { url: "http://timepix.com/images/Doom" },
    { url: "http://timepix.com/images/Fallout" },
    { url: "http://timepix.com/images/GTA" },
    { url: "http://timepix.com/images/Halo" },
];

export const image = options => {
    const seneca = options.seneca;

    seneca.add("role:image,cmd:get", (msg, respond) => {
        respond(null, { ok: true, result: imageMetadata });
    });

    return {
        name: "image",
        options: {},
    };
};
