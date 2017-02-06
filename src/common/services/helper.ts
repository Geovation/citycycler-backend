/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as _ from "lodash";
import * as Seneca from "seneca";

import { config } from "../../config";

export const initialiseSeneca = services => {
    const options: Seneca.Options = {
        debug: {
            undead: true,
        },
        tag: "srv",
    };
    const seneca = Seneca(options);
    const pins = [];
    _.each(services,  (plugin, pin) => {
        seneca.use(plugin, { seneca });
        pins.push(pin);
    });
    seneca
        .listen({
            pins,
            type: config.services.transport,
        });
};
