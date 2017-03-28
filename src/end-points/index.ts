import { route } from "./route";
import { matchRoute } from "./route/match";
import { nearby } from "./route/nearby";
import { users } from "./users";
import { auth as authUser } from "./users/auth";

export const endpoints = [route, nearby, matchRoute, users, authUser];
