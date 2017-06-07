import { lineStringToCoords } from "./database";
import * as moment from "moment";
export default class BuddyRequest {
    public static fromSQLRow(row) {
        return new BuddyRequest({
            averageSpeed: row.averagespeed,
            created: row.created,
            divorcePoint: lineStringToCoords(row.divorcepoint),
            divorceTime: row.divorcetime,
            experiencedRoute: row.experiencedroute,
            experiencedRouteName: row.experiencedroutename,
            experiencedUser: row.experienceduser,
            id: row.id,
            inexperiencedRoute: row.inexperiencedroute,
            meetingPoint: lineStringToCoords(row.meetingpoint),
            meetingTime: row.meetingtime,
            owner: row.owner,
            status: row.status,
            updated: row.updated,
        });
    }

    public id: number;
    public experiencedRouteName: string;
    public experiencedRoute: number;
    public experiencedUser: number;
    public owner: number;
    public inexperiencedRoute: number;
    public meetingTime: string;
    public divorceTime: number;
    public meetingPoint: [number, number];
    public divorcePoint: [number, number];
    public averageSpeed: number;
    public created: string;
    public updated: string;
    public status: string;

    constructor(obj) {
        if (!obj.meetingTime) {
            throw new Error("400:BuddyRequest requires a meetingTime");
        } else if (!obj.divorceTime) {
            throw new Error("400:BuddyRequest requires a divorceTime");
        }
        let meetingTime;
        let divorceTime;
        try {
            meetingTime = moment(obj.meetingTime);
            if (!meetingTime.isValid()) {
                throw "Oh no!";
            }
        } catch (e) {
            throw new Error("400:BuddyRequest requires a valid meeting time");
        }
        try {
            divorceTime = moment(obj.divorceTime);
            if (!divorceTime.isValid()) {
                throw "Oh no!";
            }
        } catch (e) {
            throw new Error("400:BuddyRequest requires a valid divorce time");
        }
        if (divorceTime.isBefore(meetingTime)) {
            throw new Error("400:Meeting time is before Divorce time");
        } else if (obj.experiencedRouteName === undefined || obj.experiencedRouteName === null) {
            throw new Error("400:BuddyRequest requires an experiencedRouteName");
        } else if (obj.experiencedRoute === undefined || obj.experiencedRoute === null) {
            throw new Error("400:BuddyRequest requires an experiencedRoute");
        } else if (obj.experiencedUser === undefined || obj.experiencedUser === null) {
            throw new Error("400:BuddyRequest requires an experiencedUser");
        } else if (obj.inexperiencedRoute === undefined || obj.inexperiencedRoute === null) {
            throw new Error("400:BuddyRequest requires an inexperiencedRoute");
        } else if (obj.meetingPoint === undefined || obj.meetingPoint === null) {
            throw new Error("400:BuddyRequest requires a meetingPoint");
        } else if (obj.meetingPoint.length !== 2 || typeof obj.meetingPoint[0] !== "number" ||
                    typeof obj.meetingPoint[1] !== "number") {
            throw new Error("400:BuddyRequest requires a 2D meeting point");
        } else if (obj.divorcePoint === undefined || obj.divorcePoint === null) {
            throw new Error("400:BuddyRequest requires a divorcePoint");
        } else if (obj.divorcePoint.length !== 2 || typeof obj.divorcePoint[0] !== "number" ||
                    typeof obj.divorcePoint[1] !== "number") {
            throw new Error("400:BuddyRequest requires a 2D divorce point");
        } else if (obj.averageSpeed === undefined || obj.averageSpeed === null) {
            throw new Error("400:BuddyRequest requires an averageSpeed");
        } else if (obj.created === undefined || obj.created === null) {
            throw new Error("400:BuddyRequest requires a created");
        } else if (obj.updated === undefined || obj.updated === null) {
            throw new Error("400:BuddyRequest requires an updated");
        } else if (obj.status === undefined || obj.status === null) {
            throw new Error("400:BuddyRequest requires a status");
        } else if (["accepted", "pending", "canceled", "rejected"].indexOf(obj.status) === -1) {
            throw new Error("400:BuddyRequest requires a status of 'pending', 'accepted', 'rejected' or 'canceled'");
        } else if (obj.owner === undefined || obj.owner === null) {
            throw new Error("400:BuddyRequest requires an owner");
        } else if (obj.id === undefined || obj.id === null) {
            throw new Error("400:BuddyRequest requires an id");
        }
        this.averageSpeed = obj.averageSpeed;
        this.created = obj.created;
        this.divorcePoint = obj.divorcePoint;
        this.divorceTime = obj.divorceTime;
        this.experiencedRoute = obj.experiencedRoute;
        this.experiencedRouteName = obj.experiencedRouteName;
        this.experiencedUser = obj.experiencedUser;
        this.id = obj.id;
        this.inexperiencedRoute = obj.inexperiencedRoute;
        this.meetingTime = obj.meetingTime;
        this.meetingPoint = obj.meetingPoint;
        this.owner = obj.owner;
        this.status = obj.status;
        this.updated = obj.updated;
    }
}
