import { buddyRequest,
        buddyRequestStatus,
        receivedBuddyRequest,
        sentBuddyRequest } from "./buddyRequest";
import { E2EUtils } from "./clearE2EObjects";
import { experiencedRoute } from "./experiencedRoute";
import { matchRoute } from "./experiencedRoute/match";
import { nearby } from "./experiencedRoute/nearby";
import { inexperiencedRoute } from "./inexperiencedRoute";
import { queryInexperiencedRoute } from "./inexperiencedRoute/query";
import { user } from "./user";
import { auth as authUser } from "./user/auth";

export const endpoints = [
    buddyRequest,
    buddyRequestStatus,
    sentBuddyRequest,
    receivedBuddyRequest,
    experiencedRoute,
    nearby,
    matchRoute,
    user,
    authUser,
    inexperiencedRoute,
    queryInexperiencedRoute,
    E2EUtils,
];
