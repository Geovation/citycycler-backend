import { buddyRequest } from "./buddyRequest";
import { route } from "./route";
import { matchRoute } from "./route/match";
import { nearby } from "./route/nearby";
import { user } from "./user";
import { auth as authUser } from "./user/auth";

export const endpoints = [route, nearby, matchRoute, user, authUser, buddyRequest];
