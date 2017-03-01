/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as R from "ramda";

export const joinStrings = R.curry((char, s1, s2) => [s1, s2].join(char));
export const concat = joinStrings("");

export default {
  concat,
  joinStrings,
};
