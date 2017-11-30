import { lineStringToCoords, pointStringToCoords } from "./database";
import * as moment from "moment";
export default class BuddyRequest {
    public static fromSQLRow(row) {
        return new BuddyRequest({
            averageSpeed: row.averagespeed,
            created: row.created,
            divorcePoint: pointStringToCoords(row.divorcepoint),
            divorcePointName: row.divorcepointname,
            divorceTime: row.divorcetime,
            experiencedRoute: row.experiencedroute,
            experiencedRouteName: row.experiencedroutename,
            experiencedUser: row.experienceduser,
            id: row.id,
            inexperiencedRoute: row.inexperiencedroute,
            inexperiencedRouteName: row.inexperiencedroutename,
            length: row.length,
            meetingPoint: pointStringToCoords(row.meetingpoint),
            meetingPointName: row.meetingpointname,
            meetingTime: row.meetingtime,
            owner: row.owner,
            reason: row.reason,
            review: row.review,
            route: lineStringToCoords(row.route),
            status: row.status,
            updated: row.updated,
        });
    }

    public id?: number;
    public experiencedRouteName: string;
    public experiencedRoute: number;
    public experiencedUser: string;
    public owner: string;
    public inexperiencedRoute: number;
    public inexperiencedRouteName: string;
    public meetingTime: string;
    public divorceTime: number;
    public meetingPoint: [number, number];
    public divorcePoint: [number, number];
    public meetingPointName: string;
    public divorcePointName: string;
    public route: [number, number][];
    public averageSpeed: number;
    public created: string;
    public updated: string;
    public status: string;
    public reason: string;
    public review: number;
    public length: number;

    constructor(obj) {
        if (!obj.meetingTime) {
            throw new Error("400:BuddyRequest requires a meetingTime");
        } else if (!obj.divorceTime) {
            throw new Error("400:BuddyRequest requires a divorceTime");
        }
        let meetingTime;
        let divorceTime;
        try {
            // Pass the date using strict ISO 8601, otherwise invalid dates give a big warning
            meetingTime = moment(obj.meetingTime, moment.ISO_8601, true);
            if (!meetingTime.isValid()) {
                throw "Oh no!";
            }
        } catch (e) {
            throw new Error("400:BuddyRequest requires a valid meeting time");
        }
        try {
            divorceTime = moment(obj.divorceTime, moment.ISO_8601, true);
            if (!divorceTime.isValid()) {
                throw "Oh no!";
            }
        } catch (e) {
            throw new Error("400:BuddyRequest requires a valid divorce time");
        }
        if (divorceTime.isBefore(meetingTime)) {
            throw new Error("400:Divorce time is before Meeting time");
        } else if (obj.length === undefined || obj.length === null) {
            throw new Error("400:BuddyRequest requires a length");
        } else if (obj.experiencedRouteName === undefined || obj.experiencedRouteName === null) {
            throw new Error("400:BuddyRequest requires an experiencedRouteName");
        } else if ((obj.experiencedRoute === undefined || obj.experiencedRoute === null)
            && obj.status !== "canceled") {
            throw new Error("400:BuddyRequest requires an experiencedRoute");
        } else if ((obj.experiencedUser === undefined || obj.experiencedUser === null)
            && obj.status !== "canceled") {
            throw new Error("400:BuddyRequest requires an experiencedUser");
        } else if ((obj.inexperiencedRoute === undefined || obj.inexperiencedRoute === null)
            && obj.status !== "canceled") {
            throw new Error("400:BuddyRequest requires an inexperiencedRoute");
        } else if (obj.inexperiencedRouteName === undefined || obj.inexperiencedRouteName === null) {
            throw new Error("400:BuddyRequest requires an inexperiencedRouteName");
        } else if (obj.meetingPointName === undefined || obj.meetingPointName === null) {
            throw new Error("400:BuddyRequest requires a meetingPointName");
        } else if (obj.meetingPoint === undefined || obj.meetingPoint === null) {
            throw new Error("400:BuddyRequest requires a meetingPoint");
        } else if (obj.meetingPoint.length !== 2 || typeof obj.meetingPoint[0] !== "number" ||
                    typeof obj.meetingPoint[1] !== "number") {
            throw new Error("400:BuddyRequest requires a 2D meeting point");
        } else if (obj.divorcePointName === undefined || obj.divorcePointName === null) {
            throw new Error("400:BuddyRequest requires a divorcePointName");
        } else if (obj.divorcePoint === undefined || obj.divorcePoint === null) {
            throw new Error("400:BuddyRequest requires a divorcePoint");
        } else if (obj.divorcePoint.length !== 2 || typeof obj.divorcePoint[0] !== "number" ||
                    typeof obj.divorcePoint[1] !== "number") {
            throw new Error("400:BuddyRequest requires a 2D divorce point");
        } else if (obj.route === undefined || obj.route === null) {
            throw new Error("400:BuddyRequest requires a route");
        } else if (obj.route.length < 2) {
            throw new Error("400:BuddyRequest requires a route of at least 2 points");
        } else if (Math.max(...obj.route.map((c) => { return c.length; })) !== 2) {
            throw new Error("400:BuddyRequest requires a route of 2D points");
        } else if (Math.min(...obj.route.map((c) => { return c.length; })) !== 2) {
            throw new Error("400:BuddyRequest requires a route of 2D points");
        } else if (obj.averageSpeed === undefined || obj.averageSpeed === null) {
            throw new Error("400:BuddyRequest requires an averageSpeed");
        } else if (obj.created === undefined || obj.created === null) {
            throw new Error("400:BuddyRequest requires a created");
        } else if (obj.updated === undefined || obj.updated === null) {
            throw new Error("400:BuddyRequest requires an updated");
        } else if (obj.status === undefined || obj.status === null) {
            throw new Error("400:BuddyRequest requires a status");
        } else if (["accepted", "pending", "canceled", "rejected", "completed"].indexOf(obj.status) === -1) {
            throw new Error("400:BuddyRequest requires a status of 'pending', 'accepted', 'rejected', " +
                "'canceled' or 'completed'");
        } else if (obj.reason === undefined || obj.reason === null) {
            obj.reason = "";
        } else if ((obj.owner === undefined || obj.owner === null) && obj.status !== "canceled") {
            throw new Error("400:BuddyRequest requires an owner");
        } else if (obj.review === undefined || obj.review === null) {
            obj.review = 0;
        } else if (obj.review < 0 || obj.review > 5) { // also exclude the default 0
            throw new Error("400:BuddyRequest review must be between 1 and 5");
        }
        this.averageSpeed = obj.averageSpeed;
        this.created = obj.created;
        this.divorcePoint = obj.divorcePoint;
        this.divorcePointName = obj.divorcePointName;
        this.divorceTime = obj.divorceTime;
        this.experiencedRoute = obj.experiencedRoute;
        this.experiencedRouteName = obj.experiencedRouteName;
        this.experiencedUser = obj.experiencedUser;
        this.id = obj.id;
        this.inexperiencedRoute = obj.inexperiencedRoute;
        this.inexperiencedRouteName = obj.inexperiencedRouteName;
        this.meetingTime = obj.meetingTime;
        this.meetingPoint = obj.meetingPoint;
        this.meetingPointName = obj.meetingPointName;
        this.owner = obj.owner;
        this.reason = obj.reason;
        this.route = obj.route;
        this.status = obj.status;
        this.updated = obj.updated;
        this.review = obj.review;
        this.length = obj.length;
    }
}
